from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from threading import RLock
from typing import Any

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.json"
_CONFIG_LOCK = RLock()
_CONFIG_CACHE: dict[str, Any] | None = None
_CONFIG_MTIME: float | None = None


def _workflow_root() -> Path:
    return BASE_DIR.parent.resolve()


def default_config() -> dict[str, Any]:
    workflow_root = Path("..")
    return {
        "workflow_root": str(workflow_root),
        "db_path": str(workflow_root / "database.db"),
        "emails_folder": str(workflow_root / "4.Emails"),
        "snapshots_folder": str(workflow_root / "snapshots"),
        "flywire_storage_root": str(workflow_root / "Import_Flywire"),
        "trn_folder": str(workflow_root / "1.TRN"),
        "era_folder": str(workflow_root / "2.ERA"),
        "html_folder": str(workflow_root / "3.HTML"),
        "tooling": {
            "poppler_bins": [
                "poppler/Library/bin",
            ],
            "fonts": {
                "regular": "",
                "alternate": "",
            },
        },
        "ui": {
            "navigation": {
                "attachments": {
                    "label": "Pending",
                    "meta": "Pending queue",
                },
                "batches": {
                    "label": "Batches",
                    "meta": "Batch workspace",
                },
                "site_review": {
                    "label": "Site Review",
                    "meta": "Site review",
                },
            },
            "batches": {
                "sidebarCopy": "A calm pending-items console for moving through day-based review batches.",
                "heroKicker": "Batches",
                "heroSubtitle": "Review the day groups, open a batch, and step straight into the attachment flow.",
                "statusPill": "Review batches",
                "statusTitle": "One day, one bundle",
                "statusText": "Each day group opens the matching attachment queue and stays tied to that batch.",
                "sidebarCardLabel": "Today",
                "sidebarCardMeta": "No pending work found.",
            },
            "siteReview": {
                "sidebarCopy": "A unified history workspace for approved, rejected, and complete batch views.",
                "heroKicker": "Site review",
                "views": {
                    "approved": {
                        "label": "Approved",
                        "detail": "Rows that were approved and sent forward.",
                    },
                    "rejected": {
                        "label": "Rejected",
                        "detail": "Rows that were rejected with notes.",
                    },
                    "complete": {
                        "label": "Complete",
                        "detail": "The full batch history in the order it came together.",
                    },
                },
                "heroSubtitle": {
                    "approved": "Review only the approved records while keeping the same shell and layout.",
                    "rejected": "Review only the rejected records while keeping the same shell and layout.",
                    "complete": "Review the full batch history from first arrival to final outcome, all in one place.",
                },
                "heroStatusTitle": {
                    "approved": "approved record",
                    "rejected": "rejected record",
                    "complete": "records in history",
                },
                "heroStatusText": {
                    "approved": "The table below shows only approved records, using the same structure as the other views.",
                    "rejected": "The table below shows only rejected records, using the same structure as the other views.",
                    "complete": "The timeline below groups records by batch so you can see how each file moved through the workflow.",
                },
                "sectionTitle": {
                    "approved": "See only approved rows",
                    "rejected": "See only rejected rows",
                    "complete": "See the full batch timeline",
                },
                "sectionMeta": {
                    "approved": "The same layout stays in place while the rows are filtered by status.",
                    "rejected": "The same layout stays in place while the rows are filtered by status.",
                    "complete": "Rows stay grouped by batch so you can trace the full path of each file.",
                },
            },
        },
    }


def _merge_dict(base: Any, override: Any) -> Any:
    if isinstance(base, dict):
        result = deepcopy(base)
        if isinstance(override, dict):
            for key, value in override.items():
                result[key] = _merge_dict(result.get(key), value)
        elif override is not None:
            return deepcopy(override)
        return result

    if isinstance(base, list):
        return deepcopy(override if override is not None else base)

    return deepcopy(override if override is not None else base)


def _load_raw_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        return {}

    try:
        loaded = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        return loaded if isinstance(loaded, dict) else {}
    except Exception:
        return {}


def load_config(force: bool = False) -> dict[str, Any]:
    global _CONFIG_CACHE, _CONFIG_MTIME

    with _CONFIG_LOCK:
        current_mtime = CONFIG_PATH.stat().st_mtime if CONFIG_PATH.exists() else None
        if not force and _CONFIG_CACHE is not None and _CONFIG_MTIME == current_mtime:
            return deepcopy(_CONFIG_CACHE)

        loaded = _merge_dict(default_config(), _load_raw_config())
        _CONFIG_CACHE = loaded
        _CONFIG_MTIME = current_mtime
        return deepcopy(loaded)


def save_config(updated: dict[str, Any]) -> dict[str, Any]:
    global _CONFIG_CACHE, _CONFIG_MTIME

    if not isinstance(updated, dict):
        raise TypeError("Config payload must be a dictionary.")

    with _CONFIG_LOCK:
        current = load_config(force=True)
        merged = _merge_dict(current, updated)
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = CONFIG_PATH.with_suffix(".json.tmp")
        tmp_path.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        tmp_path.replace(CONFIG_PATH)
        _CONFIG_CACHE = merged
        _CONFIG_MTIME = CONFIG_PATH.stat().st_mtime if CONFIG_PATH.exists() else None
        return deepcopy(merged)


def resolve_path(
    config: dict[str, Any],
    key: str,
    fallback: Path,
    *,
    relative_to: Path | None = None,
) -> str:
    value = config.get(key)
    candidate = value if isinstance(value, str) and value.strip() else str(fallback)
    path = Path(candidate).expanduser()
    if path.is_absolute():
        return str(path.resolve())

    base = relative_to or CONFIG_PATH.parent
    return str((base / path).resolve())
