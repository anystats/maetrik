export interface ServerConfig {
  port: number;
  host: string;
  cors?: {
    origins: string[];
  };
}

export interface ConnectionConfig {
  driver: string;
  host: string;
  port: number;
  database: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

export interface LLMConfig {
  driver: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface AuthConfig {
  driver: string;
  sessionSecret?: string;
}

export interface StorageConfig {
  driver: string;
  path?: string;
  connectionString?: string;
}

export interface MaetrikConfig {
  server: ServerConfig;
  connections: Record<string, ConnectionConfig>;
  llm: LLMConfig;
  auth: AuthConfig;
  storage: StorageConfig;
}

