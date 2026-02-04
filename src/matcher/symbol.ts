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
  const { symbol: tokenSymbol, name: tokenName } = token;

  let symbolMatch = false;
  let nameMatch = false;
  let reason: string;

  if (matchMode === 'regex') {
    try {
      const regex = new RegExp(pattern, 'i');
      symbolMatch = regex.test(tokenSymbol);
      nameMatch = regex.test(tokenName);
      reason = `regex /${pattern}/i`;
    } catch (e) {
      logger.error('Invalid regex pattern', { pattern, error: String(e) });
      reason = 'invalid regex';
    }
  } else {
    // Exact match (case-insensitive)
    const lowerPattern = pattern.toLowerCase();
    symbolMatch = tokenSymbol.toLowerCase() === lowerPattern;
    nameMatch = tokenName.toLowerCase() === lowerPattern;
    reason = 'exact match (case-insensitive)';
  }

  const isMatch = symbolMatch || nameMatch;
  const matchedOn = symbolMatch && nameMatch ? 'symbol+name' : symbolMatch ? 'symbol' : nameMatch ? 'name' : 'none';

  logger.info(`Match check: "${tokenSymbol}" / "${tokenName}" ${isMatch ? '✓' : '✗'} ${pattern}`, {
    mode: matchMode,
    matchedOn,
    match: isMatch,
  });

  return isMatch;
}
