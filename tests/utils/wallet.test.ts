import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getWalletBalance, calculateBuyAmount } from '../../src/utils/wallet';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('wallet helpers', () => {
  const testWallet = Keypair.generate();

  describe('getWalletBalance', () => {
    it('should return balance in SOL', async () => {
      const mockConnection = {
        getBalance: vi.fn().mockResolvedValue(5 * LAMPORTS_PER_SOL),
      } as unknown as Connection;

      const balance = await getWalletBalance(mockConnection, testWallet);

      expect(balance).toBe(5);
      expect(mockConnection.getBalance).toHaveBeenCalledWith(testWallet.publicKey);
    });

    it('should handle zero balance', async () => {
      const mockConnection = {
        getBalance: vi.fn().mockResolvedValue(0),
      } as unknown as Connection;

      const balance = await getWalletBalance(mockConnection, testWallet);

      expect(balance).toBe(0);
    });

    it('should handle fractional SOL amounts', async () => {
      const mockConnection = {
        getBalance: vi.fn().mockResolvedValue(1_500_000_000), // 1.5 SOL
      } as unknown as Connection;

      const balance = await getWalletBalance(mockConnection, testWallet);

      expect(balance).toBe(1.5);
    });
  });

  describe('calculateBuyAmount', () => {
    it('should return requested amount when balance is sufficient', async () => {
      const mockConnection = {
        getBalance: vi.fn().mockResolvedValue(10 * LAMPORTS_PER_SOL),
      } as unknown as Connection;

      const amount = await calculateBuyAmount(mockConnection, testWallet, 0.5);

      expect(amount).toBe(0.5);
    });

    it('should return max available when balance is insufficient', async () => {
      const mockConnection = {
        getBalance: vi.fn().mockResolvedValue(0.5 * LAMPORTS_PER_SOL),
      } as unknown as Connection;

      // Request 1 SOL, but only have 0.5 SOL (minus 0.01 fee = 0.49 available)
      const amount = await calculateBuyAmount(mockConnection, testWallet, 1.0);

      expect(amount).toBeCloseTo(0.49, 2);
    });

    it('should throw when balance is too low to cover fees', async () => {
      const mockConnection = {
        getBalance: vi.fn().mockResolvedValue(0.005 * LAMPORTS_PER_SOL),
      } as unknown as Connection;

      await expect(
        calculateBuyAmount(mockConnection, testWallet, 0.1)
      ).rejects.toThrow('Insufficient balance');
    });

    it('should use custom fee estimate', async () => {
      const mockConnection = {
        getBalance: vi.fn().mockResolvedValue(1 * LAMPORTS_PER_SOL),
      } as unknown as Connection;

      // With 0.05 fee estimate, max available is 0.95
      const amount = await calculateBuyAmount(mockConnection, testWallet, 1.0, 0.05);

      expect(amount).toBeCloseTo(0.95, 2);
    });

    it('should return requested amount exactly when balance equals request plus fee', async () => {
      const mockConnection = {
        getBalance: vi.fn().mockResolvedValue(0.11 * LAMPORTS_PER_SOL),
      } as unknown as Connection;

      const amount = await calculateBuyAmount(mockConnection, testWallet, 0.1, 0.01);

      expect(amount).toBe(0.1);
    });
  });
});
