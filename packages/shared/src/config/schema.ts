import { z } from 'zod';

export const serverConfigSchema = z.object({
  port: z.number().default(3000),
  host: z.string().default('localhost'),
  cors: z
    .object({
      origins: z.array(z.string()).default([]),
    })
    .optional(),
});

export const connectionConfigSchema = z.object({
  driver: z.string(),
  host: z.string(),
  port: z.number(),
  database: z.string(),
  user: z.string().optional(),
  password: z.string().optional(),
  ssl: z.boolean().optional(),
});

export const llmConfigSchema = z.object({
  driver: z.string().default('ollama'),
  model: z.string().default('llama3'),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
});

export const connectionOptionsSchema = z.object({
  timeoutMs: z.number().positive().default(30000),
  idleTimeoutMs: z.number().positive().default(60000),
  maxRetries: z.number().nonnegative().default(0),
  retryDelayMs: z.number().positive().default(1000),
}).partial();

export const dataSourceConfigSchema = z.object({
  id: z.string(),
  type: z.string(),
  credentials: z.record(z.string(), z.any()),
  connection: connectionOptionsSchema.optional(),
});

export const stateStorageConfigSchema = z.object({
  type: z.enum(['pglite', 'postgres']).default('pglite'),
  path: z.string().optional(),
  connectionString: z.string().optional(),
});

export const encryptionProfileSchema = z.object({
  mode: z.enum(['plaintext', 'encrypted', 'external']),
  driver: z.string().optional(),
}).passthrough(); // Allow driver-specific options

export const encryptionConfigSchema = z.object({
  default: z.string().optional(),
  profiles: z.record(z.string(), encryptionProfileSchema).default({}),
}).default({ default: 'default', profiles: { default: { mode: 'plaintext' } } });

export const maetrikConfigSchema = z.object({
  server: serverConfigSchema.default({ port: 3000, host: 'localhost' }),
  connections: z.record(z.string(), connectionConfigSchema).default({}),
  dataSources: z.array(dataSourceConfigSchema).default([]),
  llm: llmConfigSchema.default({ driver: 'ollama', model: 'llama3' }),
  stateStorage: stateStorageConfigSchema.default({ type: 'pglite' }),
  encryption: encryptionConfigSchema,
});

// Inferred types from Zod schemas - these are the source of truth
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type ConnectionConfig = z.infer<typeof connectionConfigSchema>;
export type DataSourceConfigEntry = z.infer<typeof dataSourceConfigSchema>;
export type LLMConfig = z.infer<typeof llmConfigSchema>;
export type StateStorageConfig = z.infer<typeof stateStorageConfigSchema>;
export type EncryptionProfileConfig = z.infer<typeof encryptionProfileSchema>;
export type EncryptionConfigEntry = z.infer<typeof encryptionConfigSchema>;
export type MaetrikConfig = z.infer<typeof maetrikConfigSchema>;
export type MaetrikConfigInput = z.input<typeof maetrikConfigSchema>;

