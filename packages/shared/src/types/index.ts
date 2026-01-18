export * from './config.js';
export * from './driver.js';
export * from './query.js';

// Export data source types (new architecture)
// Note: Some types have different shapes than driver.ts equivalents
// During migration, we export both - old driver types for backwards compat,
// new datasource types with explicit names for new architecture
export {
  // Capability interfaces
  type Queryable,
  type Introspectable,
  type HealthCheckable,
  type Transactional,
  type Transaction,
  // Core interfaces
  type DataSourceCapabilities,
  type DataSourceConfig,
  type DataSourceDriver,
  type DataSourceFactory,
  type ResolvedDataSourceFactory,
  // Credentials field definitions
  type CredentialsFieldDefinition,
  type CredentialsFieldDefinitions,
  // Schema types (new versions with different shapes)
  type QueryResult as DataSourceQueryResult,
  type SchemaColumn as DataSourceSchemaColumn,
  type SchemaTable as DataSourceSchemaTable,
  type SchemaDefinition as DataSourceSchemaDefinition,
} from './datasource.js';

// Base class for data source drivers
export { BaseDataSourceDriver } from './base-driver.js';
