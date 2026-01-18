import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGLiteStateDatabase } from './pglite.js';

describe('PGLiteStateDatabase', () => {
  let db: PGLiteStateDatabase;

  beforeEach(async () => {
    // Use unique memory path to avoid sharing state with parallel tests
    db = new PGLiteStateDatabase('memory://pglite-test');
    await db.initialize();
  });

  afterEach(async () => {
    await db.shutdown();
  });

  it('initializes successfully', async () => {
    // If we get here without error, init worked
    expect(true).toBe(true);
  });

  it('executes DDL statements', async () => {
    await db.execute('DROP TABLE IF EXISTS test_ddl');
    await db.execute('CREATE TABLE test_ddl (id INTEGER PRIMARY KEY, name TEXT)');
    // No error means success
  });

  it('inserts and queries data', async () => {
    await db.execute('DROP TABLE IF EXISTS users_test');
    await db.execute('CREATE TABLE users_test (id INTEGER PRIMARY KEY, name TEXT)');
    await db.execute("INSERT INTO users_test (id, name) VALUES (1, 'Alice')");

    const rows = await db.query<{ id: number; name: string }>('SELECT * FROM users_test');
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Alice');
  });

  it('supports parameterized queries', async () => {
    await db.execute('DROP TABLE IF EXISTS items_test');
    await db.execute('CREATE TABLE items_test (id INTEGER PRIMARY KEY, value TEXT)');
    await db.execute('INSERT INTO items_test (id, value) VALUES ($1, $2)', [1, 'test']);

    const rows = await db.query<{ value: string }>('SELECT value FROM items_test WHERE id = $1', [1]);
    expect(rows[0].value).toBe('test');
  });

  describe('connection storage', () => {
    beforeEach(async () => {
      // Clean up any existing connections for test isolation
      await db.execute('DELETE FROM connections');
    });

    it('creates and retrieves a connection', async () => {
      await db.createConnection({
        id: 'test-conn',
        type: 'postgres',
        credentials: { host: 'localhost', port: 5432 },
        name: 'Test Connection',
      });

      const conn = await db.getConnection('test-conn');
      expect(conn).toBeDefined();
      expect(conn!.id).toBe('test-conn');
      expect(conn!.type).toBe('postgres');
      expect(conn!.credentials).toEqual({ host: 'localhost', port: 5432 });
      expect(conn!.name).toBe('Test Connection');
    });

    it('returns undefined for non-existent connection', async () => {
      const conn = await db.getConnection('non-existent');
      expect(conn).toBeUndefined();
    });

    it('lists all connections', async () => {
      await db.createConnection({
        id: 'conn-1',
        type: 'postgres',
        credentials: { host: 'host1' },
      });
      await db.createConnection({
        id: 'conn-2',
        type: 'mysql',
        credentials: { host: 'host2' },
      });

      const connections = await db.listConnections();
      expect(connections).toHaveLength(2);
    });

    it('checks if connection exists', async () => {
      await db.createConnection({
        id: 'exists-test',
        type: 'postgres',
        credentials: {},
      });

      expect(await db.connectionExists('exists-test')).toBe(true);
      expect(await db.connectionExists('not-exists')).toBe(false);
    });

    it('deletes a connection', async () => {
      await db.createConnection({
        id: 'to-delete',
        type: 'postgres',
        credentials: {},
      });

      await db.deleteConnection('to-delete');
      expect(await db.connectionExists('to-delete')).toBe(false);
    });

    it('updates a connection', async () => {
      await db.createConnection({
        id: 'to-update',
        type: 'postgres',
        credentials: { host: 'old' },
        name: 'Old Name',
      });

      await db.updateConnection('to-update', {
        credentials: { host: 'new' },
        name: 'New Name',
      });

      const conn = await db.getConnection('to-update');
      expect(conn!.credentials).toEqual({ host: 'new' });
      expect(conn!.name).toBe('New Name');
    });
  });
});
