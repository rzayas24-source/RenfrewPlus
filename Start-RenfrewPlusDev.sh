#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8001}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5174}"
APP_DIR="${APP_DIR:-Script}"
FRONTEND_DIR="${FRONTEND_DIR:-Frontend}"
CONFIG_PATH="${WORKFLOW_CONFIG_PATH:-}"
PYTHON_BIN="${PYTHON:-python3}"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

if [[ -n "$CONFIG_PATH" ]]; then
  "$PYTHON_BIN" Start-RenfrewPlusDev.py \
    --backend-host "$BACKEND_HOST" \
    --backend-port "$BACKEND_PORT" \
    --frontend-host "$FRONTEND_HOST" \
    --frontend-port "$FRONTEND_PORT" \
    --app-dir "$APP_DIR" \
    --frontend-dir "$FRONTEND_DIR" \
    --config-path "$CONFIG_PATH"
else
  "$PYTHON_BIN" Start-RenfrewPlusDev.py \
    --backend-host "$BACKEND_HOST" \
    --backend-port "$BACKEND_PORT" \
    --frontend-host "$FRONTEND_HOST" \
    --frontend-port "$FRONTEND_PORT" \
    --app-dir "$APP_DIR" \
    --frontend-dir "$FRONTEND_DIR"
fi
