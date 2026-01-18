import type { DataSourceConfig } from '@maetrik/shared';

// Re-export for convenience (ConnectionConfig = DataSourceConfig)
export type ConnectionConfig = DataSourceConfig;

export interface ConnectionConfigSource {
  readonly name: string;
  get(id: string): Promise<ConnectionConfig | undefined>;
  list(): Promise<ConnectionConfig[]>;
  has(id: string): Promise<boolean>;
}

export interface ConnectionConfigResolver {
  get(id: string): Promise<ConnectionConfig>;
  list(): Promise<ConnectionConfig[]>;
  has(id: string): Promise<boolean>;
  existsInOtherSources(id: string, excludeSource: string): Promise<boolean>;
}
