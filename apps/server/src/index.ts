import { createApp, getAppContext } from './app.js';
import { loadConfig, createLogger } from '@maetrik/shared';
import { createDriverManagerFromConfig, createDataSourceManagerFromConfig } from '@maetrik/core';

const logger = createLogger('server');

async function main() {
  const config = await loadConfig({ env: process.env as Record<string, string> });

  const driverManager = await createDriverManagerFromConfig(config.connections, logger);

  // Convert dataSources config to DataSourceConfig format
  const dataSourceConfigs = config.dataSources.map((ds) => ({
    id: ds.id,
    type: ds.type,
    credentials: ds.credentials,
  }));
  const dataSourceManager = await createDataSourceManagerFromConfig(dataSourceConfigs, logger);

  const app = createApp({
    connections: config.connections,
    dataSources: config.dataSources,
    llm: config.llm,
    driverManager,
    dataSourceManager,
  });

  const context = getAppContext(app);

  // Initialize all database connections
  try {
    logger.info('Initializing database connections...');
    await driverManager.initialize();
    logger.info('Database connections initialized');
  } catch (error) {
    logger.error('Failed to initialize database connections', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Continue without database - health checks will show unhealthy
  }

  // Initialize LLM
  if (config.llm?.driver) {
    try {
      logger.info('Initializing LLM driver...', { driver: config.llm.driver, model: config.llm.model });
      await context.llmManager.initialize({
        driver: config.llm.driver,
        model: config.llm.model,
        baseUrl: config.llm.baseUrl,
        apiKey: config.llm.apiKey,
      });
      logger.info('LLM driver initialized');
    } catch (error) {
      logger.error('Failed to initialize LLM driver', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue without LLM - ask endpoint will fail gracefully
    }
  } else {
    logger.warn('No LLM configuration provided, /api/v1/ask endpoint will not work');
  }

  const { port, host } = config.server;

  const server = app.listen(port, host, () => {
    logger.info(`Server listening on http://${host}:${port}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down server...');

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await context.llmManager.shutdown();
        logger.info('LLM driver closed');
      } catch (error) {
        logger.warn('Error shutting down LLM', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        await driverManager.shutdown();
        logger.info('Database connections closed');
      } catch (error) {
        logger.warn('Error shutting down database', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        await dataSourceManager.shutdown();
        logger.info('Data sources closed');
      } catch (error) {
        logger.warn('Error shutting down data sources', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});
