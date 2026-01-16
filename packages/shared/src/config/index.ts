import * as fs from 'node:fs';
import * as yaml from 'yaml';
import { maetrikConfigSchema, type MaetrikConfigInput, type MaetrikConfig } from './schema.js';

export type { MaetrikConfig } from './schema.js';

export interface LoadConfigOptions {
  configPath?: string;
  env?: Record<string, string | undefined>;
}

function interpolateEnvVars(value: string, env: Record<string, string | undefined>): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, key) => env[key] ?? '');
}

function interpolateObject(
  obj: unknown,
  env: Record<string, string | undefined>
): unknown {
  if (typeof obj === 'string') {
    return interpolateEnvVars(obj, env);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, env));
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, env);
    }
    return result;
  }
  return obj;
}

function applyEnvOverrides(
  config: MaetrikConfigInput,
  env: Record<string, string | undefined>
): MaetrikConfigInput {
  const result = { ...config };

  // Server overrides
  if (env.MAETRIK_SERVER_PORT) {
    result.server = { ...result.server, port: parseInt(env.MAETRIK_SERVER_PORT, 10) };
  }
  if (env.MAETRIK_SERVER_HOST) {
    result.server = { ...result.server, host: env.MAETRIK_SERVER_HOST };
  }

  // LLM overrides
  if (env.MAETRIK_LLM_DRIVER) {
    result.llm = { ...result.llm, driver: env.MAETRIK_LLM_DRIVER };
  }
  if (env.MAETRIK_LLM_API_KEY) {
    result.llm = { ...result.llm, apiKey: env.MAETRIK_LLM_API_KEY };
  }

  // Storage overrides
  if (env.MAETRIK_STORAGE_DRIVER) {
    result.storage = { ...result.storage, driver: env.MAETRIK_STORAGE_DRIVER };
  }

  return result;
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<MaetrikConfig> {
  const { configPath = './maetrik.config.yaml', env = {} } = options;

  let fileConfig: MaetrikConfigInput = {};

  if (fs.existsSync(configPath)) {
    const rawContent = fs.readFileSync(configPath, 'utf-8');
    const interpolated = interpolateObject(yaml.parse(rawContent), env) as MaetrikConfigInput;
    fileConfig = interpolated;
  }

  const withEnvOverrides = applyEnvOverrides(fileConfig, env);
  const validated = maetrikConfigSchema.parse(withEnvOverrides);

  return validated as MaetrikConfig;
}

