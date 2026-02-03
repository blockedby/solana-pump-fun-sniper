export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

let currentLevel: LogLevel = 'INFO';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): void {
  if (LEVELS[level] < LEVELS[currentLevel]) {
    return;
  }

  const timestamp = formatTimestamp();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`${timestamp} [${level}]  ${message}${dataStr}`);
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log('DEBUG', msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log('INFO', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log('WARN', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log('ERROR', msg, data),
};
