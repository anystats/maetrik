import OpenAI from 'openai';
import type {
  LLMDriver,
  LLMDriverFactory,
  LLMCapabilities,
  LLMCompletionOptions,
  LLMCompletionResult,
} from '../types.js';

export function createOpenAIDriver(): LLMDriver {
  let client: OpenAI | null = null;
  let model = 'gpt-4o';

  return {
    name: 'openai',

    async init(config: Record<string, unknown>): Promise<void> {
      if (config.model) {
        model = config.model as string;
      }
      client = new OpenAI({
        apiKey: config.apiKey as string | undefined,
        baseURL: config.baseUrl as string | undefined,
      });
    },

    async complete(prompt: string, options?: LLMCompletionOptions): Promise<LLMCompletionResult> {
      if (!client) {
        throw new Error('OpenAI driver not initialized');
      }

      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 2048,
        stop: options?.stopSequences,
      });

      const content = response.choices[0]?.message?.content ?? '';

      return {
        content,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };
    },

    async embed(text: string): Promise<number[]> {
      if (!client) {
        throw new Error('OpenAI driver not initialized');
      }

      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return response.data[0].embedding;
    },

    async shutdown(): Promise<void> {
      client = null;
    },

    async healthCheck(): Promise<boolean> {
      if (!client) return false;
      try {
        await client.models.list();
        return true;
      } catch {
        return false;
      }
    },

    capabilities(): LLMCapabilities {
      return {
        maxTokens: 128000,
        streaming: false,
        embeddings: true,
      };
    },
  };
}

export const openaiDriverFactory: LLMDriverFactory = {
  name: 'openai',
  create: createOpenAIDriver,
};
