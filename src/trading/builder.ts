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
