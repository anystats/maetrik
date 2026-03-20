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

  it('updateConnectionHealth calls correct SQL', async () => {
    await db.initialize();
    await db.updateConnectionHealth('test-id', 'red');
    const { Client } = await import('pg');
    const mockClient = (Client as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    const calls = mockClient.query.mock.calls;
    const updateCall = calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('UPDATE connections SET health_status')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall[1]).toEqual(['red', 'test-id']);
  });

  it('getHealthStats calls correct SQL', async () => {
    await db.initialize();
    await db.getHealthStats('test-id');
    const { Client } = await import('pg');
    const mockClient = (Client as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    const calls = mockClient.query.mock.calls;
    const selectCall = calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('SELECT') && c[0].includes('connection_health_log')
    );
    expect(selectCall).toBeDefined();
    expect(selectCall[1]).toEqual(['test-id']);
  });

  it('pruneHealthStats calls correct SQL', async () => {
    await db.initialize();
    await db.pruneHealthStats('test-id');
    const { Client } = await import('pg');
    const mockClient = (Client as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    const calls = mockClient.query.mock.calls;
    const deleteCall = calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('DELETE FROM connection_health_log') && c[0].includes('48 hours')
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall[1]).toEqual(['test-id']);
  });
});
