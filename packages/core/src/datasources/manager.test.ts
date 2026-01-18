import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDataSourceManager } from './manager.js';
import { createDataSourceRegistry } from './registry.js';
import { CompositeConnectionConfigResolver } from '../connections/resolver.js';
import { FileConnectionConfigSource } from '../connections/sources/file.js';
import { ConnectionNotFoundError, DriverNotFoundError } from '../connections/errors.js';
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
  isQueryable: (() => true) as DataSourceDriver['isQueryable'],
  isIntrospectable: (() => false) as DataSourceDriver['isIntrospectable'],
  isHealthCheckable: (() => true) as DataSourceDriver['isHealthCheckable'],
  isTransactional: (() => false) as DataSourceDriver['isTransactional'],
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

const testConfigs: DataSourceConfig[] = [
  { id: 'test-id-123', type: 'mock', credentials: { host: 'localhost' } },
  { id: 'second-id', type: 'mock', credentials: { host: 'remote' } },
];

describe('DataSourceManager', () => {
  let registry: DataSourceRegistry;
  let manager: DataSourceManager;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createDataSourceRegistry();
    registry.register(mockFactory);

    const fileSource = new FileConnectionConfigSource(testConfigs);
    const resolver = new CompositeConnectionConfigResolver([fileSource]);

    manager = createDataSourceManager({ registry, resolver });
  });

  describe('config access', () => {
    it('getConfig returns config by id', async () => {
      const config = await manager.getConfig('test-id-123');
      expect(config).toEqual(testConfigs[0]);
    });

    it('getConfig throws ConnectionNotFoundError for unknown id', async () => {
      await expect(manager.getConfig('unknown')).rejects.toThrow(ConnectionNotFoundError);
    });

    it('listConfigs returns all configurations', async () => {
      const configs = await manager.listConfigs();
      expect(configs).toHaveLength(2);
    });

    it('hasConnection returns true for existing id', async () => {
      expect(await manager.hasConnection('test-id-123')).toBe(true);
    });

    it('hasConnection returns false for unknown id', async () => {
      expect(await manager.hasConnection('unknown')).toBe(false);
    });
  });

  describe('connect', () => {
    it('creates and initializes driver from config', async () => {
      const driver = await manager.connect(testConfigs[0]);

      expect(mockFactory.create).toHaveBeenCalledTimes(1);
      expect(driver.init).toHaveBeenCalledWith(testConfigs[0]);
    });

    it('returns new instance each time (stateless)', async () => {
      const driver1 = await manager.connect(testConfigs[0]);
      const driver2 = await manager.connect(testConfigs[0]);

      expect(driver1).not.toBe(driver2);
      expect(mockFactory.create).toHaveBeenCalledTimes(2);
    });

    it('throws DriverNotFoundError for unknown type', async () => {
      const unknownConfig = { id: 'x', type: 'unknown', credentials: {} };
      await expect(manager.connect(unknownConfig)).rejects.toThrow(DriverNotFoundError);
    });
  });

  describe('connectById', () => {
    it('resolves config and connects', async () => {
      const driver = await manager.connectById('test-id-123');

      expect(mockFactory.create).toHaveBeenCalledTimes(1);
      expect(driver.init).toHaveBeenCalledWith(testConfigs[0]);
    });

    it('throws ConnectionNotFoundError for unknown id', async () => {
      await expect(manager.connectById('unknown')).rejects.toThrow(ConnectionNotFoundError);
    });
  });

  describe('canAddToDatabase', () => {
    it('returns false when id exists in file source', async () => {
      expect(await manager.canAddToDatabase('test-id-123')).toBe(false);
    });

    it('returns true when id does not exist', async () => {
      expect(await manager.canAddToDatabase('new-id')).toBe(true);
    });
  });
});
