import { Router, Request, Response } from 'express';
import type { SchemeManager, DataSourceManager } from '@maetrik/core';
import { z } from 'zod';

const enrichmentSchema = z.object({
  tableName: z.string().min(1),
  columnName: z.string().min(1).optional(),
  description: z.string().min(1),
});

const deleteEnrichmentSchema = z.object({
  tableName: z.string().min(1),
  columnName: z.string().min(1).optional(),
});

export interface SchemesRouterOptions {
  schemeManager: SchemeManager;
  dataSourceManager: DataSourceManager;
}

export function createSchemesRouter(options: SchemesRouterOptions): Router {
  const router = Router();
  const { schemeManager, dataSourceManager } = options;

  // GET /:id/scheme
  router.get('/:id/scheme', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!(await dataSourceManager.hasConnection(id))) {
      res.status(404).json({
        success: false,
        error: { code: 'CONNECTION_NOT_FOUND', message: `Connection '${id}' not found` },
      });
      return;
    }
    try {
      const schema = await schemeManager.getEnrichedSchema(id);
      res.json({ success: true, data: schema });
    } catch {
      res.status(404).json({
        success: false,
        error: { code: 'SCHEME_NOT_FOUND', message: `No active scheme for connection '${id}'` },
      });
    }
  });

  // POST /:id/scheme/sync
  router.post('/:id/scheme/sync', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!(await dataSourceManager.hasConnection(id))) {
      res.status(404).json({
        success: false,
        error: { code: 'CONNECTION_NOT_FOUND', message: `Connection '${id}' not found` },
      });
      return;
    }
    try {
      const result = await schemeManager.sync(id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SYNC_ERROR',
          message: error instanceof Error ? error.message : 'Failed to sync scheme',
        },
      });
    }
  });

  // PUT /:id/scheme/enrichments
  router.put('/:id/scheme/enrichments', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!(await dataSourceManager.hasConnection(id))) {
      res.status(404).json({
        success: false,
        error: { code: 'CONNECTION_NOT_FOUND', message: `Connection '${id}' not found` },
      });
      return;
    }
    const parsed = enrichmentSchema.safeParse(req.body);
    if (!parsed.success) {
      const flattened = parsed.error.flatten();
      const firstFieldError = Object.values(flattened.fieldErrors)[0];
      const message = firstFieldError?.[0] ?? 'Validation failed';
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message, details: flattened },
      });
      return;
    }
    const { tableName, columnName, description } = parsed.data;
    await schemeManager.setDescription(id, tableName, columnName ?? null, description);
    res.json({ success: true, data: { tableName, columnName: columnName ?? null, description } });
  });

  // DELETE /:id/scheme/enrichments
  router.delete('/:id/scheme/enrichments', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!(await dataSourceManager.hasConnection(id))) {
      res.status(404).json({
        success: false,
        error: { code: 'CONNECTION_NOT_FOUND', message: `Connection '${id}' not found` },
      });
      return;
    }
    const parsed = deleteEnrichmentSchema.safeParse(req.body);
    if (!parsed.success) {
      const flattened = parsed.error.flatten();
      const firstFieldError = Object.values(flattened.fieldErrors)[0];
      const message = firstFieldError?.[0] ?? 'Validation failed';
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message, details: flattened },
      });
      return;
    }
    const { tableName, columnName } = parsed.data;
    await schemeManager.removeDescription(id, tableName, columnName ?? null);
    res.json({ success: true, data: { deleted: true } });
  });

  return router;
}
