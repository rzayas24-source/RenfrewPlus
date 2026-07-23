import os
import shutil
import sqlite3
import re
import zipfile
from io import BytesIO
from datetime import datetime
from collections import defaultdict
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from system_calendar_core import (
    add_days,
    advance_current_work_day,
    build_from,
    delete_days,
    get_current_bank_day,
    get_current_work_day,
    init_db,
    normalize_mmddyyyy,
    set_current_work_day,
    setup,
)
from source_table_schema import ensure_eft_tables, ensure_eftload_schema, ensure_source_table_columns, refresh_source_table_mirrors
from system_source_match_core import build_match_dashboard, build_match_history, commit_all_strong_matches, commit_match, ensure_match_indexes, get_match_detail, normalize_checknum
from system_banking_core import build_banking_spreadsheet
import pandas as pd

DB_PATH = r"C:\Renfrew\Workflow\database.db"
WORKFLOW_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ZIP_835_TRN_FOLDER = os.path.join(WORKFLOW_ROOT, "1.TRN")
ZIP_835_ERA_FOLDER = os.path.join(WORKFLOW_ROOT, "2.ERA")
ZIP_835_HTML_FOLDER = os.path.join(WORKFLOW_ROOT, "3.HTML")
ZIP_835_TRN_ARCHIVE_FOLDER = os.path.join(ZIP_835_TRN_FOLDER, "Loaded")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _ensure_source_table_columns_on_startup():
    conn = get_conn()
    try:
        ensure_source_table_columns(conn)
        ensure_eft_tables(conn)
        ensure_match_indexes(conn)
        ensure_balsheet_notes_table(conn)
        ensure_tasks_table(conn)
        normalize_tasks_table_categories(conn)
        refresh_source_table_mirrors(conn)
    finally:
        conn.close()

def get_conn():
    return sqlite3.connect(DB_PATH)


def _quote_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


BALSHEET_TABLE_COLUMNS = [
    ("EntryID", "TEXT PRIMARY KEY"),
    ("PostingDate", "TEXT"),
    ("Type", "TEXT"),
    ("Amount", "REAL"),
    ("Payer", "TEXT"),
    ("Check Number", "TEXT"),
    ("EDI", "TEXT"),
    ("Poster", "TEXT"),
    ("EOB", "TEXT"),
    ("UnPosted", "REAL"),
    ("Misc", "REAL"),
    ("Misc-Type", "TEXT"),
    ("Notes", "TEXT"),
    ("Nick", "REAL"),
    ("Raul", "REAL"),
    ("Needs", "TEXT"),
    ("From", "TEXT"),
    ("To", "TEXT"),
]


def ensure_balsheet_table(conn=None):
    close_conn = False
    if conn is None:
        conn = get_conn()
        close_conn = True

    cur = conn.cursor()
    column_defs = ", ".join(f'{_quote_identifier(name)} {definition}' for name, definition in BALSHEET_TABLE_COLUMNS)
    cur.execute(f'CREATE TABLE IF NOT EXISTS {_quote_identifier("Balsheet")} ({column_defs})')
    conn.commit()

    if close_conn:
        conn.close()


def ensure_balsheet_notes_table(conn=None):
    close_conn = False
    if conn is None:
        conn = get_conn()
        close_conn = True

    cur = conn.cursor()
    cur.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {_quote_identifier("Balsheet_notes")} (
            {_quote_identifier("post_date")} TEXT,
            {_quote_identifier("notes")} TEXT,
            {_quote_identifier("message")} TEXT
        )
        """
    )
    existing_columns = [row[1] for row in cur.execute(f'PRAGMA table_info({_quote_identifier("Balsheet_notes")})').fetchall()]
    if "pk" in {column.lower() for column in existing_columns}:
        cur.execute(
            f'ALTER TABLE {_quote_identifier("Balsheet_notes")} RENAME TO {_quote_identifier("Balsheet_notes_legacy")}'
        )
        cur.execute(
            f"""
            CREATE TABLE {_quote_identifier("Balsheet_notes")} (
                {_quote_identifier("post_date")} TEXT,
                {_quote_identifier("notes")} TEXT,
                {_quote_identifier("message")} TEXT
            )
            """
        )
        cur.execute(
            f'INSERT INTO {_quote_identifier("Balsheet_notes")} ({_quote_identifier("post_date")}, {_quote_identifier("notes")}, {_quote_identifier("message")}) '
            f'SELECT {_quote_identifier("post_date")}, {_quote_identifier("notes")}, COALESCE({_quote_identifier("message")}, \'\') FROM {_quote_identifier("Balsheet_notes_legacy")}'
        )
        cur.execute(f'DROP TABLE {_quote_identifier("Balsheet_notes_legacy")}')
    elif "message" not in {column.lower() for column in existing_columns}:
        cur.execute(
            f'ALTER TABLE {_quote_identifier("Balsheet_notes")} ADD COLUMN {_quote_identifier("message")} TEXT'
        )
    conn.commit()

    if close_conn:
        conn.close()


TASK_TABLE_COLUMNS = [
    ("task_id", "TEXT PRIMARY KEY"),
    ("task_list", "TEXT NOT NULL"),
    ("title", "TEXT NOT NULL"),
    ("details", "TEXT NOT NULL DEFAULT ''"),
    ("category", "TEXT NOT NULL DEFAULT ''"),
    ("recurrence", "TEXT NOT NULL DEFAULT 'none'"),
    ("action_type", "TEXT NOT NULL DEFAULT 'none'"),
    ("action_label", "TEXT NOT NULL DEFAULT ''"),
    ("action_value", "TEXT NOT NULL DEFAULT ''"),
    ("done", "INTEGER NOT NULL DEFAULT 0"),
    ("sort_order", "INTEGER NOT NULL DEFAULT 0"),
    ("next_due_at", "TEXT"),
    ("completed_at", "TEXT"),
    ("created_at", "TEXT NOT NULL"),
    ("updated_at", "TEXT NOT NULL"),
]

WORKLIST_TASK_CATEGORY = "worklist"
NORMAL_TASK_CATEGORY = "task"


def ensure_tasks_table(conn=None):
    close_conn = False
    if conn is None:
        conn = get_conn()
        close_conn = True

    cur = conn.cursor()
    column_defs = ", ".join(f'{_quote_identifier(name)} {definition}' for name, definition in TASK_TABLE_COLUMNS)
    cur.execute(f'CREATE TABLE IF NOT EXISTS {_quote_identifier("tasks")} ({column_defs})')
    cur.execute(f'CREATE INDEX IF NOT EXISTS idx_tasks_list_order ON {_quote_identifier("tasks")} ({_quote_identifier("task_list")}, {_quote_identifier("sort_order")}, {_quote_identifier("title")})')
    conn.commit()

    if close_conn:
        conn.close()


def normalize_tasks_table_categories(conn=None):
    close_conn = False
    if conn is None:
        conn = get_conn()
        close_conn = True

    cur = conn.cursor()
    cur.execute(
        f"""
        UPDATE {_quote_identifier("tasks")}
        SET {_quote_identifier("category")} = CASE
            WHEN LOWER({_quote_identifier("task_list")}) = 'template' THEN ?
            ELSE ?
        END
        WHERE {_quote_identifier("task_list")} IN ('template', 'live')
        """,
        (WORKLIST_TASK_CATEGORY, NORMAL_TASK_CATEGORY),
    )
    conn.commit()

    if close_conn:
        conn.close()


def _balsheet_order_clause() -> str:
    entry_id = _quote_identifier("EntryID")
    posting_date = _quote_identifier("PostingDate")
    return (
        f"ORDER BY {posting_date} ASC, "
        f"CASE WHEN instr({entry_id}, '-') > 0 THEN CAST(substr({entry_id}, instr({entry_id}, '-') + 1) AS INTEGER) ELSE 0 END ASC, "
        f"{entry_id} ASC"
    )


def _normalize_balsheet_amount(value):
    try:
        return float(str(value).replace("$", "").replace(",", "").strip() or 0)
    except Exception:
        return 0.0


def _generate_balsheet_entry_id() -> str:
    return f"BS-{datetime.now().strftime('%m%d%Y-%H%M%S%f')}"


def _balsheet_row_to_payload(row):
    return {
        "entry_id": row["EntryID"],
        "posting_date": normalize_mmddyyyy(row["PostingDate"]) or str(row["PostingDate"] or ""),
        "type": str(row["Type"] or ""),
        "amount": row["Amount"],
        "payer": str(row["Payer"] or ""),
        "check_number": str(row["Check Number"] or ""),
        "edi": str(row["EDI"] or ""),
        "poster": str(row["Poster"] or ""),
        "eob": str(row["EOB"] or ""),
        "unposted": row["UnPosted"],
        "misc": row["Misc"],
        "misc_type": str(row["Misc-Type"] or ""),
        "notes": str(row["Notes"] or ""),
        "nick": row["Nick"],
        "raul": row["Raul"],
        "needs": str(row["Needs"] or ""),
        "from_date": str(row["From"] or ""),
        "to_date": str(row["To"] or ""),
    }


def _balsheet_note_row_to_payload(row):
    return {
        "rowid": row["rowid"],
        "post_date": normalize_mmddyyyy(row["post_date"]) or str(row["post_date"] or ""),
        "notes": str(row["notes"] or ""),
        "message": str(row["message"] or ""),
    }


def _normalize_balsheet_payload(entry: dict, entry_id: str | None = None):
    posting_date = normalize_mmddyyyy(entry.get("posting_date")) or ""
    if not posting_date:
        raise HTTPException(status_code=400, detail="posting_date is required")

    amount = _normalize_balsheet_amount(entry.get("amount"))
    unposted = _normalize_balsheet_amount(entry.get("unposted"))
    misc = _normalize_balsheet_amount(entry.get("misc"))
    poster = str(entry.get("poster") or "").strip()
    poster_key = poster.lower() or "nick"
    poster_amount = amount - unposted - misc
    nick = poster_amount if poster_key == "nick" else 0.0
    raul = poster_amount if poster_key == "raul" else 0.0

    return {
        "EntryID": entry_id or str(entry.get("entry_id") or "").strip() or _generate_balsheet_entry_id(),
        "PostingDate": posting_date,
        "Type": str(entry.get("type") or "").strip(),
        "Amount": amount,
        "Payer": str(entry.get("payer") or "").strip(),
        "Check Number": str(entry.get("check_number") or "").strip(),
        "EDI": str(entry.get("edi") or "").strip(),
        "Poster": poster,
        "EOB": str(entry.get("eob") or "").strip(),
        "UnPosted": unposted,
        "Misc": misc,
        "Misc-Type": str(entry.get("misc_type") or "").strip(),
        "Notes": str(entry.get("notes") or "").strip(),
        "Nick": nick,
        "Raul": raul,
        "Needs": str(entry.get("needs") or "").strip(),
        "From": str(entry.get("from_date") or "").strip(),
        "To": str(entry.get("to_date") or "").strip(),
    }


def _normalize_balsheet_note_payload(note: dict, rowid: int | None = None):
    post_date = normalize_mmddyyyy(note.get("post_date")) or ""
    if not post_date:
        raise HTTPException(status_code=400, detail="post_date is required")

    return {
        "rowid": rowid,
        "post_date": post_date,
        "notes": str(note.get("notes") or "").strip(),
        "message": str(note.get("message") or "").strip(),
    }


def _balsheet_insert_or_replace(conn, entry: dict):
    normalized = _normalize_balsheet_payload(entry)
    columns = [name for name, _ in BALSHEET_TABLE_COLUMNS]
    quoted_columns = ", ".join(_quote_identifier(name) for name in columns)
    placeholders = ", ".join(["?"] * len(columns))
    conn.execute(
        f'INSERT OR REPLACE INTO {_quote_identifier("Balsheet")} ({quoted_columns}) VALUES ({placeholders})',
        tuple(normalized[column] for column in columns),
    )
    return normalized["EntryID"]


def _list_user_tables(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    """)
    return [row[0] for row in cur.fetchall()]


def _table_exists(conn, table_name: str) -> bool:
    return table_name in _list_user_tables(conn)


def _parse_calendar_date(value):
    normalized = normalize_mmddyyyy(value)
    if not normalized:
        return None

    try:
        return datetime.strptime(normalized, "%m/%d/%Y")
    except ValueError:
        return None


def _parse_amount(value):
    try:
        if value in (None, ""):
            return 0.0
        return float(str(value).replace(",", "").strip())
    except Exception:
        return 0.0


def _normalize_yyyy_mm_dd_to_mmddyyyy(value):
    normalized = normalize_mmddyyyy(value)
    if normalized:
        return normalized

    try:
        parsed = pd.to_datetime(value, errors="coerce")
    except Exception:
        return ""

    if pd.isna(parsed):
        return ""

    return parsed.strftime("%m/%d/%Y")


def _parse_eft_descriptive_text_1(value):
    text = str(value or "").strip()
    if not text:
        return "", ""

    match = re.search(r"^(.*?)TRN\*1\*(.*)$", text, flags=re.IGNORECASE)
    if not match:
        return "", ""

    payer = match.group(1).strip()
    remainder = match.group(2).strip()
    check_number = remainder.split("*", 1)[0].strip()
    return payer, check_number


def _replace_table_from_dataframe(conn, table_name: str, df: pd.DataFrame):
    cur = conn.cursor()
    cur.execute(f"DELETE FROM {_quote_identifier(table_name)}")
    if df.empty:
        return 0

    columns = list(df.columns)
    quoted_columns = ", ".join(_quote_identifier(column) for column in columns)
    placeholders = ", ".join(["?"] * len(columns))
    insert_sql = f"INSERT INTO {_quote_identifier(table_name)} ({quoted_columns}) VALUES ({placeholders})"
    clean_df = df.where(pd.notna(df), None)
    cur.executemany(insert_sql, clean_df.itertuples(index=False, name=None))
    return int(len(clean_df))


def _append_table_from_dataframe(conn, table_name: str, df: pd.DataFrame):
    if df.empty:
        return 0

    cur = conn.cursor()
    columns = list(df.columns)
    quoted_columns = ", ".join(_quote_identifier(column) for column in columns)
    placeholders = ", ".join(["?"] * len(columns))
    insert_sql = f"INSERT INTO {_quote_identifier(table_name)} ({quoted_columns}) VALUES ({placeholders})"
    clean_df = df.where(pd.notna(df), None)
    cur.executemany(insert_sql, clean_df.itertuples(index=False, name=None))
    return int(len(clean_df))


def _normalize_task_payload(task: dict, task_id: str | None = None, sort_order: int | None = None):
    title = str(task.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")

    task_list = str(task.get("task_list") or "live").strip().lower() or "live"
    recurrence = str(task.get("recurrence") or "none").strip().lower()
    if recurrence not in {"none", "daily", "weekly", "monthly"}:
        recurrence = "none"

    action_type = str(task.get("action_type") or "none").strip().lower()
    if action_type not in {"none", "url", "copy", "copy_details"}:
        action_type = "none"

    now = datetime.now().isoformat(timespec="seconds")
    next_due_at = str(task.get("next_due_at") or "").strip() or None
    completed_at = str(task.get("completed_at") or "").strip() or None

    return {
        "task_id": str(task_id or task.get("task_id") or "").strip() or f"task-{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
        "task_list": task_list,
        "title": title,
        "details": str(task.get("details") or "").strip(),
        "category": WORKLIST_TASK_CATEGORY if task_list == "template" else NORMAL_TASK_CATEGORY,
        "recurrence": recurrence,
        "action_type": action_type,
        "action_label": str(task.get("action_label") or "").strip(),
        "action_value": str(task.get("action_value") or "").strip(),
        "done": 1 if bool(task.get("done")) else 0,
        "sort_order": int(sort_order if sort_order is not None else task.get("sort_order") or 0),
        "next_due_at": next_due_at,
        "completed_at": completed_at,
        "created_at": str(task.get("created_at") or now).strip(),
        "updated_at": str(task.get("updated_at") or now).strip(),
    }


def _task_row_to_payload(row):
    return {
        "id": str(row["task_id"]),
        "task_list": str(row["task_list"] or ""),
        "title": str(row["title"] or ""),
        "details": str(row["details"] or ""),
        "category": str(row["category"] or ""),
        "recurrence": str(row["recurrence"] or "none"),
        "action_type": str(row["action_type"] or "none"),
        "action_label": str(row["action_label"] or ""),
        "action_value": str(row["action_value"] or ""),
        "done": bool(row["done"]),
        "sort_order": int(row["sort_order"] or 0),
        "next_due_at": str(row["next_due_at"] or "") or None,
        "completed_at": str(row["completed_at"] or "") or None,
        "created_at": str(row["created_at"] or ""),
        "updated_at": str(row["updated_at"] or ""),
    }


def _normalize_eft_key_columns(df: pd.DataFrame, key_columns: list[str]) -> pd.DataFrame:
    normalized = df.loc[:, key_columns].copy()
    for column in key_columns:
        if column == "Amount":
            normalized[column] = pd.to_numeric(normalized[column], errors="coerce").round(2)
        else:
            normalized[column] = normalized[column].fillna("").astype(str).str.strip()
    return normalized


def _all_rows_already_exist(conn, table_name: str, df: pd.DataFrame, key_columns: list[str]) -> bool:
    if df.empty:
        return False

    select_columns = ", ".join(_quote_identifier(column) for column in key_columns)
    existing_df = pd.read_sql_query(
        f"SELECT {select_columns} FROM {_quote_identifier(table_name)}",
        conn,
    )
    if existing_df.empty:
        return False

    candidate_df = _normalize_eft_key_columns(df, key_columns)
    existing_keys = _normalize_eft_key_columns(existing_df, key_columns).drop_duplicates()
    merged = candidate_df.merge(existing_keys, on=key_columns, how="left", indicator=True)
    return bool(len(merged) > 0 and (merged["_merge"] == "both").all())


def _all_rows_already_exist_as_text(conn, table_name: str, df: pd.DataFrame, key_columns: list[str]) -> bool:
    if df.empty:
        return False

    select_columns = ", ".join(_quote_identifier(column) for column in key_columns)
    existing_df = pd.read_sql_query(
        f"SELECT {select_columns} FROM {_quote_identifier(table_name)}",
        conn,
    )
    if existing_df.empty:
        return False

    candidate_df = df.loc[:, key_columns].copy()
    existing_df = existing_df.loc[:, key_columns].copy()

    for column in key_columns:
        candidate_df[column] = candidate_df[column].fillna("").astype(str).str.strip()
        existing_df[column] = existing_df[column].fillna("").astype(str).str.strip()

    merged = candidate_df.merge(existing_df.drop_duplicates(), on=key_columns, how="left", indicator=True)
    return bool(len(merged) > 0 and (merged["_merge"] == "both").all())


def _load_calendar_rows(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT bank_day, weekday, is_closed, closure_reason, paperwork_day
        FROM calendar
    """)

    rows = []
    for bank_day, weekday, is_closed, closure_reason, paperwork_day in cur.fetchall():
        rows.append({
            "bankDay": normalize_mmddyyyy(bank_day) or bank_day,
            "weekday": weekday,
            "isClosed": bool(is_closed),
            "closureReason": closure_reason or "",
            "paperworkDay": normalize_mmddyyyy(paperwork_day) or paperwork_day,
            "_bankSort": _parse_calendar_date(bank_day),
            "_paperSort": _parse_calendar_date(paperwork_day),
        })

    rows.sort(key=lambda row: row["_bankSort"] or datetime.max)
    return rows


def _load_task_rows(conn, task_list: str = "live"):
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        f"""
        SELECT *
        FROM {_quote_identifier("tasks")}
        WHERE {_quote_identifier("task_list")} = ?
        ORDER BY {_quote_identifier("sort_order")} ASC, {_quote_identifier("created_at")} ASC, {_quote_identifier("task_id")} ASC
        """,
        (task_list,),
    ).fetchall()
    return [_task_row_to_payload(row) for row in rows]


def _live_cashing_totals(conn):
    totals = defaultdict(lambda: {
        "lockboxTotal": 0.0,
        "lockboxCount": 0,
        "eftTotal": 0.0,
        "eftCount": 0,
    })

    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT [Transaction Total] AS amount,
                   [Deposit Date] AS deposit_date
            FROM Lockbox
        """)
        for amount, deposit_date in cur.fetchall():
            day = normalize_mmddyyyy(deposit_date)
            if not day:
                continue
            totals[day]["lockboxTotal"] += _parse_amount(amount)
            totals[day]["lockboxCount"] += 1
    except Exception:
        pass

    try:
        cur.execute("""
            SELECT Date AS as_of_date,
                   Amount AS amount
            FROM EFT
        """)
        for as_of_date, amount in cur.fetchall():
            day = normalize_mmddyyyy(as_of_date)
            if not day:
                continue
            totals[day]["eftTotal"] += _parse_amount(amount)
            totals[day]["eftCount"] += 1
    except Exception:
        pass

    return totals


def _calendar_status_payload():
    conn = get_conn()
    init_db()

    current_work_day = get_current_work_day()
    current_bank_day = get_current_bank_day()
    today = datetime.today().strftime("%m/%d/%Y")
    rows = _load_calendar_rows(conn)

    total_days = len(rows)
    open_days = sum(1 for row in rows if not row["isClosed"])
    closed_days = total_days - open_days

    today_bank_day = None
    for row in rows:
        if row["paperworkDay"] == today:
            today_bank_day = row["bankDay"]
            break

    current_sort = _parse_calendar_date(current_work_day) if current_work_day else None
    next_open_work_day = None

    for row in rows:
        if current_sort and row["_paperSort"] and row["_paperSort"] > current_sort and not row["isClosed"]:
            next_open_work_day = row["paperworkDay"]
            break

    last_bank_day = rows[-1]["bankDay"] if rows else None

    conn.close()
    return {
        "today": today,
        "currentWorkDay": current_work_day,
        "currentBankDay": current_bank_day,
        "todayBankDay": today_bank_day,
        "nextOpenWorkDay": next_open_work_day,
        "lastBankDay": last_bank_day,
        "totalDays": total_days,
        "openDays": open_days,
        "closedDays": closed_days,
    }


def _calendar_range_payload(start_str, end_str):
    start_norm = normalize_mmddyyyy(start_str)
    end_norm = normalize_mmddyyyy(end_str)

    if not start_norm or not end_norm:
        raise HTTPException(status_code=400, detail="Start and end dates must be valid dates")

    start_dt = _parse_calendar_date(start_norm)
    end_dt = _parse_calendar_date(end_norm)

    if not start_dt or not end_dt:
        raise HTTPException(status_code=400, detail="Start and end dates must be valid dates")

    if start_dt > end_dt:
        start_dt, end_dt = end_dt, start_dt
        start_norm, end_norm = end_norm, start_norm

    conn = get_conn()
    init_db()

    calendar_rows = _load_calendar_rows(conn)
    totals = _live_cashing_totals(conn)
    current_work_day = get_current_work_day()

    rows = []
    for row in calendar_rows:
      bank_dt = row["_bankSort"]
      if not bank_dt or bank_dt < start_dt or bank_dt > end_dt:
          continue

      source = totals.get(row["bankDay"], {})
      lockbox_total = float(source.get("lockboxTotal", 0.0))
      eft_total = float(source.get("eftTotal", 0.0))
      rows.append({
          "bankDay": row["bankDay"],
          "weekday": row["weekday"],
          "isClosed": row["isClosed"],
          "closureReason": row["closureReason"],
          "paperworkDay": row["paperworkDay"],
          "isCurrentWorkDay": row["paperworkDay"] == current_work_day,
          "lockboxTotal": round(lockbox_total, 2),
          "lockboxCount": int(source.get("lockboxCount", 0)),
          "eftTotal": round(eft_total, 2),
          "eftCount": int(source.get("eftCount", 0)),
          "combinedTotal": round(lockbox_total + eft_total, 2),
      })

    conn.close()
    return {
        "start": start_norm,
        "end": end_norm,
        "currentWorkDay": current_work_day,
        "rows": rows,
    }


# ------------------------------------------------------------
# GET FIRST PENDING IMPORTED FILE
# ------------------------------------------------------------
@app.get("/attachments/pending")
def get_first_pending():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, filename, snapshot_path, review_status
        FROM imported_files
        WHERE review_status = 'Pending'
        ORDER BY id ASC
        LIMIT 1
    """)

    row = cur.fetchone()
    conn.close()

    if not row:
        return {"done": True}

    return {
        "id": row[0],
        "filename": row[1],
        "snapshot": row[2],
        "status": row[3],
        "done": False
    }


@app.get("/queue")
def get_queue():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, filename, snapshot_path, review_status
        FROM imported_files
        WHERE review_status = 'Pending'
        ORDER BY id ASC
    """)

    rows = cur.fetchall()
    conn.close()

    return [
        {
            "id": row[0],
            "filename": row[1],
            "snapshot": row[2],
            "status": row[3],
        }
        for row in rows
    ]


def _pending_day_label(value):
    if not value:
        return "Unknown"

    text = str(value).strip()
    if not text:
        return "Unknown"

    for fmt in ("%m/%d/%Y %H:%M:%S", "%m/%d/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(text[:19], fmt) if fmt.endswith("%H:%M:%S") and len(text) >= 19 else datetime.strptime(text[:10], fmt)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            pass

    if "T" in text:
        try:
            return datetime.fromisoformat(text.replace("Z", "")).strftime("%Y-%m-%d")
        except ValueError:
            pass

    return text[:10] if len(text) >= 10 else text


@app.get("/pending/by-day")
def get_pending_by_day():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, filename, processed_at
        FROM imported_files
        WHERE review_status = 'Pending'
        ORDER BY id ASC
    """)

    grouped = {}
    for row in cur.fetchall():
        day = _pending_day_label(row[2])
        grouped.setdefault(day, []).append({
            "id": row[0],
            "filename": row[1],
        })

    conn.close()
    return grouped


@app.get("/approved")
def get_approved():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, filename, site, detail, amount, processed_at
        FROM imported_files
        WHERE review_status = 'Approved'
        ORDER BY id DESC
    """)

    rows = cur.fetchall()
    conn.close()

    return [
        {
            "id": row[0],
            "filename": row[1],
            "site": row[2],
            "detail": row[3],
            "total": row[4] or 0,
            "date": row[5],
        }
        for row in rows
    ]


@app.get("/rejectlist")
def get_rejectlist():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, filename, review_notes, processed_at
        FROM imported_files
        WHERE review_status = 'Rejected'
        ORDER BY id DESC
    """)

    rows = cur.fetchall()
    conn.close()

    return [
        {
            "id": row[0],
            "filename": row[1],
            "reason": row[2],
            "date": row[3],
        }
        for row in rows
    ]


@app.get("/calendar/status")
def get_calendar_status():
    return _calendar_status_payload()


@app.get("/calendar/work-day/lookup")
def get_calendar_work_day_lookup(work_day: str):
    normalized = normalize_mmddyyyy(work_day)
    if not normalized:
        raise HTTPException(status_code=400, detail="work_day is required")

    conn = get_conn()
    init_db()
    row = conn.execute(
        "SELECT bank_day FROM calendar WHERE paperwork_day = ?",
        (normalized,),
    ).fetchone()
    conn.close()

    return {
        "workDay": normalized,
        "bankDay": row[0] if row else None,
    }


@app.get("/calendar/range")
def get_calendar_range(start: str, end: str):
    return _calendar_range_payload(start, end)


@app.post("/calendar/setup")
def post_calendar_setup(payload: dict):
    start_date = normalize_mmddyyyy(payload.get("start_date"))
    if not start_date:
        raise HTTPException(status_code=400, detail="start_date is required")

    setup(start_date)
    return _calendar_status_payload()


@app.post("/calendar/add")
def post_calendar_add(payload: dict):
    try:
        days = int(payload.get("days"))
    except Exception:
        raise HTTPException(status_code=400, detail="days is required")

    if days <= 0:
        raise HTTPException(status_code=400, detail="days must be greater than zero")

    add_days(days)
    return _calendar_status_payload()


@app.post("/calendar/build-from")
def post_calendar_build_from(payload: dict):
    start_date = normalize_mmddyyyy(payload.get("start_date"))
    if not start_date:
        raise HTTPException(status_code=400, detail="start_date is required")

    try:
        days = int(payload.get("days"))
    except Exception:
        raise HTTPException(status_code=400, detail="days is required")

    if days <= 0:
        raise HTTPException(status_code=400, detail="days must be greater than zero")

    build_from(start_date, days)
    return _calendar_status_payload()


@app.delete("/calendar/days")
def delete_calendar_days(from_date: str, to_date: str):
    start_date = normalize_mmddyyyy(from_date)
    end_date = normalize_mmddyyyy(to_date)
    if not start_date or not end_date:
        raise HTTPException(status_code=400, detail="from_date and to_date are required")

    delete_days(start_date, end_date)
    return _calendar_status_payload()


@app.post("/calendar/work-day/set")
def post_calendar_set_work_day(payload: dict):
    work_day = normalize_mmddyyyy(payload.get("work_day"))
    if not work_day:
        raise HTTPException(status_code=400, detail="work_day is required")

    set_current_work_day(work_day)
    return _calendar_status_payload()


@app.post("/calendar/work-day/advance")
def post_calendar_advance_work_day():
    advance_current_work_day()
    return _calendar_status_payload()


@app.get("/tasks")
def get_tasks(task_list: str = "live"):
    init_db()
    conn = get_conn()
    ensure_tasks_table(conn)

    try:
        return _load_task_rows(conn, task_list=task_list)
    finally:
        conn.close()


@app.post("/tasks")
def post_task(task: dict):
    init_db()
    conn = get_conn()
    ensure_tasks_table(conn)

    try:
        normalized = _normalize_task_payload(task)
        columns = [name for name, _ in TASK_TABLE_COLUMNS]
        quoted_columns = ", ".join(_quote_identifier(name) for name in columns)
        placeholders = ", ".join(["?"] * len(columns))
        conn.execute(
            f'INSERT INTO {_quote_identifier("tasks")} ({quoted_columns}) VALUES ({placeholders})',
            tuple(normalized[column] for column in columns),
        )
        conn.commit()
        row = conn.execute(
            f'SELECT * FROM {_quote_identifier("tasks")} WHERE {_quote_identifier("task_id")} = ?',
            (normalized["task_id"],),
        ).fetchone()
        return _task_row_to_payload(row)
    finally:
        conn.close()


@app.post("/tasks/bulk-replace")
def replace_tasks(payload: dict):
    init_db()
    conn = get_conn()
    ensure_tasks_table(conn)

    task_list = str(payload.get("task_list") or "live").strip() or "live"
    tasks = payload.get("tasks", [])
    if not isinstance(tasks, list):
        raise HTTPException(status_code=400, detail="tasks must be a list")

    try:
        conn.execute(
            f'DELETE FROM {_quote_identifier("tasks")} WHERE {_quote_identifier("task_list")} = ?',
            (task_list,),
        )
        normalized_rows = []
        for index, task in enumerate(tasks):
            if not isinstance(task, dict):
                continue
            normalized = _normalize_task_payload(task, sort_order=index)
            normalized["task_list"] = task_list
            normalized_rows.append(normalized)

        if normalized_rows:
            columns = [name for name, _ in TASK_TABLE_COLUMNS]
            quoted_columns = ", ".join(_quote_identifier(name) for name in columns)
            placeholders = ", ".join(["?"] * len(columns))
            conn.executemany(
                f'INSERT INTO {_quote_identifier("tasks")} ({quoted_columns}) VALUES ({placeholders})',
                [tuple(row[column] for column in columns) for row in normalized_rows],
            )
        conn.commit()
        return {"status": "ok", "task_list": task_list, "rows": len(normalized_rows)}
    finally:
        conn.close()


@app.post("/tasks/import-template")
def import_template_to_live(payload: dict | None = None):
    init_db()
    conn = get_conn()
    ensure_tasks_table(conn)
    conn.row_factory = sqlite3.Row

    payload = payload or {}
    source_list = str(payload.get("source_list") or "template").strip() or "template"
    target_list = str(payload.get("target_list") or "live").strip() or "live"

    try:
        rows = conn.execute(
            f"""
            SELECT *
            FROM {_quote_identifier("tasks")}
            WHERE {_quote_identifier("task_list")} = ?
            ORDER BY {_quote_identifier("sort_order")} ASC, {_quote_identifier("created_at")} ASC, {_quote_identifier("task_id")} ASC
            """,
            (source_list,),
        ).fetchall()
        conn.execute(
            f'DELETE FROM {_quote_identifier("tasks")} WHERE {_quote_identifier("task_list")} = ?',
            (target_list,),
        )
        copied_rows = []
        now = datetime.now().isoformat(timespec="seconds")
        for index, row in enumerate(rows):
            copied = _task_row_to_payload(row)
            copied["id"] = f'task-{datetime.now().strftime("%Y%m%d%H%M%S%f")}-{index}'
            copied["task_list"] = target_list
            copied["sort_order"] = index
            copied["created_at"] = now
            copied["updated_at"] = now
            copied_rows.append(_normalize_task_payload(copied, task_id=copied["id"], sort_order=index))

        if copied_rows:
            columns = [name for name, _ in TASK_TABLE_COLUMNS]
            quoted_columns = ", ".join(_quote_identifier(name) for name in columns)
            placeholders = ", ".join(["?"] * len(columns))
            conn.executemany(
                f'INSERT INTO {_quote_identifier("tasks")} ({quoted_columns}) VALUES ({placeholders})',
                [tuple(row[column] for column in columns) for row in copied_rows],
            )
        conn.commit()
        return {"status": "ok", "source_list": source_list, "target_list": target_list, "rows": len(copied_rows)}
    finally:
        conn.close()


@app.put("/tasks/{task_id}")
def put_task(task_id: str, task: dict):
    init_db()
    conn = get_conn()
    ensure_tasks_table(conn)

    try:
        conn.row_factory = sqlite3.Row
        existing = conn.execute(
            f'SELECT * FROM {_quote_identifier("tasks")} WHERE {_quote_identifier("task_id")} = ?',
            (task_id,),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Task not found")

        normalized = _normalize_task_payload(task, task_id=task_id)
        conn.execute(
            f"""
            UPDATE {_quote_identifier("tasks")}
            SET
                {_quote_identifier("task_list")} = ?,
                {_quote_identifier("title")} = ?,
                {_quote_identifier("details")} = ?,
                {_quote_identifier("category")} = ?,
                {_quote_identifier("recurrence")} = ?,
                {_quote_identifier("action_type")} = ?,
                {_quote_identifier("action_label")} = ?,
                {_quote_identifier("action_value")} = ?,
                {_quote_identifier("done")} = ?,
                {_quote_identifier("sort_order")} = ?,
                {_quote_identifier("next_due_at")} = ?,
                {_quote_identifier("completed_at")} = ?,
                {_quote_identifier("created_at")} = ?,
                {_quote_identifier("updated_at")} = ?
            WHERE {_quote_identifier("task_id")} = ?
            """,
            (
                normalized["task_list"],
                normalized["title"],
                normalized["details"],
                normalized["category"],
                normalized["recurrence"],
                normalized["action_type"],
                normalized["action_label"],
                normalized["action_value"],
                normalized["done"],
                normalized["sort_order"],
                normalized["next_due_at"],
                normalized["completed_at"],
                normalized["created_at"],
                normalized["updated_at"],
                task_id,
            ),
        )
        conn.commit()
        row = conn.execute(
            f'SELECT * FROM {_quote_identifier("tasks")} WHERE {_quote_identifier("task_id")} = ?',
            (task_id,),
        ).fetchone()
        return _task_row_to_payload(row)
    finally:
        conn.close()


@app.delete("/tasks/{task_id}")
def delete_task(task_id: str):
    init_db()
    conn = get_conn()
    ensure_tasks_table(conn)

    try:
        cur = conn.cursor()
        cur.execute(
            f'DELETE FROM {_quote_identifier("tasks")} WHERE {_quote_identifier("task_id")} = ?',
            (task_id,),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        conn.commit()
        return {"status": "ok", "task_id": task_id}
    finally:
        conn.close()


@app.get("/tasks/template")
def get_task_template():
    init_db()
    conn = get_conn()
    ensure_tasks_table(conn)

    try:
        return _load_task_rows(conn, task_list="template")
    finally:
        conn.close()


@app.get("/admin/tables")
def get_admin_tables():
    conn = get_conn()
    cur = conn.cursor()
    tables = []

    for table_name in _list_user_tables(conn):
        try:
            cur.execute(f"SELECT COUNT(*) FROM {_quote_identifier(table_name)}")
            row_count = int(cur.fetchone()[0] or 0)
        except Exception:
            row_count = 0

        try:
            cur.execute(f"PRAGMA table_info({_quote_identifier(table_name)})")
            columns = [
                {
                    "name": row[1],
                    "type": row[2],
                    "notNull": bool(row[3]),
                    "defaultValue": row[4],
                    "primaryKey": bool(row[5]),
                }
                for row in cur.fetchall()
            ]
        except Exception:
            columns = []

        tables.append({
            "name": table_name,
            "rowCount": row_count,
            "columnCount": len(columns),
            "columns": columns,
        })

    conn.close()
    return tables


@app.get("/admin/tables/{table_name}")
def get_admin_table_rows(table_name: str, limit: int = 250, offset: int = 0, sort_by: str = "rowid", sort_direction: str = "asc"):
    conn = get_conn()

    if not _table_exists(conn, table_name):
        conn.close()
        raise HTTPException(status_code=404, detail="Table not found")

    safe_limit = max(1, min(int(limit or 250), 250))
    safe_offset = max(0, int(offset or 0))
    cur = conn.cursor()

    cur.execute(f"PRAGMA table_info({_quote_identifier(table_name)})")
    columns = [
        {
            "name": row[1],
            "type": row[2],
            "notNull": bool(row[3]),
            "defaultValue": row[4],
            "primaryKey": bool(row[5]),
        }
        for row in cur.fetchall()
    ]

    column_lookup = {column["name"].lower(): column["name"] for column in columns}
    requested_sort = str(sort_by or "rowid").strip()
    requested_direction = str(sort_direction or "asc").strip().lower()
    if requested_direction not in ("asc", "desc"):
        raise HTTPException(status_code=400, detail="Invalid sort_direction")

    if requested_sort.lower() == "rowid":
        order_clause = f"rowid {requested_direction.upper()}"
    else:
        resolved_sort = column_lookup.get(requested_sort.lower())
        if not resolved_sort:
            raise HTTPException(status_code=400, detail="Invalid sort_by")
        order_clause = f"{_quote_identifier(resolved_sort)} {requested_direction.upper()}"

    cur.execute(
        f"SELECT rowid, * FROM {_quote_identifier(table_name)} ORDER BY {order_clause} LIMIT ? OFFSET ?",
        (safe_limit, safe_offset),
    )
    rows = cur.fetchall()
    headers = [description[0] for description in cur.description]

    payload_rows = [dict(zip(headers, row)) for row in rows]

    cur.execute(f"SELECT COUNT(*) FROM {_quote_identifier(table_name)}")
    total_rows = int(cur.fetchone()[0] or 0)

    conn.close()
    return {
        "name": table_name,
        "rowCount": total_rows,
        "columns": columns,
        "rows": payload_rows,
    }


# ------------------------------------------------------------
# SOURCE-DRIVEN 835 MATCH
# ------------------------------------------------------------
@app.get("/match/worklist")
def get_match_worklist(limit: int = 50, revision: str | None = None):
    return build_match_dashboard(limit=limit, revision=revision)


@app.get("/match/matches")
def get_match_history_view(limit: int = 100):
    return build_match_history(limit=limit)


@app.get("/match/{edi_id}")
def get_match_detail_view(edi_id: int):
    detail = get_match_detail(edi_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="EDI row not found")
    return detail


@app.post("/match/commit")
def post_match_commit(payload: dict):
    edi_id = payload.get("edi_id")
    if edi_id in (None, ""):
        raise HTTPException(status_code=400, detail="edi_id is required")

    try:
        result = commit_match(
            edi_id,
            eft_ids=payload.get("eft_ids") or [],
            lockbox_ids=payload.get("lockbox_ids") or [],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return result


@app.post("/match/commit-strong-hits")
def post_match_commit_strong_hits():
    return commit_all_strong_matches()


# ------------------------------------------------------------
# 835 ZIP EXTRACTION
# ------------------------------------------------------------
def _route_835_zip_member(member_name: str) -> tuple[str, str] | tuple[None, None]:
    base_name = os.path.basename(member_name or "").strip()
    lower_name = base_name.lower()

    if lower_name.endswith(".trn"):
        return ZIP_835_TRN_FOLDER, base_name
    if lower_name.endswith((".html", ".htm")):
        return ZIP_835_HTML_FOLDER, base_name
    if lower_name.endswith(".era"):
        return ZIP_835_ERA_FOLDER, base_name

    return None, None


def _ensure_ediload_table(conn):
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS EDILoad (
            id INTEGER PRIMARY KEY,
            check_date TEXT,
            check_number TEXT,
            check_amount REAL,
            filename TEXT,
            batchnum TEXT,
            transnum TEXT,
            timestamp TEXT,
            matchstatus TEXT
        )
        """
    )
    conn.commit()


def _parse_835_trn_file(path: str):
    rows = []
    with open(path, "r", encoding="utf-8") as handle:
        lines = [line.strip() for line in handle if line.strip()]

    if len(lines) < 3:
        return rows

    for line in lines[2:]:
        parts = line.split()
        if len(parts) < 3:
            continue

        check_date = normalize_mmddyyyy(parts[0])
        check_number = str(parts[1]).strip()
        try:
            check_amount = float(str(parts[2]).replace(",", "").strip())
        except Exception:
            continue

        if not check_date or not check_number:
            continue

        rows.append((check_date, check_number, check_amount))

    return rows


@app.post("/835/upload-stage")
async def post_835_upload_stage(file: UploadFile = File(...)):
    filename = file.filename or ""
    if not filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please choose a zip file")

    try:
        file_bytes = await file.read()
        extracted_counts = {"trn": 0, "era": 0, "html": 0}
        blocked_count = 0

        with zipfile.ZipFile(BytesIO(file_bytes)) as archive:
            for member in archive.infolist():
                if member.is_dir():
                    continue

                target_folder, target_name = _route_835_zip_member(member.filename)
                if not target_folder or not target_name:
                    continue

                os.makedirs(target_folder, exist_ok=True)
                destination = os.path.join(target_folder, target_name)
                if os.path.exists(destination):
                    blocked_count += 1
                    continue

                with archive.open(member, "r") as source, open(destination, "wb") as target:
                    shutil.copyfileobj(source, target)

                if target_name.lower().endswith(".trn"):
                    extracted_counts["trn"] += 1
                elif target_name.lower().endswith((".html", ".htm")):
                    extracted_counts["html"] += 1
                elif target_name.lower().endswith(".era"):
                    extracted_counts["era"] += 1

        rows_loaded = extracted_counts["trn"] + extracted_counts["era"] + extracted_counts["html"]
        return {
            "status": "success",
            "statusTag": "Loaded" if blocked_count == 0 else "Partial",
            "filename": filename,
            "rowsLoaded": rows_loaded,
            "blockedCount": blocked_count,
            "extractedCounts": extracted_counts,
            "destinations": {
                "trn": ZIP_835_TRN_FOLDER,
                "era": ZIP_835_ERA_FOLDER,
                "html": ZIP_835_HTML_FOLDER,
            },
        }
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Please choose a valid zip file")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process 835 zip file: {exc}")


@app.post("/835/load-trn-folder")
def post_835_load_trn_folder():
    if not os.path.exists(ZIP_835_TRN_FOLDER):
        raise HTTPException(status_code=404, detail="TRN folder does not exist")

    os.makedirs(ZIP_835_TRN_ARCHIVE_FOLDER, exist_ok=True)

    conn = get_conn()
    try:
        _ensure_ediload_table(conn)
        cur = conn.cursor()
        conn.execute("BEGIN IMMEDIATE")

        work_state = cur.execute("SELECT batchnum, transnum FROM work_state WHERE id = 1").fetchone()
        batchnum = str(work_state[0]).strip() if work_state and work_state[0] not in (None, "") else "1"
        try:
            next_trans = int(str(work_state[1]).strip() or "0") + 1 if work_state and work_state[1] not in (None, "") else 1
        except ValueError:
            next_trans = 1

        load_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        total_files = 0
        loaded_files = 0
        blocked_files = 0
        inserted_rows = 0
        blocked_rows = 0
        last_transnum = ""

        for filename in sorted(os.listdir(ZIP_835_TRN_FOLDER)):
            full_path = os.path.join(ZIP_835_TRN_FOLDER, filename)
            if not os.path.isfile(full_path):
                continue
            if filename.startswith("~$"):
                continue
            if not filename.lower().endswith((".trn", ".txt")):
                continue

            total_files += 1
            parsed_rows = _parse_835_trn_file(full_path)
            if not parsed_rows:
                blocked_files += 1
                continue

            new_rows = []
            duplicate_numbers = []
            for row in parsed_rows:
                check_date, check_number, check_amount = row
                exists = cur.execute(
                    "SELECT 1 FROM EDILoad WHERE check_number = ?",
                    (check_number,),
                ).fetchone()
                if exists:
                    duplicate_numbers.append(check_number)
                else:
                    new_rows.append(row)

            if not new_rows:
                blocked_files += 1
                blocked_rows += len(duplicate_numbers)
                continue

            file_frame = pd.DataFrame(
                [
                    {
                        "check_date": check_date,
                        "check_number": check_number,
                        "check_amount": check_amount,
                        "filename": filename,
                        "batchnum": batchnum,
                        "transnum": str(next_trans + index),
                        "timestamp": load_timestamp,
                        "matchstatus": "UNMATCHED",
                    }
                    for index, (check_date, check_number, check_amount) in enumerate(new_rows)
                ]
            )

            _append_table_from_dataframe(
                conn,
                "EDILoad",
                file_frame[
                    [
                        "check_date",
                        "check_number",
                        "check_amount",
                        "filename",
                        "batchnum",
                        "transnum",
                        "timestamp",
                        "matchstatus",
                    ]
                ],
            )

            inserted_rows += int(len(file_frame))
            last_transnum = str(next_trans + len(file_frame) - 1)
            next_trans += len(file_frame)

            archive_path = os.path.join(ZIP_835_TRN_ARCHIVE_FOLDER, filename)
            shutil.move(full_path, archive_path)
            loaded_files += 1

        if inserted_rows > 0:
            cur.execute(
                """
                UPDATE work_state
                SET transnum = ?,
                    timestamp = ?,
                    matchstatus = ?
                WHERE id = 1
                """,
                (last_transnum, load_timestamp, "LOADED"),
            )

        conn.commit()

        status_tag = "EDILOAD LOADED" if blocked_files == 0 else "EDILOAD PARTIAL"
        status = "loaded" if blocked_files == 0 else "partial"
        if inserted_rows == 0:
            status_tag = "EDILOAD BLOCKED"
            status = "blocked"

        return {
            "status": status,
            "statusTag": status_tag,
            "message": (
                f"Loaded {loaded_files} TRN file(s) into EDILoad."
                if inserted_rows > 0
                else "No TRN rows qualified for EDILoad."
            ),
            "table": "EDILoad",
            "rowsLoaded": inserted_rows,
            "filesLoaded": loaded_files,
            "filesBlocked": blocked_files,
            "blockedRows": blocked_rows,
            "timestamp": load_timestamp,
            "movedTo": ZIP_835_TRN_ARCHIVE_FOLDER,
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to load TRN files: {exc}")
    finally:
        conn.close()


@app.post("/835/stage-edi")
def post_835_stage_edi():
    conn = get_conn()
    try:
        ensure_source_table_columns(conn)
        cur = conn.cursor()
        conn.execute("BEGIN IMMEDIATE")

        load_df = pd.read_sql_query("SELECT * FROM EDILoad ORDER BY id ASC", conn)
        if load_df.empty:
            raise HTTPException(status_code=400, detail="EDILoad is empty. Load TRN files first.")

        work_state = cur.execute(
            "SELECT batchnum, transnum FROM work_state WHERE id = 1"
        ).fetchone()
        batchnum = str(work_state[0]).strip() if work_state and work_state[0] not in (None, "") else "1"
        try:
            next_trans = int(str(work_state[1]).strip() or "0") + 1 if work_state and work_state[1] not in (None, "") else 1
        except ValueError:
            next_trans = 1

        stage_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        staged_df = load_df.drop(columns=["id"], errors="ignore").copy()
        staged_df["batchnum"] = batchnum
        staged_df["transnum"] = [str(next_trans + index) for index in range(len(staged_df))]
        staged_df["timestamp"] = stage_timestamp
        if "matchstatus" in staged_df.columns:
            staged_df["matchstatus"] = "STAGED"

        _replace_table_from_dataframe(conn, "EDIStage", staged_df)
        conn.commit()

        end_trans = next_trans + len(staged_df) - 1
        cur.execute(
            """
            UPDATE work_state
            SET transnum = ?,
                timestamp = ?,
                matchstatus = ?
            WHERE id = 1
            """,
            (str(end_trans), stage_timestamp, "STAGED"),
        )
        conn.commit()

        return {
            "status": "staged",
            "statusTag": "EDI STAGED",
            "message": f"Copied {len(staged_df)} row(s) from EDILoad to EDIStage.",
            "table": "EDIStage",
            "rowsStaged": int(len(staged_df)),
            "batchnum": batchnum,
            "startTransnum": str(next_trans),
            "endTransnum": str(end_trans),
            "timestamp": stage_timestamp,
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to stage EDI data: {exc}")
    finally:
        conn.close()


@app.post("/835/vet-edi")
def post_835_vet_edi():
    conn = get_conn()
    try:
        ensure_source_table_columns(conn)
        cur = conn.cursor()
        conn.execute("BEGIN IMMEDIATE")

        stage_df = pd.read_sql_query("SELECT * FROM EDIStage ORDER BY id ASC", conn)
        if stage_df.empty:
            raise HTTPException(status_code=400, detail="EDIStage is empty. Run staging first.")

        edi_df = pd.read_sql_query('SELECT "check_number" FROM EDI', conn)
        edi_numbers = {
            str(value).strip()
            for value in edi_df.get("check_number", pd.Series(dtype=str)).fillna("").astype(str).tolist()
            if str(value).strip()
        }

        working_df = stage_df.drop(columns=["id"], errors="ignore").copy()
        working_df["check_number"] = working_df.get("check_number", pd.Series(dtype=str)).fillna("").astype(str).str.strip()
        working_df["check_date"] = working_df.get("check_date", pd.Series(dtype=str)).fillna("").astype(str).str.strip()
        working_df["check_amount"] = working_df.get("check_amount", pd.Series(dtype=str)).fillna("").astype(str).str.strip()

        duplicate_mask = [str(value).strip() in edi_numbers for value in working_df["check_number"].tolist()]
        load_df = working_df.loc[[not value for value in duplicate_mask]].copy()
        duplicate_df = working_df.loc[duplicate_mask].copy()

        load_df["matchstatus"] = "VETTED"
        duplicate_rows = [
            {
                "row": int(index) + 1,
                "checkNumber": str(row.get("check_number", "")).strip(),
                "date": str(row.get("check_date", "")).strip(),
                "amount": str(row.get("check_amount", "")).strip(),
                "status": "BLOCKED",
            }
            for index, row in duplicate_df.iterrows()
        ]

        _replace_table_from_dataframe(
            conn,
            "EDIVett",
            load_df[
                [
                    "check_date",
                    "check_number",
                    "check_amount",
                    "filename",
                    "batchnum",
                    "transnum",
                    "timestamp",
                    "matchstatus",
                ]
            ].rename(
                columns={
                    "check_date": "check_date",
                    "check_number": "check_number",
                    "check_amount": "check_amount",
                }
            ),
        )
        conn.commit()

        total_rows = int(len(working_df))
        duplicate_count = int(len(duplicate_df))
        loaded_count = int(len(load_df))
        all_duplicates = total_rows > 0 and loaded_count == 0
        status_tag = "VETTED" if duplicate_count == 0 else "PARTIAL VETTED"
        status = "vetted" if duplicate_count == 0 else "partial"
        if all_duplicates:
            status_tag = "BLOCKED"
            status = "blocked"

        last_transnum = ""
        if loaded_count > 0 and "transnum" in load_df.columns and not load_df["transnum"].empty:
            last_transnum = str(load_df["transnum"].iloc[-1]).strip()

        vet_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cur.execute(
            """
            UPDATE work_state
            SET transnum = COALESCE(NULLIF(?, ''), transnum),
                timestamp = ?,
                matchstatus = ?
            WHERE id = 1
            """,
            (last_transnum, vet_timestamp, status_tag),
        )
        conn.commit()

        message = (
            f"{loaded_count} row(s) loaded into EDIVett."
            if loaded_count > 0
            else "No rows qualified for EDIVett."
        )
        if duplicate_count > 0:
            message = f"{duplicate_count} duplicate row(s) were blocked."
            if loaded_count > 0:
                message += f" {loaded_count} clean row(s) loaded into EDIVett."

        return {
            "status": status,
            "statusTag": status_tag,
            "message": message,
            "table": "EDIVett",
            "rowsLoaded": loaded_count,
            "totalRows": total_rows,
            "duplicateCount": duplicate_count,
            "allDuplicates": all_duplicates,
            "duplicateRows": duplicate_rows,
            "timestamp": vet_timestamp,
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to vet EDI data: {exc}")
    finally:
        conn.close()


@app.post("/835/approval-stage")
async def post_835_approval_stage(request: Request):
    payload = await request.json() if request.headers.get("content-type", "").lower().startswith("application/json") else {}
    decision = str(payload.get("decision", "")).strip().lower()
    if decision not in ("approve", "deny"):
        raise HTTPException(status_code=400, detail="decision must be approve or deny")

    conn = get_conn()
    refresh_result = None
    refresh_warning = ""
    try:
        ensure_source_table_columns(conn)
        cur = conn.cursor()
        conn.execute("BEGIN IMMEDIATE")
        approval_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if decision == "deny":
            cur.execute("DELETE FROM EDILoad")
            cur.execute("DELETE FROM EDIStage")
            cur.execute("DELETE FROM EDIVett")
            cur.execute(
                """
                UPDATE work_state
                SET timestamp = NULL,
                    matchstatus = NULL
                WHERE id = 1
                """
            )
            conn.commit()

            return {
                "status": "denied",
                "statusTag": "DENIED",
                "message": "835 approval was denied and the working tables were reset.",
                "tablesReset": ["EDILoad", "EDIStage", "EDIVett"],
                "timestamp": approval_timestamp,
            }

        vetted_df = pd.read_sql_query("SELECT * FROM EDIVett ORDER BY id ASC", conn)
        if vetted_df.empty:
            raise HTTPException(status_code=400, detail="EDIVett is empty. Run vetting before approval.")

        approved_df = vetted_df.drop(columns=["id"], errors="ignore").copy()
        approved_df["matchstatus"] = "UNMATCHED"

        approval_key_columns = ["check_date", "check_number", "check_amount", "filename", "batchnum", "transnum", "timestamp"]
        if _all_rows_already_exist(conn, "EDI", approved_df, approval_key_columns):
            raise HTTPException(
                status_code=409,
                detail="These 835 rows were already approved and are already present in EDI.",
            )

        approved_rows = _append_table_from_dataframe(
            conn,
            "EDI",
            approved_df[
                [
                    "check_date",
                    "check_number",
                    "check_amount",
                    "filename",
                    "batchnum",
                    "transnum",
                    "timestamp",
                    "matchstatus",
                ]
            ],
        )

        last_transnum = ""
        if "transnum" in approved_df.columns and not approved_df["transnum"].empty:
            last_transnum = str(approved_df["transnum"].iloc[-1]).strip()

        cur.execute("DELETE FROM EDILoad")
        cur.execute("DELETE FROM EDIStage")
        cur.execute("DELETE FROM EDIVett")
        cur.execute(
            """
            UPDATE work_state
            SET transnum = COALESCE(NULLIF(?, ''), transnum),
                timestamp = ?,
                matchstatus = ?
            WHERE id = 1
            """,
            (last_transnum, approval_timestamp, "APPROVED"),
        )
        conn.commit()

        try:
            refresh_result = commit_all_strong_matches()
        except Exception as exc:
            refresh_warning = str(exc)

        response = {
            "status": "approved",
            "statusTag": "APPROVED",
            "message": f"835 approval completed and {approved_rows} vetted row(s) were appended to EDI.",
            "rowsApproved": approved_rows,
            "table": "EDI",
            "timestamp": approval_timestamp,
            "tablesReset": ["EDILoad", "EDIStage", "EDIVett"],
        }
        if refresh_result is not None:
            response["matchRefresh"] = refresh_result
        if refresh_warning:
            response["matchRefreshWarning"] = refresh_warning
        return response
    except HTTPException:
        conn.rollback()
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to approve 835 data: {exc}")
    finally:
        conn.close()


# ------------------------------------------------------------
# EFT IMPORT STAGING
# ------------------------------------------------------------
@app.post("/eft/upload-stage")
async def post_eft_upload_stage(file: UploadFile = File(...)):
    filename = file.filename or ""
    lower_name = filename.lower()
    if not filename.startswith("DEP_1101_TRAN"):
        raise HTTPException(status_code=400, detail="Please choose a DEP_1101_TRAN file from Downloads")
    if not lower_name.endswith((".xls", ".xlsx")):
        raise HTTPException(status_code=400, detail="Please upload a DEP_1101_TRAN .xls or .xlsx file")

    try:
        file_bytes = await file.read()
        df = pd.read_excel(BytesIO(file_bytes), dtype=str).fillna("")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {exc}")

    expected_headers = [
        "As-Of Date",
        "As-Of-Time",
        "Bank ID",
        "Bank Name",
        "State",
        "Acct No",
        "Acct Type",
        "Acct Name",
        "Currency",
        "IBAN",
        "BAI Type Code",
        "Tran Desc",
        "Debit Amt",
        "Credit Amt",
        "0 Day Flt Amt",
        "1 Day Flt Amt",
        "2+ Day Flt Amt",
        "Customer Ref No",
        "Value Date",
        "Location",
        "Bank Reference",
        "Tran Status",
        "Descriptive Text 1",
        "Descriptive Text 2",
        "Descriptive Text 3",
        "Descriptive Text 4",
        "Descriptive Text 5",
        "Descriptive Text 6",
        "Descriptive Text 7",
        "Descriptive Text 8",
        "Descriptive Text 9",
        "Descriptive Text 10",
        "Descriptive Text 11",
        "Descriptive Text 12",
        "Descriptive Text 13",
        "Descriptive Text 14",
        "Descriptive Text 15",
        "Descriptive Text 16",
        "Descriptive Text 17",
        "Descriptive Text 18",
        "Descriptive Text 19",
        "Descriptive Text 20",
        "Descriptive Text 21",
        "Descriptive Text 22",
        "Description",
        "Unique ID",
        "Discretionary Data",
        "UETR",
        "Payment Fee Deduction",
        "Beneficiary Final Wire Received Status",
    ]

    missing_headers = [header for header in expected_headers if header not in df.columns]
    if missing_headers:
        raise HTTPException(
            status_code=400,
            detail=f"Missing column(s) in DEP_1101_TRAN file: {', '.join(missing_headers)}",
        )

    conn = get_conn()
    try:
        ensure_eftload_schema(conn)
        cur = conn.cursor()
        conn.execute("BEGIN IMMEDIATE")
        cur.execute("DELETE FROM EFTLoad")

        working_df = df[expected_headers].copy()
        working_df.insert(0, "batchnum", None)
        working_df.insert(1, "transnum", None)
        working_df.insert(2, "timestamp", None)
        working_df.insert(3, "matchstatus", None)

        eftload_columns = [
            "batchnum",
            "transnum",
            "timestamp",
            "matchstatus",
            *expected_headers,
        ]
        quoted_columns = ", ".join(_quote_identifier(column) for column in eftload_columns)
        placeholders = ", ".join(["?"] * len(eftload_columns))
        insert_sql = f"INSERT INTO {_quote_identifier('EFTLoad')} ({quoted_columns}) VALUES ({placeholders})"
        cur.executemany(insert_sql, working_df.itertuples(index=False, name=None))
        conn.commit()

        row_count = int(conn.execute("SELECT COUNT(*) FROM EFTLoad").fetchone()[0] or 0)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {
        "status": "loaded",
        "statusTag": "EFTLOAD REFRESHED",
        "filename": filename,
        "rowsLoaded": row_count,
        "table": "EFTLoad",
        "appendMode": False,
    }


# ------------------------------------------------------------
# EFT STAGING
# ------------------------------------------------------------
@app.post("/eft/transform-stage")
def post_eft_transform_stage():
    conn = get_conn()
    try:
        ensure_source_table_columns(conn)
        ensure_eftload_schema(conn)
        cur = conn.cursor()

        load_count_row = cur.execute("SELECT COUNT(*) FROM EFTLoad").fetchone()
        load_count = int(load_count_row[0] or 0) if load_count_row else 0
        if load_count == 0:
            raise HTTPException(status_code=400, detail="EFTLoad is empty. Load DEP_1101_TRAN first.")

        work_state = cur.execute(
            "SELECT batchnum, transnum FROM work_state WHERE id = 1"
        ).fetchone()
        batchnum = str(work_state[0]).strip() if work_state and work_state[0] not in (None, "") else "1"
        try:
            next_trans = int(str(work_state[1]).strip() or "0") + 1 if work_state and work_state[1] not in (None, "") else 1
        except ValueError:
            next_trans = 1

        source_df = pd.read_sql_query("SELECT * FROM EFTLoad ORDER BY rowid ASC", conn)
        if source_df.empty:
            raise HTTPException(status_code=400, detail="EFTLoad is empty. Load DEP_1101_TRAN first.")

        stage_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        staged_rows = []
        for index, row in source_df.iterrows():
            payer, check_number = _parse_eft_descriptive_text_1(row.get("Descriptive Text 1", ""))
            staged_rows.append(
                {
                    "Date": _normalize_yyyy_mm_dd_to_mmddyyyy(row.get("As-Of Date", "")),
                    "Amount": str(row.get("Credit Amt", "")).strip(),
                    "CheckNumber": check_number,
                    "Payer": payer,
                    "batchnum": batchnum,
                    "transnum": str(next_trans + index),
                    "timestamp": stage_timestamp,
                    "matchstatus": "STAGED",
                    "Descriptive Text 1": str(row.get("Descriptive Text 1", "")).strip(),
                }
            )

        staged_df = pd.DataFrame(staged_rows)

        _replace_table_from_dataframe(conn, "EFTStage", staged_df)
        conn.commit()

        end_trans = next_trans + len(staged_df) - 1
        cur.execute(
            """
            UPDATE work_state
            SET transnum = ?, timestamp = ?, matchstatus = ?
            WHERE id = 1
            """,
            (str(end_trans), stage_timestamp, "STAGED"),
        )
        conn.commit()

        return {
            "status": "staged",
            "statusTag": "EFT STAGED",
            "rowsStaged": int(len(staged_df)),
            "batchnum": batchnum,
            "startTransnum": str(next_trans),
            "endTransnum": str(end_trans),
            "timestamp": stage_timestamp,
            "table": "EFTStage",
            "fieldMap": {
                "Date": "As-Of Date",
                "Amount": "Credit Amt",
                "Descriptive Text 1": "Descriptive Text 1",
            },
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ------------------------------------------------------------
# EFT VETTING
# ------------------------------------------------------------
@app.post("/eft/vet-stage")
def post_eft_vet_stage():
    conn = get_conn()
    try:
        ensure_source_table_columns(conn)
        ensure_eftload_schema(conn)
        cur = conn.cursor()

        stage_df = pd.read_sql_query("SELECT * FROM EFTStage ORDER BY rowid ASC", conn)
        if stage_df.empty:
            raise HTTPException(status_code=400, detail="EFTStage is empty. Run staging first.")

        eft_df = pd.read_sql_query('SELECT "Date" FROM EFT', conn)
        eft_dates = {
            _normalize_yyyy_mm_dd_to_mmddyyyy(value)
            for value in eft_df.get("Date", pd.Series(dtype=str)).fillna("").astype(str).tolist()
            if _normalize_yyyy_mm_dd_to_mmddyyyy(value)
        }

        working_df = stage_df.drop(columns=["id"], errors="ignore").copy()
        working_df["Date"] = working_df.get("Date", pd.Series(dtype=str)).fillna("").astype(str).map(_normalize_yyyy_mm_dd_to_mmddyyyy)
        working_df["Payer"] = working_df.get("Payer", pd.Series(dtype=str)).fillna("").astype(str).str.strip()
        working_df["CheckNumber"] = working_df.get("CheckNumber", pd.Series(dtype=str)).fillna("").astype(str).str.strip()
        working_df["Amount"] = working_df.get("Amount", pd.Series(dtype=str)).fillna("").astype(str).str.strip()
        working_df["Descriptive Text 1"] = working_df.get("Descriptive Text 1", pd.Series(dtype=str)).fillna("").astype(str)

        duplicate_mask = []
        blank_payer_mask = []
        blank_date_mask = []
        for date_value, payer_value in zip(working_df["Date"].tolist(), working_df["Payer"].tolist()):
            normalized_date = str(date_value).strip()
            payer = str(payer_value).strip()
            blank_date = normalized_date == ""
            blank_payer = payer == ""
            duplicate = False
            if not blank_date and normalized_date in eft_dates:
                duplicate = True

            duplicate_mask.append(duplicate)
            blank_payer_mask.append(blank_payer)
            blank_date_mask.append(blank_date)

        duplicate_df = working_df.loc[
            [duplicate_mask[index] and not blank_payer_mask[index] for index in range(len(working_df))]
        ].copy()
        blank_payer_df = working_df.loc[blank_payer_mask].copy()
        blank_date_df = working_df.loc[blank_date_mask].copy()

        load_mask = [
            not duplicate_mask[index] and not blank_payer_mask[index] and not blank_date_mask[index]
            for index in range(len(working_df))
        ]
        load_df = working_df.loc[load_mask].copy()
        load_df["matchstatus"] = "VETTED"

        duplicate_rows = []
        for index, row in duplicate_df.iterrows():
            duplicate_rows.append(
                {
                    "row": int(index) + 1,
                    "date": str(row.get("Date", "")).strip(),
                    "payer": str(row.get("Payer", "")).strip(),
                    "checkNumber": str(row.get("CheckNumber", "")).strip(),
                    "amount": str(row.get("Amount", "")).strip(),
                    "status": "BLOCKED",
                }
            )

        blank_payer_rows = []
        for index, row in blank_payer_df.iterrows():
            blank_payer_rows.append(
                {
                    "row": int(index) + 1,
                    "date": str(row.get("Date", "")).strip(),
                    "payer": str(row.get("Payer", "")).strip(),
                    "checkNumber": str(row.get("CheckNumber", "")).strip(),
                    "amount": str(row.get("Amount", "")).strip(),
                    "status": "BLOCKED",
                }
            )

        blank_date_rows = []
        for index, row in blank_date_df.iterrows():
            blank_date_rows.append(
                {
                    "row": int(index) + 1,
                    "date": str(row.get("Date", "")).strip(),
                    "payer": str(row.get("Payer", "")).strip(),
                    "checkNumber": str(row.get("CheckNumber", "")).strip(),
                    "amount": str(row.get("Amount", "")).strip(),
                    "status": "BLOCKED",
                }
            )

        blocked_row_indices = {
            index
            for index in range(len(working_df))
            if duplicate_mask[index] or blank_payer_mask[index] or blank_date_mask[index]
        }
        blocked_count = int(len(blocked_row_indices))
        qualified_count = int(len(load_df))
        total_rows = int(len(working_df))
        all_blocked = total_rows > 0 and qualified_count == 0
        status_tag = "BLOCKED" if blocked_count > 0 else "VETTED"
        status_message = (
            f"{int(len(duplicate_df))} duplicate date row(s) blocked, "
            f"{int(len(blank_payer_df))} blank payer row(s) blocked, "
            f"{int(len(blank_date_df))} blank date row(s) blocked."
        )
        status_message += f" {blocked_count} unique row(s) blocked."
        if qualified_count > 0:
            status_message += f" {qualified_count} row(s) loaded into EFTVett."
        else:
            status_message += " No rows qualified for EFTVett."

        vetted_columns = [
            "Date",
            "Amount",
            "Payer",
            "CheckNumber",
            "batchnum",
            "transnum",
            "timestamp",
            "matchstatus",
        ]
        vetted_df = load_df[vetted_columns].copy() if qualified_count > 0 else load_df.iloc[0:0][vetted_columns].copy()
        _replace_table_from_dataframe(conn, "EFTVett", vetted_df)
        conn.commit()

        last_transnum = ""
        if qualified_count > 0 and "transnum" in load_df.columns and not load_df["transnum"].empty:
            last_transnum = str(load_df["transnum"].iloc[-1]).strip()

        vet_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cur.execute(
            """
            UPDATE work_state
            SET transnum = COALESCE(NULLIF(?, ''), transnum),
                timestamp = ?,
                matchstatus = ?
            WHERE id = 1
            """,
            (last_transnum, vet_timestamp, status_tag),
        )
        conn.commit()

        return {
            "status": "blocked" if blocked_count > 0 else "vetted",
            "statusTag": f"EFT {status_tag}",
            "message": status_message,
            "table": "EFTVett",
            "rowsLoaded": qualified_count,
            "totalRows": total_rows,
            "duplicateCount": int(len(duplicate_df)),
            "blankPayerCount": int(len(blank_payer_df)),
            "blankDateCount": int(len(blank_date_df)),
            "blockedCount": blocked_count,
            "allBlocked": all_blocked,
            "duplicateRows": duplicate_rows,
            "blankPayerRows": blank_payer_rows,
            "blankDateRows": blank_date_rows,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ------------------------------------------------------------
# EFT APPROVAL
# ------------------------------------------------------------
@app.post("/eft/approval-stage")
async def post_eft_approval_stage(request: Request):
    payload = await request.json() if request.headers.get("content-type", "").lower().startswith("application/json") else {}
    decision = str(payload.get("decision", "")).strip().lower()
    if decision not in ("approve", "approve_partial", "deny"):
        raise HTTPException(status_code=400, detail="decision must be approve, approve_partial, or deny")

    conn = get_conn()
    try:
        ensure_eft_tables(conn)
        cur = conn.cursor()
        conn.execute("BEGIN IMMEDIATE")
        approval_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if decision == "deny":
            cur.execute("DELETE FROM EFTLoad")
            cur.execute("DELETE FROM EFTStage")
            cur.execute("DELETE FROM EFTVett")
            cur.execute(
                """
                UPDATE work_state
                SET timestamp = NULL,
                    matchstatus = NULL
                WHERE id = 1
                """
            )
            conn.commit()

            return {
                "status": "denied",
                "statusTag": "DENIED",
                "message": "EFT approval was denied and the working tables were reset.",
                "tablesReset": ["EFTLoad", "EFTStage", "EFTVett"],
            }

        vetted_df = pd.read_sql_query("SELECT * FROM EFTVett ORDER BY rowid ASC", conn)
        if vetted_df.empty:
            raise HTTPException(status_code=400, detail="EFTVett is empty. Run vetting before approval.")

        approved_df = vetted_df[
            [
                "Date",
                "Amount",
                "Payer",
                "CheckNumber",
                "batchnum",
                "transnum",
                "timestamp",
            ]
        ].copy()
        approved_df["matchstatus"] = "UNMATCHED"

        approval_key_columns = ["Date", "Amount", "Payer", "CheckNumber", "batchnum", "transnum", "timestamp"]
        if _all_rows_already_exist(conn, "EFT", approved_df, approval_key_columns):
            raise HTTPException(
                status_code=409,
                detail="These EFT rows were already approved and are already present in EFT.",
            )

        approved_rows = _append_table_from_dataframe(
            conn,
            "EFT",
            approved_df[
                [
                    "Date",
                    "Amount",
                    "Payer",
                    "CheckNumber",
                    "batchnum",
                    "transnum",
                    "timestamp",
                    "matchstatus",
                ]
            ],
        )

        last_transnum = ""
        if "transnum" in approved_df.columns and not approved_df["transnum"].empty:
            last_transnum = str(approved_df["transnum"].iloc[-1]).strip()

        approval_status = "PARTIAL APPROVED" if decision == "approve_partial" else "APPROVED"
        cur.execute("DELETE FROM EFTLoad")
        cur.execute("DELETE FROM EFTStage")
        cur.execute("DELETE FROM EFTVett")
        cur.execute(
            """
            UPDATE work_state
            SET transnum = COALESCE(NULLIF(?, ''), transnum),
                timestamp = ?,
                matchstatus = ?
            WHERE id = 1
            """,
            (last_transnum, approval_timestamp, approval_status),
        )
        conn.commit()

        return {
            "status": "approved",
            "statusTag": approval_status,
            "message": f"EFT approval completed and {approved_rows} vetted row(s) were appended to EFT.",
            "rowsApproved": approved_rows,
            "table": "EFT",
            "timestamp": approval_timestamp,
            "tablesReset": ["EFTLoad", "EFTStage", "EFTVett"],
        }
    finally:
        conn.close()


# ------------------------------------------------------------
# LOCKBOX IMPORT STAGING
# ------------------------------------------------------------
@app.post("/lockbox/upload-stage")
async def post_lockbox_upload_stage(file: UploadFile = File(...)):
    filename = file.filename or ""
    lower_name = filename.lower()
    if not filename.startswith("SearchResults"):
        raise HTTPException(status_code=400, detail="Please choose a SearchResults file from Downloads")
    if not lower_name.endswith((".xls", ".xlsx")):
        raise HTTPException(status_code=400, detail="Please upload a SearchResults .xls or .xlsx file")

    try:
        file_bytes = await file.read()
        df = pd.read_excel(BytesIO(file_bytes), dtype=str).fillna("")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {exc}")

    conn = get_conn()
    try:
        ensure_source_table_columns(conn)
        cur = conn.cursor()
        cur.execute("DELETE FROM LockboxLoad")
        conn.commit()

        df.to_sql("LockboxLoad", conn, if_exists="append", index=False)
        conn.commit()

        row_count = int(conn.execute("SELECT COUNT(*) FROM LockboxLoad").fetchone()[0] or 0)
    finally:
        conn.close()

    return {
        "status": "loaded",
        "filename": filename,
        "rowsLoaded": row_count,
        "table": "LockboxLoad",
    }


@app.post("/lockbox/transform-stage")
def post_lockbox_transform_stage():
    conn = get_conn()
    try:
        ensure_source_table_columns(conn)
        cur = conn.cursor()

        load_count_row = cur.execute("SELECT COUNT(*) FROM LockboxLoad").fetchone()
        load_count = int(load_count_row[0] or 0) if load_count_row else 0
        if load_count == 0:
            raise HTTPException(status_code=400, detail="LockboxLoad is empty. Upload SearchResults.xls first.")

        work_state = cur.execute(
            "SELECT batchnum, transnum FROM work_state WHERE id = 1"
        ).fetchone()
        batchnum = str(work_state[0]).strip() if work_state and work_state[0] not in (None, "") else "1"
        try:
            next_trans = int(str(work_state[1]).strip() or "0") + 1 if work_state and work_state[1] not in (None, "") else 1
        except ValueError:
            next_trans = 1

        source_df = pd.read_sql_query("SELECT * FROM LockboxLoad ORDER BY id ASC", conn)
        if source_df.empty:
            raise HTTPException(status_code=400, detail="LockboxLoad is empty. Upload SearchResults.xls first.")

        transform_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        source_df = source_df.drop(columns=["id"], errors="ignore")
        source_df["batchnum"] = batchnum
        source_df["transnum"] = [str(next_trans + index) for index in range(len(source_df))]
        source_df["timestamp"] = transform_timestamp
        source_df["matchstatus"] = "TRANSFORMED"

        cur.execute("DELETE FROM LockboxStage")
        conn.commit()
        source_df.to_sql("LockboxStage", conn, if_exists="append", index=False)

        end_trans = next_trans + len(source_df) - 1
        cur.execute(
            """
            UPDATE work_state
            SET transnum = ?, timestamp = ?, matchstatus = ?
            WHERE id = 1
            """,
            (str(end_trans), transform_timestamp, "TRANSFORMED"),
        )
        conn.commit()

        return {
            "status": "transformed",
            "statusTag": "TRANSFORMED",
            "rowsStaged": int(len(source_df)),
            "batchnum": batchnum,
            "startTransnum": str(next_trans),
            "endTransnum": str(end_trans),
            "timestamp": transform_timestamp,
            "table": "LockboxStage",
        }
    finally:
        conn.close()


@app.post("/lockbox/vet-stage")
async def post_lockbox_vet_stage(request: Request):
    payload = await request.json() if request.headers.get("content-type", "").lower().startswith("application/json") else {}
    decision = str(payload.get("decision", "")).strip().lower()
    if decision not in ("", "partial", "reject"):
        raise HTTPException(status_code=400, detail="decision must be partial or reject")

    conn = get_conn()
    try:
        ensure_source_table_columns(conn)
        cur = conn.cursor()

        stage_df = pd.read_sql_query("SELECT * FROM LockboxStage ORDER BY id ASC", conn)
        if stage_df.empty:
          raise HTTPException(status_code=400, detail="LockboxStage is empty. Transform the lockbox file first.")

        lockbox_df = pd.read_sql_query('SELECT "Check Number" FROM Lockbox', conn)
        lockbox_checks = {
            str(value).strip()
            for value in lockbox_df.get("Check Number", pd.Series(dtype=str)).fillna("").astype(str).tolist()
            if str(value).strip()
        }

        working_df = stage_df.drop(columns=["id"], errors="ignore").copy()
        working_df["Check Number"] = working_df["Check Number"].fillna("").astype(str)

        seen_stage_checks = set()
        duplicate_mask = []
        for check_number in working_df["Check Number"].tolist():
            normalized_check = str(check_number).strip()
            is_duplicate = False
            if normalized_check:
                if normalized_check in lockbox_checks or normalized_check in seen_stage_checks:
                    is_duplicate = True
                else:
                    seen_stage_checks.add(normalized_check)
            duplicate_mask.append(is_duplicate)

        duplicate_df = working_df.loc[duplicate_mask].copy()
        qualifying_df = working_df.loc[[not value for value in duplicate_mask]].copy()

        duplicate_rows = []
        for index, row in duplicate_df.iterrows():
            duplicate_rows.append(
                {
                    "row": int(index) + 1,
                    "checkNumber": str(row.get("Check Number", "")).strip(),
                    "transactionNumber": str(row.get("Transaction Number", "")).strip(),
                    "depositDate": str(row.get("Deposit Date", "")).strip(),
                    "payor": str(row.get("Payor", "")).strip(),
                    "checkAmount": str(row.get("Check Amount", "")).strip(),
                    "status": str(row.get("Status", "")).strip(),
                }
            )

        total_rows = int(len(working_df))
        duplicate_count = int(len(duplicate_df))
        qualified_count = int(len(qualifying_df))
        all_duplicates = total_rows > 0 and duplicate_count == total_rows
        partial_available = duplicate_count > 0 and qualified_count > 0

        if decision == "reject":
            cur.execute("DELETE FROM LockboxVett")
            conn.commit()
            return {
                "status": "rejected",
                "statusTag": "REJECTED",
                "message": "Lockbox vetting was rejected and no rows were loaded into LockboxVett.",
                "table": "LockboxVett",
                "totalRows": total_rows,
                "duplicateCount": duplicate_count,
                "qualifiedCount": qualified_count,
                "allDuplicates": all_duplicates,
                "decisionRequired": False,
                "duplicateRows": duplicate_rows,
            }

        if all_duplicates:
            cur.execute("DELETE FROM LockboxVett")
            conn.commit()
            return {
                "status": "rejected",
                "statusTag": "REJECTED",
                "message": "All rows were duplicates, so the file was rejected.",
                "table": "LockboxVett",
                "totalRows": total_rows,
                "duplicateCount": duplicate_count,
                "qualifiedCount": qualified_count,
                "allDuplicates": True,
                "decisionRequired": False,
                "duplicateRows": duplicate_rows,
            }

        if decision not in ("partial",) and partial_available:
            return {
                "status": "review",
                "statusTag": "PARTIAL REVIEW",
                "message": "Some rows are duplicates. Choose partial upload to keep the clean rows, or reject the file for a complete overhaul.",
                "table": "LockboxVett",
                "totalRows": total_rows,
                "duplicateCount": duplicate_count,
                "qualifiedCount": qualified_count,
                "allDuplicates": False,
                "decisionRequired": True,
                "duplicateRows": duplicate_rows,
            }

        if decision == "partial" or (duplicate_count == 0 and qualified_count > 0):
            load_df = qualifying_df.copy() if duplicate_count > 0 else working_df.copy()
            load_df["matchstatus"] = "VETTED"
            cur.execute("DELETE FROM LockboxVett")
            conn.commit()
            load_df.to_sql("LockboxVett", conn, if_exists="append", index=False)
            conn.commit()
            return {
                "status": "vetted",
                "statusTag": "VETTED",
                "message": "Lockbox vetting completed successfully.",
                "table": "LockboxVett",
                "rowsLoaded": int(len(load_df)),
                "totalRows": total_rows,
                "duplicateCount": duplicate_count,
                "qualifiedCount": int(len(load_df)),
                "allDuplicates": False,
                "decisionRequired": False,
                "duplicateRows": duplicate_rows,
            }

        return {
            "status": "review",
            "statusTag": "PARTIAL REVIEW",
            "message": "Review the duplicate rows below before deciding whether to accept the clean rows.",
            "table": "LockboxVett",
            "totalRows": total_rows,
            "duplicateCount": duplicate_count,
            "qualifiedCount": qualified_count,
            "allDuplicates": False,
            "decisionRequired": partial_available,
            "duplicateRows": duplicate_rows,
        }
    finally:
        conn.close()


@app.post("/lockbox/approval-stage")
async def post_lockbox_approval_stage(request: Request):
    payload = await request.json() if request.headers.get("content-type", "").lower().startswith("application/json") else {}
    decision = str(payload.get("decision", "")).strip().lower()
    if decision not in ("approve", "deny"):
        raise HTTPException(status_code=400, detail="decision must be approve or deny")

    conn = get_conn()
    try:
        ensure_source_table_columns(conn)
        cur = conn.cursor()
        conn.execute("BEGIN IMMEDIATE")
        approval_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if decision == "deny":
            cur.execute("DELETE FROM LockboxLoad")
            cur.execute("DELETE FROM LockboxStage")
            cur.execute("DELETE FROM LockboxVett")
            cur.execute(
                """
                UPDATE work_state
                SET timestamp = NULL,
                    matchstatus = NULL
                WHERE id = 1
                """
            )
            conn.commit()

            return {
                "status": "denied",
                "statusTag": "DENIED",
                "message": "Lockbox approval was denied and the working tables were reset.",
                "tablesReset": ["LockboxLoad", "LockboxStage", "LockboxVett"],
            }

        vetted_df = pd.read_sql_query("SELECT * FROM LockboxVett ORDER BY id ASC", conn)
        if vetted_df.empty:
            raise HTTPException(status_code=400, detail="LockboxVett is empty. Run vetting before approval.")

        lockbox_df = vetted_df.drop(columns=["id"], errors="ignore").copy()
        lockbox_df["matchstatus"] = "APPROVED"

        lockbox_key_columns = [column for column in lockbox_df.columns if column != "matchstatus"]
        if _all_rows_already_exist_as_text(conn, "Lockbox", lockbox_df, lockbox_key_columns):
            raise HTTPException(
                status_code=409,
                detail="These Lockbox rows were already approved and are already present in Lockbox.",
            )

        lockbox_df.to_sql("Lockbox", conn, if_exists="append", index=False)

        approved_rows = int(len(lockbox_df))
        last_transnum = ""
        if "transnum" in lockbox_df.columns and not lockbox_df["transnum"].empty:
            last_transnum = str(lockbox_df["transnum"].iloc[-1]).strip()

        cur.execute("DELETE FROM LockboxLoad")
        cur.execute("DELETE FROM LockboxStage")
        cur.execute("DELETE FROM LockboxVett")
        cur.execute(
            """
            UPDATE work_state
            SET transnum = COALESCE(NULLIF(?, ''), transnum),
                timestamp = ?,
                matchstatus = ?
            WHERE id = 1
            """,
            (last_transnum, approval_timestamp, "APPROVED"),
        )
        conn.commit()

        return {
            "status": "approved",
            "statusTag": "APPROVED",
            "message": "Lockbox approval completed and the vetted rows were written to Lockbox.",
            "rowsApproved": approved_rows,
            "table": "Lockbox",
            "timestamp": approval_timestamp,
        }
    finally:
        conn.close()


# ------------------------------------------------------------
# BANKING SPREADSHEET
# ------------------------------------------------------------
@app.get("/banking/spreadsheet")
def get_banking_spreadsheet():
    return build_banking_spreadsheet()


def _era_check_candidates(check_number: str) -> list[str]:
    raw = str(check_number or "").strip()
    normalized = normalize_checknum(raw)
    candidates = [raw, normalized, raw.lstrip("0"), normalized.lstrip("0")]
    return [candidate for candidate in dict.fromkeys(candidates) if candidate]


@app.get("/era/spreadsheet")
def get_era_spreadsheet(work_day: str):
    normalized_work_day = normalize_mmddyyyy(work_day)
    if not normalized_work_day:
        raise HTTPException(status_code=400, detail="work_day is required")

    conn = get_conn()
    init_db()
    row = conn.execute(
        "SELECT bank_day FROM calendar WHERE paperwork_day = ?",
        (normalized_work_day,),
    ).fetchone()
    conn.close()

    bank_day = normalize_mmddyyyy(row[0]) if row and row[0] else None
    if not bank_day:
        return {
            "workDay": normalized_work_day,
            "bankDay": None,
            "rows": [],
            "matchedChecks": 0,
            "matchedFiles": 0,
        }

    spreadsheet = build_banking_spreadsheet()
    if not os.path.exists(ZIP_835_ERA_FOLDER):
        raise HTTPException(status_code=404, detail="ERA folder does not exist")

    era_files = [
        filename
        for filename in sorted(os.listdir(ZIP_835_ERA_FOLDER))
        if filename.lower().endswith(".era")
        and os.path.isfile(os.path.join(ZIP_835_ERA_FOLDER, filename))
    ]

    file_contents: dict[str, str] = {}
    for filename in era_files:
        full_path = os.path.join(ZIP_835_ERA_FOLDER, filename)
        try:
            with open(full_path, "r", errors="ignore") as handle:
                file_contents[filename] = handle.read()
        except Exception:
            file_contents[filename] = ""

    rows = []
    matched_checks = set()

    for group in spreadsheet["groups"]:
        for row_data in group["rows"]:
            if row_data.get("edi") != "Y":
                continue
            if normalize_mmddyyyy(row_data.get("date")) != bank_day:
                continue

            check_number = str(row_data.get("checkNumber") or "").strip()
            if not check_number:
                continue

            candidates = _era_check_candidates(check_number)
            matched_files = [
                filename
                for filename, content in file_contents.items()
                if any(candidate in content for candidate in candidates)
            ]

            if not matched_files:
                continue

            matched_checks.add(check_number)
            for filename in matched_files:
                rows.append(
                    {
                        "source": group["source"],
                        "bankDay": bank_day,
                        "checkNumber": check_number,
                        "payer": str(row_data.get("payer") or "").strip(),
                        "amount": str(row_data.get("amount") or "").strip(),
                        "eraFile": filename,
                    }
                )

    rows.sort(key=lambda item: (item["source"], item["checkNumber"], item["eraFile"]))

    return {
        "workDay": normalized_work_day,
        "bankDay": bank_day,
        "rows": rows,
        "matchedChecks": len(matched_checks),
        "matchedFiles": len(rows),
    }


@app.post("/era/convert")
def post_era_convert(payload: dict):
    work_day = normalize_mmddyyyy(payload.get("work_day"))
    if not work_day:
        raise HTTPException(status_code=400, detail="work_day is required")

    conn = get_conn()
    init_db()
    row = conn.execute(
        "SELECT bank_day FROM calendar WHERE paperwork_day = ?",
        (work_day,),
    ).fetchone()
    conn.close()

    bank_day = normalize_mmddyyyy(row[0]) if row and row[0] else None
    if not bank_day:
        raise HTTPException(status_code=400, detail="No bank day is mapped to the selected posting day")

    if not os.path.exists(ZIP_835_ERA_FOLDER):
        raise HTTPException(status_code=404, detail="ERA folder does not exist")

    os.makedirs(os.path.join(ZIP_835_ERA_FOLDER, "Renamed"), exist_ok=True)

    spreadsheet = build_banking_spreadsheet()
    target_rows = []
    for group in spreadsheet["groups"]:
        for row_data in group["rows"]:
            if row_data.get("edi") != "Y":
                continue
            if normalize_mmddyyyy(row_data.get("date")) != bank_day:
                continue

            check_number = str(row_data.get("checkNumber") or "").strip()
            if not check_number:
                continue

            target_rows.append(
                {
                    "source": group["source"],
                    "checkNumber": check_number,
                    "payer": str(row_data.get("payer") or "").strip(),
                    "amount": str(row_data.get("amount") or "").strip(),
                }
            )

    target_rows.sort(key=lambda item: (item["source"], item["checkNumber"]))
    check_candidates = [row["checkNumber"] for row in target_rows]

    era_files = [
        filename
        for filename in sorted(os.listdir(ZIP_835_ERA_FOLDER))
        if filename.lower().endswith(".era")
        and os.path.isfile(os.path.join(ZIP_835_ERA_FOLDER, filename))
    ]

    renamed = []
    sequence = 1
    date_prefix = datetime.strptime(work_day, "%m/%d/%Y").strftime("%m.%d.%y")
    renamed_folder = os.path.join(ZIP_835_ERA_FOLDER, "Renamed")

    for filename in era_files:
        full_path = os.path.join(ZIP_835_ERA_FOLDER, filename)
        orig_ext = os.path.splitext(filename)[1]
        try:
            with open(full_path, "r", errors="ignore") as handle:
                content = handle.read()
        except Exception:
            continue

        matched_check = ""
        for check_number in check_candidates:
            for candidate in _era_check_candidates(check_number):
                if candidate and candidate in content:
                    matched_check = check_number
                    break
            if matched_check:
                break

        if not matched_check:
            continue

        new_name = f"{date_prefix}-835-{sequence}-{matched_check}{orig_ext}"
        destination = os.path.join(renamed_folder, new_name)

        if os.path.exists(destination):
            raise HTTPException(status_code=409, detail=f"Destination already exists: {new_name}")

        shutil.move(full_path, destination)
        renamed.append(
            {
                "sourceFile": filename,
                "renamedFile": new_name,
                "checkNumber": matched_check,
            }
        )
        sequence += 1

    return {
        "status": "converted" if renamed else "noop",
        "statusTag": "CONVERTED" if renamed else "NO FILES",
        "message": (
            f"Renamed {len(renamed)} ERA file(s) and moved them to 2.ERA/Renamed."
            if renamed
            else "No ERA files matched the selected day."
        ),
        "workDay": work_day,
        "bankDay": bank_day,
        "renamedCount": len(renamed),
        "outputFolder": renamed_folder,
        "renamedFiles": renamed,
    }


@app.get("/html/spreadsheet")
def get_html_spreadsheet(work_day: str):
    normalized_work_day = normalize_mmddyyyy(work_day)
    if not normalized_work_day:
        raise HTTPException(status_code=400, detail="work_day is required")

    conn = get_conn()
    init_db()
    row = conn.execute(
        "SELECT bank_day FROM calendar WHERE paperwork_day = ?",
        (normalized_work_day,),
    ).fetchone()
    conn.close()

    bank_day = normalize_mmddyyyy(row[0]) if row and row[0] else None
    if not bank_day:
        return {
            "workDay": normalized_work_day,
            "bankDay": None,
            "rows": [],
            "matchedChecks": 0,
            "matchedFiles": 0,
        }

    spreadsheet = build_banking_spreadsheet()
    if not os.path.exists(ZIP_835_HTML_FOLDER):
        raise HTTPException(status_code=404, detail="HTML folder does not exist")

    html_files = [
        filename
        for filename in sorted(os.listdir(ZIP_835_HTML_FOLDER))
        if filename.lower().endswith((".html", ".htm"))
        and os.path.isfile(os.path.join(ZIP_835_HTML_FOLDER, filename))
    ]

    file_contents: dict[str, str] = {}
    for filename in html_files:
        full_path = os.path.join(ZIP_835_HTML_FOLDER, filename)
        try:
            with open(full_path, "r", errors="ignore") as handle:
                file_contents[filename] = handle.read()
        except Exception:
            file_contents[filename] = ""

    rows = []
    matched_checks = set()

    for group in spreadsheet["groups"]:
        for row_data in group["rows"]:
            if row_data.get("edi") != "Y":
                continue
            if normalize_mmddyyyy(row_data.get("date")) != bank_day:
                continue

            check_number = str(row_data.get("checkNumber") or "").strip()
            if not check_number:
                continue

            candidates = _era_check_candidates(check_number)
            matched_files = [
                filename
                for filename, content in file_contents.items()
                if any(candidate in content for candidate in candidates)
            ]

            if not matched_files:
                continue

            matched_checks.add(check_number)
            for filename in matched_files:
                rows.append(
                    {
                        "source": group["source"],
                        "bankDay": bank_day,
                        "checkNumber": check_number,
                        "htmlFile": filename,
                    }
                )

    rows.sort(key=lambda item: (item["source"], item["checkNumber"], item["htmlFile"]))

    return {
        "workDay": normalized_work_day,
        "bankDay": bank_day,
        "rows": rows,
        "matchedChecks": len(matched_checks),
        "matchedFiles": len(rows),
    }


@app.post("/html/convert")
def post_html_convert(payload: dict):
    work_day = normalize_mmddyyyy(payload.get("work_day"))
    if not work_day:
        raise HTTPException(status_code=400, detail="work_day is required")

    conn = get_conn()
    init_db()
    row = conn.execute(
        "SELECT bank_day FROM calendar WHERE paperwork_day = ?",
        (work_day,),
    ).fetchone()
    conn.close()

    bank_day = normalize_mmddyyyy(row[0]) if row and row[0] else None
    if not bank_day:
        raise HTTPException(status_code=400, detail="No bank day is mapped to the selected posting day")

    if not os.path.exists(ZIP_835_HTML_FOLDER):
        raise HTTPException(status_code=404, detail="HTML folder does not exist")

    os.makedirs(os.path.join(ZIP_835_HTML_FOLDER, "Renamed"), exist_ok=True)

    spreadsheet = build_banking_spreadsheet()
    target_rows = []
    for group in spreadsheet["groups"]:
        for row_data in group["rows"]:
            if row_data.get("edi") != "Y":
                continue
            if normalize_mmddyyyy(row_data.get("date")) != bank_day:
                continue

            check_number = str(row_data.get("checkNumber") or "").strip()
            if not check_number:
                continue

            target_rows.append(
                {
                    "source": group["source"],
                    "checkNumber": check_number,
                    "payer": str(row_data.get("payer") or "").strip(),
                    "amount": str(row_data.get("amount") or "").strip(),
                }
            )

    target_rows.sort(key=lambda item: (item["source"], item["checkNumber"]))
    check_candidates = [row["checkNumber"] for row in target_rows]

    html_files = [
        filename
        for filename in sorted(os.listdir(ZIP_835_HTML_FOLDER))
        if filename.lower().endswith((".html", ".htm"))
        and os.path.isfile(os.path.join(ZIP_835_HTML_FOLDER, filename))
    ]

    renamed = []
    sequence = 1
    date_prefix = datetime.strptime(work_day, "%m/%d/%Y").strftime("%m.%d.%y")
    renamed_folder = os.path.join(ZIP_835_HTML_FOLDER, "Renamed")

    for filename in html_files:
        full_path = os.path.join(ZIP_835_HTML_FOLDER, filename)
        orig_ext = os.path.splitext(filename)[1]
        try:
            with open(full_path, "r", errors="ignore") as handle:
                content = handle.read()
        except Exception:
            continue

        matched_check = ""
        for check_number in check_candidates:
            for candidate in _era_check_candidates(check_number):
                if candidate and candidate in content:
                    matched_check = check_number
                    break
            if matched_check:
                break

        if not matched_check:
            continue

        new_name = f"{date_prefix}-835-{sequence}-{matched_check}{orig_ext}"
        destination = os.path.join(renamed_folder, new_name)

        if os.path.exists(destination):
            raise HTTPException(status_code=409, detail=f"Destination already exists: {new_name}")

        shutil.move(full_path, destination)
        renamed.append(
            {
                "sourceFile": filename,
                "renamedFile": new_name,
                "checkNumber": matched_check,
            }
        )
        sequence += 1

    return {
        "status": "converted" if renamed else "noop",
        "statusTag": "CONVERTED" if renamed else "NO FILES",
        "message": (
            f"Renamed {len(renamed)} HTML file(s) and moved them to 3.HTML/Renamed."
            if renamed
            else "No HTML files matched the selected day."
        ),
        "workDay": work_day,
        "bankDay": bank_day,
        "renamedCount": len(renamed),
        "outputFolder": renamed_folder,
        "renamedFiles": renamed,
    }


@app.get("/otherday/spreadsheet")
def get_otherday_spreadsheet():
    current_work_day = normalize_mmddyyyy(get_current_work_day() or "")
    if not current_work_day:
        raise HTTPException(status_code=400, detail="No current work day is set")

    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT bank_day FROM calendar WHERE paperwork_day = ?",
            (current_work_day,),
        ).fetchone()
        bank_day = normalize_mmddyyyy(row[0]) if row and row[0] else None
        if not bank_day:
            return {
                "currentWorkDay": current_work_day,
                "bankDay": None,
                "rows": [],
                "missingRows": [],
                "rowCount": 0,
                "missingCount": 0,
                "filenamesWithMissing": 0,
            }

        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT
                check_date,
                check_number,
                check_amount,
                filename,
                matchstatus
            FROM EDI
            ORDER BY check_date ASC, check_number ASC, filename ASC
            """
        ).fetchall()

        def _clean_filename(value: str | None) -> str:
            return str(value or "").strip()

        def _clean_check_number(value: str | None) -> str:
            return str(value or "").strip()

        def _format_amount(value):
            if value in (None, ""):
                return ""
            try:
                return f"{float(value):,.2f}"
            except Exception:
                return str(value)

        count_all: dict[str, int] = {}
        for row_data in rows:
            filename = _clean_filename(row_data["filename"])
            if filename:
                count_all[filename] = count_all.get(filename, 0) + 1

        today_rows = []
        for row_data in rows:
            if normalize_mmddyyyy(row_data["check_date"]) != bank_day:
                continue

            filename = _clean_filename(row_data["filename"])
            if not filename:
                continue

            today_rows.append(
                {
                    "filename": filename,
                    "checkNumber": _clean_check_number(row_data["check_number"]),
                    "ediAmount": _format_amount(row_data["check_amount"]),
                    "bankDay": normalize_mmddyyyy(row_data["check_date"]) or "",
                    "matchstatus": str(row_data["matchstatus"] or "").strip(),
                    "counts": "",
                }
            )

        count_today: dict[str, int] = {}
        for row_data in today_rows:
            filename = row_data["filename"]
            count_today[filename] = count_today.get(filename, 0) + 1

        for row_data in today_rows:
            filename = row_data["filename"]
            row_data["counts"] = f"{count_all.get(filename, 0)} {count_today.get(filename, 0)}"

        filenames_with_missing = [
            filename
            for filename in dict.fromkeys(row_data["filename"] for row_data in today_rows if row_data["filename"])
            if count_all.get(filename, 0) > count_today.get(filename, 0)
        ]

        missing_rows = []
        for row_data in rows:
            filename = _clean_filename(row_data["filename"])
            if not filename or filename not in filenames_with_missing:
                continue

            missing_rows.append(
                {
                    "filename": filename,
                    "checkNumber": _clean_check_number(row_data["check_number"]),
                    "ediAmount": _format_amount(row_data["check_amount"]),
                    "bankDay": normalize_mmddyyyy(row_data["check_date"]) or "",
                    "matchstatus": str(row_data["matchstatus"] or "").strip(),
                    "counts": f"{count_all.get(filename, 0)} {count_today.get(filename, 0)}",
                }
            )

        today_rows.sort(key=lambda item: (item["filename"], item["checkNumber"]))
        missing_rows.sort(key=lambda item: (item["filename"], item["checkNumber"], item["bankDay"]))

        return {
            "currentWorkDay": current_work_day,
            "bankDay": bank_day,
            "rows": today_rows,
            "missingRows": missing_rows,
            "rowCount": len(today_rows),
            "missingCount": len(missing_rows),
            "filenamesWithMissing": len(filenames_with_missing),
        }
    finally:
        conn.close()


@app.get("/duplicatecheck/spreadsheet")
def get_duplicatecheck_spreadsheet():
    current_work_day = normalize_mmddyyyy(get_current_work_day() or "")
    if not current_work_day:
        raise HTTPException(status_code=400, detail="No current work day is set")

    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT bank_day FROM calendar WHERE paperwork_day = ?",
            (current_work_day,),
        ).fetchone()
        bank_day = normalize_mmddyyyy(row[0]) if row and row[0] else None
        if not bank_day:
            return {
                "currentWorkDay": current_work_day,
                "bankDay": None,
                "rows": [],
                "duplicateCount": 0,
                "duplicateFilenames": 0,
                "duplicateFilenameList": [],
            }

        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT
                e.filename AS filename,
                e.check_number AS edi_check,
                e.check_amount AS edi_amount,
                lb.[Transaction Total] AS lockbox_amount,
                eft.Amount AS eft_amount,
                COALESCE(eft.Date, lb.[Deposit Date]) AS match_date
            FROM EDI e
            LEFT JOIN Lockbox lb
                ON TRIM(e.check_number) = TRIM(lb.[Check Number])
            LEFT JOIN EFT eft
                ON TRIM(e.check_number) = TRIM(eft.CheckNumber)
            WHERE COALESCE(eft.Date, lb.[Deposit Date]) IS NOT NULL
            ORDER BY e.filename, e.check_number
            """
        ).fetchall()

        filtered = [
            row_data
            for row_data in rows
            if normalize_mmddyyyy(row_data["match_date"]) == bank_day
        ]

        filename_counts: dict[str, int] = {}
        for row_data in filtered:
            filename = str(row_data["filename"] or "").strip()
            if filename:
                filename_counts[filename] = filename_counts.get(filename, 0) + 1

        duplicate_filenames = {filename for filename, count in filename_counts.items() if count > 1}

        table_rows = []
        for row_data in filtered:
            filename = str(row_data["filename"] or "").strip()
            if not filename or filename not in duplicate_filenames:
                continue

            table_rows.append(
                {
                    "filename": filename,
                    "ediCheck": str(row_data["edi_check"] or "").strip(),
                    "lockboxAmount": str(row_data["lockbox_amount"] or "").strip(),
                    "eftAmount": str(row_data["eft_amount"] or "").strip(),
                    "date": normalize_mmddyyyy(row_data["match_date"]) or "",
                    "count": filename_counts.get(filename, 0),
                }
            )

        table_rows.sort(key=lambda item: (item["filename"], item["ediCheck"], item["date"]))

        return {
            "currentWorkDay": current_work_day,
            "bankDay": bank_day,
            "rows": table_rows,
            "duplicateCount": len(table_rows),
            "duplicateFilenames": len(duplicate_filenames),
            "duplicateFilenameList": sorted(duplicate_filenames),
        }
    finally:
        conn.close()


@app.get("/balsheet/workday")
def get_balsheet_workday():
    init_db()
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT current_bank_day, current_work_day, message FROM work_state WHERE id = 1"
        ).fetchone()
    finally:
        conn.close()

    current_bank_day = normalize_mmddyyyy(row[0] if row else None) if row else None
    current_work_day = normalize_mmddyyyy(row[1] if row else None) if row else None
    message = str(row[2] or "") if row else ""
    posting_date = current_work_day or current_bank_day
    if not posting_date:
        posting_date = datetime.today().strftime("%m/%d/%Y")

    return {
        "posting_date": posting_date,
        "current_bank_day": current_bank_day,
        "current_work_day": current_work_day,
        "message": message,
    }


@app.put("/balsheet/workday/message")
def set_balsheet_workday_message(payload: dict | None = None):
    init_db()
    conn = get_conn()
    try:
        payload = payload or {}
        message = str(payload.get("message") or "").strip()
        conn.execute(
            "UPDATE work_state SET message = ? WHERE id = 1",
            (message,),
        )
        conn.commit()
        return {
            "status": "ok",
            "message": message,
        }
    finally:
        conn.close()


@app.get("/balsheet")
def get_balsheet(posting_date: str | None = None):
    init_db()
    conn = get_conn()
    ensure_balsheet_table(conn)

    try:
        conn.row_factory = sqlite3.Row
        normalized_posting_date = normalize_mmddyyyy(posting_date) if posting_date else None
        if normalized_posting_date:
            rows = conn.execute(
                f'SELECT * FROM {_quote_identifier("Balsheet")} WHERE {_quote_identifier("PostingDate")} = ? {_balsheet_order_clause()}',
                (normalized_posting_date,),
            ).fetchall()
        else:
            rows = conn.execute(
                f'SELECT * FROM {_quote_identifier("Balsheet")} {_balsheet_order_clause()}'
            ).fetchall()

        return [_balsheet_row_to_payload(row) for row in rows]
    finally:
        conn.close()


@app.post("/balsheet/import-banking")
def import_balsheet_from_banking(payload: dict | None = None):
    init_db()
    conn = get_conn()
    ensure_balsheet_table(conn)

    payload = payload or {}
    posting_date = normalize_mmddyyyy(payload.get("posting_date")) or normalize_mmddyyyy(get_current_work_day() or "") or normalize_mmddyyyy(get_current_bank_day() or "") or datetime.today().strftime("%m/%d/%Y")
    bank_day = normalize_mmddyyyy(payload.get("bank_day")) or normalize_mmddyyyy(get_current_bank_day() or "")
    if not bank_day:
        raise HTTPException(status_code=400, detail="bank_day is required")

    imported_rows = 0
    removed_rows = 0

    try:
        spreadsheet = build_banking_spreadsheet()

        cur = conn.cursor()
        cur.execute(
            f'DELETE FROM {_quote_identifier("Balsheet")} WHERE {_quote_identifier("PostingDate")} = ? AND {_quote_identifier("EntryID")} LIKE ?',
            (posting_date, "BANK-%"),
        )
        removed_rows = cur.rowcount if cur.rowcount is not None else 0

        for group in spreadsheet.get("groups", []):
            source = str(group.get("source") or "")
            type_value = "EFT" if source == "EFT" else "Lockbox"
            rows = group.get("rows", [])
            if not isinstance(rows, list):
                continue

            for row in rows:
                if not isinstance(row, dict):
                    continue

                row_date = normalize_mmddyyyy(row.get("date")) or ""
                if row_date != bank_day:
                    continue

                edi_value = str(row.get("edi", "") or "").strip().upper()
                poster_value = "Raul" if edi_value == "Y" else "Nick"

                entry = {
                    "entry_id": f'BANK-{source}-{row.get("id")}',
                    "posting_date": posting_date,
                    "type": type_value,
                    "amount": row.get("amount", 0),
                    "payer": row.get("payer", ""),
                    "check_number": row.get("checkNumber", ""),
                    "edi": row.get("edi", ""),
                    "poster": poster_value,
                    "eob": "",
                    "unposted": 0,
                    "misc": 0,
                    "misc_type": "",
                    "notes": "",
                    "nick": 0,
                    "raul": 0,
                    "needs": "",
                    "from_date": "",
                    "to_date": "",
                }
                _balsheet_insert_or_replace(conn, entry)
                imported_rows += 1

        conn.commit()
        return {
            "status": "ok",
            "postingDate": posting_date,
            "rowsImported": imported_rows,
            "rowsRemoved": removed_rows,
        }
    finally:
        conn.close()


@app.delete("/balsheet")
def clear_balsheet(posting_date: str | None = None):
    init_db()
    normalized_posting_date = normalize_mmddyyyy(posting_date or "")
    if not normalized_posting_date:
        raise HTTPException(status_code=400, detail="posting_date is required")

    conn = get_conn()
    ensure_balsheet_table(conn)

    try:
        cur = conn.cursor()
        cur.execute(
            f'DELETE FROM {_quote_identifier("Balsheet")} WHERE {_quote_identifier("PostingDate")} = ?',
            (normalized_posting_date,),
        )
        deleted_rows = cur.rowcount if cur.rowcount is not None else 0
        conn.commit()
        return {
            "status": "ok",
            "postingDate": normalized_posting_date,
            "rowsDeleted": deleted_rows,
        }
    finally:
        conn.close()


@app.get("/balsheet/notes")
def get_balsheet_notes(post_date: str | None = None):
    init_db()
    conn = get_conn()
    ensure_balsheet_notes_table(conn)

    try:
        conn.row_factory = sqlite3.Row
        normalized_post_date = normalize_mmddyyyy(post_date) if post_date else None
        if normalized_post_date:
            rows = conn.execute(
                f'SELECT rowid, {_quote_identifier("post_date")}, {_quote_identifier("notes")}, {_quote_identifier("message")} FROM {_quote_identifier("Balsheet_notes")} WHERE {_quote_identifier("post_date")} = ? ORDER BY rowid ASC',
                (normalized_post_date,),
            ).fetchall()
        else:
            rows = conn.execute(
                f'SELECT rowid, {_quote_identifier("post_date")}, {_quote_identifier("notes")}, {_quote_identifier("message")} FROM {_quote_identifier("Balsheet_notes")} ORDER BY {_quote_identifier("post_date")} ASC, rowid ASC'
            ).fetchall()

        return [_balsheet_note_row_to_payload(row) for row in rows]
    finally:
        conn.close()


@app.post("/balsheet/notes")
def post_balsheet_note(note: dict):
    init_db()
    conn = get_conn()
    ensure_balsheet_notes_table(conn)

    try:
        normalized = _normalize_balsheet_note_payload(note)
        cur = conn.cursor()
        cur.execute(
            f'INSERT INTO {_quote_identifier("Balsheet_notes")} ({_quote_identifier("post_date")}, {_quote_identifier("notes")}, {_quote_identifier("message")}) VALUES (?, ?, ?)',
            (normalized["post_date"], normalized["notes"], normalized["message"]),
        )
        conn.commit()
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            f'SELECT rowid, {_quote_identifier("post_date")}, {_quote_identifier("notes")}, {_quote_identifier("message")} FROM {_quote_identifier("Balsheet_notes")} WHERE rowid = ?',
            (cur.lastrowid,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=500, detail="Failed to save Balsheet note")
        return _balsheet_note_row_to_payload(row)
    finally:
        conn.close()


@app.put("/balsheet/notes/{rowid}")
def put_balsheet_note(rowid: int, note: dict):
    init_db()
    conn = get_conn()
    ensure_balsheet_notes_table(conn)

    try:
        conn.row_factory = sqlite3.Row
        existing = conn.execute(
            f'SELECT rowid, {_quote_identifier("post_date")}, {_quote_identifier("notes")}, {_quote_identifier("message")} FROM {_quote_identifier("Balsheet_notes")} WHERE rowid = ?',
            (rowid,),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Balsheet note not found")

        normalized = _normalize_balsheet_note_payload(note, rowid=rowid)
        conn.execute(
            f'UPDATE {_quote_identifier("Balsheet_notes")} SET {_quote_identifier("post_date")} = ?, {_quote_identifier("notes")} = ?, {_quote_identifier("message")} = ? WHERE rowid = ?',
            (normalized["post_date"], normalized["notes"], normalized["message"], rowid),
        )
        conn.commit()

        row = conn.execute(
            f'SELECT rowid, {_quote_identifier("post_date")}, {_quote_identifier("notes")}, {_quote_identifier("message")} FROM {_quote_identifier("Balsheet_notes")} WHERE rowid = ?',
            (rowid,),
        ).fetchone()
        return _balsheet_note_row_to_payload(row)
    finally:
        conn.close()


@app.delete("/balsheet/notes/{rowid}")
def delete_balsheet_note(rowid: int):
    init_db()
    conn = get_conn()
    ensure_balsheet_notes_table(conn)

    try:
        cur = conn.cursor()
        cur.execute(
            f'DELETE FROM {_quote_identifier("Balsheet_notes")} WHERE rowid = ?',
            (rowid,),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Balsheet note not found")
        conn.commit()
        return {"status": "ok", "rowid": rowid}
    finally:
        conn.close()


@app.post("/balsheet")
def post_balsheet(entry: dict):
    init_db()
    conn = get_conn()
    ensure_balsheet_table(conn)

    try:
        entry_id = _balsheet_insert_or_replace(conn, entry)
        conn.commit()
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            f'SELECT * FROM {_quote_identifier("Balsheet")} WHERE {_quote_identifier("EntryID")} = ?',
            (entry_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=500, detail="Failed to save Balsheet entry")
        return _balsheet_row_to_payload(row)
    finally:
        conn.close()


@app.post("/balsheet/bulk")
def post_balsheet_bulk(payload: dict):
    init_db()
    conn = get_conn()
    ensure_balsheet_table(conn)

    entries = payload.get("entries", [])
    source_attachment_id = payload.get("source_attachment_id")
    if not isinstance(entries, list):
        raise HTTPException(status_code=400, detail="entries must be a list")

    inserted = 0
    try:
        for entry in entries:
            _balsheet_insert_or_replace(conn, entry if isinstance(entry, dict) else {})
            inserted += 1
        conn.commit()
        return {
            "status": "ok",
            "rowsImported": inserted,
            "sourceAttachmentId": source_attachment_id,
        }
    finally:
        conn.close()


@app.put("/balsheet/{entry_id}")
def put_balsheet_entry(entry_id: str, entry: dict):
    init_db()
    conn = get_conn()
    ensure_balsheet_table(conn)

    try:
        conn.row_factory = sqlite3.Row
        existing = conn.execute(
            f'SELECT * FROM {_quote_identifier("Balsheet")} WHERE {_quote_identifier("EntryID")} = ?',
            (entry_id,),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Balsheet entry not found")

        normalized = _normalize_balsheet_payload(entry, entry_id=entry_id)
        set_clause = ", ".join(f'{_quote_identifier(name)} = ?' for name, _ in BALSHEET_TABLE_COLUMNS[1:])
        conn.execute(
            f'UPDATE {_quote_identifier("Balsheet")} SET {set_clause} WHERE {_quote_identifier("EntryID")} = ?',
            tuple(normalized[name] for name, _ in BALSHEET_TABLE_COLUMNS[1:]) + (entry_id,),
        )
        conn.commit()

        row = conn.execute(
            f'SELECT * FROM {_quote_identifier("Balsheet")} WHERE {_quote_identifier("EntryID")} = ?',
            (entry_id,),
        ).fetchone()
        return _balsheet_row_to_payload(row)
    finally:
        conn.close()


@app.delete("/balsheet/{entry_id}")
def delete_balsheet_entry(entry_id: str):
    init_db()
    conn = get_conn()
    ensure_balsheet_table(conn)

    try:
        cur = conn.cursor()
        cur.execute(
            f'DELETE FROM {_quote_identifier("Balsheet")} WHERE {_quote_identifier("EntryID")} = ?',
            (entry_id,),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Balsheet entry not found")
        conn.commit()
        return {"status": "ok", "entry_id": entry_id}
    finally:
        conn.close()


# ------------------------------------------------------------
# NEXT PENDING FILE
# ------------------------------------------------------------
@app.get("/attachments/{attachment_id}/next")
def get_next(attachment_id: int):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, filename, snapshot_path, review_status
        FROM imported_files
        WHERE review_status = 'Pending' AND id > ?
        ORDER BY id ASC
        LIMIT 1
    """, (attachment_id,))

    row = cur.fetchone()
    conn.close()

    if not row:
        return {"done": True}

    return {
        "id": row[0],
        "filename": row[1],
        "snapshot": row[2],
        "status": row[3],
        "done": False
    }


# ------------------------------------------------------------
# SNAPSHOT IMAGE
# ------------------------------------------------------------
@app.get("/attachments/{attachment_id}/snapshot")
def get_snapshot(attachment_id: int):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT snapshot_path FROM imported_files WHERE id = ?", (attachment_id,))
    row = cur.fetchone()
    conn.close()

    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    snapshot_path = row[0]

    if not os.path.exists(snapshot_path):
        raise HTTPException(status_code=404, detail="Snapshot file missing")

    return FileResponse(snapshot_path)


# ------------------------------------------------------------
# APPROVE FILE
# ------------------------------------------------------------
@app.post("/attachments/{attachment_id}/approve")
def approve_attachment(attachment_id: int):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        UPDATE imported_files
        SET review_status = 'Approved'
        WHERE id = ?
    """, (attachment_id,))

    conn.commit()
    conn.close()

    return {"status": "approved", "id": attachment_id}


# ------------------------------------------------------------
# REJECT FILE
# ------------------------------------------------------------
@app.post("/attachments/{attachment_id}/reject")
def reject_attachment(attachment_id: int):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        UPDATE imported_files
        SET review_status = 'Rejected'
        WHERE id = ?
    """, (attachment_id,))

    conn.commit()
    conn.close()

    return {"status": "rejected", "id": attachment_id}


@app.get("/sites")
def get_sites():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT id, name, description, active FROM sites ORDER BY name;")
    rows = cur.fetchall()

    conn.close()

    return [
        {
            "id": row[0],
            "name": row[1],
            "description": row[2],
            "active": row[3],
        }
        for row in rows
    ]


@app.post("/sites")
def add_site(site: dict):
    name = site.get("name")
    description = site.get("description", "")

    if not name:
        raise HTTPException(status_code=400, detail="Site name is required")

    conn = get_conn()
    cur = conn.cursor()

    try:
        cur.execute(
            "INSERT INTO sites (name, description, active) VALUES (?, ?, 1);",
            (name, description),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Site already exists")

    conn.close()
    return {"status": "ok", "message": "Site added"}


@app.put("/sites/{site_id}")
def update_site(site_id: int, site: dict):
    name = site.get("name")
    description = site.get("description")
    active = site.get("active")

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT id FROM sites WHERE id = ?;", (site_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Site not found")

    cur.execute(
        "UPDATE sites SET name = ?, description = ?, active = ? WHERE id = ?;",
        (name, description, active, site_id),
    )

    conn.commit()
    conn.close()

    return {"status": "ok", "message": "Site updated"}


@app.delete("/sites/{site_id}")
def delete_site(site_id: int):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT id FROM sites WHERE id = ?;", (site_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Site not found")

    cur.execute("DELETE FROM sites WHERE id = ?;", (site_id,))
    conn.commit()
    conn.close()

    return {"status": "ok", "message": "Site deleted"}
