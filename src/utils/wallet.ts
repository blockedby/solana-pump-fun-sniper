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
