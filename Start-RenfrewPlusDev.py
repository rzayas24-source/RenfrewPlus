#!/usr/bin/env python3

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path


def _resolve_config_path(root: Path, config_path: str) -> str | None:
    value = config_path.strip()
    if not value:
        return None

    candidate = Path(value).expanduser()
    if not candidate.is_absolute():
        candidate = (root / candidate).resolve()
    return str(candidate)


def _npm_command() -> list[str]:
    candidates = ["npm.cmd", "npm"] if sys.platform.startswith("win") else ["npm"]
    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return [resolved]
    raise SystemExit("Unable to find npm on PATH.")


def _launch_backend(root: Path, host: str, port: int, app_dir: str, config_path: str) -> subprocess.Popen[str]:
    command = [
        sys.executable,
        "Start-WorkflowBackend.py",
        "--host",
        host,
        "--port",
        str(port),
        "--app-dir",
        app_dir,
    ]
    if config_path.strip():
        command.extend(["--config-path", config_path])

    return subprocess.Popen(command, cwd=root)


def _launch_frontend(root: Path, frontend_dir: str, host: str, port: int, backend_url: str) -> subprocess.Popen[str]:
    env = os.environ.copy()
    env["VITE_DEV_HOST"] = host
    env["VITE_DEV_PORT"] = str(port)
    env["VITE_DEV_PROXY_TARGET"] = backend_url

    command = [*_npm_command(), "run", "dev", "--", "--host", host, "--port", str(port)]
    return subprocess.Popen(command, cwd=(root / frontend_dir).resolve(), env=env)


def main() -> int:
    parser = argparse.ArgumentParser(description="Start the RenfrewPlus frontend and backend dev servers.")
    parser.add_argument("--backend-host", default="127.0.0.1")
    parser.add_argument("--backend-port", type=int, default=8001)
    parser.add_argument("--frontend-host", default="127.0.0.1")
    parser.add_argument("--frontend-port", type=int, default=5174)
    parser.add_argument("--app-dir", default="Script")
    parser.add_argument("--frontend-dir", default="Frontend")
    parser.add_argument("--config-path", default="")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    os.chdir(root)

    resolved_config = _resolve_config_path(root, args.config_path)
    frontend_root = (root / args.frontend_dir).resolve()
    backend_root = (root / args.app_dir).resolve()
    if not frontend_root.exists():
        raise SystemExit(f"Frontend directory does not exist: {frontend_root}")
    if not backend_root.exists():
        raise SystemExit(f"Backend app directory does not exist: {backend_root}")

    backend = _launch_backend(root, args.backend_host, args.backend_port, args.app_dir, resolved_config or "")
    try:
        frontend = _launch_frontend(
            root,
            args.frontend_dir,
            args.frontend_host,
            args.frontend_port,
            f"http://{args.backend_host}:{args.backend_port}",
        )
    except Exception:
        if backend.poll() is None:
            backend.terminate()
            try:
                backend.wait(timeout=10)
            except subprocess.TimeoutExpired:
                backend.kill()
        raise

    print(f"Backend:  http://{args.backend_host}:{args.backend_port}")
    print(f"Frontend: http://{args.frontend_host}:{args.frontend_port}")
    print("Press Ctrl+C to stop both servers.")

    try:
        while True:
            backend_rc = backend.poll()
            frontend_rc = frontend.poll()
            if backend_rc is not None:
                print(f"Backend exited with code {backend_rc}.")
                return backend_rc
            if frontend_rc is not None:
                print(f"Frontend exited with code {frontend_rc}.")
                return frontend_rc
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping servers...")
    finally:
        for proc in (frontend, backend):
            if proc.poll() is None:
                proc.terminate()
        deadline = time.time() + 10
        while time.time() < deadline:
            if all(proc.poll() is not None for proc in (frontend, backend)):
                break
            time.sleep(0.2)
        for proc in (frontend, backend):
            if proc.poll() is None:
                proc.kill()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
