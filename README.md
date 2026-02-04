# Solana Pump.fun Sniper

Real-time token sniper for Pump.fun using Solana Geyser gRPC streaming.

## Features

- Real-time token detection via Yellowstone gRPC
- Symbol matching (exact or regex)
- MEV protection via Jito with fallback to landing/RPC
- Dry-run mode for safe testing (enabled by default)
- Auto-reconnection with slot recovery
- Configurable via `.env`

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your settings
```

Required:

- `GRPC_ENDPOINT` - Yellowstone gRPC endpoint
- `RPC_ENDPOINT` - Solana RPC endpoint
- `PRIVATE_KEY` - Your wallet private key (base58)
- `SYMBOL` - Token symbol to snipe (e.g., "PEPE")

### 3. Run

```bash
# Development (dry run by default)
npm start

# Production build
npm run build
npm run start:prod
```

### 4. Run tests

```bash
npm test
npm run test:coverage
```

## Dry Run Mode (Safe Testing)

By default, the sniper runs in **dry-run mode** (`DRY_RUN=true`). In this mode:

- Transactions are **built but not sent** to the network
- Transactions are **simulated** to verify they would succeed
- No real SOL is spent
- You can safely test symbol matching and transaction building

### Testing Without a Real Wallet

Don't have a Solana wallet? Generate a test keypair:

```bash
npm run generate-wallet
```

This creates a random keypair for testing. Copy the `PRIVATE_KEY=...` line to your `.env` file.

**Note:** This wallet has no SOL, but that's fine for dry-run mode!

### Running in Dry Run Mode

```bash
# Dry run is enabled by default - just run:
npm start
```

To enable **live trading** (real transactions), explicitly set:

```bash
# In .env file:
DRY_RUN=false
```

**Warning:** With `DRY_RUN=false`, real transactions will be sent and SOL will be spent.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GRPC_ENDPOINT` | Yes | - | Yellowstone gRPC URL |
| `RPC_ENDPOINT` | Yes | - | Solana JSON-RPC URL |
| `PRIVATE_KEY` | Yes | - | Wallet private key (base58) |
| `SYMBOL` | Yes | - | Target token symbol (or regex pattern) |
| `MATCH_MODE` | No | `exact` | `exact` or `regex` (case-insensitive) |
| `BUY_AMOUNT_SOL` | No | `0.1` | SOL amount to spend |
| `SLIPPAGE_BPS` | No | `500` | Slippage tolerance (basis points) |
| `DRY_RUN` | No | `true` | Simulate without sending TX |
| `USE_JITO` | No | `true` | Use Jito MEV protection |
| `JITO_TIP_LAMPORTS` | No | `10000` | Jito validator tip |
| `PRIORITY_FEE_LAMPORTS` | No | `5000` | Compute unit price |
| `LANDING_ENDPOINT` | No | - | Fast TX landing endpoint |
| `LOG_LEVEL` | No | `INFO` | DEBUG, INFO, WARN, ERROR |

### Symbol Matching Examples

**Exact match** (default):

```env
SYMBOL=PEPE
MATCH_MODE=exact
```

Matches only `PEPE` (case-insensitive).

**Regex match** - multiple symbols:

```env
SYMBOL=trump|molt|epstein
MATCH_MODE=regex
```

Matches `TRUMP`, `MOLT`, `EPSTEIN`, `TrumpX`, `MOLTPET`, etc.

**Regex match** - starts with:

```env
SYMBOL=^pepe
MATCH_MODE=regex
```

Matches symbols starting with `pepe`: `PEPE`, `PEPE2`, `PepeKing`.

**Regex match** - ends with:

```env
SYMBOL=trump$
MATCH_MODE=regex
```

Matches symbols ending with `trump`: `TRUMP`, `BABYTRUMP`.

**Regex match** - contains:

```env
SYMBOL=doge
MATCH_MODE=regex
```

Matches any symbol containing `doge`: `DOGE`, `BABYDOGE`, `DogeKing`.

## Architecture

```
Geyser gRPC → Parser → Matcher → Builder → Sender
     ↓           ↓         ↓         ↓         ↓
  Stream    Pump.fun   Symbol     Buy TX    Jito/RPC
  events    filter     match               fallback
```

## Example Output

```
2025-02-03T12:34:56.789Z [INFO]  Starting Pump.fun Sniper...
2025-02-03T12:34:56.790Z [INFO]  Config loaded {...}
2025-02-03T12:34:56.791Z [WARN]  DRY RUN MODE ENABLED
2025-02-03T12:34:56.800Z [INFO]  Connecting to Geyser...
2025-02-03T12:34:57.100Z [INFO]  Connected to Geyser successfully
2025-02-03T12:34:57.101Z [INFO]  Listening for new Pump.fun tokens...
2025-02-03T12:35:10.500Z [INFO]  New token detected {mint: "7xKX...", symbol: "PEPE"}
2025-02-03T12:35:10.501Z [INFO]  Symbol check: PEPE == PEPE (exact)
2025-02-03T12:35:10.502Z [INFO]  MATCH FOUND! Processing buy...
2025-02-03T12:35:10.550Z [INFO]  DRY RUN: Would buy token {...}
```

## License

MIT
