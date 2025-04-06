import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { PostgresAdapter } from './PostgresAdapter';
import { DatabaseConfig } from '../ConfigInterface';

describe('PostgresAdapter', () => {
  let adapter: PostgresAdapter;
  let testConfig: DatabaseConfig;

  before(() => {
    adapter = new PostgresAdapter();
    testConfig = {
      dialect: 'postgresql',
      connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '35432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'mysecretpassword',
        database: process.env.DB_NAME || 'postgres',
        schema: process.env.DB_SCHEMA || 'public',
        ssl: false,
        poolSize: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      }
    };
  });

  after(async () => {
    await adapter.disconnect();
  });

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
    });
  });
}); 