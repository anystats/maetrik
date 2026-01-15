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