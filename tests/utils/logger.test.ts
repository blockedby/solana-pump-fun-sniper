import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, setLogLevel, LogLevel } from '../../src/utils/logger';

describe('logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    setLogLevel('DEBUG'); // Enable all logs for testing
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('log format', () => {
    it('should include ISO-8601 timestamp', () => {
      logger.info('test message');

      expect(consoleSpy).toHaveBeenCalledOnce();
      const output = consoleSpy.mock.calls[0][0] as string;
      // ISO-8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(output).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    it('should include log level in brackets', () => {
      logger.info('test message');

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('[INFO]');
    });

    it('should include the message', () => {
      logger.info('my test message');

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('my test message');
    });

    it('should include JSON data when provided', () => {
      logger.info('test', { key: 'value', num: 42 });

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('{"key":"value","num":42}');
    });
  });

  describe('log levels', () => {
    it('should log debug messages', () => {
      logger.debug('debug msg');
      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('[DEBUG]');
    });

    it('should log info messages', () => {
      logger.info('info msg');
      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('[INFO]');
    });

    it('should log warn messages', () => {
      logger.warn('warn msg');
      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('[WARN]');
    });

    it('should log error messages', () => {
      logger.error('error msg');
      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('[ERROR]');
    });
  });

  describe('log level filtering', () => {
    it('should filter out debug when level is INFO', () => {
      setLogLevel('INFO');

      logger.debug('should not appear');
      expect(consoleSpy).not.toHaveBeenCalled();

      logger.info('should appear');
      expect(consoleSpy).toHaveBeenCalledOnce();
    });

    it('should filter out debug and info when level is WARN', () => {
      setLogLevel('WARN');

      logger.debug('no');
      logger.info('no');
      expect(consoleSpy).not.toHaveBeenCalled();

      logger.warn('yes');
      expect(consoleSpy).toHaveBeenCalledOnce();
    });

    it('should only show errors when level is ERROR', () => {
      setLogLevel('ERROR');

      logger.debug('no');
      logger.info('no');
      logger.warn('no');
      expect(consoleSpy).not.toHaveBeenCalled();

      logger.error('yes');
      expect(consoleSpy).toHaveBeenCalledOnce();
    });
  });
});
