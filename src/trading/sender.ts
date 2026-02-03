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

  const result = (await response.json()) as {
    error?: { message: string };
    result?: string;
  };

  if (result.error) {
    throw new Error(`Jito error: ${result.error.message}`);
  }

  return result.result as string;
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
  // Skip landing if a connection was explicitly provided (e.g., in tests)
  if (!signature && config.landingEndpoint && !connection) {
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
