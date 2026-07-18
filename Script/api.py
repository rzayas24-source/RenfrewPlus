import os
import sqlite3
from datetime import datetime
from collections import defaultdict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from system_calendar_core import (
    add_days,
    advance_current_work_day,
    build_from,
    delete_days,
    get_current_work_day,
    init_db,
    normalize_mmddyyyy,
    set_current_work_day,
    setup,
)

DB_PATH = r"C:\Renfrew\Workflow\database.db"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_conn():
    return sqlite3.connect(DB_PATH)


def _quote_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


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

    current_bank_day = None
    current_sort = _parse_calendar_date(current_work_day) if current_work_day else None
    next_open_work_day = None

    for row in rows:
        if current_work_day and row["paperworkDay"] == current_work_day:
            current_bank_day = row["bankDay"]
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
def get_admin_table_rows(table_name: str, limit: int = 100):
    conn = get_conn()

    if not _table_exists(conn, table_name):
        conn.close()
        raise HTTPException(status_code=404, detail="Table not found")

    safe_limit = max(1, min(int(limit or 100), 500))
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

    cur.execute(f"SELECT rowid, * FROM {_quote_identifier(table_name)} LIMIT ?", (safe_limit,))
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
# PREVIOUS PENDING FILE
# ------------------------------------------------------------
@app.get("/attachments/{attachment_id}/prev")
def get_prev(attachment_id: int):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, filename, snapshot_path, review_status
        FROM imported_files
        WHERE review_status = 'Pending' AND id < ?
        ORDER BY id DESC
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


@app.post("/queue/{attachment_id}/approve")
def approve_queue_item(attachment_id: int):
    return approve_attachment(attachment_id)


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


@app.post("/queue/{attachment_id}/reject")
def reject_queue_item(attachment_id: int):
    return reject_attachment(attachment_id)


# ------------------------------------------------------------
# RESET ALL TO PENDING
# ------------------------------------------------------------
@app.post("/reset")
def reset_all():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        UPDATE imported_files
        SET review_status = 'Pending'
    """)

    conn.commit()
    conn.close()

    return {"status": "reset_all"}


# ------------------------------------------------------------
# RESET NEWEST DAY (IF YOU USE DATES)
# ------------------------------------------------------------
@app.post("/reset/newest-day")
def reset_newest_day():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT MAX(as_of_date) FROM imported_files")
    newest = cur.fetchone()[0]

    if newest:
        cur.execute("""
            UPDATE imported_files
            SET review_status = 'Pending'
            WHERE as_of_date = ?
        """, (newest,))
        conn.commit()

    conn.close()
    return {"status": "reset_newest_day", "date": newest}
from sites_api import router as sites_router
app.include_router(sites_router)
