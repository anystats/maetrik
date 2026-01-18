import type { DataSourceFactory, ResolvedDataSourceFactory } from '@maetrik/shared';
import type { DataSourceRegistry } from './types.js';

export function createDataSourceRegistry(): DataSourceRegistry {
  const factories = new Map<string, ResolvedDataSourceFactory>();

  return {
    register(factory: DataSourceFactory | ResolvedDataSourceFactory): void {
      if (factories.has(factory.type)) {
        throw new Error(`Data source factory '${factory.type}' is already registered`);
      }
      // Store as ResolvedDataSourceFactory - unresolved factories just won't have icon
      factories.set(factory.type, factory as ResolvedDataSourceFactory);
    },

    get(type: string): ResolvedDataSourceFactory | undefined {
      return factories.get(type);
    },

    list(): ResolvedDataSourceFactory[] {
      return Array.from(factories.values());
    },

    has(type: string): boolean {
      return factories.has(type);
    },
  };
}
