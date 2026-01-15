import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger, Logger, LogLevel } from './index.js';

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('creates a logger with default level', () => {
    const logger = createLogger('test');
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
  });

  it('logs info messages', () => {
    const logger = createLogger('test');
    logger.info('hello world');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('includes context in log output', () => {
    const logger = createLogger('mymodule');
    logger.info('test message');
    const call = consoleSpy.mock.calls[0][0];
    expect(call).toContain('mymodule');
  });

  it('respects log level - does not log debug when level is info', () => {
    const logger = createLogger('test', { level: 'info' });
    logger.debug('should not appear');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('logs error messages to console.error', () => {
    const errorSpy = vi.spyOn(console, 'error');
    const logger = createLogger('test');
    logger.error('error message');
    expect(errorSpy).toHaveBeenCalled();
  });
});

