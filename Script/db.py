import os
import sqlite3
import sys
from pathlib import Path

from config_manager import load_config, resolve_path

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

config = load_config()
WORKFLOW_ROOT = resolve_path(config, "workflow_root", Path(BASE_DIR).parent, relative_to=Path(BASE_DIR))
DB_PATH = resolve_path(config, "db_path", Path(WORKFLOW_ROOT) / "database.db", relative_to=Path(WORKFLOW_ROOT))


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn
