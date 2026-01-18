import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGLiteStateDatabase } from './pglite.js';

describe('PGLiteStateDatabase', () => {
  let db: PGLiteStateDatabase;

  beforeEach(async () => {
    db = new PGLiteStateDatabase(':memory:');
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
});
