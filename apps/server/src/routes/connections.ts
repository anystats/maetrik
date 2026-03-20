import { Router, Request, Response } from 'express';
import type { DataSourceManager, StateDatabase, EncryptionManager, HealthStatus } from '@maetrik/core';
import { z } from 'zod';

const BUCKET_MS = 30 * 60 * 1000;
function computeBucketStart(): Date {
  return new Date(Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS);
}

const connectionOptionsSchema = z.object({
  timeoutMs: z.number().int().positive().optional(),
  idleTimeoutMs: z.number().int().positive().optional(),
  maxConnections: z.number().int().positive().optional(),
  maxRetries: z.number().int().min(0).optional(),
  retryDelayMs: z.number().int().positive().optional(),
});

const optionsSchema = z.object({
  credentials: z.record(z.string(), z.unknown()),
  connection: connectionOptionsSchema.optional(),
});

const createConnectionSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-z0-9-_]+$/i, 'ID must be alphanumeric with dashes/underscores'),
  type: z.string().min(1),
  options: optionsSchema,
  name: z.string().optional(),
  description: z.string().optional(),
});

const updateConnectionSchema = z.object({
  options: optionsSchema.partial().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

export interface ConnectionsRouterOptions {
  dataSourceManager: DataSourceManager;
  stateDb?: StateDatabase;
  encryptionManager?: EncryptionManager;
}

export function createConnectionsRouter(options: ConnectionsRouterOptions): Router {
  const router = Router();
  const { dataSourceManager } = options;

  // GET /api/v1/connections - List all data sources (connections)
  router.get('/', async (_req: Request, res: Response) => {
    const configs = await dataSourceManager.listConfigs();

    // Get metadata from state database if available
    const dbConnections = options.stateDb
      ? await options.stateDb.listConnections()
      : [];
    const metadataMap = new Map(dbConnections.map(c => [c.id, {
      name: c.name,
      description: c.description,
      enabled: c.enabled,
      health_status: c.health_status,
    }]));

    // Fetch health logs for all connections in parallel
    const healthLogsMap = new Map<string, { bucket_start: string; health_status: string; degradation_message?: string }[]>();
    if (options.stateDb) {
      const logs = await Promise.all(
        configs.map(async (config) => ({
          id: config.id,
          stats: await options.stateDb!.getHealthStats(config.id),
        }))
      );
      for (const { id, stats } of logs) {
        healthLogsMap.set(id, stats.map(s => ({
          bucket_start: s.bucket_start instanceof Date ? s.bucket_start.toISOString() : String(s.bucket_start),
          health_status: s.health_status,
          degradation_message: s.degradation_message ?? undefined,
        })));
      }
    }

    const connectionList = configs.map((config) => {
      const metadata = metadataMap.get(config.id);
      return {
        id: config.id,
        type: config.type,
        name: metadata?.name,
        description: metadata?.description,
        // File-config connections are always enabled, DB connections have explicit enabled flag
        enabled: metadata?.enabled ?? true,
        health_status: metadata?.health_status ?? 'green',
        health_log: healthLogsMap.get(config.id) ?? [],
      };
    });

    res.json({
      success: true,
      data: connectionList,
    });
  });

  // GET /api/v1/connections/:id/health/log - Get health stats log
  router.get('/:id/health/log', async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!(await dataSourceManager.hasConnection(id))) {
      res.status(404).json({
        success: false,
        error: { code: 'CONNECTION_NOT_FOUND', message: `Connection '${id}' not found` },
      });
      return;
    }

    if (!options.stateDb) {
      res.json({ success: true, data: [] });
      return;
    }

    const stats = await options.stateDb.getHealthStats(id);
    res.json({ success: true, data: stats });
  });

  // GET /api/v1/connections/:id - Get connection details
  router.get('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const config = await dataSourceManager.getConfig(id);

      // Get metadata from state database if available
      const dbConnection = options.stateDb
        ? await options.stateDb.getConnection(id)
        : undefined;

      res.json({
        success: true,
        data: {
          id: config.id,
          type: config.type,
          name: dbConnection?.name,
          description: dbConnection?.description,
          // File-config connections are always enabled, DB connections have explicit enabled flag
          enabled: dbConnection?.enabled ?? true,
          health_status: dbConnection?.health_status ?? 'green',
          health_thresholds: dbConnection?.health_thresholds ?? { connection_ms: 2000 },
          options: {
            credentials: config.credentials,
            connection: config.connection,
          },
        },
      });
    } catch {
      res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: `Connection '${id}' not found`,
        },
      });
    }
  });

  // GET /api/v1/connections/:id/health - Check connection health
  router.get('/:id/health', async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!(await dataSourceManager.hasConnection(id))) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: `Connection '${id}' not found`,
        },
      });
      return;
    }

    // Look up thresholds from stateDb if available
    const defaultThresholds = { connection_ms: 2000 };
    let thresholds = defaultThresholds;
    if (options.stateDb) {
      const dbConn = await options.stateDb.getConnection(id);
      if (dbConn?.health_thresholds) {
        thresholds = dbConn.health_thresholds;
      }
    }

    let dataSource;
    const startMs = Date.now();
    try {
      dataSource = await dataSourceManager.connectById(id);
    } catch {
      const responseMs = Date.now() - startMs;
      const healthStatus: HealthStatus = 'red';

      if (options.stateDb) {
        const bucketStart = computeBucketStart();
        await options.stateDb.upsertHealthStats(id, bucketStart, healthStatus, 'Connection failed');
        await options.stateDb.updateConnectionHealth(id, healthStatus);
      }

      res.json({
        success: true,
        data: { healthy: false, health_status: healthStatus, response_ms: responseMs },
      });
      return;
    }

    try {
      let healthy: boolean;
      let responseMs: number;

      if (dataSource.isHealthCheckable()) {
        healthy = await dataSource.healthCheck();
        responseMs = Date.now() - startMs;
      } else {
        healthy = true;
        responseMs = Date.now() - startMs;
      }

      // Determine health_status
      let healthStatus: HealthStatus;
      let message: string | undefined;
      if (!healthy) {
        healthStatus = 'red';
        message = 'Health check failed';
      } else if (responseMs > thresholds.connection_ms) {
        healthStatus = 'yellow';
        message = `Slow response: ${responseMs}ms`;
      } else {
        healthStatus = 'green';
      }

      // Write stats if stateDb available
      if (options.stateDb) {
        const bucketStart = computeBucketStart();
        await options.stateDb.upsertHealthStats(id, bucketStart, healthStatus, message);
        await options.stateDb.updateConnectionHealth(id, healthStatus);
      }

      res.json({
        success: true,
        data: { healthy, health_status: healthStatus, response_ms: responseMs },
      });
    } catch {
      const responseMs = Date.now() - startMs;
      const healthStatus: HealthStatus = 'red';

      if (options.stateDb) {
        const bucketStart = computeBucketStart();
        await options.stateDb.upsertHealthStats(id, bucketStart, healthStatus, 'Health check threw error');
        await options.stateDb.updateConnectionHealth(id, healthStatus);
      }

      res.json({
        success: true,
        data: { healthy: false, health_status: healthStatus, response_ms: responseMs },
      });
    } finally {
      await dataSource.shutdown();
    }
  });

  // GET /api/v1/connections/:id/schema - Get schema
  router.get('/:id/schema', async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!(await dataSourceManager.hasConnection(id))) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: `Connection '${id}' not found`,
        },
      });
      return;
    }

    let dataSource;
    try {
      dataSource = await dataSourceManager.connectById(id);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'CONNECTION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to connect',
        },
      });
      return;
    }

    try {
      if (!dataSource.isIntrospectable()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NOT_SUPPORTED',
            message: 'This data source does not support schema introspection',
          },
        });
        return;
      }

      const schema = await dataSource.introspect();
      res.json({
        success: true,
        data: schema,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTROSPECTION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to introspect schema',
        },
      });
    } finally {
      await dataSource.shutdown();
    }
  });

  // POST /api/v1/connections - Create a new connection
  router.post('/', async (req: Request, res: Response) => {
    if (!options.stateDb) {
      res.status(501).json({
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Connection management requires a state database',
        },
      });
      return;
    }

    const parsed = createConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      const flattened = parsed.error.flatten();
      const firstFieldError = Object.values(flattened.fieldErrors)[0];
      const message = firstFieldError?.[0] ?? flattened.formErrors[0] ?? 'Validation failed';
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message,
          details: flattened,
        },
      });
      return;
    }

    const { id, type, options: reqOptions, name, description } = parsed.data;

    // Check if ID exists in file config (can't override)
    const canAdd = await dataSourceManager.canAddToDatabase(id);
    if (!canAdd) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONNECTION_EXISTS',
          message: `Connection '${id}' already exists in file configuration`,
        },
      });
      return;
    }

    // Check if already exists in database
    const exists = await options.stateDb.connectionExists(id);
    if (exists) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONNECTION_EXISTS',
          message: `Connection '${id}' already exists`,
        },
      });
      return;
    }

    // Encrypt sensitive credentials before saving
    let processedOptions = { ...reqOptions };
    if (options.encryptionManager) {
      const factory = dataSourceManager.getFactory(type);
      if (factory?.credentialsFields) {
        processedOptions = {
          ...processedOptions,
          credentials: await options.encryptionManager.encryptCredentials(
            reqOptions.credentials,
            factory.credentialsFields
          ),
        };
      }
    }

    await options.stateDb.createConnection({ id, type, options: processedOptions, name, description });

    res.status(201).json({
      success: true,
      data: { id, type, name, description, enabled: false },
    });
  });

  // PUT /api/v1/connections/:id - Update a connection
  router.put('/:id', async (req: Request, res: Response) => {
    if (!options.stateDb) {
      res.status(501).json({
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Connection management requires a state database',
        },
      });
      return;
    }

    const { id } = req.params;

    const parsed = updateConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      const flattened = parsed.error.flatten();
      const firstFieldError = Object.values(flattened.fieldErrors)[0];
      const message = firstFieldError?.[0] ?? flattened.formErrors[0] ?? 'Validation failed';
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message,
          details: flattened,
        },
      });
      return;
    }

    // Check if this is a file-config connection (not editable)
    const canAdd = await dataSourceManager.canAddToDatabase(id);
    if (!canAdd) {
      res.status(403).json({
        success: false,
        error: {
          code: 'CONNECTION_READONLY',
          message: `Connection '${id}' is defined in file configuration and cannot be modified`,
        },
      });
      return;
    }

    // Check if exists in database
    const existing = await options.stateDb.getConnection(id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: `Connection '${id}' not found`,
        },
      });
      return;
    }

    // Encrypt sensitive credentials if provided
    const { options: reqOptions, ...restData } = parsed.data;
    let updateData: Record<string, unknown> = { ...restData };
    if (reqOptions) {
      let processedOptions = { ...reqOptions };
      if (reqOptions.credentials && options.encryptionManager) {
        const factory = dataSourceManager.getFactory(existing.type);
        if (factory?.credentialsFields) {
          processedOptions = {
            ...processedOptions,
            credentials: await options.encryptionManager.encryptCredentials(
              reqOptions.credentials,
              factory.credentialsFields
            ),
          };
        }
      }
      updateData.options = processedOptions;
    }

    await options.stateDb.updateConnection(id, updateData);

    const updated = await options.stateDb.getConnection(id);
    res.json({
      success: true,
      data: {
        id: updated!.id,
        type: updated!.type,
        name: updated!.name,
        description: updated!.description,
        enabled: updated!.enabled,
      },
    });
  });

  // DELETE /api/v1/connections/:id - Delete a connection
  router.delete('/:id', async (req: Request, res: Response) => {
    if (!options.stateDb) {
      res.status(501).json({
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Connection management requires a state database',
        },
      });
      return;
    }

    const { id } = req.params;

    // Check if this is a file-config connection (not deletable)
    const canAdd = await dataSourceManager.canAddToDatabase(id);
    if (!canAdd) {
      res.status(403).json({
        success: false,
        error: {
          code: 'CONNECTION_READONLY',
          message: `Connection '${id}' is defined in file configuration and cannot be deleted`,
        },
      });
      return;
    }

    // Check if exists in database
    const exists = await options.stateDb.connectionExists(id);
    if (!exists) {
      res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: `Connection '${id}' not found`,
        },
      });
      return;
    }

    await options.stateDb.deleteConnection(id);

    res.json({
      success: true,
      data: { deleted: id },
    });
  });

  return router;
}
