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

export const authConfigSchema = z.object({
  driver: z.string().default('none'),
  sessionSecret: z.string().optional(),
});

export const dataSourceConfigSchema = z.object({
  id: z.string(),
  type: z.string(),
  credentials: z.record(z.string(), z.any()),
});

export const stateStorageConfigSchema = z.object({
  type: z.enum(['pglite', 'postgres']).default('pglite'),
  path: z.string().optional(),
  connectionString: z.string().optional(),
});

export const maetrikConfigSchema = z.object({
  server: serverConfigSchema.default({ port: 3000, host: 'localhost' }),
  connections: z.record(z.string(), connectionConfigSchema).default({}),
  dataSources: z.array(dataSourceConfigSchema).default([]),
  llm: llmConfigSchema.default({ driver: 'ollama', model: 'llama3' }),
  auth: authConfigSchema.default({ driver: 'none' }),
  stateStorage: stateStorageConfigSchema.default({ type: 'pglite' }),
});

// Inferred types from Zod schemas - these are the source of truth
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type ConnectionConfig = z.infer<typeof connectionConfigSchema>;
export type DataSourceConfigEntry = z.infer<typeof dataSourceConfigSchema>;
export type LLMConfig = z.infer<typeof llmConfigSchema>;
export type AuthConfig = z.infer<typeof authConfigSchema>;
export type StateStorageConfig = z.infer<typeof stateStorageConfigSchema>;
export type MaetrikConfig = z.infer<typeof maetrikConfigSchema>;
export type MaetrikConfigInput = z.input<typeof maetrikConfigSchema>;

