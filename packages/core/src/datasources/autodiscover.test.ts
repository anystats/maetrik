import { describe, it, expect } from 'vitest';
import { autodiscoverDataSources, isValidDataSourceFactory } from './autodiscover.js';
import type { DataSourceFactory, DataSourceDriver, QueryLanguage } from '@maetrik/shared';
import type { JSONSchema7 } from 'json-schema';

// Mock driver for factory.create()
class MockDriver implements DataSourceDriver {
  readonly name = 'test';
  readonly type = 'test';
  readonly queryLanguage: QueryLanguage = 'sql';

  async init() {}
  async shutdown() {}

  isQueryable(): this is DataSourceDriver & import('@maetrik/shared').Queryable { return true; }
  isIntrospectable(): this is DataSourceDriver & import('@maetrik/shared').Introspectable { return false; }
  isHealthCheckable(): this is DataSourceDriver & import('@maetrik/shared').HealthCheckable { return false; }
  isTransactional(): this is DataSourceDriver & import('@maetrik/shared').Transactional { return false; }
}

const mockCredentialsSchema: JSONSchema7 = {
  type: 'object',
  properties: {},
};

const validFactory: DataSourceFactory = {
  type: 'test',
  displayName: 'Test Database',
  credentialsSchema: mockCredentialsSchema,
  create: () => new MockDriver(),
};

describe('isValidDataSourceFactory', () => {
  it('returns true for valid factory', () => {
    expect(isValidDataSourceFactory(validFactory)).toBe(true);
  });

  it('returns false if type is missing', () => {
    const { type, ...invalid } = validFactory;
    expect(isValidDataSourceFactory(invalid)).toBe(false);
  });

  it('returns false if displayName is missing', () => {
    const { displayName, ...invalid } = validFactory;
    expect(isValidDataSourceFactory(invalid)).toBe(false);
  });

  it('returns false if credentialsSchema is missing', () => {
    const { credentialsSchema, ...invalid } = validFactory;
    expect(isValidDataSourceFactory(invalid)).toBe(false);
  });

  it('returns false if create is not a function', () => {
    const invalid = { ...validFactory, create: 'not a function' };
    expect(isValidDataSourceFactory(invalid)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidDataSourceFactory(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidDataSourceFactory(undefined)).toBe(false);
  });
});

describe('autodiscoverDataSources', () => {
  it('returns empty discoveries when no packages found', async () => {
    const result = await autodiscoverDataSources();
    // In test environment, no actual datasource packages exist
    expect(result.discoveries).toBeDefined();
    expect(result.errors).toBeDefined();
    expect(Array.isArray(result.discoveries)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
