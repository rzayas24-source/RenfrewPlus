#!/usr/bin/env python3

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def _resolve_config_path(root: Path, config_path: str) -> str | None:
    value = config_path.strip()
    if not value:
        return None

    candidate = Path(value).expanduser()
    if not candidate.is_absolute():
        candidate = (root / candidate).resolve()
    return str(candidate)


def main() -> int:
    parser = argparse.ArgumentParser(description="Start the Workflow backend.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", default="8001")
    parser.add_argument("--app-dir", default="Script")
    parser.add_argument("--config-path", default="")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    os.chdir(root)

    resolved_config = _resolve_config_path(root, args.config_path)
    if resolved_config:
        os.environ["WORKFLOW_CONFIG_PATH"] = resolved_config

    command = [
        sys.executable,
        "-m",
        "uvicorn",
        "api:app",
        "--app-dir",
        args.app_dir,
        "--host",
        args.host,
        "--port",
        str(args.port),
    ]
    completed = subprocess.run(command, cwd=root)
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
