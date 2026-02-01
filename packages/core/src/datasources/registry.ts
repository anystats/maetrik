import type {
  DataSourceFactory,
  ResolvedDataSourceFactory,
  DataSourceCapabilities,
} from '@maetrik/shared';
import { JSONSchemaToZod, type JSONSchema } from '@dmitryrechkin/json-schema-to-zod';
import type { DataSourceRegistry } from './types.js';

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
 * Resolve a factory by deriving capabilities from implementation
 * and converting JSON Schema credentials to Zod.
 */
function resolveFactory(factory: DataSourceFactory): ResolvedDataSourceFactory {
  // Convert JSON Schema to Zod for internal validation
  // Cast is safe: JSONSchema7 is a superset of the library's JSONSchema type
  const zodSchema = JSONSchemaToZod.convert(factory.credentialsSchema as JSONSchema);

  return {
    type: factory.type,
    displayName: factory.displayName,
    description: factory.description,
    icon: undefined, // Icon resolution handled by autodiscover
    capabilities: deriveCapabilities(factory),
    credentialsSchema: zodSchema,
    credentialsFields: factory.credentialsFields,
    create: factory.create,
  };
}

/**
 * Check if factory is already resolved (has capabilities property).
 */
function isResolved(
  factory: DataSourceFactory | ResolvedDataSourceFactory
): factory is ResolvedDataSourceFactory {
  return 'capabilities' in factory && factory.capabilities !== undefined;
}

export function createDataSourceRegistry(): DataSourceRegistry {
  const factories = new Map<string, ResolvedDataSourceFactory>();

  return {
    register(factory: DataSourceFactory | ResolvedDataSourceFactory): void {
      if (factories.has(factory.type)) {
        throw new Error(`Data source factory '${factory.type}' is already registered`);
      }

      // Resolve factory if not already resolved
      const resolved = isResolved(factory) ? factory : resolveFactory(factory);
      factories.set(factory.type, resolved);
    },

    get(type: string): ResolvedDataSourceFactory | undefined {
      return factories.get(type);
    },

    list(): ResolvedDataSourceFactory[] {
      return Array.from(factories.values());
    },

    has(type: string): boolean {
      return factories.has(type);
    },
  };
}
