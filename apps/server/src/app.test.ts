import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import type { DriverManager } from '@maetrik/core';

describe('Server App', () => {
  const driverManager: DriverManager = {
    initialize: async () => {},
    getDriver: () => undefined,
    healthCheck: async () => false,
    shutdown: async () => {},
  };
  const app = createApp({ driverManager });

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
