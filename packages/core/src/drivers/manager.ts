import type { DatabaseDriver } from '@maetrik/shared';
import type { DriverRegistry, DriverManager, DriverManagerOptions } from './types.js';

export function createDriverManager(
  registry: DriverRegistry,
  options: DriverManagerOptions
): DriverManager {
  const drivers = new Map<string, DatabaseDriver>();

  return {
    async initialize(): Promise<void> {
      for (const [name, config] of Object.entries(options.connections)) {
        const driver = registry.createDriver(config.driver);
        await driver.init(config as unknown as Record<string, unknown>);
        drivers.set(name, driver);
      }
    },

    getDriver(connectionName: string): DatabaseDriver | undefined {
      return drivers.get(connectionName);
    },

    async healthCheck(connectionName: string): Promise<boolean> {
      const driver = drivers.get(connectionName);
      if (!driver) {
        return false;
      }
      return driver.healthCheck();
    },

    async shutdown(): Promise<void> {
      for (const driver of drivers.values()) {
        await driver.shutdown();
      }
      drivers.clear();
    },
  };
}
