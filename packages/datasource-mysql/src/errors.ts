import { DataSourceError } from '@maetrik/shared';

/**
 * Wrap MySQL errors in DataSourceError with appropriate codes.
 */
export function wrapError(err: unknown): DataSourceError {
  if (err instanceof DataSourceError) {
    return err;
  }

  const mysqlErr = err as { code?: string; errno?: number; message?: string; sqlMessage?: string };
  const code = mysqlErr.code;
  const message = mysqlErr.sqlMessage ?? mysqlErr.message ?? 'Unknown database error';

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
  if (code === 'ER_ACCESS_DENIED_ERROR' || mysqlErr.errno === 1045) {
    return new DataSourceError({
      code: 'AUTHENTICATION_FAILED',
      driverCode: code,
      message: 'Invalid database credentials',
      cause: err,
      retryable: false,
    });
  }

  // Syntax errors
  if (code === 'ER_PARSE_ERROR' || code === 'ER_SYNTAX_ERROR' || mysqlErr.errno === 1064) {
    return new DataSourceError({
      code: 'QUERY_SYNTAX',
      driverCode: code,
      message: message,
      cause: err,
      retryable: false,
    });
  }

  // Unknown table / column
  if (
    code === 'ER_NO_SUCH_TABLE' ||
    code === 'ER_BAD_FIELD_ERROR' ||
    mysqlErr.errno === 1146 ||
    mysqlErr.errno === 1054
  ) {
    return new DataSourceError({
      code: 'QUERY_SYNTAX',
      driverCode: code,
      message: message,
      cause: err,
      retryable: false,
    });
  }

  // Constraint violations
  if (
    code === 'ER_DUP_ENTRY' ||
    code === 'ER_NO_REFERENCED_ROW_2' ||
    code === 'ER_ROW_IS_REFERENCED_2' ||
    mysqlErr.errno === 1062 ||
    mysqlErr.errno === 1452 ||
    mysqlErr.errno === 1451
  ) {
    return new DataSourceError({
      code: 'QUERY_EXECUTION',
      driverCode: code,
      message: message,
      cause: err,
      retryable: false,
    });
  }

  // Query timeout
  if (code === 'ER_QUERY_TIMEOUT' || mysqlErr.errno === 3024) {
    return new DataSourceError({
      code: 'TIMEOUT',
      driverCode: code,
      message: 'Query timed out',
      cause: err,
      retryable: true,
    });
  }

  // Connection lost during query
  if (
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'ECONNRESET' ||
    code === 'ER_SERVER_SHUTDOWN'
  ) {
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
