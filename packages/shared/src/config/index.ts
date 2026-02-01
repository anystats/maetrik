import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'yaml';
import { maetrikConfigSchema, type MaetrikConfigInput, type MaetrikConfig } from './schema.js';

export type { MaetrikConfig } from './schema.js';
export { maetrikConfigSchema } from './schema.js';

export interface LoadConfigOptions {
  configPath?: string;
  env?: Record<string, string | undefined>;
}

const CONFIG_FILENAME = 'maetrik.config.yaml';

/**
 * Search for config file starting from cwd and moving up to parent directories.
 * Returns the first found config path, or undefined if not found.
 */
function findConfigFile(startDir: string = process.cwd()): string | undefined {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const configPath = path.join(currentDir, CONFIG_FILENAME);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    currentDir = path.dirname(currentDir);
  }

  // Check root directory as well
  const rootConfig = path.join(root, CONFIG_FILENAME);
  if (fs.existsSync(rootConfig)) {
    return rootConfig;
  }

  return undefined;
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
  const { env = {} } = options;

  // Use explicit configPath if provided, otherwise search up directory tree
  const configPath = options.configPath ?? findConfigFile();

  let fileConfig: MaetrikConfigInput = {};

  if (configPath && fs.existsSync(configPath)) {
    const rawContent = fs.readFileSync(configPath, 'utf-8');
    const interpolated = interpolateObject(yaml.parse(rawContent), env) as MaetrikConfigInput;
    fileConfig = interpolated;
  }

  const validated = maetrikConfigSchema.parse(fileConfig);

  return validated as MaetrikConfig;
}

