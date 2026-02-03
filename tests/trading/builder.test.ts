import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { buildBuyTransaction, deriveBondingCurve } from '../../src/trading/builder';
import { TokenInfo } from '../../src/matcher/symbol';
import {
  PUMP_FUN_PROGRAM_ID,
  PUMP_FUN_GLOBAL,
  PUMP_FUN_FEE_RECIPIENT,
  BUY_DISCRIMINATOR,
} from '../../src/constants';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('transaction builder', () => {
  const testWallet = Keypair.generate();
  const testMint = Keypair.generate().publicKey;
  const mockBlockhash = 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi';

  const testToken: TokenInfo = {
    mint: testMint.toBase58(),
    symbol: 'TEST',
    name: 'Test Token',
    creator: 'CreatorPubkey',
    slot: 12345,
  };

  let mockConnection: Connection;

  beforeEach(() => {
    mockConnection = {
      getAccountInfo: vi.fn().mockResolvedValue(null), // ATA doesn't exist
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: mockBlockhash,
        lastValidBlockHeight: 100000,
      }),
    } as unknown as Connection;
  });

  describe('deriveBondingCurve', () => {
    it('should derive bonding curve PDA from mint', () => {
      const [bondingCurve, bump] = deriveBondingCurve(testMint);

      expect(bondingCurve).toBeInstanceOf(PublicKey);
      expect(typeof bump).toBe('number');
      expect(bump).toBeGreaterThanOrEqual(0);
      expect(bump).toBeLessThanOrEqual(255);
    });

    it('should be deterministic (same mint = same PDA)', () => {
      const [pda1] = deriveBondingCurve(testMint);
      const [pda2] = deriveBondingCurve(testMint);

      expect(pda1.toBase58()).toBe(pda2.toBase58());
    });

    it('should derive different PDAs for different mints', () => {
      const otherMint = Keypair.generate().publicKey;
      const [pda1] = deriveBondingCurve(testMint);
      const [pda2] = deriveBondingCurve(otherMint);

      expect(pda1.toBase58()).not.toBe(pda2.toBase58());
    });
  });

  describe('buildBuyTransaction', () => {
    it('should build a valid transaction', async () => {
      const result = await buildBuyTransaction(
        mockConnection,
        testWallet,
        testToken,
        0.1, // amountSol
        500, // slippageBps (5%)
        5000 // priorityFeeLamports
      );

      expect(result.transaction).toBeDefined();
      expect(result.mint.toBase58()).toBe(testMint.toBase58());
    });

    it('should set correct feePayer', async () => {
      const result = await buildBuyTransaction(
        mockConnection,
        testWallet,
        testToken,
        0.1,
        500,
        5000
      );

      expect(result.transaction.feePayer?.toBase58()).toBe(
        testWallet.publicKey.toBase58()
      );
    });

    it('should set recent blockhash', async () => {
      const result = await buildBuyTransaction(
        mockConnection,
        testWallet,
        testToken,
        0.1,
        500,
        5000
      );

      expect(result.transaction.recentBlockhash).toBe(mockBlockhash);
    });

    it('should include priority fee instruction', async () => {
      const result = await buildBuyTransaction(
        mockConnection,
        testWallet,
        testToken,
        0.1,
        500,
        5000
      );

      const instructions = result.transaction.instructions;
      expect(instructions.length).toBeGreaterThanOrEqual(1);
    });

    it('should include ATA creation instruction when ATA does not exist', async () => {
      const result = await buildBuyTransaction(
        mockConnection,
        testWallet,
        testToken,
        0.1,
        500,
        5000
      );

      const instructions = result.transaction.instructions;
      // Should have: priority fee, create ATA, buy
      expect(instructions.length).toBeGreaterThanOrEqual(3);
    });

    it('should NOT include ATA creation when ATA exists', async () => {
      // Mock ATA exists
      mockConnection.getAccountInfo = vi.fn().mockResolvedValue({
        data: Buffer.alloc(165),
        owner: TOKEN_PROGRAM_ID,
      });

      const result = await buildBuyTransaction(
        mockConnection,
        testWallet,
        testToken,
        0.1,
        500,
        5000
      );

      const instructions = result.transaction.instructions;
      // Should have: priority fee, buy (no ATA creation)
      expect(instructions.length).toBe(2);
    });

    it('should include buy instruction with correct program ID', async () => {
      const result = await buildBuyTransaction(
        mockConnection,
        testWallet,
        testToken,
        0.1,
        500,
        5000
      );

      const instructions = result.transaction.instructions;
      const buyInstruction = instructions[instructions.length - 1];

      expect(buyInstruction.programId.toBase58()).toBe(
        PUMP_FUN_PROGRAM_ID.toBase58()
      );
    });

    it('should include buy instruction with correct discriminator', async () => {
      const result = await buildBuyTransaction(
        mockConnection,
        testWallet,
        testToken,
        0.1,
        500,
        5000
      );

      const instructions = result.transaction.instructions;
      const buyInstruction = instructions[instructions.length - 1];
      const data = buyInstruction.data;

      // First 8 bytes should be discriminator
      expect(data.slice(0, 8)).toEqual(BUY_DISCRIMINATOR);
    });

    it('should calculate maxSolCost with slippage', async () => {
      const amountSol = 0.1;
      const slippageBps = 500; // 5%

      const result = await buildBuyTransaction(
        mockConnection,
        testWallet,
        testToken,
        amountSol,
        slippageBps,
        5000
      );

      const instructions = result.transaction.instructions;
      const buyInstruction = instructions[instructions.length - 1];
      const data = buyInstruction.data;

      // maxSolCost is at offset 16 (8 discriminator + 8 amount)
      const maxSolCost = data.readBigUInt64LE(16);
      const expectedMaxCost = BigInt(
        Math.floor(amountSol * LAMPORTS_PER_SOL * (1 + slippageBps / 10000))
      );

      expect(maxSolCost).toBe(expectedMaxCost);
    });

    it('should include Jito tip when jitoTipLamports > 0', async () => {
      const result = await buildBuyTransaction(
        mockConnection,
        testWallet,
        testToken,
        0.1,
        500,
        5000,
        10000 // jitoTipLamports
      );

      const instructions = result.transaction.instructions;
      expect(instructions.length).toBeGreaterThanOrEqual(3);
    });

    it('should include correct accounts in buy instruction', async () => {
      const result = await buildBuyTransaction(
        mockConnection,
        testWallet,
        testToken,
        0.1,
        500,
        5000
      );

      const instructions = result.transaction.instructions;
      const buyInstruction = instructions.find(
        (ix) => ix.programId.toBase58() === PUMP_FUN_PROGRAM_ID.toBase58()
      )!;

      const keys = buyInstruction.keys;

      // Verify key accounts are present
      expect(keys[0].pubkey.toBase58()).toBe(PUMP_FUN_GLOBAL.toBase58());
      expect(keys[1].pubkey.toBase58()).toBe(PUMP_FUN_FEE_RECIPIENT.toBase58());
      expect(keys[2].pubkey.toBase58()).toBe(testMint.toBase58()); // mint
      // keys[3] = bondingCurve (PDA)
      // keys[4] = associatedBondingCurve
      // keys[5] = userAta
      expect(keys[6].pubkey.toBase58()).toBe(testWallet.publicKey.toBase58()); // user
      expect(keys[6].isSigner).toBe(true);
      expect(keys[7].pubkey.toBase58()).toBe(SystemProgram.programId.toBase58());
      expect(keys[8].pubkey.toBase58()).toBe(TOKEN_PROGRAM_ID.toBase58());
    });
  });
});
