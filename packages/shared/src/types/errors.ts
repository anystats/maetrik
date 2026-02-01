// ============================================
// Standardized Error Types for Data Sources
// ============================================

/**
 * Core error codes owned by Maetrik.
 * Drivers map their native errors to these codes.
 */
export type CoreErrorCode =
  | 'CONNECTION_FAILED'      // Can't reach the server
  | 'AUTHENTICATION_FAILED'  // Bad credentials
  | 'QUERY_SYNTAX'           // Malformed query
  | 'QUERY_EXECUTION'        // Query ran but failed (constraint, timeout, etc.)
  | 'TIMEOUT'                // Operation took too long
  | 'NOT_INITIALIZED'        // Driver not ready
  | 'DRIVER_ERROR';          // Catch-all for driver-specific errors

export interface DataSourceErrorOptions {
  code: CoreErrorCode;
  message: string;
  driverCode?: string | number;
  cause?: unknown;
  retryable?: boolean;
}

/**
 * Standardized error type for data source operations.
 * All drivers should wrap their native errors in this type.
 */
export class DataSourceError extends Error {
  /** Maetrik category code (always set) */
  readonly code: CoreErrorCode;
  /** Driver-specific error code (optional) */
  readonly driverCode?: string | number;
  /** Original error (preserved for debugging) */
  readonly cause?: unknown;
  /** Whether Maetrik can retry this operation */
  readonly retryable: boolean;

  constructor(options: DataSourceErrorOptions) {
    super(options.message);
    this.name = 'DataSourceError';
    this.code = options.code;
    this.driverCode = options.driverCode;
    this.cause = options.cause;
    this.retryable = options.retryable ?? false;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DataSourceError);
    }
  }
}
