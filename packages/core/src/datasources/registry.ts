import type { DataSourceFactory } from '@maetrik/shared';
import type { DataSourceRegistry } from './types.js';

export function createDataSourceRegistry(): DataSourceRegistry {
  const factories = new Map<string, DataSourceFactory>();

  return {
    register(factory: DataSourceFactory): void {
      if (factories.has(factory.type)) {
        throw new Error(`Data source factory '${factory.type}' is already registered`);
      }
      factories.set(factory.type, factory);
    },

    get(type: string): DataSourceFactory | undefined {
      return factories.get(type);
    },

    list(): DataSourceFactory[] {
      return Array.from(factories.values());
    },

    has(type: string): boolean {
      return factories.has(type);
    },
  };
}
