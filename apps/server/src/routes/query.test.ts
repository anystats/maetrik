import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import type { Express } from 'express';

// Mock the driver manager
vi.mock('@maetrik/core', () => ({
  createDriverRegistry: vi.fn(() => ({
    register: vi.fn(),
    get: vi.fn(),
    list: vi.fn(() => ['postgres']),
    createDriver: vi.fn(),
  })),
  createDriverManager: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getDriver: vi.fn((name: string) => {
      if (name === 'main') {
        return {
          name: 'postgres',
          dialect: 'postgresql',
          execute: vi.fn().mockResolvedValue({
            columns: ['count'],
            rows: [{ count: 42 }],
            rowCount: 1,
          }),
        };
      }
      return undefined;
    }),
    healthCheck: vi.fn().mockResolvedValue(true),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
  postgresDriverFactory: {
    name: 'postgres',
    dialect: 'postgresql',
    create: vi.fn(),
  },
}));

describe('Query API', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp({
      connections: {
        main: {
          driver: 'postgres',
          host: 'localhost',
          port: 5432,
          database: 'test',
        },
      },
    });
  });

  describe('POST /api/v1/query', () => {
    it('executes SQL query and returns results', async () => {
      const response = await request(app)
        .post('/api/v1/query')
        .send({
          connection: 'main',
          sql: 'SELECT COUNT(*) as count FROM users',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.columns).toContain('count');
      expect(response.body.data.rows[0].count).toBe(42);
    });

    it('returns 400 for missing connection', async () => {
      const response = await request(app)
        .post('/api/v1/query')
        .send({
          sql: 'SELECT 1',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing sql', async () => {
      const response = await request(app)
        .post('/api/v1/query')
        .send({
          connection: 'main',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('returns 404 for unknown connection', async () => {
      const response = await request(app)
        .post('/api/v1/query')
        .send({
          connection: 'unknown',
          sql: 'SELECT 1',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONNECTION_NOT_FOUND');
    });

    it('rejects non-SELECT queries', async () => {
      const response = await request(app)
        .post('/api/v1/query')
        .send({
          connection: 'main',
          sql: 'DELETE FROM users',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_QUERY');
    });
  });
});
