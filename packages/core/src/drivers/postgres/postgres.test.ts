import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPostgresDriver, postgresDriverFactory } from './index.js';
import type { DatabaseDriver } from '@maetrik/shared';

// Mock pg module
vi.mock('pg', () => {
  const mockClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn(),
    end: vi.fn().mockResolvedValue(undefined),
  };

  return {
    default: {
      Client: vi.fn().mockImplementation(() => mockClient),
    },
    Client: vi.fn().mockImplementation(() => mockClient),
  };
});

describe('PostgresDriver', () => {
  let driver: DatabaseDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    driver = createPostgresDriver();
  });

  afterEach(async () => {
    try {
      await driver.shutdown();
    } catch {
      // Ignore shutdown errors in tests
    }
  });

  it('has correct name and dialect', () => {
    expect(driver.name).toBe('postgres');
    expect(driver.dialect).toBe('postgresql');
  });

  it('initializes with connection config', async () => {
    const pg = await import('pg');

    await driver.init({
      driver: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'testuser',
      password: 'testpass',
    });

    // Driver uses default import: import pg from 'pg', so check pg.default.Client
    expect(pg.default.Client).toHaveBeenCalledWith({
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'testuser',
      password: 'testpass',
    });
  });

  it('reports capabilities', () => {
    const caps = driver.capabilities();

    expect(caps.streaming).toBe(false);
    expect(caps.explain).toBe(true);
    expect(caps.timeout).toBe(true);
  });

  it('factory creates driver instance', () => {
    const factoryDriver = postgresDriverFactory.create();

    expect(factoryDriver.name).toBe('postgres');
    expect(factoryDriver.dialect).toBe('postgresql');
  });
});
