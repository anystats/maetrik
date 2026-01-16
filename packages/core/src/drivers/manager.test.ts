import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDriverManager } from './manager.js';
import { createDriverRegistry } from './registry.js';
import type { DriverFactory } from './types.js';
import type { DatabaseDriver, ConnectionConfig } from '@maetrik/shared';

describe('DriverManager', () => {
  const createMockDriver = (): DatabaseDriver => ({
    name: 'mock',
    dialect: 'mock',
    init: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue(true),
    shutdown: vi.fn().mockResolvedValue(undefined),
    introspect: vi.fn().mockResolvedValue({ tables: {} }),
    execute: vi.fn().mockResolvedValue({ columns: [], rows: [], rowCount: 0 }),
    capabilities: vi.fn().mockReturnValue({}),
  });

  const mockFactory: DriverFactory = {
    name: 'mock',
    dialect: 'mock',
    create: vi.fn().mockImplementation(createMockDriver),
  };

  const connections: Record<string, ConnectionConfig> = {
    main: {
      driver: 'mock',
      host: 'localhost',
      port: 5432,
      database: 'test',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes drivers for all connections', async () => {
    const registry = createDriverRegistry();
    registry.register(mockFactory);

    const manager = createDriverManager(registry, { connections });
    await manager.initialize();

    expect(mockFactory.create).toHaveBeenCalledTimes(1);
  });

  it('returns initialized driver by connection name', async () => {
    const registry = createDriverRegistry();
    registry.register(mockFactory);

    const manager = createDriverManager(registry, { connections });
    await manager.initialize();

    const driver = manager.getDriver('main');
    expect(driver).toBeDefined();
    expect(driver?.init).toHaveBeenCalledWith(connections.main);
  });

  it('returns undefined for unknown connection', async () => {
    const registry = createDriverRegistry();
    registry.register(mockFactory);

    const manager = createDriverManager(registry, { connections });
    await manager.initialize();

    expect(manager.getDriver('unknown')).toBeUndefined();
  });

  it('performs health check on specific connection', async () => {
    const registry = createDriverRegistry();
    registry.register(mockFactory);

    const manager = createDriverManager(registry, { connections });
    await manager.initialize();

    const healthy = await manager.healthCheck('main');
    expect(healthy).toBe(true);
  });

  it('shuts down all drivers', async () => {
    const registry = createDriverRegistry();
    registry.register(mockFactory);

    const manager = createDriverManager(registry, { connections });
    await manager.initialize();

    const driver = manager.getDriver('main');
    await manager.shutdown();

    expect(driver?.shutdown).toHaveBeenCalled();
  });
});
