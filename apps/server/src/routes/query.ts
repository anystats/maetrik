import { Router, Request, Response } from 'express';
import type { DriverManager } from '@maetrik/core';

export interface QueryRouterOptions {
  driverManager: DriverManager;
}

// Simple SQL validation - only allow SELECT
function isSelectOnly(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();

  // Check if it starts with SELECT or WITH (for CTEs)
  if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
    return false;
  }

  // Check for dangerous keywords
  const dangerousKeywords = [
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'CREATE',
    'ALTER',
    'TRUNCATE',
    'GRANT',
    'REVOKE',
    'EXEC',
    'EXECUTE',
  ];

  for (const keyword of dangerousKeywords) {
    // Check for keyword as whole word (not part of column name)
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(sql)) {
      return false;
    }
  }

  return true;
}

export function createQueryRouter(options: QueryRouterOptions): Router {
  const router = Router();
  const { driverManager } = options;

  // POST /api/v1/query - Execute SQL query
  router.post('/', async (req: Request, res: Response) => {
    const { connection, sql, params } = req.body;

    // Validate required fields
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

    if (!sql) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required field: sql',
        },
      });
      return;
    }

    // Validate SELECT-only
    if (!isSelectOnly(sql)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Only SELECT queries are allowed',
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

    // Execute query
    try {
      const startTime = Date.now();
      const result = await driver.execute(sql, params);
      const duration = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          columns: result.columns,
          rows: result.rows,
          rowCount: result.rowCount,
        },
        meta: {
          sql,
          duration,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'QUERY_ERROR',
          message: error instanceof Error ? error.message : 'Query execution failed',
        },
      });
    }
  });

  return router;
}
