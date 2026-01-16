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
    getDriver: vi.fn((name: string) => {
      if (name === 'main') {
        return {
          name: 'postgres',
          dialect: 'postgresql',
          healthCheck: vi.fn().mockResolvedValue(true),
          introspect: vi.fn().mockResolvedValue({
            tables: {
              users: {
                name: 'users',
                columns: [
                  { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
                  { name: 'email', type: 'varchar', nullable: false },
                ],
              },
            },
          }),
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

describe('Ask API', () => {
  let app: Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mockDriverManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getDriver: vi.fn((name: string) => {
        if (name === 'main') {
          return {
            name: 'postgres',
            dialect: 'postgresql',
            healthCheck: vi.fn().mockResolvedValue(true),
            introspect: vi.fn().mockResolvedValue({
              tables: {
                users: {
                  name: 'users',
                  columns: [
                    { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
                    { name: 'email', type: 'varchar', nullable: false },
                  ],
                },
              },
            }),
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
      llm: {
        driver: 'ollama',
        model: 'llama3',
      },
      driverManager: mockDriverManager as any,
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
