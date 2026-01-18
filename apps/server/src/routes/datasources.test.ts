import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createDataSourcesRouter } from './datasources.js';
import type { DataSourceManager } from '@maetrik/core';
import type { DataSourceConfig } from '@maetrik/shared';

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
      // Credentials should not be exposed
      expect(res.body.data[0].credentials).toBeUndefined();
    });

    it('returns empty array when no data sources configured', async () => {
      vi.mocked(mockDataSourceManager.listConfigs).mockReturnValue([]);

      const res = await request(app).get('/api/v1/datasources');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });
});
