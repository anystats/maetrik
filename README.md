# maetrik

Natural language data retrieval framework. Ask questions, get answers from your database.

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
│   └── server/          # API server
├── packages/
│   └── shared/          # Types, config, logger
├── docker/              # Docker configuration
└── docs/                # Documentation
```

## License

AGPL-3.0