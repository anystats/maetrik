import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDataSourceManager } from './manager.js';
import { createDataSourceRegistry } from './registry.js';
import type { DataSourceManager, DataSourceRegistry } from './types.js';
import type { DataSourceFactory, DataSourceDriver, DataSourceConfig } from '@maetrik/shared';
import { z } from 'zod';

const createMockDriver = (): DataSourceDriver => ({
  name: 'test-instance',
  type: 'mock',
  init: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
  capabilities: () => ({
    queryable: true,
    introspectable: false,
    healthCheckable: true,
    transactional: false,
  }),
  isQueryable: () => true,
  isIntrospectable: () => false,
  isHealthCheckable: () => true,
  isTransactional: () => false,
});

const mockFactory: DataSourceFactory = {
  type: 'mock',
  displayName: 'Mock Database',
  capabilities: {
    queryable: true,
    introspectable: false,
    healthCheckable: true,
    transactional: false,
  },
  credentialsSchema: z.object({ host: z.string() }),
  create: vi.fn().mockImplementation(createMockDriver),
};

const testConfig: DataSourceConfig = {
  id: 'test-id-123',
  type: 'mock',
  credentials: { host: 'localhost' },
};

describe('DataSourceManager', () => {
  let registry: DataSourceRegistry;
  let manager: DataSourceManager;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createDataSourceRegistry();
    registry.register(mockFactory);
    manager = createDataSourceManager({ registry });
  });

  describe('config management', () => {
    it('addConfig adds a configuration', () => {
      manager.addConfig(testConfig);
      expect(manager.getConfig('test-id-123')).toEqual(testConfig);
    });

    it('removeConfig removes a configuration', () => {
      manager.addConfig(testConfig);
      manager.removeConfig('test-id-123');
      expect(manager.getConfig('test-id-123')).toBeUndefined();
    });

    it('listConfigs returns all configurations', () => {
      manager.addConfig(testConfig);
      manager.addConfig({ ...testConfig, id: 'second-id' });
      expect(manager.listConfigs()).toHaveLength(2);
    });
  });

  describe('lazy instantiation', () => {
    it('does not create driver until get() is called', async () => {
      manager.addConfig(testConfig);
      expect(mockFactory.create).not.toHaveBeenCalled();
    });

    it('creates and initializes driver on first get()', async () => {
      manager.addConfig(testConfig);
      const driver = await manager.get('test-id-123');

      expect(mockFactory.create).toHaveBeenCalledTimes(1);
      expect(driver).toBeDefined();
      expect(driver!.init).toHaveBeenCalledWith(testConfig);
    });

    it('returns same instance on subsequent get() calls', async () => {
      manager.addConfig(testConfig);
      const driver1 = await manager.get('test-id-123');
      const driver2 = await manager.get('test-id-123');

      expect(driver1).toBe(driver2);
      expect(mockFactory.create).toHaveBeenCalledTimes(1);
    });

    it('returns undefined for unknown id', async () => {
      const driver = await manager.get('unknown-id');
      expect(driver).toBeUndefined();
    });

    it('returns undefined for unknown driver type', async () => {
      manager.addConfig({ ...testConfig, type: 'unknown-type' });
      const driver = await manager.get('test-id-123');
      expect(driver).toBeUndefined();
    });
  });

  describe('shutdown', () => {
    it('shuts down all instantiated drivers', async () => {
      manager.addConfig(testConfig);
      manager.addConfig({ ...testConfig, id: 'second-id' });

      const driver1 = await manager.get('test-id-123');
      const driver2 = await manager.get('second-id');

      await manager.shutdown();

      expect(driver1!.shutdown).toHaveBeenCalled();
      expect(driver2!.shutdown).toHaveBeenCalled();
    });

    it('does not fail if no drivers instantiated', async () => {
      await expect(manager.shutdown()).resolves.not.toThrow();
    });
  });
});
