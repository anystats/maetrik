import { Router, Request, Response } from 'express';
import type { DriverManager, LLMManager, QueryTranslator, SemanticLayer } from '@maetrik/core';

export interface AskRouterOptions {
  driverManager: DriverManager;
  llmManager: LLMManager;
  queryTranslator: QueryTranslator;
  semanticLayers: Map<string, SemanticLayer>;
}

function isSelectOnly(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();

  if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
    return false;
  }

  const dangerousKeywords = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
    'TRUNCATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE',
  ];

  for (const keyword of dangerousKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(sql)) {
      return false;
    }
  }

  return true;
}

export function createAskRouter(options: AskRouterOptions): Router {
  const router = Router();
  const { driverManager, llmManager, queryTranslator, semanticLayers } = options;

  router.post('/', async (req: Request, res: Response) => {
    const { question, connection } = req.body;

    // Validate required fields
    if (!question) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required field: question',
        },
      });
      return;
    }

    if (!connection) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required field: connection',
        },
      });
      return;
    }

    // Get driver
    const driver = driverManager.getDriver(connection);
    if (!driver) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: `Connection '${connection}' not found`,
        },
      });
      return;
    }

    try {
      const startTime = Date.now();

      // Get schema (from semantic layer if available, otherwise introspect)
      let semanticLayer = semanticLayers.get(connection);
      if (!semanticLayer) {
        // Import dynamically to avoid circular dependencies in tests
        const { createSemanticLayer } = await import('@maetrik/core');
        const rawSchema = await driver.introspect();
        semanticLayer = createSemanticLayer(rawSchema);
        semanticLayer.inferRelationships();
        semanticLayers.set(connection, semanticLayer);
      }

      const schema = semanticLayer.toSchemaDefinition();

      // Translate natural language to SQL
      const translation = await queryTranslator.translate(question, {
        schema,
        dialect: driver.dialect,
        maxRows: 1000,
      });

      // Validate generated SQL is SELECT-only
      if (!isSelectOnly(translation.sql)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_QUERY',
            message: 'Generated query is not a SELECT statement',
          },
        });
        return;
      }

      // Execute the query
      const result = await driver.execute(translation.sql);
      const duration = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          columns: result.columns,
          rows: result.rows,
          rowCount: result.rowCount,
        },
        meta: {
          question,
          sql: translation.sql,
          explanation: translation.explanation,
          confidence: translation.confidence,
          tables: translation.suggestedTables,
          duration,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'QUERY_ERROR',
          message: error instanceof Error ? error.message : 'Failed to process question',
        },
      });
    }
  });

  return router;
}
