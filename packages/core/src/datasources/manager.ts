import type { DataSourceDriver, DataSourceConfig, DataSourceError } from '@maetrik/shared';
import type { DataSourceManager, DataSourceManagerOptions, DataSourceTypeInfo } from './types.js';
import { DriverNotFoundError } from '../connections/errors.js';

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_DELAY_MS = 1000;

/**
 * Wraps a promise with a timeout.
 * Rejects with a timeout error if the promise doesn't resolve in time.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Operation '${operation}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Delays execution for a given number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDataSourceManager(options: DataSourceManagerOptions): DataSourceManager {
  const { registry, resolver, logger } = options;

  return {
    async getConfig(id: string): Promise<DataSourceConfig> {
      return resolver.get(id);
    },

    async listConfigs(): Promise<DataSourceConfig[]> {
      return resolver.list();
    },

    async hasConnection(id: string): Promise<boolean> {
      return resolver.has(id);
    },

    async connect(config: DataSourceConfig): Promise<DataSourceDriver> {
      const factory = registry.get(config.type);
      if (!factory) {
        throw new DriverNotFoundError(config.type);
      }

      const { connection } = config;
      const timeoutMs = connection?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const maxRetries = connection?.maxRetries ?? 0;
      const retryDelayMs = connection?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

      let lastError: unknown;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const driver = factory.create();

          // Apply timeout to driver initialization
          await withTimeout(
            driver.init(config),
            timeoutMs,
            `connect to ${config.id}`
          );

          logger?.info(`Connected to ${config.id} (${config.type})`);
          return driver;
        } catch (error) {
          lastError = error;

          // Check if error is retryable (DataSourceError with retryable flag)
          const isRetryable =
            error instanceof Error &&
            'retryable' in error &&
            (error as DataSourceError).retryable === true;

          // Also retry on timeout errors
          const isTimeout = error instanceof Error && error.message.includes('timed out');

          if ((isRetryable || isTimeout) && attempt < maxRetries) {
            logger?.warn(
              `Connection attempt ${attempt + 1}/${maxRetries + 1} failed for ${config.id}, retrying in ${retryDelayMs}ms...`
            );
            await delay(retryDelayMs);
          } else {
            break;
          }
        }
      }

      throw lastError;
    },

    async connectById(id: string): Promise<DataSourceDriver> {
      const config = await resolver.get(id);
      return this.connect(config);
    },

    async canAddToDatabase(id: string): Promise<boolean> {
      return !(await resolver.existsInOtherSources(id, 'database'));
    },

    listTypes(): DataSourceTypeInfo[] {
      return registry.list().map((factory) => ({
        type: factory.type,
        displayName: factory.displayName,
        description: factory.description,
        icon: factory.icon,
      }));
    },

    getFactory(type: string) {
      return registry.get(type);
    },
  };
}
