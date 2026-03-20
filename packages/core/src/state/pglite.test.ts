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
        options: { credentials: { host: 'localhost', port: 5432 } },
        name: 'Test Connection',
      });

      const conn = await db.getConnection('test-conn');
      expect(conn).toBeDefined();
      expect(conn!.id).toBe('test-conn');
      expect(conn!.type).toBe('postgres');
      expect(conn!.options).toEqual({ credentials: { host: 'localhost', port: 5432 } });
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
        options: { credentials: { host: 'host1' } },
      });
      await db.createConnection({
        id: 'conn-2',
        type: 'mysql',
        options: { credentials: { host: 'host2' } },
      });

      const connections = await db.listConnections();
      expect(connections).toHaveLength(2);
    });

    it('checks if connection exists', async () => {
      await db.createConnection({
        id: 'exists-test',
        type: 'postgres',
        options: { credentials: {} },
      });

      expect(await db.connectionExists('exists-test')).toBe(true);
      expect(await db.connectionExists('not-exists')).toBe(false);
    });

    it('deletes a connection', async () => {
      await db.createConnection({
        id: 'to-delete',
        type: 'postgres',
        options: { credentials: {} },
      });

      await db.deleteConnection('to-delete');
      expect(await db.connectionExists('to-delete')).toBe(false);
    });

    it('updates a connection', async () => {
      await db.createConnection({
        id: 'to-update',
        type: 'postgres',
        options: { credentials: { host: 'old' } },
        name: 'Old Name',
      });

      await db.updateConnection('to-update', {
        options: { credentials: { host: 'new' } },
        name: 'New Name',
      });

      const conn = await db.getConnection('to-update');
      expect(conn!.options).toEqual({ credentials: { host: 'new' } });
      expect(conn!.name).toBe('New Name');
    });
  });

  describe('health observability', () => {
    beforeEach(async () => {
      await db.execute('DELETE FROM connections');
      await db.createConnection({
        id: 'health-test',
        type: 'postgres',
        options: { credentials: { host: 'localhost' } },
      });
    });

    it('new connections default to green health status', async () => {
      const conn = await db.getConnection('health-test');
      expect(conn!.health_status).toBe('green');
      expect(conn!.health_thresholds).toEqual({ connection_ms: 2000 });
    });

    it('updates connection health status', async () => {
      await db.updateConnectionHealth('health-test', 'red');
      const conn = await db.getConnection('health-test');
      expect(conn!.health_status).toBe('red');
    });

    it('upserts health stats bucket', async () => {
      const bucketStart = new Date('2026-03-20T10:00:00Z');
      await db.upsertHealthStats('health-test', bucketStart, 'green');
      const stats = await db.getHealthStats('health-test');
      expect(stats).toHaveLength(1);
      expect(stats[0].health_status).toBe('green');
      expect(stats[0].connection_id).toBe('health-test');
    });

    it('upsert overwrites bucket when status is worse', async () => {
      const bucketStart = new Date('2026-03-20T10:00:00Z');
      await db.upsertHealthStats('health-test', bucketStart, 'green');
      await db.upsertHealthStats('health-test', bucketStart, 'yellow', 'Slow response: 3200ms');
      const stats = await db.getHealthStats('health-test');
      expect(stats).toHaveLength(1);
      expect(stats[0].health_status).toBe('yellow');
      expect(stats[0].degradation_message).toBe('Slow response: 3200ms');
    });

    it('upsert does not downgrade bucket status', async () => {
      const bucketStart = new Date('2026-03-20T10:00:00Z');
      await db.upsertHealthStats('health-test', bucketStart, 'red', 'Connection failed');
      await db.upsertHealthStats('health-test', bucketStart, 'green');
      const stats = await db.getHealthStats('health-test');
      expect(stats).toHaveLength(1);
      expect(stats[0].health_status).toBe('red');
      expect(stats[0].degradation_message).toBe('Connection failed');
    });

    it('prunes health stats older than 48 hours', async () => {
      const old = new Date('2026-03-18T00:00:00Z');
      const recent = new Date('2026-03-20T10:00:00Z');
      await db.upsertHealthStats('health-test', old, 'green');
      await db.upsertHealthStats('health-test', recent, 'green');
      await db.pruneHealthStats('health-test');
      const stats = await db.getHealthStats('health-test');
      expect(stats).toHaveLength(1);
      // Compare timestamps allowing for timezone offset differences in PGLite
      expect(Math.abs(stats[0].bucket_start.getTime() - recent.getTime())).toBeLessThanOrEqual(3600000);
    });

    it('cascade deletes health stats when connection is deleted', async () => {
      const bucket = new Date('2026-03-20T10:00:00Z');
      await db.upsertHealthStats('health-test', bucket, 'green');
      await db.deleteConnection('health-test');
      const stats = await db.getHealthStats('health-test');
      expect(stats).toHaveLength(0);
    });
  });
});
