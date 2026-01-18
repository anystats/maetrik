import { Router, Request, Response } from 'express';
import type { DataSourceManager, DataSourceRegistry } from '@maetrik/core';

export interface DataSourcesRouterOptions {
  dataSourceManager: DataSourceManager;
  registry?: DataSourceRegistry;
}

export function createDataSourcesRouter(options: DataSourcesRouterOptions): Router {
  const router = Router();
  const { dataSourceManager, registry } = options;

  // GET /api/v1/datasources/types - List available data source types
  router.get('/types', (_req: Request, res: Response) => {
    if (registry) {
      const factories = registry.list();
      const types = factories.map((f) => ({
        type: f.type,
        label: f.type.charAt(0).toUpperCase() + f.type.slice(1),
      }));
      res.json({ success: true, data: types });
    } else {
      // Fallback to known types if registry not provided
      res.json({
        success: true,
        data: [
          { type: 'postgres', label: 'PostgreSQL' },
        ],
      });
    }
  });

  // GET /api/v1/datasources - List all data sources
  router.get('/', async (_req: Request, res: Response) => {
    const configs = await dataSourceManager.listConfigs();

    // Don't expose credentials in response
    const sanitized = configs.map(({ id, type }) => ({ id, type }));

    res.json({
      success: true,
      data: sanitized,
    });
  });

  return router;
}
