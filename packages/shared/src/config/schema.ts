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

export const storageConfigSchema = z.object({
  driver: z.string().default('sqlite'),
  path: z.string().optional().default('./data/maetrik.db'),
  connectionString: z.string().optional(),
});

export const maetrikConfigSchema = z.object({
  server: serverConfigSchema.default({ port: 3000, host: 'localhost' }),
  connections: z.record(z.string(), connectionConfigSchema).default({}),
  llm: llmConfigSchema.default({ driver: 'ollama', model: 'llama3' }),
  auth: authConfigSchema.default({ driver: 'none' }),
  storage: storageConfigSchema.default({ driver: 'sqlite', path: './data/maetrik.db' }),
});

export type MaetrikConfigInput = z.input<typeof maetrikConfigSchema>;

