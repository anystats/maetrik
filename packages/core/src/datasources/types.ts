import type { DataSourceFactory, DataSourceDriver, DataSourceConfig } from '@maetrik/shared';
import type { ConnectionConfigResolver } from '../connections/types.js';

export interface DataSourceRegistry {
  register(factory: DataSourceFactory): void;
  get(type: string): DataSourceFactory | undefined;
  list(): DataSourceFactory[];
  has(type: string): boolean;
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
