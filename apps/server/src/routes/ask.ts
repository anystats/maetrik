import { Router, Request, Response } from 'express';
import type { DataSourceManager, LLMManager, QueryTranslator, SemanticLayer, StateDatabase } from '@maetrik/core';

export interface AskRouterOptions {
  dataSourceManager: DataSourceManager;
  llmManager: LLMManager;
  queryTranslator: QueryTranslator;
  semanticLayers: Map<string, SemanticLayer>;
  stateDb?: StateDatabase;
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

// Map data source type to SQL dialect
function getDialect(type: string): string {
  const dialectMap: Record<string, string> = {
    postgres: 'postgresql',
    mysql: 'mysql',
    sqlite: 'sqlite',
    mssql: 'mssql',
  };
  return dialectMap[type] || type;
}

// Convert array-based schema to record-based schema for semantic layer
interface ArraySchemaTable {
  name: string;
  schema: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    isPrimaryKey: boolean;
  }>;
}

interface ArraySchema {
  tables: ArraySchemaTable[];
}

interface RecordSchema {
  tables: Record<string, {
    name: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      primaryKey?: boolean;
    }>;
  }>;
}

function convertSchemaFormat(arraySchema: ArraySchema): RecordSchema {
  const tables: RecordSchema['tables'] = {};
  for (const table of arraySchema.tables) {
    tables[table.name] = {
      name: table.name,
      columns: table.columns.map((col) => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable,
        primaryKey: col.isPrimaryKey,
      })),
    };
  }
  return { tables };
}

export function createAskRouter(options: AskRouterOptions): Router {
  const router = Router();
  const { dataSourceManager, queryTranslator, semanticLayers } = options;

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

    // Check connection exists first (without creating driver)
    if (!(await dataSourceManager.hasConnection(connection))) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: `Connection '${connection}' not found`,
        },
      });
      return;
    }

    // Check if connection is enabled (only for database-stored connections)
    if (options.stateDb) {
      const dbConnection = await options.stateDb.getConnection(connection);
      if (dbConnection && !dbConnection.enabled) {
        res.status(400).json({
          success: false,
          error: {
            code: 'CONNECTION_DISABLED',
            message: 'Connection is disabled',
          },
        });
        return;
      }
    }

    let dataSource;
    try {
      dataSource = await dataSourceManager.connectById(connection);
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
      // Check capabilities
      if (!dataSource.isQueryable()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NOT_SUPPORTED',
            message: 'This data source does not support queries',
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

      const startTime = Date.now();

      // Get schema (from semantic layer if available, otherwise introspect)
      let semanticLayer = semanticLayers.get(connection);
      if (!semanticLayer) {
        const { createSemanticLayer } = await import('@maetrik/core');
        const rawSchema = await dataSource.introspect();
        const convertedSchema = convertSchemaFormat(rawSchema as ArraySchema);
        semanticLayer = createSemanticLayer(convertedSchema);
        semanticLayer.inferRelationships();
        semanticLayers.set(connection, semanticLayer);
      }

      const schema = semanticLayer.toSchemaDefinition();
      const dialect = getDialect(dataSource.type);

      // Translate natural language to SQL
      const translation = await queryTranslator.translate(question, {
        schema,
        dialect,
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
      const result = await dataSource.execute(translation.sql);
      const duration = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          columns: result.fields.map((f: { name: string }) => f.name),
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
    } finally {
      // Always shutdown the driver
      await dataSource.shutdown();
    }
  });

  return router;
}
