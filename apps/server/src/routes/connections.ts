import { Router, Request, Response } from 'express';
import type { DataSourceManager } from '@maetrik/core';

export interface ConnectionsRouterOptions {
  dataSourceManager: DataSourceManager;
}

export function createConnectionsRouter(options: ConnectionsRouterOptions): Router {
  const router = Router();
  const { dataSourceManager } = options;

  // GET /api/v1/connections - List all data sources (connections)
  router.get('/', (_req: Request, res: Response) => {
    const configs = dataSourceManager.listConfigs();
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
  router.get('/:name', (req: Request, res: Response) => {
    const { name } = req.params;
    const config = dataSourceManager.getConfig(name);

    if (!config) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: `Connection '${name}' not found`,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        name: config.id,
        type: config.type,
      },
    });
  });

  // GET /api/v1/connections/:name/health - Check connection health
  router.get('/:name/health', async (req: Request, res: Response) => {
    const { name } = req.params;
    const config = dataSourceManager.getConfig(name);

    if (!config) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: `Connection '${name}' not found`,
        },
      });
      return;
    }

    try {
      const dataSource = await dataSourceManager.get(name);
      if (!dataSource) {
        res.json({
          success: true,
          data: { healthy: false },
        });
        return;
      }

      if (dataSource.isHealthCheckable()) {
        const healthy = await dataSource.healthCheck();
        res.json({
          success: true,
          data: { healthy },
        });
      } else {
        // Data source doesn't support health checks
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
    }
  });

  // GET /api/v1/connections/:name/schema - Get schema
  router.get('/:name/schema', async (req: Request, res: Response) => {
    const { name } = req.params;
    const dataSource = await dataSourceManager.get(name);

    if (!dataSource) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: `Connection '${name}' not found`,
        },
      });
      return;
    }

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

    try {
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
    }
  });

  return router;
}
