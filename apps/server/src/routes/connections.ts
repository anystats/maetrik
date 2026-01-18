import { Router, Request, Response } from 'express';
import type { DataSourceManager } from '@maetrik/core';

export interface ConnectionsRouterOptions {
  dataSourceManager: DataSourceManager;
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
