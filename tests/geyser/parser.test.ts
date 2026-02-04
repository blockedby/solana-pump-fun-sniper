import { describe, it, expect, vi } from 'vitest';
import bs58 from 'bs58';
import {
  isPumpFunCreate,
  extractTokenInfo,
  ParsedTransaction,
} from '../../src/geyser/parser';
import { PUMP_FUN_PROGRAM_ID } from '../../src/constants';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('geyser parser', () => {
  const PUMP_FUN_PROGRAM = PUMP_FUN_PROGRAM_ID.toBase58();

  function createBaseTx(overrides: Partial<ParsedTransaction> = {}): ParsedTransaction {
    return {
      slot: 12345,
      signature: 'test-signature-123',
      accounts: [PUMP_FUN_PROGRAM],
      data: Buffer.from([]),
      postTokenBalances: [],
      logs: [],
      ...overrides,
    };
  }

  describe('isPumpFunCreate', () => {
    it('should return false if Pump.fun program is not in accounts', () => {
      const tx = createBaseTx({
        accounts: ['SomeOtherProgram111111111111111111111111111'],
        logs: ['Program log: Instruction: Create'],
      });

      expect(isPumpFunCreate(tx)).toBe(false);
    });

    it('should return false if "Instruction: Create" is not in logs', () => {
      const tx = createBaseTx({
        accounts: [PUMP_FUN_PROGRAM],
        logs: ['Program log: Instruction: Buy'],
      });

      expect(isPumpFunCreate(tx)).toBe(false);
    });

    it('should return true for valid create transaction', () => {
      const tx = createBaseTx({
        accounts: [PUMP_FUN_PROGRAM],
        logs: [
          'Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P invoke [1]',
          'Program log: Instruction: Create',
          'Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P success',
        ],
      });

      expect(isPumpFunCreate(tx)).toBe(true);
    });

    it('should return true when Pump.fun is among multiple accounts', () => {
      const tx = createBaseTx({
        accounts: [
          'Creator11111111111111111111111111111111111',
          PUMP_FUN_PROGRAM,
          'TokenProgram11111111111111111111111111111',
        ],
        logs: ['Program log: Instruction: Create'],
      });

      expect(isPumpFunCreate(tx)).toBe(true);
    });

    it('should match Pump.fun program when accounts are encoded from raw bytes (like gRPC)', () => {
      // Simulate what gRPC returns: raw 32-byte public key
      // Then encode to base58 (what client.ts now does)
      const rawProgramBytes = PUMP_FUN_PROGRAM_ID.toBytes(); // Uint8Array(32)
      const encodedAccount = bs58.encode(Buffer.from(rawProgramBytes));

      // Verify encoding matches expected base58
      expect(encodedAccount).toBe(PUMP_FUN_PROGRAM);

      const tx = createBaseTx({
        accounts: [encodedAccount],
        logs: ['Program log: Instruction: Create'],
      });

      expect(isPumpFunCreate(tx)).toBe(true);
    });
  });

  describe('extractTokenInfo', () => {
    it('should return null if no postTokenBalances', () => {
      const tx = createBaseTx({
        postTokenBalances: [],
      });

      expect(extractTokenInfo(tx)).toBeNull();
    });

    it('should extract mint from postTokenBalances[0]', () => {
      const tx = createBaseTx({
        accounts: ['CreatorPubkey111111111111111111111111111'],
        postTokenBalances: [
          { mint: 'MintAddress1111111111111111111111111111111', owner: 'Owner1' },
        ],
      });

      const info = extractTokenInfo(tx);

      expect(info).not.toBeNull();
      expect(info!.mint).toBe('MintAddress1111111111111111111111111111111');
    });

    it('should use first account as creator', () => {
      const tx = createBaseTx({
        accounts: ['CreatorPubkey111111111111111111111111111', 'OtherAccount'],
        postTokenBalances: [
          { mint: 'MintAddress1111111111111111111111111111111', owner: 'Owner1' },
        ],
      });

      const info = extractTokenInfo(tx);

      expect(info!.creator).toBe('CreatorPubkey111111111111111111111111111');
    });

    it('should include slot in token info', () => {
      const tx = createBaseTx({
        slot: 999999,
        accounts: ['Creator'],
        postTokenBalances: [{ mint: 'Mint123', owner: 'Owner' }],
      });

      const info = extractTokenInfo(tx);

      expect(info!.slot).toBe(999999);
    });

    it('should default to UNKNOWN symbol when no data log', () => {
      const tx = createBaseTx({
        accounts: ['Creator'],
        postTokenBalances: [{ mint: 'Mint123', owner: 'Owner' }],
        logs: ['Some other log'],
      });

      const info = extractTokenInfo(tx);

      expect(info!.symbol).toBe('UNKNOWN');
      expect(info!.name).toBe('Unknown Token');
    });

    it('should parse token metadata from Program data log', () => {
      // Simulated Pump.fun data format:
      // 8 bytes discriminator + 4 bytes name length + name + 4 bytes symbol length + symbol
      const discriminator = Buffer.alloc(8);
      const nameBytes = Buffer.from('Test Token');
      const symbolBytes = Buffer.from('TEST');

      const data = Buffer.alloc(8 + 4 + nameBytes.length + 4 + symbolBytes.length);
      discriminator.copy(data, 0);
      data.writeUInt32LE(nameBytes.length, 8);
      nameBytes.copy(data, 12);
      data.writeUInt32LE(symbolBytes.length, 12 + nameBytes.length);
      symbolBytes.copy(data, 12 + nameBytes.length + 4);

      const tx = createBaseTx({
        accounts: ['Creator'],
        postTokenBalances: [{ mint: 'Mint123', owner: 'Owner' }],
        logs: [`Program data: ${data.toString('base64')}`],
      });

      const info = extractTokenInfo(tx);

      expect(info!.name).toBe('Test Token');
      expect(info!.symbol).toBe('TEST');
    });

    it('should handle malformed Program data gracefully', () => {
      const tx = createBaseTx({
        accounts: ['Creator'],
        postTokenBalances: [{ mint: 'Mint123', owner: 'Owner' }],
        logs: ['Program data: not-valid-base64!!!'],
      });

      const info = extractTokenInfo(tx);

      // Should still return token info with defaults
      expect(info).not.toBeNull();
      expect(info!.symbol).toBe('UNKNOWN');
    });
  });
});
