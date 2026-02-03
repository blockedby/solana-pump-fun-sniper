import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// Store original env
const originalEnv = process.env;

describe('config', () => {
  // Generate a test keypair
  const testKeypair = Keypair.generate();
  const testPrivateKey = bs58.encode(testKeypair.secretKey);

  beforeEach(() => {
    // Reset modules to clear cached config
    vi.resetModules();
    // Reset env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function setRequiredEnv() {
    process.env.GRPC_ENDPOINT = 'http://test.grpc:10000';
    process.env.RPC_ENDPOINT = 'http://test.rpc';
    process.env.PRIVATE_KEY = testPrivateKey;
    process.env.SYMBOL = 'TEST';
  }

  describe('required environment variables', () => {
    it('should throw if GRPC_ENDPOINT is missing', async () => {
      process.env.RPC_ENDPOINT = 'http://test';
      process.env.PRIVATE_KEY = testPrivateKey;
      process.env.SYMBOL = 'TEST';

      const { loadConfig } = await import('../src/config');
      expect(() => loadConfig()).toThrow('GRPC_ENDPOINT');
    });

    it('should throw if RPC_ENDPOINT is missing', async () => {
      process.env.GRPC_ENDPOINT = 'http://test';
      process.env.PRIVATE_KEY = testPrivateKey;
      process.env.SYMBOL = 'TEST';

      const { loadConfig } = await import('../src/config');
      expect(() => loadConfig()).toThrow('RPC_ENDPOINT');
    });

    it('should throw if PRIVATE_KEY is missing', async () => {
      process.env.GRPC_ENDPOINT = 'http://test';
      process.env.RPC_ENDPOINT = 'http://test';
      process.env.SYMBOL = 'TEST';

      const { loadConfig } = await import('../src/config');
      expect(() => loadConfig()).toThrow('PRIVATE_KEY');
    });

    it('should throw if SYMBOL is missing', async () => {
      process.env.GRPC_ENDPOINT = 'http://test';
      process.env.RPC_ENDPOINT = 'http://test';
      process.env.PRIVATE_KEY = testPrivateKey;

      const { loadConfig } = await import('../src/config');
      expect(() => loadConfig()).toThrow('SYMBOL');
    });
  });

  describe('PRIVATE_KEY validation', () => {
    it('should throw for invalid base58 private key', async () => {
      setRequiredEnv();
      process.env.PRIVATE_KEY = 'not-valid-base58!!!';

      const { loadConfig } = await import('../src/config');
      expect(() => loadConfig()).toThrow('PRIVATE_KEY');
    });

    it('should parse valid base58 private key into Keypair', async () => {
      setRequiredEnv();

      const { loadConfig } = await import('../src/config');
      const config = loadConfig();

      expect(config.wallet.publicKey.toBase58()).toBe(
        testKeypair.publicKey.toBase58()
      );
    });
  });

  describe('MATCH_MODE validation', () => {
    it('should default to exact', async () => {
      setRequiredEnv();

      const { loadConfig } = await import('../src/config');
      const config = loadConfig();

      expect(config.matchMode).toBe('exact');
    });

    it('should accept "exact"', async () => {
      setRequiredEnv();
      process.env.MATCH_MODE = 'exact';

      const { loadConfig } = await import('../src/config');
      const config = loadConfig();

      expect(config.matchMode).toBe('exact');
    });

    it('should accept "regex"', async () => {
      setRequiredEnv();
      process.env.MATCH_MODE = 'regex';

      const { loadConfig } = await import('../src/config');
      const config = loadConfig();

      expect(config.matchMode).toBe('regex');
    });

    it('should throw for invalid MATCH_MODE', async () => {
      setRequiredEnv();
      process.env.MATCH_MODE = 'invalid';

      const { loadConfig } = await import('../src/config');
      expect(() => loadConfig()).toThrow('MATCH_MODE');
    });
  });

  describe('regex pattern validation', () => {
    it('should throw for invalid regex when MATCH_MODE=regex', async () => {
      setRequiredEnv();
      process.env.MATCH_MODE = 'regex';
      process.env.SYMBOL = '[invalid(regex';

      const { loadConfig } = await import('../src/config');
      expect(() => loadConfig()).toThrow('regex');
    });

    it('should accept valid regex pattern', async () => {
      setRequiredEnv();
      process.env.MATCH_MODE = 'regex';
      process.env.SYMBOL = '^PEPE.*';

      const { loadConfig } = await import('../src/config');
      const config = loadConfig();

      expect(config.symbol).toBe('^PEPE.*');
    });
  });

  describe('numeric config validation', () => {
    it('should throw if BUY_AMOUNT_SOL is not positive', async () => {
      setRequiredEnv();
      process.env.BUY_AMOUNT_SOL = '0';

      const { loadConfig } = await import('../src/config');
      expect(() => loadConfig()).toThrow('BUY_AMOUNT_SOL');
    });

    it('should throw if BUY_AMOUNT_SOL is negative', async () => {
      setRequiredEnv();
      process.env.BUY_AMOUNT_SOL = '-1';

      const { loadConfig } = await import('../src/config');
      expect(() => loadConfig()).toThrow('BUY_AMOUNT_SOL');
    });

    it('should throw if SLIPPAGE_BPS is not positive', async () => {
      setRequiredEnv();
      process.env.SLIPPAGE_BPS = '0';

      const { loadConfig } = await import('../src/config');
      expect(() => loadConfig()).toThrow('SLIPPAGE_BPS');
    });
  });

  describe('default values', () => {
    it('should use default BUY_AMOUNT_SOL of 0.1', async () => {
      setRequiredEnv();

      const { loadConfig } = await import('../src/config');
      const config = loadConfig();

      expect(config.buyAmountSol).toBe(0.1);
    });

    it('should use default SLIPPAGE_BPS of 500', async () => {
      setRequiredEnv();

      const { loadConfig } = await import('../src/config');
      const config = loadConfig();

      expect(config.slippageBps).toBe(500);
    });

    it('should use default DRY_RUN of true', async () => {
      setRequiredEnv();

      const { loadConfig } = await import('../src/config');
      const config = loadConfig();

      expect(config.dryRun).toBe(true);
    });

    it('should use default USE_JITO of true', async () => {
      setRequiredEnv();

      const { loadConfig } = await import('../src/config');
      const config = loadConfig();

      expect(config.useJito).toBe(true);
    });
  });

  describe('boolean parsing', () => {
    it('should set DRY_RUN to false when explicitly set to "false"', async () => {
      setRequiredEnv();
      process.env.DRY_RUN = 'false';

      const { loadConfig } = await import('../src/config');
      const config = loadConfig();

      expect(config.dryRun).toBe(false);
    });

    it('should set USE_JITO to false when explicitly set to "false"', async () => {
      setRequiredEnv();
      process.env.USE_JITO = 'false';

      const { loadConfig } = await import('../src/config');
      const config = loadConfig();

      expect(config.useJito).toBe(false);
    });
  });

  describe('full config loading', () => {
    it('should load all config values correctly', async () => {
      setRequiredEnv();
      process.env.BUY_AMOUNT_SOL = '0.5';
      process.env.SLIPPAGE_BPS = '1000';
      process.env.DRY_RUN = 'false';
      process.env.USE_JITO = 'true';
      process.env.JITO_ENDPOINT = 'http://jito.test';
      process.env.JITO_TIP_LAMPORTS = '20000';
      process.env.LANDING_ENDPOINT = 'http://landing.test';
      process.env.PRIORITY_FEE_LAMPORTS = '10000';

      const { loadConfig } = await import('../src/config');
      const config = loadConfig();

      expect(config.grpcEndpoint).toBe('http://test.grpc:10000');
      expect(config.rpcEndpoint).toBe('http://test.rpc');
      expect(config.symbol).toBe('TEST');
      expect(config.matchMode).toBe('exact');
      expect(config.buyAmountSol).toBe(0.5);
      expect(config.slippageBps).toBe(1000);
      expect(config.dryRun).toBe(false);
      expect(config.useJito).toBe(true);
      expect(config.jitoEndpoint).toBe('http://jito.test');
      expect(config.jitoTipLamports).toBe(20000);
      expect(config.landingEndpoint).toBe('http://landing.test');
      expect(config.priorityFeeLamports).toBe(10000);
    });
  });
});
