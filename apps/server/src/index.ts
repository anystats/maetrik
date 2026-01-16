import { createApp } from './app.js';
import { loadConfig, createLogger } from '@maetrik/shared';
import {
  autodiscoverDrivers,
  createDriverManager,
  createDriverRegistry,
} from '@maetrik/core';

const logger = createLogger('server');

async function main() {
  const config = await loadConfig({ env: process.env as Record<string, string> });

  const registry = createDriverRegistry();
  const discovered = await autodiscoverDrivers();

  for (const { factory } of discovered.drivers) {
    registry.register(factory);
  }

  for (const { packageName, error } of discovered.errors) {
    logger.warn('Failed to load driver', { packageName, error });
  }

  const driverManager = createDriverManager(registry, {
    connections: config.connections,
  });

  const app = createApp({ connections: config.connections, driverManager });

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

  const { port, host } = config.server;

  const server = app.listen(port, host, () => {
    logger.info(`Server listening on http://${host}:${port}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down server...');

    server.close(async () => {
      logger.info('HTTP server closed');
      await driverManager.shutdown();
      logger.info('Database connections closed');
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
