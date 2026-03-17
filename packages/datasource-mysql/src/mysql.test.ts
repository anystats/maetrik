import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataSourceError, type DataSourceConfig } from '@maetrik/shared';

const {
  mockRelease,
  mockConnExecute,
  mockPoolExecute,
  mockGetConnection,
  mockEnd,
  mockBeginTransaction,
  mockCommit,
  mockRollback,
  mockCreatePool,
} = vi.hoisted(() => {
  const mockRelease = vi.fn();
  const mockConnExecute = vi.fn().mockResolvedValue([[], []]);
  const mockPoolExecute = vi.fn().mockResolvedValue([[], []]);
  const mockGetConnection = vi.fn().mockResolvedValue({
    execute: mockConnExecute,
    release: mockRelease,
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
  });
  const mockEnd = vi.fn().mockResolvedValue(undefined);
  const mockBeginTransaction = vi.fn().mockResolvedValue(undefined);
  const mockCommit = vi.fn().mockResolvedValue(undefined);
  const mockRollback = vi.fn().mockResolvedValue(undefined);
  const mockCreatePool = vi.fn().mockReturnValue({
    getConnection: mockGetConnection,
    end: mockEnd,
    execute: mockPoolExecute,
  });
  return {
    mockRelease,
    mockConnExecute,
    mockPoolExecute,
    mockGetConnection,
    mockEnd,
    mockBeginTransaction,
    mockCommit,
    mockRollback,
    mockCreatePool,
  };
});

vi.mock('mysql2/promise', () => ({
  default: { createPool: mockCreatePool },
}));

import { dataSourceFactory } from './index.js';
import { MysqlDataSource } from './driver.js';

const config: DataSourceConfig = {
  id: 'test-mysql',
  type: 'mysql',
  credentials: {
    host: 'localhost',
    port: 3306,
    database: 'test',
    user: 'user',
    password: 'pass',
  },
};

describe('MysqlDataSource', () => {
  describe('dataSourceFactory', () => {
    it('has correct type', () => {
      expect(dataSourceFactory.type).toBe('mysql');
    });

    it('has display name', () => {
      expect(dataSourceFactory.displayName).toBe('MySQL');
    });

    it('has JSON Schema for credentials', () => {
      expect(dataSourceFactory.credentialsSchema).toBeDefined();
      expect(dataSourceFactory.credentialsSchema.type).toBe('object');
      expect(dataSourceFactory.credentialsSchema.required).toContain('host');
      expect(dataSourceFactory.credentialsSchema.required).toContain('database');
    });

    it('creates a driver instance', () => {
      const driver = dataSourceFactory.create();
      expect(driver).toBeInstanceOf(MysqlDataSource);
    });
  });

  describe('MysqlDataSource', () => {
    let driver: MysqlDataSource;

    beforeEach(() => {
      vi.clearAllMocks();
      const mockConn = {
        execute: mockConnExecute,
        release: mockRelease,
        beginTransaction: mockBeginTransaction,
        commit: mockCommit,
        rollback: mockRollback,
      };
      mockGetConnection.mockResolvedValue(mockConn);
      mockPoolExecute.mockResolvedValue([[], []]);
      mockConnExecute.mockResolvedValue([[], []]);
      driver = new MysqlDataSource();
    });

    it('has correct type', () => {
      expect(driver.type).toBe('mysql');
    });

    it('has sql query language', () => {
      expect(driver.queryLanguage).toBe('sql');
    });

    it('type guards return correct values', () => {
      expect(driver.isQueryable()).toBe(true);
      expect(driver.isIntrospectable()).toBe(true);
      expect(driver.isHealthCheckable()).toBe(true);
      expect(driver.isTransactional()).toBe(true);
    });

    it('initializes with config', async () => {
      await driver.init(config);
      expect(driver.name).toBe('test-mysql');
    });
  });

  describe('pool config passthrough', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      const mockConn = {
        execute: mockConnExecute,
        release: mockRelease,
        beginTransaction: mockBeginTransaction,
        commit: mockCommit,
        rollback: mockRollback,
      };
      mockGetConnection.mockResolvedValue(mockConn);
    });

    it('passes pool options from connection config to createPool', async () => {
      const driver = new MysqlDataSource();
      await driver.init({
        ...config,
        connection: {
          maxConnections: 20,
          idleTimeoutMs: 60000,
          timeoutMs: 10000,
        },
      });

      expect(mockCreatePool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionLimit: 20,
          idleTimeout: 60000,
          connectTimeout: 10000,
        }),
      );
    });

    it('uses defaults when connection options not provided', async () => {
      const driver = new MysqlDataSource();
      await driver.init(config);

      expect(mockCreatePool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionLimit: 10,
          idleTimeout: 30000,
          connectTimeout: 5000,
        }),
      );
    });
  });

  describe('init error handling', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('cleans up pool when connection fails', async () => {
      mockGetConnection.mockRejectedValue({ code: 'ECONNREFUSED', message: 'refused' });
      const driver = new MysqlDataSource();

      await expect(driver.init(config)).rejects.toThrow(DataSourceError);
      expect(mockEnd).toHaveBeenCalled();
    });

    it('throws CONNECTION_FAILED for missing host', async () => {
      const driver = new MysqlDataSource();
      const badConfig = { ...config, credentials: { database: 'test' } };

      try {
        await driver.init(badConfig);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(DataSourceError);
        expect((err as DataSourceError).code).toBe('CONNECTION_FAILED');
      }
    });

    it('throws CONNECTION_FAILED for missing database', async () => {
      const driver = new MysqlDataSource();
      const badConfig = { ...config, credentials: { host: 'localhost' } };

      try {
        await driver.init(badConfig);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(DataSourceError);
        expect((err as DataSourceError).code).toBe('CONNECTION_FAILED');
      }
    });
  });

  describe('execute', () => {
    let driver: MysqlDataSource;

    beforeEach(async () => {
      vi.clearAllMocks();
      const mockConn = {
        execute: mockConnExecute,
        release: mockRelease,
        beginTransaction: mockBeginTransaction,
        commit: mockCommit,
        rollback: mockRollback,
      };
      mockGetConnection.mockResolvedValue(mockConn);
      driver = new MysqlDataSource();
      await driver.init(config);
    });

    it('maps mysql result to QueryResult', async () => {
      mockPoolExecute.mockResolvedValue([
        [{ id: 1, name: 'Alice' }],
        [
          { name: 'id', type: 3 },
          { name: 'name', type: 253 },
        ],
      ]);

      const result = await driver.execute('SELECT * FROM users');

      expect(result.rows).toEqual([{ id: 1, name: 'Alice' }]);
      expect(result.rowCount).toBe(1);
      expect(result.fields).toEqual([
        { name: 'id', dataTypeID: 3 },
        { name: 'name', dataTypeID: 253 },
      ]);
    });

    it('handles empty result', async () => {
      mockPoolExecute.mockResolvedValue([[], []]);

      const result = await driver.execute('SELECT 1');
      expect(result.rowCount).toBe(0);
    });

    it('throws NOT_INITIALIZED when pool is null', async () => {
      const uninitDriver = new MysqlDataSource();

      try {
        await uninitDriver.execute('SELECT 1');
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(DataSourceError);
        expect((err as DataSourceError).code).toBe('NOT_INITIALIZED');
      }
    });
  });

  describe('transaction lifecycle', () => {
    let driver: MysqlDataSource;

    beforeEach(async () => {
      vi.clearAllMocks();
      const mockConn = {
        execute: mockConnExecute,
        release: mockRelease,
        beginTransaction: mockBeginTransaction,
        commit: mockCommit,
        rollback: mockRollback,
      };
      mockGetConnection.mockResolvedValue(mockConn);
      driver = new MysqlDataSource();
      await driver.init(config);
    });

    it('commit releases connection back to pool', async () => {
      const tx = await driver.beginTransaction();
      await tx.commit();

      expect(mockRelease).toHaveBeenCalled();
    });

    it('rollback releases connection back to pool', async () => {
      const tx = await driver.beginTransaction();
      await tx.rollback();

      expect(mockRelease).toHaveBeenCalled();
    });

    it('releases connection even when commit fails', async () => {
      const tx = await driver.beginTransaction();
      mockCommit.mockRejectedValueOnce({ code: 'PROTOCOL_CONNECTION_LOST', message: 'connection lost' });

      await expect(tx.commit()).rejects.toThrow();
      expect(mockRelease).toHaveBeenCalled();
    });

    it('releases connection even when rollback fails', async () => {
      const tx = await driver.beginTransaction();
      mockRollback.mockRejectedValueOnce({ code: 'PROTOCOL_CONNECTION_LOST', message: 'connection lost' });

      await expect(tx.rollback()).rejects.toThrow();
      expect(mockRelease).toHaveBeenCalled();
    });

    it('calls beginTransaction on the dedicated connection', async () => {
      await driver.beginTransaction();

      expect(mockBeginTransaction).toHaveBeenCalled();
    });

    it('transaction execute uses dedicated connection, not pool', async () => {
      mockConnExecute.mockResolvedValue([
        [{ id: 1 }],
        [{ name: 'id', type: 3 }],
      ]);

      const tx = await driver.beginTransaction();
      await tx.execute('INSERT INTO t VALUES (?)', [1]);

      expect(mockConnExecute).toHaveBeenCalledWith('INSERT INTO t VALUES (?)', [1]);
      expect(mockPoolExecute).not.toHaveBeenCalledWith('INSERT INTO t VALUES (?)', [1]);
    });
  });

  describe('wrapError mapping', () => {
    let driver: MysqlDataSource;

    beforeEach(async () => {
      vi.clearAllMocks();
      const mockConn = {
        execute: mockConnExecute,
        release: mockRelease,
        beginTransaction: mockBeginTransaction,
        commit: mockCommit,
        rollback: mockRollback,
      };
      mockGetConnection.mockResolvedValue(mockConn);
      driver = new MysqlDataSource();
      await driver.init(config);
    });

    const errorCases = [
      { mysqlCode: 'ECONNREFUSED', expectedCode: 'CONNECTION_FAILED', retryable: true },
      { mysqlCode: 'ENOTFOUND', expectedCode: 'CONNECTION_FAILED', retryable: true },
      { mysqlCode: 'ETIMEDOUT', expectedCode: 'CONNECTION_FAILED', retryable: true },
      { mysqlCode: 'ER_ACCESS_DENIED_ERROR', expectedCode: 'AUTHENTICATION_FAILED', retryable: false },
      { mysqlCode: 'ER_PARSE_ERROR', expectedCode: 'QUERY_SYNTAX', retryable: false },
      { mysqlCode: 'ER_SYNTAX_ERROR', expectedCode: 'QUERY_SYNTAX', retryable: false },
      { mysqlCode: 'ER_NO_SUCH_TABLE', expectedCode: 'QUERY_SYNTAX', retryable: false },
      { mysqlCode: 'ER_BAD_FIELD_ERROR', expectedCode: 'QUERY_SYNTAX', retryable: false },
      { mysqlCode: 'ER_DUP_ENTRY', expectedCode: 'QUERY_EXECUTION', retryable: false },
      { mysqlCode: 'ER_NO_REFERENCED_ROW_2', expectedCode: 'QUERY_EXECUTION', retryable: false },
      { mysqlCode: 'ER_ROW_IS_REFERENCED_2', expectedCode: 'QUERY_EXECUTION', retryable: false },
      { mysqlCode: 'ER_QUERY_TIMEOUT', expectedCode: 'TIMEOUT', retryable: true },
      { mysqlCode: 'PROTOCOL_CONNECTION_LOST', expectedCode: 'CONNECTION_FAILED', retryable: true },
      { mysqlCode: 'ECONNRESET', expectedCode: 'CONNECTION_FAILED', retryable: true },
      { mysqlCode: 'ER_SERVER_SHUTDOWN', expectedCode: 'CONNECTION_FAILED', retryable: true },
      { mysqlCode: 'UNKNOWN', expectedCode: 'DRIVER_ERROR', retryable: false },
    ];

    for (const { mysqlCode, expectedCode, retryable } of errorCases) {
      it(`maps MySQL code ${mysqlCode} to ${expectedCode} (retryable: ${retryable})`, async () => {
        mockPoolExecute.mockRejectedValueOnce({ code: mysqlCode, message: 'test error' });

        try {
          await driver.execute('SELECT 1');
          expect.unreachable();
        } catch (err) {
          expect(err).toBeInstanceOf(DataSourceError);
          const dsErr = err as DataSourceError;
          expect(dsErr.code).toBe(expectedCode);
          expect(dsErr.retryable).toBe(retryable);
          expect(dsErr.driverCode).toBe(mysqlCode);
        }
      });
    }

    it('passes through existing DataSourceError without re-wrapping', async () => {
      const original = new DataSourceError({
        code: 'TIMEOUT',
        message: 'already wrapped',
        retryable: true,
      });
      mockPoolExecute.mockRejectedValueOnce(original);

      try {
        await driver.execute('SELECT 1');
        expect.unreachable();
      } catch (err) {
        expect(err).toBe(original);
      }
    });
  });

  describe('shutdown', () => {
    it('does not throw when called before init', async () => {
      const driver = new MysqlDataSource();
      await expect(driver.shutdown()).resolves.not.toThrow();
    });

    it('calls pool.end()', async () => {
      vi.clearAllMocks();
      const mockConn = {
        execute: mockConnExecute,
        release: mockRelease,
        beginTransaction: mockBeginTransaction,
        commit: mockCommit,
        rollback: mockRollback,
      };
      mockGetConnection.mockResolvedValue(mockConn);
      const driver = new MysqlDataSource();
      await driver.init(config);
      await driver.shutdown();

      expect(mockEnd).toHaveBeenCalled();
    });
  });
});
