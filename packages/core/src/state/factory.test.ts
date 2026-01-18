import { describe, it, expect } from 'vitest';
import { createStateDatabase } from './factory.js';
import { PGLiteStateDatabase } from './pglite.js';
import { PostgresStateDatabase } from './postgres.js';

describe('createStateDatabase', () => {
  it('creates PGLiteStateDatabase for pglite type', () => {
    const db = createStateDatabase({ type: 'pglite', path: ':memory:' });
    expect(db).toBeInstanceOf(PGLiteStateDatabase);
  });

  it('creates PostgresStateDatabase for postgres type', () => {
    const db = createStateDatabase({
      type: 'postgres',
      connectionString: 'postgresql://localhost/state',
    });
    expect(db).toBeInstanceOf(PostgresStateDatabase);
  });

  it('throws for unknown type', () => {
    expect(() => createStateDatabase({ type: 'unknown' as any })).toThrow();
  });
});
