from __future__ import annotations

import math
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


def _is_matched(status):
    if status is None:
        return False
    return str(status).strip().upper().startswith("MATCHED")


def _matched_status_value(source="AUTO"):
    tag = str(source or "AUTO").strip().upper()
    if tag not in {"AUTO", "MANUAL"}:
        tag = "AUTO"
    return f"{MATCHED_STATUS}|{tag}"


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
    exact_check = False
    exact_amount = False
    exact_date = False

    candidate_check = payload["checkNumberNorm"]
    edi_check = edi_norm["checkNumberNorm"]
    candidate_check_close = _normalize_check_for_close_match(payload["checkNumber"])
    edi_check_close = _normalize_check_for_close_match(edi_norm["checkNumber"])

    if candidate_check and candidate_check == edi_check:
        candidate_score += 50
        reasons.append("check")
        exact_check = True
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
        exact_amount = True

    if payload["dateNorm"] and payload["dateNorm"] == edi_norm["dateNorm"]:
        candidate_score += 10
        reasons.append("date")
        exact_date = True

    payload["score"] = candidate_score
    payload["reason"] = "+".join(reasons) if reasons else "review"
    payload["exactMatch"] = exact_check and exact_amount and exact_date
    payload["strongMatch"] = candidate_score >= 75
    payload["closeMatch"] = 75 <= candidate_score < 100
    return payload


def _best_candidate(candidates):
    if not candidates:
        return None
    return sorted(candidates, key=lambda item: (-item["score"], item["id"]))[0]


def _worklist_sort_key(row, sort_by):
    match_rank = {"N": 0, "P": 1, "Y": 2}
    lockbox_rank = 1 if row.get("lockboxMatchCode") == "Y" else 0
    eft_rank = 1 if row.get("eftMatchCode") == "Y" else 0
    possible_score = int(row.get("possibleMatchScore") or 0)
    edi_id = int(row["edi"]["id"])

    if sort_by == "match":
        return (match_rank.get(row.get("matchCode"), 0), edi_id)
    if sort_by == "lockbox":
        return (lockbox_rank, edi_id)
    if sort_by == "eft":
        return (eft_rank, edi_id)
    if sort_by == "possible":
        return (possible_score, edi_id)
    return (edi_id,)


def _date_year_sql(column_name):
    value = f"TRIM(COALESCE({column_name}, ''))"
    return (
        f"CASE "
        f"WHEN {value} GLOB '[0-9][0-9][0-9][0-9]-*' THEN substr({value}, 1, 4) "
        f"WHEN {value} GLOB '[0-9][0-9][0-9][0-9]/*' THEN substr({value}, 1, 4) "
        f"ELSE substr({value}, -4) "
        f"END"
    )


def _build_edi_visibility_where(show_matched=True, show_unmatched=True, latest_year_only=False, latest_year=None):
    clauses = []

    if not show_matched and not show_unmatched:
        clauses.append("1 = 0")
    elif show_matched and not show_unmatched:
        clauses.append("UPPER(TRIM(matchstatus)) LIKE 'MATCHED%'")
    elif show_unmatched and not show_matched:
        clauses.append("(COALESCE(TRIM(matchstatus), '') = '' OR UPPER(TRIM(matchstatus)) = 'UNMATCHED')")

    if latest_year_only:
        if latest_year is None:
            clauses.append("1 = 0")
        else:
            clauses.append(f"CAST({_date_year_sql('check_date')} AS INTEGER) = {int(latest_year)}")

    if not clauses:
        return ""

    return "WHERE " + " AND ".join(clauses)


def _latest_edi_year(conn):
    cur = conn.cursor()
    row = cur.execute(
        f"""
        SELECT MAX(CAST({_date_year_sql('check_date')} AS INTEGER)) AS latest_year
        FROM EDI
        WHERE TRIM(COALESCE(check_date, '')) != ''
        """
    ).fetchone()
    value = row[0] if row else None
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


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


def build_match_dashboard(
    limit=250,
    revision=None,
    page=1,
    sort_by="edi",
    sort_dir="asc",
    show_matched=True,
    show_unmatched=True,
    latest_year_only=False,
):
    page_size = max(1, min(int(limit or 250), 250))
    current_page = max(1, int(page or 1))
    sort_by = str(sort_by or "edi").strip().lower()
    if sort_by not in {"edi", "match", "lockbox", "eft", "possible"}:
        sort_by = "edi"
    sort_dir = "desc" if str(sort_dir or "asc").strip().lower() == "desc" else "asc"

    conn = get_conn()
    conn.row_factory = sqlite3.Row
    ensure_match_indexes(conn)
    queue_summary, current_revision = _queue_snapshot(conn)
    latest_year = _latest_edi_year(conn)
    visibility_where = _build_edi_visibility_where(
        show_matched=show_matched,
        show_unmatched=show_unmatched,
        latest_year_only=latest_year_only,
        latest_year=latest_year,
    )

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
        f"{visibility_where} ORDER BY CAST(COALESCE(batchnum, '0') AS INTEGER) ASC, id ASC",
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

    matched_eft_rows = _fetch_rows(
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
        "WHERE UPPER(TRIM(matchstatus)) LIKE 'MATCHED%' AND CheckNumber IS NOT NULL AND TRIM(CheckNumber) != ''",
    )

    matched_lockbox_rows = _fetch_rows(
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
        "WHERE UPPER(TRIM(matchstatus)) LIKE 'MATCHED%' AND \"Check Number\" IS NOT NULL AND TRIM(\"Check Number\") != ''",
    )

    eft_index = defaultdict(list)
    lockbox_index = defaultdict(list)
    matched_eft_index = defaultdict(list)
    matched_lockbox_index = defaultdict(list)
    for row in eft_rows:
        norm = normalize_checknum(row.get("CheckNumber"))
        if norm:
            eft_index[norm].append(row)
    for row in lockbox_rows:
        norm = normalize_checknum(row.get("Check Number"))
        if norm:
            lockbox_index[norm].append(row)
    for row in matched_eft_rows:
        norm = normalize_checknum(row.get("CheckNumber"))
        if norm:
            matched_eft_index[norm].append(row)
    for row in matched_lockbox_rows:
        norm = normalize_checknum(row.get("Check Number"))
        if norm:
            matched_lockbox_index[norm].append(row)

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

        all_candidates = eft_candidates + lockbox_candidates
        best_possible = _best_candidate(all_candidates)
        match_status = str(edi_norm.get("matchstatus") or "").strip().upper()
        has_strong_candidate = bool(best_possible and best_possible.get("strongMatch"))
        match_code = "Y" if _is_matched(match_status) else "N"
        possible_match_label = (
            f"review {best_possible['score']}% (c{best_possible['id']})"
            if match_code == "N" and best_possible and has_strong_candidate
            else ""
        )

        worklist.append({
            "edi": edi_norm,
            "eftCandidateCount": len(eft_candidates),
            "lockboxCandidateCount": len(lockbox_candidates),
            "strongCandidateCount": sum(1 for c in eft_candidates + lockbox_candidates if c["strongMatch"]),
            "closeCandidateCount": sum(1 for c in eft_candidates + lockbox_candidates if c["closeMatch"]),
            "hasCheckMatch": bool(check_norm and (eft_candidates or lockbox_candidates)),
            "matchCode": match_code,
            "eftMatchCode": "Y" if matched_eft_index.get(check_norm) else "",
            "lockboxMatchCode": "Y" if matched_lockbox_index.get(check_norm) else "",
            "possibleMatchLabel": possible_match_label,
            "possibleMatchScore": best_possible["score"] if best_possible else None,
        })

    reverse = sort_dir == "desc"
    worklist.sort(key=lambda row: _worklist_sort_key(row, sort_by), reverse=reverse)

    total_rows = len(worklist)
    total_pages = max(1, math.ceil(total_rows / page_size))
    current_page = min(current_page, total_pages)
    start_index = (current_page - 1) * page_size
    end_index = start_index + page_size
    page_rows = worklist[start_index:end_index]

    summary = {
        "ediRows": len(edi_rows),
        "ediMatched": sum(1 for item in worklist if item["matchCode"] == "Y"),
        "ediPossible": sum(1 for item in worklist if item["possibleMatchLabel"]),
        "ediReview": sum(1 for item in worklist if item["matchCode"] == "N" and not item["possibleMatchLabel"]),
        "eftUnmatched": len(eft_rows),
        "lockboxUnmatched": len(lockbox_rows),
    }

    conn.close()
    return {
        "summary": summary,
        "rows": page_rows,
        "changed": revision is None or str(revision).strip() != current_revision,
        "revision": current_revision,
        "page": current_page,
        "pageSize": page_size,
        "totalRows": total_rows,
        "totalPages": total_pages,
        "hasPreviousPage": current_page > 1,
        "hasNextPage": current_page < total_pages,
        "sortBy": sort_by,
        "sortDir": sort_dir,
        "latestYear": latest_year,
        "showMatched": bool(show_matched),
        "showUnmatched": bool(show_unmatched),
        "latestYearOnly": bool(latest_year_only),
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
        WHERE UPPER(TRIM(matchstatus)) LIKE 'MATCHED%'
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
        WHERE UPPER(TRIM(matchstatus)) LIKE 'MATCHED%'
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
        WHERE UPPER(TRIM(matchstatus)) LIKE 'MATCHED%'
        ORDER BY CAST(COALESCE(batchnum, '0') AS INTEGER) DESC, id DESC
        LIMIT ?
        """,
        (safe_limit,),
    ).fetchall()

    matched_eft_rows = conn.execute(
        """
        SELECT rowid AS id, Date, Amount, CheckNumber, Payer, batchnum, transnum, timestamp, matchstatus
        FROM EFT
        WHERE UPPER(TRIM(matchstatus)) LIKE 'MATCHED%'
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
        WHERE UPPER(TRIM(matchstatus)) LIKE 'MATCHED%'
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
    matched_value = _matched_status_value("MANUAL")

    cur.execute('UPDATE EDI SET matchstatus = ? WHERE id = ?', (matched_value, int(edi_id)))

    eft_count = 0
    for row_id in eft_ids:
        cur.execute('UPDATE EFT SET matchstatus = ? WHERE rowid = ?', (matched_value, row_id))
        eft_count += cur.rowcount

    lockbox_count = 0
    for row_id in lockbox_ids:
        cur.execute('UPDATE Lockbox SET matchstatus = ? WHERE rowid = ?', (matched_value, row_id))
        lockbox_count += cur.rowcount

    conn.commit()
    conn.close()

    return {
        "status": "matched",
        "edi_id": int(edi_id),
        "eftMatched": eft_count,
        "lockboxMatched": lockbox_count,
    }


def commit_all_strong_matches(match_source="AUTO"):
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    ensure_match_indexes(conn)
    cur = conn.cursor()
    matched_value = _matched_status_value(match_source)

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
    matched_eft_index = defaultdict(list)
    matched_lockbox_index = defaultdict(list)
    for row in eft_rows:
        norm = normalize_checknum(row.get("CheckNumber"))
        if norm:
            eft_index[norm].append(row)
    for row in lockbox_rows:
        norm = normalize_checknum(row.get("Check Number"))
        if norm:
            lockbox_index[norm].append(row)

    matched_eft_rows = _fetch_rows(
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
        "WHERE UPPER(TRIM(matchstatus)) LIKE 'MATCHED%' AND CheckNumber IS NOT NULL AND TRIM(CheckNumber) != ''",
    )

    matched_lockbox_rows = _fetch_rows(
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
        "WHERE UPPER(TRIM(matchstatus)) LIKE 'MATCHED%' AND \"Check Number\" IS NOT NULL AND TRIM(\"Check Number\") != ''",
    )

    for row in matched_eft_rows:
        norm = normalize_checknum(row.get("CheckNumber"))
        if norm:
            matched_eft_index[norm].append(row)
    for row in matched_lockbox_rows:
        norm = normalize_checknum(row.get("Check Number"))
        if norm:
            matched_lockbox_index[norm].append(row)

    used_edi = set()
    used_eft = set()
    used_lockbox = set()
    edi_count = 0
    eft_count = 0
    lockbox_count = 0

    for row in edi_rows:
        edi_norm = _row_common_payload(row, "EDI")
        check_norm = edi_norm["checkNumberNorm"]

        exact_eft = []
        exact_lockbox = []
        has_record_match = bool(matched_eft_index.get(check_norm) or matched_lockbox_index.get(check_norm))

        for candidate in eft_index.get(check_norm, []):
            if candidate["id"] in used_eft:
                continue
            eft_candidate = _candidate_payload(candidate, "EFT", edi_norm)
            if eft_candidate["exactMatch"]:
                exact_eft.append(eft_candidate)

        for candidate in lockbox_index.get(check_norm, []):
            if candidate["id"] in used_lockbox:
                continue
            lockbox_candidate = _candidate_payload(candidate, "Lockbox", edi_norm)
            if lockbox_candidate["exactMatch"]:
                exact_lockbox.append(lockbox_candidate)

        if not has_record_match and not exact_eft and not exact_lockbox:
            continue

        cur.execute(
            "UPDATE EDI SET matchstatus = ? WHERE id = ? AND (COALESCE(TRIM(matchstatus), '') = '' OR UPPER(TRIM(matchstatus)) = 'UNMATCHED')",
            (matched_value, int(row["id"])),
        )
        if cur.rowcount:
            edi_count += 1
            used_edi.add(row["id"])

        for candidate in exact_eft:
            cur.execute(
                "UPDATE EFT SET matchstatus = ? WHERE rowid = ? AND (COALESCE(TRIM(matchstatus), '') = '' OR UPPER(TRIM(matchstatus)) = 'UNMATCHED')",
                (matched_value, int(candidate["id"])),
            )
            if cur.rowcount:
                eft_count += 1
                used_eft.add(candidate["id"])

        for candidate in exact_lockbox:
            cur.execute(
                'UPDATE Lockbox SET matchstatus = ? WHERE rowid = ? AND (COALESCE(TRIM(matchstatus), \'\') = \'\' OR UPPER(TRIM(matchstatus)) = \'UNMATCHED\')',
                (matched_value, int(candidate["id"])),
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
        "exactMatched": edi_count,
        "strongMatched": edi_count,
    }
