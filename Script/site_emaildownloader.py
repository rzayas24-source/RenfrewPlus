#!/usr/bin/env python3

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
import sys

import win32com.client

from db import get_conn   # dynamic DB connection

DOWNLOAD_DIR = r"C:\Renfrew\Workflow\4.Emails"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)


def normalize_outlook_datetime(dt):
    try:
        return dt.replace(tzinfo=None)
    except Exception:
        return dt


def batch_label_for(received_dt):
    return received_dt.strftime("%m.%d.%y")


def batch_date_for(received_dt):
    return received_dt.strftime("%Y-%m-%d")


def prefixed_filename(batch_label, filename):
    return f"{batch_label}-{filename}"


def make_unique_path(folder, filename):
    base, ext = os.path.splitext(filename)
    candidate = filename
    counter = 1

    while os.path.exists(os.path.join(folder, candidate)):
        candidate = f"{base}_{counter}{ext}"
        counter += 1

    return os.path.join(folder, candidate), candidate


def insert_into_db(email_id, original_filename, saved_name, saved_path, note, batch_label, received_dt):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO imported_files
        (filename, moved_to, processed_at, review_status, snapshot_path, batch_id, batch_date, email_id, original_filename, download_notes, source_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            saved_name,
            saved_path,
            received_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "Pending",
            None,
            batch_label,
            batch_date_for(received_dt),
            email_id,
            original_filename,
            note,
            "email",
        ),
    )

    conn.commit()
    conn.close()


def get_outlook_namespace():
    return win32com.client.Dispatch("Outlook.Application").GetNamespace("MAPI")


def list_inbox_folders(outlook=None):
    outlook = outlook or get_outlook_namespace()
    inbox = outlook.GetDefaultFolder(6)
    return [
        {"index": i, "name": folder.Name}
        for i, folder in enumerate(inbox.Folders)
    ]


def get_inbox_folder(outlook, index):
    inbox = outlook.GetDefaultFolder(6)
    return inbox.Folders[index]


def list_dates_in_folder(folder):
    messages = folder.Items
    messages.Sort("[ReceivedTime]", True)

    date_set = set()
    for msg in messages:
        try:
            received = normalize_outlook_datetime(msg.ReceivedTime)
            date_set.add(received.date())
        except Exception:
            pass

    return [d.strftime("%Y-%m-%d") for d in sorted(date_set, reverse=True)]


def move_messages_by_entry_ids(outlook, entry_ids, dest_folder):
    moved = 0
    for entry_id in entry_ids:
        try:
            msg = outlook.GetItemFromID(entry_id)
            msg.Move(dest_folder)
            moved += 1
        except Exception:
            pass
    return moved


def _download_messages(folder, date_filter=None, move_messages_after=False, dest_folder=None, outlook=None):
    messages = folder.Items
    messages.Sort("[ReceivedTime]", True)

    downloaded_files = []
    processed_entry_ids = []
    batch_labels = set()

    for msg in messages:
        try:
            received = normalize_outlook_datetime(msg.ReceivedTime)
        except Exception:
            continue

        if date_filter and received.date() != date_filter:
            continue

        processed_entry_ids.append(msg.EntryID)
        email_id = msg.EntryID
        batch_label = batch_label_for(received)
        batch_labels.add(batch_label)

        if msg.Attachments.Count == 0:
            body = msg.Body
            filename = f"{email_id}.txt"
            saved_name = prefixed_filename(batch_label, filename)
            path, actual_name = make_unique_path(DOWNLOAD_DIR, saved_name)

            with open(path, "w", encoding="utf-8") as handle:
                handle.write(body)

            insert_into_db(
                email_id,
                filename,
                actual_name,
                path,
                "No attachment - saved body text",
                batch_label,
                received,
            )
            downloaded_files.append(path)
            continue

        for att in msg.Attachments:
            filename = att.FileName
            saved_name = prefixed_filename(batch_label, filename)
            save_path, actual_name = make_unique_path(DOWNLOAD_DIR, saved_name)
            att.SaveAsFile(save_path)

            insert_into_db(
                email_id,
                filename,
                actual_name,
                save_path,
                "",
                batch_label,
                received,
            )
            downloaded_files.append(save_path)

    moved_count = 0
    if move_messages_after and dest_folder is not None:
        mover = outlook or get_outlook_namespace()
        moved_count = move_messages_by_entry_ids(mover, processed_entry_ids, dest_folder)

    return {
        "downloaded_count": len(downloaded_files),
        "downloaded_files": downloaded_files,
        "processed_count": len(processed_entry_ids),
        "moved_count": moved_count,
        "batch_labels": sorted(batch_labels),
        "processed_entry_ids": processed_entry_ids,
    }


def download_emails(folder_index, date_value=None, move_messages_after=False, dest_folder_index=None):
    outlook = get_outlook_namespace()
    folder = get_inbox_folder(outlook, int(folder_index))

    date_filter = None
    if date_value:
        date_filter = datetime.strptime(str(date_value), "%Y-%m-%d").date()

    dest_folder = None
    if move_messages_after and dest_folder_index is not None:
        dest_folder = get_inbox_folder(outlook, int(dest_folder_index))

    return _download_messages(
        folder,
        date_filter=date_filter,
        move_messages_after=move_messages_after,
        dest_folder=dest_folder,
        outlook=outlook,
    )


def download_emails_cli():
    outlook = get_outlook_namespace()

    folders = list_inbox_folders(outlook)
    print("\nFolders under Inbox:")
    for folder in folders:
        print(f"{folder['index'] + 1}. {folder['name']}")

    folder_choice = input("\nEnter folder number: ").strip()
    folder = get_inbox_folder(outlook, int(folder_choice) - 1)

    sorted_dates = list_dates_in_folder(folder)
    print("\nAvailable Dates in This Folder:")
    for i, date_value in enumerate(sorted_dates):
        print(f"{i + 1}. {date_value}")

    choice = input("\nChoose a date number (or press Enter for ALL dates): ").strip()
    date_filter = None
    if choice:
        date_filter = datetime.strptime(sorted_dates[int(choice) - 1], "%Y-%m-%d").date()

    result = _download_messages(folder, date_filter=date_filter, outlook=outlook)
    print("\nDownloaded:", result["downloaded_files"])

    while True:
        confirm = input("\nMove these emails to another folder? (Y/N): ").strip().upper()
        if confirm == "Y":
            print("\nSelect destination folder:")
            for folder_info in folders:
                print(f"{folder_info['index'] + 1}. {folder_info['name']}")
            dest_choice = input("\nEnter folder number: ").strip()
            dest_folder = get_inbox_folder(outlook, int(dest_choice) - 1)
            moved = move_messages_by_entry_ids(outlook, result["processed_entry_ids"], dest_folder)
            print(f"\nMoved {moved} emails to: {dest_folder.Name}")
            input("\nPress Enter to exit...")
            break
        if confirm == "N":
            print("\nEmails were NOT moved.")
            input("\nPress Enter to exit...")
            break
        print("Invalid choice. Please type Y or N.")

    return result["downloaded_files"]


def _write_json(path, payload):
    Path(path).write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Email downloader helper")
    subparsers = parser.add_subparsers(dest="command")

    folders_parser = subparsers.add_parser("folders")
    folders_parser.add_argument("--output", required=True)

    dates_parser = subparsers.add_parser("dates")
    dates_parser.add_argument("--folder-index", required=True, type=int)
    dates_parser.add_argument("--output", required=True)

    run_parser = subparsers.add_parser("run")
    run_parser.add_argument("--folder-index", required=True, type=int)
    run_parser.add_argument("--date-value", default=None)
    run_parser.add_argument("--move-messages-after", action="store_true")
    run_parser.add_argument("--dest-folder-index", type=int, default=None)
    run_parser.add_argument("--output", required=True)

    args = parser.parse_args(argv)

    if args.command == "folders":
        _write_json(args.output, list_inbox_folders())
        return 0

    if args.command == "dates":
        outlook = get_outlook_namespace()
        folder = get_inbox_folder(outlook, args.folder_index)
        _write_json(args.output, list_dates_in_folder(folder))
        return 0

    if args.command == "run":
        result = download_emails(
            folder_index=args.folder_index,
            date_value=args.date_value,
            move_messages_after=args.move_messages_after,
            dest_folder_index=args.dest_folder_index,
        )
        result.pop("processed_entry_ids", None)
        _write_json(args.output, result)
        return 0

    download_emails_cli()
    return 0


if __name__ == "__main__":
    sys.exit(main())
