import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDataSourceManagerFromConfig } from './from-config.js';
import type { DataSourceConfig } from '@maetrik/shared';

vi.mock('./autodiscover.js', () => ({
  autodiscoverDataSources: vi.fn().mockResolvedValue({
    discoveries: [],
    errors: [],
  }),
}));

describe('createDataSourceManagerFromConfig', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a manager with provided configs', async () => {
    const configs: DataSourceConfig[] = [
      { id: 'test-1', type: 'postgres', credentials: { host: 'localhost' } },
    ];

    const manager = await createDataSourceManagerFromConfig({
      fileConfigs: configs,
      logger: mockLogger,
    });

    expect(manager).toBeDefined();
    expect(await manager.listConfigs()).toHaveLength(1);
    expect(await manager.getConfig('test-1')).toEqual(configs[0]);
  });

  it('creates a manager with empty configs', async () => {
    const manager = await createDataSourceManagerFromConfig({
      logger: mockLogger,
    });

    expect(manager).toBeDefined();
    expect(await manager.listConfigs()).toHaveLength(0);
  });

  it('logs discovery errors as warnings', async () => {
    const { autodiscoverDataSources } = await import('./autodiscover.js');
    vi.mocked(autodiscoverDataSources).mockResolvedValueOnce({
      discoveries: [],
      errors: [{ packageName: 'bad-package', error: 'Import failed' }],
    });

    await createDataSourceManagerFromConfig({ logger: mockLogger });

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('bad-package')
    );
  });
});
