/**
 * Structured Logging Infrastructure
 * Development vs production logging with log levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: Error;
  stack?: string;
}

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  useConsole: boolean;
  useRemote: boolean;
  remoteEndpoint?: string;
  pretty: boolean;
}

class Logger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private maxBufferSize: number = 100;

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  };

  constructor() {
    this.config = {
      enabled: true,
      level: 'info',
      useConsole: true,
      useRemote: false,
      pretty: true,
    };
  }

  /**
   * Initialize logger
   */
  initialize(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.useRemote && !this.config.remoteEndpoint) {
      console.warn('Remote logging enabled but no endpoint configured');
      this.config.useRemote = false;
    }

    // Flush buffer periodically
    if (this.config.useRemote) {
      setInterval(() => this.flush(), 10000);
    }
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;

    return (
      this.levelPriority[level] >= this.levelPriority[this.config.level]
    );
  }

  /**
   * Create log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
      stack: error?.stack,
    };
  }

  /**
   * Format log entry for console
   */
  private formatForConsole(entry: LogEntry): string {
    if (!this.config.pretty) {
      return JSON.stringify(entry);
    }

    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.message,
    ];

    if (entry.context) {
      parts.push(JSON.stringify(entry.context, null, 2));
    }

    if (entry.error) {
      parts.push(`\nError: ${entry.error.message}`);
      if (entry.stack) {
        parts.push(entry.stack);
      }
    }

    return parts.join(' ');
  }

  /**
   * Log to console
   */
  private logToConsole(entry: LogEntry): void {
    if (!this.config.useConsole) return;

    const formatted = this.formatForConsole(entry);

    switch (entry.level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
      case 'fatal':
        console.error(formatted);
        break;
    }
  }

  /**
   * Add to buffer for remote logging
   */
  private addToBuffer(entry: LogEntry): void {
    if (!this.config.useRemote) return;

    this.buffer.push(entry);

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Flush buffer to remote endpoint
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.remoteEndpoint) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: entries,
          metadata: {
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString(),
          },
        }),
        keepalive: true,
      });
    } catch (error) {
      console.error('Failed to send logs to remote endpoint:', error);
      // Add entries back to buffer
      this.buffer.unshift(...entries);
    }
  }

  /**
   * Log message
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, context, error);

    this.logToConsole(entry);
    this.addToBuffer(entry);
  }

  /**
   * Debug log
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  /**
   * Info log
   */
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  /**
   * Warning log
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  /**
   * Error log
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', message, context, error);
  }

  /**
   * Fatal log
   */
  fatal(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('fatal', message, context, error);
    this.flush(); // Immediately flush fatal errors
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger();
    childLogger.config = { ...this.config };

    // Wrap log method to include parent context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (
      level: LogLevel,
      message: string,
      additionalContext?: Record<string, any>,
      error?: Error
    ) => {
      const mergedContext = {
        ...context,
        ...additionalContext,
      };
      originalLog(level, message, mergedContext, error);
    };

    return childLogger;
  }

  /**
   * Get buffered logs
   */
  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  /**
   * Clear buffer
   */
  clearBuffer(): void {
    this.buffer = [];
  }

  /**
   * Get log statistics
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      fatal: 0,
    };

    this.buffer.forEach((entry) => {
      stats[entry.level]++;
    });

    return stats;
  }
}

// Create singleton instance
const logger = new Logger();

/**
 * Initialize logger from environment variables
 */
export function initializeLogger(): void {
  const config: Partial<LoggerConfig> = {
    enabled: import.meta.env.VITE_ENABLE_LOGGING !== 'false',
    level: (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'info',
    useConsole: true,
    useRemote: import.meta.env.VITE_ENABLE_REMOTE_LOGGING === 'true',
    remoteEndpoint: import.meta.env.VITE_LOG_ENDPOINT,
    pretty: import.meta.env.VITE_ENV === 'development',
  };

  logger.initialize(config);
}

/**
 * Create module-specific logger
 */
export function createLogger(module: string): Logger {
  return logger.child({ module });
}

export default logger;
