# maetrik

Natural language data retrieval framework. Ask questions in plain English, get answers from your data sources.

**SQL-targeted, query-language agnostic.** Primary focus is SQL databases (PostgreSQL, MySQL, etc.), with an extensible architecture that doesn't lock out future support for other query languages (MongoDB, Neo4j, etc.).

## Quick Start

```bash
# Clone and install
git clone https://github.com/your-org/maetrik.git
cd maetrik
pnpm install

# Configure
cp maetrik.config.example.yaml maetrik.config.yaml
# Edit maetrik.config.yaml with your database and LLM settings

# Start development
pnpm dev
```

## Configuration

Maetrik uses a single YAML configuration file (`maetrik.config.yaml`). Use `${ENV_VAR}` syntax to inject environment variables for secrets and per-environment values:

```yaml
connections:
  main:
    driver: postgres
    host: ${DB_HOST}
    database: ${DB_NAME}
    user: ${DB_USER}
    password: ${DB_PASSWORD}

llm:
  driver: openai
  apiKey: ${OPENAI_API_KEY}
```

Missing environment variables resolve to empty strings. Zod schema defaults apply for omitted fields (e.g., `server.port` defaults to `3000`).

## Development

```bash
# Run all tests
pnpm test

# Type check
pnpm typecheck

# Build all packages
pnpm build
```

## Docker

```bash
# Build and run
docker-compose -f docker/docker-compose.yaml up

# Or build image only
docker build -f docker/Dockerfile -t maetrik .
```

## Project Structure

```
maetrik/
├── apps/
│   ├── server/              # Express API server
│   └── web/                 # Next.js frontend (in development)
├── packages/
│   ├── shared/              # Types, config, logger
│   ├── core/                # Business logic, data sources, LLM, query translation
│   └── datasource-postgres/ # PostgreSQL driver (reference implementation)
├── docker/                  # Docker configuration
└── docs/                    # Documentation
```

## License

AGPL-3.0