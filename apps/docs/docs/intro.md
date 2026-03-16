---
sidebar_position: 1
slug: /intro
---

# Introduction

Maetrik is an AI-first data retrieval framework. Ask questions in plain language or connect it to your AI agent system and get answers based on your data stores.

## How it works

1. You ask a question in natural language (e.g. "How many users signed up last month?")
2. Maetrik investigates and translates it into semantic business entities
3. The question and requirements are built as an appropriate query (for SQL-like sources) or API retrieval (for web-based sources) with LLM supervision
4. The query is validated and executed against your configured data source
5. Results are returned to you

## Architecture

Maetrik is a monorepo with the following packages:

| Package | Description |
|---------|-------------|
| `@maetrik/shared` | Base utilities — config, logger, types |
| `@maetrik/core` | Business logic — data sources, connections, LLM, query translation |
| `@maetrik/datasource-*` | Data source prebuilt packages |
| `@maetrik/server` | Express API server |
| `@maetrik/web` | Web UI over server API |

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development (all packages)
pnpm dev
```

The API server runs on `http://localhost:3000` and the web UI on `http://localhost:3001`.

See [Getting Started](./getting-started.md) for full setup instructions.
