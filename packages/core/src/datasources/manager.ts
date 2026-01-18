import type { DataSourceDriver, DataSourceConfig } from '@maetrik/shared';
import type { DataSourceManager, DataSourceManagerOptions } from './types.js';
import { DriverNotFoundError } from '../connections/errors.js';

export function createDataSourceManager(options: DataSourceManagerOptions): DataSourceManager {
  const { registry, resolver, logger } = options;

  return {
    async getConfig(id: string): Promise<DataSourceConfig> {
      return resolver.get(id);
    },

    async listConfigs(): Promise<DataSourceConfig[]> {
      return resolver.list();
    },

    async hasConnection(id: string): Promise<boolean> {
      return resolver.has(id);
    },

    async connect(config: DataSourceConfig): Promise<DataSourceDriver> {
      const factory = registry.get(config.type);
      if (!factory) {
        throw new DriverNotFoundError(config.type);
      }

      const driver = factory.create();
      await driver.init(config);

      logger?.info(`Connected to ${config.id} (${config.type})`);
      return driver;
    },

    async connectById(id: string): Promise<DataSourceDriver> {
      const config = await resolver.get(id);
      return this.connect(config);
    },

    async canAddToDatabase(id: string): Promise<boolean> {
      return !(await resolver.existsInOtherSources(id, 'database'));
    },
  };
}
