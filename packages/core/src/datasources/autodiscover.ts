import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { DataSourceFactory, ResolvedDataSourceFactory } from '@maetrik/shared';

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
    typeof factory.capabilities === 'object' &&
    factory.capabilities !== null &&
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

function resolveFactory(factory: DataSourceFactory, icon: string | undefined): ResolvedDataSourceFactory {
  return {
    type: factory.type,
    displayName: factory.displayName,
    description: factory.description,
    icon,
    capabilities: factory.capabilities,
    credentialsSchema: factory.credentialsSchema,
    credentialsFields: factory.credentialsFields,
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
        if (entry.isDirectory() && entry.name.startsWith('datasource-')) {
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
        if (entry.isDirectory() && entry.name.startsWith('maetrik-datasource-')) {
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

  for (const packageName of packageNames) {
    try {
      const module = await import(packageName);
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
