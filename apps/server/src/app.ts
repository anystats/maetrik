import express, { Request, Response, NextFunction } from 'express';
import type { ConnectionConfig, LLMConfig, DataSourceConfig } from '@maetrik/shared';
import {
  createLLMRegistry,
  createLLMManager,
  ollamaDriverFactory,
  openaiDriverFactory,
  createQueryTranslator,
  type DriverManager,
  type LLMManager,
  type QueryTranslator,
  type SemanticLayer,
  type DataSourceManager,
} from '@maetrik/core';
import { createConnectionsRouter } from './routes/connections.js';
import { createQueryRouter } from './routes/query.js';
import { createAskRouter } from './routes/ask.js';
import { createDataSourcesRouter } from './routes/datasources.js';

const startTime = Date.now();

export interface AppOptions {
  connections?: Record<string, ConnectionConfig>;
  dataSources?: DataSourceConfig[];
  llm?: LLMConfig;
  driverManager: DriverManager;
  dataSourceManager?: DataSourceManager;
}

export interface AppContext {
  driverManager: DriverManager;
  dataSourceManager?: DataSourceManager;
  llmManager: LLMManager;
  queryTranslator: QueryTranslator;
  semanticLayers: Map<string, SemanticLayer>;
}

export function createApp(options: AppOptions): express.Express {
  const app = express();
  const { connections = {}, dataSources = [], llm, driverManager, dataSourceManager } = options;

  // Setup LLM registry and manager
  const llmRegistry = createLLMRegistry();
  llmRegistry.register(ollamaDriverFactory);
  llmRegistry.register(openaiDriverFactory);

  const llmManager = createLLMManager(llmRegistry);

  // Create query translator (will be initialized when LLM is ready)
  const queryTranslator = createQueryTranslator(llmManager);

  // Semantic layers cache (per connection)
  const semanticLayers = new Map<string, SemanticLayer>();

  // Store context on app
  const context: AppContext = {
    driverManager,
    dataSourceManager,
    llmManager,
    queryTranslator,
    semanticLayers,
  };
  app.set('context', context);

  app.use(express.json());

  // Simple health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Detailed health check
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: '0.0.1',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  // Connections API
  app.use(
    '/api/v1/connections',
    createConnectionsRouter({ connections, driverManager })
  );

  // Query API (raw SQL)
  app.use(
    '/api/v1/query',
    createQueryRouter({ driverManager })
  );

  // Ask API (natural language)
  app.use(
    '/api/v1/ask',
    createAskRouter({ driverManager, llmManager, queryTranslator, semanticLayers })
  );

  // Data Sources API (new architecture)
  if (dataSourceManager) {
    app.use(
      '/api/v1/datasources',
      createDataSourcesRouter({ dataSourceManager })
    );
  }

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found',
      },
    });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  return app;
}

export function getAppContext(app: express.Express): AppContext {
  return app.get('context') as AppContext;
}

// Keep backward compatibility
export function getDriverManager(app: express.Express): DriverManager {
  return getAppContext(app).driverManager;
}
