from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import sqlite3

from db import get_conn
from source_match_core import normalize_checknum
from system_calendar_core import normalize_mmddyyyy


@dataclass(frozen=True)
class BankingRow:
    id: int
    source: str
    date: str
    amount: str
    payer: str
    check_number: str
    edi: str
    sort_key: str


def _parse_sort_key(value):
    normalized = normalize_mmddyyyy(value)
    if not normalized:
        return datetime.max
    try:
        return datetime.strptime(normalized, "%m/%d/%Y")
    except ValueError:
        return datetime.max


def _stringify_amount(value):
    if value in (None, ""):
        return ""
    return str(value).strip()


def _parse_amount(value):
    if value in (None, ""):
        return 0.0
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return 0.0


def _latest_date(values):
    latest = ""
    latest_sort = datetime.min

    for value in values:
        normalized = normalize_mmddyyyy(value) or ""
        if not normalized:
            continue

        sort_key = _parse_sort_key(normalized)
        if sort_key > latest_sort:
            latest_sort = sort_key
            latest = normalized

    return latest


def build_banking_spreadsheet():
    conn = get_conn()
    conn.row_factory = sqlite3.Row

    edi_checks = set()
    edi_dates = []
    for row in conn.execute(
        """
        SELECT check_number, check_date
        FROM EDI
        WHERE check_number IS NOT NULL AND TRIM(check_number) != ''
        """
    ):
        normalized = normalize_checknum(row["check_number"])
        if normalized:
            edi_checks.add(normalized)
        edi_dates.append(row["check_date"])

    groups = []
    summary = []
    summary.append({"source": "EDI", "count": len(edi_checks), "lastDate": _latest_date(edi_dates), "totalAmount": 0.0})

    for source in ("EFT", "Lockbox"):
        if source == "EFT":
            rows = conn.execute(
                """
                SELECT rowid AS id, Date AS date_value, Amount AS amount_value,
                       Payer AS payer_value, CheckNumber AS check_number_value
                FROM EFT
                ORDER BY rowid ASC
                """
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT rowid AS id, "Deposit Date" AS date_value, "Check Amount" AS amount_value,
                       Payor AS payer_value, "Check Number" AS check_number_value
                FROM Lockbox
                ORDER BY rowid ASC
                """
            ).fetchall()

        next_rows = []
        raw_dates = []
        total_amount = 0.0
        for row in rows:
            check_number = str(row["check_number_value"] or "").strip()
            normalized_check = normalize_checknum(check_number)
            raw_date = row["date_value"]
            normalized_date = normalize_mmddyyyy(raw_date) or ""
            raw_dates.append(raw_date)
            total_amount += _parse_amount(row["amount_value"])

            next_rows.append(
                {
                    "id": int(row["id"]),
                    "source": source,
                    "date": normalized_date,
                    "amount": _stringify_amount(row["amount_value"]),
                    "payer": str(row["payer_value"] or "").strip(),
                    "checkNumber": check_number,
                    "edi": "Y" if normalized_check and normalized_check in edi_checks else "",
                    "_sort": _parse_sort_key(raw_date),
                }
            )

        next_rows.sort(key=lambda row: (row["_sort"], row["checkNumber"], row["id"]))
        for row in next_rows:
            row.pop("_sort", None)

        groups.append({"source": source, "rows": next_rows})
        summary.append({"source": source, "count": len(next_rows), "lastDate": _latest_date(raw_dates), "totalAmount": round(total_amount, 2)})

    conn.close()
    return {
        "summary": summary,
        "groups": groups,
    }
