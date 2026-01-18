import type { DataSourceConfig } from '@maetrik/shared';
import type { DataSourceManager } from './types.js';
import { createDataSourceRegistry } from './registry.js';
import { createDataSourceManager } from './manager.js';
import { autodiscoverDataSources } from './autodiscover.js';

interface Logger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

export async function createDataSourceManagerFromConfig(
  configs: DataSourceConfig[],
  logger?: Logger
): Promise<DataSourceManager> {
  // Create registry
  const registry = createDataSourceRegistry();

  // Autodiscover data source packages
  const { discoveries, errors } = await autodiscoverDataSources();

  // Log discovery errors
  for (const error of errors) {
    logger?.warn(`Failed to load data source package ${error.packageName}: ${error.error}`);
  }

  // Register discovered factories
  for (const { packageName, factory } of discoveries) {
    try {
      registry.register(factory);
      logger?.info(`Registered data source: ${factory.type} (${factory.displayName}) from ${packageName}`);
    } catch (error) {
      logger?.warn(`Failed to register ${packageName}: ${error}`);
    }
  }

  // Create manager with configs
  const manager = createDataSourceManager({
    registry,
    configs,
    logger,
  });

  return manager;
}
