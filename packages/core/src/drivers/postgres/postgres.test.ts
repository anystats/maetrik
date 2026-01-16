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

describe('PostgresDriver - Schema Introspection', () => {
  let driver: DatabaseDriver;

  beforeEach(async () => {
    vi.clearAllMocks();
    driver = createPostgresDriver();

    // Setup mock query responses for introspection
    const pg = await import('pg');
    const mockClient = new pg.default.Client();

    // Mock the tables query
    (mockClient.query as ReturnType<typeof vi.fn>).mockImplementation(
      async (sql: string) => {
        if (sql.includes('information_schema.tables')) {
          return {
            rows: [
              { table_name: 'users' },
              { table_name: 'orders' },
            ],
          };
        }
        if (sql.includes('information_schema.columns')) {
          return {
            rows: [
              {
                table_name: 'users',
                column_name: 'id',
                data_type: 'uuid',
                is_nullable: 'NO',
              },
              {
                table_name: 'users',
                column_name: 'email',
                data_type: 'character varying',
                is_nullable: 'NO',
              },
              {
                table_name: 'orders',
                column_name: 'id',
                data_type: 'uuid',
                is_nullable: 'NO',
              },
              {
                table_name: 'orders',
                column_name: 'user_id',
                data_type: 'uuid',
                is_nullable: 'YES',
              },
            ],
          };
        }
        if (sql.includes('pg_indexes')) {
          return {
            rows: [
              { table_name: 'users', indexdef: 'CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)' },
              { table_name: 'orders', indexdef: 'CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)' },
            ],
          };
        }
        return { rows: [], fields: [] };
      }
    );

    await driver.init({
      driver: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'test',
    });
  });

  afterEach(async () => {
    await driver.shutdown();
  });

  it('introspects tables from database', async () => {
    const schema = await driver.introspect();

    expect(schema.tables).toHaveProperty('users');
    expect(schema.tables).toHaveProperty('orders');
  });

  it('introspects columns with types', async () => {
    const schema = await driver.introspect();

    expect(schema.tables.users.columns).toContainEqual(
      expect.objectContaining({
        name: 'id',
        type: 'uuid',
        nullable: false,
      })
    );
    expect(schema.tables.users.columns).toContainEqual(
      expect.objectContaining({
        name: 'email',
        type: 'character varying',
        nullable: false,
      })
    );
  });

  it('identifies nullable columns', async () => {
    const schema = await driver.introspect();

    const userIdCol = schema.tables.orders.columns.find(
      (c) => c.name === 'user_id'
    );
    expect(userIdCol?.nullable).toBe(true);
  });

  it('identifies primary key columns', async () => {
    const schema = await driver.introspect();

    const idCol = schema.tables.users.columns.find((c) => c.name === 'id');
    expect(idCol?.primaryKey).toBe(true);
  });
});
