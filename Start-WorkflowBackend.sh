#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8001}"
APP_DIR="${APP_DIR:-Script}"

if [[ -n "${WORKFLOW_CONFIG_PATH:-}" ]]; then
  if [[ "$WORKFLOW_CONFIG_PATH" != /* ]]; then
    export WORKFLOW_CONFIG_PATH="$ROOT_DIR/$WORKFLOW_CONFIG_PATH"
  fi
fi

python3 -m uvicorn api:app --app-dir "$APP_DIR" --host "$HOST" --port "$PORT"
