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
