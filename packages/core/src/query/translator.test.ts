import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createQueryTranslator } from './translator.js';
import type { LLMManager } from '../llm/types.js';
import type { SchemaDefinition } from '@maetrik/shared';

describe('QueryTranslator', () => {
  const mockSchema: SchemaDefinition = {
    tables: {
      users: {
        name: 'users',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
          { name: 'email', type: 'varchar', nullable: false },
          { name: 'created_at', type: 'timestamp', nullable: false },
        ],
      },
      orders: {
        name: 'orders',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
          { name: 'user_id', type: 'uuid', nullable: false },
          { name: 'total', type: 'numeric', nullable: false },
          { name: 'status', type: 'varchar', nullable: false },
        ],
      },
    },
  };

  const mockLLMManager: LLMManager = {
    initialize: vi.fn().mockResolvedValue(undefined),
    getDriver: vi.fn().mockReturnValue({ name: 'mock' }),
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        sql: 'SELECT COUNT(*) FROM users',
        explanation: 'Counts all users',
        confidence: 0.95,
        tables: ['users'],
      }),
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('translates simple count question', async () => {
    const translator = createQueryTranslator(mockLLMManager);

    const result = await translator.translate('How many users are there?', {
      schema: mockSchema,
      dialect: 'postgresql',
    });

    expect(result.sql).toBe('SELECT COUNT(*) FROM users');
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.suggestedTables).toContain('users');
  });

  it('includes schema context in LLM prompt', async () => {
    const translator = createQueryTranslator(mockLLMManager);

    await translator.translate('List all users', { schema: mockSchema, dialect: 'postgresql' });

    expect(mockLLMManager.complete).toHaveBeenCalledWith(
      expect.stringContaining('users'),
      expect.any(Object)
    );
  });

  it('respects max rows setting', async () => {
    const translator = createQueryTranslator(mockLLMManager);

    await translator.translate('Get users', { schema: mockSchema, dialect: 'postgresql', maxRows: 100 });

    expect(mockLLMManager.complete).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT 100'),
      expect.any(Object)
    );
  });

  it('handles JSON parse errors gracefully', async () => {
    (mockLLMManager.complete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: 'Invalid JSON response',
    });

    const translator = createQueryTranslator(mockLLMManager);

    await expect(
      translator.translate('Test', { schema: mockSchema, dialect: 'postgresql' })
    ).rejects.toThrow(/failed to parse/i);
  });

  it('handles complex questions with joins', async () => {
    (mockLLMManager.complete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: JSON.stringify({
        sql: 'SELECT u.email, SUM(o.total) FROM users u JOIN orders o ON u.id = o.user_id GROUP BY u.email',
        explanation: 'Total order value per user',
        confidence: 0.85,
        tables: ['users', 'orders'],
      }),
    });

    const translator = createQueryTranslator(mockLLMManager);

    const result = await translator.translate('Show total order value per user', {
      schema: mockSchema,
      dialect: 'postgresql',
    });

    expect(result.sql).toContain('JOIN');
    expect(result.suggestedTables).toContain('users');
    expect(result.suggestedTables).toContain('orders');
  });
});
