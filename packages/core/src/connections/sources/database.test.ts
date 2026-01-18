import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseConnectionConfigSource } from './database.js';
import { PGLiteStateDatabase } from '../../state/pglite.js';

describe('DatabaseConnectionConfigSource', () => {
  let db: PGLiteStateDatabase;
  let source: DatabaseConnectionConfigSource;

  beforeEach(async () => {
    // Use unique memory path to avoid sharing state with parallel tests
    db = new PGLiteStateDatabase('memory://database-source-test');
    await db.initialize();
    // Clean up for test isolation
    await db.execute('DELETE FROM connections');
    source = new DatabaseConnectionConfigSource(db);
  });

  afterEach(async () => {
    await db.shutdown();
  });

  describe('get', () => {
    it('returns config by id', async () => {
      await db.createConnection({
        id: 'test-db',
        type: 'postgres',
        credentials: { host: 'localhost' },
        name: 'Test DB',
      });

      const config = await source.get('test-db');
      expect(config).toEqual({
        id: 'test-db',
        type: 'postgres',
        credentials: { host: 'localhost' },
      });
    });

    it('returns undefined for unknown id', async () => {
      const config = await source.get('unknown');
      expect(config).toBeUndefined();
    });
  });

  describe('list', () => {
    it('returns all configs', async () => {
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

      const configs = await source.list();
      expect(configs).toHaveLength(2);
      expect(configs[0]).toEqual({
        id: 'conn-1',
        type: 'postgres',
        credentials: { host: 'host1' },
      });
    });

    it('returns empty array when no connections', async () => {
      const configs = await source.list();
      expect(configs).toEqual([]);
    });
  });

  describe('has', () => {
    it('returns true for existing id', async () => {
      await db.createConnection({
        id: 'exists',
        type: 'postgres',
        credentials: {},
      });

      expect(await source.has('exists')).toBe(true);
    });

    it('returns false for unknown id', async () => {
      expect(await source.has('unknown')).toBe(false);
    });
  });

  describe('name', () => {
    it('returns "database"', () => {
      expect(source.name).toBe('database');
    });
  });
});
