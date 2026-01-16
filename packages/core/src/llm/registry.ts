import type { LLMDriver, LLMDriverFactory, LLMRegistry } from './types.js';

export function createLLMRegistry(): LLMRegistry {
  const factories = new Map<string, LLMDriverFactory>();

  return {
    register(factory: LLMDriverFactory): void {
      factories.set(factory.name, factory);
    },

    get(name: string): LLMDriverFactory | undefined {
      return factories.get(name);
    },

    list(): string[] {
      return Array.from(factories.keys());
    },

    createDriver(name: string): LLMDriver {
      const factory = factories.get(name);
      if (!factory) {
        throw new Error(`Unknown LLM driver: ${name}`);
      }
      return factory.create();
    },
  };
}
