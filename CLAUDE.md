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
2. `packages/core` - Business logic (drivers, LLM, query translation)
3. `packages/driver-postgres` - PostgreSQL driver implementation
4. `apps/server` - Express API server (depends on all above)

### Key Architectural Patterns

**Driver Registry Pattern** (`packages/core/src/drivers/`):
- `registry.ts` - Factory registry for database drivers
- `manager.ts` - Lifecycle management (init, health, shutdown)
- `autodiscover.ts` - Auto-discovers available driver packages
- New drivers extend the `DatabaseDriver` interface from `@maetrik/shared/types`

**LLM Registry Pattern** (`packages/core/src/llm/`):
- Same registry pattern as drivers
- Supports OpenAI and Ollama providers
- Add new providers by implementing `LLMDriver` interface

**Query Translation Flow** (`packages/core/src/query/`):
1. `SemanticLayer` introspects database schema
2. `QueryTranslator` builds prompts with schema context
3. LLM generates SQL with explanation and confidence
4. SQL validated (SELECT-only) before execution

### API Endpoints (apps/server)

- `POST /api/v1/ask` - Natural language query (main feature)
- `POST /api/v1/query` - Raw SQL execution (SELECT only)
- `GET /api/v1/connections` - List database connections
- `GET /api/v1/connections/:name/schema` - Introspect schema

### Configuration

Uses `maetrik.config.yaml` with `${ENV_VAR}` interpolation. Schema validated with Zod in `packages/shared/src/config/`.

### Package Exports

`@maetrik/shared` has multiple entry points:
- `@maetrik/shared` - Main exports (config, logger)
- `@maetrik/shared/types` - Type definitions only

## Key Files

- `packages/shared/src/config/schema.ts` - Zod config schemas with defaults
- `packages/core/src/query/translator.ts` - NL to SQL translation logic
- `packages/core/src/query/prompts.ts` - LLM prompt engineering
- `apps/server/src/routes/ask.ts` - Main /ask endpoint handler
