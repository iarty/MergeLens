export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

type LogMetadata = Record<string, unknown>;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

const resolveLogLevel = (): LogLevel => {
  const nodeLogLevel = (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.LOG_LEVEL;
  const configuredLevel = nodeLogLevel ?? import.meta.env.WXT_MERGELENS_LOG_LEVEL;
  const normalizedLevel = configuredLevel?.toLowerCase() as LogLevel | undefined;

  if (normalizedLevel && normalizedLevel in LOG_LEVEL_PRIORITY) {
    return normalizedLevel;
  }

  if (import.meta.env.MODE === 'test') {
    return 'silent';
  }

  return import.meta.env.DEV ? 'debug' : 'warn';
};

const activeLogLevel = resolveLogLevel();

const shouldLog = (level: Exclude<LogLevel, 'silent'>): boolean => {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[activeLogLevel];
};

const writeLog = (
  level: Exclude<LogLevel, 'silent'>,
  scope: string,
  message: string,
  metadata?: LogMetadata,
): void => {
  if (!shouldLog(level)) {
    return;
  }

  const payload = metadata ? [message, metadata] : [message];
  console[level](`[${scope}]`, ...payload);
};

export const createLogger = (scope: string) => {
  return {
    debug: (message: string, metadata?: LogMetadata) =>
      writeLog('debug', scope, message, metadata),
    info: (message: string, metadata?: LogMetadata) =>
      writeLog('info', scope, message, metadata),
    warn: (message: string, metadata?: LogMetadata) =>
      writeLog('warn', scope, message, metadata),
    error: (message: string, metadata?: LogMetadata) =>
      writeLog('error', scope, message, metadata),
  };
};
