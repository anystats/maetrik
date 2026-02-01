import { describe, it, expect, beforeEach } from 'vitest';
import { createDataSourceRegistry } from './registry.js';
import type { DataSourceRegistry } from './types.js';
import type { DataSourceFactory, DataSourceDriver, QueryLanguage, Queryable, Introspectable, HealthCheckable } from '@maetrik/shared';
import type { JSONSchema7 } from 'json-schema';

// Mock driver that implements Queryable, Introspectable, and HealthCheckable
class MockDriver implements DataSourceDriver, Queryable, Introspectable, HealthCheckable {
  readonly name = 'mock';
  readonly type = 'mock';
  readonly queryLanguage: QueryLanguage = 'sql';

  async init() {}
  async shutdown() {}

  isQueryable(): this is DataSourceDriver & Queryable { return true; }
  isIntrospectable(): this is DataSourceDriver & Introspectable { return true; }
  isHealthCheckable(): this is DataSourceDriver & HealthCheckable { return true; }
  isTransactional(): this is DataSourceDriver & import('@maetrik/shared').Transactional { return false; }

  async execute() { return { rows: [], rowCount: 0, fields: [] }; }
  async introspect() { return { tables: [] }; }
  async healthCheck() { return true; }
}

const mockCredentialsSchema: JSONSchema7 = {
  type: 'object',
  required: ['host'],
  properties: {
    host: { type: 'string' },
  },
};

const mockFactory: DataSourceFactory = {
  type: 'mock',
  displayName: 'Mock Database',
  credentialsSchema: mockCredentialsSchema,
  create: () => new MockDriver(),
};

describe('DataSourceRegistry', () => {
  let registry: DataSourceRegistry;

  beforeEach(() => {
    registry = createDataSourceRegistry();
  });

  describe('register', () => {
    it('registers a factory', () => {
      registry.register(mockFactory);
      expect(registry.has('mock')).toBe(true);
    });

    it('throws if factory with same type already registered', () => {
      registry.register(mockFactory);
      expect(() => registry.register(mockFactory)).toThrow();
    });

    it('derives capabilities from driver implementation', () => {
      registry.register(mockFactory);
      const resolved = registry.get('mock');
      expect(resolved?.capabilities).toEqual({
        queryable: true,
        introspectable: true,
        healthCheckable: true,
        transactional: false,
      });
    });
  });

  describe('get', () => {
    it('returns registered factory', () => {
      registry.register(mockFactory);
      const factory = registry.get('mock');
      expect(factory?.type).toBe('mock');
      expect(factory?.displayName).toBe('Mock Database');
    });

    it('returns undefined for unregistered type', () => {
      const factory = registry.get('unknown');
      expect(factory).toBeUndefined();
    });
  });

  describe('list', () => {
    it('returns all registered factories', () => {
      const anotherFactory: DataSourceFactory = {
        ...mockFactory,
        type: 'another',
        displayName: 'Another DB',
      };
      registry.register(mockFactory);
      registry.register(anotherFactory);

      const factories = registry.list();
      expect(factories).toHaveLength(2);
      expect(factories.map((f) => f.type)).toContain('mock');
      expect(factories.map((f) => f.type)).toContain('another');
    });

    it('returns empty array when no factories registered', () => {
      expect(registry.list()).toEqual([]);
    });
  });

  describe('has', () => {
    it('returns true for registered type', () => {
      registry.register(mockFactory);
      expect(registry.has('mock')).toBe(true);
    });

    it('returns false for unregistered type', () => {
      expect(registry.has('unknown')).toBe(false);
    });
  });
});
