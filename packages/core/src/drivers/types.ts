import type { DatabaseDriver, ConnectionConfig } from '@maetrik/shared';

export interface DriverFactory {
  readonly name: string;
  readonly dialect: string;
  create(): DatabaseDriver;
}

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
