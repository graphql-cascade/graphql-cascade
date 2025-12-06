import {
  logger,
  configureLogger,
  getLoggerConfig,
  createScopedLogger,
  CascadeLogger,
} from './logger';

describe('Cascade Logger', () => {
  let originalConfig: ReturnType<typeof getLoggerConfig>;

  beforeEach(() => {
    // Store original config
    originalConfig = getLoggerConfig();
  });

  afterEach(() => {
    // Restore original config
    configureLogger(originalConfig);
  });

  describe('configureLogger', () => {
    it('should set log level', () => {
      configureLogger({ level: 'debug' });

      expect(getLoggerConfig().level).toBe('debug');
    });

    it('should set custom prefix', () => {
      configureLogger({ prefix: '[Test]' });

      expect(getLoggerConfig().prefix).toBe('[Test]');
    });

    it('should set custom logger', () => {
      const customLogger: CascadeLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      configureLogger({ logger: customLogger });

      expect(getLoggerConfig().logger).toBe(customLogger);
    });
  });

  describe('log level filtering', () => {
    let mockLogger: CascadeLogger;

    beforeEach(() => {
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      configureLogger({ logger: mockLogger, prefix: '' });
    });

    it('should output all levels when set to debug', () => {
      configureLogger({ level: 'debug' });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockLogger.debug).toHaveBeenCalledWith('debug message');
      expect(mockLogger.info).toHaveBeenCalledWith('info message');
      expect(mockLogger.warn).toHaveBeenCalledWith('warn message');
      expect(mockLogger.error).toHaveBeenCalledWith('error message');
    });

    it('should filter debug when set to info', () => {
      configureLogger({ level: 'info' });

      logger.debug('debug message');
      logger.info('info message');

      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('info message');
    });

    it('should filter debug and info when set to warn', () => {
      configureLogger({ level: 'warn' });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');

      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('warn message');
    });

    it('should only output error when set to error', () => {
      configureLogger({ level: 'error' });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('error message');
    });

    it('should output nothing when set to silent', () => {
      configureLogger({ level: 'silent' });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('message formatting', () => {
    let mockLogger: CascadeLogger;

    beforeEach(() => {
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      configureLogger({ logger: mockLogger, level: 'debug' });
    });

    it('should prepend prefix to messages', () => {
      configureLogger({ prefix: '[MyPrefix]' });

      logger.info('test message');

      expect(mockLogger.info).toHaveBeenCalledWith('[MyPrefix] test message');
    });

    it('should not prepend prefix when empty', () => {
      configureLogger({ prefix: '' });

      logger.info('test message');

      expect(mockLogger.info).toHaveBeenCalledWith('test message');
    });

    it('should pass additional arguments', () => {
      configureLogger({ prefix: '' });

      const extra = { count: 5, items: ['a', 'b'] };
      logger.info('message', extra);

      expect(mockLogger.info).toHaveBeenCalledWith('message', extra);
    });
  });

  describe('createScopedLogger', () => {
    let mockLogger: CascadeLogger;

    beforeEach(() => {
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      configureLogger({ logger: mockLogger, level: 'debug', prefix: '' });
    });

    it('should create logger with custom prefix', () => {
      const scopedLogger = createScopedLogger('[URQL]');

      scopedLogger.info('initialized');

      expect(mockLogger.info).toHaveBeenCalledWith('[URQL] initialized');
    });

    it('should respect global log level', () => {
      configureLogger({ level: 'warn' });
      const scopedLogger = createScopedLogger('[Test]');

      scopedLogger.debug('debug');
      scopedLogger.warn('warn');

      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('[Test] warn');
    });

    it('should pass additional arguments', () => {
      const scopedLogger = createScopedLogger('[Scope]');
      const data = { id: 1 };

      scopedLogger.error('failed', data);

      expect(mockLogger.error).toHaveBeenCalledWith('[Scope] failed', data);
    });
  });

  describe('getLoggerConfig', () => {
    it('should return a copy of the config', () => {
      const config1 = getLoggerConfig();
      const config2 = getLoggerConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});
