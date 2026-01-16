import pino from 'pino';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  level?: LogLevel;
  pretty?: boolean;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

// Map our log levels to pino levels
const PINO_LEVELS: Record<LogLevel, string> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

// Singleton root logger instance
let rootLogger: pino.Logger | null = null;

function getRootLogger(options: LoggerOptions = {}): pino.Logger {
  if (!rootLogger) {
    const isPretty = options.pretty ?? process.env.NODE_ENV !== 'production';
    const level = options.level ?? (process.env.LOG_LEVEL as LogLevel) ?? 'info';

    rootLogger = pino({
      level: PINO_LEVELS[level],
      ...(isPretty && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
    });
  }
  return rootLogger;
}

function wrapPinoLogger(pinoLogger: pino.Logger): Logger {
  return {
    debug(message: string, meta?: Record<string, unknown>) {
      if (meta) {
        pinoLogger.debug(meta, message);
      } else {
        pinoLogger.debug(message);
      }
    },
    info(message: string, meta?: Record<string, unknown>) {
      if (meta) {
        pinoLogger.info(meta, message);
      } else {
        pinoLogger.info(message);
      }
    },
    warn(message: string, meta?: Record<string, unknown>) {
      if (meta) {
        pinoLogger.warn(meta, message);
      } else {
        pinoLogger.warn(message);
      }
    },
    error(message: string, meta?: Record<string, unknown>) {
      if (meta) {
        pinoLogger.error(meta, message);
      } else {
        pinoLogger.error(message);
      }
    },
    child(bindings: Record<string, unknown>): Logger {
      return wrapPinoLogger(pinoLogger.child(bindings));
    },
  };
}

export function createLogger(context: string, options: LoggerOptions = {}): Logger {
  const root = getRootLogger(options);
  const childLogger = root.child({ context });
  return wrapPinoLogger(childLogger);
}

// Reset root logger (useful for testing)
export function resetLogger(): void {
  rootLogger = null;
}
