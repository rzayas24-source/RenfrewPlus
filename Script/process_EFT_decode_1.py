#!/usr/bin/env python3

import os
import sys

import pandas as pd

WORKFLOW_ROOT = r"C:\Renfrew\Workflow"
OUTPUT_FILE = os.path.join(WORKFLOW_ROOT, "output1.csv")
EXPECTED_PREFIX = "dep_1101_tran"


def process_dep_file(path: str) -> None:
    filename = os.path.basename(path)
    if not filename.lower().startswith(EXPECTED_PREFIX):
        raise SystemExit("Please choose exactly one DEP_1101_TRAN file.")

    print(f"Processing selected file: {filename}")

    if filename.lower().endswith((".xlsx", ".xls")):
        df = pd.read_excel(path, dtype=str)
    else:
        df = pd.read_csv(path, dtype=str)

    if df.shape[1] <= 22:
        raise SystemExit(f"File {filename} does not have 23 columns.")

    col22 = df.columns[22]
    filtered = df[df[col22].astype(str).str.contains(r"TRN\*1\*", na=False)]
    filtered.to_csv(OUTPUT_FILE, index=False)
    print(f"Saved filtered results to {OUTPUT_FILE}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python process_EFT_decode_1.py <path-to-selected-DEP_1101_TRAN-file>")

    process_dep_file(sys.argv[1])
