import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { SchemeManager, DataSourceManager } from '@maetrik/core';
import { createSchemesRouter } from './schemes.js';

function createMockDataSourceManager(knownIds: string[]): DataSourceManager {
  return {
    hasConnection: vi.fn(async (id: string) => knownIds.includes(id)),
  } as unknown as DataSourceManager;
}

function createMockSchemeManager(): SchemeManager & {
  sync: ReturnType<typeof vi.fn>;
  getEnrichedSchema: ReturnType<typeof vi.fn>;
  setDescription: ReturnType<typeof vi.fn>;
  removeDescription: ReturnType<typeof vi.fn>;
} {
  return {
    sync: vi.fn(),
    getEnrichedSchema: vi.fn(),
    setDescription: vi.fn(),
    removeDescription: vi.fn(),
  };
}

describe('schemes routes', () => {
  let app: express.Express;
  let schemeManager: ReturnType<typeof createMockSchemeManager>;
  let dataSourceManager: DataSourceManager;

  beforeEach(() => {
    schemeManager = createMockSchemeManager();
    dataSourceManager = createMockDataSourceManager(['test-db']);

    app = express();
    app.use(express.json());
    app.use(
      '/api/v1/connections',
      createSchemesRouter({ schemeManager, dataSourceManager })
    );
  });

  describe('GET /:id/scheme', () => {
    it('returns enriched schema', async () => {
      const enrichedSchema = {
        connectionId: 'test-db',
        version: 'v1',
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', type: 'integer', nullable: false },
              { name: 'name', type: 'text', nullable: true, description: 'User full name' },
            ],
            description: 'Application users',
          },
        ],
      };
      schemeManager.getEnrichedSchema.mockResolvedValue(enrichedSchema);

      const res = await request(app).get('/api/v1/connections/test-db/scheme');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(enrichedSchema);
      expect(schemeManager.getEnrichedSchema).toHaveBeenCalledWith('test-db');
    });

    it('returns 404 when connection not found', async () => {
      const res = await request(app).get('/api/v1/connections/unknown/scheme');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONNECTION_NOT_FOUND');
    });

    it('returns 404 when no active scheme', async () => {
      schemeManager.getEnrichedSchema.mockRejectedValue(
        new Error("No active scheme for connection 'test-db'")
      );

      const res = await request(app).get('/api/v1/connections/test-db/scheme');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SCHEME_NOT_FOUND');
    });
  });

  describe('POST /:id/scheme/sync', () => {
    it('triggers sync and returns result', async () => {
      const syncResult = {
        changed: true,
        scheme: {
          id: 'scheme-1',
          connectionId: 'test-db',
          version: 'v1',
          tables: [{ name: 'users', columns: [{ name: 'id', type: 'integer', nullable: false }] }],
        },
      };
      schemeManager.sync.mockResolvedValue(syncResult);

      const res = await request(app).post('/api/v1/connections/test-db/scheme/sync');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(syncResult);
      expect(schemeManager.sync).toHaveBeenCalledWith('test-db');
    });

    it('returns 404 when connection not found', async () => {
      const res = await request(app).post('/api/v1/connections/unknown/scheme/sync');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONNECTION_NOT_FOUND');
    });

    it('returns 500 when sync fails', async () => {
      schemeManager.sync.mockRejectedValue(new Error('Introspection failed'));

      const res = await request(app).post('/api/v1/connections/test-db/scheme/sync');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SYNC_ERROR');
      expect(res.body.error.message).toBe('Introspection failed');
    });
  });

  describe('PUT /:id/scheme/enrichments', () => {
    it('sets table-level description', async () => {
      schemeManager.setDescription.mockResolvedValue(undefined);

      const res = await request(app)
        .put('/api/v1/connections/test-db/scheme/enrichments')
        .send({ tableName: 'users', description: 'Application users table' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        tableName: 'users',
        columnName: null,
        description: 'Application users table',
      });
      expect(schemeManager.setDescription).toHaveBeenCalledWith(
        'test-db', 'users', null, 'Application users table'
      );
    });

    it('sets column-level description', async () => {
      schemeManager.setDescription.mockResolvedValue(undefined);

      const res = await request(app)
        .put('/api/v1/connections/test-db/scheme/enrichments')
        .send({ tableName: 'users', columnName: 'email', description: 'Primary email address' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        tableName: 'users',
        columnName: 'email',
        description: 'Primary email address',
      });
      expect(schemeManager.setDescription).toHaveBeenCalledWith(
        'test-db', 'users', 'email', 'Primary email address'
      );
    });

    it('validates required fields', async () => {
      const res = await request(app)
        .put('/api/v1/connections/test-db/scheme/enrichments')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when connection not found', async () => {
      const res = await request(app)
        .put('/api/v1/connections/unknown/scheme/enrichments')
        .send({ tableName: 'users', description: 'test' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CONNECTION_NOT_FOUND');
    });
  });

  describe('DELETE /:id/scheme/enrichments', () => {
    it('removes table-level enrichment', async () => {
      schemeManager.removeDescription.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/v1/connections/test-db/scheme/enrichments')
        .send({ tableName: 'users' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ deleted: true });
      expect(schemeManager.removeDescription).toHaveBeenCalledWith('test-db', 'users', null);
    });

    it('removes column-level enrichment', async () => {
      schemeManager.removeDescription.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/v1/connections/test-db/scheme/enrichments')
        .send({ tableName: 'users', columnName: 'email' });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ deleted: true });
      expect(schemeManager.removeDescription).toHaveBeenCalledWith('test-db', 'users', 'email');
    });

    it('validates required fields', async () => {
      const res = await request(app)
        .delete('/api/v1/connections/test-db/scheme/enrichments')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when connection not found', async () => {
      const res = await request(app)
        .delete('/api/v1/connections/unknown/scheme/enrichments')
        .send({ tableName: 'users' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CONNECTION_NOT_FOUND');
    });
  });
});
