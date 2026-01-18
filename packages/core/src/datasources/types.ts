import type { DataSourceFactory, ResolvedDataSourceFactory, DataSourceDriver, DataSourceConfig } from '@maetrik/shared';
import type { ConnectionConfigResolver } from '../connections/types.js';

export interface DataSourceRegistry {
  register(factory: DataSourceFactory | ResolvedDataSourceFactory): void;
  get(type: string): ResolvedDataSourceFactory | undefined;
  list(): ResolvedDataSourceFactory[];
  has(type: string): boolean;
}

export interface DataSourceTypeInfo {
  type: string;
  displayName: string;
  description?: string;
  icon?: string;  // Base64 data URI
}

export interface DataSourceManager {
  // Config access (delegated to resolver)
  getConfig(id: string): Promise<DataSourceConfig>;
  listConfigs(): Promise<DataSourceConfig[]>;
  hasConnection(id: string): Promise<boolean>;

  // Driver instantiation (stateless - caller manages lifecycle)
  connect(config: DataSourceConfig): Promise<DataSourceDriver>;
  connectById(id: string): Promise<DataSourceDriver>;

  // For API validation
  canAddToDatabase(id: string): Promise<boolean>;

  // Registry access
  listTypes(): DataSourceTypeInfo[];
}

export interface DataSourceManagerOptions {
  registry: DataSourceRegistry;
  resolver: ConnectionConfigResolver;
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}
