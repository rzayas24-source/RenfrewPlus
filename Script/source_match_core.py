from __future__ import annotations

import sqlite3
from collections import defaultdict
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from db import get_conn
from system_calendar_core import normalize_mmddyyyy


MATCHED_STATUS = "MATCHED"
UNMATCHED_STATUSES = {"", "UNMATCHED", None}


def normalize_checknum(value):
    if value in (None, ""):
        return ""
    text = str(value).strip().upper()
    return "".join(ch for ch in text if ch.isalnum())


def _normalize_check_for_close_match(value):
    return normalize_checknum(value).lstrip("0")


def normalize_amount(value):
    if value in (None, ""):
        return None
    try:
        cleaned = str(value).replace(",", "").strip()
        if cleaned == "":
            return None
        return Decimal(cleaned).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError):
        return None


def _is_unmatched(status):
    if status is None:
        return True
    return str(status).strip().upper() in UNMATCHED_STATUSES


def ensure_match_indexes(conn=None):
    close_conn = False
    if conn is None:
        conn = get_conn()
        close_conn = True

    cur = conn.cursor()
    cur.execute('CREATE INDEX IF NOT EXISTS idx_edi_matchstatus_check ON EDI(matchstatus, check_number)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_edi_check_amount ON EDI(check_number, check_amount)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_eft_matchstatus_check ON EFT(matchstatus, CheckNumber)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_eft_check_amount ON EFT(CheckNumber, Amount)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_lockbox_matchstatus_check ON Lockbox(matchstatus, "Check Number")')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_lockbox_check_amount ON Lockbox("Check Number", "Check Amount")')
    conn.commit()

    if close_conn:
        conn.close()


def _quote_identifier(name):
    return '"' + str(name).replace('"', '""') + '"'


def _fetch_rows(conn, table_name, columns, where_clause=""):
    cur = conn.cursor()
    quoted_columns = [_quote_identifier(column) for column in columns]
    cur.execute(f'SELECT rowid AS id, {", ".join(quoted_columns)} FROM {table_name} {where_clause}')
    return [dict(row) for row in cur.fetchall()]


def _row_common_payload(row, source):
    if source == "EDI":
        raw_date = row.get("check_date")
        raw_check = row.get("check_number")
        raw_amount = row.get("check_amount")
    elif source == "EFT":
        raw_date = row.get("Date")
        raw_check = row.get("CheckNumber")
        raw_amount = row.get("Amount")
    else:
        raw_date = row.get("Deposit Date")
        raw_check = row.get("Check Number")
        raw_amount = row.get("Check Amount")

    return {
        "id": row.get("id"),
        "source": source,
        "checkNumber": raw_check,
        "checkNumberNorm": normalize_checknum(raw_check),
        "amount": raw_amount,
        "amountNorm": str(normalize_amount(raw_amount)) if normalize_amount(raw_amount) is not None else None,
        "date": raw_date,
        "dateNorm": normalize_mmddyyyy(raw_date),
        "batchnum": row.get("batchnum"),
        "transnum": row.get("transnum"),
        "timestamp": row.get("timestamp"),
        "matchstatus": row.get("matchstatus"),
    }


def _candidate_payload(row, source, edi_norm):
    payload = _row_common_payload(row, source)
    candidate_score = 0
    reasons = []

    candidate_check = payload["checkNumberNorm"]
    edi_check = edi_norm["checkNumberNorm"]
    candidate_check_close = _normalize_check_for_close_match(payload["checkNumber"])
    edi_check_close = _normalize_check_for_close_match(edi_norm["checkNumber"])

    if candidate_check and candidate_check == edi_check:
        candidate_score += 50
        reasons.append("check")
    elif candidate_check_close and candidate_check_close == edi_check_close:
        candidate_score += 35
        reasons.append("close-check")
    elif candidate_check_close and edi_check_close and (
        candidate_check_close in edi_check_close or edi_check_close in candidate_check_close
    ):
        candidate_score += 25
        reasons.append("close-check")

    if payload["amountNorm"] and payload["amountNorm"] == edi_norm["amountNorm"]:
        candidate_score += 30
        reasons.append("amount")

    if payload["dateNorm"] and payload["dateNorm"] == edi_norm["dateNorm"]:
        candidate_score += 10
        reasons.append("date")

    payload["score"] = candidate_score
    payload["reason"] = "+".join(reasons) if reasons else "review"
    payload["strongMatch"] = candidate_score >= 80
    payload["closeMatch"] = 35 <= candidate_score < 80
    return payload


def _queue_snapshot(conn):
    cur = conn.cursor()
    summary = {}
    revision_parts = []
    for table_name, summary_key in (("EDI", "ediUnmatched"), ("EFT", "eftUnmatched"), ("Lockbox", "lockboxUnmatched")):
        row = cur.execute(
            f"""
            SELECT COUNT(*) AS row_count, COALESCE(MAX(rowid), 0) AS max_rowid
            FROM {table_name}
            WHERE COALESCE(TRIM(matchstatus), '') = '' OR UPPER(TRIM(matchstatus)) = 'UNMATCHED'
            """
        ).fetchone()
        summary[summary_key] = int(row[0] or 0)
        revision_parts.append(f"{int(row[0] or 0)}:{int(row[1] or 0)}")
    summary["strongCandidates"] = 0
    return summary, "|".join(revision_parts)


def build_match_dashboard(limit=50, revision=None):
    safe_limit = max(1, min(int(limit or 50), 500))
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    ensure_match_indexes(conn)
    queue_summary, current_revision = _queue_snapshot(conn)
    if revision is not None and str(revision).strip() == current_revision:
        conn.close()
        return {
            "summary": queue_summary,
            "rows": [],
            "changed": False,
            "revision": current_revision,
        }

    edi_rows = _fetch_rows(
        conn,
        "EDI",
        [
            "check_date",
            "check_number",
            "check_amount",
            "filename",
            "batchnum",
            "transnum",
            "timestamp",
            "matchstatus",
        ],
        "WHERE COALESCE(TRIM(matchstatus), '') = '' OR UPPER(TRIM(matchstatus)) = 'UNMATCHED' ORDER BY CAST(COALESCE(batchnum, '0') AS INTEGER) ASC, id ASC",
    )
    if len(edi_rows) > safe_limit:
        edi_rows = edi_rows[:safe_limit]

    eft_rows = _fetch_rows(
        conn,
        "EFT",
        [
            "Date",
            "Amount",
            "CheckNumber",
            "Payer",
            "batchnum",
            "transnum",
            "timestamp",
            "matchstatus",
        ],
        "WHERE COALESCE(TRIM(matchstatus), '') = '' OR UPPER(TRIM(matchstatus)) = 'UNMATCHED' ORDER BY CAST(COALESCE(batchnum, '0') AS INTEGER) ASC, id ASC",
    )

    lockbox_rows = _fetch_rows(
        conn,
        "Lockbox",
        [
            "Transaction Number",
            "Status",
            "Note",
            "Transaction Total",
            "Deposit Date",
            "Batch Number",
            "Check Number",
            "Check Amount",
            "Site",
            "Lockbox",
            "Payor",
            "Sequence",
            "Number of Items",
            "batchnum",
            "transnum",
            "timestamp",
            "matchstatus",
        ],
        "WHERE COALESCE(TRIM(matchstatus), '') = '' OR UPPER(TRIM(matchstatus)) = 'UNMATCHED' ORDER BY CAST(COALESCE(batchnum, '0') AS INTEGER) ASC, id ASC",
    )

    eft_index = defaultdict(list)
    lockbox_index = defaultdict(list)
    for row in eft_rows:
        norm = normalize_checknum(row.get("CheckNumber"))
        if norm:
            eft_index[norm].append(row)
    for row in lockbox_rows:
        norm = normalize_checknum(row.get("Check Number"))
        if norm:
            lockbox_index[norm].append(row)

    worklist = []
    for row in edi_rows:
        edi_norm = _row_common_payload(row, "EDI")
        check_norm = edi_norm["checkNumberNorm"]
        eft_candidates = []
        lockbox_candidates = []

        for candidate in eft_index.get(check_norm, []):
            eft_candidate = _candidate_payload(candidate, "EFT", edi_norm)
            if eft_candidate["score"] > 0:
                eft_candidates.append(eft_candidate)

        for candidate in lockbox_index.get(check_norm, []):
            lockbox_candidate = _candidate_payload(candidate, "Lockbox", edi_norm)
            if lockbox_candidate["score"] > 0:
                lockbox_candidates.append(lockbox_candidate)

        if not eft_candidates and not lockbox_candidates:
            continue

        worklist.append({
            "edi": edi_norm,
            "eftCandidateCount": len(eft_candidates),
            "lockboxCandidateCount": len(lockbox_candidates),
            "strongCandidateCount": sum(1 for c in eft_candidates + lockbox_candidates if c["strongMatch"]),
            "closeCandidateCount": sum(1 for c in eft_candidates + lockbox_candidates if c["closeMatch"]),
            "hasCheckMatch": bool(check_norm and (eft_candidates or lockbox_candidates)),
        })

    summary = {
        "ediUnmatched": len(worklist),
        "eftUnmatched": len(eft_rows),
        "lockboxUnmatched": len(lockbox_rows),
        "strongCandidates": sum(1 for item in worklist if item["strongCandidateCount"] > 0),
    }

    conn.close()
    return {
        "summary": summary,
        "rows": worklist,
        "changed": True,
        "revision": current_revision,
    }


def get_match_detail(edi_id):
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    ensure_match_indexes(conn)

    edi_row = conn.execute(
        """
        SELECT rowid AS id, check_date, check_number, check_amount, filename,
               batchnum, transnum, timestamp, matchstatus
        FROM EDI
        WHERE id = ?
        """,
        (edi_id,),
    ).fetchone()

    if not edi_row:
        conn.close()
        return None

    edi_norm = _row_common_payload(dict(edi_row), "EDI")
    check_norm = edi_norm["checkNumberNorm"]

    eft_rows = conn.execute(
        """
        SELECT rowid AS id, Date, Amount, CheckNumber, Payer, batchnum, transnum, timestamp, matchstatus
        FROM EFT
        WHERE (COALESCE(TRIM(matchstatus), '') = '' OR UPPER(TRIM(matchstatus)) = 'UNMATCHED')
          AND CheckNumber IS NOT NULL
          AND TRIM(CheckNumber) != ''
        """,
    ).fetchall()

    lockbox_rows = conn.execute(
        """
        SELECT rowid AS id, "Transaction Number", Status, Note, "Transaction Total",
               "Deposit Date", "Batch Number", "Check Number", "Check Amount",
               Site, Lockbox, Payor, Sequence, "Number of Items",
               batchnum, transnum, timestamp, matchstatus
        FROM Lockbox
        WHERE (COALESCE(TRIM(matchstatus), '') = '' OR UPPER(TRIM(matchstatus)) = 'UNMATCHED')
          AND "Check Number" IS NOT NULL
          AND TRIM("Check Number") != ''
        """,
    ).fetchall()

    eft_candidates = []
    for row in eft_rows:
        candidate = _candidate_payload(dict(row), "EFT", edi_norm)
        if candidate["score"] > 0:
            eft_candidates.append(candidate)

    lockbox_candidates = []
    for row in lockbox_rows:
        candidate = _candidate_payload(dict(row), "Lockbox", edi_norm)
        if candidate["score"] > 0:
            lockbox_candidates.append(candidate)

    matched_eft_rows = conn.execute(
        """
        SELECT rowid AS id, Date, Amount, CheckNumber, Payer, batchnum, transnum, timestamp, matchstatus
        FROM EFT
        WHERE UPPER(TRIM(matchstatus)) = 'MATCHED'
          AND CheckNumber IS NOT NULL
          AND TRIM(CheckNumber) != ''
        """,
    ).fetchall()

    matched_lockbox_rows = conn.execute(
        """
        SELECT rowid AS id, "Transaction Number", Status, Note, "Transaction Total",
               "Deposit Date", "Batch Number", "Check Number", "Check Amount",
               Site, Lockbox, Payor, Sequence, "Number of Items",
               batchnum, transnum, timestamp, matchstatus
        FROM Lockbox
        WHERE UPPER(TRIM(matchstatus)) = 'MATCHED'
          AND "Check Number" IS NOT NULL
          AND TRIM("Check Number") != ''
        """,
    ).fetchall()

    matched_eft = []
    for row in matched_eft_rows:
        candidate = _candidate_payload(dict(row), "EFT", edi_norm)
        if candidate["checkNumberNorm"] == check_norm:
            candidate["reason"] = "matched"
            candidate["strongMatch"] = True
            candidate["closeMatch"] = False
            candidate["score"] = max(candidate["score"], 100)
            matched_eft.append(candidate)

    matched_lockbox = []
    for row in matched_lockbox_rows:
        candidate = _candidate_payload(dict(row), "Lockbox", edi_norm)
        if candidate["checkNumberNorm"] == check_norm:
            candidate["reason"] = "matched"
            candidate["strongMatch"] = True
            candidate["closeMatch"] = False
            candidate["score"] = max(candidate["score"], 100)
            matched_lockbox.append(candidate)

    conn.close()

    return {
        "edi": edi_norm,
        "eftCandidates": sorted(eft_candidates, key=lambda row: (-row["score"], row["id"])),
        "lockboxCandidates": sorted(lockbox_candidates, key=lambda row: (-row["score"], row["id"])),
        "matchedEft": sorted(matched_eft, key=lambda row: (-row["score"], row["id"])),
        "matchedLockbox": sorted(matched_lockbox, key=lambda row: (-row["score"], row["id"])),
    }


def build_match_history(limit=100):
    safe_limit = max(1, min(int(limit or 100), 500))
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    ensure_match_indexes(conn)

    matched_edi_rows = conn.execute(
        """
        SELECT rowid AS id, check_date, check_number, check_amount, filename,
               batchnum, transnum, timestamp, matchstatus
        FROM EDI
        WHERE UPPER(TRIM(matchstatus)) = 'MATCHED'
        ORDER BY CAST(COALESCE(batchnum, '0') AS INTEGER) DESC, id DESC
        LIMIT ?
        """,
        (safe_limit,),
    ).fetchall()

    matched_eft_rows = conn.execute(
        """
        SELECT rowid AS id, Date, Amount, CheckNumber, Payer, batchnum, transnum, timestamp, matchstatus
        FROM EFT
        WHERE UPPER(TRIM(matchstatus)) = 'MATCHED'
          AND CheckNumber IS NOT NULL
          AND TRIM(CheckNumber) != ''
        """,
    ).fetchall()

    matched_lockbox_rows = conn.execute(
        """
        SELECT rowid AS id, "Transaction Number", Status, Note, "Transaction Total",
               "Deposit Date", "Batch Number", "Check Number", "Check Amount",
               Site, Lockbox, Payor, Sequence, "Number of Items",
               batchnum, transnum, timestamp, matchstatus
        FROM Lockbox
        WHERE UPPER(TRIM(matchstatus)) = 'MATCHED'
          AND "Check Number" IS NOT NULL
          AND TRIM("Check Number") != ''
        """,
    ).fetchall()

    rows = []
    for row in matched_edi_rows:
        edi_norm = _row_common_payload(dict(row), "EDI")
        check_norm = edi_norm["checkNumberNorm"]

        matched_eft = []
        for eft_row in matched_eft_rows:
            candidate = _candidate_payload(dict(eft_row), "EFT", edi_norm)
            if candidate["checkNumberNorm"] == check_norm:
                candidate["reason"] = "matched"
                candidate["strongMatch"] = True
                candidate["closeMatch"] = False
                candidate["score"] = max(candidate["score"], 100)
                matched_eft.append(candidate)

        matched_lockbox = []
        for lockbox_row in matched_lockbox_rows:
            candidate = _candidate_payload(dict(lockbox_row), "Lockbox", edi_norm)
            if candidate["checkNumberNorm"] == check_norm:
                candidate["reason"] = "matched"
                candidate["strongMatch"] = True
                candidate["closeMatch"] = False
                candidate["score"] = max(candidate["score"], 100)
                matched_lockbox.append(candidate)

        rows.append(
            {
                "edi": edi_norm,
                "matchedEft": sorted(matched_eft, key=lambda item: (-item["score"], item["id"])),
                "matchedLockbox": sorted(matched_lockbox, key=lambda item: (-item["score"], item["id"])),
            }
        )

    conn.close()
    return {
        "rows": rows,
        "count": len(rows),
    }


def commit_match(edi_id, eft_ids=None, lockbox_ids=None):
    eft_ids = [int(v) for v in (eft_ids or []) if str(v).strip() != ""]
    lockbox_ids = [int(v) for v in (lockbox_ids or []) if str(v).strip() != ""]

    if not eft_ids and not lockbox_ids:
        raise ValueError("At least one EFT or Lockbox row must be selected")

    conn = get_conn()
    cur = conn.cursor()

    cur.execute('UPDATE EDI SET matchstatus = ? WHERE id = ?', (MATCHED_STATUS, int(edi_id)))

    eft_count = 0
    for row_id in eft_ids:
        cur.execute('UPDATE EFT SET matchstatus = ? WHERE rowid = ?', (MATCHED_STATUS, row_id))
        eft_count += cur.rowcount

    lockbox_count = 0
    for row_id in lockbox_ids:
        cur.execute('UPDATE Lockbox SET matchstatus = ? WHERE rowid = ?', (MATCHED_STATUS, row_id))
        lockbox_count += cur.rowcount

    conn.commit()
    conn.close()

    return {
        "status": "matched",
        "edi_id": int(edi_id),
        "eftMatched": eft_count,
        "lockboxMatched": lockbox_count,
    }


def commit_all_strong_matches():
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    ensure_match_indexes(conn)
    cur = conn.cursor()

    edi_rows = _fetch_rows(
        conn,
        "EDI",
        [
            "check_date",
            "check_number",
            "check_amount",
            "filename",
            "batchnum",
            "transnum",
            "timestamp",
            "matchstatus",
        ],
        "WHERE COALESCE(TRIM(matchstatus), '') = '' OR UPPER(TRIM(matchstatus)) = 'UNMATCHED' ORDER BY CAST(COALESCE(batchnum, '0') AS INTEGER) ASC, id ASC",
    )

    eft_rows = _fetch_rows(
        conn,
        "EFT",
        [
            "Date",
            "Amount",
            "CheckNumber",
            "Payer",
            "batchnum",
            "transnum",
            "timestamp",
            "matchstatus",
        ],
        "WHERE COALESCE(TRIM(matchstatus), '') = '' OR UPPER(TRIM(matchstatus)) = 'UNMATCHED' ORDER BY CAST(COALESCE(batchnum, '0') AS INTEGER) ASC, id ASC",
    )

    lockbox_rows = _fetch_rows(
        conn,
        "Lockbox",
        [
            "Transaction Number",
            "Status",
            "Note",
            "Transaction Total",
            "Deposit Date",
            "Batch Number",
            "Check Number",
            "Check Amount",
            "Site",
            "Lockbox",
            "Payor",
            "Sequence",
            "Number of Items",
            "batchnum",
            "transnum",
            "timestamp",
            "matchstatus",
        ],
        "WHERE COALESCE(TRIM(matchstatus), '') = '' OR UPPER(TRIM(matchstatus)) = 'UNMATCHED' ORDER BY CAST(COALESCE(batchnum, '0') AS INTEGER) ASC, id ASC",
    )

    eft_index = defaultdict(list)
    lockbox_index = defaultdict(list)
    for row in eft_rows:
        norm = normalize_checknum(row.get("CheckNumber"))
        if norm:
            eft_index[norm].append(row)
    for row in lockbox_rows:
        norm = normalize_checknum(row.get("Check Number"))
        if norm:
            lockbox_index[norm].append(row)

    used_edi = set()
    used_eft = set()
    used_lockbox = set()
    edi_count = 0
    eft_count = 0
    lockbox_count = 0

    for row in edi_rows:
        edi_norm = _row_common_payload(row, "EDI")
        check_norm = edi_norm["checkNumberNorm"]

        strong_eft = []
        strong_lockbox = []

        for candidate in eft_index.get(check_norm, []):
            if candidate["id"] in used_eft:
                continue
            eft_candidate = _candidate_payload(candidate, "EFT", edi_norm)
            if eft_candidate["strongMatch"]:
                strong_eft.append(eft_candidate)

        for candidate in lockbox_index.get(check_norm, []):
            if candidate["id"] in used_lockbox:
                continue
            lockbox_candidate = _candidate_payload(candidate, "Lockbox", edi_norm)
            if lockbox_candidate["strongMatch"]:
                strong_lockbox.append(lockbox_candidate)

        if not strong_eft and not strong_lockbox:
            continue

        cur.execute(
            "UPDATE EDI SET matchstatus = ? WHERE id = ? AND (COALESCE(TRIM(matchstatus), '') = '' OR UPPER(TRIM(matchstatus)) = 'UNMATCHED')",
            (MATCHED_STATUS, int(row["id"])),
        )
        if cur.rowcount:
            edi_count += 1
            used_edi.add(row["id"])

        for candidate in strong_eft:
            cur.execute(
                "UPDATE EFT SET matchstatus = ? WHERE rowid = ? AND (COALESCE(TRIM(matchstatus), '') = '' OR UPPER(TRIM(matchstatus)) = 'UNMATCHED')",
                (MATCHED_STATUS, int(candidate["id"])),
            )
            if cur.rowcount:
                eft_count += 1
                used_eft.add(candidate["id"])

        for candidate in strong_lockbox:
            cur.execute(
                'UPDATE Lockbox SET matchstatus = ? WHERE rowid = ? AND (COALESCE(TRIM(matchstatus), \'\') = \'\' OR UPPER(TRIM(matchstatus)) = \'UNMATCHED\')',
                (MATCHED_STATUS, int(candidate["id"])),
            )
            if cur.rowcount:
                lockbox_count += 1
                used_lockbox.add(candidate["id"])

    conn.commit()
    conn.close()

    return {
        "status": "matched",
        "ediMatched": edi_count,
        "eftMatched": eft_count,
        "lockboxMatched": lockbox_count,
        "strongMatched": edi_count,
    }
