from db import get_conn


EFT_LOAD_WORKBOOK_COLUMNS = [
    ("As-Of Date", "TEXT"),
    ("As-Of-Time", "TEXT"),
    ("Bank ID", "TEXT"),
    ("Bank Name", "TEXT"),
    ("State", "TEXT"),
    ("Acct No", "TEXT"),
    ("Acct Type", "TEXT"),
    ("Acct Name", "TEXT"),
    ("Currency", "TEXT"),
    ("IBAN", "TEXT"),
    ("BAI Type Code", "TEXT"),
    ("Tran Desc", "TEXT"),
    ("Debit Amt", "TEXT"),
    ("Credit Amt", "TEXT"),
    ("0 Day Flt Amt", "TEXT"),
    ("1 Day Flt Amt", "TEXT"),
    ("2+ Day Flt Amt", "TEXT"),
    ("Customer Ref No", "TEXT"),
    ("Value Date", "TEXT"),
    ("Location", "TEXT"),
    ("Bank Reference", "TEXT"),
    ("Tran Status", "TEXT"),
    ("Descriptive Text 1", "TEXT"),
    ("Descriptive Text 2", "TEXT"),
    ("Descriptive Text 3", "TEXT"),
    ("Descriptive Text 4", "TEXT"),
    ("Descriptive Text 5", "TEXT"),
    ("Descriptive Text 6", "TEXT"),
    ("Descriptive Text 7", "TEXT"),
    ("Descriptive Text 8", "TEXT"),
    ("Descriptive Text 9", "TEXT"),
    ("Descriptive Text 10", "TEXT"),
    ("Descriptive Text 11", "TEXT"),
    ("Descriptive Text 12", "TEXT"),
    ("Descriptive Text 13", "TEXT"),
    ("Descriptive Text 14", "TEXT"),
    ("Descriptive Text 15", "TEXT"),
    ("Descriptive Text 16", "TEXT"),
    ("Descriptive Text 17", "TEXT"),
    ("Descriptive Text 18", "TEXT"),
    ("Descriptive Text 19", "TEXT"),
    ("Descriptive Text 20", "TEXT"),
    ("Descriptive Text 21", "TEXT"),
    ("Descriptive Text 22", "TEXT"),
    ("Description", "TEXT"),
    ("Unique ID", "TEXT"),
    ("Discretionary Data", "TEXT"),
    ("UETR", "TEXT"),
    ("Payment Fee Deduction", "TEXT"),
    ("Beneficiary Final Wire Received Status", "TEXT"),
]


EFT_LOAD_COLUMNS = [
    ("batchnum", "TEXT"),
    ("transnum", "TEXT"),
    ("timestamp", "TEXT"),
    ("matchstatus", "TEXT"),
    *EFT_LOAD_WORKBOOK_COLUMNS,
]


EFT_CORE_COLUMNS = [
    ("Date", "TEXT"),
    ("Amount", "REAL"),
    ("CheckNumber", "TEXT"),
    ("Payer", "TEXT"),
    ("batchnum", "TEXT"),
    ("transnum", "TEXT"),
    ("timestamp", "TEXT"),
    ("matchstatus", "TEXT"),
]


EFT_STAGE_COLUMNS = [
    *EFT_CORE_COLUMNS,
    ("Descriptive Text 1", "TEXT"),
]


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
}


SOURCE_TABLE_MIRRORS = {
    "EDI": ["EDILoad", "EDIStage", "EDIVett"],
    "Lockbox": ["LockboxLoad", "LockboxStage", "LockboxVett"],
}


def _quote_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def _table_exists(cur, table_name: str) -> bool:
    return bool(
        cur.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND lower(name) = lower(?)",
            (table_name,),
        ).fetchone()
    )


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


def ensure_eftload_schema(conn=None, rebuild=False):
    close_conn = False
    if conn is None:
        conn = get_conn()
        close_conn = True

    cur = conn.cursor()
    table_name = "EFTLoad"

    if rebuild and _table_exists(cur, table_name):
        cur.execute(f"DROP TABLE IF EXISTS {_quote_identifier(table_name)}")

    existing_columns = {
        row[1].lower()
        for row in cur.execute(f"PRAGMA table_info({_quote_identifier(table_name)})").fetchall()
    }

    if not existing_columns:
        column_defs = ", ".join(
            f"{_quote_identifier(name)} {col_type or 'TEXT'}"
            for name, col_type in EFT_LOAD_COLUMNS
        )
        cur.execute(
            f"CREATE TABLE IF NOT EXISTS {_quote_identifier(table_name)} ({column_defs})"
        )
    else:
        for column_name, column_type in EFT_LOAD_COLUMNS:
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


def _column_names(columns):
    return [name for name, _ in columns]


def _create_table_exact(cur, table_name: str, columns):
    column_defs = ", ".join(
        f"{_quote_identifier(name)} {col_type or 'TEXT'}"
        for name, col_type in columns
    )
    cur.execute(
        f"CREATE TABLE IF NOT EXISTS {_quote_identifier(table_name)} ({column_defs})"
    )


def _rebuild_table_exact(conn, table_name: str, columns):
    cur = conn.cursor()
    desired_names = _column_names(columns)
    existing_rows = _fetch_table_columns(conn, table_name)
    existing_names = [row[1] for row in existing_rows]

    if existing_names == desired_names:
        return

    tmp_table = f"{table_name}__trimmed"
    cur.execute(f"DROP TABLE IF EXISTS {_quote_identifier(tmp_table)}")
    _create_table_exact(cur, tmp_table, columns)

    if existing_rows:
        copy_columns = [name for name in desired_names if name in existing_names]
        if copy_columns:
            quoted_columns = ", ".join(_quote_identifier(name) for name in copy_columns)
            cur.execute(
                f"INSERT INTO {_quote_identifier(tmp_table)} ({quoted_columns}) "
                f"SELECT {quoted_columns} FROM {_quote_identifier(table_name)}"
            )

        cur.execute(f"DROP TABLE {_quote_identifier(table_name)}")
    cur.execute(f"ALTER TABLE {_quote_identifier(tmp_table)} RENAME TO {_quote_identifier(table_name)}")


def ensure_eft_tables(conn=None):
    close_conn = False
    if conn is None:
        conn = get_conn()
        close_conn = True

    cur = conn.cursor()
    _create_table_exact(cur, "EFT", EFT_CORE_COLUMNS)
    _create_table_exact(cur, "EFTStage", EFT_STAGE_COLUMNS)
    _create_table_exact(cur, "EFTVett", EFT_CORE_COLUMNS)
    conn.commit()

    _rebuild_table_exact(conn, "EFT", EFT_CORE_COLUMNS)
    _rebuild_table_exact(conn, "EFTStage", EFT_STAGE_COLUMNS)
    _rebuild_table_exact(conn, "EFTVett", EFT_CORE_COLUMNS)
    conn.commit()

    if close_conn:
        conn.close()


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
