import { DataSourceError } from '@maetrik/shared';

/**
 * Wrap PostgreSQL errors in DataSourceError with appropriate codes.
 */
export function wrapError(err: unknown): DataSourceError {
  if (err instanceof DataSourceError) {
    return err;
  }

  const pgErr = err as { code?: string; message?: string; detail?: string };
  const code = pgErr.code;
  const message = pgErr.message ?? 'Unknown database error';

  // Connection errors
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') {
    return new DataSourceError({
      code: 'CONNECTION_FAILED',
      driverCode: code,
      message: 'Database server unreachable',
      cause: err,
      retryable: true,
    });
  }

  // Authentication errors
  if (code === '28P01' || code === '28000') {
    return new DataSourceError({
      code: 'AUTHENTICATION_FAILED',
      driverCode: code,
      message: 'Invalid database credentials',
      cause: err,
      retryable: false,
    });
  }

  // Syntax errors (Class 42)
  if (code?.startsWith('42')) {
    return new DataSourceError({
      code: 'QUERY_SYNTAX',
      driverCode: code,
      message: message,
      cause: err,
      retryable: false,
    });
  }

  // Constraint violations and execution errors (Class 23)
  if (code?.startsWith('23')) {
    return new DataSourceError({
      code: 'QUERY_EXECUTION',
      driverCode: code,
      message: pgErr.detail ?? message,
      cause: err,
      retryable: false,
    });
  }

  // Query canceled / statement timeout
  if (code === '57014') {
    return new DataSourceError({
      code: 'TIMEOUT',
      driverCode: code,
      message: 'Query timed out',
      cause: err,
      retryable: true,
    });
  }

  // Connection issues during query (may be transient)
  if (code === '08000' || code === '08003' || code === '08006') {
    return new DataSourceError({
      code: 'CONNECTION_FAILED',
      driverCode: code,
      message: 'Connection lost during operation',
      cause: err,
      retryable: true,
    });
  }

  // Default: unknown driver error
  return new DataSourceError({
    code: 'DRIVER_ERROR',
    driverCode: code,
    message: message,
    cause: err,
    retryable: false,
  });
}
