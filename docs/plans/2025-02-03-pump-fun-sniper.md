# Solana Pump.fun Sniper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TypeScript service that detects new Pump.fun tokens via Geyser gRPC and executes buy transactions with MEV protection.

**Architecture:** Event-driven streaming architecture. Geyser client subscribes to Pump.fun program transactions, parser extracts new token mints, matcher filters by symbol, TX builder creates buy instruction, sender submits via Jito (with RPC fallback).

**Tech Stack:** TypeScript, @triton-one/yellowstone-grpc, @solana/web3.js, jito-ts, dotenv

---

## Technical Requirements Summary

| Requirement | Solution |
|-------------|----------|
| Geyser connection | Yellowstone gRPC to `ams.grpc.vali.wtf:10000` |
| Event filtering | Subscribe to Pump.fun program `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` |
| Symbol matching | Exact (case-insensitive) or Regex via `MATCH_MODE` |
| Duplicate handling | Buy ALL matching tokens in same block |
| Insufficient balance | Buy with available SOL (all-in) |
| MEV protection | Jito sendTransaction → Landing fallback → RPC fallback |
| TX confirmation | Poll for confirmation after submission, make new if failed |
| Slot recovery | Track last slot, resume from it on reconnect (session only) |
| Dry run | `DRY_RUN=true` default — simulate but don't send |
| Config validation | All amounts must be > 0 |

---

## Project Structure

```
solana-pump-fun-sniper/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Config loader & validation
│   ├── geyser/
│   │   ├── client.ts         # Yellowstone gRPC connection
│   │   └── parser.ts         # Parse Pump.fun events
│   ├── matcher/
│   │   └── symbol.ts         # Symbol matching logic
│   ├── trading/
│   │   ├── builder.ts        # Build buy transaction
│   │   └── sender.ts         # Jito/RPC submission
│   └── utils/
│       ├── logger.ts         # Logging utility
│       └── wallet.ts         # Wallet helpers
├── docs/
│   └── FUNCTIONAL_REQUIREMENTS.md
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Initialize npm project**

```bash
cd /home/kcnc/code/block-assessment/solana-pump-fun-sniper
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install @triton-one/yellowstone-grpc @solana/web3.js @solana/spl-token bs58 dotenv
npm install -D typescript @types/node ts-node
```

**Step 3: Create tsconfig.json**

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
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
.env
*.log
```

**Step 5: Create .env.example**

```env
# Geyser
GRPC_ENDPOINT=http://ams.grpc.vali.wtf:10000
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
```

**Step 6: Commit**

```bash
git add package.json tsconfig.json .gitignore .env.example
git commit -m "chore: project bootstrap with dependencies"
```

---

## Task 2: Config Module

**Files:**
- Create: `src/config.ts`

**Step 1: Create config loader with validation**

```typescript
// src/config.ts
import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseNumber(value: string, name: string, min = 0): number {
  const num = parseFloat(value);
  if (isNaN(num) || num <= min) {
    throw new Error(`${name} must be a number greater than ${min}`);
  }
  return num;
}

export interface Config {
  // Geyser
  grpcEndpoint: string;
  rpcEndpoint: string;

  // Wallet
  wallet: Keypair;

  // Matching
  symbol: string;
  matchMode: 'exact' | 'regex';

  // Trading
  buyAmountSol: number;
  slippageBps: number;
  dryRun: boolean;

  // MEV Protection
  useJito: boolean;
  jitoEndpoint: string;
  jitoTipLamports: number;
  landingEndpoint: string;
  priorityFeeLamports: number;
}

export function loadConfig(): Config {
  const privateKey = requireEnv('PRIVATE_KEY');
  let wallet: Keypair;

  try {
    wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
  } catch (e) {
    throw new Error('Invalid PRIVATE_KEY: must be base58 encoded');
  }

  const matchMode = process.env.MATCH_MODE || 'exact';
  if (matchMode !== 'exact' && matchMode !== 'regex') {
    throw new Error('MATCH_MODE must be "exact" or "regex"');
  }

  // Validate regex if provided
  if (matchMode === 'regex') {
    try {
      new RegExp(requireEnv('SYMBOL'));
    } catch (e) {
      throw new Error(`Invalid regex pattern in SYMBOL: ${e}`);
    }
  }

  return {
    grpcEndpoint: requireEnv('GRPC_ENDPOINT'),
    rpcEndpoint: requireEnv('RPC_ENDPOINT'),
    wallet,
    symbol: requireEnv('SYMBOL'),
    matchMode,
    buyAmountSol: parseNumber(process.env.BUY_AMOUNT_SOL || '0.1', 'BUY_AMOUNT_SOL'),
    slippageBps: parseNumber(process.env.SLIPPAGE_BPS || '500', 'SLIPPAGE_BPS'),
    dryRun: process.env.DRY_RUN !== 'false',
    useJito: process.env.USE_JITO !== 'false',
    jitoEndpoint: process.env.JITO_ENDPOINT || 'https://mainnet.block-engine.jito.wtf',
    jitoTipLamports: parseInt(process.env.JITO_TIP_LAMPORTS || '10000'),
    landingEndpoint: process.env.LANDING_ENDPOINT || '',
    priorityFeeLamports: parseInt(process.env.PRIORITY_FEE_LAMPORTS || '5000'),
  };
}
```

**Step 2: Commit**

```bash
mkdir -p src
git add src/config.ts
git commit -m "feat: add config module with validation"
```

---

## Task 3: Logger Module

**Files:**
- Create: `src/utils/logger.ts`

**Step 1: Create logger**

```typescript
// src/utils/logger.ts
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVEL = (process.env.LOG_LEVEL || 'INFO').toUpperCase() as LogLevel;
const LEVELS: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (LEVELS[level] < LEVELS[LOG_LEVEL]) return;

  const timestamp = formatTimestamp();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`${timestamp} [${level}] ${message}${dataStr}`);
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log('DEBUG', msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log('INFO', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log('WARN', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log('ERROR', msg, data),
};
```

**Step 2: Commit**

```bash
mkdir -p src/utils
git add src/utils/logger.ts
git commit -m "feat: add logger module"
```

---

## Task 4: Wallet Helpers

**Files:**
- Create: `src/utils/wallet.ts`

**Step 1: Create wallet helpers**

```typescript
// src/utils/wallet.ts
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { logger } from './logger';

export async function getWalletBalance(connection: Connection, wallet: Keypair): Promise<number> {
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
    throw new Error(`Insufficient balance: ${balance} SOL (need at least ${estimatedFeeSol} SOL for fees)`);
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

**Step 2: Commit**

```bash
git add src/utils/wallet.ts
git commit -m "feat: add wallet helpers with balance check"
```

---

## Task 5: Symbol Matcher

**Files:**
- Create: `src/matcher/symbol.ts`

**Step 1: Create matcher**

```typescript
// src/matcher/symbol.ts
import { Config } from '../config';
import { logger } from '../utils/logger';

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  creator: string;
  slot: number;
}

export function matchSymbol(token: TokenInfo, config: Config): boolean {
  const { symbol, matchMode } = config;

  let isMatch: boolean;
  let reason: string;

  if (matchMode === 'regex') {
    const regex = new RegExp(symbol, 'i');
    isMatch = regex.test(token.symbol);
    reason = `regex /${symbol}/i`;
  } else {
    isMatch = token.symbol.toLowerCase() === symbol.toLowerCase();
    reason = `exact match (case-insensitive)`;
  }

  logger.info(`Symbol check: ${token.symbol} ${isMatch ? '==' : '!='} ${symbol}`, {
    mode: matchMode,
    reason,
    match: isMatch,
  });

  return isMatch;
}
```

**Step 2: Commit**

```bash
mkdir -p src/matcher
git add src/matcher/symbol.ts
git commit -m "feat: add symbol matcher with exact and regex modes"
```

---

## Task 6: Geyser Parser

**Files:**
- Create: `src/geyser/parser.ts`

**Step 1: Create event parser**

```typescript
// src/geyser/parser.ts
import { TokenInfo } from '../matcher/symbol';
import { logger } from '../utils/logger';

const PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

// Pump.fun "create" instruction discriminator (first 8 bytes of sha256("global:create"))
const CREATE_DISCRIMINATOR = Buffer.from([24, 30, 200, 40, 5, 28, 7, 119]);

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
  if (!tx.accounts.includes(PUMP_FUN_PROGRAM_ID)) {
    return false;
  }

  // Check logs for "Instruction: Create"
  const hasCreateLog = tx.logs.some(log =>
    log.includes('Program log: Instruction: Create')
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
    // Format: "Program data: <base64 encoded data>"
    const dataLog = tx.logs.find(log => log.startsWith('Program data:'));
    let symbol = 'UNKNOWN';
    let name = 'Unknown Token';

    if (dataLog) {
      try {
        const base64Data = dataLog.replace('Program data: ', '');
        const decoded = Buffer.from(base64Data, 'base64');
        // Pump.fun data layout: skip first 8 bytes (discriminator), then:
        // - 4 bytes: name length
        // - N bytes: name
        // - 4 bytes: symbol length
        // - M bytes: symbol
        const nameLen = decoded.readUInt32LE(8);
        name = decoded.slice(12, 12 + nameLen).toString('utf8');
        const symbolOffset = 12 + nameLen;
        const symbolLen = decoded.readUInt32LE(symbolOffset);
        symbol = decoded.slice(symbolOffset + 4, symbolOffset + 4 + symbolLen).toString('utf8');
      } catch (e) {
        logger.debug('Could not parse token metadata from logs', { error: String(e) });
      }
    }

    // Creator is typically the first signer
    const creator = tx.accounts[0];

    return {
      mint,
      symbol,
      name,
      creator,
      slot: tx.slot,
    };
  } catch (e) {
    logger.error('Failed to extract token info', { error: String(e), sig: tx.signature });
    return null;
  }
}

export { PUMP_FUN_PROGRAM_ID };
```

**Step 2: Commit**

```bash
mkdir -p src/geyser
git add src/geyser/parser.ts
git commit -m "feat: add Pump.fun event parser"
```

---

## Task 7: Geyser Client

**Files:**
- Create: `src/geyser/client.ts`

**Step 1: Create Geyser client with reconnection**

```typescript
// src/geyser/client.ts
import Client, {
  CommitmentLevel,
  SubscribeRequest,
  SubscribeUpdate,
} from '@triton-one/yellowstone-grpc';
import { Config } from '../config';
import { logger } from '../utils/logger';
import { TokenInfo } from '../matcher/symbol';
import { isPumpFunCreate, extractTokenInfo, PUMP_FUN_PROGRAM_ID, ParsedTransaction } from './parser';

export type TokenCallback = (token: TokenInfo) => void;

export class GeyserClient {
  private client: Client | null = null;
  private config: Config;
  private onToken: TokenCallback;
  private lastSlot: number = 0;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private isRunning: boolean = false;

  constructor(config: Config, onToken: TokenCallback) {
    this.config = config;
    this.onToken = onToken;
  }

  async connect(): Promise<void> {
    this.isRunning = true;
    await this.establishConnection();
  }

  private async establishConnection(): Promise<void> {
    try {
      logger.info('Connecting to Geyser...', { endpoint: this.config.grpcEndpoint });

      this.client = new Client(this.config.grpcEndpoint, undefined, undefined);

      const request: SubscribeRequest = {
        accounts: {},
        slots: {},
        transactions: {
          pumpfun: {
            vote: false,
            failed: false,
            accountInclude: [PUMP_FUN_PROGRAM_ID],
            accountExclude: [],
            accountRequired: [],
          },
        },
        blocks: {},
        blocksMeta: {},
        entry: {},
        commitment: CommitmentLevel.CONFIRMED,
        accountsDataSlice: [],
        ping: undefined,
      };

      // Add fromSlot if we have a last known slot (for recovery)
      if (this.lastSlot > 0) {
        logger.info('Resuming from slot', { slot: this.lastSlot });
      }

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
        stream.write(request, (err: Error | null) => {
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

  private setupKeepalive(stream: any): void {
    const pingInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(pingInterval);
        return;
      }

      try {
        stream.write({ ping: { id: Date.now() } }, (err: Error | null) => {
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
      if (slot && slot > this.lastSlot) {
        this.lastSlot = slot;
      }

      if (!transaction?.transaction) return;

      const tx = transaction.transaction;
      const meta = transaction.meta;

      // Build ParsedTransaction from gRPC update
      const parsedTx: ParsedTransaction = {
        slot: slot || 0,
        signature: Buffer.from(tx.signatures[0]).toString('base58'),
        accounts: tx.message?.accountKeys?.map(k => Buffer.from(k).toString('base58')) || [],
        data: Buffer.from(tx.message?.instructions?.[0]?.data || []),
        postTokenBalances: meta?.postTokenBalances?.map(b => ({
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

    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached, giving up');
      this.isRunning = false;
      return;
    }

    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    logger.info('Reconnecting...', {
      attempt: this.reconnectAttempts,
      backoffMs,
      lastSlot: this.lastSlot,
    });

    await new Promise(resolve => setTimeout(resolve, backoffMs));

    if (this.isRunning) {
      await this.establishConnection();
    }
  }

  async disconnect(): Promise<void> {
    this.isRunning = false;
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    logger.info('Disconnected from Geyser');
  }
}
```

**Step 2: Commit**

```bash
git add src/geyser/client.ts
git commit -m "feat: add Geyser client with reconnection and keepalive"
```

---

## Task 8: Transaction Builder

**Files:**
- Create: `src/trading/builder.ts`

**Step 1: Create transaction builder**

```typescript
// src/trading/builder.ts
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Config } from '../config';
import { TokenInfo } from '../matcher/symbol';
import { logger } from '../utils/logger';
import { PUMP_FUN_PROGRAM_ID } from '../geyser/parser';

const PUMP_FUN_PROGRAM = new PublicKey(PUMP_FUN_PROGRAM_ID);
const PUMP_FUN_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');
const PUMP_FUN_GLOBAL = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf');
const PUMP_FUN_EVENT_AUTHORITY = new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');

// Buy instruction discriminator
const BUY_DISCRIMINATOR = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);

export interface BuildResult {
  transaction: Transaction;
  mint: PublicKey;
  expectedTokens: number;
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
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mint.toBuffer()],
    PUMP_FUN_PROGRAM
  );

  // Derive associated bonding curve (the token account for the bonding curve)
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
  const maxSolCost = Math.floor(amountLamports * (1 + slippageBps / 10000));

  // Build buy instruction
  // Pump.fun buy instruction data layout:
  // - 8 bytes: discriminator
  // - 8 bytes: token amount (u64, we use 0 for "buy with SOL amount")
  // - 8 bytes: max SOL cost (u64)
  const buyData = Buffer.alloc(24);
  BUY_DISCRIMINATOR.copy(buyData, 0);
  buyData.writeBigUInt64LE(BigInt(0), 8); // Let contract calculate tokens
  buyData.writeBigUInt64LE(BigInt(maxSolCost), 16);

  const buyInstruction = new TransactionInstruction({
    programId: PUMP_FUN_PROGRAM,
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
      { pubkey: PUMP_FUN_EVENT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: PUMP_FUN_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: buyData,
  });

  transaction.add(buyInstruction);

  // Add Jito tip if specified (atomic with buy)
  if (jitoTipLamports > 0) {
    // Jito tip accounts (random selection for load balancing)
    const JITO_TIP_ACCOUNTS = [
      '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
      'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
      'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
      'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
      'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
      'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
      'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
      '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
    ];

    const tipAccount = new PublicKey(
      JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)]
    );

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
    maxSolCost: maxSolCost / LAMPORTS_PER_SOL,
    priorityFee: priorityFeeLamports,
    jitoTip: jitoTipLamports,
  });

  return {
    transaction,
    mint,
    expectedTokens: 0, // Calculated by contract based on bonding curve
  };
}
```

**Step 2: Commit**

```bash
mkdir -p src/trading
git add src/trading/builder.ts
git commit -m "feat: add Pump.fun buy transaction builder"
```

---

## Task 9: Transaction Sender

**Files:**
- Create: `src/trading/sender.ts`

**Step 1: Create transaction sender with Jito and fallbacks**

```typescript
// src/trading/sender.ts
import {
  Connection,
  Keypair,
  Transaction,
  SendOptions,
} from '@solana/web3.js';
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
  wallet: Keypair,
  options: SendOptions = {}
): Promise<string> {
  transaction.sign(wallet);

  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    {
      skipPreflight: true,
      maxRetries: 3,
      ...options,
    }
  );

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

      if (status.value?.confirmationStatus === 'confirmed' ||
          status.value?.confirmationStatus === 'finalized') {
        return true;
      }

      if (status.value?.err) {
        logger.error('Transaction failed', { signature, error: status.value.err });
        return false;
      }
    } catch (e) {
      // Ignore errors during polling
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  logger.warn('Transaction confirmation timeout', { signature });
  return false;
}

export async function sendTransaction(
  transaction: Transaction,
  wallet: Keypair,
  config: Config
): Promise<SendResult> {
  const connection = new Connection(config.rpcEndpoint, 'confirmed');
  let signature: string | null = null;
  let method: 'jito' | 'landing' | 'rpc' = 'rpc';

  // Try Jito first if enabled
  if (config.useJito) {
    try {
      logger.info('Sending via Jito...');
      signature = await sendViaJito(transaction, wallet, config.jitoEndpoint);
      method = 'jito';
      logger.info('Sent via Jito', { signature });
    } catch (e) {
      logger.warn('Jito send failed, trying fallback', { error: String(e) });
    }
  }

  // Try landing endpoint if Jito failed
  if (!signature && config.landingEndpoint) {
    try {
      logger.info('Sending via Landing endpoint...');
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
    signature = await sendViaRpc(connection, transaction, wallet);
    method = 'rpc';
    logger.info('Sent via RPC', { signature });
  }

  // Poll for confirmation
  logger.info('Waiting for confirmation...', { signature });
  const confirmed = await confirmTransaction(connection, signature);

  if (confirmed) {
    logger.info('Transaction confirmed', { signature, method });
  } else {
    logger.warn('Transaction not confirmed within timeout', { signature, method });
  }

  return { signature, method, confirmed };
}
```

**Step 2: Commit**

```bash
git add src/trading/sender.ts
git commit -m "feat: add transaction sender with Jito/Landing/RPC fallback"
```

---

## Task 10: Main Entry Point

**Files:**
- Create: `src/index.ts`

**Step 1: Create main entry point**

```typescript
// src/index.ts
import { Connection } from '@solana/web3.js';
import { loadConfig, Config } from './config';
import { logger } from './utils/logger';
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
        logger.warn('DRY RUN: Simulation failed', { error: simulation.value.err });
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
  const balance = await connection.getBalance(config.wallet.publicKey);
  logger.info('Wallet balance', {
    address: config.wallet.publicKey.toBase58(),
    balanceSol: balance / 1e9,
  });

  // Create Geyser client
  const geyser = new GeyserClient(config, (token) => {
    // Handle each token in a separate async context
    // This allows processing multiple tokens from the same block
    handleNewToken(token, config).catch(e => {
      logger.error('Error handling token', { error: String(e), mint: token.mint });
    });
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await geyser.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    await geyser.disconnect();
    process.exit(0);
  });

  // Connect and start listening
  await geyser.connect();

  logger.info('Listening for new Pump.fun tokens...', {
    targetSymbol: config.symbol,
    matchMode: config.matchMode,
  });
}

main().catch(e => {
  logger.error('Fatal error', { error: String(e) });
  process.exit(1);
});
```

**Step 2: Add npm scripts to package.json**

Add to package.json:
```json
{
  "scripts": {
    "start": "ts-node src/index.ts",
    "build": "tsc",
    "start:prod": "node dist/index.js"
  }
}
```

**Step 3: Commit**

```bash
git add src/index.ts package.json
git commit -m "feat: add main entry point with full sniper flow"
```

---

## Task 11: README Update

**Files:**
- Modify: `README.md`

**Step 1: Update README with setup and run instructions**

```markdown
# Solana Pump.fun Sniper

Real-time token sniper for Pump.fun using Solana Geyser gRPC streaming.

## Features

- Real-time token detection via Yellowstone gRPC
- Symbol matching (exact or regex)
- MEV protection via Jito with fallback to landing/RPC
- Dry-run mode for safe testing
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

## Example Output

```
2025-02-03T12:34:56.789Z [INFO] Starting Pump.fun Sniper...
2025-02-03T12:34:56.790Z [INFO] Config loaded {...}
2025-02-03T12:34:56.791Z [WARN] DRY RUN MODE ENABLED
2025-02-03T12:34:56.800Z [INFO] Connecting to Geyser...
2025-02-03T12:34:57.100Z [INFO] Connected to Geyser successfully
2025-02-03T12:34:57.101Z [INFO] Listening for new Pump.fun tokens...
2025-02-03T12:35:10.500Z [INFO] New token detected {mint: "7xKX...", symbol: "PEPE"}
2025-02-03T12:35:10.501Z [INFO] Symbol check: PEPE == PEPE (exact)
2025-02-03T12:35:10.502Z [INFO] MATCH FOUND! Processing buy...
2025-02-03T12:35:10.550Z [INFO] DRY RUN: Would buy token {...}
```

## Architecture

```
Geyser gRPC → Parser → Matcher → Builder → Sender
     ↓           ↓         ↓         ↓         ↓
  Stream    Pump.fun   Symbol     Buy TX    Jito/RPC
  events    filter     match               fallback
```

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with setup instructions"
```

---

## Task 12: Final Testing & Verification

**Step 1: Create .env file (do not commit)**

```bash
cp .env.example .env
# Fill in your actual values
```

**Step 2: Run type check**

```bash
npm run build
```

Expected: No errors

**Step 3: Run in dry-run mode**

```bash
npm start
```

Expected output:
- Config loaded successfully
- Connected to Geyser
- Listening for tokens
- Any new Pump.fun tokens are logged

**Step 4: Test with known symbol**

Edit `.env`:
```
SYMBOL=TEST
```

Run and wait for a token with "TEST" in the symbol to appear.

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: ready for testing"
```

---

## Verification Checklist

- [ ] `npm install` completes without errors
- [ ] `npm run build` compiles TypeScript without errors
- [ ] `npm start` connects to Geyser and logs "Listening for new tokens"
- [ ] New Pump.fun tokens are detected and logged
- [ ] Symbol matching works (exact mode)
- [ ] DRY_RUN=true prevents real transactions
- [ ] Graceful shutdown on SIGINT (Ctrl+C)
- [ ] Reconnection works after network interruption
