export interface LLMCapabilities {
  maxTokens: number;
  streaming: boolean;
  embeddings: boolean;
}

export interface LLMCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface LLMCompletionResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMDriver {
  readonly name: string;
  init(config: Record<string, unknown>): Promise<void>;
  complete(prompt: string, options?: LLMCompletionOptions): Promise<LLMCompletionResult>;
  embed?(text: string): Promise<number[]>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<boolean>;
  capabilities(): LLMCapabilities;
}

export interface LLMDriverFactory {
  readonly name: string;
  create(): LLMDriver;
}

export interface LLMRegistry {
  register(factory: LLMDriverFactory): void;
  get(name: string): LLMDriverFactory | undefined;
  list(): string[];
  createDriver(name: string): LLMDriver;
}

export interface LLMManagerOptions {
  driver: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface LLMManager {
  initialize(options: LLMManagerOptions): Promise<void>;
  getDriver(): LLMDriver | undefined;
  complete(prompt: string, options?: LLMCompletionOptions): Promise<LLMCompletionResult>;
  shutdown(): Promise<void>;
}
