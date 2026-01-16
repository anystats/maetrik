import type {
  LLMDriver,
  LLMDriverFactory,
  LLMCapabilities,
  LLMCompletionOptions,
  LLMCompletionResult,
} from '../types.js';

interface OllamaGenerateResponse {
  response: string;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export function createOllamaDriver(): LLMDriver {
  let model = 'llama3';
  let baseUrl = 'http://localhost:11434';

  return {
    name: 'ollama',

    async init(config: Record<string, unknown>): Promise<void> {
      if (config.model) {
        model = config.model as string;
      }
      if (config.baseUrl) {
        baseUrl = config.baseUrl as string;
      }
    },

    async complete(prompt: string, options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.1,
            num_predict: options?.maxTokens ?? 2048,
            stop: options?.stopSequences,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as OllamaGenerateResponse;

      return {
        content: data.response,
        usage: {
          promptTokens: data.prompt_eval_count ?? 0,
          completionTokens: data.eval_count ?? 0,
          totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
        },
      };
    },

    async shutdown(): Promise<void> {
      // No cleanup needed for Ollama
    },

    async healthCheck(): Promise<boolean> {
      try {
        const response = await fetch(`${baseUrl}/api/tags`);
        return response.ok;
      } catch {
        return false;
      }
    },

    capabilities(): LLMCapabilities {
      return {
        maxTokens: 8192,
        streaming: false,
        embeddings: false,
      };
    },
  };
}

export const ollamaDriverFactory: LLMDriverFactory = {
  name: 'ollama',
  create: createOllamaDriver,
};
