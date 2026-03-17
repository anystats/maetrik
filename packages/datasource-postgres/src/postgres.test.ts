import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataSourceError, type DataSourceConfig } from '@maetrik/shared';

const {
  mockRelease,
  mockClientQuery,
  mockPoolQuery,
  mockConnect,
  mockEnd,
  MockPool,
} = vi.hoisted(() => {
  const mockRelease = vi.fn();
  const mockClientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, fields: [] });
  const mockPoolQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0, fields: [] });
  const mockConnect = vi.fn().mockResolvedValue({ query: mockClientQuery, release: mockRelease });
  const mockEnd = vi.fn().mockResolvedValue(undefined);
  const MockPool = vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    end: mockEnd,
    query: mockPoolQuery,
  }));
  return { mockRelease, mockClientQuery, mockPoolQuery, mockConnect, mockEnd, MockPool };
});

vi.mock('pg', () => ({
  default: { Pool: MockPool },
}));

import { dataSourceFactory } from './index.js';
import { PostgresDataSource } from './driver.js';

const config: DataSourceConfig = {
  id: 'test-pg',
  type: 'postgres',
  credentials: {
    host: 'localhost',
    port: 5432,
    database: 'test',
    user: 'user',
    password: 'pass',
  },
};

describe('PostgresDataSource', () => {
  describe('dataSourceFactory', () => {
    it('has correct type', () => {
      expect(dataSourceFactory.type).toBe('postgres');
    });

    it('has display name', () => {
      expect(dataSourceFactory.displayName).toBe('PostgreSQL');
    });

    it('has JSON Schema for credentials', () => {
      expect(dataSourceFactory.credentialsSchema).toBeDefined();
      expect(dataSourceFactory.credentialsSchema.type).toBe('object');
      expect(dataSourceFactory.credentialsSchema.required).toContain('host');
      expect(dataSourceFactory.credentialsSchema.required).toContain('database');
    });

    it('creates a driver instance', () => {
      const driver = dataSourceFactory.create();
      expect(driver).toBeInstanceOf(PostgresDataSource);
    });
  });

  describe('PostgresDataSource', () => {
    let driver: PostgresDataSource;

    beforeEach(() => {
      vi.clearAllMocks();
      mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockRelease });
      mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0, fields: [] });
      mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0, fields: [] });
      driver = new PostgresDataSource();
    });

    it('has correct type', () => {
      expect(driver.type).toBe('postgres');
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
      expect(driver.name).toBe('test-pg');
    });
  });

  describe('pool config passthrough', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockRelease });
    });

    it('passes pool options from connection config to Pool constructor', async () => {
      const driver = new PostgresDataSource();
      await driver.init({
        ...config,
        connection: {
          maxConnections: 20,
          idleTimeoutMs: 60000,
          timeoutMs: 10000,
        },
      });

      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 20,
          idleTimeoutMillis: 60000,
          connectionTimeoutMillis: 10000,
        }),
      );
    });

    it('uses defaults when connection options not provided', async () => {
      const driver = new PostgresDataSource();
      await driver.init(config);

      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        }),
      );
    });
  });

  describe('init error handling', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('cleans up pool when connection fails', async () => {
      mockConnect.mockRejectedValue({ code: 'ECONNREFUSED', message: 'refused' });
      const driver = new PostgresDataSource();

      await expect(driver.init(config)).rejects.toThrow(DataSourceError);
      expect(mockEnd).toHaveBeenCalled();
    });

    it('throws CONNECTION_FAILED for missing host', async () => {
      const driver = new PostgresDataSource();
      const badConfig = { ...config, credentials: { database: 'test' } };

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
    let driver: PostgresDataSource;

    beforeEach(async () => {
      vi.clearAllMocks();
      mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockRelease });
      driver = new PostgresDataSource();
      await driver.init(config);
    });

    it('maps pg result to QueryResult', async () => {
      mockPoolQuery.mockResolvedValue({
        rows: [{ id: 1, name: 'Alice' }],
        rowCount: 1,
        fields: [
          { name: 'id', dataTypeID: 23 },
          { name: 'name', dataTypeID: 25 },
        ],
      });

      const result = await driver.execute('SELECT * FROM users');

      expect(result.rows).toEqual([{ id: 1, name: 'Alice' }]);
      expect(result.rowCount).toBe(1);
      expect(result.fields).toEqual([
        { name: 'id', dataTypeID: 23 },
        { name: 'name', dataTypeID: 25 },
      ]);
    });

    it('handles null rowCount', async () => {
      mockPoolQuery.mockResolvedValue({ rows: [], rowCount: null, fields: [] });

      const result = await driver.execute('SELECT 1');
      expect(result.rowCount).toBe(0);
    });

    it('throws NOT_INITIALIZED when pool is null', async () => {
      const uninitDriver = new PostgresDataSource();

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
    let driver: PostgresDataSource;

    beforeEach(async () => {
      vi.clearAllMocks();
      mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockRelease });
      driver = new PostgresDataSource();
      await driver.init(config);
    });

    it('commit releases client back to pool', async () => {
      const tx = await driver.beginTransaction();
      await tx.commit();

      expect(mockRelease).toHaveBeenCalled();
    });

    it('rollback releases client back to pool', async () => {
      const tx = await driver.beginTransaction();
      await tx.rollback();

      expect(mockRelease).toHaveBeenCalled();
    });

    it('releases client even when commit query fails', async () => {
      const tx = await driver.beginTransaction();
      mockClientQuery.mockRejectedValueOnce({ code: '08003', message: 'connection lost' });

      await expect(tx.commit()).rejects.toThrow();
      expect(mockRelease).toHaveBeenCalled();
    });

    it('releases client even when rollback query fails', async () => {
      const tx = await driver.beginTransaction();
      mockClientQuery.mockRejectedValueOnce({ code: '08003', message: 'connection lost' });

      await expect(tx.rollback()).rejects.toThrow();
      expect(mockRelease).toHaveBeenCalled();
    });

    it('sends BEGIN on the dedicated client', async () => {
      await driver.beginTransaction();

      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
    });

    it('transaction execute uses dedicated client, not pool', async () => {
      mockClientQuery.mockResolvedValue({
        rows: [{ id: 1 }],
        rowCount: 1,
        fields: [{ name: 'id', dataTypeID: 23 }],
      });

      const tx = await driver.beginTransaction();
      await tx.execute('INSERT INTO t VALUES ($1)', [1]);

      expect(mockClientQuery).toHaveBeenCalledWith('INSERT INTO t VALUES ($1)', [1]);
      expect(mockPoolQuery).not.toHaveBeenCalledWith('INSERT INTO t VALUES ($1)', [1]);
    });
  });

  describe('wrapError mapping', () => {
    let driver: PostgresDataSource;

    beforeEach(async () => {
      vi.clearAllMocks();
      mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockRelease });
      driver = new PostgresDataSource();
      await driver.init(config);
    });

    const errorCases = [
      { pgCode: 'ECONNREFUSED', expectedCode: 'CONNECTION_FAILED', retryable: true },
      { pgCode: 'ENOTFOUND', expectedCode: 'CONNECTION_FAILED', retryable: true },
      { pgCode: 'ETIMEDOUT', expectedCode: 'CONNECTION_FAILED', retryable: true },
      { pgCode: '28P01', expectedCode: 'AUTHENTICATION_FAILED', retryable: false },
      { pgCode: '28000', expectedCode: 'AUTHENTICATION_FAILED', retryable: false },
      { pgCode: '42601', expectedCode: 'QUERY_SYNTAX', retryable: false },
      { pgCode: '42P01', expectedCode: 'QUERY_SYNTAX', retryable: false },
      { pgCode: '23505', expectedCode: 'QUERY_EXECUTION', retryable: false },
      { pgCode: '23503', expectedCode: 'QUERY_EXECUTION', retryable: false },
      { pgCode: '57014', expectedCode: 'TIMEOUT', retryable: true },
      { pgCode: '08000', expectedCode: 'CONNECTION_FAILED', retryable: true },
      { pgCode: '08003', expectedCode: 'CONNECTION_FAILED', retryable: true },
      { pgCode: '08006', expectedCode: 'CONNECTION_FAILED', retryable: true },
      { pgCode: 'UNKNOWN', expectedCode: 'DRIVER_ERROR', retryable: false },
    ];

    for (const { pgCode, expectedCode, retryable } of errorCases) {
      it(`maps PG code ${pgCode} to ${expectedCode} (retryable: ${retryable})`, async () => {
        mockPoolQuery.mockRejectedValueOnce({ code: pgCode, message: 'test error' });

        try {
          await driver.execute('SELECT 1');
          expect.unreachable();
        } catch (err) {
          expect(err).toBeInstanceOf(DataSourceError);
          const dsErr = err as DataSourceError;
          expect(dsErr.code).toBe(expectedCode);
          expect(dsErr.retryable).toBe(retryable);
          expect(dsErr.driverCode).toBe(pgCode);
        }
      });
    }

    it('passes through existing DataSourceError without re-wrapping', async () => {
      const original = new DataSourceError({
        code: 'TIMEOUT',
        message: 'already wrapped',
        retryable: true,
      });
      mockPoolQuery.mockRejectedValueOnce(original);

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
      const driver = new PostgresDataSource();
      await expect(driver.shutdown()).resolves.not.toThrow();
    });

    it('calls pool.end()', async () => {
      vi.clearAllMocks();
      mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockRelease });
      const driver = new PostgresDataSource();
      await driver.init(config);
      await driver.shutdown();

      expect(mockEnd).toHaveBeenCalled();
    });
  });
});
