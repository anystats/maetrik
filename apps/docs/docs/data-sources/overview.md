---
sidebar_position: 1
---

# Overview

Maetrik uses a plugin system for data source drivers. Each driver is a standalone package that implements a standard contract. Drivers are auto-discovered at startup — just install the package and it works.

## Available Plugins

| Package | Data Source | Query Language |
|---------|-------------|----------------|
| `@maetrik/datasource-postgres` | PostgreSQL | SQL |

More drivers can be added as community or first-party packages.

## Installing a Plugin

Install the driver package into the Maetrik project:

```bash
pnpm add @maetrik/datasource-postgres
```

That's it. On next startup, Maetrik will auto-discover the package and register the driver. No manual imports or configuration needed.

### How Autodiscovery Works

Maetrik scans `node_modules` at startup for packages matching:

- `@maetrik/datasource-*` (first-party plugins)
- `maetrik-datasource-*` (community plugins)

Each package must export a `dataSourceFactory` object. Maetrik validates the factory, probes the driver instance for supported capabilities, and registers it.

## Configuring a Data Source

Once a plugin is installed, you can register connections to it in two ways:

### Via Config File

Add an entry to `dataSources` in `maetrik.config.yaml`:

```yaml
dataSources:
  - id: my-postgres
    type: postgres
    credentials:
      host: localhost
      port: 5432
      database: myapp
      user: ${DB_USER}
      password: ${DB_PASSWORD}
```

The `type` field must match the driver's registered type (e.g., `postgres`). Each driver defines its own credentials schema — see the driver's documentation for available fields.

### Via API

Create connections at runtime through the REST API:

```
POST /api/v1/connections
```

```json
{
  "id": "my-postgres",
  "type": "postgres",
  "credentials": {
    "host": "localhost",
    "port": 5432,
    "database": "myapp",
    "user": "admin",
    "password": "secret"
  }
}
```

See [Registering Connections](./connections.md) for full API reference.

## Listing Available Drivers

To see which driver types are available after autodiscovery:

```
GET /api/v1/datasources/types
```

Returns the list of registered drivers with their display names, descriptions, and icons.

## Developing a Custom Plugin

If you need to connect to a data source that doesn't have an existing driver, you can build your own. See [Plugin Development](./plugin-development.md) for the full guide covering driver contract, factory export, capabilities, error handling, and package structure.
