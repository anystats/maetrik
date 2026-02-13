import type { EncryptionDriver, EncryptionDriverFactory } from '@maetrik/shared';

/**
 * Registry for encryption drivers.
 */
export interface EncryptionDriverRegistry {
  /**
   * Register a driver factory.
   */
  register(factory: EncryptionDriverFactory): void;

  /**
   * Get a driver factory by type.
   */
  get(type: string): EncryptionDriverFactory | undefined;

  /**
   * Check if a driver type is registered.
   */
  has(type: string): boolean;

  /**
   * List all registered driver types.
   */
  list(): EncryptionDriverFactory[];
}

/**
 * Create an encryption driver registry.
 */
export function createEncryptionDriverRegistry(): EncryptionDriverRegistry {
  const factories = new Map<string, EncryptionDriverFactory>();

  return {
    register(factory: EncryptionDriverFactory): void {
      if (factories.has(factory.type)) {
        throw new Error(`Encryption driver "${factory.type}" is already registered`);
      }
      factories.set(factory.type, factory);
    },

    get(type: string): EncryptionDriverFactory | undefined {
      return factories.get(type);
    },

    has(type: string): boolean {
      return factories.has(type);
    },

    list(): EncryptionDriverFactory[] {
      return Array.from(factories.values());
    },
  };
}
