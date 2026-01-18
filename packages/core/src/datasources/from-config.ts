import type { DataSourceConfig } from '@maetrik/shared';
import type { StateDatabase } from '../state/types.js';
import type { DataSourceManager } from './types.js';
import { createDataSourceRegistry } from './registry.js';
import { createDataSourceManager } from './manager.js';
import { autodiscoverDataSources } from './autodiscover.js';
import { FileConnectionConfigSource, DatabaseConnectionConfigSource } from '../connections/sources/index.js';
import { CompositeConnectionConfigResolver } from '../connections/resolver.js';

interface Logger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

export interface CreateDataSourceManagerOptions {
  fileConfigs?: DataSourceConfig[];
  stateDb?: StateDatabase;
  logger?: Logger;
}

export async function createDataSourceManagerFromConfig(
  options: CreateDataSourceManagerOptions
): Promise<DataSourceManager> {
  const { fileConfigs = [], stateDb, logger } = options;

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

  // Create config sources
  const sources = [];
  sources.push(new FileConnectionConfigSource(fileConfigs));

  if (stateDb) {
    sources.push(new DatabaseConnectionConfigSource(stateDb));
  }

  // Create resolver
  const resolver = new CompositeConnectionConfigResolver(sources);

  // Validate no duplicates on startup
  await resolver.list();

  // Create manager
  return createDataSourceManager({
    registry,
    resolver,
    logger,
  });
}
