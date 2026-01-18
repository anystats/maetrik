import { Router, Request, Response } from 'express';
import type { DataSourceManager } from '@maetrik/core';

export interface DataSourcesRouterOptions {
  dataSourceManager: DataSourceManager;
}

export function createDataSourcesRouter(options: DataSourcesRouterOptions): Router {
  const router = Router();
  const { dataSourceManager } = options;

  // GET /api/v1/datasources - List all data sources
  router.get('/', (_req: Request, res: Response) => {
    const configs = dataSourceManager.listConfigs();

    // Don't expose credentials in response
    const sanitized = configs.map(({ id, type }) => ({ id, type }));

    res.json({
      success: true,
      data: sanitized,
    });
  });

  // GET /api/v1/datasources/:id/schema - Get schema for a data source
  router.get('/:id/schema', async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const driver = await dataSourceManager.get(id);

      if (!driver) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Data source '${id}' not found`,
          },
        });
        return;
      }

      if (!driver.isIntrospectable()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NOT_INTROSPECTABLE',
            message: `Data source '${id}' does not support schema introspection`,
          },
        });
        return;
      }

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

  // POST /api/v1/datasources/:id/query - Execute a query
  router.post('/:id/query', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { sql, params } = req.body;

    if (!sql || typeof sql !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing or invalid "sql" field',
        },
      });
      return;
    }

    try {
      const driver = await dataSourceManager.get(id);

      if (!driver) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Data source '${id}' not found`,
          },
        });
        return;
      }

      if (!driver.isQueryable()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NOT_QUERYABLE',
            message: `Data source '${id}' does not support queries`,
          },
        });
        return;
      }

      const result = await driver.execute(sql, params);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'QUERY_ERROR',
          message: error instanceof Error ? error.message : 'Failed to execute query',
        },
      });
    }
  });

  return router;
}
