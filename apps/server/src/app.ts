import express, { Request, Response, NextFunction } from 'express';
import type { ConnectionConfig } from '@maetrik/shared';
import {
  createDriverRegistry,
  createDriverManager,
  postgresDriverFactory,
  type DriverManager,
} from '@maetrik/core';
import { createConnectionsRouter } from './routes/connections.js';

const startTime = Date.now();

export interface AppOptions {
  connections?: Record<string, ConnectionConfig>;
}

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();
  const { connections = {} } = options;

  // Setup driver registry and manager
  const registry = createDriverRegistry();
  registry.register(postgresDriverFactory);

  const driverManager = createDriverManager(registry, { connections });

  app.use(express.json());

  // Store driver manager on app for access in routes
  app.set('driverManager', driverManager);

  // Simple health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Detailed health check
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: '0.0.1',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  // Connections API
  app.use(
    '/api/v1/connections',
    createConnectionsRouter({ connections, driverManager })
  );

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found',
      },
    });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  return app;
}

export function getDriverManager(app: express.Express): DriverManager {
  return app.get('driverManager') as DriverManager;
}
