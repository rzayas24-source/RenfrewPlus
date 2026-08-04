#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8001}"
APP_DIR="${APP_DIR:-Script}"
CONFIG_PATH="${WORKFLOW_CONFIG_PATH:-}"
PYTHON_BIN="${PYTHON:-python3}"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

if [[ -n "$CONFIG_PATH" ]]; then
  "$PYTHON_BIN" Start-WorkflowBackend.py --host "$HOST" --port "$PORT" --app-dir "$APP_DIR" --config-path "$CONFIG_PATH"
else
  "$PYTHON_BIN" Start-WorkflowBackend.py --host "$HOST" --port "$PORT" --app-dir "$APP_DIR"
fi
