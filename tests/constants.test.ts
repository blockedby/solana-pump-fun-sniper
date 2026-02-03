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
