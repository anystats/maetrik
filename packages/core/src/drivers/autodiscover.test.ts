import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DriverFactory } from '@maetrik/shared';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
}));

describe('autodiscoverDrivers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('discovers @maetrik/driver-* packages', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockedReaddir = vi.mocked(readdir);

    // Mock node_modules structure
    mockedReaddir.mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.endsWith('node_modules')) {
        return ['some-package', 'another'] as unknown as ReturnType<typeof readdir>;
      }
      if (pathStr.endsWith('@maetrik')) {
        return ['driver-postgres', 'shared', 'core'] as unknown as ReturnType<typeof readdir>;
      }
      throw new Error('Not found');
    });

    // Mock the dynamic import
    const mockFactory: DriverFactory = {
      name: 'postgres',
      dialect: 'postgresql',
      create: () => ({
        name: 'postgres',
        dialect: 'postgresql',
        init: vi.fn(),
        healthCheck: vi.fn(),
        shutdown: vi.fn(),
        introspect: vi.fn(),
        execute: vi.fn(),
        capabilities: vi.fn(),
      }),
    };

    vi.doMock('@maetrik/driver-postgres', () => ({
      driverFactory: mockFactory,
    }));

    const { autodiscoverDrivers } = await import('./autodiscover.js');
    const result = await autodiscoverDrivers();

    expect(result.drivers).toHaveLength(1);
    expect(result.drivers[0].packageName).toBe('@maetrik/driver-postgres');
    expect(result.drivers[0].factory.name).toBe('postgres');
  });

  it('discovers maetrik-driver-* packages', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockedReaddir = vi.mocked(readdir);

    mockedReaddir.mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.endsWith('node_modules')) {
        return ['maetrik-driver-mysql', 'other-package'] as unknown as ReturnType<typeof readdir>;
      }
      if (pathStr.endsWith('@maetrik')) {
        return [] as unknown as ReturnType<typeof readdir>;
      }
      throw new Error('Not found');
    });

    const mockFactory: DriverFactory = {
      name: 'mysql',
      dialect: 'mysql',
      create: () => ({
        name: 'mysql',
        dialect: 'mysql',
        init: vi.fn(),
        healthCheck: vi.fn(),
        shutdown: vi.fn(),
        introspect: vi.fn(),
        execute: vi.fn(),
        capabilities: vi.fn(),
      }),
    };

    vi.doMock('maetrik-driver-mysql', () => ({
      driverFactory: mockFactory,
    }));

    const { autodiscoverDrivers } = await import('./autodiscover.js');
    const result = await autodiscoverDrivers();

    expect(result.drivers).toHaveLength(1);
    expect(result.drivers[0].packageName).toBe('maetrik-driver-mysql');
  });

  it('reports error when package does not export driverFactory', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockedReaddir = vi.mocked(readdir);

    mockedReaddir.mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.endsWith('node_modules')) {
        return ['maetrik-driver-broken'] as unknown as ReturnType<typeof readdir>;
      }
      if (pathStr.endsWith('@maetrik')) {
        return [] as unknown as ReturnType<typeof readdir>;
      }
      throw new Error('Not found');
    });

    vi.doMock('maetrik-driver-broken', () => ({
      somethingElse: 'not a driver',
    }));

    const { autodiscoverDrivers } = await import('./autodiscover.js');
    const result = await autodiscoverDrivers();

    expect(result.drivers).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].packageName).toBe('maetrik-driver-broken');
    expect(result.errors[0].error.message).toContain('driverFactory');
  });

  it('reports error when driverFactory is invalid', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockedReaddir = vi.mocked(readdir);

    mockedReaddir.mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.endsWith('node_modules')) {
        return ['maetrik-driver-invalid'] as unknown as ReturnType<typeof readdir>;
      }
      if (pathStr.endsWith('@maetrik')) {
        return [] as unknown as ReturnType<typeof readdir>;
      }
      throw new Error('Not found');
    });

    vi.doMock('maetrik-driver-invalid', () => ({
      driverFactory: {
        name: 'invalid',
        // missing dialect and create
      },
    }));

    const { autodiscoverDrivers } = await import('./autodiscover.js');
    const result = await autodiscoverDrivers();

    expect(result.drivers).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error.message).toContain('not a valid DriverFactory');
  });

  it('returns empty results when no drivers found', async () => {
    const { readdir } = await import('node:fs/promises');
    const mockedReaddir = vi.mocked(readdir);

    mockedReaddir.mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.endsWith('node_modules')) {
        return ['some-unrelated-package'] as unknown as ReturnType<typeof readdir>;
      }
      if (pathStr.endsWith('@maetrik')) {
        return ['shared', 'core'] as unknown as ReturnType<typeof readdir>;
      }
      throw new Error('Not found');
    });

    const { autodiscoverDrivers } = await import('./autodiscover.js');
    const result = await autodiscoverDrivers();

    expect(result.drivers).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});
