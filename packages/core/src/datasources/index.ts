export * from './types.js';
// Re-export from shared for backwards compatibility
export { BaseDataSourceDriver } from '@maetrik/shared';
export { createDataSourceRegistry } from './registry.js';
export { createDataSourceManager } from './manager.js';
export {
  autodiscoverDataSources,
  isValidDataSourceFactory,
  type DiscoveredDataSource,
  type AutodiscoverResult as DataSourceAutodiscoverResult,
} from './autodiscover.js';
export { createDataSourceManagerFromConfig } from './from-config.js';
