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
  const { symbol: targetSymbol, matchMode } = config;
  const tokenSymbol = token.symbol;

  let isMatch: boolean;
  let reason: string;

  if (matchMode === 'regex') {
    try {
      const regex = new RegExp(targetSymbol, 'i');
      isMatch = regex.test(tokenSymbol);
      reason = `regex /${targetSymbol}/i`;
    } catch (e) {
      logger.error('Invalid regex pattern', { pattern: targetSymbol, error: String(e) });
      isMatch = false;
      reason = 'invalid regex';
    }
  } else {
    // Exact match (case-insensitive)
    isMatch = tokenSymbol.toLowerCase() === targetSymbol.toLowerCase();
    reason = 'exact match (case-insensitive)';
  }

  logger.info(`Symbol check: ${tokenSymbol} ${isMatch ? '==' : '!='} ${targetSymbol}`, {
    mode: matchMode,
    reason,
    match: isMatch,
  });

  return isMatch;
}
