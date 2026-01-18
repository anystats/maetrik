import type { ConnectionConfig, ConnectionConfigSource, ConnectionConfigResolver } from './types.js';
import { ConnectionNotFoundError, DuplicateConnectionError } from './errors.js';

export class CompositeConnectionConfigResolver implements ConnectionConfigResolver {
  private readonly sources: ConnectionConfigSource[];

  constructor(sources: ConnectionConfigSource[]) {
    this.sources = sources;
  }

  async get(id: string): Promise<ConnectionConfig> {
    const results: { source: string; config: ConnectionConfig }[] = [];

    for (const source of this.sources) {
      const config = await source.get(id);
      if (config) {
        results.push({ source: source.name, config });
      }
    }

    if (results.length === 0) {
      throw new ConnectionNotFoundError(id);
    }

    if (results.length > 1) {
      const sourceNames = results.map((r) => r.source).join(', ');
      throw new DuplicateConnectionError(id, sourceNames);
    }

    return results[0].config;
  }

  async list(): Promise<ConnectionConfig[]> {
    const allConfigs: ConnectionConfig[] = [];
    const seenIds = new Map<string, string>();

    for (const source of this.sources) {
      const configs = await source.list();
      for (const config of configs) {
        if (seenIds.has(config.id)) {
          throw new DuplicateConnectionError(
            config.id,
            `${seenIds.get(config.id)}, ${source.name}`
          );
        }
        seenIds.set(config.id, source.name);
        allConfigs.push(config);
      }
    }

    return allConfigs;
  }

  async has(id: string): Promise<boolean> {
    for (const source of this.sources) {
      if (await source.has(id)) {
        return true;
      }
    }
    return false;
  }

  async existsInOtherSources(id: string, excludeSource: string): Promise<boolean> {
    for (const source of this.sources) {
      if (source.name === excludeSource) continue;
      if (await source.has(id)) {
        return true;
      }
    }
    return false;
  }
}
