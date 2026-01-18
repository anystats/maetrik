import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createDataSourcesRouter } from './datasources.js';
import type { DataSourceManager } from '@maetrik/core';
import type { DataSourceConfig
} from '@maetrik/shared';

const mockDataSourceManager: DataSourceManager = {
  addConfig: vi.fn(),
  removeConfig: vi.fn(),
  getConfig: vi.fn(),
  listConfigs: vi.fn(),
  get: vi.fn(),
  shutdown: vi.fn(),
};

describe('Data Sources Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/v1/datasources', createDataSourcesRouter({ dataSourceManager: mockDataSourceManager }));
  });

  describe('GET /api/v1/datasources', () => {
    it('returns list of configured data sources', async () => {
      const configs: DataSourceConfig[] = [
        { id: 'ds-1', type: 'postgres', credentials: { host: 'localhost' } },
        { id: 'ds-2', type: 'postgres', credentials: { host: 'remote' } },
      ];
      vi.mocked(mockDataSourceManager.listConfigs).mockReturnValue(configs);

      const res = await request(app).get('/api/v1/datasources');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].id).toBe('ds-1');
    });

    it('returns empty array when no data sources configured', async () => {
      vi.mocked(mockDataSourceManager.listConfigs).mockReturnValue([]);

      const res = await request(app).get('/api/v1/datasources');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/v1/datasources/:id/schema', () => {
    it('returns schema for data source', async () => {
      const mockDriver = {
        isIntrospectable: () => true,
        introspect: vi.fn().mockResolvedValue({
          tables: [{ name: 'users', schema: 'public', columns: [] }],
        }),
      };
      vi.mocked(mockDataSourceManager.get).mockResolvedValue(mockDriver as any);

      const res = await request(app).get('/api/v1/datasources/ds-1/schema');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tables).toHaveLength(1);
    });

    it('returns 404 for unknown data source', async () => {
      vi.mocked(mockDataSourceManager.get).mockResolvedValue(undefined);

      const res = await request(app).get('/api/v1/datasources/unknown/schema');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 if data source is not introspectable', async () => {
      const mockDriver = {
        isIntrospectable: () => false,
      };
      vi.mocked(mockDataSourceManager.get).mockResolvedValue(mockDriver as any);

      const res = await request(app).get('/api/v1/datasources/ds-1/schema');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NOT_INTROSPECTABLE');
    });
  });

  describe('POST /api/v1/datasources/:id/query', () => {
    it('executes query and returns results', async () => {
      const mockDriver = {
        isQueryable: () => true,
        execute: vi.fn().mockResolvedValue({
          rows: [{ id: 1, name: 'test' }],
          rowCount: 1,
          fields: [{ name: 'id' }, { name: 'name' }],
        }),
      };
      vi.mocked(mockDataSourceManager.get).mockResolvedValue(mockDriver as any);

      const res = await request(app)
        .post('/api/v1/datasources/ds-1/query')
        .send({ sql: 'SELECT * FROM users' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rows).toHaveLength(1);
    });

    it('returns 404 for unknown data source', async () => {
      vi.mocked(mockDataSourceManager.get).mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/v1/datasources/unknown/query')
        .send({ sql: 'SELECT 1' });

      expect(res.status).toBe(404);
    });

    it('returns 400 if data source is not queryable', async () => {
      const mockDriver = {
        isQueryable: () => false,
      };
      vi.mocked(mockDataSourceManager.get).mockResolvedValue(mockDriver as any);

      const res = await request(app)
        .post('/api/v1/datasources/ds-1/query')
        .send({ sql: 'SELECT 1' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NOT_QUERYABLE');
    });

    it('returns 400 if sql is missing', async () => {
      const res = await request(app)
        .post('/api/v1/datasources/ds-1/query')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    });
  });
});
