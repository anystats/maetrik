import type { StateDatabase } from '../../state/types.js';
import type { ConnectionConfig, ConnectionConfigSource } from '../types.js';
import type { DataSourceRegistry } from '../../datasources/types.js';
import type { EncryptionManager } from '../../encryption/manager.js';

export interface DatabaseConnectionConfigSourceOptions {
  db: StateDatabase;
  registry?: DataSourceRegistry;
  encryptionManager?: EncryptionManager;
}

export class DatabaseConnectionConfigSource implements ConnectionConfigSource {
  readonly name = 'database';
  private readonly db: StateDatabase;
  private readonly registry?: DataSourceRegistry;
  private readonly encryptionManager?: EncryptionManager;

  constructor(options: DatabaseConnectionConfigSourceOptions) {
    this.db = options.db;
    this.registry = options.registry;
    this.encryptionManager = options.encryptionManager;
  }

  private async decryptCredentials(
    type: string,
    credentials: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!this.encryptionManager || !this.registry) {
      return credentials;
    }

    const factory = this.registry.get(type);
    if (!factory?.credentialsFields) {
      return credentials;
    }

    return this.encryptionManager.decryptCredentials(
      credentials,
      factory.credentialsFields
    );
  }

  async get(id: string): Promise<ConnectionConfig | undefined> {
    const row = await this.db.getConnection(id);
    if (!row) return undefined;

    const credentials = await this.decryptCredentials(row.type, row.credentials);

    const connection = (row.meta as Record<string, unknown>)?.connection as Record<string, unknown> | undefined;
    return {
      id: row.id,
      type: row.type,
      credentials,
      connection,
    };
  }

  async list(): Promise<ConnectionConfig[]> {
    const rows = await this.db.listConnections();

    return Promise.all(
      rows.map(async (row) => {
        const credentials = await this.decryptCredentials(row.type, row.credentials);
        const connection = (row.meta as Record<string, unknown>)?.connection as Record<string, unknown> | undefined;
        return {
          id: row.id,
          type: row.type,
          credentials,
          connection,
        };
      })
    );
  }

  async has(id: string): Promise<boolean> {
    return this.db.connectionExists(id);
  }
}
