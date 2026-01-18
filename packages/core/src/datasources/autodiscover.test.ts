import { describe, it, expect, vi, beforeEach } from 'vitest';
import { autodiscoverDataSources, isValidDataSourceFactory } from './autodiscover.js';
import type { DataSourceFactory } from '@maetrik/shared';
import { z } from 'zod';

const validFactory: DataSourceFactory = {
  type: 'test',
  displayName: 'Test Database',
  capabilities: {
    queryable: true,
    introspectable: true,
    healthCheckable: true,
    transactional: false,
  },
  credentialsSchema: z.object({}),
  create: () => ({} as any),
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

  it('returns false if capabilities is missing', () => {
    const { capabilities, ...invalid } = validFactory;
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
