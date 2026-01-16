import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLLMManager } from './manager.js';
import { createLLMRegistry } from './registry.js';
import type { LLMDriverFactory, LLMDriver } from './types.js';

describe('LLMManager', () => {
  const createMockDriver = (): LLMDriver => ({
    name: 'mock',
    init: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue({ content: 'SELECT 1', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } }),
    shutdown: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue(true),
    capabilities: vi.fn().mockReturnValue({ maxTokens: 4096, streaming: false, embeddings: false }),
  });

  const mockFactory: LLMDriverFactory = {
    name: 'mock',
    create: vi.fn().mockImplementation(createMockDriver),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with driver config', async () => {
    const registry = createLLMRegistry();
    registry.register(mockFactory);

    const manager = createLLMManager(registry);
    await manager.initialize({ driver: 'mock', model: 'test-model' });

    expect(mockFactory.create).toHaveBeenCalled();
  });

  it('returns initialized driver', async () => {
    const registry = createLLMRegistry();
    registry.register(mockFactory);

    const manager = createLLMManager(registry);
    await manager.initialize({ driver: 'mock', model: 'test-model' });

    const driver = manager.getDriver();
    expect(driver).toBeDefined();
    expect(driver?.name).toBe('mock');
  });

  it('completes prompts via driver', async () => {
    const registry = createLLMRegistry();
    registry.register(mockFactory);

    const manager = createLLMManager(registry);
    await manager.initialize({ driver: 'mock', model: 'test-model' });

    const result = await manager.complete('Test prompt');
    expect(result.content).toBe('SELECT 1');
  });

  it('throws when completing without initialization', async () => {
    const registry = createLLMRegistry();
    registry.register(mockFactory);

    const manager = createLLMManager(registry);

    await expect(manager.complete('Test')).rejects.toThrow(/not initialized/i);
  });

  it('shuts down driver', async () => {
    const registry = createLLMRegistry();
    registry.register(mockFactory);

    const manager = createLLMManager(registry);
    await manager.initialize({ driver: 'mock', model: 'test-model' });

    const driver = manager.getDriver();
    await manager.shutdown();

    expect(driver?.shutdown).toHaveBeenCalled();
  });
});
