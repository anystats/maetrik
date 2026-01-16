import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOllamaDriver, ollamaDriverFactory } from './index.js';
import type { LLMDriver } from '../types.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('OllamaDriver', () => {
  let driver: LLMDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    driver = createOllamaDriver();
  });

  afterEach(async () => {
    try {
      await driver.shutdown();
    } catch {
      // Ignore
    }
  });

  it('has correct name', () => {
    expect(driver.name).toBe('ollama');
  });

  it('initializes with config', async () => {
    await driver.init({
      model: 'llama3',
      baseUrl: 'http://localhost:11434',
    });

    // No error thrown means success
    expect(true).toBe(true);
  });

  it('completes prompts via Ollama API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        response: 'SELECT * FROM users',
        total_duration: 1000000000,
        prompt_eval_count: 10,
        eval_count: 5,
      }),
    });

    await driver.init({ model: 'llama3', baseUrl: 'http://localhost:11434' });
    const result = await driver.complete('Generate SQL for: get all users');

    expect(result.content).toBe('SELECT * FROM users');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('performs health check', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await driver.init({ model: 'llama3', baseUrl: 'http://localhost:11434' });
    const healthy = await driver.healthCheck();

    expect(healthy).toBe(true);
  });

  it('returns false for failed health check', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    await driver.init({ model: 'llama3', baseUrl: 'http://localhost:11434' });
    const healthy = await driver.healthCheck();

    expect(healthy).toBe(false);
  });

  it('reports capabilities', async () => {
    await driver.init({ model: 'llama3' });
    const caps = driver.capabilities();

    expect(caps.maxTokens).toBeGreaterThan(0);
    expect(caps.streaming).toBe(false);
    expect(caps.embeddings).toBe(false);
  });

  it('factory creates driver instance', () => {
    const factoryDriver = ollamaDriverFactory.create();
    expect(factoryDriver.name).toBe('ollama');
  });
});
