import { describe, it, expect } from 'vitest';
import { FileConnectionConfigSource } from './file.js';
import type { ConnectionConfig } from '../types.js';

const testConfigs: ConnectionConfig[] = [
  { id: 'postgres-main', type: 'postgres', credentials: { host: 'localhost' } },
  { id: 'mysql-backup', type: 'mysql', credentials: { host: '10.0.0.1' } },
];

describe('FileConnectionConfigSource', () => {
  describe('get', () => {
    it('returns config by id', async () => {
      const source = new FileConnectionConfigSource(testConfigs);
      const config = await source.get('postgres-main');
      expect(config).toEqual(testConfigs[0]);
    });

    it('returns undefined for unknown id', async () => {
      const source = new FileConnectionConfigSource(testConfigs);
      const config = await source.get('unknown');
      expect(config).toBeUndefined();
    });
  });

  describe('list', () => {
    it('returns all configs', async () => {
      const source = new FileConnectionConfigSource(testConfigs);
      const configs = await source.list();
      expect(configs).toHaveLength(2);
      expect(configs).toEqual(expect.arrayContaining(testConfigs));
    });

    it('returns empty array when no configs', async () => {
      const source = new FileConnectionConfigSource([]);
      const configs = await source.list();
      expect(configs).toEqual([]);
    });
  });

  describe('has', () => {
    it('returns true for existing id', async () => {
      const source = new FileConnectionConfigSource(testConfigs);
      expect(await source.has('postgres-main')).toBe(true);
    });

    it('returns false for unknown id', async () => {
      const source = new FileConnectionConfigSource(testConfigs);
      expect(await source.has('unknown')).toBe(false);
    });
  });

  describe('name', () => {
    it('returns "file"', () => {
      const source = new FileConnectionConfigSource([]);
      expect(source.name).toBe('file');
    });
  });
});
