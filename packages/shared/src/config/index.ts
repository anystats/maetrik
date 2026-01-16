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

export async function loadConfig(options: LoadConfigOptions = {}): Promise<MaetrikConfig> {
  const { configPath = './maetrik.config.yaml', env = {} } = options;

  let fileConfig: MaetrikConfigInput = {};

  if (fs.existsSync(configPath)) {
    const rawContent = fs.readFileSync(configPath, 'utf-8');
    const interpolated = interpolateObject(yaml.parse(rawContent), env) as MaetrikConfigInput;
    fileConfig = interpolated;
  }

  const validated = maetrikConfigSchema.parse(fileConfig);

  return validated as MaetrikConfig;
}

