---
sidebar_position: 3
---

# Plugin Development

This guide walks through creating a new data source driver package for Maetrik.

## Package Structure

```
datasource-mydb/
├── src/
│   └── index.ts          # Driver class + dataSourceFactory export
├── assets/
│   └── mydb.png          # Optional icon
├── package.json
└── tsconfig.json
```

### package.json

```json
{
  "name": "maetrik-datasource-mydb",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "peerDependencies": {
    "@maetrik/shared": "workspace:*"
  },
  "dependencies": {
    "mydb-client": "^1.0.0"
  }
}
```

**Requirements:**
- Package name must match `maetrik-datasource-*` (or `@maetrik/datasource-*` for first-party plugins)
- Must be ESM (`"type": "module"`)
- Entry point must export `dataSourceFactory`
- Peer depend on `@maetrik/shared` for types

## Driver Class

Every driver extends `BaseDataSourceDriver` and optionally implements capability interfaces:

```typescript
import {
  BaseDataSourceDriver,
  type DataSourceConfig,
  type QueryResult,
  type SchemaDefinition,
  type Queryable,
  type Introspectable,
  type HealthCheckable,
  DataSourceError,
} from '@maetrik/shared';

export class MyDriver
  extends BaseDataSourceDriver
  implements Queryable, Introspectable, HealthCheckable
{
  readonly type = 'mydb';
  readonly queryLanguage = 'sql'; // 'sql' | 'mql' | 'cypher' | 'graphql' | 'custom'
  private _name = '';

  get name() {
    return this._name;
  }

  async init(config: DataSourceConfig): Promise<void> {
    this._name = config.id;
    // Connect to your data source using config.credentials
  }

  async shutdown(): Promise<void> {
    // Clean up connections
  }

  // Queryable
  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    // Execute query and return results
  }

  // Introspectable
  async introspect(): Promise<SchemaDefinition> {
    // Return schema (tables, columns, types)
  }

  // HealthCheckable
  async healthCheck(): Promise<boolean> {
    // Return true if connection is alive
  }
}
```

### Required Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Instance name (usually set from `config.id` in `init()`) |
| `type` | `string` | Driver type identifier (e.g., `postgres`, `mysql`) |
| `queryLanguage` | `QueryLanguage` | Query syntax the driver speaks — used by the LLM to generate correct queries |

### Lifecycle Methods

Every driver must implement:

- **`init(config)`** — Initialize the driver with connection credentials. Throw `DataSourceError` on failure.
- **`shutdown()`** — Release resources. Must be safe to call even if `init()` was never called.

### Capabilities

Capabilities are detected automatically by probing the driver instance at registration time. Just implement the interface — no declaration needed.

| Interface | Methods | Purpose |
|-----------|---------|---------|
| `Queryable` | `execute(sql, params?)` | Execute queries |
| `Introspectable` | `introspect()` | Discover schema (tables, columns, types) |
| `HealthCheckable` | `healthCheck()` | Test connection liveness |
| `Transactional` | `beginTransaction()` → `Transaction { execute, commit, rollback }` | Transaction support |

### Error Handling

It is recommended to wrap errors in `DataSourceError` with an appropriate code. Plain errors will still propagate, but the manager won't retry them — only errors with `retryable: true` are retried when `maxRetries` is configured.

```typescript
throw new DataSourceError({
  code: 'CONNECTION_FAILED',
  message: 'Database server unreachable',
  driverCode: 'ECONNREFUSED',
  cause: originalError,
  retryable: true,
});
```

Available error codes:

| Code | Meaning |
|------|---------|
| `CONNECTION_FAILED` | Cannot reach server |
| `AUTHENTICATION_FAILED` | Bad credentials |
| `QUERY_SYNTAX` | Malformed query |
| `QUERY_EXECUTION` | Constraint violation, timeout, etc. |
| `TIMEOUT` | Operation took too long |
| `NOT_INITIALIZED` | Driver not ready |
| `DRIVER_ERROR` | Catch-all |

Set `retryable: true` for transient errors (network issues, timeouts). The manager will retry based on the connection's `maxRetries` setting.

## Factory Export

Each driver package must export a `dataSourceFactory`:

```typescript
import type { DataSourceFactory } from '@maetrik/shared';

export const dataSourceFactory: DataSourceFactory = {
  type: 'mydb',
  displayName: 'My Database',
  description: 'Connect to My Database instances',
  credentialsSchema: {
    type: 'object',
    required: ['host', 'database'],
    properties: {
      host: { type: 'string', description: 'Database host' },
      port: { type: 'integer', default: 5432 },
      database: { type: 'string', description: 'Database name' },
      user: { type: 'string' },
      password: { type: 'string' },
    },
  },
  credentialsFields: {
    host: { placeholder: 'localhost' },
    port: { type: 'number', placeholder: '5432' },
    database: {},
    user: {},
    password: { type: 'password', sensitive: true },
  },
  create: () => new MyDriver(),
};
```

### Factory Properties

| Property | Required | Description |
|----------|----------|-------------|
| `type` | Yes | Driver type identifier |
| `displayName` | Yes | Human-readable name for the UI |
| `description` | No | Short description |
| `iconPath` | No | Relative path to icon file (resolved to base64 data URI) |
| `credentialsSchema` | Yes | JSON Schema defining the credentials shape |
| `credentialsFields` | No | UI metadata and sensitive field markers |
| `create()` | Yes | Factory function returning a new driver instance |

### Credentials Fields

The `credentialsFields` object provides UI hints and security markers for each credential field:

```typescript
credentialsFields: {
  host: { placeholder: 'localhost' },
  password: { type: 'password', sensitive: true },
  ssl: { type: 'boolean', label: 'Use SSL' },
  ca: { label: 'CA Certificate', sensitive: true },
}
```

| Option | Type | Description |
|--------|------|-------------|
| `label` | `string` | Display label (defaults to prettified field name) |
| `type` | `'text' \| 'password' \| 'number' \| 'boolean'` | Input type |
| `placeholder` | `string` | Placeholder text |
| `helpText` | `string` | Help text shown below the field |
| `sensitive` | `boolean` | If `true`, the field is encrypted at rest and never exposed in API responses |
