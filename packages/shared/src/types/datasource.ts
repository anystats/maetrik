// ============================================
// Capability Interfaces
// ============================================

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: Array<{ name: string; dataTypeID?: number }>;
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

export interface SchemaTable {
  name: string;
  schema: string;
  columns: SchemaColumn[];
}

export interface SchemaDefinition {
  tables: SchemaTable[];
}

export interface Transaction {
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface Queryable {
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
}

export interface Introspectable {
  introspect(): Promise<SchemaDefinition>;
}

export interface HealthCheckable {
  healthCheck(): Promise<boolean>;
}

export interface Transactional {
  beginTransaction(): Promise<Transaction>;
}

// ============================================
// Core Interfaces
// ============================================

/**
 * Query language that a driver speaks.
 * Used by LLM/translator to know what syntax to generate.
 */
export type QueryLanguage = 'sql' | 'mql' | 'cypher' | 'graphql' | 'custom';

export interface DataSourceCapabilities {
  queryable: boolean;
  introspectable: boolean;
  healthCheckable: boolean;
  transactional: boolean;
}

/**
 * Connection behavior options owned by Maetrik (not driver-specific).
 * Applied consistently across all drivers at the manager level.
 */
export interface ConnectionOptions {
  /** Connection timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Close idle connections after this many milliseconds (default: 60000) */
  idleTimeoutMs?: number;
  /** Maximum number of connections in the pool (default: 10) */
  maxConnections?: number;
  /** Number of times to retry failed connections (default: 0) */
  maxRetries?: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelayMs?: number;
}

export interface DataSourceConfig {
  id: string;
  type: string;
  /** Driver-specific credentials (host, port, auth, etc.) */
  credentials: Record<string, unknown>;
  /** Maetrik-level connection behavior (timeout, retry, etc.) */
  connection?: ConnectionOptions;
}

export interface DataSourceDriver {
  readonly name: string;
  readonly type: string;
  /** Query language this driver speaks (e.g., 'sql', 'mql', 'cypher') */
  readonly queryLanguage: QueryLanguage;

  init(config: DataSourceConfig): Promise<void>;
  shutdown(): Promise<void>;

  // Type guard methods - check actual implementation, not declaration
  isQueryable(): this is DataSourceDriver & Queryable;
  isIntrospectable(): this is DataSourceDriver & Introspectable;
  isHealthCheckable(): this is DataSourceDriver & HealthCheckable;
  isTransactional(): this is DataSourceDriver & Transactional;
}

// ============================================
// Credentials Field Definitions
// ============================================

export interface CredentialsFieldDefinition {
  label?: string;        // Defaults to prettified field name (host_name → "Host Name")
  type?: 'text' | 'password' | 'number' | 'boolean';  // Defaults to 'text'
  placeholder?: string;
  helpText?: string;
  /** Mark field as sensitive - will be encrypted in storage */
  sensitive?: boolean;
}

export type CredentialsFieldDefinitions = Record<string, CredentialsFieldDefinition>;

/**
 * Enriched field definition for API consumers (frontend form builder).
 * Merges UI metadata from credentialsFields with validation info from credentialsSchema.
 */
export interface OptionsFieldDefinition extends CredentialsFieldDefinition {
  /** Whether the field is required */
  required?: boolean;
  /** Default value from the schema */
  default?: unknown;
}

export type OptionsFieldDefinitions = Record<string, OptionsFieldDefinition>;

// ============================================
// Factory Interfaces
// ============================================

import type { JSONSchema7 } from 'json-schema';

/**
 * Factory provided by driver packages.
 * Capabilities are derived from implementation at registration time.
 * No capability declaration needed - implementation IS the contract.
 */
export interface DataSourceFactory {
  readonly type: string;
  readonly displayName: string;
  /** JSON Schema for credentials validation (standard, portable format) */
  readonly credentialsSchema: JSONSchema7;
  create(): DataSourceDriver;

  // Optional metadata for UI
  readonly description?: string;
  readonly iconPath?: string;
  readonly credentialsFields?: CredentialsFieldDefinitions;
}

/**
 * Factory after registration with derived capabilities and converted schema.
 * Capabilities are probed from driver instance at registration time.
 */
export interface ResolvedDataSourceFactory {
  readonly type: string;
  readonly displayName: string;
  readonly description?: string;
  readonly icon?: string;  // Base64 data URI, e.g., "data:image/png;base64,..."
  /** Capabilities derived from driver implementation at registration */
  readonly capabilities: DataSourceCapabilities;
  /** Zod schema converted from JSON Schema for internal validation */
  readonly credentialsSchema: unknown;
  readonly credentialsFields?: CredentialsFieldDefinitions;
  /** Enriched field definitions for API/frontend (merged schema + UI metadata) */
  readonly optionsFields?: OptionsFieldDefinitions;
  create(): DataSourceDriver;
}
