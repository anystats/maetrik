import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLLMRegistry } from './registry.js';
import type { LLMDriverFactory, LLMDriver } from './types.js';

describe('LLMRegistry', () => {
  const mockDriver: LLMDriver = {
    name: 'mock',
    init: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue({ content: 'test' }),
    shutdown: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue(true),
    capabilities: vi.fn().mockReturnValue({ maxTokens: 4096, streaming: false, embeddings: false }),
  };

  const mockFactory: LLMDriverFactory = {
    name: 'mock',
    create: vi.fn().mockReturnValue(mockDriver),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers an LLM driver factory', () => {
    const registry = createLLMRegistry();
    registry.register(mockFactory);

    expect(registry.get('mock')).toBe(mockFactory);
  });

  it('lists registered drivers', () => {
    const registry = createLLMRegistry();
    registry.register(mockFactory);

    expect(registry.list()).toContain('mock');
  });

  it('returns undefined for unknown driver', () => {
    const registry = createLLMRegistry();

    expect(registry.get('unknown')).toBeUndefined();
  });

  it('creates driver instance from factory', () => {
    const registry = createLLMRegistry();
    registry.register(mockFactory);

    const driver = registry.createDriver('mock');

    expect(mockFactory.create).toHaveBeenCalled();
    expect(driver).toBe(mockDriver);
  });

  it('throws when creating unknown driver', () => {
    const registry = createLLMRegistry();

    expect(() => registry.createDriver('unknown')).toThrow(/unknown llm driver/i);
  });
});
