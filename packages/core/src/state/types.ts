export interface StateDatabase {
  initialize(): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  shutdown(): Promise<void>;
}

export interface StateDatabaseConfig {
  type: 'pglite' | 'postgres';
  path?: string;              // for pglite
  connectionString?: string;  // for postgres
}

export interface StateDatabaseFactory {
  create(config: StateDatabaseConfig): StateDatabase;
}
