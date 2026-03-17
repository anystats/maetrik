export interface ConnectionRow {
  id: string;
  type: string;
  options: {
    credentials: Record<string, unknown>;
    connection?: Record<string, unknown>;
  };
  name?: string;
  description?: string;
  enabled: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateConnectionInput {
  id: string;
  type: string;
  options: {
    credentials: Record<string, unknown>;
    connection?: Record<string, unknown>;
  };
  name?: string;
  description?: string;
}

export interface UpdateConnectionInput {
  options?: {
    credentials?: Record<string, unknown>;
    connection?: Record<string, unknown>;
  };
  name?: string;
  description?: string;
  enabled?: boolean;
}

export interface StateDatabase {
  initialize(): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  shutdown(): Promise<void>;

  // Connection management
  createConnection(input: CreateConnectionInput): Promise<void>;
  getConnection(id: string): Promise<ConnectionRow | undefined>;
  listConnections(): Promise<ConnectionRow[]>;
  connectionExists(id: string): Promise<boolean>;
  updateConnection(id: string, input: UpdateConnectionInput): Promise<void>;
  deleteConnection(id: string): Promise<void>;
}

export interface StateStorageConfig {
  type: 'pglite' | 'postgres';
  path?: string;              // for pglite
  connectionString?: string;  // for postgres
}

export interface StateStorageFactory {
  create(config: StateStorageConfig): StateDatabase;
}
