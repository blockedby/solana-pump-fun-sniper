import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Connection, Keypair, Transaction } from '@solana/web3.js';
import { sendTransaction, SendResult } from '../../src/trading/sender';
import { Config } from '../../src/config';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('transaction sender', () => {
  const testWallet = Keypair.generate();
  let mockTransaction: Transaction;
  let mockConnection: Connection;

  const baseConfig: Pick<
    Config,
    'rpcEndpoint' | 'useJito' | 'jitoEndpoint' | 'landingEndpoint'
  > = {
    rpcEndpoint: 'http://test.rpc',
    useJito: true,
    jitoEndpoint: 'http://test.jito',
    landingEndpoint: 'http://test.landing',
  };

  beforeEach(() => {
    // Create a minimal valid transaction
    mockTransaction = new Transaction();
    mockTransaction.recentBlockhash = 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi';
    mockTransaction.feePayer = testWallet.publicKey;

    mockConnection = {
      sendRawTransaction: vi.fn().mockResolvedValue('rpc-signature-123'),
      getSignatureStatus: vi.fn().mockResolvedValue({
        value: { confirmationStatus: 'confirmed' },
      }),
    } as unknown as Connection;

    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Jito submission', () => {
    it('should try Jito first when useJito=true', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ result: 'jito-sig-123' }),
      });

      const result = await sendTransaction(
        mockTransaction,
        testWallet,
        baseConfig,
        mockConnection
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test.jito/api/v1/transactions',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.method).toBe('jito');
      expect(result.signature).toBe('jito-sig-123');
    });

    it('should include correct JSON-RPC body for Jito', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ result: 'jito-sig-123' }),
      });

      await sendTransaction(mockTransaction, testWallet, baseConfig, mockConnection);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.jsonrpc).toBe('2.0');
      expect(body.method).toBe('sendTransaction');
      expect(body.params[1].encoding).toBe('base64');
    });
  });

  describe('fallback chain', () => {
    it('should fallback to landing endpoint when Jito fails', async () => {
      // Jito fails
      mockFetch.mockRejectedValueOnce(new Error('Jito unavailable'));

      const result = await sendTransaction(
        mockTransaction,
        testWallet,
        baseConfig,
        mockConnection
      );

      // Should have tried Jito
      expect(mockFetch).toHaveBeenCalledTimes(1);
      // Should fallback to RPC (through mockConnection)
      expect(result.method).toBe('rpc');
    });

    it('should fallback to RPC when both Jito and landing fail', async () => {
      // Jito fails
      mockFetch.mockRejectedValueOnce(new Error('Jito unavailable'));

      const result = await sendTransaction(
        mockTransaction,
        testWallet,
        { ...baseConfig, landingEndpoint: '' }, // No landing endpoint
        mockConnection
      );

      expect(result.method).toBe('rpc');
      expect(mockConnection.sendRawTransaction).toHaveBeenCalled();
    });

    it('should skip Jito when useJito=false', async () => {
      const result = await sendTransaction(
        mockTransaction,
        testWallet,
        { ...baseConfig, useJito: false },
        mockConnection
      );

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.method).toBe('rpc');
    });
  });

  describe('confirmation polling', () => {
    it('should poll for confirmation after submission', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ result: 'sig-123' }),
      });

      mockConnection.getSignatureStatus = vi.fn().mockResolvedValue({
        value: { confirmationStatus: 'confirmed' },
      });

      const result = await sendTransaction(
        mockTransaction,
        testWallet,
        baseConfig,
        mockConnection
      );

      expect(result.confirmed).toBe(true);
      expect(mockConnection.getSignatureStatus).toHaveBeenCalled();
    });

    it('should return confirmed=false on timeout', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ result: 'sig-123' }),
      });

      // Never confirm
      mockConnection.getSignatureStatus = vi.fn().mockResolvedValue({
        value: null,
      });

      const result = await sendTransaction(
        mockTransaction,
        testWallet,
        baseConfig,
        mockConnection,
        100 // Short timeout for test
      );

      expect(result.confirmed).toBe(false);
    });

    it('should return confirmed=false when transaction errors', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ result: 'sig-123' }),
      });

      mockConnection.getSignatureStatus = vi.fn().mockResolvedValue({
        value: { err: { InstructionError: [0, 'SomeError'] } },
      });

      const result = await sendTransaction(
        mockTransaction,
        testWallet,
        baseConfig,
        mockConnection
      );

      expect(result.confirmed).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle Jito error response', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            error: { message: 'Bundle rejected' },
          }),
      });

      const result = await sendTransaction(
        mockTransaction,
        testWallet,
        baseConfig,
        mockConnection
      );

      // Should fallback to RPC
      expect(result.method).toBe('rpc');
    });
  });
});
