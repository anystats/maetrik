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

export interface DataSourceCapabilities {
  queryable: boolean;
  introspectable: boolean;
  healthCheckable: boolean;
  transactional: boolean;
}

export interface DataSourceConfig {
  id: string;
  type: string;
  credentials: Record<string, unknown>;
}

export interface DataSourceDriver {
  readonly name: string;
  readonly type: string;

  init(config: DataSourceConfig): Promise<void>;
  shutdown(): Promise<void>;
  capabilities(): DataSourceCapabilities;

  // Type guard methods
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
}

export type CredentialsFieldDefinitions = Record<string, CredentialsFieldDefinition>;

// ============================================
// Factory Interfaces
// ============================================

export interface DataSourceFactory {
  readonly type: string;
  readonly displayName: string;
  readonly capabilities: DataSourceCapabilities;
  // Using unknown to support multiple zod versions
  readonly credentialsSchema: unknown;
  create(): DataSourceDriver;

  // Optional metadata for UI
  readonly description?: string;
  readonly iconPath?: string;
  readonly credentialsFields?: CredentialsFieldDefinitions;
}

export interface ResolvedDataSourceFactory {
  readonly type: string;
  readonly displayName: string;
  readonly description?: string;
  readonly icon?: string;  // Base64 data URI, e.g., "data:image/png;base64,..."
  readonly capabilities: DataSourceCapabilities;
  readonly credentialsSchema: unknown;
  readonly credentialsFields?: CredentialsFieldDefinitions;
  create(): DataSourceDriver;
}
