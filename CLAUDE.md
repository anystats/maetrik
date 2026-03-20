# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Maetrik is a natural language data retrieval framework. Users ask questions in plain English, and the system translates them to the appropriate query language using an LLM, executes against configured data sources, and returns results.

**SQL-targeted, query-language agnostic:** The primary focus is SQL databases (PostgreSQL, MySQL, SQLite, etc.), but the architecture is designed to support other query languages (MongoDB's MQL, Neo4j's Cypher, GraphQL, etc.) without breaking changes. SQL is the default and optimized path; other query languages are considered "exotic" extensions.

Dont forget update docs in project when something significant was updated.

## Commands

```bash
# Install dependencies
pnpm install

# Development (all packages in watch mode)
pnpm dev

# Build all packages
pnpm build

# Type check without building
pnpm typecheck

# Run all tests
pnpm test

# Run tests in a specific package
pnpm --filter @maetrik/shared test
pnpm --filter @maetrik/core test
pnpm --filter @maetrik/server test

# Run a single test file
pnpm --filter @maetrik/shared vitest run path/to/test.spec.ts

# Watch mode for tests
pnpm --filter @maetrik/shared test:watch

# Clean build artifacts
pnpm clean

# Docker
docker-compose -f docker/docker-compose.yaml up
docker build -f docker/Dockerfile -t maetrik .
```

## Architecture

### Monorepo Structure (Turbo + pnpm workspaces)

Build order matters due to dependencies:
1. `packages/shared` - Base utilities (config, logger, types)
2. `packages/core` - Business logic (data sources, connections, LLM, query translation, state database)
3. `packages/datasource-postgres` - PostgreSQL data source driver
4. `apps/server` - Express API server (depends on all above)
5. `apps/web` - Next.js frontend (in development)

### Key Architectural Patterns

**Data Source Pattern** (`packages/core/src/datasources/`):
- `registry.ts` - Factory registry for data source drivers
- `manager.ts` - Stateless manager with lazy instantiation (callers manage driver lifecycle)
- `autodiscover.ts` - Auto-discovers `@maetrik/datasource-*` packages
- `base-driver.ts` - Abstract base class with type guard methods
- Capability-based interfaces: `Queryable`, `Introspectable`, `HealthCheckable`, `Transactional`
- Drivers declare `queryLanguage` (sql, mql, cypher, etc.) for LLM/translator awareness

**Connection Config Resolver** (`packages/core/src/connections/`):
- `sources/file.ts` - Loads connections from config file (read-only)
- `sources/database.ts` - Loads connections from state database (mutable via API)
- `resolver.ts` - Combines sources with duplicate validation
- Same connection ID in both sources is an error

**State Database** (`packages/core/src/state/`):
- Internal storage for app state (connections, future: queries, dashboards)
- `pglite.ts` - PGLite implementation (embedded, for npm/local)
- `postgres.ts` - PostgreSQL implementation (for Docker/production)
- `factory.ts` - Creates appropriate implementation based on config
- Connections track `health_status` (green/yellow/red) and configurable `health_thresholds` (connection_ms)
- `connection_health_log` table stores 30-min bucketed health stats (48h retention, worst-wins within bucket)

**Health Monitor** (`packages/core/src/health/`):
- Background service checking connection health on a configurable interval (default 5min)
- Only runs healthcheck when current 30-min bucket has no record yet
- Compares response time to per-connection `health_thresholds.connection_ms`
- Green (healthy + fast), Yellow (healthy + slow), Red (failed)
- Started/stopped in server lifecycle (`apps/server/src/index.ts`)

**LLM Registry Pattern** (`packages/core/src/llm/`):
- Same registry pattern as data sources
- Supports OpenAI and Ollama providers
- Add new providers by implementing `LLMDriver` interface

**Query Translation Flow** (`packages/core/src/query/`):
1. `SemanticLayer` introspects data source schema
2. `QueryTranslator` builds prompts with schema context and target query language
3. LLM generates query (SQL for relational DBs, or native query language for others) with explanation and confidence
4. Query validated before execution (SELECT-only for SQL)

### API Endpoints (apps/server)

**Query:**
- `POST /api/v1/ask` - Natural language query (main feature)
- `POST /api/v1/query` - Raw SQL execution (SELECT only)

**Connections (CRUD):**
- `GET /api/v1/connections` - List all connections
- `GET /api/v1/connections/:id` - Get connection details
- `POST /api/v1/connections` - Create connection (database-stored only)
- `PUT /api/v1/connections/:id` - Update connection (database-stored only)
- `DELETE /api/v1/connections/:id` - Delete connection (database-stored only)
- `GET /api/v1/connections/:id/health` - Test connection health (writes stats, returns health_status + response_ms)
- `GET /api/v1/connections/:id/health/log` - Get 48h health stats history (30-min buckets)
- `GET /api/v1/connections/:id/schema` - Introspect schema

**Data Sources:**
- `GET /api/v1/datasources/types` - List available driver types
- `GET /api/v1/datasources` - List configured data sources
- `POST /api/v1/datasources/:id/test` - Test connection

### Configuration

Uses `maetrik.config.yaml` with `${ENV_VAR}` interpolation. Schema validated with Zod in `packages/shared/src/config/`.

```yaml
dataSources:
  - id: "main-db"
    type: postgres
    credentials:
      host: ${DB_HOST}
      port: 5432
      database: ${DB_NAME}

stateDatabase:
  type: pglite  # or 'postgres'
  path: ./data/state.db
```

### Package Exports

`@maetrik/shared` has multiple entry points:
- `@maetrik/shared` - Main exports (config, logger)
- `@maetrik/shared/types` - Type definitions only

`@maetrik/core` exports:
- Data source types and factories
- Connection config resolver
- State database implementations
- LLM and query translation

## Key Files

- `packages/shared/src/config/schema.ts` - Zod config schemas with defaults
- `packages/core/src/datasources/manager.ts` - Stateless data source manager
- `packages/core/src/connections/resolver.ts` - Multi-source connection resolver
- `packages/core/src/state/pglite.ts` - PGLite state database
- `packages/core/src/query/translator.ts` - NL to SQL translation logic
- `apps/server/src/routes/connections.ts` - Connections CRUD API
