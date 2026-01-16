import type {
  LLMDriver,
  LLMRegistry,
  LLMManager,
  LLMManagerOptions,
  LLMCompletionOptions,
  LLMCompletionResult,
} from './types.js';

export function createLLMManager(registry: LLMRegistry): LLMManager {
  let driver: LLMDriver | null = null;

  return {
    async initialize(options: LLMManagerOptions): Promise<void> {
      driver = registry.createDriver(options.driver);
      await driver.init({
        model: options.model,
        baseUrl: options.baseUrl,
        apiKey: options.apiKey,
      });
    },

    getDriver(): LLMDriver | undefined {
      return driver ?? undefined;
    },

    async complete(prompt: string, options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
      if (!driver) {
        throw new Error('LLM driver not initialized');
      }
      return driver.complete(prompt, options);
    },

    async shutdown(): Promise<void> {
      if (driver) {
        await driver.shutdown();
        driver = null;
      }
    },
  };
}
