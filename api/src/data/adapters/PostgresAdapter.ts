import pgPromise from 'pg-promise';
import { DatabaseConfig } from '../ConfigInterface';
import { 
  DatabaseAdapter,
  DatabaseValue,
  TableData,
  TableDataOptions,
  TableSchema, 
} from '../DatabaseAdapter'; 

export class PostgresAdapter implements DatabaseAdapter {
  private db: pgPromise.IDatabase<any> | null = null;
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
      WHERE table_schema = '${this.config.connection.schema}'
      AND table_type = 'BASE TABLE'
    `;
    
    const tables = await this.db.any(query);
    return tables.map(t => t.table_name);
  }

  getTableSchema(tableName: string): Promise<TableSchema> {
    return Promise.resolve(undefined as unknown as TableSchema);
  }

  createRecord<T>(tableName: string, record: T): Promise<T> {
    return Promise.resolve(undefined as unknown as T);
  }

  deleteRecord(tableName: string, where: Record<string, DatabaseValue>): Promise<boolean> {
    return Promise.resolve(false);
  }

  executeStatement<T>(statement: string, params: DatabaseValue[] | undefined): Promise<T[]> {
    return Promise.resolve([]);
  }

  getTableData<T extends Record<string, DatabaseValue>>(tableName: string, options: TableDataOptions): Promise<TableData<T>> {
    return Promise.resolve(undefined as unknown as TableData<T>);
  }

  updateRecord<T>(tableName: string, where: Record<string, DatabaseValue>, record: Partial<T>): Promise<T> {
    return Promise.resolve(undefined as unknown as T);
  }
}
