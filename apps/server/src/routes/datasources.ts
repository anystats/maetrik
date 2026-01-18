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

  return router;
}
