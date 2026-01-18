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
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        sql: 'SELECT COUNT(*) as count FROM users',
        explanation: 'Counts all users in the database',
        confidence: 0.95,
        tables: ['users'],
      }),
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
  ollamaDriverFactory: { name: 'ollama', create: vi.fn() },
  openaiDriverFactory: { name: 'openai', create: vi.fn() },
  createQueryTranslator: vi.fn(() => ({
    translate: vi.fn().mockResolvedValue({
      sql: 'SELECT COUNT(*) as count FROM users',
      explanation: 'Counts all users',
      confidence: 0.95,
      suggestedTables: ['users'],
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
  introspect: vi.fn().mockResolvedValue({
    tables: [
      {
        name: 'users',
        schema: 'public',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true },
          { name: 'email', type: 'varchar', nullable: false, isPrimaryKey: false },
        ],
      },
    ],
  }),
  execute: vi.fn().mockResolvedValue({
    rows: [{ count: 42 }],
    rowCount: 1,
    fields: [{ name: 'count' }],
  }),
});

describe('Ask API', () => {
  let app: Express;
  let mockDataSource: ReturnType<typeof createMockDataSource>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDataSource = createMockDataSource();

    const mockDataSourceManager: DataSourceManager = {
      getConfig: vi.fn((id: string) =>
        id === 'main'
          ? Promise.resolve({ id: 'main', type: 'postgres', credentials: {} })
          : Promise.reject(new Error('Not found'))
      ),
      listConfigs: vi.fn().mockResolvedValue([{ id: 'main', type: 'postgres', credentials: {} }]),
      hasConnection: vi.fn((id: string) => Promise.resolve(id === 'main')),
      connect: vi.fn().mockResolvedValue(mockDataSource),
      connectById: vi.fn().mockResolvedValue(mockDataSource),
      canAddToDatabase: vi.fn().mockResolvedValue(true),
    };

    app = createApp({
      llm: {
        driver: 'ollama',
        model: 'llama3',
      },
      dataSourceManager: mockDataSourceManager,
    });
  });

  describe('POST /api/v1/ask', () => {
    it('translates natural language to SQL and executes', async () => {
      const response = await request(app)
        .post('/api/v1/ask')
        .send({
          question: 'How many users are there?',
          connection: 'main',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rows).toBeDefined();
      expect(response.body.meta.sql).toContain('SELECT');
    });

    it('returns 400 for missing question', async () => {
      const response = await request(app)
        .post('/api/v1/ask')
        .send({
          connection: 'main',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing connection', async () => {
      const response = await request(app)
        .post('/api/v1/ask')
        .send({
          question: 'How many users?',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('returns 404 for unknown connection', async () => {
      const response = await request(app)
        .post('/api/v1/ask')
        .send({
          question: 'How many users?',
          connection: 'unknown',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('includes explanation in response', async () => {
      const response = await request(app)
        .post('/api/v1/ask')
        .send({
          question: 'How many users are there?',
          connection: 'main',
        });

      expect(response.body.meta.explanation).toBeDefined();
    });

    it('includes confidence score', async () => {
      const response = await request(app)
        .post('/api/v1/ask')
        .send({
          question: 'How many users?',
          connection: 'main',
        });

      expect(response.body.meta.confidence).toBeGreaterThan(0);
    });
  });
});
