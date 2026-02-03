# Solana Pump.fun Sniper TDD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TypeScript service that detects new Pump.fun tokens via Geyser gRPC and executes buy transactions with MEV protection, following strict TDD methodology.

**Architecture:** Event-driven streaming pipeline: Geyser Client → Parser → Matcher → TX Builder → Sender. Each component is unit-testable with mocks, no integration tests required.

**Tech Stack:** TypeScript, Vitest, @triton-one/yellowstone-grpc, @solana/web3.js, @solana/spl-token, dotenv

---

## Project Structure

```
solana-pump-fun-sniper/
├── src/
│   ├── index.ts                    # Entry point
│   ├── config.ts                   # Config loader & validation
│   ├── constants.ts                # Program IDs, PDAs, discriminators
│   ├── geyser/
│   │   ├── client.ts               # Yellowstone gRPC connection
│   │   └── parser.ts               # Parse Pump.fun events
│   ├── matcher/
│   │   └── symbol.ts               # Symbol matching logic
│   ├── trading/
│   │   ├── builder.ts              # Build buy transaction
│   │   └── sender.ts               # Jito/RPC submission
│   └── utils/
│       ├── logger.ts               # Logging utility
│       └── wallet.ts               # Wallet helpers
├── tests/
│   ├── config.test.ts
│   ├── constants.test.ts
│   ├── geyser/
│   │   ├── client.test.ts
│   │   └── parser.test.ts
│   ├── matcher/
│   │   └── symbol.test.ts
│   ├── trading/
│   │   ├── builder.test.ts
│   │   └── sender.test.ts
│   └── utils/
│       ├── logger.test.ts
│       └── wallet.test.ts
├── vitest.config.ts
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`

### Step 1.1: Initialize npm project and install dependencies

Run:
```bash
cd /home/kcnc/code/block-assessment/solana-pump-fun-sniper
npm init -y
```

### Step 1.2: Install production dependencies

Run:
```bash
npm install @triton-one/yellowstone-grpc @solana/web3.js @solana/spl-token bs58 dotenv
```

### Step 1.3: Install dev dependencies

Run:
```bash
npm install -D typescript @types/node vitest
```

### Step 1.4: Create tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Step 1.5: Create vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
});
```

### Step 1.6: Create .gitignore

```
node_modules/
dist/
.env
*.log
coverage/
```

### Step 1.7: Create .env.example

```env
# Geyser gRPC
GRPC_ENDPOINT=http://ams.grpc.vali.wtf:10000

# Solana RPC
RPC_ENDPOINT=http://ams.node.vali.wtf

# Wallet (base58 private key)
PRIVATE_KEY=your_private_key_here

# Matching
SYMBOL=PEPE
MATCH_MODE=exact

# Trading
BUY_AMOUNT_SOL=0.1
SLIPPAGE_BPS=500
DRY_RUN=true

# MEV Protection
USE_JITO=true
JITO_ENDPOINT=https://mainnet.block-engine.jito.wtf
JITO_TIP_LAMPORTS=10000
LANDING_ENDPOINT=http://fast.ams.node.vali.wtf
PRIORITY_FEE_LAMPORTS=5000

# Logging
LOG_LEVEL=INFO
```

### Step 1.8: Update package.json scripts

Add to package.json:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node --import tsx src/index.ts",
    "start:prod": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Step 1.9: Verify setup

Run:
```bash
npm test
```

Expected: "No test files found" (this is correct at this stage)

### Step 1.10: Commit

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore .env.example
git commit -m "chore: project bootstrap with TypeScript, Vitest, dependencies"
```

---

## Task 2: Constants Module (TDD)

**Files:**
- Create: `tests/constants.test.ts`
- Create: `src/constants.ts`

### Step 2.1: Write the failing test

Create `tests/constants.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  PUMP_FUN_PROGRAM_ID,
  PUMP_FUN_FEE_RECIPIENT,
  PUMP_FUN_GLOBAL,
  PUMP_FUN_EVENT_AUTHORITY,
  BUY_DISCRIMINATOR,
  JITO_TIP_ACCOUNTS,
} from '../src/constants';

describe('constants', () => {
  describe('PUMP_FUN_PROGRAM_ID', () => {
    it('should be a valid PublicKey', () => {
      expect(PUMP_FUN_PROGRAM_ID).toBeInstanceOf(PublicKey);
    });

    it('should equal the known Pump.fun program address', () => {
      expect(PUMP_FUN_PROGRAM_ID.toBase58()).toBe(
        '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'
      );
    });
  });

  describe('PUMP_FUN_FEE_RECIPIENT', () => {
    it('should be the known fee recipient address', () => {
      expect(PUMP_FUN_FEE_RECIPIENT.toBase58()).toBe(
        'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM'
      );
    });
  });

  describe('PUMP_FUN_GLOBAL', () => {
    it('should be the known global account address', () => {
      expect(PUMP_FUN_GLOBAL.toBase58()).toBe(
        '4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf'
      );
    });
  });

  describe('PUMP_FUN_EVENT_AUTHORITY', () => {
    it('should be the known event authority address', () => {
      expect(PUMP_FUN_EVENT_AUTHORITY.toBase58()).toBe(
        'Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1'
      );
    });
  });

  describe('BUY_DISCRIMINATOR', () => {
    it('should be 8 bytes', () => {
      expect(BUY_DISCRIMINATOR.length).toBe(8);
    });

    it('should equal SHA256("global:buy") first 8 bytes', () => {
      expect(Array.from(BUY_DISCRIMINATOR)).toEqual([
        102, 6, 61, 18, 1, 218, 235, 234,
      ]);
    });
  });

  describe('JITO_TIP_ACCOUNTS', () => {
    it('should contain 8 tip accounts', () => {
      expect(JITO_TIP_ACCOUNTS.length).toBe(8);
    });

    it('should all be valid PublicKeys', () => {
      JITO_TIP_ACCOUNTS.forEach((account) => {
        expect(account).toBeInstanceOf(PublicKey);
      });
    });
  });
});
```

### Step 2.2: Run test to verify it fails

Run:
```bash
npm test -- tests/constants.test.ts
```

Expected: FAIL - Cannot find module '../src/constants'

### Step 2.3: Write minimal implementation

Create `src/constants.ts`:

```typescript
import { PublicKey } from '@solana/web3.js';

// Pump.fun Program ID (verified: https://solscan.io/account/6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P)
export const PUMP_FUN_PROGRAM_ID = new PublicKey(
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'
);

// Pump.fun Fee Recipient
export const PUMP_FUN_FEE_RECIPIENT = new PublicKey(
  'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM'
);

// Pump.fun Global State PDA
export const PUMP_FUN_GLOBAL = new PublicKey(
  '4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf'
);

// Pump.fun Event Authority
export const PUMP_FUN_EVENT_AUTHORITY = new PublicKey(
  'Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1'
);

// Buy instruction discriminator: SHA256("global:buy")[0..8]
export const BUY_DISCRIMINATOR = Buffer.from([
  102, 6, 61, 18, 1, 218, 235, 234,
]);

// Jito tip accounts for load balancing
export const JITO_TIP_ACCOUNTS = [
  new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
  new PublicKey('HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe'),
  new PublicKey('Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY'),
  new PublicKey('ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49'),
  new PublicKey('DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh'),
  new PublicKey('ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt'),
  new PublicKey('DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL'),
  new PublicKey('3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT'),
];
```

### Step 2.4: Run test to verify it passes

Run:
```bash
npm test -- tests/constants.test.ts
```

Expected: PASS (6 tests)

### Step 2.5: Commit

```bash
git add src/constants.ts tests/constants.test.ts
git commit -m "feat: add constants module with Pump.fun addresses and discriminators"
```

---

## Task 3: Logger Module (TDD)

**Files:**
- Create: `tests/utils/logger.test.ts`
- Create: `src/utils/logger.ts`

### Step 3.1: Write the failing test

Create `tests/utils/logger.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, setLogLevel, LogLevel } from '../../src/utils/logger';

describe('logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    setLogLevel('DEBUG'); // Enable all logs for testing
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('log format', () => {
    it('should include ISO-8601 timestamp', () => {
      logger.info('test message');

      expect(consoleSpy).toHaveBeenCalledOnce();
      const output = consoleSpy.mock.calls[0][0] as string;
      // ISO-8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(output).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    it('should include log level in brackets', () => {
      logger.info('test message');

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('[INFO]');
    });

    it('should include the message', () => {
      logger.info('my test message');

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('my test message');
    });

    it('should include JSON data when provided', () => {
      logger.info('test', { key: 'value', num: 42 });

      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('{"key":"value","num":42}');
    });
  });

  describe('log levels', () => {
    it('should log debug messages', () => {
      logger.debug('debug msg');
      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('[DEBUG]');
    });

    it('should log info messages', () => {
      logger.info('info msg');
      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('[INFO]');
    });

    it('should log warn messages', () => {
      logger.warn('warn msg');
      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('[WARN]');
    });

    it('should log error messages', () => {
      logger.error('error msg');
      const output = consoleSpy.mock.calls[0][0] as string;
      expect(output).toContain('[ERROR]');
    });
  });

  describe('log level filtering', () => {
    it('should filter out debug when level is INFO', () => {
      setLogLevel('INFO');

      logger.debug('should not appear');
      expect(consoleSpy).not.toHaveBeenCalled();

      logger.info('should appear');
      expect(consoleSpy).toHaveBeenCalledOnce();
    });

    it('should filter out debug and info when level is WARN', () => {
      setLogLevel('WARN');

      logger.debug('no');
      logger.info('no');
      expect(consoleSpy).not.toHaveBeenCalled();

      logger.warn('yes');
      expect(consoleSpy).toHaveBeenCalledOnce();
    });

    it('should only show errors when level is ERROR', () => {
      setLogLevel('ERROR');

      logger.debug('no');
      logger.info('no');
      logger.warn('no');
      expect(consoleSpy).not.toHaveBeenCalled();

      logger.error('yes');
      expect(consoleSpy).toHaveBeenCalledOnce();
    });
  });
});
```

### Step 3.2: Run test to verify it fails

Run:
```bash
npm test -- tests/utils/logger.test.ts
```

Expected: FAIL - Cannot find module '../../src/utils/logger'

### Step 3.3: Write minimal implementation

Create `src/utils/logger.ts`:

```typescript
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

let currentLevel: LogLevel = 'INFO';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): void {
  if (LEVELS[level] < LEVELS[currentLevel]) {
    return;
  }

  const timestamp = formatTimestamp();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`${timestamp} [${level}]  ${message}${dataStr}`);
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log('DEBUG', msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log('INFO', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log('WARN', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log('ERROR', msg, data),
};
```

### Step 3.4: Run test to verify it passes

Run:
```bash
npm test -- tests/utils/logger.test.ts
```

Expected: PASS (11 tests)

### Step 3.5: Commit

```bash
mkdir -p src/utils tests/utils
git add src/utils/logger.ts tests/utils/logger.test.ts
git commit -m "feat: add logger module with level filtering and ISO-8601 timestamps"
```

---

## Task 4: Config Module (TDD)

**Files:**
- Create: `tests/config.test.ts`
- Create: `src/config.ts`

### Step 4.1: Write the failing test

Create `tests/config.test.ts`:

```typescript
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
```

### Step 4.2: Run test to verify it fails

Run:
```bash
npm test -- tests/config.test.ts
```

Expected: FAIL - Cannot find module '../src/config'

### Step 4.3: Write minimal implementation

Create `src/config.ts`:

```typescript
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePositiveNumber(value: string, name: string): number {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) {
    throw new Error(`${name} must be a positive number, got: ${value}`);
  }
  return num;
}

export interface Config {
  grpcEndpoint: string;
  rpcEndpoint: string;
  wallet: Keypair;
  symbol: string;
  matchMode: 'exact' | 'regex';
  buyAmountSol: number;
  slippageBps: number;
  dryRun: boolean;
  useJito: boolean;
  jitoEndpoint: string;
  jitoTipLamports: number;
  landingEndpoint: string;
  priorityFeeLamports: number;
}

export function loadConfig(): Config {
  const grpcEndpoint = requireEnv('GRPC_ENDPOINT');
  const rpcEndpoint = requireEnv('RPC_ENDPOINT');
  const privateKeyStr = requireEnv('PRIVATE_KEY');
  const symbol = requireEnv('SYMBOL');

  // Parse private key
  let wallet: Keypair;
  try {
    const secretKey = bs58.decode(privateKeyStr);
    wallet = Keypair.fromSecretKey(secretKey);
  } catch {
    throw new Error('Invalid PRIVATE_KEY: must be base58 encoded secret key');
  }

  // Parse match mode
  const matchModeStr = process.env.MATCH_MODE || 'exact';
  if (matchModeStr !== 'exact' && matchModeStr !== 'regex') {
    throw new Error('MATCH_MODE must be "exact" or "regex"');
  }
  const matchMode = matchModeStr as 'exact' | 'regex';

  // Validate regex if needed
  if (matchMode === 'regex') {
    try {
      new RegExp(symbol);
    } catch (e) {
      throw new Error(`Invalid regex pattern in SYMBOL: ${e}`);
    }
  }

  // Parse numeric values with validation
  const buyAmountSol = process.env.BUY_AMOUNT_SOL
    ? parsePositiveNumber(process.env.BUY_AMOUNT_SOL, 'BUY_AMOUNT_SOL')
    : 0.1;

  const slippageBps = process.env.SLIPPAGE_BPS
    ? parsePositiveNumber(process.env.SLIPPAGE_BPS, 'SLIPPAGE_BPS')
    : 500;

  // Parse booleans (default to true for safety)
  const dryRun = process.env.DRY_RUN !== 'false';
  const useJito = process.env.USE_JITO !== 'false';

  // Parse other numeric values
  const jitoTipLamports = parseInt(process.env.JITO_TIP_LAMPORTS || '10000', 10);
  const priorityFeeLamports = parseInt(
    process.env.PRIORITY_FEE_LAMPORTS || '5000',
    10
  );

  return {
    grpcEndpoint,
    rpcEndpoint,
    wallet,
    symbol,
    matchMode,
    buyAmountSol,
    slippageBps,
    dryRun,
    useJito,
    jitoEndpoint:
      process.env.JITO_ENDPOINT || 'https://mainnet.block-engine.jito.wtf',
    jitoTipLamports,
    landingEndpoint: process.env.LANDING_ENDPOINT || '',
    priorityFeeLamports,
  };
}
```

### Step 4.4: Run test to verify it passes

Run:
```bash
npm test -- tests/config.test.ts
```

Expected: PASS (21 tests)

### Step 4.5: Commit

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat: add config module with validation"
```

---

## Task 5: Symbol Matcher (TDD)

**Files:**
- Create: `tests/matcher/symbol.test.ts`
- Create: `src/matcher/symbol.ts`

### Step 5.1: Write the failing test

Create `tests/matcher/symbol.test.ts`:

```typescript
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
```

### Step 5.2: Run test to verify it fails

Run:
```bash
npm test -- tests/matcher/symbol.test.ts
```

Expected: FAIL - Cannot find module '../../src/matcher/symbol'

### Step 5.3: Write minimal implementation

Create `src/matcher/symbol.ts`:

```typescript
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
```

### Step 5.4: Run test to verify it passes

Run:
```bash
npm test -- tests/matcher/symbol.test.ts
```

Expected: PASS (18 tests)

### Step 5.5: Commit

```bash
mkdir -p src/matcher tests/matcher
git add src/matcher/symbol.ts tests/matcher/symbol.test.ts
git commit -m "feat: add symbol matcher with exact and regex modes"
```

---

## Task 6: Wallet Helpers (TDD)

**Files:**
- Create: `tests/utils/wallet.test.ts`
- Create: `src/utils/wallet.ts`

### Step 6.1: Write the failing test

Create `tests/utils/wallet.test.ts`:

```typescript
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
```

### Step 6.2: Run test to verify it fails

Run:
```bash
npm test -- tests/utils/wallet.test.ts
```

Expected: FAIL - Cannot find module '../../src/utils/wallet'

### Step 6.3: Write minimal implementation

Create `src/utils/wallet.ts`:

```typescript
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { logger } from './logger';

export async function getWalletBalance(
  connection: Connection,
  wallet: Keypair
): Promise<number> {
  const balance = await connection.getBalance(wallet.publicKey);
  return balance / LAMPORTS_PER_SOL;
}

export async function calculateBuyAmount(
  connection: Connection,
  wallet: Keypair,
  requestedAmountSol: number,
  estimatedFeeSol: number = 0.01
): Promise<number> {
  const balance = await getWalletBalance(connection, wallet);
  const maxAvailable = balance - estimatedFeeSol;

  if (maxAvailable <= 0) {
    throw new Error(
      `Insufficient balance: ${balance.toFixed(4)} SOL (need at least ${estimatedFeeSol} SOL for fees)`
    );
  }

  if (maxAvailable < requestedAmountSol) {
    logger.warn('Insufficient balance for full buy, using all available', {
      requested: requestedAmountSol,
      available: maxAvailable,
    });
    return maxAvailable;
  }

  return requestedAmountSol;
}
```

### Step 6.4: Run test to verify it passes

Run:
```bash
npm test -- tests/utils/wallet.test.ts
```

Expected: PASS (7 tests)

### Step 6.5: Commit

```bash
git add src/utils/wallet.ts tests/utils/wallet.test.ts
git commit -m "feat: add wallet helpers with balance check and buy amount calculation"
```

---

## Task 7: Geyser Parser (TDD)

**Files:**
- Create: `tests/geyser/parser.test.ts`
- Create: `src/geyser/parser.ts`

### Step 7.1: Write the failing test

Create `tests/geyser/parser.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
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
```

### Step 7.2: Run test to verify it fails

Run:
```bash
npm test -- tests/geyser/parser.test.ts
```

Expected: FAIL - Cannot find module '../../src/geyser/parser'

### Step 7.3: Write minimal implementation

Create `src/geyser/parser.ts`:

```typescript
import { logger } from '../utils/logger';
import { PUMP_FUN_PROGRAM_ID } from '../constants';
import { TokenInfo } from '../matcher/symbol';

const PUMP_FUN_PROGRAM = PUMP_FUN_PROGRAM_ID.toBase58();

export interface ParsedTransaction {
  slot: number;
  signature: string;
  accounts: string[];
  data: Buffer;
  postTokenBalances: Array<{
    mint: string;
    owner: string;
  }>;
  logs: string[];
}

export function isPumpFunCreate(tx: ParsedTransaction): boolean {
  // Check if transaction involves Pump.fun program
  if (!tx.accounts.includes(PUMP_FUN_PROGRAM)) {
    return false;
  }

  // Check logs for "Instruction: Create"
  const hasCreateLog = tx.logs.some((log) =>
    log.includes('Instruction: Create')
  );

  return hasCreateLog;
}

export function extractTokenInfo(tx: ParsedTransaction): TokenInfo | null {
  try {
    // New token mint is in postTokenBalances[0]
    if (!tx.postTokenBalances || tx.postTokenBalances.length === 0) {
      logger.warn('No token balances in transaction', { sig: tx.signature });
      return null;
    }

    const mint = tx.postTokenBalances[0].mint;

    // Parse token metadata from logs
    let symbol = 'UNKNOWN';
    let name = 'Unknown Token';

    const dataLog = tx.logs.find((log) => log.startsWith('Program data:'));
    if (dataLog) {
      try {
        const base64Data = dataLog.replace('Program data: ', '');
        const decoded = Buffer.from(base64Data, 'base64');

        // Pump.fun data layout:
        // - 8 bytes: discriminator
        // - 4 bytes: name length (u32 LE)
        // - N bytes: name
        // - 4 bytes: symbol length (u32 LE)
        // - M bytes: symbol
        if (decoded.length >= 16) {
          const nameLen = decoded.readUInt32LE(8);
          if (decoded.length >= 12 + nameLen + 4) {
            name = decoded.slice(12, 12 + nameLen).toString('utf8');
            const symbolOffset = 12 + nameLen;
            const symbolLen = decoded.readUInt32LE(symbolOffset);
            if (decoded.length >= symbolOffset + 4 + symbolLen) {
              symbol = decoded
                .slice(symbolOffset + 4, symbolOffset + 4 + symbolLen)
                .toString('utf8');
            }
          }
        }
      } catch (e) {
        logger.debug('Could not parse token metadata from logs', {
          error: String(e),
        });
      }
    }

    // Creator is typically the first signer/account
    const creator = tx.accounts[0] || 'unknown';

    return {
      mint,
      symbol,
      name,
      creator,
      slot: tx.slot,
    };
  } catch (e) {
    logger.error('Failed to extract token info', {
      error: String(e),
      sig: tx.signature,
    });
    return null;
  }
}

export { TokenInfo };
```

### Step 7.4: Run test to verify it passes

Run:
```bash
npm test -- tests/geyser/parser.test.ts
```

Expected: PASS (10 tests)

### Step 7.5: Commit

```bash
mkdir -p src/geyser tests/geyser
git add src/geyser/parser.ts tests/geyser/parser.test.ts
git commit -m "feat: add Pump.fun event parser with create detection and metadata extraction"
```

---

## Task 8: Transaction Builder (TDD)

**Files:**
- Create: `tests/trading/builder.test.ts`
- Create: `src/trading/builder.ts`

### Step 8.1: Write the failing test

Create `tests/trading/builder.test.ts`:

```typescript
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
  PUMP_FUN_EVENT_AUTHORITY,
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
      // First instruction should be ComputeBudgetProgram.setComputeUnitPrice
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
      // Last instruction before buy should be Jito tip (SystemProgram.transfer)
      const tipInstruction = instructions[instructions.length - 1];

      // The tip transfer and buy instruction - check we have extra instructions
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
```

### Step 8.2: Run test to verify it fails

Run:
```bash
npm test -- tests/trading/builder.test.ts
```

Expected: FAIL - Cannot find module '../../src/trading/builder'

### Step 8.3: Write minimal implementation

Create `src/trading/builder.ts`:

```typescript
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  PUMP_FUN_PROGRAM_ID,
  PUMP_FUN_GLOBAL,
  PUMP_FUN_FEE_RECIPIENT,
  PUMP_FUN_EVENT_AUTHORITY,
  BUY_DISCRIMINATOR,
  JITO_TIP_ACCOUNTS,
} from '../constants';
import { TokenInfo } from '../matcher/symbol';
import { logger } from '../utils/logger';

export interface BuildResult {
  transaction: Transaction;
  mint: PublicKey;
}

export function deriveBondingCurve(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mint.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
}

export async function buildBuyTransaction(
  connection: Connection,
  wallet: Keypair,
  tokenInfo: TokenInfo,
  amountSol: number,
  slippageBps: number,
  priorityFeeLamports: number,
  jitoTipLamports: number = 0
): Promise<BuildResult> {
  const mint = new PublicKey(tokenInfo.mint);
  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  // Derive bonding curve PDA
  const [bondingCurve] = deriveBondingCurve(mint);

  // Derive associated bonding curve (token account for bonding curve)
  const associatedBondingCurve = await getAssociatedTokenAddress(
    mint,
    bondingCurve,
    true // allowOwnerOffCurve
  );

  // User's associated token account
  const userAta = await getAssociatedTokenAddress(mint, wallet.publicKey);

  // Check if user's ATA exists
  const ataInfo = await connection.getAccountInfo(userAta);

  const transaction = new Transaction();

  // Add priority fee
  transaction.add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFeeLamports,
    })
  );

  // Create ATA if needed
  if (!ataInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userAta,
        wallet.publicKey,
        mint
      )
    );
  }

  // Calculate max SOL with slippage
  const maxSolCost = BigInt(
    Math.floor(amountLamports * (1 + slippageBps / 10000))
  );

  // Build buy instruction data
  // Layout: discriminator (8) + token amount (8) + max sol cost (8)
  const buyData = Buffer.alloc(24);
  BUY_DISCRIMINATOR.copy(buyData, 0);
  buyData.writeBigUInt64LE(BigInt(0), 8); // Let contract calculate tokens
  buyData.writeBigUInt64LE(maxSolCost, 16);

  // Build buy instruction with 12 accounts
  const buyInstruction = new TransactionInstruction({
    programId: PUMP_FUN_PROGRAM_ID,
    keys: [
      { pubkey: PUMP_FUN_GLOBAL, isSigner: false, isWritable: false },
      { pubkey: PUMP_FUN_FEE_RECIPIENT, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: userAta, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: PUMP_FUN_EVENT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: PUMP_FUN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: buyData,
  });

  transaction.add(buyInstruction);

  // Add Jito tip if specified (atomic with buy)
  if (jitoTipLamports > 0) {
    const tipAccount =
      JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)];

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: tipAccount,
        lamports: jitoTipLamports,
      })
    );
  }

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  logger.info('Built buy transaction', {
    mint: tokenInfo.mint,
    amountSol,
    maxSolCost: Number(maxSolCost) / LAMPORTS_PER_SOL,
    priorityFee: priorityFeeLamports,
    jitoTip: jitoTipLamports,
  });

  return {
    transaction,
    mint,
  };
}
```

### Step 8.4: Run test to verify it passes

Run:
```bash
npm test -- tests/trading/builder.test.ts
```

Expected: PASS (13 tests)

### Step 8.5: Commit

```bash
mkdir -p src/trading tests/trading
git add src/trading/builder.ts tests/trading/builder.test.ts
git commit -m "feat: add Pump.fun buy transaction builder with PDA derivation"
```

---

## Task 9: Transaction Sender (TDD)

**Files:**
- Create: `tests/trading/sender.test.ts`
- Create: `src/trading/sender.ts`

### Step 9.1: Write the failing test

Create `tests/trading/sender.test.ts`:

```typescript
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

      // Landing succeeds via connection mock
      const landingConnection = {
        sendRawTransaction: vi.fn().mockResolvedValue('landing-sig-456'),
      };

      // We need to mock Connection constructor for this test
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
```

### Step 9.2: Run test to verify it fails

Run:
```bash
npm test -- tests/trading/sender.test.ts
```

Expected: FAIL - Cannot find module '../../src/trading/sender'

### Step 9.3: Write minimal implementation

Create `src/trading/sender.ts`:

```typescript
import { Connection, Keypair, Transaction } from '@solana/web3.js';
import { Config } from '../config';
import { logger } from '../utils/logger';

export interface SendResult {
  signature: string;
  method: 'jito' | 'landing' | 'rpc';
  confirmed: boolean;
}

async function sendViaJito(
  transaction: Transaction,
  wallet: Keypair,
  jitoEndpoint: string
): Promise<string> {
  // Sign transaction
  transaction.sign(wallet);
  const serialized = transaction.serialize();
  const base64Tx = serialized.toString('base64');

  const response = await fetch(`${jitoEndpoint}/api/v1/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: [base64Tx, { encoding: 'base64' }],
    }),
  });

  const result = await response.json();

  if (result.error) {
    throw new Error(`Jito error: ${result.error.message}`);
  }

  return result.result;
}

async function sendViaRpc(
  connection: Connection,
  transaction: Transaction,
  wallet: Keypair
): Promise<string> {
  transaction.sign(wallet);

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });

  return signature;
}

async function confirmTransaction(
  connection: Connection,
  signature: string,
  timeoutMs: number = 30000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const status = await connection.getSignatureStatus(signature);

      if (
        status.value?.confirmationStatus === 'confirmed' ||
        status.value?.confirmationStatus === 'finalized'
      ) {
        return true;
      }

      if (status.value?.err) {
        logger.error('Transaction failed', {
          signature,
          error: JSON.stringify(status.value.err),
        });
        return false;
      }
    } catch {
      // Ignore errors during polling
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  logger.warn('Transaction confirmation timeout', { signature });
  return false;
}

export async function sendTransaction(
  transaction: Transaction,
  wallet: Keypair,
  config: Pick<Config, 'rpcEndpoint' | 'useJito' | 'jitoEndpoint' | 'landingEndpoint'>,
  connection?: Connection,
  confirmTimeoutMs: number = 30000
): Promise<SendResult> {
  const conn = connection || new Connection(config.rpcEndpoint, 'confirmed');
  let signature: string | null = null;
  let method: 'jito' | 'landing' | 'rpc' = 'rpc';

  // Try Jito first if enabled
  if (config.useJito) {
    try {
      logger.info('Sending via Jito...', { endpoint: config.jitoEndpoint });
      signature = await sendViaJito(transaction, wallet, config.jitoEndpoint);
      method = 'jito';
      logger.info('Sent via Jito', { signature });
    } catch (e) {
      logger.warn('Jito send failed, trying fallback', { error: String(e) });
    }
  }

  // Try landing endpoint if Jito failed and landing is configured
  if (!signature && config.landingEndpoint) {
    try {
      logger.info('Sending via Landing endpoint...', {
        endpoint: config.landingEndpoint,
      });
      const landingConnection = new Connection(config.landingEndpoint, 'confirmed');
      signature = await sendViaRpc(landingConnection, transaction, wallet);
      method = 'landing';
      logger.info('Sent via Landing', { signature });
    } catch (e) {
      logger.warn('Landing send failed, trying RPC', { error: String(e) });
    }
  }

  // Fallback to regular RPC
  if (!signature) {
    logger.info('Sending via RPC...');
    signature = await sendViaRpc(conn, transaction, wallet);
    method = 'rpc';
    logger.info('Sent via RPC', { signature });
  }

  // Poll for confirmation
  logger.info('Waiting for confirmation...', { signature });
  const confirmed = await confirmTransaction(conn, signature, confirmTimeoutMs);

  if (confirmed) {
    logger.info('Transaction confirmed', { signature, method });
  } else {
    logger.warn('Transaction not confirmed within timeout', { signature, method });
  }

  return { signature, method, confirmed };
}
```

### Step 9.4: Run test to verify it passes

Run:
```bash
npm test -- tests/trading/sender.test.ts
```

Expected: PASS (9 tests)

### Step 9.5: Commit

```bash
git add src/trading/sender.ts tests/trading/sender.test.ts
git commit -m "feat: add transaction sender with Jito/Landing/RPC fallback chain"
```

---

## Task 10: Geyser Client (TDD)

**Files:**
- Create: `tests/geyser/client.test.ts`
- Create: `src/geyser/client.ts`

### Step 10.1: Write the failing test

Create `tests/geyser/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { GeyserClient, TokenCallback } from '../../src/geyser/client';
import { Config } from '../../src/config';
import { Keypair } from '@solana/web3.js';

// Mock yellowstone-grpc
vi.mock('@triton-one/yellowstone-grpc', () => {
  return {
    default: vi.fn(),
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

describe('GeyserClient', () => {
  let mockStream: EventEmitter & { write: ReturnType<typeof vi.fn> };
  let mockClient: { subscribe: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  let Client: ReturnType<typeof vi.fn>;

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

    // Create mock client
    mockClient = {
      subscribe: vi.fn().mockResolvedValue(mockStream),
      close: vi.fn(),
    };

    // Get the mocked Client constructor
    const module = await import('@triton-one/yellowstone-grpc');
    Client = module.default as ReturnType<typeof vi.fn>;
    Client.mockReturnValue(mockClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
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
    it('should close client connection', async () => {
      const geyser = new GeyserClient(testConfig, testCallback);
      await geyser.connect();
      await geyser.disconnect();

      expect(mockClient.close).toHaveBeenCalled();
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
```

### Step 10.2: Run test to verify it fails

Run:
```bash
npm test -- tests/geyser/client.test.ts
```

Expected: FAIL - Cannot find module '../../src/geyser/client'

### Step 10.3: Write minimal implementation

Create `src/geyser/client.ts`:

```typescript
import Client, {
  CommitmentLevel,
  SubscribeRequest,
  SubscribeUpdate,
} from '@triton-one/yellowstone-grpc';
import { Config } from '../config';
import { logger } from '../utils/logger';
import { TokenInfo } from '../matcher/symbol';
import { isPumpFunCreate, extractTokenInfo, ParsedTransaction } from './parser';
import { PUMP_FUN_PROGRAM_ID } from '../constants';

export type TokenCallback = (token: TokenInfo) => void;

export class GeyserClient {
  private client: Client | null = null;
  private config: Pick<Config, 'grpcEndpoint'>;
  private onToken: TokenCallback;
  private lastSlot: number = 0;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private isRunning: boolean = false;
  private keepaliveInterval: NodeJS.Timeout | null = null;

  constructor(config: Pick<Config, 'grpcEndpoint'>, onToken: TokenCallback) {
    this.config = config;
    this.onToken = onToken;
  }

  async connect(): Promise<void> {
    this.isRunning = true;
    await this.establishConnection();
  }

  private async establishConnection(): Promise<void> {
    try {
      logger.info('Connecting to Geyser...', {
        endpoint: this.config.grpcEndpoint,
      });

      this.client = new Client(this.config.grpcEndpoint, undefined, undefined);

      const request: SubscribeRequest = {
        accounts: {},
        slots: {},
        transactions: {
          pumpfun: {
            vote: false,
            failed: false,
            accountInclude: [PUMP_FUN_PROGRAM_ID.toBase58()],
            accountExclude: [],
            accountRequired: [],
          },
        },
        transactionsStatus: {},
        blocks: {},
        blocksMeta: {},
        entry: {},
        commitment: CommitmentLevel.CONFIRMED,
        accountsDataSlice: [],
        ping: undefined,
      };

      const stream = await this.client.subscribe();

      stream.on('data', (update: SubscribeUpdate) => {
        this.handleUpdate(update);
      });

      stream.on('error', (error: Error) => {
        logger.error('Geyser stream error', { error: error.message });
        this.handleDisconnect();
      });

      stream.on('end', () => {
        logger.warn('Geyser stream ended');
        this.handleDisconnect();
      });

      // Send subscription request
      await new Promise<void>((resolve, reject) => {
        stream.write(request, (err: Error | null | undefined) => {
          if (err) reject(err);
          else resolve();
        });
      });

      this.reconnectAttempts = 0;
      logger.info('Connected to Geyser successfully');

      // Setup keepalive ping every 30 seconds
      this.setupKeepalive(stream);
    } catch (error) {
      logger.error('Failed to connect to Geyser', { error: String(error) });
      this.handleDisconnect();
    }
  }

  private setupKeepalive(stream: ReturnType<Client['subscribe']> extends Promise<infer T> ? T : never): void {
    this.keepaliveInterval = setInterval(() => {
      if (!this.isRunning) {
        if (this.keepaliveInterval) {
          clearInterval(this.keepaliveInterval);
        }
        return;
      }

      try {
        stream.write({ ping: { id: Date.now() } }, (err: Error | null | undefined) => {
          if (err) {
            logger.warn('Keepalive ping failed', { error: err.message });
          }
        });
      } catch (e) {
        logger.warn('Keepalive error', { error: String(e) });
      }
    }, 30000);
  }

  private handleUpdate(update: SubscribeUpdate): void {
    // Handle pong
    if (update.pong) {
      logger.debug('Received pong', { id: update.pong.id });
      return;
    }

    // Handle transaction
    if (update.transaction) {
      const { slot, transaction } = update.transaction;

      // Update last slot for recovery
      if (slot && Number(slot) > this.lastSlot) {
        this.lastSlot = Number(slot);
      }

      if (!transaction?.transaction) return;

      const tx = transaction.transaction;
      const meta = transaction.meta;

      // Build ParsedTransaction from gRPC update
      const parsedTx: ParsedTransaction = {
        slot: Number(slot) || 0,
        signature: tx.signatures?.[0]
          ? Buffer.from(tx.signatures[0]).toString('base64')
          : 'unknown',
        accounts:
          tx.message?.accountKeys?.map((k) =>
            Buffer.from(k).toString('base64')
          ) || [],
        data: Buffer.from(tx.message?.instructions?.[0]?.data || []),
        postTokenBalances:
          meta?.postTokenBalances?.map((b) => ({
            mint: b.mint || '',
            owner: b.owner || '',
          })) || [],
        logs: meta?.logMessages || [],
      };

      // Check if this is a Pump.fun create
      if (isPumpFunCreate(parsedTx)) {
        const tokenInfo = extractTokenInfo(parsedTx);
        if (tokenInfo) {
          logger.info('New token detected', {
            mint: tokenInfo.mint,
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            slot: tokenInfo.slot,
          });
          this.onToken(tokenInfo);
        }
      }
    }
  }

  private async handleDisconnect(): Promise<void> {
    if (!this.isRunning) return;

    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }

    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached, giving up');
      this.isRunning = false;
      return;
    }

    const backoffMs = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      30000
    );
    logger.info('Reconnecting...', {
      attempt: this.reconnectAttempts,
      backoffMs,
      lastSlot: this.lastSlot,
    });

    await new Promise((resolve) => setTimeout(resolve, backoffMs));

    if (this.isRunning) {
      await this.establishConnection();
    }
  }

  async disconnect(): Promise<void> {
    this.isRunning = false;
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    logger.info('Disconnected from Geyser');
  }

  getLastSlot(): number {
    return this.lastSlot;
  }
}
```

### Step 10.4: Run test to verify it passes

Run:
```bash
npm test -- tests/geyser/client.test.ts
```

Expected: PASS (12 tests)

### Step 10.5: Commit

```bash
git add src/geyser/client.ts tests/geyser/client.test.ts
git commit -m "feat: add Geyser client with subscription, keepalive, and reconnection"
```

---

## Task 11: Main Entry Point

**Files:**
- Create: `src/index.ts`

**Note:** This task does not follow strict TDD because the main entry point orchestrates all modules and is difficult to unit test in isolation. Integration testing would be appropriate here, but we're keeping to unit tests only.

### Step 11.1: Create main entry point

Create `src/index.ts`:

```typescript
import 'dotenv/config';
import { Connection } from '@solana/web3.js';
import { loadConfig, Config } from './config';
import { logger, setLogLevel, LogLevel } from './utils/logger';
import { GeyserClient } from './geyser/client';
import { TokenInfo, matchSymbol } from './matcher/symbol';
import { buildBuyTransaction } from './trading/builder';
import { sendTransaction } from './trading/sender';
import { calculateBuyAmount } from './utils/wallet';

async function handleNewToken(token: TokenInfo, config: Config): Promise<void> {
  // Check symbol match
  if (!matchSymbol(token, config)) {
    return;
  }

  logger.info('MATCH FOUND! Processing buy...', {
    symbol: token.symbol,
    mint: token.mint,
  });

  const connection = new Connection(config.rpcEndpoint, 'confirmed');

  // Calculate buy amount (may be less if insufficient balance)
  let buyAmount: number;
  try {
    buyAmount = await calculateBuyAmount(
      connection,
      config.wallet,
      config.buyAmountSol
    );
  } catch (e) {
    logger.error('Cannot buy: insufficient balance', { error: String(e) });
    return;
  }

  // Build transaction
  const { transaction } = await buildBuyTransaction(
    connection,
    config.wallet,
    token,
    buyAmount,
    config.slippageBps,
    config.priorityFeeLamports,
    config.useJito ? config.jitoTipLamports : 0
  );

  // Dry run mode
  if (config.dryRun) {
    logger.info('DRY RUN: Would buy token', {
      mint: token.mint,
      symbol: token.symbol,
      amountSol: buyAmount,
      slippageBps: config.slippageBps,
    });

    // Simulate transaction
    try {
      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        logger.warn('DRY RUN: Simulation failed', {
          error: JSON.stringify(simulation.value.err),
        });
      } else {
        logger.info('DRY RUN: Simulation successful', {
          unitsConsumed: simulation.value.unitsConsumed,
        });
      }
    } catch (e) {
      logger.warn('DRY RUN: Could not simulate', { error: String(e) });
    }

    return;
  }

  // Real execution
  try {
    const result = await sendTransaction(transaction, config.wallet, config);

    logger.info('BUY EXECUTED', {
      signature: result.signature,
      method: result.method,
      confirmed: result.confirmed,
      mint: token.mint,
      symbol: token.symbol,
      amountSol: buyAmount,
    });
  } catch (e) {
    logger.error('Buy failed', { error: String(e), mint: token.mint });
  }
}

async function main(): Promise<void> {
  // Set log level from env
  const logLevel = (process.env.LOG_LEVEL || 'INFO').toUpperCase() as LogLevel;
  setLogLevel(logLevel);

  logger.info('Starting Pump.fun Sniper...');

  // Load and validate config
  let config: Config;
  try {
    config = loadConfig();
  } catch (e) {
    logger.error('Config error', { error: String(e) });
    process.exit(1);
  }

  // Log config (without sensitive data)
  logger.info('Config loaded', {
    grpcEndpoint: config.grpcEndpoint,
    rpcEndpoint: config.rpcEndpoint,
    symbol: config.symbol,
    matchMode: config.matchMode,
    buyAmountSol: config.buyAmountSol,
    slippageBps: config.slippageBps,
    dryRun: config.dryRun,
    useJito: config.useJito,
    wallet: config.wallet.publicKey.toBase58(),
  });

  if (config.dryRun) {
    logger.warn('DRY RUN MODE ENABLED - No real transactions will be sent');
  }

  // Check wallet balance
  const connection = new Connection(config.rpcEndpoint, 'confirmed');
  try {
    const balance = await connection.getBalance(config.wallet.publicKey);
    logger.info('Wallet balance', {
      address: config.wallet.publicKey.toBase58(),
      balanceSol: balance / 1e9,
    });
  } catch (e) {
    logger.warn('Could not fetch wallet balance', { error: String(e) });
  }

  // Create Geyser client
  const geyser = new GeyserClient(config, (token) => {
    // Handle each token in a separate async context
    // This allows processing multiple tokens from the same block
    handleNewToken(token, config).catch((e) => {
      logger.error('Error handling token', {
        error: String(e),
        mint: token.mint,
      });
    });
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await geyser.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Connect and start listening
  await geyser.connect();

  logger.info('Listening for new Pump.fun tokens...', {
    targetSymbol: config.symbol,
    matchMode: config.matchMode,
  });
}

main().catch((e) => {
  logger.error('Fatal error', { error: String(e) });
  process.exit(1);
});
```

### Step 11.2: Verify TypeScript compiles

Run:
```bash
npm run build
```

Expected: Compiles without errors

### Step 11.3: Commit

```bash
git add src/index.ts
git commit -m "feat: add main entry point with full sniper flow"
```

---

## Task 12: Final Package.json and README

**Files:**
- Modify: `package.json`
- Create: `README.md`

### Step 12.1: Finalize package.json

Ensure package.json has all scripts:

```json
{
  "name": "solana-pump-fun-sniper",
  "version": "1.0.0",
  "description": "Real-time token sniper for Pump.fun using Solana Geyser gRPC streaming",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "tsx src/index.ts",
    "start:prod": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "keywords": ["solana", "pump.fun", "sniper", "geyser", "grpc"],
  "license": "MIT"
}
```

### Step 12.2: Create README.md

```markdown
# Solana Pump.fun Sniper

Real-time token sniper for Pump.fun using Solana Geyser gRPC streaming.

## Features

- Real-time token detection via Yellowstone gRPC
- Symbol matching (exact or regex)
- MEV protection via Jito with fallback to landing/RPC
- Dry-run mode for safe testing (enabled by default)
- Auto-reconnection with slot recovery
- Configurable via `.env`

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your settings
```

Required:
- `GRPC_ENDPOINT` - Yellowstone gRPC endpoint
- `RPC_ENDPOINT` - Solana RPC endpoint
- `PRIVATE_KEY` - Your wallet private key (base58)
- `SYMBOL` - Token symbol to snipe (e.g., "PEPE")

### 3. Run

```bash
# Development (dry run by default)
npm start

# Production build
npm run build
npm run start:prod
```

### 4. Run tests

```bash
npm test
npm run test:coverage
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GRPC_ENDPOINT` | Yes | - | Yellowstone gRPC URL |
| `RPC_ENDPOINT` | Yes | - | Solana JSON-RPC URL |
| `PRIVATE_KEY` | Yes | - | Wallet private key (base58) |
| `SYMBOL` | Yes | - | Target token symbol |
| `MATCH_MODE` | No | `exact` | `exact` or `regex` |
| `BUY_AMOUNT_SOL` | No | `0.1` | SOL amount to spend |
| `SLIPPAGE_BPS` | No | `500` | Slippage tolerance (basis points) |
| `DRY_RUN` | No | `true` | Simulate without sending TX |
| `USE_JITO` | No | `true` | Use Jito MEV protection |
| `JITO_TIP_LAMPORTS` | No | `10000` | Jito validator tip |
| `PRIORITY_FEE_LAMPORTS` | No | `5000` | Compute unit price |
| `LANDING_ENDPOINT` | No | - | Fast TX landing endpoint |
| `LOG_LEVEL` | No | `INFO` | DEBUG, INFO, WARN, ERROR |

## Architecture

```
Geyser gRPC → Parser → Matcher → Builder → Sender
     ↓           ↓         ↓         ↓         ↓
  Stream    Pump.fun   Symbol     Buy TX    Jito/RPC
  events    filter     match               fallback
```

## Example Output

```
2025-02-03T12:34:56.789Z [INFO]  Starting Pump.fun Sniper...
2025-02-03T12:34:56.790Z [INFO]  Config loaded {...}
2025-02-03T12:34:56.791Z [WARN]  DRY RUN MODE ENABLED
2025-02-03T12:34:56.800Z [INFO]  Connecting to Geyser...
2025-02-03T12:34:57.100Z [INFO]  Connected to Geyser successfully
2025-02-03T12:34:57.101Z [INFO]  Listening for new Pump.fun tokens...
2025-02-03T12:35:10.500Z [INFO]  New token detected {mint: "7xKX...", symbol: "PEPE"}
2025-02-03T12:35:10.501Z [INFO]  Symbol check: PEPE == PEPE (exact)
2025-02-03T12:35:10.502Z [INFO]  MATCH FOUND! Processing buy...
2025-02-03T12:35:10.550Z [INFO]  DRY RUN: Would buy token {...}
```

## License

MIT
```

### Step 12.3: Commit

```bash
git add package.json README.md
git commit -m "docs: finalize package.json and README"
```

---

## Task 13: Run All Tests and Verify

### Step 13.1: Run all tests

Run:
```bash
npm test
```

Expected: All tests pass

### Step 13.2: Run tests with coverage

Run:
```bash
npm run test:coverage
```

Expected: Coverage report generated

### Step 13.3: Build project

Run:
```bash
npm run build
```

Expected: Compiles without errors to `dist/`

### Step 13.4: Final commit

```bash
git add -A
git commit -m "chore: verify all tests pass and project builds"
```

---

## Verification Checklist

- [ ] `npm install` completes without errors
- [ ] `npm test` runs all tests and they pass
- [ ] `npm run test:coverage` shows coverage report
- [ ] `npm run build` compiles TypeScript without errors
- [ ] `npm start` starts the sniper (requires `.env`)
- [ ] All modules have corresponding test files
- [ ] Tests follow TDD: failing test → implementation → passing test → commit
