export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  level?: LogLevel;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function createLogger(context: string, options: LoggerOptions = {}): Logger {
  const level = options.level ?? 'info';
  const levelValue = LOG_LEVELS[level];

  const formatMessage = (lvl: LogLevel, message: string, meta?: Record<string, unknown>): string => {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${lvl.toUpperCase()}] [${context}] ${message}${metaStr}`;
  };

  const shouldLog = (lvl: LogLevel): boolean => {
    return LOG_LEVELS[lvl] >= levelValue;
  };

  return {
    debug(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('debug')) {
        console.log(formatMessage('debug', message, meta));
      }
    },
    info(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('info')) {
        console.log(formatMessage('info', message, meta));
      }
    },
    warn(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', message, meta));
      }
    },
    error(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('error')) {
        console.error(formatMessage('error', message, meta));
      }
    },
  };
}

