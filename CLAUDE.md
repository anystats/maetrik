# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Maetrik is a natural language data retrieval framework. Users ask questions in plain English, and the system translates them to SQL using an LLM, executes against configured databases, and returns results.

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

**LLM Registry Pattern** (`packages/core/src/llm/`):
- Same registry pattern as data sources
- Supports OpenAI and Ollama providers
- Add new providers by implementing `LLMDriver` interface

**Query Translation Flow** (`packages/core/src/query/`):
1. `SemanticLayer` introspects database schema
2. `QueryTranslator` builds prompts with schema context
3. LLM generates SQL with explanation and confidence
4. SQL validated (SELECT-only) before execution

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
- `GET /api/v1/connections/:id/health` - Test connection health
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
