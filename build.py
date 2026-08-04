#!/usr/bin/env python3

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def _candidate_required_files() -> list[str]:
    if sys.platform.startswith("win"):
        return [
            "Library/bin/pdfinfo.exe",
            "Library/bin/pdftoppm.exe",
        ]

    return [
        "Library/bin/pdfinfo",
        "Library/bin/pdftoppm",
    ]


def _copy_poppler_bundle(root: Path, candidates: list[str]) -> bool:
    required_files = _candidate_required_files()
    destination = root / "poppler"

    for relative_candidate in candidates:
        source = (root / relative_candidate).resolve()
        if not source.exists():
            continue

        if not all((source / required).exists() for required in required_files):
            continue

        if destination.exists():
            shutil.rmtree(destination)

        shutil.copytree(source, destination)
        print(f"Copied bundled Poppler from {source} to {destination}")
        return True

    print("No bundled Poppler copy found; skipping poppler packaging.")
    return False


def _npm_command() -> list[str]:
    candidates = ["npm.cmd", "npm"] if sys.platform.startswith("win") else ["npm"]
    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return [resolved]

    raise SystemExit("Unable to find npm on PATH.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the Workflow frontend and package optional runtime assets.")
    parser.add_argument("--frontend-dir", default="Frontend")
    parser.add_argument(
        "--poppler-source",
        action="append",
        default=["tools/poppler", "third_party/poppler", "vendor/poppler"],
        help="Relative paths to bundled Poppler directories to search.",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    frontend_dir = (root / args.frontend_dir).resolve()
    if not frontend_dir.exists():
        raise SystemExit(f"Frontend directory does not exist: {frontend_dir}")

    print("Building frontend...")
    subprocess.run([*_npm_command(), "run", "build"], cwd=frontend_dir, check=True)
    _copy_poppler_bundle(root, args.poppler_source)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
