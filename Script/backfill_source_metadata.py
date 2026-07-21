#!/usr/bin/env python3

from datetime import datetime

from db import get_conn
from source_table_schema import ensure_source_table_columns, refresh_source_table_mirrors


TABLES = [
    ("EDI", "id", "EDI"),
    ("EFT", "rowid", "EFT"),
    ("Lockbox", "id", "LBX"),
]


def _is_blank(value):
    return value is None or str(value).strip() == ""


def backfill_source_metadata():
    conn = get_conn()
    ensure_source_table_columns(conn)

    backfill_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    summary = []

    for table_name, order_column, prefix in TABLES:
        rows = conn.execute(
            f"""
            SELECT rowid, batchnum, transnum, timestamp
            FROM {table_name}
            ORDER BY {order_column} ASC, rowid ASC
            """
        ).fetchall()

        trans_seq = 1
        batch_updates = 0
        trans_updates = 0
        ts_updates = 0

        for row in rows:
            rowid = row[0]
            updates = {}

            if _is_blank(row[1]):
                updates["batchnum"] = "1"
                batch_updates += 1

            if _is_blank(row[2]):
                updates["transnum"] = f"{prefix}-{trans_seq:06d}"
                trans_seq += 1
                trans_updates += 1

            if _is_blank(row[3]):
                updates["timestamp"] = backfill_timestamp
                ts_updates += 1

            if updates:
                set_clause = ", ".join(f'"{col}" = ?' for col in updates)
                params = list(updates.values()) + [rowid]
                conn.execute(
                    f"UPDATE {table_name} SET {set_clause} WHERE rowid = ?",
                    params,
                )

        summary.append((table_name, len(rows), batch_updates, trans_updates, ts_updates))

    conn.commit()
    refresh_source_table_mirrors(conn)
    conn.close()

    print(f"Backfill timestamp: {backfill_timestamp}")
    for table_name, total_rows, batch_updates, trans_updates, ts_updates in summary:
        print(
            f"{table_name}: rows={total_rows}, "
            f"batchnum_filled={batch_updates}, transnum_filled={trans_updates}, "
            f"timestamp_filled={ts_updates}"
        )


if __name__ == "__main__":
    backfill_source_metadata()
