/**
 * Tests for GraphQL Cascade Server Logger
 */

import {
  logger,
  configureLogger,
  getLoggerConfig,
  createScopedLogger,
  silentLogger,
  type CascadeLogger,
  type LoggerConfig,
} from './logger';

describe('Logger', () => {
  let logOutput: string[];
  let warnOutput: string[];
  let errorOutput: string[];
  let mockLogger: CascadeLogger;

  beforeEach(() => {
    // Create arrays to capture output
    logOutput = [];
    warnOutput = [];
    errorOutput = [];

    // Create a mock logger that writes to our test arrays
    mockLogger = {
      debug: (...args: unknown[]) => logOutput.push(args.join(' ')),
      info: (...args: unknown[]) => logOutput.push(args.join(' ')),
      warn: (...args: unknown[]) => warnOutput.push(args.join(' ')),
      error: (...args: unknown[]) => errorOutput.push(args.join(' ')),
    };

    // Reset logger configuration before each test with our mock logger
    configureLogger({
      level: 'silent',
      prefix: '[Cascade:Server]',
      logger: mockLogger
    });
  });

  afterEach(() => {
    // Restore mocks to clean up for the next test
    jest.restoreAllMocks();
  });

  describe('configureLogger', () => {
    it('should configure logger with debug level', () => {
      configureLogger({ level: 'debug' });

      const config = getLoggerConfig();
      expect(config.level).toBe('debug');
      expect(config.logger).toBeDefined();
      expect(config.prefix).toBe('[Cascade:Server]');
    });

    it('should configure logger with custom prefix', () => {
      configureLogger({ level: 'info', prefix: '[Custom]' });

      const config = getLoggerConfig();
      expect(config.level).toBe('info');
      expect(config.prefix).toBe('[Custom]');
    });

    it('should configure logger with custom logger implementation', () => {
      const customLogger: CascadeLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      configureLogger({ level: 'warn', logger: customLogger });

      const config = getLoggerConfig();
      expect(config.level).toBe('warn');
      expect(config.logger).toBe(customLogger);
    });

    it('should merge partial configuration with defaults', () => {
      configureLogger({ level: 'error' });

      const config = getLoggerConfig();
      expect(config.level).toBe('error');
      expect(config.prefix).toBe('[Cascade:Server]');
      expect(config.logger).toBeDefined();
    });

    it('should not modify original config when merging', () => {
      const originalConfig = getLoggerConfig();
      configureLogger({ level: 'debug' });

      const newConfig = getLoggerConfig();
      expect(newConfig.level).toBe('debug');
      expect(originalConfig.level).toBe('silent'); // Original should be unchanged
    });
  });

  describe('getLoggerConfig', () => {
    it('should return a copy of the configuration', () => {
      configureLogger({ level: 'info', prefix: '[Test]' });

      const config = getLoggerConfig();
      expect(config.level).toBe('info');
      expect(config.prefix).toBe('[Test]');

      // Modifying the returned config should not affect global config
      config.level = 'debug';
      config.prefix = '[Modified]';

      const config2 = getLoggerConfig();
      expect(config2.level).toBe('info');
      expect(config2.prefix).toBe('[Test]');
    });
  });

  describe('logger methods', () => {
    describe('with silent level (default)', () => {
      it('should not output any logs', () => {
        logger.debug('debug message');
        logger.info('info message');
        logger.warn('warn message');
        logger.error('error message');

        expect(logOutput).toHaveLength(0);
        expect(warnOutput).toHaveLength(0);
        expect(errorOutput).toHaveLength(0);
      });
    });

    describe('with debug level', () => {
      beforeEach(() => {
        configureLogger({ level: 'debug' });
      });

      it('should have debug level configured', () => {
        expect(getLoggerConfig().level).toBe('debug');
      });

      it('should use configured logger', () => {
        // This test verifies that the logger system works with our test setup
        logger.debug('test message');
        expect(logOutput).toContain('[Cascade:Server] test message');
      });

      it('should output all log levels', () => {
        // Explicitly set config for this test
        configureLogger({ level: 'debug' });
        expect(getLoggerConfig().level).toBe('debug');

        logger.debug('debug message', { key: 'value' });
        logger.info('info message', 123);
        logger.warn('warn message');
        logger.error('error message');

        expect(logOutput).toHaveLength(2);
        expect(logOutput[0]).toBe('[Cascade:Server] debug message [object Object]');
        expect(logOutput[1]).toBe('[Cascade:Server] info message 123');

        expect(warnOutput).toHaveLength(1);
        expect(warnOutput[0]).toBe('[Cascade:Server] warn message');

        expect(errorOutput).toHaveLength(1);
        expect(errorOutput[0]).toBe('[Cascade:Server] error message');
      });
    });

    describe('with info level', () => {
      beforeEach(() => {
        configureLogger({ level: 'info' });
      });

      it('should output info, warn, and error logs', () => {
        configureLogger({ level: 'info' });
        expect(getLoggerConfig().level).toBe('info');

        logger.debug('debug message');
        logger.info('info message');
        logger.warn('warn message');
        logger.error('error message');

        expect(logOutput).toHaveLength(1);
        expect(logOutput[0]).toBe('[Cascade:Server] info message');

        expect(warnOutput).toHaveLength(1);
        expect(errorOutput).toHaveLength(1);
      });
    });

    describe('with warn level', () => {
      beforeEach(() => {
        configureLogger({ level: 'warn' });
      });

      it('should output warn and error logs', () => {
        configureLogger({ level: 'warn' });
        expect(getLoggerConfig().level).toBe('warn');

        logger.debug('debug message');
        logger.info('info message');
        logger.warn('warn message');
        logger.error('error message');

        expect(logOutput).toHaveLength(0);
        expect(warnOutput).toHaveLength(1);
        expect(errorOutput).toHaveLength(1);
      });
    });

    describe('with error level', () => {
      beforeEach(() => {
        configureLogger({ level: 'error' });
      });

      it('should output only error logs', () => {
        configureLogger({ level: 'error' });
        expect(getLoggerConfig().level).toBe('error');

        logger.debug('debug message');
        logger.info('info message');
        logger.warn('warn message');
        logger.error('error message');

        expect(logOutput).toHaveLength(0);
        expect(warnOutput).toHaveLength(0);
        expect(errorOutput).toHaveLength(1);
        expect(errorOutput[0]).toBe('[Cascade:Server] error message');
      });
    });

    describe('with custom logger', () => {
      it('should use custom logger implementation', () => {
        const customLogOutput: string[] = [];
        const customWarnOutput: string[] = [];
        const customErrorOutput: string[] = [];

        const customLogger: CascadeLogger = {
          debug: (...args) => customLogOutput.push(args.join(' ')),
          info: (...args) => customLogOutput.push(args.join(' ')),
          warn: (...args) => customWarnOutput.push(args.join(' ')),
          error: (...args) => customErrorOutput.push(args.join(' ')),
        };

        configureLogger({ level: 'debug', logger: customLogger });

        logger.debug('test');
        logger.info('test');
        logger.warn('test');
        logger.error('test');

        expect(customLogOutput).toHaveLength(2);
        expect(customLogOutput[0]).toBe('[Cascade:Server] test');
        expect(customLogOutput[1]).toBe('[Cascade:Server] test');
        expect(customWarnOutput).toHaveLength(1);
        expect(customErrorOutput).toHaveLength(1);
      });
    });

    describe('without prefix', () => {
      it('should not add prefix when prefix is empty', () => {
        configureLogger({ level: 'info', prefix: '' });
        expect(getLoggerConfig().level).toBe('info');

        logger.info('message');

        expect(logOutput).toHaveLength(1);
        expect(logOutput[0]).toBe('message');
      });
    });
  });

  describe('silentLogger', () => {
    it('should not output anything', () => {
      silentLogger.debug('test');
      silentLogger.info('test');
      silentLogger.warn('test');
      silentLogger.error('test');

      expect(logOutput).toHaveLength(0);
      expect(warnOutput).toHaveLength(0);
      expect(errorOutput).toHaveLength(0);
    });
  });

  describe('createScopedLogger', () => {
    it('should create a logger with custom prefix', () => {
      configureLogger({ level: 'debug' });
      expect(getLoggerConfig().level).toBe('debug');

      const scopedLogger = createScopedLogger('[CustomScope]');

      scopedLogger.debug('message');

      expect(logOutput).toHaveLength(1);
      expect(logOutput[0]).toBe('[CustomScope] message');
    });

    it('should respect log level configuration', () => {
      configureLogger({ level: 'warn' });
      expect(getLoggerConfig().level).toBe('warn');

      const scopedLogger = createScopedLogger('[Scope]');
      scopedLogger.debug('debug'); // Should not log
      scopedLogger.info('info');   // Should not log
      scopedLogger.warn('warn');   // Should log
      scopedLogger.error('error'); // Should log

      expect(logOutput).toHaveLength(0);
      expect(warnOutput).toHaveLength(1);
      expect(errorOutput).toHaveLength(1);
    });

    it('should use custom logger when configured', () => {
      const customLogOutput: string[] = [];

      const customLogger: CascadeLogger = {
        debug: jest.fn(),
        info: (...args) => customLogOutput.push(args.join(' ')),
        warn: jest.fn(),
        error: jest.fn(),
      };

      configureLogger({ level: 'info', logger: customLogger });

      const scopedLogger = createScopedLogger('[Scope]');
      scopedLogger.info('message');

      expect(customLogOutput).toHaveLength(1);
      expect(customLogOutput[0]).toBe('[Scope] message');
    });

    it('should work with silent level', () => {
      configureLogger({ level: 'silent' });

      const scopedLogger = createScopedLogger('[Scope]');
      scopedLogger.error('message'); // Should not log even at error level

      expect(errorOutput).toHaveLength(0);
    });
  });

  describe('default behavior', () => {
    it('should default to silent level', () => {
      // Don't configure anything - should be silent by default
      logger.info('test');
      expect(logOutput).toHaveLength(0);
    });

    it('should use configured logger', () => {
      configureLogger({ level: 'info' });
      expect(getLoggerConfig().level).toBe('info');

      logger.info('test');

      expect(logOutput).toHaveLength(1);
      expect(logOutput[0]).toBe('[Cascade:Server] test');
    });
  });
});