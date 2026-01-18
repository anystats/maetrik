import type { DataSourceDriver, DataSourceConfig } from '@maetrik/shared';
import type { DataSourceManager, DataSourceManagerOptions } from './types.js';

export function createDataSourceManager(options: DataSourceManagerOptions): DataSourceManager {
  const { registry, configs = [], logger } = options;
  const configMap = new Map<string, DataSourceConfig>();
  const instances = new Map<string, DataSourceDriver>();

  // Initialize with provided configs
  for (const config of configs) {
    configMap.set(config.id, config);
  }

  return {
    addConfig(config: DataSourceConfig): void {
      configMap.set(config.id, config);
      logger?.info(`Added data source config: ${config.id} (${config.type})`);
    },

    removeConfig(id: string): void {
      configMap.delete(id);
      // Note: does not shutdown existing instance - caller should handle if needed
      logger?.info(`Removed data source config: ${id}`);
    },

    getConfig(id: string): DataSourceConfig | undefined {
      return configMap.get(id);
    },

    listConfigs(): DataSourceConfig[] {
      return Array.from(configMap.values());
    },

    async get(id: string): Promise<DataSourceDriver | undefined> {
      // Return existing instance if already connected
      if (instances.has(id)) {
        return instances.get(id);
      }

      // Get config
      const config = configMap.get(id);
      if (!config) {
        logger?.warn(`No config found for data source: ${id}`);
        return undefined;
      }

      // Get factory
      const factory = registry.get(config.type);
      if (!factory) {
        logger?.warn(`No factory found for data source type: ${config.type}`);
        return undefined;
      }

      // Lazy instantiation
      logger?.info(`Creating data source instance: ${id} (${config.type})`);
      const driver = factory.create();
      await driver.init(config);
      instances.set(id, driver);

      return driver;
    },

    async shutdown(): Promise<void> {
      const shutdownPromises = Array.from(instances.entries()).map(async ([id, driver]) => {
        try {
          logger?.info(`Shutting down data source: ${id}`);
          await driver.shutdown();
        } catch (error) {
          logger?.error(`Error shutting down data source ${id}: ${error}`);
        }
      });

      await Promise.all(shutdownPromises);
      instances.clear();
    },
  };
}
