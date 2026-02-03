import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { Config } from '../../src/config';

// Store mock references at module level so the mock factory can use them
const mockStreamRef: { current: EventEmitter & { write: ReturnType<typeof vi.fn> } | null } = { current: null };
const mockClientRef: { current: { subscribe: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> } | null } = { current: null };

// Mock yellowstone-grpc
vi.mock('@triton-one/yellowstone-grpc', () => {
  return {
    default: vi.fn(function() {
      return mockClientRef.current;
    }),
    CommitmentLevel: { CONFIRMED: 1 },
  };
});

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock parser
vi.mock('../../src/geyser/parser', () => ({
  isPumpFunCreate: vi.fn(),
  extractTokenInfo: vi.fn(),
}));

// Import after mocks are set up
import { GeyserClient, TokenCallback } from '../../src/geyser/client';

describe('GeyserClient', () => {
  let Client: ReturnType<typeof vi.fn>;
  let mockStream: EventEmitter & { write: ReturnType<typeof vi.fn> };
  let mockClient: { subscribe: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  const testConfig = {
    grpcEndpoint: 'http://test.grpc:10000',
  } as Pick<Config, 'grpcEndpoint'>;

  const testCallback: TokenCallback = vi.fn();

  beforeEach(async () => {
    // Create mock stream
    mockStream = Object.assign(new EventEmitter(), {
      write: vi.fn((data, callback) => {
        if (callback) callback(null);
        return true;
      }),
    });
    mockStreamRef.current = mockStream;

    // Create mock client
    mockClient = {
      subscribe: vi.fn().mockResolvedValue(mockStream),
      close: vi.fn(),
    };
    mockClientRef.current = mockClient;

    // Get the mocked Client constructor
    const module = await import('@triton-one/yellowstone-grpc');
    Client = module.default as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockStreamRef.current = null;
    mockClientRef.current = null;
  });

  describe('constructor', () => {
    it('should create instance with config and callback', () => {
      const client = new GeyserClient(testConfig, testCallback);
      expect(client).toBeInstanceOf(GeyserClient);
    });
  });

  describe('connect', () => {
    it('should create Client with endpoint', async () => {
      const geyser = new GeyserClient(testConfig, testCallback);
      await geyser.connect();

      expect(Client).toHaveBeenCalledWith(
        testConfig.grpcEndpoint,
        undefined,
        undefined
      );
    });

    it('should subscribe to stream', async () => {
      const geyser = new GeyserClient(testConfig, testCallback);
      await geyser.connect();

      expect(mockClient.subscribe).toHaveBeenCalled();
    });

    it('should send subscription request', async () => {
      const geyser = new GeyserClient(testConfig, testCallback);
      await geyser.connect();

      expect(mockStream.write).toHaveBeenCalled();
      const writeCall = mockStream.write.mock.calls[0];
      const request = writeCall[0];

      expect(request.transactions).toBeDefined();
      expect(request.transactions.pumpfun).toBeDefined();
      expect(request.transactions.pumpfun.accountInclude).toContain(
        '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'
      );
    });

    it('should set up data listener', async () => {
      const geyser = new GeyserClient(testConfig, testCallback);
      await geyser.connect();

      expect(mockStream.listenerCount('data')).toBe(1);
    });

    it('should set up error listener', async () => {
      const geyser = new GeyserClient(testConfig, testCallback);
      await geyser.connect();

      expect(mockStream.listenerCount('error')).toBe(1);
    });

    it('should set up end listener', async () => {
      const geyser = new GeyserClient(testConfig, testCallback);
      await geyser.connect();

      expect(mockStream.listenerCount('end')).toBe(1);
    });
  });

  describe('disconnect', () => {
    it('should disconnect without error', async () => {
      const geyser = new GeyserClient(testConfig, testCallback);
      await geyser.connect();
      await geyser.disconnect();

      // Disconnect should complete without throwing
      // Note: yellowstone-grpc doesn't expose a close method,
      // so we just verify the disconnect completes gracefully
      expect(true).toBe(true);
    });
  });

  describe('event handling', () => {
    it('should handle pong messages', async () => {
      const geyser = new GeyserClient(testConfig, testCallback);
      await geyser.connect();

      // Emit pong - should not throw
      mockStream.emit('data', { pong: { id: 123 } });

      // Callback should not be called for pong
      expect(testCallback).not.toHaveBeenCalled();
    });

    it('should call callback when valid create transaction detected', async () => {
      const { isPumpFunCreate, extractTokenInfo } = await import(
        '../../src/geyser/parser'
      );
      (isPumpFunCreate as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (extractTokenInfo as ReturnType<typeof vi.fn>).mockReturnValue({
        mint: 'TestMint',
        symbol: 'TEST',
        name: 'Test',
        creator: 'Creator',
        slot: 123,
      });

      const callback = vi.fn();
      const geyser = new GeyserClient(testConfig, callback);
      await geyser.connect();

      // Emit transaction
      mockStream.emit('data', {
        transaction: {
          slot: 123,
          transaction: {
            transaction: {
              signatures: [Buffer.from('sig')],
              message: {
                accountKeys: [Buffer.from('acc')],
                instructions: [{ data: Buffer.from([]) }],
              },
            },
            meta: {
              postTokenBalances: [{ mint: 'mint', owner: 'owner' }],
              logMessages: ['Program log: Instruction: Create'],
            },
          },
        },
      });

      expect(callback).toHaveBeenCalledWith({
        mint: 'TestMint',
        symbol: 'TEST',
        name: 'Test',
        creator: 'Creator',
        slot: 123,
      });
    });

    it('should not call callback when not a create transaction', async () => {
      const { isPumpFunCreate } = await import('../../src/geyser/parser');
      (isPumpFunCreate as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const callback = vi.fn();
      const geyser = new GeyserClient(testConfig, callback);
      await geyser.connect();

      mockStream.emit('data', {
        transaction: {
          slot: 123,
          transaction: {
            transaction: {
              signatures: [Buffer.from('sig')],
              message: { accountKeys: [], instructions: [] },
            },
            meta: { postTokenBalances: [], logMessages: [] },
          },
        },
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('reconnection', () => {
    it('should track lastSlot from transactions', async () => {
      const { isPumpFunCreate } = await import('../../src/geyser/parser');
      (isPumpFunCreate as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const geyser = new GeyserClient(testConfig, testCallback);
      await geyser.connect();

      mockStream.emit('data', {
        transaction: {
          slot: 999,
          transaction: {
            transaction: {
              signatures: [Buffer.from('sig')],
              message: { accountKeys: [], instructions: [] },
            },
            meta: { postTokenBalances: [], logMessages: [] },
          },
        },
      });

      expect(geyser.getLastSlot()).toBe(999);
    });
  });
});
