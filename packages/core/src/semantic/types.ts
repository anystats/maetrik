import type { SchemaDefinition, SchemaTable, SchemaColumn } from '@maetrik/shared';

export interface ColumnEnrichment {
  description?: string;
  synonyms?: string[];
  examples?: string[];
  isMetric?: boolean;
  format?: string;
}

export interface TableEnrichment {
  description?: string;
  synonyms?: string[];
  relationships?: TableRelationship[];
}

export interface TableRelationship {
  targetTable: string;
  sourceColumn: string;
  targetColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
}

export interface EnrichedColumn extends SchemaColumn {
  enrichment?: ColumnEnrichment;
}

export interface EnrichedTable extends Omit<SchemaTable, 'columns'> {
  columns: EnrichedColumn[];
  enrichment?: TableEnrichment;
}

export interface EnrichedSchema {
  tables: Record<string, EnrichedTable>;
}

export interface SemanticLayer {
  getSchema(): EnrichedSchema;
  setTableDescription(tableName: string, description: string): void;
  setColumnDescription(tableName: string, columnName: string, description: string): void;
  addColumnSynonym(tableName: string, columnName: string, synonym: string): void;
  addTableRelationship(tableName: string, relationship: TableRelationship): void;
  inferRelationships(): void;
  toSchemaDefinition(): SchemaDefinition;
}
