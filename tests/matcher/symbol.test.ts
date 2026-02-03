import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { matchSymbol, TokenInfo } from '../../src/matcher/symbol';
import { Config } from '../../src/config';

// Mock logger to avoid console output in tests
vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('matchSymbol', () => {
  const createToken = (symbol: string): TokenInfo => ({
    mint: 'So11111111111111111111111111111111111111112',
    symbol,
    name: 'Test Token',
    creator: 'Creator111111111111111111111111111111111',
    slot: 12345,
  });

  const createConfig = (
    symbol: string,
    matchMode: 'exact' | 'regex' = 'exact'
  ): Pick<Config, 'symbol' | 'matchMode'> => ({
    symbol,
    matchMode,
  });

  describe('exact matching', () => {
    it('should match identical symbols', () => {
      const token = createToken('PEPE');
      const config = createConfig('PEPE', 'exact');

      expect(matchSymbol(token, config)).toBe(true);
    });

    it('should match case-insensitively (token lowercase)', () => {
      const token = createToken('pepe');
      const config = createConfig('PEPE', 'exact');

      expect(matchSymbol(token, config)).toBe(true);
    });

    it('should match case-insensitively (config lowercase)', () => {
      const token = createToken('PEPE');
      const config = createConfig('pepe', 'exact');

      expect(matchSymbol(token, config)).toBe(true);
    });

    it('should match case-insensitively (mixed case)', () => {
      const token = createToken('PePe');
      const config = createConfig('pEpE', 'exact');

      expect(matchSymbol(token, config)).toBe(true);
    });

    it('should NOT match partial symbols (token is longer)', () => {
      const token = createToken('PEPE2');
      const config = createConfig('PEPE', 'exact');

      expect(matchSymbol(token, config)).toBe(false);
    });

    it('should NOT match partial symbols (config is longer)', () => {
      const token = createToken('PEPE');
      const config = createConfig('PEPE2', 'exact');

      expect(matchSymbol(token, config)).toBe(false);
    });

    it('should NOT match when symbol is prefix', () => {
      const token = createToken('BABYPEPE');
      const config = createConfig('PEPE', 'exact');

      expect(matchSymbol(token, config)).toBe(false);
    });

    it('should NOT match when symbol is suffix', () => {
      const token = createToken('PEPEWIF');
      const config = createConfig('PEPE', 'exact');

      expect(matchSymbol(token, config)).toBe(false);
    });
  });

  describe('regex matching', () => {
    it('should match with simple regex', () => {
      const token = createToken('PEPE');
      const config = createConfig('^PEPE$', 'regex');

      expect(matchSymbol(token, config)).toBe(true);
    });

    it('should match with prefix pattern', () => {
      const token = createToken('PEPE123');
      const config = createConfig('^PEPE', 'regex');

      expect(matchSymbol(token, config)).toBe(true);
    });

    it('should match with suffix pattern', () => {
      const token = createToken('BABYPEPE');
      const config = createConfig('PEPE$', 'regex');

      expect(matchSymbol(token, config)).toBe(true);
    });

    it('should match with wildcard pattern', () => {
      const token = createToken('PEPEWIFHAT');
      const config = createConfig('PEPE.*HAT', 'regex');

      expect(matchSymbol(token, config)).toBe(true);
    });

    it('should be case-insensitive', () => {
      const token = createToken('pepe');
      const config = createConfig('^PEPE$', 'regex');

      expect(matchSymbol(token, config)).toBe(true);
    });

    it('should NOT match when pattern does not match', () => {
      const token = createToken('DOGE');
      const config = createConfig('^PEPE', 'regex');

      expect(matchSymbol(token, config)).toBe(false);
    });

    it('should match character class patterns', () => {
      const token = createToken('PEPE1');
      const config = createConfig('^PEPE[0-9]$', 'regex');

      expect(matchSymbol(token, config)).toBe(true);
    });

    it('should match alternation patterns', () => {
      const token = createToken('DOGE');
      const config = createConfig('^(PEPE|DOGE|SHIB)$', 'regex');

      expect(matchSymbol(token, config)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty symbol in token', () => {
      const token = createToken('');
      const config = createConfig('PEPE', 'exact');

      expect(matchSymbol(token, config)).toBe(false);
    });

    it('should handle symbols with special characters', () => {
      const token = createToken('$PEPE');
      const config = createConfig('$PEPE', 'exact');

      expect(matchSymbol(token, config)).toBe(true);
    });

    it('should escape special regex chars in exact mode', () => {
      const token = createToken('PEPE$');
      const config = createConfig('PEPE$', 'exact');

      // In exact mode, this should match the literal "$"
      expect(matchSymbol(token, config)).toBe(true);
    });
  });
});
