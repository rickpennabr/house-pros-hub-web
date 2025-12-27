/**
 * Structured logging utility
 * Replaces console.log/error/warn with structured logging
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Format log entry as JSON for log aggregation services
 */
function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/**
 * Send log to logging service (Sentry, LogRocket, etc.)
 */
function sendToLoggingService(entry: LogEntry): void {
  // Try to import and use Sentry if available
  try {
    // Dynamic import to avoid breaking if Sentry is not installed
    const sentry = require('@sentry/nextjs');
    
    if (entry.level === LogLevel.ERROR && entry.error) {
      const error = new Error(entry.error.message);
      error.name = entry.error.name;
      error.stack = entry.error.stack;
      sentry.captureException(error, {
        extra: entry.context,
      });
    } else {
      const levelMap: Record<LogLevel, 'debug' | 'info' | 'warning' | 'error'> = {
        [LogLevel.DEBUG]: 'debug',
        [LogLevel.INFO]: 'info',
        [LogLevel.WARN]: 'warning',
        [LogLevel.ERROR]: 'error',
      };
      
      sentry.captureMessage(entry.message, {
        level: levelMap[entry.level],
        extra: entry.context,
      });
    }
  } catch {
    // Sentry not available, just output in development
    if (process.env.NODE_ENV === 'development') {
      console.log(formatLogEntry(entry));
    }
  }
}

/**
 * Base logger function
 */
function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context: context ? { ...context } : undefined,
  };

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  // Remove sensitive data from context
  if (entry.context) {
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'authorization'];
    for (const key of sensitiveKeys) {
      if (key in entry.context) {
        entry.context[key] = '[REDACTED]';
      }
    }
  }

  // Send to logging service
  sendToLoggingService(entry);

  // Also output to console in development for debugging
  if (process.env.NODE_ENV === 'development') {
    const consoleMethod = level === LogLevel.ERROR ? 'error' : 
                         level === LogLevel.WARN ? 'warn' : 
                         level === LogLevel.DEBUG ? 'debug' : 'log';
    console[consoleMethod](`[${level.toUpperCase()}]`, message, context || '', error || '');
  }
}

/**
 * Logger class with methods for different log levels
 */
export const logger = {
  /**
   * Log debug message
   */
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV === 'development') {
      log(LogLevel.DEBUG, message, context);
    }
  },

  /**
   * Log info message
   */
  info: (message: string, context?: LogContext) => {
    log(LogLevel.INFO, message, context);
  },

  /**
   * Log warning message
   */
  warn: (message: string, context?: LogContext, error?: Error) => {
    log(LogLevel.WARN, message, context, error);
  },

  /**
   * Log error message
   */
  error: (message: string, context?: LogContext, error?: Error) => {
    log(LogLevel.ERROR, message, context, error);
  },
};

/**
 * Create a logger with default context
 * Useful for adding request context (userId, endpoint, etc.)
 */
export function createLogger(defaultContext: LogContext) {
  return {
    debug: (message: string, context?: LogContext) => {
      logger.debug(message, { ...defaultContext, ...context });
    },
    info: (message: string, context?: LogContext) => {
      logger.info(message, { ...defaultContext, ...context });
    },
    warn: (message: string, context?: LogContext, error?: Error) => {
      logger.warn(message, { ...defaultContext, ...context }, error);
    },
    error: (message: string, context?: LogContext, error?: Error) => {
      logger.error(message, { ...defaultContext, ...context }, error);
    },
  };
}

