import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOpenAIDriver, openaiDriverFactory } from './index.js';
import type { LLMDriver } from '../types.js';

// Mock openai module
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'SELECT * FROM users' } }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          }),
        },
      },
      models: {
        list: vi.fn().mockResolvedValue({ data: [{ id: 'gpt-4' }] }),
      },
    })),
  };
});

describe('OpenAIDriver', () => {
  let driver: LLMDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    driver = createOpenAIDriver();
  });

  afterEach(async () => {
    try {
      await driver.shutdown();
    } catch {
      // Ignore
    }
  });

  it('has correct name', () => {
    expect(driver.name).toBe('openai');
  });

  it('initializes with config', async () => {
    await driver.init({
      model: 'gpt-4o',
      apiKey: 'test-key',
    });

    expect(true).toBe(true);
  });

  it('completes prompts via OpenAI API', async () => {
    await driver.init({ model: 'gpt-4o', apiKey: 'test-key' });
    const result = await driver.complete('Generate SQL for: get all users');

    expect(result.content).toBe('SELECT * FROM users');
    expect(result.usage?.promptTokens).toBe(10);
    expect(result.usage?.completionTokens).toBe(5);
  });

  it('performs health check', async () => {
    await driver.init({ model: 'gpt-4o', apiKey: 'test-key' });
    const healthy = await driver.healthCheck();

    expect(healthy).toBe(true);
  });

  it('reports capabilities', async () => {
    await driver.init({ model: 'gpt-4o', apiKey: 'test-key' });
    const caps = driver.capabilities();

    expect(caps.maxTokens).toBeGreaterThan(0);
    expect(caps.streaming).toBe(false);
    expect(caps.embeddings).toBe(true);
  });

  it('factory creates driver instance', () => {
    const factoryDriver = openaiDriverFactory.create();
    expect(factoryDriver.name).toBe('openai');
  });
});
