#!/bin/bash

# Solana Geyser Connectivity Checker
# Run: ./check-connectivity.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Endpoints
RPC_URL="http://ams.node.vali.wtf/"
WS_URL="ws://ams.socket.vali.wtf/"
GRPC_URL="http://ams.grpc.vali.wtf:10000/"
LANDING_URL="http://fast.ams.node.vali.wtf/"

echo "======================================"
echo "  Solana Geyser Connectivity Check"
echo "======================================"
echo ""

# Check current IP
echo -n "Your IP: "
curl -s ifconfig.me || echo "Failed to get IP"
echo ""
echo ""

# 1. RPC Health Check
echo -n "[RPC] $RPC_URL ... "
RPC_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' 2>/dev/null) || RPC_RESPONSE="000"

if [ "$RPC_RESPONSE" = "200" ]; then
  echo -e "${GREEN}OK${NC} (HTTP $RPC_RESPONSE)"
else
  echo -e "${RED}FAIL${NC} (HTTP $RPC_RESPONSE)"
fi

# 2. RPC getSlot (actual data test)
echo -n "[RPC] getSlot test ... "
SLOT_RESPONSE=$(curl -s --max-time 5 \
  -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getSlot"}' 2>/dev/null) || SLOT_RESPONSE=""

if echo "$SLOT_RESPONSE" | grep -q '"result"'; then
  SLOT=$(echo "$SLOT_RESPONSE" | grep -o '"result":[0-9]*' | cut -d: -f2)
  echo -e "${GREEN}OK${NC} (slot: $SLOT)"
else
  echo -e "${RED}FAIL${NC}"
  echo "  Response: $SLOT_RESPONSE"
fi

# 3. Landing/Fast endpoint
echo -n "[LANDING] $LANDING_URL ... "
LANDING_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$LANDING_URL" 2>/dev/null) || LANDING_RESPONSE="000"

if [ "$LANDING_RESPONSE" = "200" ] || [ "$LANDING_RESPONSE" = "405" ]; then
  echo -e "${GREEN}OK${NC} (HTTP $LANDING_RESPONSE)"
else
  echo -e "${YELLOW}WARN${NC} (HTTP $LANDING_RESPONSE)"
fi

# 4. gRPC port check (TCP connectivity)
echo -n "[gRPC] ams.grpc.vali.wtf:10000 TCP ... "
if timeout 3 bash -c "echo >/dev/tcp/ams.grpc.vali.wtf/10000" 2>/dev/null; then
  echo -e "${GREEN}OK${NC} (port open)"
else
  echo -e "${RED}FAIL${NC} (port closed or timeout)"
fi

# 5. gRPC HTTP/2 check (grpcurl would be better but curl works for basic check)
echo -n "[gRPC] HTTP endpoint ... "
GRPC_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$GRPC_URL" 2>/dev/null) || GRPC_HTTP="000"
echo -e "${YELLOW}HTTP $GRPC_HTTP${NC} (gRPC uses HTTP/2, full test needs grpcurl)"

# 6. WebSocket check (basic TCP)
echo -n "[WS] ams.socket.vali.wtf:80 TCP ... "
if timeout 3 bash -c "echo >/dev/tcp/ams.socket.vali.wtf/80" 2>/dev/null; then
  echo -e "${GREEN}OK${NC} (port open)"
else
  echo -e "${RED}FAIL${NC} (port closed or timeout)"
fi

echo ""
echo "======================================"
echo "  Summary"
echo "======================================"

# Quick summary
echo ""
echo "If gRPC shows OK but you get errors in code:"
echo "  1. Check x-token header requirement"
echo "  2. Try with/without TLS (grpc:// vs grpc+tls://)"
echo "  3. Verify IP whitelist is active"
echo ""
echo "To test gRPC properly, install grpcurl:"
echo "  brew install grpcurl  # macOS"
echo "  go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest"
echo ""
echo "Then run:"
echo "  grpcurl -plaintext ams.grpc.vali.wtf:10000 list"
