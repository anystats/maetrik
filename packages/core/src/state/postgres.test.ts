import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostgresStateDatabase } from './postgres.js';

vi.mock('pg', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ rows: [] }),
  })),
}));

describe('PostgresStateDatabase', () => {
  let db: PostgresStateDatabase;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new PostgresStateDatabase('postgresql://localhost/state');
  });

  it('initializes and connects', async () => {
    await db.initialize();
    const { Client } = await import('pg');
    expect(Client).toHaveBeenCalled();
  });

  it('queries return rows', async () => {
    await db.initialize();
    const rows = await db.query('SELECT 1');
    expect(Array.isArray(rows)).toBe(true);
  });

  it('shuts down cleanly', async () => {
    await db.initialize();
    await db.shutdown();
    // No error means success
  });
});
