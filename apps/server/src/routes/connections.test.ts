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
  introspect: vi.fn().mockResolvedValue({
    tables: [
      {
        name: 'users',
        schema: 'public',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true },
        ],
      },
    ],
  }),
  execute: vi.fn().mockResolvedValue({
    rows: [],
    rowCount: 0,
    fields: [],
  }),
});

describe('Connections API', () => {
  let app: Express;
  let mockDataSource: ReturnType<typeof createMockDataSource>;

  beforeEach(() => {
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
      dataSourceManager: mockDataSourceManager,
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
          type: 'postgres',
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
      expect(response.body.data.type).toBe('postgres');
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
      expect(response.body.data.tables).toHaveLength(1);
      expect(response.body.data.tables[0].name).toBe('users');
    });
  });
});
