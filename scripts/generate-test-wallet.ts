#!/usr/bin/env tsx
/**
 * Generate a test wallet for dry-run testing.
 * This wallet has no SOL - use only for testing!
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const keypair = Keypair.generate();

console.log('=== Test Wallet Generated ===\n');
console.log('Public Key:', keypair.publicKey.toBase58());
console.log('Private Key (base58):', bs58.encode(keypair.secretKey));
console.log('\nAdd to .env:');
console.log(`PRIVATE_KEY=${bs58.encode(keypair.secretKey)}`);
console.log('\n⚠️  This wallet has no SOL. Use only for DRY_RUN=true testing!');
