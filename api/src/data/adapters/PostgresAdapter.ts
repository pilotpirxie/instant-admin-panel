import pgPromise from 'pg-promise';
import { DatabaseConfig } from '../ConfigInterface';
import { 
  DatabaseAdapter,
  DatabaseValue,
  TableData,
  TableDataOptions,
  TableSchema,
  UnifiedColumnType,
  ColumnInfo,
  ForeignKey,
  Constraint,
  ForeignKeyAction
} from '../DatabaseAdapter'; 

export class PostgresAdapter implements DatabaseAdapter {
  private db: pgPromise.IDatabase<unknown> | null = null;
  private pgp: pgPromise.IMain;
  private config: DatabaseConfig | null = null;

  constructor() {
    this.pgp = pgPromise();
  }
  
  async connect(config: DatabaseConfig): Promise<void> {
    if (this.db) {
      await this.disconnect();
    }

    this.config = config;

    const connectionConfig = {
      host: config.connection.host,
      port: config.connection.port,
      user: config.connection.user,
      password: config.connection.password,
      database: config.connection.database,
      schema: config.connection.schema,
      ssl: config.connection.ssl,
      poolSize: config.connection.poolSize,
      idleTimeoutMillis: config.connection.idleTimeoutMillis,
      connectionTimeoutMillis: config.connection.connectionTimeoutMillis
    };

    this.db = this.pgp(connectionConfig);
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.$pool.end();
      this.db = null;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.db) return false;
    try {
      const result = await this.db.one('SELECT 1 as healthcheck');
      return result.healthcheck === 1;
    } catch {
      return false;
    }
  }

  async getTableList(): Promise<string[]> {
    if (!this.db) throw new Error('Database not connected');
    if (!this.config) throw new Error('Database config not set');
    
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
    `;
    
    const tables = await this.db.any(query, [this.config.connection.schema]);
    return tables.map(t => t.table_name);
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    if (!this.db) throw new Error('Database not connected');
    if (!this.config) throw new Error('Database config not set');

    const columnsQuery = `
      SELECT 
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM 
        information_schema.columns
      WHERE 
        table_schema = $1
        AND table_name = $2
      ORDER BY 
        ordinal_position
    `;

    const columns = await this.db.any(columnsQuery, [this.config.connection.schema, tableName]);

    const primaryKeyQuery = `
      SELECT 
        kcu.column_name
      FROM 
        information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
      WHERE 
        tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
    `;

    const primaryKeys = await this.db.any(primaryKeyQuery, [this.config.connection.schema, tableName]);
    const primaryKeyColumns = primaryKeys.map(pk => pk.column_name);

    const foreignKeyQuery = `
      SELECT
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule,
        rc.update_rule
      FROM
        information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
          AND tc.table_schema = rc.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE
        tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
    `;

    const foreignKeys = await this.db.any(foreignKeyQuery, [this.config.connection.schema, tableName]);

    const constraintQuery = `
      WITH table_oid AS (
        SELECT c.oid
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1
        AND c.relname = $2
      )
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        cc.check_clause,
        pg_get_constraintdef(pgc.oid) as constraint_definition
      FROM
        information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.check_constraints cc
          ON tc.constraint_name = cc.constraint_name
          AND tc.table_schema = cc.constraint_schema
        LEFT JOIN pg_catalog.pg_constraint pgc
          ON pgc.conname = tc.constraint_name
          AND pgc.conrelid = (SELECT oid FROM table_oid)
      WHERE
        tc.table_schema = $1
        AND tc.table_name = $2
        AND tc.constraint_type IN ('UNIQUE', 'CHECK')
    `;

    const constraints = await this.db.any(constraintQuery, [this.config.connection.schema, tableName]);

    const mapPostgresTypeToUnifiedType = (dataType: string, udtName: string): UnifiedColumnType => {
      switch (udtName) {
      case 'int2':
      case 'int4':
      case 'int8':
      case 'smallint':
      case 'integer':
      case 'bigint':
        return UnifiedColumnType.INTEGER;
      case 'float4':
      case 'float8':
      case 'real':
      case 'double precision':
        return UnifiedColumnType.FLOAT;
      case 'numeric':
      case 'decimal':
        return UnifiedColumnType.DECIMAL;
      case 'char':
      case 'varchar':
      case 'text':
      case 'name':
      case 'bpchar':
      case 'uuid':
        return UnifiedColumnType.STRING;
      case 'bool':
      case 'boolean':
        return UnifiedColumnType.BOOLEAN;
      case 'date':
        return UnifiedColumnType.DATE;
      case 'time':
      case 'timetz':
        return UnifiedColumnType.TIME;
      case 'timestamp':
      case 'timestamptz':
        return UnifiedColumnType.DATETIME;
      case 'bytea':
        return UnifiedColumnType.BINARY;
      case 'json':
      case 'jsonb':
        return UnifiedColumnType.JSON;
      case '_int2':
      case '_int4':
      case '_int8':
      case '_text':
      case '_varchar':
      case '_bool':
      case '_numeric':
      case '_float4':
      case '_float8':
      case '_timestamp':
      case '_date':
      case '_uuid':
        return UnifiedColumnType.ARRAY;
      case 'hstore':
      case 'record':
        return UnifiedColumnType.OBJECT;
      default:
        return UnifiedColumnType.UNKNOWN;
      }
    };

    const processedColumns: ColumnInfo[] = columns.map(column => {
      return {
        name: column.column_name,
        dataType: column.data_type,
        unifiedType: mapPostgresTypeToUnifiedType(column.data_type, column.udt_name),
        isNullable: column.is_nullable === 'YES',
        defaultValue: column.column_default || undefined
      };
    });

    const processedForeignKeys: ForeignKey[] = foreignKeys.map(fk => ({
      column: fk.column_name,
      foreignTable: fk.foreign_table_name,
      foreignColumn: fk.foreign_column_name,
      onDelete: fk.delete_rule as ForeignKeyAction,
      onUpdate: fk.update_rule as ForeignKeyAction
    }));

    const processedConstraints: Constraint[] = [];
    
    const uniqueConstraints = constraints.filter(c => c.constraint_type === 'UNIQUE');
    for (const constraint of uniqueConstraints) {
      processedConstraints.push({
        name: constraint.constraint_name,
        type: 'UNIQUE',
        content: constraint.constraint_definition
      });
    }
    
    const checkConstraints = constraints.filter(c => c.constraint_type === 'CHECK');
    
    for (const constraint of checkConstraints) {
      processedConstraints.push({
        name: constraint.constraint_name,
        type: 'CHECK',
        content: constraint.constraint_definition || constraint.check_clause
      });
    }

    const uniqueKeys = constraints.filter(c => c.constraint_type === 'UNIQUE');
    const uniqueKeyColumns = uniqueKeys.map(uk => uk.column_name);

    return {
      name: tableName,
      columns: processedColumns,
      primaryKey: primaryKeyColumns,
      uniqueKeys: uniqueKeyColumns,
      foreignKeys: processedForeignKeys,
      constraints: processedConstraints
    };
  }

   
  async createRecord<T extends Record<string, DatabaseValue>>(tableName: string, record: T): Promise<T> {
    if (!this.db) throw new Error('Database not connected');
    if (!this.config) throw new Error('Database config not set');

    try {
      const filteredRecord: Partial<T> = {};
      for (const key in record) {
        if (record[key] !== undefined) {
          filteredRecord[key] = record[key];
        }
      }

      const columns = Object.keys(filteredRecord);
      const values = Object.values(filteredRecord);
      
      if (columns.length === 0) {
        throw new Error('Record cannot be empty');
      }

      const columnNames = columns.join(', ');
      const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      
      const query = `
        INSERT INTO "${this.config.connection.schema}"."${tableName}" 
        (${columnNames}) 
        VALUES (${valuePlaceholders})
        RETURNING *`;

      const result = await this.db.one(query, values);
      return result as T;
    } catch (error) {
      let errorMessage = 'Failed to create record';
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }
      throw new Error(errorMessage);
    }
  }

  async deleteRecord(tableName: string, where: Record<string, DatabaseValue>): Promise<boolean> {
    if (!this.db) throw new Error('Database not connected');
    if (!this.config) throw new Error('Database config not set');

    try {
      if (Object.keys(where).length === 0) {
        throw new Error('Where conditions cannot be empty');
      }

      const schema = this.config.connection.schema;
      
      const whereColumns = Object.keys(where);
      const whereValues: DatabaseValue[] = [];
      const whereClauses: string[] = [];
      
      whereColumns.forEach(column => {
        const value = where[column];
        const safeColumnName = this.pgp.as.name(column);
        
        if (value === null) {
          whereClauses.push(`${safeColumnName} IS NULL`);
        } else {
          whereValues.push(value);
          whereClauses.push(`${safeColumnName} = $${whereValues.length}`);
        }
      });

      const whereClause = whereClauses.join(' AND ');
      
      const safeSchemaName = this.pgp.as.name(schema);
      const safeTableName = this.pgp.as.name(tableName);
      
      const query = `
        DELETE FROM ${safeSchemaName}.${safeTableName}
        WHERE ${whereClause}
        RETURNING 1 AS deleted
      `;

      const result = await this.db.oneOrNone(query, whereValues);
      return !!result;
    } catch (error) {
      let errorMessage = 'Failed to delete record';
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }
      throw new Error(errorMessage);
    }
  }

  async getTableData<T extends Record<string, DatabaseValue>>(tableName: string, options: TableDataOptions): Promise<TableData<T>> {
    if (!this.db) throw new Error('Database not connected');
    if (!this.config) throw new Error('Database config not set');

    try {
      const schema = this.config.connection.schema;
      const safeSchemaName = this.pgp.as.name(schema);
      const safeTableName = this.pgp.as.name(tableName);
      
      const perPage = options.perPage || 10;
      const page = options.page || 1;
      const offset = (page - 1) * perPage;
      
      const queryParams: DatabaseValue[] = [];
      
      let whereClause = '';
      if (options.filters && options.filters.length > 0) {
        const filterClauses: string[] = [];
        
        for (const filter of options.filters) {
          const safeColumnName = this.pgp.as.name(filter.column);
          
          switch (filter.operator) {
          case 'eq':
            if (filter.value === null) {
              filterClauses.push(`${safeColumnName} IS NULL`);
            } else {
              queryParams.push(filter.value);
              filterClauses.push(`${safeColumnName} = $${queryParams.length}`);
            }
            break;
          case 'neq':
            if (filter.value === null) {
              filterClauses.push(`${safeColumnName} IS NOT NULL`);
            } else {
              queryParams.push(filter.value);
              filterClauses.push(`${safeColumnName} <> $${queryParams.length}`);
            }
            break;
          case 'gt':
            queryParams.push(filter.value);
            filterClauses.push(`${safeColumnName} > $${queryParams.length}`);
            break;
          case 'gte':
            queryParams.push(filter.value);
            filterClauses.push(`${safeColumnName} >= $${queryParams.length}`);
            break;
          case 'lt':
            queryParams.push(filter.value);
            filterClauses.push(`${safeColumnName} < $${queryParams.length}`);
            break;
          case 'lte':
            queryParams.push(filter.value);
            filterClauses.push(`${safeColumnName} <= $${queryParams.length}`);
            break;
          case 'in':
            if (Array.isArray(filter.value)) {
              queryParams.push(filter.value);
              filterClauses.push(`${safeColumnName} = ANY($${queryParams.length})`);
            }
            break;
          case 'nin':
            if (Array.isArray(filter.value)) {
              queryParams.push(filter.value);
              filterClauses.push(`${safeColumnName} != ALL($${queryParams.length})`);
            }
            break;
          case 'like':
            queryParams.push(filter.value);
            filterClauses.push(`${safeColumnName} LIKE $${queryParams.length}`);
            break;
          case 'contains':
            queryParams.push(`%${filter.value}%`);
            filterClauses.push(`${safeColumnName} LIKE $${queryParams.length}`);
            break;
          case 'isNull':
            filterClauses.push(`${safeColumnName} IS NULL`);
            break;
          case 'isNotNull':
            filterClauses.push(`${safeColumnName} IS NOT NULL`);
            break;
          default:
            throw new Error(`Unsupported filter operator: ${filter.operator}`);
          }
        }
        
        if (filterClauses.length > 0) {
          whereClause = `WHERE ${filterClauses.join(' AND ')}`;
        }
      }
      
      let orderByClause = '';
      if (options.orderBy && options.orderBy.length > 0) {
        const orderByTerms = options.orderBy.map(sort => {
          const safeColumnName = this.pgp.as.name(sort.column);
          const direction = sort.direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
          
          const nullsPosition = direction === 'DESC' ? 'NULLS LAST' : 'NULLS FIRST';
          
          return `${safeColumnName} ${direction} ${nullsPosition}`;
        });
        
        orderByClause = `ORDER BY ${orderByTerms.join(', ')}`;
      }
      
      const dataQuery = `
        SELECT * FROM ${safeSchemaName}.${safeTableName}
        ${whereClause}
        ${orderByClause}
        LIMIT ${perPage} OFFSET ${offset}
      `;
      
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM ${safeSchemaName}.${safeTableName}
        ${whereClause}
      `;
      
      const [data, countResult] = await Promise.all([
        this.db.any(dataQuery, queryParams),
        this.db.one(countQuery, queryParams)
      ]);
      
      const total = parseInt(countResult.total, 10);
      const totalPages = Math.ceil(total / perPage) || 0;
      
      return {
        data: data as T[],
        total,
        page,
        perPage,
        totalPages
      };
    } catch (error) {
      let errorMessage = 'Failed to fetch table data';
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }
      throw new Error(errorMessage);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateRecord<T>(tableName: string, where: Record<string, DatabaseValue>, record: Partial<T>): Promise<T> {
    return Promise.resolve(undefined as unknown as T);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async executeStatement<T>(statement: string, params: DatabaseValue[] | undefined): Promise<T[]> {
    return Promise.resolve([]);
  }
}
