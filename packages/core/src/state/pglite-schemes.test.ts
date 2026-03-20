import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGLiteStateDatabase } from './pglite.js';
import type { SchemeTable } from './types.js';

const sampleTables: SchemeTable[] = [
  {
    name: 'users',
    columns: [
      { name: 'id', type: 'integer', nullable: false },
      { name: 'email', type: 'text', nullable: false },
      { name: 'name', type: 'text', nullable: true },
    ],
    indexes: [{ name: 'users_pkey', columns: ['id'], unique: true, primaryKey: true }],
    foreignKeys: [],
  },
  {
    name: 'orders',
    columns: [
      { name: 'id', type: 'integer', nullable: false },
      { name: 'user_id', type: 'integer', nullable: false },
      { name: 'total', type: 'numeric', nullable: false },
    ],
    indexes: [{ name: 'orders_pkey', columns: ['id'], unique: true, primaryKey: true }],
    foreignKeys: [{ column: 'user_id', referencesTable: 'users', referencesColumn: 'id' }],
  },
];

describe('PGLiteStateDatabase - Schemes', () => {
  let db: PGLiteStateDatabase;

  beforeEach(async () => {
    db = new PGLiteStateDatabase('memory://pglite-schemes-test');
    await db.initialize();
  });

  afterEach(async () => {
    await db.shutdown();
  });

  describe('createScheme', () => {
    it('creates a scheme with a YYYYMMDDHHMMSS version', async () => {
      const scheme = await db.createScheme('conn-1', sampleTables);

      expect(scheme.id).toBeTruthy();
      expect(scheme.connection_id).toBe('conn-1');
      expect(scheme.version).toMatch(/^\d{14}$/);
      expect(scheme.active).toBe(true);
      expect(scheme.tables).toEqual(sampleTables);
    });

    it('deactivates previous schemes when creating a new one', async () => {
      const first = await db.createScheme('conn-1', sampleTables);
      const second = await db.createScheme('conn-1', sampleTables);

      const versions = await db.getSchemeVersions('conn-1');
      expect(versions).toHaveLength(2);

      const firstVersion = versions.find(v => v.id === first.id);
      const secondVersion = versions.find(v => v.id === second.id);
      expect(firstVersion?.active).toBe(false);
      expect(secondVersion?.active).toBe(true);
    });
  });

  describe('getActiveScheme', () => {
    it('returns null when no scheme exists', async () => {
      const result = await db.getActiveScheme('nonexistent');
      expect(result).toBeNull();
    });

    it('returns the active scheme', async () => {
      const created = await db.createScheme('conn-1', sampleTables);
      const active = await db.getActiveScheme('conn-1');

      expect(active).not.toBeNull();
      expect(active!.id).toBe(created.id);
      expect(active!.active).toBe(true);
      expect(active!.tables).toEqual(sampleTables);
    });

    it('returns null after all schemes are deactivated', async () => {
      await db.createScheme('conn-1', sampleTables);
      await db.deactivateSchemes('conn-1');

      const result = await db.getActiveScheme('conn-1');
      expect(result).toBeNull();
    });
  });

  describe('getSchemeVersions', () => {
    it('returns empty array when no schemes exist', async () => {
      const versions = await db.getSchemeVersions('nonexistent');
      expect(versions).toEqual([]);
    });

    it('returns all versions ordered by version string', async () => {
      await db.createScheme('conn-1', sampleTables);
      await db.createScheme('conn-1', sampleTables);
      await db.createScheme('conn-1', sampleTables);

      const versions = await db.getSchemeVersions('conn-1');
      expect(versions).toHaveLength(3);

      // Only the last should be active
      const activeVersions = versions.filter(v => v.active);
      expect(activeVersions).toHaveLength(1);
      expect(activeVersions[0].id).toBe(versions[versions.length - 1].id);
    });

    it('versions are ordered ascending', async () => {
      await db.createScheme('conn-1', sampleTables);
      await db.createScheme('conn-1', sampleTables);

      const versions = await db.getSchemeVersions('conn-1');
      expect(versions[0].version <= versions[1].version).toBe(true);
    });
  });

  describe('deactivateSchemes', () => {
    it('deactivates all schemes for a connection', async () => {
      await db.createScheme('conn-1', sampleTables);
      await db.createScheme('conn-1', sampleTables);
      await db.deactivateSchemes('conn-1');

      const versions = await db.getSchemeVersions('conn-1');
      expect(versions.every(v => !v.active)).toBe(true);
    });

    it('does not affect other connections', async () => {
      await db.createScheme('conn-1', sampleTables);
      await db.createScheme('conn-2', sampleTables);

      await db.deactivateSchemes('conn-1');

      const active2 = await db.getActiveScheme('conn-2');
      expect(active2).not.toBeNull();
      expect(active2!.active).toBe(true);
    });
  });

  describe('enrichments', () => {
    it('sets and gets a table-level enrichment', async () => {
      await db.setEnrichment('conn-1', 'users', null, 'Contains all registered users');
      const enrichments = await db.getEnrichments('conn-1');

      expect(enrichments).toHaveLength(1);
      expect(enrichments[0].connection_id).toBe('conn-1');
      expect(enrichments[0].table_name).toBe('users');
      expect(enrichments[0].column_name).toBeNull();
      expect(enrichments[0].description).toBe('Contains all registered users');
    });

    it('sets and gets a column-level enrichment', async () => {
      await db.setEnrichment('conn-1', 'users', 'email', 'Primary contact email');
      const enrichments = await db.getEnrichments('conn-1');

      expect(enrichments).toHaveLength(1);
      expect(enrichments[0].table_name).toBe('users');
      expect(enrichments[0].column_name).toBe('email');
      expect(enrichments[0].description).toBe('Primary contact email');
    });

    it('upserts on duplicate key', async () => {
      await db.setEnrichment('conn-1', 'users', null, 'Old description');
      await db.setEnrichment('conn-1', 'users', null, 'Updated description');

      const enrichments = await db.getEnrichments('conn-1');
      expect(enrichments).toHaveLength(1);
      expect(enrichments[0].description).toBe('Updated description');
    });

    it('stores multiple enrichments for the same table', async () => {
      await db.setEnrichment('conn-1', 'users', null, 'User table');
      await db.setEnrichment('conn-1', 'users', 'email', 'Email column');
      await db.setEnrichment('conn-1', 'users', 'name', 'Display name');

      const enrichments = await db.getEnrichments('conn-1');
      expect(enrichments).toHaveLength(3);
    });

    it('deletes a table-level enrichment', async () => {
      await db.setEnrichment('conn-1', 'users', null, 'User table');
      await db.setEnrichment('conn-1', 'users', 'email', 'Email column');

      await db.deleteEnrichment('conn-1', 'users', null);

      const enrichments = await db.getEnrichments('conn-1');
      expect(enrichments).toHaveLength(1);
      expect(enrichments[0].column_name).toBe('email');
    });

    it('deletes a column-level enrichment', async () => {
      await db.setEnrichment('conn-1', 'users', null, 'User table');
      await db.setEnrichment('conn-1', 'users', 'email', 'Email column');

      await db.deleteEnrichment('conn-1', 'users', 'email');

      const enrichments = await db.getEnrichments('conn-1');
      expect(enrichments).toHaveLength(1);
      expect(enrichments[0].column_name).toBeNull();
    });

    it('isolates enrichments between connections', async () => {
      await db.setEnrichment('conn-1', 'users', null, 'Conn1 users');
      await db.setEnrichment('conn-2', 'users', null, 'Conn2 users');

      const e1 = await db.getEnrichments('conn-1');
      const e2 = await db.getEnrichments('conn-2');

      expect(e1).toHaveLength(1);
      expect(e1[0].description).toBe('Conn1 users');
      expect(e2).toHaveLength(1);
      expect(e2[0].description).toBe('Conn2 users');
    });

    it('returns enrichments ordered by table_name then column_name', async () => {
      await db.setEnrichment('conn-1', 'orders', 'total', 'Order total');
      await db.setEnrichment('conn-1', 'users', null, 'User table');
      await db.setEnrichment('conn-1', 'orders', null, 'Order table');
      await db.setEnrichment('conn-1', 'users', 'email', 'Email');

      const enrichments = await db.getEnrichments('conn-1');
      expect(enrichments[0].table_name).toBe('orders');
      expect(enrichments[1].table_name).toBe('orders');
      expect(enrichments[2].table_name).toBe('users');
      expect(enrichments[3].table_name).toBe('users');
    });
  });
});
