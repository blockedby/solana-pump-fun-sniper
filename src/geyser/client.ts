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
  private config: Pick<Config, 'grpcEndpoint' | 'grpcToken'>;
  private onToken: TokenCallback;
  private lastSlot: number = 0;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private isRunning: boolean = false;
  private keepaliveInterval: NodeJS.Timeout | null = null;

  constructor(config: Pick<Config, 'grpcEndpoint' | 'grpcToken'>, onToken: TokenCallback) {
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

      this.client = new Client(this.config.grpcEndpoint, this.config.grpcToken, undefined);
      await this.client.connect();

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
    // Note: yellowstone-grpc Client doesn't expose a close method
    // Setting to null allows garbage collection to clean up the connection
    this.client = null;
    logger.info('Disconnected from Geyser');
  }

  getLastSlot(): number {
    return this.lastSlot;
  }
}
