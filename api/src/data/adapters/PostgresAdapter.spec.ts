import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { PostgresAdapter } from './PostgresAdapter';
import { DatabaseConfig } from '../ConfigInterface';
import { UnifiedColumnType } from '../DatabaseAdapter';

describe('PostgresAdapter', () => {
  let adapter: PostgresAdapter;
  let testConfig: DatabaseConfig;

  before(async () => {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = parseInt(process.env.DB_PORT || '35432', 10);
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || 'mysecretpassword';
    const dbName = process.env.DB_NAME || 'postgres';
    const dbSchema = process.env.DB_SCHEMA || 'public';

    if (!dbHost || !dbPort || !dbUser || !dbPassword || !dbName || !dbSchema) {
      throw new Error('Missing database configuration');
    }

    if (dbHost !== 'localhost' || dbUser !== 'postgres' || dbPassword !== 'mysecretpassword' || dbName !== 'postgres' || dbSchema !== 'public') {
      throw new Error('For safety reasons, database host must be localhost, user must be postgres, password must be mysecretpassword, name must be postgres, and schema must be public');
    }

    adapter = new PostgresAdapter();
    testConfig = {
      dialect: 'postgresql',
      connection: {
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
        database: dbName,
        schema: dbSchema,
        ssl: false,
        poolSize: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      }
    };
    
    await adapter.connect(testConfig);
    await createTestTables();
  });

  after(async () => {
    await dropTestTables();
    await adapter.disconnect();
  });

  async function createTestTables() {
    const db = adapter['db'];
    if (!db) throw new Error('Database not connected');

    await db.none(`
      CREATE TABLE IF NOT EXISTS test_schema_table (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE,
        age INTEGER CHECK (age >= 0),
        salary DECIMAL(10, 2),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        data JSONB,
        tags TEXT[],
        profile_picture BYTEA,
        CONSTRAINT test_schema_table_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
      )
    `);

    await db.none(`
      CREATE TABLE IF NOT EXISTS test_schema_related_table (
        id SERIAL PRIMARY KEY,
        test_id INTEGER REFERENCES test_schema_table(id) ON DELETE CASCADE,
        description TEXT
      )
    `);
  }

  async function dropTestTables() {
    const db = adapter['db'];
    if (!db) throw new Error('Database not connected');

    await db.none(`DROP TABLE IF EXISTS test_schema_related_table`);
    await db.none(`DROP TABLE IF EXISTS test_schema_table`);
  }

  describe('connect', () => {
    it('should connect to the database successfully', async () => {
      await adapter.connect(testConfig);
      const isConnected = await adapter.healthCheck();
      assert.strictEqual(isConnected, true, 'Database should be connected');
    });

    it('should disconnect and reconnect when connecting again', async () => {
      await adapter.connect(testConfig);
      const isConnected = await adapter.healthCheck();
      assert.strictEqual(isConnected, true, 'Database should be connected after reconnection');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from the database', async () => {
      await adapter.disconnect();
      const isConnected = await adapter.healthCheck();
      assert.strictEqual(isConnected, false, 'Database should be disconnected');
    });
  });

  describe('healthCheck', () => {
    it('should return false when not connected', async () => {
      const isConnected = await adapter.healthCheck();
      assert.strictEqual(isConnected, false, 'Health check should return false when disconnected');
    });

    it('should return true when connected', async () => {
      await adapter.connect(testConfig);
      const isConnected = await adapter.healthCheck();
      assert.strictEqual(isConnected, true, 'Health check should return true when connected');
    });
  });

  describe('getTableList', () => {
    it('should throw an error when not connected', async () => {
      await adapter.disconnect();
      try {
        await adapter.getTableList();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an Error');
        assert.strictEqual(error.message, 'Database not connected', 'Error message should match');
      }
    });

    it('should return a list of tables when connected', async () => {
      await adapter.connect(testConfig);
      const tables = await adapter.getTableList();
      assert.ok(Array.isArray(tables), 'Should return an array');
      assert.ok(tables.length > 0, 'Should return at least one table');
      assert.ok(tables.includes('test_schema_table'), 'Should include our test table');
    });
  });

  describe('getTableSchema', () => {
    it('should throw an error when not connected', async () => {
      await adapter.disconnect();
      try {
        await adapter.getTableSchema('test_schema_table');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an Error');
        assert.strictEqual(error.message, 'Database not connected', 'Error message should match');
      }
    });

    it('should return the correct schema for a table', async () => {
      await adapter.connect(testConfig);
      const schema = await adapter.getTableSchema('test_schema_table');
      console.info('Schema:', JSON.stringify(schema, null, 2));

      assert.strictEqual(schema.name, 'test_schema_table', 'Table name should match');
      assert.ok(Array.isArray(schema.columns), 'Columns should be an array');
      assert.ok(schema.columns.length > 0, 'Should have at least one column');
      
      assert.ok(Array.isArray(schema.primaryKey), 'Primary key should be an array');
      assert.strictEqual(schema.primaryKey?.length, 1, 'Should have one primary key column');
      assert.strictEqual(schema.primaryKey?.[0], 'id', 'Primary key should be id');
      
      const idColumn = schema.columns.find(col => col.name === 'id');
      assert.ok(idColumn, 'Should have an id column');
      assert.strictEqual(idColumn?.unifiedType, UnifiedColumnType.INTEGER, 'id column should be INTEGER type');
      
      const nameColumn = schema.columns.find(col => col.name === 'name');
      assert.ok(nameColumn, 'Should have a name column');
      assert.strictEqual(nameColumn?.isNullable, false, 'name column should not be nullable');
      assert.strictEqual(nameColumn?.unifiedType, UnifiedColumnType.STRING, 'name column should be STRING type');
      
      const emailColumn = schema.columns.find(col => col.name === 'email');
      assert.ok(emailColumn, 'Should have an email column');
      assert.strictEqual(emailColumn?.unifiedType, UnifiedColumnType.STRING, 'email column should be STRING type');
      
      const ageColumn = schema.columns.find(col => col.name === 'age');
      assert.ok(ageColumn, 'Should have an age column');
      assert.strictEqual(ageColumn?.unifiedType, UnifiedColumnType.INTEGER, 'age column should be INTEGER type');
      
      const salaryColumn = schema.columns.find(col => col.name === 'salary');
      assert.ok(salaryColumn, 'Should have a salary column');
      assert.strictEqual(salaryColumn?.unifiedType, UnifiedColumnType.DECIMAL, 'salary column should be DECIMAL type');
      
      const isActiveColumn = schema.columns.find(col => col.name === 'is_active');
      assert.ok(isActiveColumn, 'Should have an is_active column');
      assert.strictEqual(isActiveColumn?.unifiedType, UnifiedColumnType.BOOLEAN, 'is_active column should be BOOLEAN type');
      assert.strictEqual(isActiveColumn?.defaultValue, 'true', 'is_active column should have default value true');
      
      const createdAtColumn = schema.columns.find(col => col.name === 'created_at');
      assert.ok(createdAtColumn, 'Should have a created_at column');
      assert.strictEqual(createdAtColumn?.unifiedType, UnifiedColumnType.DATETIME, 'created_at column should be DATETIME type');
      
      const dataColumn = schema.columns.find(col => col.name === 'data');
      assert.ok(dataColumn, 'Should have a data column');
      assert.strictEqual(dataColumn?.unifiedType, UnifiedColumnType.JSON, 'data column should be JSON type');
      
      const tagsColumn = schema.columns.find(col => col.name === 'tags');
      assert.ok(tagsColumn, 'Should have a tags column');
      assert.strictEqual(tagsColumn?.unifiedType, UnifiedColumnType.ARRAY, 'tags column should be ARRAY type');
      
      const profilePictureColumn = schema.columns.find(col => col.name === 'profile_picture');
      assert.ok(profilePictureColumn, 'Should have a profile_picture column');
      assert.strictEqual(profilePictureColumn?.unifiedType, UnifiedColumnType.BINARY, 'profile_picture column should be BINARY type');
      
      assert.ok(Array.isArray(schema.constraints), 'Constraints should be an array');
      assert.ok(schema.constraints?.length > 0, 'Should have at least one constraint');

      assert.ok(Array.isArray(schema.uniqueKeys), 'Unique keys should be an array');
      assert.ok(schema.uniqueKeys?.length > 0, 'Should have at least one unique key');
      assert.strictEqual(schema.uniqueKeys?.[0], 'email', 'Unique key should be email');
      
      assert.ok(Array.isArray(schema.primaryKey), 'Primary key should be an array');
      assert.strictEqual(schema.primaryKey?.length, 1, 'Should have one primary key column');
      assert.strictEqual(schema.primaryKey?.[0], 'id', 'Primary key should be id');
      
      const emailCheckConstraint = schema.constraints?.find(
        constraint => constraint.type === 'CHECK' && constraint.content?.includes('email')
      );
      assert.ok(emailCheckConstraint, 'Should have an email check constraint');
      
      const ageCheckConstraint = schema.constraints?.find(
        constraint => constraint.type === 'CHECK' && constraint.content?.includes('age')
      );
      assert.ok(ageCheckConstraint, 'Should have an age check constraint');
    });

    it('should return the correct foreign key information', async () => {
      await adapter.connect(testConfig);
      const schema = await adapter.getTableSchema('test_schema_related_table');
      console.info('Schema:', JSON.stringify(schema, null, 2));

      assert.ok(Array.isArray(schema.foreignKeys), 'Foreign keys should be an array');
      assert.strictEqual(schema.foreignKeys?.length, 1, 'Should have one foreign key');
      
      const foreignKey = schema.foreignKeys?.[0];
      assert.ok(foreignKey, 'Should have a foreign key');
      assert.strictEqual(foreignKey.column, 'test_id', 'Foreign key column should be test_id');
      assert.strictEqual(foreignKey.foreignTable, 'test_schema_table', 'Foreign key table should be test_schema_table');
      assert.strictEqual(foreignKey.foreignColumn, 'id', 'Foreign key column should be id');
      assert.strictEqual(foreignKey.onDelete, 'CASCADE', 'Foreign key onDelete should be CASCADE');
    });

    it('should extract CHECK constraints', async () => {
      const schema = await adapter.getTableSchema('test_schema_table');
      
      const checkConstraints = schema.constraints?.filter(c => 
        c.type === 'CHECK' && 
        !c.content?.includes('IS NOT NULL')
      ) || [];
      assert.strictEqual(checkConstraints.length, 2);
      
      const emailConstraint = checkConstraints.find(
        constraint => constraint.type === 'CHECK' && constraint.content?.includes('email')
      );
      assert.ok(emailConstraint);
      
      const ageConstraint = checkConstraints.find(
        constraint => constraint.type === 'CHECK' && constraint.content?.includes('age')
      );
      assert.ok(ageConstraint);
    });
  });
});