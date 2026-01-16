import { Router, Request, Response } from 'express';
import type { ConnectionConfig } from '@maetrik/shared';
import type { DriverManager } from '@maetrik/core';

export interface ConnectionsRouterOptions {
  connections: Record<string, ConnectionConfig>;
  driverManager: DriverManager;
}

export function createConnectionsRouter(options: ConnectionsRouterOptions): Router {
  const router = Router();
  const { connections, driverManager } = options;

  // GET /api/v1/connections - List all connections
  router.get('/', (_req: Request, res: Response) => {
    const connectionList = Object.entries(connections).map(([name, config]) => ({
      name,
      driver: config.driver,
      host: config.host,
      port: config.port,
      database: config.database,
    }));

    res.json({
      success: true,
      data: connectionList,
    });
  });

  // GET /api/v1/connections/:name - Get connection details
  router.get('/:name', (req: Request, res: Response) => {
    const { name } = req.params;
    const config = connections[name];

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
        name,
        driver: config.driver,
        host: config.host,
        port: config.port,
        database: config.database,
      },
    });
  });

  // GET /api/v1/connections/:name/health - Check connection health
  router.get('/:name/health', async (req: Request, res: Response) => {
    const { name } = req.params;
    const config = connections[name];

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
      const healthy = await driverManager.healthCheck(name);
      res.json({
        success: true,
        data: { healthy },
      });
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
    const driver = driverManager.getDriver(name);

    if (!driver) {
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
      const schema = await driver.introspect();
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
