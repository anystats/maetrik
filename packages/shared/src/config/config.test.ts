import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig, MaetrikConfig } from './index.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('Config Loader', () => {
  const mockFs = vi.mocked(fs);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.skip('loads config from yaml file', async () => {
    const yamlContent = `server:
  port: 3000
  host: "0.0.0.0"
connections:
  main:
    driver: postgres
    host: localhost
    port: 5432
    database: test
llm:
  driver: ollama
  model: llama3
auth:
  driver: none
storage:
  driver: sqlite
  path: ./data/maetrik.db`;
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(yamlContent);

    const config = await loadConfig({ configPath: './maetrik.config.yaml' });

    expect(config.server.port).toBe(3000);
    expect(config.connections.main.driver).toBe('postgres');
  });

  it('uses defaults when no config file exists', async () => {
    mockFs.existsSync.mockReturnValue(false);

    const config = await loadConfig();

    expect(config.server.port).toBe(3000);
    expect(config.server.host).toBe('localhost');
  });

  it('interpolates environment variables in yaml', async () => {
    const yamlContent = `server:
  port: 3000
  host: localhost
connections:
  main:
    driver: postgres
    host: localhost
    port: 5432
    database: test
    password: \${DB_PASSWORD}
llm:
  driver: ollama
  model: llama3
auth:
  driver: none
storage:
  driver: sqlite
  path: ./data/maetrik.db`;
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(yamlContent);

    const config = await loadConfig({
      configPath: './maetrik.config.yaml',
      env: { DB_PASSWORD: 'secret123' },
    });

    expect(config.connections.main.password).toBe('secret123');
  });
});

