#!/usr/bin/env bash
# Thin wrapper — delegates to root scripts/can-i-deploy.sh
# Usage: npm run can-i-deploy -- payments-gateway abc123
exec bash "$(dirname "$0")/../../../../scripts/can-i-deploy.sh" "$@"
