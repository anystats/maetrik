import type { SchemeTable } from '../state/types.js';

export interface EnrichedSchemeTable {
  name: string;
  description?: string;
  columns: EnrichedSchemeColumn[];
  indexes?: { name: string; columns: string[]; unique: boolean; primaryKey?: boolean }[];
  foreignKeys?: { column: string; referencesTable: string; referencesColumn: string }[];
}

export interface EnrichedSchemeColumn {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
}

export interface EnrichedSchema {
  connectionId: string;
  version: string;
  tables: EnrichedSchemeTable[];
}

export interface SyncResult {
  changed: boolean;
  scheme: {
    id: string;
    connectionId: string;
    version: string;
    tables: SchemeTable[];
  };
}

export interface SchemeManager {
  sync(connectionId: string): Promise<SyncResult>;
  getEnrichedSchema(connectionId: string): Promise<EnrichedSchema>;
  setDescription(connectionId: string, tableName: string, columnName: string | null, description: string): Promise<void>;
  removeDescription(connectionId: string, tableName: string, columnName: string | null): Promise<void>;
}
