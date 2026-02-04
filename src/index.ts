import 'dotenv/config';
import { Connection } from '@solana/web3.js';
import { loadConfig, Config } from './config';
import { logger, setLogLevel, LogLevel } from './utils/logger';
import { GeyserClient } from './geyser/client';
import { TokenInfo, matchSymbol } from './matcher/symbol';
import { buildBuyTransaction } from './trading/builder';
import { sendTransaction } from './trading/sender';
import { calculateBuyAmount } from './utils/wallet';

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: String(error) });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

async function handleNewToken(token: TokenInfo, config: Config): Promise<void> {
  // Check symbol match
  if (!matchSymbol(token, config)) {
    return;
  }

  logger.success('🎯 MATCH FOUND! Processing buy...', {
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
