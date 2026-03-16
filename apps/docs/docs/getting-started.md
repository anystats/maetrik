---
sidebar_position: 2
---

# Getting Started

## Prerequisites

- Node.js 18+
- pnpm 8+
- A PostgreSQL database (for data source queries)
- An LLM provider: [Ollama](https://ollama.ai) (local) or OpenAI API key

## Installation

```bash
git clone https://github.com/anystats/maetrik.git
cd maetrik
pnpm install
```

## Configuration

Copy the example config and edit it:

```bash
cp maetrik.config.example.yaml maetrik.config.yaml
```

### Data Sources

Configure your database connections in the config file:

```yaml
dataSources:
  - id: my-db
    type: postgres
    credentials:
      host: localhost
      port: 5432
      database: myapp
      user: myuser
      password: mypassword
```

Connections defined here are locked for changes by API and Web. You can also create and manage connections at runtime through the API. See [Registering Connections](./data-sources/connections.md) for details.

### LLM Provider

Choose Ollama (local, free) or OpenAI:

```yaml
# Ollama (default)
llm:
  driver: ollama
  model: llama3
  baseUrl: http://localhost:11434

# OpenAI
llm:
  driver: openai
  model: gpt-4o
  apiKey: ${OPENAI_API_KEY}
```

See [Configuration — LLM Provider](./configuration.md#llm-provider) for all options.

### State Storage

Maetrik uses an internal database for app state. PGLite (embedded) requires no setup:

```yaml
stateStorage:
  type: pglite
  path: ./data/state.db
```

See [Configuration — State Storage](./configuration.md#state-storage) for production setup with PostgreSQL.

## Running

```bash
pnpm dev
```

- API server: `http://localhost:3000`
- Web UI: `http://localhost:3001`
