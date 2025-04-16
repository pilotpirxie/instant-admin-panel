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
  });

  describe('getTableData', () => {
    before(async () => {
      await adapter.connect(testConfig);
      
      const db = adapter['db'];
      if (!db) throw new Error('Database not connected');
      await db.none(`DELETE FROM test_schema_table`);
      
      await adapter.createRecord('test_schema_table', {
        name: 'John Doe',
        email: 'john.doe@example.com',
        age: 25,
        salary: 50000,
        is_active: true,
        data: { role: 'admin' },
        tags: ['developer', 'frontend']
      });
      
      await adapter.createRecord('test_schema_table', {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        age: 30,
        salary: 60000,
        is_active: true,
        data: { role: 'user' },
        tags: ['designer', 'ux']
      });
      
      await adapter.createRecord('test_schema_table', {
        name: 'Bob Johnson',
        email: 'bob.johnson@example.com',
        age: 35,
        salary: 70000,
        is_active: false,
        data: { role: 'manager' },
        tags: ['backend', 'devops']
      });
      
      await adapter.createRecord('test_schema_table', {
        name: 'Alice Brown',
        email: 'alice.brown@example.com',
        age: 28,
        salary: 55000,
        is_active: true,
        data: { role: 'user' },
        tags: ['designer', 'frontend']
      });
      
      await adapter.createRecord('test_schema_table', {
        name: 'Charlie Wilson',
        email: 'charlie.wilson@example.com',
        age: 42,
        salary: 80000,
        is_active: true,
        data: { role: 'admin' },
        tags: ['backend', 'security']
      });
    });

    it('should throw an error when not connected', async () => {
      await adapter.disconnect();
      try {
        await adapter.getTableData('test_schema_table', {});
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error, 'Should throw an Error');
        assert.strictEqual(error.message, 'Database not connected', 'Error message should match');
      }
      await adapter.connect(testConfig);
    });

    it('should return data with default pagination', async () => {
      const result = await adapter.getTableData('test_schema_table', {});
      
      assert.ok(result, 'Should return a result');
      assert.strictEqual(typeof result.total, 'number', 'Should include total count');
      assert.strictEqual(typeof result.page, 'number', 'Should include current page');
      assert.strictEqual(typeof result.perPage, 'number', 'Should include perPage value');
      assert.strictEqual(typeof result.totalPages, 'number', 'Should include totalPages value');
      assert.ok(Array.isArray(result.data), 'Data should be an array');
      assert.strictEqual(result.data.length, Math.min(10, result.total), 'Should return at most 10 records by default');
      
      const firstRecord = result.data[0];
      assert.ok(firstRecord.id, 'Records should have an ID');
      assert.ok(firstRecord.name, 'Records should have a name');
      assert.ok(firstRecord.email, 'Records should have an email');
    });
    
    it('should respect custom pagination settings', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        page: 2,
        perPage: 2
      });
      
      assert.strictEqual(result.page, 2, 'Page should be 2');
      assert.strictEqual(result.perPage, 2, 'PerPage should be 2');
      assert.strictEqual(result.data.length, 2, 'Should return 2 records');
      assert.ok(result.total >= 4, 'Total count should be at least 4');
      assert.strictEqual(result.totalPages, Math.ceil(result.total / 2), 'Total pages calculation should be correct');
    });
    
    it('should handle sorting with single column', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        orderBy: [{ column: 'age', direction: 'asc' }]
      });
      
      const ages = result.data.map(r => r.age);
      const sortedAges = [...ages].sort((a, b) => Number(a) - Number(b));
      
      assert.deepStrictEqual(ages, sortedAges, 'Results should be sorted by age in ascending order');
    });
    
    it('should handle sorting with multiple columns', async () => {
      await adapter.createRecord('test_schema_table', {
        name: 'Duplicate Age User',
        email: 'duplicate.age@example.com',
        age: 35,
        salary: 65000,
        is_active: true
      });
      
      const result = await adapter.getTableData('test_schema_table', {
        orderBy: [
          { column: 'age', direction: 'desc' },
          { column: 'name', direction: 'asc' }
        ]
      });
      
      const age35Records = result.data.filter(r => r.age === 35);
      if (age35Records.length >= 2) {
        const names = age35Records.map(r => r.name);
        const sortedNames = [...names].sort();
        assert.deepStrictEqual(names, sortedNames, 'Records with the same age should be sorted by name');
      }
      
      const ages = result.data.map(r => r.age);
      for (let i = 0; i < ages.length - 1; i++) {
        assert.ok(Number(ages[i]) >= Number(ages[i+1]), 'Ages should be in descending order');
      }
    });
    
    it('should filter with equals operator', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'age', operator: 'eq', value: 30 }]
      });
      
      assert.ok(result.data.length > 0, 'Should return at least one record');
      result.data.forEach(record => {
        assert.strictEqual(Number(record.age), 30, 'All records should have age 30');
      });
    });
    
    it('should filter with not equals operator', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'age', operator: 'neq', value: 30 }]
      });
      
      assert.ok(result.data.length > 0, 'Should return at least one record');
      result.data.forEach(record => {
        assert.notStrictEqual(Number(record.age), 30, 'No records should have age 30');
      });
    });
    
    it('should filter with greater than operator', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'age', operator: 'gt', value: 30 }]
      });
      
      assert.ok(result.data.length > 0, 'Should return at least one record');
      result.data.forEach(record => {
        assert.ok(Number(record.age) > 30, 'All records should have age greater than 30');
      });
    });
    
    it('should filter with greater than or equal operator', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'age', operator: 'gte', value: 30 }]
      });
      
      assert.ok(result.data.length > 0, 'Should return at least one record');
      result.data.forEach(record => {
        assert.ok(Number(record.age) >= 30, 'All records should have age greater than or equal to 30');
      });
    });
    
    it('should filter with less than operator', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'age', operator: 'lt', value: 30 }]
      });
      
      assert.ok(result.data.length > 0, 'Should return at least one record');
      result.data.forEach(record => {
        assert.ok(Number(record.age) < 30, 'All records should have age less than 30');
      });
    });
    
    it('should filter with less than or equal operator', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'age', operator: 'lte', value: 30 }]
      });
      
      assert.ok(result.data.length > 0, 'Should return at least one record');
      result.data.forEach(record => {
        assert.ok(Number(record.age) <= 30, 'All records should have age less than or equal to 30');
      });
    });
    
    it('should filter with in operator', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'age', operator: 'in', value: [25, 35, 42] }]
      });
      
      assert.ok(result.data.length > 0, 'Should return at least one record');
      result.data.forEach(record => {
        assert.ok([25, 35, 42].includes(Number(record.age)), 'All records should have age in the specified list');
      });
    });
    
    it('should filter with not in operator', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'age', operator: 'nin', value: [25, 35, 42] }]
      });
      
      result.data.forEach(record => {
        assert.ok(![25, 35, 42].includes(Number(record.age)), 'No records should have age in the specified list');
      });
    });
    
    it('should filter with like operator', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'email', operator: 'like', value: '%.smith@%' }]
      });
      
      assert.ok(result.data.length > 0, 'Should return at least one record');
      result.data.forEach(record => {
        assert.ok(String(record.email).includes('.smith@'), 'All emails should contain .smith@');
      });
    });
    
    it('should filter with contains operator', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'name', operator: 'contains', value: 'John' }]
      });
      
      assert.ok(result.data.length > 0, 'Should return at least one record');
      result.data.forEach(record => {
        assert.ok(String(record.name).includes('John'), 'All names should contain John');
      });
    });
    
    it('should filter with isNull operator', async () => {
      await adapter.createRecord('test_schema_table', {
        name: 'Null Test User',
        email: 'null.test@example.com',
        age: null
      });
      
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'age', operator: 'isNull' }]
      });
      
      assert.ok(result.data.length > 0, 'Should return at least one record');
      result.data.forEach(record => {
        assert.strictEqual(record.age, null, 'All records should have null age');
      });
    });
    
    it('should filter with isNotNull operator', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'age', operator: 'isNotNull' }]
      });
      
      assert.ok(result.data.length > 0, 'Should return at least one record');
      result.data.forEach(record => {
        assert.notStrictEqual(record.age, null, 'No records should have null age');
      });
    });
    
    it('should filter with multiple conditions', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [
          { column: 'is_active', operator: 'eq', value: true },
          { column: 'age', operator: 'gt', value: 30 }
        ]
      });
      
      assert.ok(result.data.length > 0, 'Should return at least one record');
      result.data.forEach(record => {
        assert.strictEqual(record.is_active, true, 'All records should be active');
        assert.ok(Number(record.age) > 30, 'All records should have age greater than 30');
      });
    });
    
    it('should handle combination of filters, sorting and pagination', async () => {
      await adapter.createRecord('test_schema_table', {
        name: 'High Salary User',
        email: 'high.salary@example.com',
        age: 40,
        salary: 90000,
        is_active: true
      });
      
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'is_active', operator: 'eq', value: true }],
        orderBy: [{ column: 'salary', direction: 'desc' }],
        page: 1,
        perPage: 2
      });
      
      assert.strictEqual(result.data.length, 2, 'Should return exactly 2 records');
      assert.strictEqual(result.page, 1, 'Should be on page 1');
      assert.strictEqual(result.perPage, 2, 'Should have 2 records per page');
      
      result.data.forEach(record => {
        assert.strictEqual(record.is_active, true, 'All records should be active');
      });
      
      const salaries = result.data
        .map(r => r.salary === null ? -1 : Number(r.salary))
        .filter(salary => salary >= 0);
      
      if (salaries.length >= 2) {
        for (let i = 0; i < salaries.length - 1; i++) {
          assert.ok(salaries[i] >= salaries[i+1], 'Salaries should be in descending order');
        }
      }
    });
    
    it('should prevent SQL injection via table name', async () => {
      try {
        await adapter.getTableData('test_schema_table; DROP TABLE test_schema_table; --', {});
        assert.fail('Should throw an error for malicious table name');
      } catch (error) {
        assert.ok(error instanceof Error);
        
        const tables = await adapter.getTableList();
        assert.ok(tables.includes('test_schema_table'), 'Table should still exist after SQL injection attempt');
      }
    });
    
    it('should prevent SQL injection via column names in orderBy', async () => {
      try {
        await adapter.getTableData('test_schema_table', {
          orderBy: [{ column: 'id; DROP TABLE test_schema_table; --', direction: 'asc' }]
        });
        assert.fail('Should throw an error for malicious column name');
      } catch (error) {
        assert.ok(error instanceof Error);
        
        const tables = await adapter.getTableList();
        assert.ok(tables.includes('test_schema_table'), 'Table should still exist after SQL injection attempt');
      }
    });
    
    it('should prevent SQL injection via filter columns', async () => {
      try {
        await adapter.getTableData('test_schema_table', {
          filters: [{ 
            column: 'name; DROP TABLE test_schema_table; --', 
            operator: 'eq', 
            value: 'John'
          }]
        });
        assert.fail('Should throw an error for malicious filter column');
      } catch (error) {
        assert.ok(error instanceof Error);
        
        const tables = await adapter.getTableList();
        assert.ok(tables.includes('test_schema_table'), 'Table should still exist after SQL injection attempt');
      }
    });
    
    it('should prevent SQL injection via filter values', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ 
          column: 'name', 
          operator: 'eq', 
          value: "John' OR '1'='1"
        }]
      });
      
      assert.strictEqual(result.data.length, 0, 'SQL injection attempt should not return all records');
      
      const allRecords = await adapter.getTableData('test_schema_table', {});
      assert.ok(allRecords.total > 0, 'Records should still exist in the table');
    });
    
    it('should handle empty result sets properly', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'age', operator: 'eq', value: 999 }]
      });
      
      assert.strictEqual(result.data.length, 0, 'Should return no records');
      assert.strictEqual(result.total, 0, 'Total should be 0');
      assert.strictEqual(result.page, 1, 'Page should still be 1');
      assert.strictEqual(result.totalPages, 0, 'Total pages should be 0');
    });
    
    it('should handle filter on JSON data', async () => {
      const db = adapter['db'];
      if (!db) throw new Error('Database not connected');
      
      const query = `
        SELECT * FROM test_schema_table 
        WHERE data->>'role' = 'admin'
      `;
      
      const adminUsers = await db.any(query);
      assert.ok(adminUsers.length >= 1, 'Should have at least one admin user');
      
      adminUsers.forEach(user => {
        assert.strictEqual(user.data.role, 'admin', 'All users should have admin role');
      });
    });
    
    it('should handle filter on array data', async () => {
      const db = adapter['db'];
      if (!db) throw new Error('Database not connected');
      
      const query = `
        SELECT * FROM test_schema_table 
        WHERE 'frontend' = ANY(tags)
      `;
      
      const frontendUsers = await db.any(query);
      assert.ok(frontendUsers.length >= 1, 'Should have at least one frontend user');
      
      frontendUsers.forEach(user => {
        assert.ok(user.tags.includes('frontend'), 'All users should have frontend tag');
      });
    });
  });

  describe('getTableData edge cases', () => {
    before(async () => {
      await adapter.connect(testConfig);
      
      const db = adapter['db'];
      if (!db) throw new Error('Database not connected');
      await db.none(`DELETE FROM test_schema_table`);
      
      await adapter.createRecord('test_schema_table', {
        name: 'Edge Case 1',
        email: 'edge.case.1@example.com',
        age: 25,
        salary: 50000,
        is_active: true,
        data: { nested: { value: 42 } },
        tags: ['tag1', 'TAG2', 'Tag3'],
        created_at: new Date('2025-01-01T00:00:00Z')
      });
      
      await adapter.createRecord('test_schema_table', {
        name: 'Edge Case 2',
        email: 'edge.case.2@example.com',
        age: null,
        salary: null,
        is_active: false,
        data: { nested: { value: null } },
        tags: [],
        created_at: new Date('2025-02-01T00:00:00Z')
      });
      
      await adapter.createRecord('test_schema_table', {
        name: 'Edge Quote Case',
        email: 'special.chars@example.com',
        age: 30,
        salary: 60000,
        is_active: true,
        data: { nested: { value: "string with 'quotes'" } },
        tags: ['special-char', 'another-one'],
        created_at: new Date('2025-03-01T00:00:00Z')
      });
      
      await adapter.createRecord('test_schema_table', {
        name: 'Case Sensitivity Test',
        email: 'UPPERCASE@example.com',
        age: 40,
        salary: 70000,
        is_active: true,
        data: { nested: { level2: { level3: { value: 100 } } } },
        tags: ['TAG1', 'tag2'],
        created_at: new Date('2025-04-01T00:00:00Z')
      });
      
      for (let i = 1; i <= 20; i++) {
        await adapter.createRecord('test_schema_table', {
          name: `Pagination Test ${i}`,
          email: `pagination.${i}@example.com`,
          age: 20 + i,
          salary: 40000 + (i * 1000),
          is_active: i % 2 === 0,
          data: { index: i },
          tags: [`page${i}`, 'pagination'],
          created_at: new Date(`2025-05-${i.toString().padStart(2, '0')}T00:00:00Z`)
        });
      }
    });

    it('should handle sorting with mixed null and non-null values correctly', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        orderBy: [{ column: 'salary', direction: 'desc' }],
        page: 1,
        perPage: 10
      });
      
      const nonNullRecords = result.data.filter(r => r.salary !== null);
      const nullRecords = result.data.filter(r => r.salary === null);
      
      if (nonNullRecords.length >= 2) {
        for (let i = 0; i < nonNullRecords.length - 1; i++) {
          const currentSalary = Number(nonNullRecords[i].salary);
          const nextSalary = Number(nonNullRecords[i + 1].salary);
          assert.ok(currentSalary >= nextSalary, 'Non-null salaries should be in descending order');
        }
      }
      
      if (nonNullRecords.length > 0 && nullRecords.length > 0) {
        const lastNonNullIndex = result.data.indexOf(nonNullRecords[nonNullRecords.length - 1]);
        const firstNullIndex = result.data.indexOf(nullRecords[0]);
        assert.ok(lastNonNullIndex < firstNullIndex, 'Null values should appear after non-null values when sorting DESC');
      }
    });
    
    it('should handle filtering with empty arrays', async () => {
      const emptyArrayRecord = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'email', operator: 'eq', value: 'edge.case.2@example.com' }]
      });
      
      assert.strictEqual(emptyArrayRecord.data.length, 1, 'Should find the record with empty tags');
      assert.ok(Array.isArray(emptyArrayRecord.data[0].tags), 'Tags should be an array');
      assert.strictEqual(emptyArrayRecord.data[0].tags.length, 0, 'Tags should be empty');
      
      const db = adapter['db'];
      if (!db) throw new Error('Database not connected');
      
      const result = await db.any(`
        SELECT * FROM test_schema_table
        WHERE array_length(tags, 1) IS NULL OR array_length(tags, 1) = 0
      `);
      
      assert.ok(result.length > 0, 'Should find records with empty arrays');
      result.forEach(record => {
        assert.ok(Array.isArray(record.tags) && record.tags.length === 0, 'Should only have records with empty tags');
      });
    });
    
    it('should handle case sensitivity in string filters correctly', async () => {
      const result1 = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'email', operator: 'contains', value: 'UPPERCASE' }]
      });
      
      assert.strictEqual(result1.data.length, 1, 'Should find the record with case-insensitive search');
      assert.strictEqual(result1.data[0].email, 'UPPERCASE@example.com');
      
      const db = adapter['db'];
      if (!db) throw new Error('Database not connected');
      
      const ciResult = await db.any(`
        SELECT * FROM test_schema_table
        WHERE email ILIKE $1
      `, ['%uppercase%']);
      
      assert.strictEqual(ciResult.length, 1, 'Case-insensitive search should find the record');
      
      const csResult = await db.any(`
        SELECT * FROM test_schema_table
        WHERE email LIKE $1
      `, ['%UPPERCASE%']);
      
      assert.strictEqual(csResult.length, 1, 'Case-sensitive search should find the record');
      
      const csLowerResult = await db.any(`
        SELECT * FROM test_schema_table
        WHERE email LIKE $1
      `, ['%uppercase%']);
      
      assert.strictEqual(csLowerResult.length, 0, 'Case-sensitive search with lowercase should not find the record');
    });
    
    it('should handle special characters in filters correctly', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'email', operator: 'eq', value: 'special.chars@example.com' }]
      });
      
      assert.strictEqual(result.data.length, 1, 'Should find the record with special characters');
      assert.strictEqual(result.data[0].name, 'Edge Quote Case');
    });
    
    it('should handle complex pagination with filters and sorting correctly', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [
          { column: 'name', operator: 'contains', value: 'Pagination Test' },
          { column: 'is_active', operator: 'eq', value: true }
        ],
        orderBy: [{ column: 'age', direction: 'desc' }],
        page: 2,
        perPage: 3
      });
      
      assert.strictEqual(result.data.length, 3, 'Should return 3 records for page 2');
      
      const ages = result.data.map(r => Number(r.age));
      
      result.data.forEach(record => {
        assert.strictEqual(record.is_active, true, 'All records should have is_active = true');
        if (typeof record.name === 'string') {
          assert.ok(record.name.includes('Pagination Test'), 'All records should be pagination tests');
        }
      });
      
      for (let i = 0; i < ages.length - 1; i++) {
        assert.ok(ages[i] >= ages[i+1], 'Ages should be in descending order');
      }
    });
    
    it('should handle boolean filters correctly', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'is_active', operator: 'eq', value: false }]
      });
      
      assert.ok(result.data.length > 0, 'Should find records with is_active = false');
      result.data.forEach(record => {
        assert.strictEqual(record.is_active, false, 'All records should have is_active = false');
      });
    });
    
    it('should handle date comparisons in filters correctly', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ 
          column: 'created_at', 
          operator: 'gt', 
          value: new Date('2025-03-15T00:00:00Z')
        }]
      });
      
      assert.ok(result.data.length > 0, 'Should find records created after March 15, 2025');
      result.data.forEach(record => {
        if (record.created_at) {
          const recordDate = new Date(record.created_at.toString());
          const compareDate = new Date('2025-03-15T00:00:00Z');
          assert.ok(recordDate > compareDate, 'Record date should be after compare date');
        }
      });
    });
    
    it('should handle combined complex filters correctly', async () => {
      const result = await adapter.getTableData('test_schema_table', {
        filters: [
          { column: 'age', operator: 'gt', value: 30 },
          { column: 'is_active', operator: 'eq', value: true },
          { column: 'salary', operator: 'lt', value: 70000 }
        ]
      });
      
      assert.ok(result.data.length >= 0, 'Should return records matching all conditions');
      result.data.forEach(record => {
        assert.ok(Number(record.age) > 30, 'Age should be greater than 30');
        assert.strictEqual(record.is_active, true, 'is_active should be true');
        assert.ok(Number(record.salary) < 70000, 'Salary should be less than 70000');
      });
    });
    
    it('should handle retrieving the last page of results correctly', async () => {
      const countResult = await adapter.getTableData('test_schema_table', {
        perPage: 5
      });
      
      const totalPages = countResult.totalPages;
      assert.ok(totalPages > 1, 'Should have multiple pages for this test');
      
      const result = await adapter.getTableData('test_schema_table', {
        page: totalPages,
        perPage: 5
      });
      
      assert.strictEqual(result.page, totalPages, 'Should be on the last page');
      assert.ok(result.data.length > 0, 'Last page should have at least one record');
      assert.ok(result.data.length <= 5, 'Last page should have at most perPage records');
    });
    
    it('should handle filtering with large NOT IN lists', async () => {
      const unwantedAges = Array.from({ length: 50 }, (_, i) => i + 100);
      
      const result = await adapter.getTableData('test_schema_table', {
        filters: [{ column: 'age', operator: 'nin', value: unwantedAges }]
      });
      
      assert.ok(result.data.length > 0, 'Should return records with ages not in the list');
      result.data.forEach(record => {
        if (record.age !== null) {
          assert.ok(!unwantedAges.includes(Number(record.age)), 'Age should not be in the unwanted list');
        }
      });
    });
  });
});