import type { ConnectionConfig, ConnectionConfigSource } from '../types.js';

export class FileConnectionConfigSource implements ConnectionConfigSource {
  readonly name = 'file';
  private readonly configs: Map<string, ConnectionConfig>;

  constructor(configs: ConnectionConfig[]) {
    this.configs = new Map(configs.map((c) => [c.id, c]));
  }

  async get(id: string): Promise<ConnectionConfig | undefined> {
    return this.configs.get(id);
  }

  async list(): Promise<ConnectionConfig[]> {
    return Array.from(this.configs.values());
  }

  async has(id: string): Promise<boolean> {
    return this.configs.has(id);
  }
}
