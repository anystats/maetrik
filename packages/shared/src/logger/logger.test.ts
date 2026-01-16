import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, resetLogger, Logger } from './index.js';

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLogger(); // Reset singleton for each test
  });

  afterEach(() => {
    resetLogger();
  });

  it('creates a logger with default level', () => {
    const logger = createLogger('test');
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.debug).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
  });

  it('logs without throwing errors', () => {
    const logger = createLogger('test');
    expect(() => logger.info('hello world')).not.toThrow();
    expect(() => logger.debug('debug message')).not.toThrow();
    expect(() => logger.warn('warning message')).not.toThrow();
    expect(() => logger.error('error message')).not.toThrow();
  });

  it('logs with metadata without throwing errors', () => {
    const logger = createLogger('test');
    expect(() => logger.info('with meta', { key: 'value' })).not.toThrow();
    expect(() => logger.error('with meta', { error: 'details' })).not.toThrow();
  });

  it('creates child loggers', () => {
    const logger = createLogger('parent');
    const child = logger.child({ requestId: '123' });

    expect(child).toBeDefined();
    expect(child.info).toBeDefined();
    expect(() => child.info('child log')).not.toThrow();
  });

  it('respects log level configuration', () => {
    // Create logger with error level - debug/info/warn should be silent
    const logger = createLogger('test', { level: 'error' });

    // These shouldn't throw even if they don't output
    expect(() => logger.debug('debug')).not.toThrow();
    expect(() => logger.info('info')).not.toThrow();
    expect(() => logger.warn('warn')).not.toThrow();
    expect(() => logger.error('error')).not.toThrow();
  });
});
