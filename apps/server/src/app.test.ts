import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

// Mock core modules
vi.mock('@maetrik/core', () => ({
  createDriverRegistry: vi.fn(() => ({
    register: vi.fn(),
    get: vi.fn(),
    list: vi.fn(() => []),
    createDriver: vi.fn(),
  })),
  createDriverManager: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getDriver: vi.fn(() => undefined),
    healthCheck: vi.fn().mockResolvedValue(false),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
  postgresDriverFactory: { name: 'postgres', dialect: 'postgresql', create: vi.fn() },
  createLLMRegistry: vi.fn(() => ({
    register: vi.fn(),
    get: vi.fn(),
    list: vi.fn(() => []),
    createDriver: vi.fn(),
  })),
  createLLMManager: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getDriver: vi.fn(() => undefined),
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

describe('Server App', () => {
  const mockDriverManager = {
    initialize: vi.fn().mockResolvedValue(undefined),
    getDriver: vi.fn(() => undefined),
    healthCheck: vi.fn().mockResolvedValue(false),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
  const app = createApp({ driverManager: mockDriverManager as any });

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
      });
    });
  });

  describe('GET /api/v1/health', () => {
    it('returns 200 with detailed status', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        version: expect.any(String),
        uptime: expect.any(Number),
      });
    });
  });

  describe('Unknown routes', () => {
    it('returns 404 for unknown paths', async () => {
      const response = await request(app).get('/unknown');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: expect.any(String),
        },
      });
    });
  });
});
