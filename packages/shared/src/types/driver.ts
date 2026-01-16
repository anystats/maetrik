import type { ConnectionConfig, LLMConfig } from './config.js';

export interface DriverCapabilities {
  streaming?: boolean;
  explain?: boolean;
  timeout?: boolean;
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  description?: string;
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
  description?: string;
}

export interface SchemaDefinition {
  tables: Record<string, SchemaTable>;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface DatabaseDriver {
  readonly name: string;
  readonly dialect: string;
  init(config: ConnectionConfig): Promise<void>;
  healthCheck(): Promise<boolean>;
  shutdown(): Promise<void>;
  introspect(): Promise<SchemaDefinition>;
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  capabilities(): DriverCapabilities;
}

export interface LLMDriver {
  readonly name: string;
  init(config: LLMConfig): Promise<void>;
  complete(prompt: string, options?: Record<string, unknown>): Promise<string>;
  embed?(text: string): Promise<number[]>;
  capabilities(): {
    maxTokens: number;
    streaming: boolean;
    embeddings: boolean;
  };
}

