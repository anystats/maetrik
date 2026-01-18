import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { DataSourceFactory } from '@maetrik/shared';

export interface DiscoveredDataSource {
  packageName: string;
  factory: DataSourceFactory;
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
        discoveries.push({ packageName, factory });
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
