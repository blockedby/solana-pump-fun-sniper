# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Solana Pump.fun token sniper: real-time detection of new tokens on Pump.fun via Geyser gRPC streaming, with automatic buy execution and MEV protection.

**Status:** Pre-implementation. See `docs/plans/2025-02-03-pump-fun-sniper.md` for implementation plan.

## Build & Run Commands

```bash
npm install              # Install dependencies
npm run build            # Compile TypeScript
npm start                # Run in dev mode (ts-node)
npm run start:prod       # Run compiled JS

./check-connectivity.sh  # Test Geyser/RPC connectivity
```

## Architecture

Event-driven streaming pipeline:

```
Geyser gRPC → Parser → Matcher → Builder → Sender
```

| Component | Location | Purpose |
|-----------|----------|---------|
| GeyserClient | `src/geyser/client.ts` | Yellowstone gRPC subscription with reconnection |
| Parser | `src/geyser/parser.ts` | Detect Pump.fun "create" events, extract token metadata |
| Matcher | `src/matcher/symbol.ts` | Symbol filtering (exact/regex) |
| Builder | `src/trading/builder.ts` | Construct Pump.fun buy transaction with PDAs |
| Sender | `src/trading/sender.ts` | Submit via Jito → Landing → RPC fallback chain |
| Config | `src/config.ts` | Env validation, keypair loading |

## Key Technical Details

**Pump.fun Program:** `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`

**Geyser Subscription:** Filter transactions by `accountInclude: [PUMP_FUN_PROGRAM_ID]`, look for "Instruction: Create" in logs.

**Bonding Curve PDA:** Derived as `seeds: ['bonding-curve', mint.toBuffer()]` from Pump.fun program.

**TX Submission Priority:** Jito sendTransaction → Landing endpoint → standard RPC

**Safety:** `DRY_RUN=true` by default - simulates but doesn't send real transactions.

## Configuration (.env)

Required: `GRPC_ENDPOINT`, `RPC_ENDPOINT`, `PRIVATE_KEY`, `SYMBOL`

```bash
cp .env.example .env
# Edit .env with your credentials
```

Key options:
- `MATCH_MODE`: `exact` (default) or `regex`
- `BUY_AMOUNT_SOL`, `SLIPPAGE_BPS`: Trading parameters
- `USE_JITO`, `JITO_TIP_LAMPORTS`: MEV protection settings

## Code Conventions

- TypeScript strict mode
- Logging via `src/utils/logger.ts` with ISO-8601 timestamps
- Never log private keys or sensitive data
- Graceful shutdown on SIGINT/SIGTERM

## Gotchas

**Geyser gRPC:**
- Send keepalive pings every 30s or connection drops
- Track `lastSlot` for recovery after reconnect
- Use `accountInclude` filter, not `accountRequired`

**Pump.fun:**
- Program ID: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`
- New token mint is in `postTokenBalances[0].mint`
- Look for "Instruction: Create" in logs

**Jito:**
- Tip must be in SAME transaction as swap (atomic)
- Use random tip account from pool for load balancing
- Fallback to Landing → RPC if Jito fails

## Documentation

- `docs/FUNCTIONAL_REQUIREMENTS.md` — Full requirements spec
- `docs/plans/2025-02-03-pump-fun-sniper.md` — Implementation plan
