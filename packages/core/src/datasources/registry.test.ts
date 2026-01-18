import { describe, it, expect, beforeEach } from 'vitest';
import { createDataSourceRegistry } from './registry.js';
import type { DataSourceRegistry } from './types.js';
import type { DataSourceFactory, DataSourceDriver } from '@maetrik/shared';
import { z } from 'zod';

const mockFactory: DataSourceFactory = {
  type: 'mock',
  displayName: 'Mock Database',
  capabilities: {
    queryable: true,
    introspectable: true,
    healthCheckable: true,
    transactional: false,
  },
  credentialsSchema: z.object({ host: z.string() }),
  create: () => ({} as DataSourceDriver),
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
  });

  describe('get', () => {
    it('returns registered factory', () => {
      registry.register(mockFactory);
      const factory = registry.get('mock');
      expect(factory).toBe(mockFactory);
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
