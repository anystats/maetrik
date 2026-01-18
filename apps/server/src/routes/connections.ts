import { Router, Request, Response } from 'express';
import type { DataSourceManager, StateDatabase } from '@maetrik/core';
import { z } from 'zod';

const createConnectionSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-z0-9-_]+$/i, 'ID must be alphanumeric with dashes/underscores'),
  type: z.string().min(1),
  credentials: z.record(z.string(), z.unknown()),
  name: z.string().optional(),
  description: z.string().optional(),
});

const updateConnectionSchema = z.object({
  credentials: z.record(z.string(), z.unknown()).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

export interface ConnectionsRouterOptions {
  dataSourceManager: DataSourceManager;
  stateDb?: StateDatabase;
}

export function createConnectionsRouter(options: ConnectionsRouterOptions): Router {
  const router = Router();
  const { dataSourceManager } = options;

  // GET /api/v1/connections - List all data sources (connections)
  router.get('/', async (_req: Request, res: Response) => {
    const configs = await dataSourceManager.listConfigs();
    const connectionList = configs.map((config) => ({
      name: config.id,
      type: config.type,
    }));

    res.json({
      success: true,
      data: connectionList,
    });
  });

  // GET /api/v1/connections/:name - Get connection details
  router.get('/:name', async (req: Request, res: Response) => {
    const { name } = req.params;

    try {
      const config = await dataSourceManager.getConfig(name);
      res.json({
        success: true,
        data: {
          name: config.id,
          type: config.type,
        },
      });
    } catch {
      res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: `Connection '${name}' not found`,
        },
      });
    }
  });

  // GET /api/v1/connections/:name/health - Check connection health
  router.get('/:name/health', async (req: Request, res: Response) => {
    const { name } = req.params;

    if (!(await dataSourceManager.hasConnection(name))) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: `Connection '${name}' not found`,
        },
      });
      return;
    }

    let dataSource;
    try {
      dataSource = await dataSourceManager.connectById(name);
    } catch {
      res.json({
        success: true,
        data: { healthy: false },
      });
      return;
    }

    try {
      if (dataSource.isHealthCheckable()) {
        const healthy = await dataSource.healthCheck();
        res.json({
          success: true,
          data: { healthy },
        });
      } else {
        res.json({
          success: true,
          data: { healthy: true, note: 'Health check not supported' },
        });
      }
    } catch {
      res.json({
        success: true,
        data: { healthy: false },
      });
    } finally {
      await dataSource.shutdown();
    }
  });

  // GET /api/v1/connections/:name/schema - Get schema
  router.get('/:name/schema', async (req: Request, res: Response) => {
    const { name } = req.params;

    if (!(await dataSourceManager.hasConnection(name))) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: `Connection '${name}' not found`,
        },
      });
      return;
    }

    let dataSource;
    try {
      dataSource = await dataSourceManager.connectById(name);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'CONNECTION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to connect',
        },
      });
      return;
    }

    try {
      if (!dataSource.isIntrospectable()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NOT_SUPPORTED',
            message: 'This data source does not support schema introspection',
          },
        });
        return;
      }

      const schema = await dataSource.introspect();
      res.json({
        success: true,
        data: schema,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTROSPECTION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to introspect schema',
        },
      });
    } finally {
      await dataSource.shutdown();
    }
  });

  return router;
}
