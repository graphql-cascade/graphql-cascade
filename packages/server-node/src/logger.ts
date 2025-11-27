/**
 * GraphQL Cascade Server Logger
 *
 * Configurable logging interface for server-side cascade operations.
 * By default, logging is silent to avoid noise in production.
 */

/**
 * Log levels for cascade operations.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Logger interface for cascade operations.
 */
export interface CascadeLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Configuration for the cascade logger.
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;
  /** Custom logger implementation */
  logger?: CascadeLogger;
  /** Prefix for all log messages */
  prefix?: string;
}

/**
 * Log level priorities (higher = more important)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

/**
 * Default logger implementation using console.
 */
const defaultLogger: CascadeLogger = {
  debug: (message: string, ...args: unknown[]) => console.log(message, ...args),
  info: (message: string, ...args: unknown[]) => console.log(message, ...args),
  warn: (message: string, ...args: unknown[]) => console.warn(message, ...args),
  error: (message: string, ...args: unknown[]) => console.error(message, ...args),
};

/**
 * No-op logger that discards all output.
 */
export const silentLogger: CascadeLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Global logger configuration.
 * Default level is 'silent' to avoid noise in production.
 */
let globalConfig: LoggerConfig = {
  level: 'silent',
  logger: defaultLogger,
  prefix: '[Cascade:Server]',
};

/**
 * Configure the global cascade server logger.
 *
 * @example
 * ```typescript
 * // Enable debug logging
 * configureLogger({ level: 'debug' });
 *
 * // Use custom logger (e.g., pino, winston)
 * configureLogger({
 *   level: 'info',
 *   logger: myCustomLogger,
 * });
 *
 * // Disable all logging (default)
 * configureLogger({ level: 'silent' });
 * ```
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  globalConfig = {
    ...globalConfig,
    ...config,
  };
}

/**
 * Get the current logger configuration.
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...globalConfig };
}

/**
 * Check if a log level should be output given the current configuration.
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[globalConfig.level];
}

/**
 * Get the active logger based on configuration.
 */
function getLogger(): CascadeLogger {
  if (globalConfig.level === 'silent') {
    return silentLogger;
  }
  return globalConfig.logger ?? defaultLogger;
}

/**
 * Format a log message with the configured prefix.
 */
function formatMessage(message: string): string {
  return globalConfig.prefix ? `${globalConfig.prefix} ${message}` : message;
}

/**
 * Cascade server logger API.
 *
 * @example
 * ```typescript
 * import { logger, configureLogger } from '@graphql-cascade/server-node';
 *
 * // Enable debug logging
 * configureLogger({ level: 'debug' });
 *
 * // Logger is now active
 * logger.debug('Transaction started', { transactionId: 'tx_123' });
 * logger.info('Entity tracked', { typename: 'User', id: '1' });
 * ```
 */
export const logger: CascadeLogger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      getLogger().debug(formatMessage(message), ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      getLogger().info(formatMessage(message), ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      getLogger().warn(formatMessage(message), ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      getLogger().error(formatMessage(message), ...args);
    }
  },
};

/**
 * Create a scoped logger with a custom prefix.
 *
 * @example
 * ```typescript
 * const trackerLogger = createScopedLogger('[Cascade:Tracker]');
 * trackerLogger.debug('Entity tracked', { typename: 'User', id: '1' });
 * ```
 */
export function createScopedLogger(prefix: string): CascadeLogger {
  return {
    debug(message: string, ...args: unknown[]): void {
      if (shouldLog('debug')) {
        getLogger().debug(`${prefix} ${message}`, ...args);
      }
    },

    info(message: string, ...args: unknown[]): void {
      if (shouldLog('info')) {
        getLogger().info(`${prefix} ${message}`, ...args);
      }
    },

    warn(message: string, ...args: unknown[]): void {
      if (shouldLog('warn')) {
        getLogger().warn(`${prefix} ${message}`, ...args);
      }
    },

    error(message: string, ...args: unknown[]): void {
      if (shouldLog('error')) {
        getLogger().error(`${prefix} ${message}`, ...args);
      }
    },
  };
}
