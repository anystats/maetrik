import { createApp } from './app.js';
import { loadConfig, createLogger } from '@maetrik/shared';

const logger = createLogger('server');

async function main() {
  const config = await loadConfig({ env: process.env as Record<string, string> });

  const app = createApp();
  const { port, host } = config.server;

  app.listen(port, host, () => {
    logger.info(`Server listening on http://${host}:${port}`);
  });
}

main().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});

