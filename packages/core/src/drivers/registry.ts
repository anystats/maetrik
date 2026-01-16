import type { DatabaseDriver } from '@maetrik/shared';
import type { DriverFactory, DriverRegistry } from './types.js';

export function createDriverRegistry(): DriverRegistry {
  const factories = new Map<string, DriverFactory>();

  return {
    register(factory: DriverFactory): void {
      factories.set(factory.name, factory);
    },

    get(name: string): DriverFactory | undefined {
      return factories.get(name);
    },

    list(): string[] {
      return Array.from(factories.keys());
    },

    createDriver(name: string): DatabaseDriver {
      const factory = factories.get(name);
      if (!factory) {
        throw new Error(`Unknown driver: ${name}`);
      }
      return factory.create();
    },
  };
}
