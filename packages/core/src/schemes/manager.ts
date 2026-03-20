import type { DataSourceSchemaDefinition } from '@maetrik/shared';
import type { DataSourceManager } from '../datasources/types.js';
import type { StateDatabase, SchemeTable } from '../state/types.js';
import type { SchemeManager, SyncResult, EnrichedSchema, EnrichedSchemeTable } from './types.js';

export interface SchemeManagerOptions {
  dataSourceManager: DataSourceManager;
  stateDb: StateDatabase;
}

/**
 * Convert a DataSourceSchemaDefinition (from driver introspection) to our storage format.
 *
 * - Strips `schema` field from tables
 * - Strips `isPrimaryKey` from columns, generates a PK index entry instead
 * - Columns become just { name, type, nullable }
 */
export function toSchemeTables(schema: DataSourceSchemaDefinition): SchemeTable[] {
  return schema.tables.map((table) => {
    const columns: SchemeTable['columns'] = table.columns.map((col) => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable,
    }));

    const pkColumns = table.columns
      .filter((col) => col.isPrimaryKey)
      .map((col) => col.name);

    const indexes: SchemeTable['indexes'] = [];
    if (pkColumns.length > 0) {
      indexes.push({
        name: `${table.name}_pkey`,
        columns: pkColumns,
        unique: true,
        primaryKey: true,
      });
    }

    const result: SchemeTable = { name: table.name, columns };
    if (indexes.length > 0) {
      result.indexes = indexes;
    }
    return result;
  });
}

export function createSchemeManager(options: SchemeManagerOptions): SchemeManager {
  const { dataSourceManager, stateDb } = options;

  return {
    async sync(connectionId: string): Promise<SyncResult> {
      const driver = await dataSourceManager.connectById(connectionId);
      try {
        if (!driver.isIntrospectable()) {
          throw new Error(`Driver for connection '${connectionId}' does not support introspection`);
        }

        const schemaDef = await driver.introspect();
        const tables = toSchemeTables(schemaDef);

        const existing = await stateDb.getActiveScheme(connectionId);

        if (existing && JSON.stringify(existing.tables) === JSON.stringify(tables)) {
          return {
            changed: false,
            scheme: {
              id: existing.id,
              connectionId: existing.connection_id,
              version: existing.version,
              tables: existing.tables,
            },
          };
        }

        const created = await stateDb.createScheme(connectionId, tables);
        return {
          changed: true,
          scheme: {
            id: created.id,
            connectionId: created.connection_id,
            version: created.version,
            tables: created.tables,
          },
        };
      } finally {
        await driver.shutdown();
      }
    },

    async getEnrichedSchema(connectionId: string): Promise<EnrichedSchema> {
      const scheme = await stateDb.getActiveScheme(connectionId);
      if (!scheme) {
        throw new Error(`No active scheme for connection '${connectionId}'`);
      }

      const enrichments = await stateDb.getEnrichments(connectionId);

      // Build lookup maps
      const tableDescriptions = new Map<string, string>();
      const columnDescriptions = new Map<string, string>();

      for (const enrichment of enrichments) {
        if (enrichment.column_name === null) {
          tableDescriptions.set(enrichment.table_name, enrichment.description);
        } else {
          columnDescriptions.set(
            `${enrichment.table_name}.${enrichment.column_name}`,
            enrichment.description,
          );
        }
      }

      const tables: EnrichedSchemeTable[] = scheme.tables.map((table) => {
        const enrichedTable: EnrichedSchemeTable = {
          name: table.name,
          columns: table.columns.map((col) => {
            const key = `${table.name}.${col.name}`;
            const desc = columnDescriptions.get(key);
            return {
              name: col.name,
              type: col.type,
              nullable: col.nullable,
              ...(desc ? { description: desc } : {}),
            };
          }),
        };

        const tableDesc = tableDescriptions.get(table.name);
        if (tableDesc) {
          enrichedTable.description = tableDesc;
        }
        if (table.indexes) {
          enrichedTable.indexes = table.indexes;
        }
        if (table.foreignKeys) {
          enrichedTable.foreignKeys = table.foreignKeys;
        }

        return enrichedTable;
      });

      return {
        connectionId,
        version: scheme.version,
        tables,
      };
    },

    async setDescription(
      connectionId: string,
      tableName: string,
      columnName: string | null,
      description: string,
    ): Promise<void> {
      await stateDb.setEnrichment(connectionId, tableName, columnName, description);
    },

    async removeDescription(
      connectionId: string,
      tableName: string,
      columnName: string | null,
    ): Promise<void> {
      await stateDb.deleteEnrichment(connectionId, tableName, columnName);
    },
  };
}
