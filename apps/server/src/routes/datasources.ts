import { Router, Request, Response } from 'express';
import type { DataSourceManager } from '@maetrik/core';

export interface DataSourcesRouterOptions {
  dataSourceManager: DataSourceManager;
}

export function createDataSourcesRouter(options: DataSourcesRouterOptions): Router {
  const router = Router();
  const { dataSourceManager } = options;

  // GET /api/v1/datasources/types - List available data source types
  router.get('/types', (_req: Request, res: Response) => {
    const types = dataSourceManager.listTypes().map((t) => ({
      type: t.type,
      name: t.displayName,
      description: t.description,
      image: t.icon,
    }));
    res.json({ success: true, data: types });
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
