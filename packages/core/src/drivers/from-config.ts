import type { ConnectionConfig, Logger } from '@maetrik/shared';
import type { DriverManager } from './types.js';
import { createDriverRegistry } from './registry.js';
import { createDriverManager } from './manager.js';
import { autodiscoverDrivers } from './autodiscover.js';

export async function createDriverManagerFromConfig(
  connections: Record<string, ConnectionConfig>,
  logger: Logger
): Promise<DriverManager> {
  const registry = createDriverRegistry();
  const discovered = await autodiscoverDrivers();

  for (const { factory } of discovered.drivers) {
    registry.register(factory);
  }

  for (const { packageName, error } of discovered.errors) {
    logger.warn('Failed to load driver', { packageName, error });
  }

  return createDriverManager(registry, { connections });
}
