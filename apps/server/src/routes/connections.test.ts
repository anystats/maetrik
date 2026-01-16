import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import type { Express } from 'express';
import type { DriverManager } from '@maetrik/core';

describe('Connections API', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    const driverManager: DriverManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getDriver: vi.fn(() => ({
        name: 'postgres',
        dialect: 'postgresql',
        healthCheck: vi.fn().mockResolvedValue(true),
        introspect: vi.fn().mockResolvedValue({
          tables: {
            users: {
              name: 'users',
              columns: [
                { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
              ],
            },
          },
        }),
      })),
      healthCheck: vi.fn().mockResolvedValue(true),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
    app = createApp({
      connections: {
        main: {
          driver: 'postgres',
          host: 'localhost',
          port: 5432,
          database: 'test',
        },
      },
      driverManager,
    });
  });

  describe('GET /api/v1/connections', () => {
    it('returns list of configured connections', async () => {
      const response = await request(app).get('/api/v1/connections');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toContainEqual(
        expect.objectContaining({
          name: 'main',
          driver: 'postgres',
        })
      );
    });
  });

  describe('GET /api/v1/connections/:name', () => {
    it('returns connection details', async () => {
      const response = await request(app).get('/api/v1/connections/main');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('main');
      expect(response.body.data.driver).toBe('postgres');
    });

    it('returns 404 for unknown connection', async () => {
      const response = await request(app).get('/api/v1/connections/unknown');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/connections/:name/health', () => {
    it('returns health status for connection', async () => {
      const response = await request(app).get('/api/v1/connections/main/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.healthy).toBe(true);
    });
  });

  describe('GET /api/v1/connections/:name/schema', () => {
    it('returns schema for connection', async () => {
      const response = await request(app).get('/api/v1/connections/main/schema');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tables).toHaveProperty('users');
    });
  });
});
