#!/usr/bin/env bash
# can-i-deploy.sh
#
# Checks PactFlow to confirm it is safe to deploy the named pacticipant.
# Exits 0 if safe, 1 if not safe or if configuration is missing.
#
# Usage:
#   PACT_BROKER_BASE_URL=https://... PACT_BROKER_TOKEN=... \
#     bash scripts/can-i-deploy.sh payments-gateway abc123
#
#   Or with environment variables only (reads PACTICIPANT and VERSION):
#     PACTICIPANT=payments-gateway VERSION=abc123 bash scripts/can-i-deploy.sh

set -e

PACTICIPANT="${1:-${PACTICIPANT}}"
VERSION="${2:-${VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo 'local')}}"
ENVIRONMENT="${3:-production}"

if [[ -z "$PACTICIPANT" ]]; then
  echo "ERROR: pacticipant name required as first argument or PACTICIPANT env var"
  exit 1
fi

if [[ -z "$PACT_BROKER_BASE_URL" ]] || [[ -z "$PACT_BROKER_TOKEN" ]]; then
  echo "ERROR: PACT_BROKER_BASE_URL and PACT_BROKER_TOKEN must be set"
  exit 1
fi

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║              Pact can-i-deploy check                  ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "  Pacticipant : ${PACTICIPANT}"
echo "  Version     : ${VERSION}"
echo "  Environment : ${ENVIRONMENT}"
echo "  Broker      : ${PACT_BROKER_BASE_URL}"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Try Pact CLI if installed
if command -v pact-broker &> /dev/null; then
  pact-broker can-i-deploy \
    --pacticipant "${PACTICIPANT}" \
    --version "${VERSION}" \
    --to-environment "${ENVIRONMENT}" \
    --broker-base-url "${PACT_BROKER_BASE_URL}" \
    --broker-token "${PACT_BROKER_TOKEN}"
  EXIT_CODE=$?
else
  # Fallback: call PactFlow API directly
  echo "pact-broker CLI not found — using PactFlow API directly"
  RESPONSE=$(curl -sf \
    -H "Authorization: Bearer ${PACT_BROKER_TOKEN}" \
    "${PACT_BROKER_BASE_URL}/pacticipants/${PACTICIPANT}/versions/${VERSION}/can-i-deploy?environment=${ENVIRONMENT}")
  EXIT_CODE=$?

  if [[ $EXIT_CODE -ne 0 ]]; then
    echo "BLOCKED: PactFlow API call failed or returned an error"
    exit 1
  fi

  CAN_DEPLOY=$(echo "$RESPONSE" | grep -o '"summary":{"deployable":[^,}]*' | grep -o 'true\|false')
  if [[ "$CAN_DEPLOY" == "true" ]]; then
    echo "OK: ${PACTICIPANT}@${VERSION} is safe to deploy to ${ENVIRONMENT}"
    EXIT_CODE=0
  else
    echo "BLOCKED: ${PACTICIPANT}@${VERSION} is NOT safe to deploy to ${ENVIRONMENT}"
    echo "Check PactFlow for verification details: ${PACT_BROKER_BASE_URL}"
    EXIT_CODE=1
  fi
fi

exit $EXIT_CODE
