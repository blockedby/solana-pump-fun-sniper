import { Config } from '../config';
import { logger } from '../utils/logger';

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  creator: string;
  slot: number;
}

export function matchSymbol(
  token: TokenInfo,
  config: Pick<Config, 'symbol' | 'matchMode'>
): boolean {
  const { symbol: pattern, matchMode } = config;
  const { symbol: tokenSymbol } = token;

  let isMatch = false;
  let reason: string;

  if (matchMode === 'regex') {
    try {
      const regex = new RegExp(pattern, 'i');
      isMatch = regex.test(tokenSymbol);
      reason = `regex /${pattern}/i`;
    } catch (e) {
      logger.error('Invalid regex pattern', { pattern, error: String(e) });
      reason = 'invalid regex';
    }
  } else {
    // Exact match (case-insensitive)
    isMatch = tokenSymbol.toLowerCase() === pattern.toLowerCase();
    reason = 'exact match (case-insensitive)';
  }

  logger.info(`Symbol check: "${tokenSymbol}" ${isMatch ? '✓' : '✗'} ${pattern}`, {
    mode: matchMode,
    reason,
    match: isMatch,
  });

  return isMatch;
}
