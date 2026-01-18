import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import type { Express } from 'express';
import type { DataSourceManager, DataSourceDriver } from '@maetrik/core';

// Mock core modules
vi.mock('@maetrik/core', () => ({
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

const createMockDataSource = (): DataSourceDriver => ({
  name: 'main',
  type: 'postgres',
  init: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
  capabilities: () => ({
    queryable: true,
    introspectable: true,
    healthCheckable: true,
    transactional: true,
  }),
  isQueryable: (() => true) as DataSourceDriver['isQueryable'],
  isIntrospectable: (() => true) as DataSourceDriver['isIntrospectable'],
  isHealthCheckable: (() => true) as DataSourceDriver['isHealthCheckable'],
  isTransactional: (() => true) as DataSourceDriver['isTransactional'],
  healthCheck: vi.fn().mockResolvedValue(true),
  introspect: vi.fn().mockResolvedValue({ tables: [] }),
  execute: vi.fn().mockResolvedValue({
    rows: [{ count: 42 }],
    rowCount: 1,
    fields: [{ name: 'count' }],
  }),
});

describe('Query API', () => {
  let app: Express;
  let mockDataSource: ReturnType<typeof createMockDataSource>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataSource = createMockDataSource();

    const mockDataSourceManager: DataSourceManager = {
      addConfig: vi.fn(),
      removeConfig: vi.fn(),
      getConfig: vi.fn((id: string) =>
        id === 'main' ? { id: 'main', type: 'postgres', credentials: {} } : undefined
      ),
      listConfigs: vi.fn(() => [{ id: 'main', type: 'postgres', credentials: {} }]),
      get: vi.fn((id: string) => {
        if (id === 'main') {
          return Promise.resolve(mockDataSource);
        }
        return Promise.resolve(undefined);
      }),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    app = createApp({
      dataSourceManager: mockDataSourceManager,
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
