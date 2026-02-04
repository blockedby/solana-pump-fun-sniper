export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

const LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  SUCCESS: 1,
  WARN: 2,
  ERROR: 3,
};

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  brightGreen: '\x1b[1;32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
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

  // Color based on level
  let color = COLORS.reset;
  if (level === 'SUCCESS') color = COLORS.brightGreen;
  else if (level === 'WARN') color = COLORS.yellow;
  else if (level === 'ERROR') color = COLORS.red;

  console.log(`${timestamp} ${color}[${level}]${COLORS.reset}  ${color}${message}${COLORS.reset}${dataStr}`);
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log('DEBUG', msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log('INFO', msg, data),
  success: (msg: string, data?: Record<string, unknown>) => log('SUCCESS', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log('WARN', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log('ERROR', msg, data),
};
