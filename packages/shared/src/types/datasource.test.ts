import { describe, it, expect } from 'vitest';
import type {
  DataSourceCapabilities,
  DataSourceConfig,
  DataSourceDriver,
  DataSourceFactory,
  Queryable,
  Introspectable,
  HealthCheckable,
  Transactional,
  Transaction,
  QueryResult,
  SchemaDefinition,
} from './datasource.js';

describe('DataSource Types', () => {
  it('should define DataSourceCapabilities interface', () => {
    const caps: DataSourceCapabilities = {
      queryable: true,
      introspectable: true,
      healthCheckable: true,
      transactional: false,
    };
    expect(caps.queryable).toBe(true);
  });

  it('should define DataSourceConfig with flexible credentials', () => {
    const config: DataSourceConfig = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      type: 'postgres',
      credentials: {
        host: 'localhost',
        port: 5432,
        database: 'test',
      },
    };
    expect(config.id).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(config.credentials.host).toBe('localhost');
  });

  it('should define DataSourceFactory with displayName and credentialsSchema', () => {
    const factory: DataSourceFactory = {
      type: 'postgres',
      displayName: 'PostgreSQL',
      capabilities: {
        queryable: true,
        introspectable: true,
        healthCheckable: true,
        transactional: true,
      },
      credentialsSchema: {} as any,
      create: () => ({} as DataSourceDriver),
    };
    expect(factory.displayName).toBe('PostgreSQL');
  });
});
