import { describe, it, expect, beforeEach } from 'vitest';
import { CompositeConnectionConfigResolver } from './resolver.js';
import { FileConnectionConfigSource } from './sources/file.js';
import { ConnectionNotFoundError, DuplicateConnectionError } from './errors.js';
import type { ConnectionConfig, ConnectionConfigSource } from './types.js';

const fileConfigs: ConnectionConfig[] = [
  { id: 'file-conn-1', type: 'postgres', credentials: { host: 'file-host-1' } },
  { id: 'file-conn-2', type: 'mysql', credentials: { host: 'file-host-2' } },
];

// Mock database source for testing
class MockDatabaseSource implements ConnectionConfigSource {
  readonly name = 'database';
  private configs: Map<string, ConnectionConfig>;

  constructor(configs: ConnectionConfig[] = []) {
    this.configs = new Map(configs.map((c) => [c.id, c]));
  }

  async get(id: string): Promise<ConnectionConfig | undefined> {
    return this.configs.get(id);
  }

  async list(): Promise<ConnectionConfig[]> {
    return Array.from(this.configs.values());
  }

  async has(id: string): Promise<boolean> {
    return this.configs.has(id);
  }
}

describe('CompositeConnectionConfigResolver', () => {
  let fileSource: FileConnectionConfigSource;
  let dbSource: MockDatabaseSource;
  let resolver: CompositeConnectionConfigResolver;

  beforeEach(() => {
    fileSource = new FileConnectionConfigSource(fileConfigs);
    dbSource = new MockDatabaseSource([
      { id: 'db-conn-1', type: 'sqlite', credentials: { path: './db.sqlite' } },
    ]);
    resolver = new CompositeConnectionConfigResolver([fileSource, dbSource]);
  });

  describe('get', () => {
    it('returns config from file source', async () => {
      const config = await resolver.get('file-conn-1');
      expect(config.id).toBe('file-conn-1');
      expect(config.credentials).toEqual({ host: 'file-host-1' });
    });

    it('returns config from database source', async () => {
      const config = await resolver.get('db-conn-1');
      expect(config.id).toBe('db-conn-1');
      expect(config.credentials).toEqual({ path: './db.sqlite' });
    });

    it('throws ConnectionNotFoundError for unknown id', async () => {
      await expect(resolver.get('unknown')).rejects.toThrow(ConnectionNotFoundError);
    });

    it('throws DuplicateConnectionError when id exists in multiple sources', async () => {
      const duplicateDbSource = new MockDatabaseSource([
        { id: 'file-conn-1', type: 'postgres', credentials: { host: 'different' } },
      ]);
      const duplicateResolver = new CompositeConnectionConfigResolver([
        fileSource,
        duplicateDbSource,
      ]);

      await expect(duplicateResolver.get('file-conn-1')).rejects.toThrow(DuplicateConnectionError);
    });
  });

  describe('list', () => {
    it('returns configs from all sources', async () => {
      const configs = await resolver.list();
      expect(configs).toHaveLength(3);
      expect(configs.map((c) => c.id)).toEqual(
        expect.arrayContaining(['file-conn-1', 'file-conn-2', 'db-conn-1'])
      );
    });

    it('throws DuplicateConnectionError when sources have same id', async () => {
      const duplicateDbSource = new MockDatabaseSource([
        { id: 'file-conn-1', type: 'postgres', credentials: {} },
      ]);
      const duplicateResolver = new CompositeConnectionConfigResolver([
        fileSource,
        duplicateDbSource,
      ]);

      await expect(duplicateResolver.list()).rejects.toThrow(DuplicateConnectionError);
    });
  });

  describe('has', () => {
    it('returns true for id in file source', async () => {
      expect(await resolver.has('file-conn-1')).toBe(true);
    });

    it('returns true for id in database source', async () => {
      expect(await resolver.has('db-conn-1')).toBe(true);
    });

    it('returns false for unknown id', async () => {
      expect(await resolver.has('unknown')).toBe(false);
    });
  });

  describe('existsInOtherSources', () => {
    it('returns true when id exists in other sources', async () => {
      expect(await resolver.existsInOtherSources('file-conn-1', 'database')).toBe(true);
    });

    it('returns false when id only exists in excluded source', async () => {
      expect(await resolver.existsInOtherSources('file-conn-1', 'file')).toBe(false);
    });

    it('returns false when id does not exist', async () => {
      expect(await resolver.existsInOtherSources('unknown', 'database')).toBe(false);
    });
  });
});
