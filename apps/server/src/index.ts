import { createApp, getAppContext } from './app.js';
import { loadConfig, createLogger } from '@maetrik/shared';
import { createDataSourceManagerFromConfig, createStateDatabase } from '@maetrik/core';

const logger = createLogger('server');

async function main() {
  const config = await loadConfig({ env: process.env as Record<string, string> });

  // Initialize state database first
  const stateDb = createStateDatabase(config.stateDatabase ?? { type: 'pglite' });
  try {
    logger.info('Initializing state database...', { type: config.stateDatabase?.type ?? 'pglite' });
    await stateDb.initialize();
    logger.info('State database initialized');
  } catch (error) {
    logger.error('Failed to initialize state database', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  // Convert dataSources config to DataSourceConfig format
  const fileConfigs = config.dataSources.map((ds) => ({
    id: ds.id,
    type: ds.type,
    credentials: ds.credentials,
  }));

  // Create manager with both file and database sources
  const dataSourceManager = await createDataSourceManagerFromConfig({
    fileConfigs,
    stateDb,
    logger,
  });

  const app = createApp({
    dataSources: config.dataSources,
    llm: config.llm,
    dataSourceManager,
    stateDb,
  });

  const context = getAppContext(app);

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

      // Note: No dataSourceManager.shutdown() - connections are caller-managed now

      try {
        await stateDb.shutdown();
        logger.info('State database closed');
      } catch (error) {
        logger.warn('Error shutting down state database', {
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
