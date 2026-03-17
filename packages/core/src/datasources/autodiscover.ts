import { readdir, readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DataSourceFactory, ResolvedDataSourceFactory, DataSourceCapabilities, OptionsFieldDefinitions } from '@maetrik/shared';
import { JSONSchemaToZod, type JSONSchema } from '@dmitryrechkin/json-schema-to-zod';

export interface DiscoveredDataSource {
  packageName: string;
  factory: ResolvedDataSourceFactory;
}

export interface AutodiscoverResult {
  discoveries: DiscoveredDataSource[];
  errors: Array<{ packageName: string; error: string }>;
}

export function isValidDataSourceFactory(obj: unknown): obj is DataSourceFactory {
  if (!obj || typeof obj !== 'object') return false;

  const factory = obj as Record<string, unknown>;
  return (
    typeof factory.type === 'string' &&
    typeof factory.displayName === 'string' &&
    typeof factory.credentialsSchema === 'object' &&
    factory.credentialsSchema !== null &&
    typeof factory.create === 'function'
  );
}

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

async function resolveIcon(iconPath: string, packageName: string): Promise<string | undefined> {
  try {
    const nodeModulesPath = join(process.cwd(), 'node_modules');
    const packagePath = packageName.startsWith('@')
      ? join(nodeModulesPath, ...packageName.split('/'))
      : join(nodeModulesPath, packageName);
    const fullPath = join(packagePath, iconPath);

    const fileBuffer = await readFile(fullPath);
    const ext = extname(iconPath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    const base64 = fileBuffer.toString('base64');

    return `data:${mimeType};base64,${base64}`;
  } catch {
    // Icon file missing or unreadable, continue silently
    return undefined;
  }
}

/**
 * Probe a driver instance to derive its capabilities.
 * Checks for actual method implementation rather than declaration.
 */
function deriveCapabilities(factory: DataSourceFactory): DataSourceCapabilities {
  const probe = factory.create();
  return {
    queryable: probe.isQueryable(),
    introspectable: probe.isIntrospectable(),
    healthCheckable: probe.isHealthCheckable(),
    transactional: probe.isTransactional(),
  };
}

/**
 * Build optionsFields by merging credentialsFields UI metadata
 * with required/default info from the JSON Schema.
 */
function buildOptionsFields(factory: DataSourceFactory): OptionsFieldDefinitions | undefined {
  const schema = factory.credentialsSchema;
  const fields = factory.credentialsFields;
  if (!fields) return undefined;

  const requiredSet = new Set(
    Array.isArray(schema.required) ? schema.required : []
  );
  const properties = (schema.properties ?? {}) as Record<string, { default?: unknown }>;

  const result: OptionsFieldDefinitions = {};
  for (const [key, field] of Object.entries(fields)) {
    result[key] = {
      ...field,
      required: requiredSet.has(key),
      default: properties[key]?.default,
    };
  }
  return result;
}

function resolveFactory(factory: DataSourceFactory, icon: string | undefined): ResolvedDataSourceFactory {
  // Convert JSON Schema to Zod for internal validation
  const zodSchema = JSONSchemaToZod.convert(factory.credentialsSchema as JSONSchema);

  return {
    type: factory.type,
    displayName: factory.displayName,
    description: factory.description,
    icon,
    capabilities: deriveCapabilities(factory),
    credentialsSchema: zodSchema,
    credentialsFields: factory.credentialsFields,
    optionsFields: buildOptionsFields(factory),
    create: () => factory.create(),
  };
}

async function findDataSourcePackages(): Promise<string[]> {
  const packages: string[] = [];
  const nodeModulesPath = join(process.cwd(), 'node_modules');

  try {
    // Check for scoped @maetrik packages
    const scopedPath = join(nodeModulesPath, '@maetrik');
    try {
      const scopedEntries = await readdir(scopedPath, { withFileTypes: true });
      for (const entry of scopedEntries) {
        if ((entry.isDirectory() || entry.isSymbolicLink()) && entry.name.startsWith('datasource-')) {
          packages.push(`@maetrik/${entry.name}`);
        }
      }
    } catch {
      // @maetrik scope doesn't exist, that's fine
    }

    // Check for unscoped maetrik-datasource-* packages
    try {
      const entries = await readdir(nodeModulesPath, { withFileTypes: true });
      for (const entry of entries) {
        if ((entry.isDirectory() || entry.isSymbolicLink()) && entry.name.startsWith('maetrik-datasource-')) {
          packages.push(entry.name);
        }
      }
    } catch {
      // node_modules doesn't exist, that's fine
    }
  } catch {
    // Error reading directories
  }

  return packages;
}

export async function autodiscoverDataSources(): Promise<AutodiscoverResult> {
  const discoveries: DiscoveredDataSource[] = [];
  const errors: Array<{ packageName: string; error: string }> = [];

  const packageNames = await findDataSourcePackages();
  const nodeModulesPath = join(process.cwd(), 'node_modules');

  for (const packageName of packageNames) {
    try {
      // Resolve package path from cwd's node_modules (not from this module's location)
      const packagePath = packageName.startsWith('@')
        ? join(nodeModulesPath, ...packageName.split('/'))
        : join(nodeModulesPath, packageName);

      // Read package.json to find entry point
      const pkgJsonPath = join(packagePath, 'package.json');
      const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf-8'));
      const mainEntry = pkgJson.exports?.['.']?.import || pkgJson.main || 'index.js';
      const entryPath = resolve(packagePath, mainEntry);

      // Import using file:// URL for cross-platform compatibility
      const module = await import(pathToFileURL(entryPath).href);
      const factory = module.dataSourceFactory;

      if (isValidDataSourceFactory(factory)) {
        // Resolve icon if iconPath is specified
        const icon = factory.iconPath
          ? await resolveIcon(factory.iconPath, packageName)
          : undefined;
        const resolvedFactory = resolveFactory(factory, icon);
        discoveries.push({ packageName, factory: resolvedFactory });
      } else {
        errors.push({
          packageName,
          error: 'Package does not export a valid dataSourceFactory',
        });
      }
    } catch (error) {
      errors.push({
        packageName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { discoveries, errors };
}
