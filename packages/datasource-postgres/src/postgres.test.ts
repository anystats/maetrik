import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dataSourceFactory, PostgresDataSource } from './index.js';
import type { DataSourceConfig } from '@maetrik/shared';

vi.mock('pg', () => ({
  default: {
    Client: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1, fields: [] }),
    })),
  },
}));

describe('PostgresDataSource', () => {
  describe('dataSourceFactory', () => {
    it('has correct type', () => {
      expect(dataSourceFactory.type).toBe('postgres');
    });

    it('has display name', () => {
      expect(dataSourceFactory.displayName).toBe('PostgreSQL');
    });

    it('has capabilities', () => {
      expect(dataSourceFactory.capabilities).toEqual({
        queryable: true,
        introspectable: true,
        healthCheckable: true,
        transactional: true,
      });
    });

    it('has credentials schema', () => {
      expect(dataSourceFactory.credentialsSchema).toBeDefined();
    });

    it('creates a driver instance', () => {
      const driver = dataSourceFactory.create();
      expect(driver).toBeInstanceOf(PostgresDataSource);
    });
  });

  describe('PostgresDataSource', () => {
    let driver: PostgresDataSource;
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

    beforeEach(() => {
      vi.clearAllMocks();
      driver = new PostgresDataSource();
    });

    it('has correct type', () => {
      expect(driver.type).toBe('postgres');
    });

    it('reports all capabilities', () => {
      expect(driver.capabilities()).toEqual({
        queryable: true,
        introspectable: true,
        healthCheckable: true,
        transactional: true,
      });
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
});
