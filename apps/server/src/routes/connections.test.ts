import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import type { Express } from 'express';

// Mock core modules
vi.mock('@maetrik/core', () => ({
  createDriverRegistry: vi.fn(() => ({
    register: vi.fn(),
    get: vi.fn(),
    list: vi.fn(() => ['postgres']),
    createDriver: vi.fn(),
  })),
  createDriverManager: vi.fn(() => ({
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
  })),
  postgresDriverFactory: { name: 'postgres', dialect: 'postgresql', create: vi.fn() },
  createLLMRegistry: vi.fn(() => ({
    register: vi.fn(),
    get: vi.fn(),
    list: vi.fn(() => ['ollama']),
    createDriver: vi.fn(),
  })),
  createLLMManager: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getDriver: vi.fn(() => ({ name: 'ollama' })),
    complete: vi.fn().mockResolvedValue({ content: '' }),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
  ollamaDriverFactory: { name: 'ollama', create: vi.fn() },
  openaiDriverFactory: { name: 'openai', create: vi.fn() },
  createQueryTranslator: vi.fn(() => ({
    translate: vi.fn().mockResolvedValue({
      sql: 'SELECT 1',
      explanation: 'Test',
      confidence: 1,
      suggestedTables: [],
    }),
  })),
  createSemanticLayer: vi.fn(() => ({
    getSchema: vi.fn().mockReturnValue({ tables: {} }),
    toSchemaDefinition: vi.fn().mockReturnValue({ tables: {} }),
    inferRelationships: vi.fn(),
  })),
}));

describe('Connections API', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockDriverManager = {
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
      driverManager: mockDriverManager as any,
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
