import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDriverRegistry } from './registry.js';
import type { DriverFactory } from './types.js';
import type { DatabaseDriver } from '@maetrik/shared';

describe('DriverRegistry', () => {
  const mockDriver: DatabaseDriver = {
    name: 'mock',
    dialect: 'mock',
    init: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue(true),
    shutdown: vi.fn().mockResolvedValue(undefined),
    introspect: vi.fn().mockResolvedValue({ tables: {} }),
    execute: vi.fn().mockResolvedValue({ columns: [], rows: [], rowCount: 0 }),
    capabilities: vi.fn().mockReturnValue({}),
  };

  const mockFactory: DriverFactory = {
    name: 'mock',
    dialect: 'mock',
    create: vi.fn().mockReturnValue(mockDriver),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a driver factory', () => {
    const registry = createDriverRegistry();
    registry.register(mockFactory);

    expect(registry.get('mock')).toBe(mockFactory);
  });

  it('lists registered drivers', () => {
    const registry = createDriverRegistry();
    registry.register(mockFactory);

    expect(registry.list()).toContain('mock');
  });

  it('returns undefined for unknown driver', () => {
    const registry = createDriverRegistry();

    expect(registry.get('unknown')).toBeUndefined();
  });

  it('creates driver instance from factory', () => {
    const registry = createDriverRegistry();
    registry.register(mockFactory);

    const driver = registry.createDriver('mock');

    expect(mockFactory.create).toHaveBeenCalled();
    expect(driver).toBe(mockDriver);
  });

  it('throws when creating unknown driver', () => {
    const registry = createDriverRegistry();

    expect(() => registry.createDriver('unknown')).toThrow(/unknown driver/i);
  });
});
