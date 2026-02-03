# Functional Requirements Document

**Project:** Solana Pump.fun Token Sniper
**Version:** 1.0
**Date:** 2025-02-03
**Status:** Draft

---

## 1. Overview

### 1.1 Purpose

Build a service that monitors Solana blockchain for new token launches on Pump.fun platform and automatically executes buy transactions when a token matches specified criteria.

### 1.2 Scope

| In Scope | Out of Scope |
|----------|--------------|
| Real-time token detection via Geyser | Web UI / Dashboard |
| Symbol-based filtering | Sell logic / Take profit |
| Buy transaction construction | Multi-wallet support |
| MEV protection | Historical data analysis |
| Dry-run mode | Price prediction |

### 1.3 Definitions

| Term | Definition |
|------|------------|
| **Geyser** | Solana plugin for streaming real-time blockchain data via gRPC |
| **Pump.fun** | Solana-based memecoin launchpad using bonding curve mechanics |
| **MEV** | Maximal Extractable Value; profit extracted by reordering transactions |
| **Bonding Curve** | AMM mechanism where price increases with supply |
| **Sniper** | Bot that detects and buys tokens faster than manual traders |

---

## 2. Functional Requirements

### 2.1 Blockchain Connection

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1.1 | System SHALL connect to Solana via Yellowstone gRPC protocol | Must |
| FR-2.1.2 | System SHALL support configurable gRPC endpoint | Must |
| FR-2.1.3 | System SHALL reconnect automatically on connection loss | Should |
| FR-2.1.4 | System SHALL log connection status changes | Must |

**Acceptance Criteria:**
- Connection established within 10 seconds of startup
- Reconnection attempts with exponential backoff (max 5 attempts)
- All connection events logged with timestamp

### 2.2 Event Streaming

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.2.1 | System SHALL subscribe to transactions involving Pump.fun program | Must |
| FR-2.2.2 | System SHALL filter for token creation events only | Must |
| FR-2.2.3 | System SHALL extract token metadata (mint, symbol, name) from events | Must |
| FR-2.2.4 | System SHALL process events in real-time with minimal latency | Must |

**Technical Details:**
- Pump.fun Program ID: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`
- Subscribe filter: `accountInclude: [PUMP_FUN_PROGRAM_ID]`
- Token address extracted from: `postTokenBalances[0].mint`

**Acceptance Criteria:**
- New token detected within 1 second of on-chain confirmation
- All required metadata extracted successfully
- Invalid/malformed events logged and skipped gracefully

### 2.3 Symbol Matching

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.3.1 | System SHALL support exact symbol matching (case-insensitive) | Must |
| FR-2.3.2 | System SHALL support regex pattern matching as optional mode | Should |
| FR-2.3.3 | System SHALL log all detected tokens regardless of match status | Must |
| FR-2.3.4 | System SHALL log match result (matched/not matched) with reasoning | Must |

**Configuration:**
```
SYMBOL=PEPE           # Target symbol
MATCH_MODE=exact      # exact | regex
```

**Acceptance Criteria:**
- Exact mode: "PEPE" matches "pepe", "Pepe", "PEPE"
- Exact mode: "PEPE" does NOT match "PEPE2", "BABYEPEPE"
- Regex mode: "^PEPE.*" matches "PEPE", "PEPE2", "PEPEWIF"
- Invalid regex pattern logged as error, service continues

### 2.4 Transaction Building

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.4.1 | System SHALL construct valid Pump.fun buy transaction | Must |
| FR-2.4.2 | System SHALL use configurable SOL amount for purchase | Must |
| FR-2.4.3 | System SHALL apply configurable slippage tolerance | Must |
| FR-2.4.4 | System SHALL include priority fee for faster inclusion | Must |
| FR-2.4.5 | System SHALL derive bonding curve address correctly | Must |

**Configuration:**
```
BUY_AMOUNT_SOL=0.1      # Amount to spend
SLIPPAGE_BPS=500        # 5% slippage (500 basis points)
PRIORITY_FEE_LAMPORTS=5000
```

**Acceptance Criteria:**
- Transaction passes simulation before submission
- Correct accounts derived (bonding curve, ATA, etc.)
- Slippage protection included in instruction

### 2.5 Transaction Submission

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.5.1 | System SHALL support Jito for MEV-protected submission | Must |
| FR-2.5.2 | System SHALL fallback to landing endpoint if Jito fails | Should |
| FR-2.5.3 | System SHALL include Jito tip in transaction when enabled | Must |
| FR-2.5.4 | System SHALL log transaction signature on successful submission | Must |
| FR-2.5.5 | System SHALL log error details on failed submission | Must |

**Configuration:**
```
USE_JITO=true
JITO_ENDPOINT=https://mainnet.block-engine.jito.wtf
JITO_TIP_LAMPORTS=10000
LANDING_ENDPOINT=http://fast.ams.node.vali.wtf
```

**Acceptance Criteria:**
- Jito submission includes valid tip instruction
- Fallback triggered within 3 seconds of Jito failure
- Transaction signature logged in format: `sig: <base58>`

### 2.6 Dry Run Mode

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.6.1 | System SHALL support dry-run mode that skips actual submission | Must |
| FR-2.6.2 | System SHALL simulate transaction in dry-run mode | Should |
| FR-2.6.3 | System SHALL log "DRY RUN: would buy <token>" on match | Must |
| FR-2.6.4 | Dry-run mode SHALL be enabled by default | Must |

**Configuration:**
```
DRY_RUN=true    # Default: true (safe mode)
```

**Acceptance Criteria:**
- No SOL spent when DRY_RUN=true
- Full transaction built and logged even in dry-run
- Clear indication in logs that this is a dry run

### 2.7 Logging

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.7.1 | System SHALL log all events with ISO-8601 timestamps | Must |
| FR-2.7.2 | System SHALL log: event detected → match result → buy action → tx signature | Must |
| FR-2.7.3 | System SHALL support configurable log level | Should |
| FR-2.7.4 | System SHALL output logs to stdout (console) | Must |

**Log Format Example:**
```
2025-02-03T12:34:56.789Z [INFO]  New token detected: PEPE (mint: 7xKX...)
2025-02-03T12:34:56.790Z [INFO]  Symbol match: PEPE == PEPE (exact)
2025-02-03T12:34:56.791Z [INFO]  Building buy TX: 0.1 SOL, slippage 5%
2025-02-03T12:34:56.850Z [INFO]  TX submitted via Jito: sig: 4vJ9...
```

**Acceptance Criteria:**
- Logs parseable by standard log aggregators
- Full audit trail from detection to execution

### 2.8 Configuration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.8.1 | System SHALL read configuration from `.env` file | Must |
| FR-2.8.2 | System SHALL validate all required config on startup | Must |
| FR-2.8.3 | System SHALL fail fast with clear error if config invalid | Must |
| FR-2.8.4 | System SHALL NOT log sensitive values (private key) | Must |

**Required Configuration:**
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GRPC_ENDPOINT` | Yes | - | Yellowstone gRPC URL |
| `RPC_ENDPOINT` | Yes | - | Solana JSON-RPC URL |
| `PRIVATE_KEY` | Yes | - | Wallet private key (base58) |
| `SYMBOL` | Yes | - | Target token symbol |
| `MATCH_MODE` | No | `exact` | Matching mode |
| `BUY_AMOUNT_SOL` | No | `0.1` | Purchase amount |
| `SLIPPAGE_BPS` | No | `500` | Slippage tolerance |
| `DRY_RUN` | No | `true` | Disable real transactions |
| `USE_JITO` | No | `true` | Enable Jito MEV protection |
| `JITO_TIP_LAMPORTS` | No | `10000` | Jito validator tip |
| `PRIORITY_FEE_LAMPORTS` | No | `5000` | Compute unit price |

---

## 3. Non-Functional Requirements

### 3.1 Performance

| ID | Requirement |
|----|-------------|
| NFR-3.1.1 | Detection-to-submission latency SHALL be under 500ms |
| NFR-3.1.2 | System SHALL handle 100+ events/second without dropping |
| NFR-3.1.3 | Memory usage SHALL remain stable over 24h operation |

### 3.2 Reliability

| ID | Requirement |
|----|-------------|
| NFR-3.2.1 | System SHALL recover from transient network errors |
| NFR-3.2.2 | System SHALL not crash on malformed blockchain data |
| NFR-3.2.3 | System SHALL gracefully shutdown on SIGINT/SIGTERM |

### 3.3 Security

| ID | Requirement |
|----|-------------|
| NFR-3.3.1 | Private key SHALL never be logged or exposed |
| NFR-3.3.2 | `.env` file SHALL be in `.gitignore` |
| NFR-3.3.3 | System SHALL validate transaction before signing |

### 3.4 Maintainability

| ID | Requirement |
|----|-------------|
| NFR-3.4.1 | Code SHALL follow consistent style (ESLint/Prettier) |
| NFR-3.4.2 | Core components SHALL be modular and testable |
| NFR-3.4.3 | README SHALL include setup and run instructions |

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SNIPER SERVICE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Geyser     │───►│   Event      │───►│   Symbol     │      │
│  │   Client     │    │   Parser     │    │   Matcher    │      │
│  └──────────────┘    └──────────────┘    └──────┬───────┘      │
│         ▲                                       │               │
│         │                                       ▼               │
│  ┌──────────────┐                        ┌──────────────┐      │
│  │   Config     │                        │     TX       │      │
│  │   Manager    │                        │   Builder    │      │
│  └──────────────┘                        └──────┬───────┘      │
│                                                 │               │
│                                                 ▼               │
│                                          ┌──────────────┐      │
│                                          │     TX       │      │
│                                          │   Sender     │      │
│                                          │  (Jito/RPC)  │      │
│                                          └──────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Solana Network  │
                    └──────────────────┘
```

---

## 5. Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `@triton-one/yellowstone-grpc` | Geyser gRPC client | Latest |
| `@solana/web3.js` | Solana SDK | ^1.87 |
| `@solana/spl-token` | Token operations | ^0.3 |
| `jito-ts` | Jito bundle/TX submission | Latest |
| `dotenv` | Environment config | ^16 |
| `bs58` | Base58 encoding | ^5 |

---

## 6. Acceptance Criteria Summary

The system is considered complete when:

1. **Connection**: Successfully connects to Geyser gRPC and streams events
2. **Detection**: Detects new Pump.fun token within 1s of on-chain confirmation
3. **Matching**: Correctly matches/rejects tokens based on symbol config
4. **Transaction**: Builds valid buy transaction with all required parameters
5. **Submission**: Submits via Jito (or fallback) with proper MEV protection
6. **Dry Run**: Does NOT spend SOL when DRY_RUN=true
7. **Logging**: Produces clear audit trail: detect → match → buy → signature
8. **Documentation**: README with setup and run instructions

---

## 7. References

- [Solana Geyser Plugin Documentation](https://docs.solana.com/developing/plugins/geyser-plugins)
- [Yellowstone gRPC](https://github.com/rpcpool/yellowstone-grpc)
- [Pump.fun on Solscan](https://solscan.io/account/6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P)
- [Jito Documentation](https://docs.jito.wtf/)
- [Shyft Pump.fun Examples](https://github.com/Shyft-to/solana-defi/)
