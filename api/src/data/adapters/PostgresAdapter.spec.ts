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

  describe('createRecord', () => {
    before(async () => {
      await adapter.connect(testConfig);
    });

    it('should throw an error when not connected', async () => {
      await adapter.disconnect();
      try {
        await adapter.createRecord('test_schema_table', { name: 'Test User' });
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an Error');
        assert.strictEqual(error.message, 'Database not connected', 'Error message should match');
      }
    });

    it('should throw an error when record is empty', async () => {
      await adapter.connect(testConfig);
      try {
        await adapter.createRecord('test_schema_table', {});
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an Error');
        assert.strictEqual(error.message, 'Failed to create record: Record cannot be empty', 'Error message should match');
      }
    });

    it('should create a record successfully', async () => {
      await adapter.connect(testConfig);
      
      const testRecord = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        age: 30,
        salary: 50000.50,
        is_active: true,
        data: { preferences: { theme: 'dark' } }
      };
      
      type TestRecordWithId = typeof testRecord & {
        id: number;
        created_at: Date | string;
      };
      
      const result = await adapter.createRecord<typeof testRecord>('test_schema_table', testRecord);
      
      const typedResult = result as TestRecordWithId;
      
      assert.ok(result, 'Should return the created record');
      assert.strictEqual(result.name, testRecord.name, 'Name should match');
      assert.strictEqual(result.email, testRecord.email, 'Email should match');
      assert.strictEqual(result.age, testRecord.age, 'Age should match');
      assert.strictEqual(Number(result.salary), testRecord.salary, 'Salary should match');
      assert.strictEqual(result.is_active, testRecord.is_active, 'Is_active should match');
      assert.deepStrictEqual(result.data, testRecord.data, 'Data should match');
      assert.ok(typedResult.id, 'Should have an ID assigned');
      assert.ok(typedResult.created_at, 'Should have created_at timestamp');
    });

    it('should filter out undefined values', async () => {
      await adapter.connect(testConfig);
      
      const testRecord = {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        age: undefined,
        salary: 65000.75,
        is_active: undefined
      };
      
      type TestRecordWithId = Omit<typeof testRecord, 'age' | 'is_active'> & {
        id: number;
        age: number | null;
        is_active: boolean;
        created_at: Date | string;
        updated_at: Date | string | null;
      };
      
      const result = await adapter.createRecord<typeof testRecord>('test_schema_table', testRecord);
      
      const typedResult = result as unknown as TestRecordWithId;
      
      assert.ok(result, 'Should return the created record');
      assert.ok(typedResult.id, 'Should have an ID assigned');
      assert.ok(typedResult.created_at, 'Created_at should have timestamp');
      assert.strictEqual(typedResult.updated_at, null, 'Updated_at should be null');
      assert.strictEqual(result.name, testRecord.name, 'Name should match');
      assert.strictEqual(result.email, testRecord.email, 'Email should match');
      assert.strictEqual(Number(result.salary), testRecord.salary, 'Salary should match');
      
      assert.strictEqual(typedResult.age, null, 'Age should be null');
      assert.strictEqual(typedResult.is_active, true, 'Is_active should be default value (true)');
    });

    it('should handle array data types correctly', async () => {
      await adapter.connect(testConfig);
      
      const testRecord = {
        name: 'Array Test User',
        email: 'array.test@example.com',
        tags: ['tag1', 'tag2', 'tag3']
      };
      
      const result = await adapter.createRecord<typeof testRecord>('test_schema_table', testRecord);
      
      assert.ok(result, 'Should return the created record');
      assert.ok(Array.isArray(result.tags), 'Tags should be an array');
      assert.deepStrictEqual(result.tags, testRecord.tags, 'Tags array should match');
    });

    it('should throw an error when trying to violate constraints', async () => {
      await adapter.connect(testConfig);
      
      const record1 = await adapter.createRecord('test_schema_table', {
        name: 'Unique Test',
        email: 'unique.test@example.com'
      });;
      
      assert.ok(record1, 'First record should be created successfully');
      
      try {
        await adapter.createRecord('test_schema_table', {
          name: 'Duplicate Email',
          email: 'unique.test@example.com'
        });
        assert.fail('Should have thrown a unique constraint error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('Failed to create record'), 'Error message should indicate creation failure');
        assert.ok(
          error.message.includes('unique') || 
          error.message.includes('duplicate') || 
          error.message.includes('violates'),
          'Error should mention constraint violation'
        );
      }
    });

    it('should respect check constraints', async () => {
      await adapter.connect(testConfig);
      
      try {
        await adapter.createRecord('test_schema_table', {
          name: 'Negative Age',
          email: 'negative.age@example.com',
          age: -5
        });
        assert.fail('Should have thrown a check constraint error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('Failed to create record'), 'Error message should indicate creation failure');
        assert.ok(
          error.message.includes('check constraint') || 
          error.message.includes('violates') ||
          error.message.includes('check'),
          'Error should mention check constraint violation'
        );
      }
    });

    it('should create a record with null values explicitly set', async () => {
      await adapter.connect(testConfig);
      
      const testRecord = {
        name: 'Null Fields Test',
        email: 'null.test@example.com',
        age: null,
        salary: null,
        data: null,
        tags: null
      };
      
      type TestRecordWithId = typeof testRecord & {
        id: number;
        is_active: boolean;
      };
      
      const result = await adapter.createRecord<typeof testRecord>('test_schema_table', testRecord);
      const typedResult = result as unknown as TestRecordWithId;
      
      assert.ok(typedResult.id, 'Should have an ID assigned');
      assert.strictEqual(result.name, testRecord.name, 'Name should match');
      assert.strictEqual(result.email, testRecord.email, 'Email should match');
      assert.strictEqual(result.age, null, 'Age should be null');
      assert.strictEqual(result.salary, null, 'Salary should be null');
      assert.strictEqual(result.data, null, 'Data should be null');
      assert.strictEqual(result.tags, null, 'Tags should be null');
      assert.strictEqual(typedResult.is_active, true, 'is_active should have default value');
    });

    it('should create a record with a numeric string that converts to a number', async () => {
      await adapter.connect(testConfig);
      const testRecord = {
        name: 'Numeric String Test',
        email: 'numeric.string@example.com',
        salary: '75000.25',
        age: '42'
      };
      
      type TestRecordWithId = Omit<typeof testRecord, 'salary' | 'age'> & {
        id: number;
        salary: string | number;
        age: string | number;
      };
      
      const result = await adapter.createRecord<typeof testRecord>('test_schema_table', testRecord);
      const typedResult = result as unknown as TestRecordWithId;
      
      assert.ok(typedResult.id, 'Should have an ID assigned');
      assert.strictEqual(result.name, testRecord.name, 'Name should match');
      assert.strictEqual(result.email, testRecord.email, 'Email should match');
      assert.ok(typeof typedResult.salary === 'string' || typeof typedResult.salary === 'number', 
        'Salary should be stored as string or number');
      assert.strictEqual(Number(typedResult.salary), 75000.25, 'Salary converted to number should match');
      assert.ok(typeof typedResult.age === 'string' || typeof typedResult.age === 'number', 
        'Age should be stored as string or number');
      assert.strictEqual(Number(typedResult.age), 42, 'Age converted to number should match');
    });

    it('should create a record with a complex JSON object', async () => {
      await adapter.connect(testConfig);
      const testRecord = {
        name: 'Complex JSON Test',
        email: 'json.complex@example.com',
        data: {
          address: {
            street: '123 Main St',
            city: 'Tech City',
            zipCode: 12345,
            coordinates: [40.7128, -74.0060]
          },
          preferences: {
            notifications: {
              email: true,
              push: false,
              sms: true
            },
            theme: 'dark',
            fontSize: 14,
            features: ['dashboard', 'reports', 'analytics']
          },
          metadata: {
            lastLogin: '2025-04-16T12:00:00Z',
            deviceInfo: {
              browser: 'Chrome',
              version: '112.0.5615.121',
              platform: 'MacOS'
            }
          }
        }
      };
      
      type TestRecordWithId = typeof testRecord & {
        id: number;
      };
      
      const result = await adapter.createRecord<typeof testRecord>('test_schema_table', testRecord);
      const typedResult = result as unknown as TestRecordWithId;
      
      assert.ok(typedResult.id, 'Should have an ID assigned');
      assert.strictEqual(result.name, testRecord.name, 'Name should match');
      assert.strictEqual(result.email, testRecord.email, 'Email should match');
      assert.deepStrictEqual(result.data, testRecord.data, 'Complex JSON data should match');
      assert.strictEqual(result.data.address.street, '123 Main St', 'Nested street property should match');
      assert.strictEqual(result.data.preferences.notifications.email, true, 'Deeply nested boolean should match');
      assert.strictEqual(result.data.preferences.features.length, 3, 'Array in JSON should have correct length');
      assert.strictEqual(result.data.metadata.deviceInfo.browser, 'Chrome', 'Deeply nested string should match');
    });

    it('should create a record with an array containing mixed data types', async () => {
      await adapter.connect(testConfig);
      const testRecord = {
        name: 'Mixed Array Test',
        email: 'mixed.array@example.com',
        data: {
          mixedArray: [
            'string value',
            42,
            true,
            { nestedObject: 'value' },
            ['nested', 'array']
          ]
        }
      };
      
      type TestRecordWithId = typeof testRecord & {
        id: number;
      };
      
      const result = await adapter.createRecord<typeof testRecord>('test_schema_table', testRecord);
      const typedResult = result as unknown as TestRecordWithId;
      
      assert.ok(typedResult.id, 'Should have an ID assigned');
      assert.strictEqual(result.name, testRecord.name, 'Name should match');
      assert.strictEqual(result.email, testRecord.email, 'Email should match');
      assert.ok(Array.isArray(result.data.mixedArray), 'Should store array in JSON');
      assert.strictEqual(result.data.mixedArray.length, 5, 'Array should have correct length');
      assert.strictEqual(result.data.mixedArray[0], 'string value', 'String element should match');
      assert.strictEqual(result.data.mixedArray[1], 42, 'Number element should match');
      assert.strictEqual(result.data.mixedArray[2], true, 'Boolean element should match');
      assert.deepStrictEqual(result.data.mixedArray[3], { nestedObject: 'value' }, 'Object element should match');
      assert.deepStrictEqual(result.data.mixedArray[4], ['nested', 'array'], 'Nested array should match');
    });

    it('should create a record with minimal required fields', async () => {
      await adapter.connect(testConfig);
      const testRecord = {
        name: 'Minimal Fields Test'
      };
      
      type TestRecordWithId = typeof testRecord & {
        id: number;
        email: string | null;
        age: number | null;
        salary: number | null;
        is_active: boolean;
        created_at: Date | string;
        updated_at: Date | string | null;
        data: Record<string, any> | null;
        tags: string[] | null;
        profile_picture: Buffer | null;
      };
      
      const result = await adapter.createRecord<typeof testRecord>('test_schema_table', testRecord);
      const typedResult = result as unknown as TestRecordWithId;
      
      assert.ok(typedResult.id, 'Should have an ID assigned');
      assert.strictEqual(result.name, testRecord.name, 'Name should match');
      assert.strictEqual(typedResult.email, null, 'Email should be null');
      assert.strictEqual(typedResult.age, null, 'Age should be null');
      assert.strictEqual(typedResult.salary, null, 'Salary should be null');
      assert.strictEqual(typedResult.is_active, true, 'is_active should have default value');
      assert.ok(typedResult.created_at, 'created_at should have timestamp');
      assert.strictEqual(typedResult.updated_at, null, 'updated_at should be null');
      assert.strictEqual(typedResult.data, null, 'data should be null');
      assert.strictEqual(typedResult.tags, null, 'tags should be null');
      assert.strictEqual(typedResult.profile_picture, null, 'profile_picture should be null');
    });
  });

  describe('deleteRecord', () => {
    before(async () => {
      await adapter.connect(testConfig);
    });

    it('should throw an error when not connected', async () => {
      await adapter.disconnect();
      try {
        await adapter.deleteRecord('test_schema_table', { id: 1 });
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an Error');
        assert.strictEqual(error.message, 'Database not connected', 'Error message should match');
      }
    });

    it('should throw an error when where condition is empty', async () => {
      await adapter.connect(testConfig);
      try {
        await adapter.deleteRecord('test_schema_table', {});
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an Error');
        assert.strictEqual(error.message, 'Failed to delete record: Where conditions cannot be empty', 'Error message should match');
      }
    });

    it('should return false when no record matches the where condition', async () => {
      await adapter.connect(testConfig);
      const result = await adapter.deleteRecord('test_schema_table', { id: 9999999 });
      assert.strictEqual(result, false, 'Should return false when no record is deleted');
    });

    it('should successfully delete a record and return true', async () => {
      await adapter.connect(testConfig);
      
      const testRecord = {
        name: 'Delete Test User',
        email: 'delete.test@example.com',
        age: 25
      };
      
      type RecordWithId = typeof testRecord & { id: number };
      const createdRecord = await adapter.createRecord('test_schema_table', testRecord) as RecordWithId;
      
      assert.ok(createdRecord.id, 'Record should have been created with an ID');
      
      const deleteResult = await adapter.deleteRecord('test_schema_table', { id: createdRecord.id });
      assert.strictEqual(deleteResult, true, 'Should return true when record is deleted');
      
      const db = adapter['db'];
      if (!db) throw new Error('Database not connected');
      
      const verifyQuery = `
        SELECT * FROM test_schema_table WHERE id = $1
      `;
      const result = await db.oneOrNone(verifyQuery, [createdRecord.id]);
      assert.strictEqual(result, null, 'Record should no longer exist in the database');
    });

    it('should delete a record using a non-primary key field', async () => {
      await adapter.connect(testConfig);
      
      const uniqueEmail = `delete.by.email.${Date.now()}@example.com`;
      const testRecord = {
        name: 'Delete By Email Test',
        email: uniqueEmail,
        age: 30
      };
      
      type RecordWithId = typeof testRecord & { id: number };
      const createdRecord = await adapter.createRecord('test_schema_table', testRecord) as RecordWithId;
      
      assert.ok(createdRecord.id, 'Record should have been created with an ID');
      
      const deleteResult = await adapter.deleteRecord('test_schema_table', { email: uniqueEmail });
      assert.strictEqual(deleteResult, true, 'Should return true when record is deleted by email');
      
      const db = adapter['db'];
      if (!db) throw new Error('Database not connected');
      
      const verifyQuery = `
        SELECT * FROM test_schema_table WHERE email = $1
      `;
      const result = await db.oneOrNone(verifyQuery, [uniqueEmail]);
      assert.strictEqual(result, null, 'Record should no longer exist in the database');
    });

    it('should delete records that match multiple conditions', async () => {
      await adapter.connect(testConfig);
      
      const baseName = 'Multiple Conditions Test';
      const email1 = `multi.condition.1.${Date.now()}@example.com`;
      const email2 = `multi.condition.2.${Date.now()}@example.com`;
      
      await adapter.createRecord('test_schema_table', {
        name: baseName,
        email: email1,
        age: 35
      });
      
      await adapter.createRecord('test_schema_table', {
        name: baseName,
        email: email2,
        age: 40
      });
      
      const deleteResult = await adapter.deleteRecord('test_schema_table', { 
        name: baseName,
        age: 35
      });
      
      assert.strictEqual(deleteResult, true, 'Should return true when record is deleted');
      
      const db = adapter['db'];
      if (!db) throw new Error('Database not connected');
      
      const verifyQuery1 = `
        SELECT * FROM test_schema_table WHERE name = $1 AND email = $2
      `;
      const result1 = await db.oneOrNone(verifyQuery1, [baseName, email1]);
      assert.strictEqual(result1, null, 'First record should no longer exist');
      
      const verifyQuery2 = `
        SELECT * FROM test_schema_table WHERE name = $1 AND email = $2
      `;
      const result2 = await db.oneOrNone(verifyQuery2, [baseName, email2]);
      assert.ok(result2, 'Second record should still exist');
      assert.strictEqual(result2.age, 40, 'Second record should have the correct age');
    });

    it('should handle null values in where conditions correctly', async () => {
      await adapter.connect(testConfig);
      
      const testRecord = {
        name: 'Null Field Test',
        email: `null.field.${Date.now()}@example.com`,
        age: null
      };
      
      type RecordWithId = typeof testRecord & { id: number };
      const createdRecord = await adapter.createRecord('test_schema_table', testRecord) as RecordWithId;
      
      assert.ok(createdRecord.id, 'Record should have been created with an ID');
      assert.strictEqual(createdRecord.age, null, 'Age should be null');
      
      const deleteResult = await adapter.deleteRecord('test_schema_table', { 
        id: createdRecord.id,
        age: null 
      });
      
      assert.strictEqual(deleteResult, true, 'Should return true when record with null field is deleted');
    });

    it('should handle complex data types in where conditions', async () => {
      await adapter.connect(testConfig);
      
      const testData = { key: 'value', nested: { flag: true } };
      const testRecord = {
        name: 'Complex Data Test',
        email: `complex.data.${Date.now()}@example.com`,
        data: testData
      };
      
      type RecordWithId = typeof testRecord & { id: number };
      const createdRecord = await adapter.createRecord('test_schema_table', testRecord) as RecordWithId;
      
      assert.ok(createdRecord.id, 'Record should have been created with an ID');
      
      const deleteResult = await adapter.deleteRecord('test_schema_table', { id: createdRecord.id });
      assert.strictEqual(deleteResult, true, 'Should return true when record with complex data is deleted');
    });

    it('should delete a record even if a referenced record exists (ON DELETE CASCADE)', async () => {
      await adapter.connect(testConfig);
      
      const parentRecord = {
        name: 'Cascade Delete Parent',
        email: `cascade.parent.${Date.now()}@example.com`
      };
      
      type RecordWithId = typeof parentRecord & { id: number };
      const createdParent = await adapter.createRecord('test_schema_table', parentRecord) as RecordWithId;
      
      assert.ok(createdParent.id, 'Parent record should have been created with an ID');
      
      const db = adapter['db'];
      if (!db) throw new Error('Database not connected');
      
      await db.none(`
        INSERT INTO test_schema_related_table (test_id, description)
        VALUES ($1, $2)
      `, [createdParent.id, 'Related record for cascade test']);
      
      const checkChildQuery = `
        SELECT * FROM test_schema_related_table WHERE test_id = $1
      `;
      const childBefore = await db.oneOrNone(checkChildQuery, [createdParent.id]);
      assert.ok(childBefore, 'Child record should exist before parent deletion');
      
      const deleteResult = await adapter.deleteRecord('test_schema_table', { id: createdParent.id });
      assert.strictEqual(deleteResult, true, 'Should return true when parent record is deleted');
      
      const childAfter = await db.oneOrNone(checkChildQuery, [createdParent.id]);
      assert.strictEqual(childAfter, null, 'Child record should be deleted due to CASCADE constraint');
    });
  });

  describe('SQL Injection Prevention', () => {
    before(async () => {
      await adapter.connect(testConfig);
    });

    it('should prevent SQL injection in createRecord through field names', async () => {
      try {
        await adapter.createRecord('test_schema_table', {
          'name": (SELECT 1); --': 'SQL Injection Test'
        });
        assert.fail('Should have thrown an error for invalid column name');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(
          error.message.includes('Failed to create record'),
          'Error message should indicate creation failure'
        );
      }
    });

    it('should prevent SQL injection in createRecord through values', async () => {
      const maliciousValue = "malicious.user+DELETE-FROM-test_schema_table@example.com";
      
      const result = await adapter.createRecord('test_schema_table', {
        name: 'Safe Record',
        email: maliciousValue
      });
      
      assert.ok(result);
      assert.strictEqual(result.email, maliciousValue, 'Malicious string should be stored as-is without executing');
      
      const db = adapter['db'];
      if (!db) throw new Error('Database not connected');
      
      const count = await db.one('SELECT COUNT(*) FROM test_schema_table');
      assert.ok(Number(count.count) > 0, 'Table should still contain records');
    });

    it('should prevent SQL injection in createRecord with JSON data containing malicious content', async () => {
      const maliciousJson = { 
        attack: "'); DROP TABLE test_schema_table; --",
        nested: { 
          malicious: "SELECT pg_sleep(1)--" 
        }
      };
      
      const result = await adapter.createRecord('test_schema_table', {
        name: 'JSON Injection Test',
        email: 'json.injection@test.com',
        data: maliciousJson
      });
      
      assert.ok(result);
      assert.deepStrictEqual(result.data, maliciousJson, 'Malicious JSON should be stored as-is without executing');
    });

    it('should prevent SQL injection in deleteRecord through field names', async () => {
      try {
        await adapter.deleteRecord('test_schema_table', {
          'id=1; DELETE FROM test_schema_table; --': 1
        });
        assert.fail('Should have thrown an error for invalid column name');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(
          error.message.includes('Failed to delete record'),
          'Error message should indicate deletion failure'
        );
      }
    });

    it('should prevent SQL injection in deleteRecord through values', async () => {
      await adapter.createRecord('test_schema_table', {
        name: 'Safe Delete Test',
        email: 'safe.delete@test.com'
      });
      
      try {
        await adapter.deleteRecord('test_schema_table', {
          id: "1; DELETE FROM test_schema_table; --"
        });

        assert.fail('Should have thrown an error for invalid value');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(
          error.message.includes('Failed to delete record'),
          'Error message should indicate deletion failure'
        );
      }
      
      const db = adapter['db'];
      if (!db) throw new Error('Database not connected');
      
      const checkRecord = await db.oneOrNone('SELECT * FROM test_schema_table WHERE email = $1', ['safe.delete@test.com']);
      assert.ok(checkRecord, 'Safe record should still exist after attempted injection');
    });

    it('should prevent SQL injection through table name in createRecord', async () => {
      try {
        await adapter.createRecord('test_schema_table; DROP TABLE test_schema_table; --', {
          name: 'Table Name Injection'
        });
        assert.fail('Should have thrown an error for invalid table name');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
      
      const tables = await adapter.getTableList();
      assert.ok(tables.includes('test_schema_table'), 'Table should still exist after attempted injection');
    });

    it('should prevent SQL injection through table name in deleteRecord', async () => {
      try {
        await adapter.deleteRecord('test_schema_table; DROP TABLE test_schema_table; --', {
          id: 1
        });
        assert.fail('Should have thrown an error for invalid table name');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
      
      const tables = await adapter.getTableList();
      assert.ok(tables.includes('test_schema_table'), 'Table should still exist after attempted injection');
    });

    it('should prevent UNION-based SQL injection attacks', async () => {
      const unionAttack = "union.attack+SELECT-username-password-FROM-users@example.com";
      
      const result = await adapter.createRecord('test_schema_table', {
        name: 'UNION Attack Test',
        email: unionAttack
      });
      
      assert.ok(result);
      assert.strictEqual(result.email, unionAttack, 'UNION attack string should be stored as-is without executing');
    });
  });
});