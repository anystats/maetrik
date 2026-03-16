---
sidebar_position: 3
---

# Configuration

Maetrik is configured via `maetrik.config.yaml` in the project root. All string values support environment variable interpolation with `${VAR}` syntax.

The full validation schema is defined in [`packages/shared/src/config/schema.ts`](https://github.com/anystats/maetrik/blob/main/packages/shared/src/config/schema.ts).

## Server

```yaml
server:
  port: 3000
  host: localhost
  cors:
    origins:
      - http://localhost:3001
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | number | `3000` | HTTP server port |
| `host` | string | `localhost` | Bind address |
| `cors.origins` | string[] | `[]` | Allowed CORS origins |

## Data Sources

Data sources defined in config are loaded at startup and locked for changes by API and Web. See [Registering Connections](./data-sources/connections.md) for managing connections at runtime.

```yaml
dataSources:
  - id: main-db
    type: postgres
    credentials:
      host: ${DB_HOST}
      port: 5432
      database: ${DB_NAME}
      user: ${DB_USER}
      password: ${DB_PASSWORD}
    connection:
      timeoutMs: 30000
      maxRetries: 3
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | — | Unique identifier (alphanumeric, dashes, underscores) |
| `type` | string | Yes | — | Driver type (e.g., `postgres`) |
| `credentials` | object | Yes | — | Driver-specific credentials |
| `connection.timeoutMs` | number | No | `30000` | Connection timeout in ms |
| `connection.idleTimeoutMs` | number | No | `60000` | Idle timeout in ms |
| `connection.maxRetries` | number | No | `0` | Retry attempts on failure |
| `connection.retryDelayMs` | number | No | `1000` | Delay between retries in ms |

The `credentials` shape depends on the driver. See the driver's documentation for available fields.

## LLM Provider

Maetrik uses an LLM to translate natural language questions into queries. Two providers are supported.

### Ollama (local)

```yaml
llm:
  driver: ollama
  model: llama3
  baseUrl: http://localhost:11434
```

### OpenAI

```yaml
llm:
  driver: openai
  model: gpt-4o
  apiKey: ${OPENAI_API_KEY}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `driver` | string | `ollama` | Provider: `ollama` or `openai` |
| `model` | string | `llama3` | Model name |
| `baseUrl` | string | — | Ollama server URL |
| `apiKey` | string | — | OpenAI API key |

## Encryption

Controls how credentials are encrypted when stored in the state database. Each profile defines an encryption strategy.

```yaml
encryption:
  default: local
  profiles:
    local:
      mode: plaintext
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `default` | string | — | Default profile name |
| `profiles` | object | `{}` | Named encryption profiles |

### Profile modes

| Mode | Description |
|------|-------------|
| `plaintext` | No encryption — credentials stored as-is. Suitable for local development |
| `encrypted` | Encrypt credentials at rest using a configured driver |
| `external` | Delegate to an external secrets manager |

Encrypted and external modes accept additional driver-specific options.

## State Storage

Internal database for Maetrik app state (connections, queries, etc.).

### PGLite (embedded)

No external dependencies — suitable for local development and single-instance deployments.

```yaml
stateStorage:
  type: pglite
  path: ./data/state.db
```

### PostgreSQL (external)

For production and multi-instance deployments.

```yaml
stateStorage:
  type: postgres
  connectionString: ${STATE_DATABASE_URL}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | `pglite` | Storage backend: `pglite` or `postgres` |
| `path` | string | — | File path for PGLite |
| `connectionString` | string | — | PostgreSQL connection URL |

## Full Example

```yaml
server:
  port: 3000
  host: localhost

dataSources:
  - id: main-db
    type: postgres
    credentials:
      host: ${DB_HOST}
      port: 5432
      database: ${DB_NAME}
      user: ${DB_USER}
      password: ${DB_PASSWORD}

llm:
  driver: ollama
  model: llama3
  baseUrl: http://localhost:11434

encryption:
  default: local
  profiles:
    local:
      mode: plaintext

stateStorage:
  type: pglite
  path: ./data/state.db
```
