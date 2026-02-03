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
  grpcToken: string | undefined;
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
    grpcToken: process.env.GRPC_TOKEN || undefined,
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
