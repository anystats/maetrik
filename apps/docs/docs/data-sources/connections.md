---
sidebar_position: 2
---

# Registering Connections

There are two ways to register data source connections in Maetrik. Both can coexist, but the same connection ID cannot appear in both sources.

## Via Config File

Define connections in `maetrik.config.yaml`. These are loaded at startup and locked for changes by API and Web.

```yaml
dataSources:
  - id: production-db
    type: postgres
    credentials:
      host: ${DB_HOST}
      port: 5432
      database: production
      user: ${DB_USER}
      password: ${DB_PASSWORD}
    connection:
      timeoutMs: 45000
      maxRetries: 3
      retryDelayMs: 2000
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier (alphanumeric, dashes, underscores) |
| `type` | Yes | Driver type (e.g., `postgres`) |
| `credentials` | Yes | Driver-specific credentials |
| `connection.timeoutMs` | No | Connection timeout in ms (default: 30000) |
| `connection.idleTimeoutMs` | No | Idle timeout in ms (default: 60000) |
| `connection.maxRetries` | No | Retry attempts on failure (default: 0) |
| `connection.retryDelayMs` | No | Delay between retries in ms (default: 1000) |

Environment variable interpolation (`${VAR}`) is supported in all string values.

The full validation schema is defined in [`packages/shared/src/config/schema.ts`](https://github.com/anystats/maetrik/blob/main/packages/shared/src/config/schema.ts) (`dataSourceConfigSchema` and `connectionOptionsSchema`).

## Via API

Create, update, and delete connections at runtime through the REST API. These are stored in the state database and credentials are encrypted at rest.

Requires a configured state database (`stateStorage` in config).

### Create Connection

```
POST /api/v1/connections
```

```json
{
  "id": "analytics-db",
  "type": "postgres",
  "credentials": {
    "host": "analytics.example.com",
    "port": 5432,
    "database": "analytics",
    "user": "reader",
    "password": "secret"
  },
  "name": "Analytics Database",
  "description": "Read-only analytics replica"
}
```

**Response** (201):
```json
{
  "success": true,
  "data": {
    "id": "analytics-db",
    "type": "postgres",
    "name": "Analytics Database",
    "description": "Read-only analytics replica",
    "enabled": false
  }
}
```

New connections are created with `enabled: false` by default.

### Update Connection

```
PUT /api/v1/connections/:id
```

```json
{
  "credentials": { "password": "new-secret" },
  "enabled": true,
  "description": "Updated description"
}
```

At least one field must be provided. Only database-stored connections can be updated — file-config connections return `403`.

### Delete Connection

```
DELETE /api/v1/connections/:id
```

Only database-stored connections can be deleted. File-config connections return `403`.

### List Connections

```
GET /api/v1/connections
```

Returns all connections from both sources. Credentials are not included in the list response.

### Get Connection Details

```
GET /api/v1/connections/:id
```

Returns full connection details including credentials in plaintext. Sensitive fields are decrypted from storage before being returned — keep this in mind if the API is exposed beyond localhost.

### Test Connection Health

```
GET /api/v1/connections/:id/health
```

### Introspect Schema

```
GET /api/v1/connections/:id/schema
```
