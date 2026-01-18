import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import type { Express } from 'express';
import type { DataSourceManager, DataSourceDriver } from '@maetrik/core';
import { PGLiteStateDatabase } from '@maetrik/core';

// Mock core modules (but not PGLiteStateDatabase)
vi.mock('@maetrik/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@maetrik/core')>();
  return {
    ...actual,
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
  };
});

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
  let mockDataSourceManager: DataSourceManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataSource = createMockDataSource();

    mockDataSourceManager = {
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
          id: 'main',
          type: 'postgres',
          enabled: true,  // File-config connections are always enabled
        })
      );
    });
  });

  describe('GET /api/v1/connections/:id', () => {
    it('returns connection details', async () => {
      const response = await request(app).get('/api/v1/connections/main');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('main');
      expect(response.body.data.type).toBe('postgres');
      expect(response.body.data.enabled).toBe(true);  // File-config connections are always enabled
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

  describe('POST /api/v1/connections', () => {
    let stateDb: PGLiteStateDatabase;

    beforeEach(async () => {
      stateDb = new PGLiteStateDatabase('memory://connections-test-create');
      await stateDb.initialize();
      await stateDb.execute('DELETE FROM connections');
    });

    afterEach(async () => {
      await stateDb.shutdown();
    });

    it('creates a new connection', async () => {
      const appWithDb = createApp({
        dataSourceManager: mockDataSourceManager,
        stateDb,
      });

      const response = await request(appWithDb)
        .post('/api/v1/connections')
        .send({
          id: 'new-db',
          type: 'postgres',
          credentials: { host: 'localhost', port: 5432 },
          name: 'New Database',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('new-db');
    });

    it('returns 400 for invalid input', async () => {
      const appWithDb = createApp({
        dataSourceManager: mockDataSourceManager,
        stateDb,
      });

      const response = await request(appWithDb)
        .post('/api/v1/connections')
        .send({ id: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('returns 409 when connection exists in file config', async () => {
      const appWithDb = createApp({
        dataSourceManager: {
          ...mockDataSourceManager,
          canAddToDatabase: vi.fn().mockResolvedValue(false),
        },
        stateDb,
      });

      const response = await request(appWithDb)
        .post('/api/v1/connections')
        .send({
          id: 'main',
          type: 'postgres',
          credentials: {},
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONNECTION_EXISTS');
    });

    it('returns 501 when stateDb not configured', async () => {
      const response = await request(app)
        .post('/api/v1/connections')
        .send({
          id: 'new-db',
          type: 'postgres',
          credentials: {},
        });

      expect(response.status).toBe(501);
      expect(response.body.error.code).toBe('NOT_IMPLEMENTED');
    });
  });
});
