import type { ConnectionConfig, DatabaseDriver, DriverFactory } from '@maetrik/shared';

export type { DriverFactory } from '@maetrik/shared';

export interface DriverRegistry {
  register(factory: DriverFactory): void;
  get(name: string): DriverFactory | undefined;
  list(): string[];
  createDriver(name: string): DatabaseDriver;
}

export interface DriverManagerOptions {
  connections: Record<string, ConnectionConfig>;
}

export interface DriverManager {
  initialize(): Promise<void>;
  getDriver(connectionName: string): DatabaseDriver | undefined;
  healthCheck(connectionName: string): Promise<boolean>;
  shutdown(): Promise<void>;
}
