import type { SchemaDefinition } from '@maetrik/shared';
import type {
  SemanticLayer,
  EnrichedSchema,
  TableRelationship,
} from './types.js';

export function createSemanticLayer(baseSchema: SchemaDefinition): SemanticLayer {
  // Deep clone the schema and add enrichment structures
  const enrichedSchema: EnrichedSchema = {
    tables: {},
  };

  for (const [tableName, table] of Object.entries(baseSchema.tables)) {
    enrichedSchema.tables[tableName] = {
      name: table.name,
      description: table.description,
      columns: table.columns.map((col) => ({
        ...col,
        enrichment: undefined,
      })),
      enrichment: undefined,
    };
  }

  const layer: SemanticLayer = {
    getSchema(): EnrichedSchema {
      return enrichedSchema;
    },

    setTableDescription(tableName: string, description: string): void {
      const table = enrichedSchema.tables[tableName];
      if (!table) return;

      if (!table.enrichment) {
        table.enrichment = {};
      }
      table.enrichment.description = description;
    },

    setColumnDescription(tableName: string, columnName: string, description: string): void {
      const table = enrichedSchema.tables[tableName];
      if (!table) return;

      const column = table.columns.find((c) => c.name === columnName);
      if (!column) return;

      if (!column.enrichment) {
        column.enrichment = {};
      }
      column.enrichment.description = description;
    },

    addColumnSynonym(tableName: string, columnName: string, synonym: string): void {
      const table = enrichedSchema.tables[tableName];
      if (!table) return;

      const column = table.columns.find((c) => c.name === columnName);
      if (!column) return;

      if (!column.enrichment) {
        column.enrichment = {};
      }
      if (!column.enrichment.synonyms) {
        column.enrichment.synonyms = [];
      }
      if (!column.enrichment.synonyms.includes(synonym)) {
        column.enrichment.synonyms.push(synonym);
      }
    },

    addTableRelationship(tableName: string, relationship: TableRelationship): void {
      const table = enrichedSchema.tables[tableName];
      if (!table) return;

      if (!table.enrichment) {
        table.enrichment = {};
      }
      if (!table.enrichment.relationships) {
        table.enrichment.relationships = [];
      }
      table.enrichment.relationships.push(relationship);
    },

    inferRelationships(): void {
      // Infer relationships based on common naming patterns
      // e.g., user_id in orders table -> users.id
      for (const [tableName, table] of Object.entries(enrichedSchema.tables)) {
        for (const column of table.columns) {
          // Pattern: <singular_table>_id -> <plural_table>.id
          if (column.name.endsWith('_id') && !column.primaryKey) {
            const potentialTableName = column.name.slice(0, -3); // Remove '_id'
            const pluralTable = `${potentialTableName}s`;

            if (enrichedSchema.tables[pluralTable]) {
              const targetTable = enrichedSchema.tables[pluralTable];
              const targetPK = targetTable.columns.find((c) => c.primaryKey);

              if (targetPK) {
                layer.addTableRelationship(tableName, {
                  targetTable: pluralTable,
                  sourceColumn: column.name,
                  targetColumn: targetPK.name,
                  type: 'many-to-one',
                });
              }
            }
          }
        }
      }
    },

    toSchemaDefinition(): SchemaDefinition {
      const result: SchemaDefinition = { tables: {} };

      for (const [tableName, table] of Object.entries(enrichedSchema.tables)) {
        result.tables[tableName] = {
          name: table.name,
          description: table.enrichment?.description ?? table.description,
          columns: table.columns.map((col) => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable,
            primaryKey: col.primaryKey,
            description: col.enrichment?.description ?? col.description,
          })),
        };
      }

      return result;
    },
  };

  return layer;
}
