from db import get_conn


SOURCE_TABLE_COLUMNS = {
    "Lockbox": [
        ("batchnum", "TEXT"),
        ("transnum", "TEXT"),
        ("timestamp", "TEXT"),
        ("matchstatus", "TEXT"),
    ],
    "EDI": [
        ("batchnum", "TEXT"),
        ("transnum", "TEXT"),
        ("timestamp", "TEXT"),
        ("matchstatus", "TEXT"),
    ],
    "EFT": [
        ("batchnum", "TEXT"),
        ("transnum", "TEXT"),
        ("timestamp", "TEXT"),
        ("matchstatus", "TEXT"),
    ],
}

SOURCE_TABLE_MIRRORS = {
    "EDI": ["EDILoad", "EDIStage", "EDIVett"],
    "Lockbox": ["LockboxLoad", "LockboxStage", "LockboxVett"],
    "EFT": ["EFTLoad", "EFTStage", "EFTVett"],
}


def _quote_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def ensure_source_table_columns(conn=None):
    close_conn = False
    if conn is None:
        conn = get_conn()
        close_conn = True

    cur = conn.cursor()

    for table_name, columns in SOURCE_TABLE_COLUMNS.items():
        existing_columns = {
            row[1].lower()
            for row in cur.execute(f"PRAGMA table_info({_quote_identifier(table_name)})").fetchall()
        }

        if not existing_columns:
            continue

        for column_name, column_type in columns:
            if column_name.lower() in existing_columns:
                continue
            cur.execute(
                f"ALTER TABLE {_quote_identifier(table_name)} "
                f"ADD COLUMN {_quote_identifier(column_name)} {column_type}"
            )

    conn.commit()

    if close_conn:
        conn.close()


def _fetch_table_columns(conn, table_name: str):
    cur = conn.cursor()
    rows = cur.execute(f"PRAGMA table_info({_quote_identifier(table_name)})").fetchall()
    return rows


def _ensure_table_schema_like_source(conn, source_table: str, target_table: str):
    cur = conn.cursor()
    source_columns = _fetch_table_columns(conn, source_table)
    if not source_columns:
        return

    target_columns = {
        row[1].lower()
        for row in _fetch_table_columns(conn, target_table)
    }

    if not target_columns:
        column_defs = []
        for cid, name, col_type, notnull, default_value, pk in source_columns:
            column_def = f"{_quote_identifier(name)} {col_type or 'TEXT'}"
            if pk:
                column_def += " PRIMARY KEY"
            column_defs.append(column_def)

        cur.execute(
            f"CREATE TABLE IF NOT EXISTS {_quote_identifier(target_table)} ("
            + ", ".join(column_defs)
            + ")"
        )
        target_columns = {
            row[1].lower()
            for row in _fetch_table_columns(conn, target_table)
        }

    for _, name, col_type, notnull, default_value, pk in source_columns:
        if name.lower() in target_columns:
            continue
        cur.execute(
            f"ALTER TABLE {_quote_identifier(target_table)} "
            f"ADD COLUMN {_quote_identifier(name)} {col_type or 'TEXT'}"
        )


def refresh_source_table_mirrors(conn=None):
    close_conn = False
    if conn is None:
        conn = get_conn()
        close_conn = True

    cur = conn.cursor()

    for source_table, mirror_tables in SOURCE_TABLE_MIRRORS.items():
        if not _fetch_table_columns(conn, source_table):
            continue

        for mirror_table in mirror_tables:
            _ensure_table_schema_like_source(conn, source_table, mirror_table)
            cur.execute(f"DELETE FROM {_quote_identifier(mirror_table)}")
            cur.execute(
                f"INSERT INTO {_quote_identifier(mirror_table)} "
                f"SELECT * FROM {_quote_identifier(source_table)}"
            )

    conn.commit()

    if close_conn:
        conn.close()
