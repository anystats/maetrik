import { describe, it, expect } from 'vitest';
import { BaseDataSourceDriver } from './base-driver.js';
import type {
  DataSourceCapabilities,
  DataSourceConfig,
  Queryable,
  Introspectable,
  HealthCheckable,
  Transactional,
  DataSourceQueryResult as QueryResult,
  DataSourceSchemaDefinition as SchemaDefinition,
  Transaction,
} from '@maetrik/shared';

class TestQueryableDriver extends BaseDataSourceDriver implements Queryable {
  readonly name = 'test';
  readonly type = 'test';

  async init(_config: DataSourceConfig): Promise<void> {}
  async shutdown(): Promise<void> {}

  capabilities(): DataSourceCapabilities {
    return {
      queryable: true,
      introspectable: false,
      healthCheckable: false,
      transactional: false,
    };
  }

  async execute(_sql: string, _params?: unknown[]): Promise<QueryResult> {
    return { rows: [], rowCount: 0, fields: [] };
  }
}

class TestFullDriver extends BaseDataSourceDriver
  implements Queryable, Introspectable, HealthCheckable, Transactional {
  readonly name = 'full';
  readonly type = 'full';

  async init(_config: DataSourceConfig): Promise<void> {}
  async shutdown(): Promise<void> {}

  capabilities(): DataSourceCapabilities {
    return {
      queryable: true,
      introspectable: true,
      healthCheckable: true,
      transactional: true,
    };
  }

  async execute(_sql: string, _params?: unknown[]): Promise<QueryResult> {
    return { rows: [], rowCount: 0, fields: [] };
  }

  async introspect(): Promise<SchemaDefinition> {
    return { tables: [] };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async beginTransaction(): Promise<Transaction> {
    return {
      execute: async () => ({ rows: [], rowCount: 0, fields: [] }),
      commit: async () => {},
      rollback: async () => {},
    };
  }
}

describe('BaseDataSourceDriver', () => {
  describe('type guards', () => {
    it('isQueryable returns true for queryable driver', () => {
      const driver = new TestQueryableDriver();
      expect(driver.isQueryable()).toBe(true);
    });

    it('isIntrospectable returns false for non-introspectable driver', () => {
      const driver = new TestQueryableDriver();
      expect(driver.isIntrospectable()).toBe(false);
    });

    it('all type guards return true for full driver', () => {
      const driver = new TestFullDriver();
      expect(driver.isQueryable()).toBe(true);
      expect(driver.isIntrospectable()).toBe(true);
      expect(driver.isHealthCheckable()).toBe(true);
      expect(driver.isTransactional()).toBe(true);
    });

    it('type guard narrows type for TypeScript', () => {
      const driver = new TestFullDriver();
      if (driver.isQueryable()) {
        // TypeScript should recognize execute() method
        expect(typeof driver.execute).toBe('function');
      }
    });
  });
});
