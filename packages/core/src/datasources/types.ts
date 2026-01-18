import type { DataSourceFactory, DataSourceDriver, DataSourceConfig } from '@maetrik/shared';

export interface DataSourceRegistry {
  register(factory: DataSourceFactory): void;
  get(type: string): DataSourceFactory | undefined;
  list(): DataSourceFactory[];
  has(type: string): boolean;
}

export interface DataSourceManager {
  addConfig(config: DataSourceConfig): void;
  removeConfig(id: string): void;
  getConfig(id: string): DataSourceConfig | undefined;
  listConfigs(): DataSourceConfig[];
  get(id: string): Promise<DataSourceDriver | undefined>;
  shutdown(): Promise<void>;
}

export interface DataSourceManagerOptions {
  registry: DataSourceRegistry;
  configs?: DataSourceConfig[];
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}
