#!/usr/bin/env bash
set -e

PARABANK_URL="${PARABANK_URL:-http://localhost:3000/parabank}"
MAX_ATTEMPTS=20
ATTEMPT=0

echo "Waiting for ParaBank to be ready..."
until curl -sf "${PARABANK_URL}/" > /dev/null 2>&1; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
    echo "ERROR: ParaBank did not start after ${MAX_ATTEMPTS} attempts"
    exit 1
  fi
  echo "  Attempt ${ATTEMPT}/${MAX_ATTEMPTS} — retrying in 5s..."
  sleep 5
done

echo "ParaBank is up. Initialising database..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${PARABANK_URL}/services/bank/initializeDB")

if [ "$HTTP_STATUS" = "204" ] || [ "$HTTP_STATUS" = "200" ]; then
  echo "Database initialised successfully (HTTP ${HTTP_STATUS})"
else
  echo "WARNING: initializeDB returned HTTP ${HTTP_STATUS} — may already be initialised"
fi
