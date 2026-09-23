/**
 * Simple leveled logger. Uses console under the hood but formats output
 * consistently so it can be piped to log aggregators (CloudWatch, Datadog).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[currentLevel];
}

function format(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta ?? {}),
  };
  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('debug')) console.log(format('debug', message, meta));
  },
  info(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('info')) console.log(format('info', message, meta));
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('warn')) console.warn(format('warn', message, meta));
  },
  error(message: string, meta?: Record<string, unknown>): void {
    if (shouldLog('error')) console.error(format('error', message, meta));
  },
};
