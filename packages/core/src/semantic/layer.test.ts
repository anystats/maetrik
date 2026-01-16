import { describe, it, expect, beforeEach } from 'vitest';
import { createSemanticLayer } from './layer.js';
import type { SchemaDefinition } from '@maetrik/shared';
import type { SemanticLayer } from './types.js';

describe('SemanticLayer', () => {
  const baseSchema: SchemaDefinition = {
    tables: {
      users: {
        name: 'users',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
          { name: 'email', type: 'varchar', nullable: false },
          { name: 'name', type: 'varchar', nullable: true },
        ],
      },
      orders: {
        name: 'orders',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
          { name: 'user_id', type: 'uuid', nullable: false },
          { name: 'total_cents', type: 'integer', nullable: false },
          { name: 'status', type: 'varchar', nullable: false },
        ],
      },
    },
  };

  let layer: SemanticLayer;

  beforeEach(() => {
    layer = createSemanticLayer(baseSchema);
  });

  it('returns enriched schema', () => {
    const schema = layer.getSchema();

    expect(schema.tables).toHaveProperty('users');
    expect(schema.tables).toHaveProperty('orders');
  });

  it('sets table description', () => {
    layer.setTableDescription('users', 'Application users');

    const schema = layer.getSchema();
    expect(schema.tables.users.enrichment?.description).toBe('Application users');
  });

  it('sets column description', () => {
    layer.setColumnDescription('users', 'email', 'Primary email address');

    const schema = layer.getSchema();
    const emailCol = schema.tables.users.columns.find((c) => c.name === 'email');
    expect(emailCol?.enrichment?.description).toBe('Primary email address');
  });

  it('adds column synonyms', () => {
    layer.addColumnSynonym('orders', 'total_cents', 'price');
    layer.addColumnSynonym('orders', 'total_cents', 'amount');

    const schema = layer.getSchema();
    const totalCol = schema.tables.orders.columns.find((c) => c.name === 'total_cents');
    expect(totalCol?.enrichment?.synonyms).toContain('price');
    expect(totalCol?.enrichment?.synonyms).toContain('amount');
  });

  it('adds table relationships', () => {
    layer.addTableRelationship('orders', {
      targetTable: 'users',
      sourceColumn: 'user_id',
      targetColumn: 'id',
      type: 'many-to-one',
    });

    const schema = layer.getSchema();
    expect(schema.tables.orders.enrichment?.relationships).toHaveLength(1);
    expect(schema.tables.orders.enrichment?.relationships?.[0].targetTable).toBe('users');
  });

  it('infers relationships from foreign key naming', () => {
    layer.inferRelationships();

    const schema = layer.getSchema();
    const relationships = schema.tables.orders.enrichment?.relationships;

    expect(relationships).toBeDefined();
    expect(relationships?.length).toBeGreaterThan(0);
    expect(relationships?.[0].targetTable).toBe('users');
  });

  it('converts back to SchemaDefinition', () => {
    layer.setTableDescription('users', 'App users');
    layer.setColumnDescription('users', 'email', 'User email');

    const schemaDef = layer.toSchemaDefinition();

    expect(schemaDef.tables.users.description).toBe('App users');
    expect(schemaDef.tables.users.columns.find((c) => c.name === 'email')?.description).toBe(
      'User email'
    );
  });
});
