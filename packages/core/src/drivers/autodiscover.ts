import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger, type DriverFactory } from '@maetrik/shared';

const logger = createLogger('autodiscover');

export interface DiscoveredDriver {
  packageName: string;
  factory: DriverFactory;
}

export interface AutodiscoverResult {
  drivers: DiscoveredDriver[];
  errors: Array<{ packageName: string; error: Error }>;
}

function isValidDriverFactory(obj: unknown): obj is DriverFactory {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as DriverFactory).name === 'string' &&
    typeof (obj as DriverFactory).dialect === 'string' &&
    typeof (obj as DriverFactory).create === 'function'
  );
}

async function findDriverPackages(): Promise<string[]> {
  const candidates: string[] = [];

  // Find node_modules directory by traversing up from current working directory
  // In a pnpm workspace, node_modules is at the workspace root
  let currentDir = process.cwd();
  let nodeModulesPath: string | null = null;

  // Try to find node_modules by going up from cwd
  for (let i = 0; i < 10; i++) {
    const candidatePath = join(currentDir, 'node_modules');
    try {
      await readdir(candidatePath);
      nodeModulesPath = candidatePath;
      break;
    } catch {
      const parentDir = join(currentDir, '..');
      if (parentDir === currentDir) break;
      currentDir = parentDir;
    }
  }

  if (!nodeModulesPath) {
    logger.warn('Could not find node_modules directory');
    return candidates;
  }

  // Check for scoped @maetrik/driver-* packages
  try {
    const scopedPath = join(nodeModulesPath, '@maetrik');
    const scopedEntries = await readdir(scopedPath);
    for (const entry of scopedEntries) {
      if (entry.startsWith('driver-')) {
        candidates.push(`@maetrik/${entry}`);
      }
    }
  } catch {
    // @maetrik scope doesn't exist, that's fine
  }

  // Check for unscoped maetrik-driver-* packages
  try {
    const entries = await readdir(nodeModulesPath);
    for (const entry of entries) {
      if (entry.startsWith('maetrik-driver-')) {
        candidates.push(entry);
      }
    }
  } catch {
    // Failed to read node_modules
  }

  return candidates;
}

export async function autodiscoverDrivers(): Promise<AutodiscoverResult> {
  const result: AutodiscoverResult = {
    drivers: [],
    errors: [],
  };

  const candidates = await findDriverPackages();
  logger.debug('Found driver package candidates', { candidates });

  for (const packageName of candidates) {
    try {
      // Dynamic import of the package
      const module = await import(packageName);

      // Check for driverFactory named export
      const factory = module.driverFactory;

      if (!factory) {
        result.errors.push({
          packageName,
          error: new Error(`Package does not export 'driverFactory'`),
        });
        continue;
      }

      if (!isValidDriverFactory(factory)) {
        result.errors.push({
          packageName,
          error: new Error(`Exported 'driverFactory' is not a valid DriverFactory`),
        });
        continue;
      }

      logger.debug('Loaded driver', { packageName, driverName: factory.name });
      result.drivers.push({ packageName, factory });
    } catch (error) {
      result.errors.push({
        packageName,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  logger.info('Autodiscovery complete', {
    driversLoaded: result.drivers.length,
    errors: result.errors.length,
  });

  return result;
}
