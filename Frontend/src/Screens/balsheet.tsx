import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { API_BASE } from "../config/apiBase";
import {
  clearBalsheet,
  createBalsheetEntry,
  createBalsheetTransfer,
  deleteBalsheetEntry,
  getBalsheet,
  getBalsheetKeyproofReview,
  getBalsheetNotes,
  getImagingBalsheetAssociations,
  getMisc,
  getBalsheetWorkday,
  importBalsheetFromBanking,
  saveBalsheetEntries,
  updateBalsheetEntry,
  upsertBalsheetNoteText,
  upsertBalsheetNoteMessage,
  getBalsheetKeyproofIssues,
  type BalsheetKeyproofReviewResponse,
  type BalsheetKeyproofReviewRow,
  type BalsheetKeyproofIssueResponse,
  type BalsheetEntry,
  type ImagingBalsheetAssociationRow,
  type MiscEntry,
} from "../api/balsheet_api";
import { lookupCalendarBankDay } from "../api/calendar_api";
import { deleteKeyproof } from "../api/keyproof_api";

const weekendHeroMessage = "Weekend";

const columns: Array<{ key: keyof BalsheetEntry; label: string; numeric?: boolean }> = [
  { key: "posting_date", label: "Posting Date" },
  { key: "type", label: "Type" },
  { key: "amount", label: "Amount", numeric: true },
  { key: "payer", label: "Payer" },
  { key: "check_number", label: "Check/CC Number" },
  { key: "edi", label: "EDI" },
  { key: "poster", label: "Poster" },
  { key: "eob", label: "EOB" },
  { key: "unposted", label: "UnPosted", numeric: true },
  { key: "misc", label: "Misc", numeric: true },
  { key: "misc_type", label: "Misc-Type" },
  { key: "notes", label: "Notes" },
  { key: "nick", label: "Nick", numeric: true },
  { key: "raul", label: "Raul", numeric: true },
  { key: "needs", label: "Needs" },
  { key: "from_date", label: "From" },
  { key: "to_date", label: "To" },
];

type SheetColumnKey = "entry_id" | keyof BalsheetEntry | "images";

const sheetColumns: Array<{ key: SheetColumnKey; label: string; numeric?: boolean; sortable?: boolean }> = [
  { key: "entry_id", label: "EntryID" },
  ...columns,
  { key: "images", label: "Images", sortable: false },
];

const defaultColumnWidths: Record<string, number> = {
  entry_id: 130,
  posting_date: 120,
  type: 100,
  amount: 120,
  payer: 180,
  check_number: 150,
  edi: 120,
  poster: 140,
  eob: 160,
  unposted: 120,
  misc: 110,
  misc_type: 150,
  notes: 220,
  nick: 110,
  raul: 110,
  needs: 140,
  from_date: 120,
  to_date: 120,
  images: 110,
};

function parseAmount(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isNearZero(value: number) {
  return Math.abs(value) < 0.005;
}

function roundToCents(value: number) {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value: unknown) {
  return parseAmount(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function derivePosterSplit(row: Pick<BalsheetEntry, "amount" | "unposted" | "misc" | "poster">) {
  const posterAmount = parseAmount(row.amount) - parseAmount(row.unposted) - parseAmount(row.misc);
  const poster = String(row.poster ?? "").trim().toLowerCase();

  return {
    nick: poster === "raul" ? 0 : posterAmount,
    raul: poster === "raul" ? posterAmount : 0,
  };
}

function compareSheetRows(
  left: BalsheetEntry,
  right: BalsheetEntry,
  columnKey: "entry_id" | keyof BalsheetEntry,
  direction: "asc" | "desc"
) {
  const leftValue = columnKey === "entry_id" ? left.entry_id : left[columnKey];
  const rightValue = columnKey === "entry_id" ? right.entry_id : right[columnKey];
  const numericColumns = new Set(["amount", "unposted", "misc", "nick", "raul"]);

  let comparison = 0;
  if (numericColumns.has(columnKey)) {
    comparison = parseAmount(leftValue) - parseAmount(rightValue);
  } else {
    comparison = String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, { sensitivity: "base" });
  }

  if (comparison === 0) {
    comparison = String(left.entry_id ?? "").localeCompare(String(right.entry_id ?? ""), undefined, {
      sensitivity: "base",
    });
  }

  return direction === "asc" ? comparison : -comparison;
}

function splitMiscTypeValues(value: string) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(/\s*\|\s*/)
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );
}

function joinMiscTypeValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).join(" | ");
}

function normalizeMiscTypeOptions(values: string[], currentValue?: string) {
  const merged = new Set(values.map((value) => value.trim()).filter(Boolean));
  for (const value of splitMiscTypeValues(currentValue ?? "")) {
    merged.add(value);
  }
  return Array.from(merged).sort((left, right) => left.localeCompare(right));
}

function normalizeDisplayDate(value: string | null) {
  if (!value) return "";

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[2]}/${isoMatch[3]}/${isoMatch[1]}`;
  }

  return value;
}

function displayDateToIso(value: string | null) {
  if (!value) return "";

  const displayMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (displayMatch) {
    return `${displayMatch[3]}-${displayMatch[1]}-${displayMatch[2]}`;
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return value;
  }

  return "";
}

function isWeekendPostingDate(value: string) {
  const isoValue = displayDateToIso(value);
  if (!isoValue) {
    return false;
  }

  const parsed = new Date(`${isoValue}T00:00:00`);
  const dayOfWeek = parsed.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

function shiftPostingDate(value: string, deltaDays: number) {
  const isoValue = displayDateToIso(value);
  if (!isoValue) {
    return "";
  }

  const [year, month, day] = isoValue.split("-").map((part) => Number.parseInt(part, 10));
  const parsed = new Date(year, month - 1, day);
  parsed.setDate(parsed.getDate() + deltaDays);

  const nextMonth = String(parsed.getMonth() + 1).padStart(2, "0");
  const nextDay = String(parsed.getDate()).padStart(2, "0");
  return `${nextMonth}/${nextDay}/${parsed.getFullYear()}`;
}

function columnIndexToLetters(index: number) {
  let value = index + 1;
  let letters = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }

  return letters;
}

function getPinnedGroupRank(groupKey: string) {
  const normalized = groupKey.trim().toLowerCase();
  if (normalized === "eft") return 0;
  if (normalized === "lockbox") return 1;
  if (normalized.includes("spring lane")) return 2;
  return 3;
}

function compareGroupedKeys(leftKey: string, rightKey: string, sortField: "entry_id" | keyof BalsheetEntry, sortDirection: "asc" | "desc") {
  const leftRank = getPinnedGroupRank(leftKey);
  const rightRank = getPinnedGroupRank(rightKey);

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  if (leftRank < 3) {
    return leftKey.localeCompare(rightKey, undefined, { sensitivity: "base" });
  }

  const direction = sortField === "type" ? sortDirection : "asc";
  const comparison = leftKey.localeCompare(rightKey, undefined, { sensitivity: "base" });
  return direction === "asc" ? comparison : -comparison;
}

function getDisplayedReviewDifference(row: BalsheetKeyproofReviewRow) {
  const transferAdjustment = parseAmount(row.borrowedTransferTotal ?? 0);
  const isSpringLaneSite = /spring lane/i.test(`${row.site || ""} ${row.filename || ""}`);

  if (isSpringLaneSite) {
    return roundToCents((row.springLaneExpectedTotal ?? 0) - (row.springLaneBalsheetTotal ?? 0) + transferAdjustment);
  }

  return roundToCents((row.keyproofTotal ?? 0) - (row.balsheetActualTotal ?? 0) + transferAdjustment);
}

function normalizeImageDay(value: string) {
  return normalizeDisplayDate(value) || value || "";
}

export default function Balsheet() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const day = searchParams.get("day");
  const [postingDate, setPostingDate] = useState(normalizeDisplayDate(day));
  const [currentBankDay, setCurrentBankDay] = useState("");
  const [rows, setRows] = useState<BalsheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(defaultColumnWidths);
  const [activeCell, setActiveCell] = useState<{ rowIndex: number; columnIndex: number } | null>(null);
  const [sortField, setSortField] = useState<"entry_id" | keyof BalsheetEntry>("type");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isEditingSelection, setIsEditingSelection] = useState(false);
  const [selectionDraft, setSelectionDraft] = useState("");
  const [miscTypeOptions, setMiscTypeOptions] = useState<string[]>([]);
  const [sheetLocked, setSheetLocked] = useState(true);
  const [heroMenuOpen, setHeroMenuOpen] = useState(false);
  const [keyproofWorksheetOpen, setKeyproofWorksheetOpen] = useState(false);
  const [balanceBorrowOpen, setBalanceBorrowOpen] = useState(false);
  const [balanceBorrowSourceDate, setBalanceBorrowSourceDate] = useState("");
  const [balanceBorrowLoading, setBalanceBorrowLoading] = useState(false);
  const [balanceBorrowSubmitting, setBalanceBorrowSubmitting] = useState(false);
  const [balanceBorrowError, setBalanceBorrowError] = useState<string | null>(null);
  const [balanceBorrowReview, setBalanceBorrowReview] = useState<BalsheetKeyproofReviewResponse | null>(null);
  const [balanceBorrowSelectedRow, setBalanceBorrowSelectedRow] = useState<BalsheetKeyproofReviewRow | null>(null);
  const [keyproofReviewOpen, setKeyproofReviewOpen] = useState(false);
  const [keyproofReviewLoading, setKeyproofReviewLoading] = useState(false);
  const [keyproofReviewError, setKeyproofReviewError] = useState<string | null>(null);
  const [keyproofReview, setKeyproofReview] = useState<BalsheetKeyproofReviewResponse | null>(null);
  const [keyproofReviewIssues, setKeyproofReviewIssues] = useState<BalsheetKeyproofIssueResponse | null>(null);
  const [documentMarkersEnabled, setDocumentMarkersEnabled] = useState(false);
  const [documentMarkersLoading, setDocumentMarkersLoading] = useState(false);
  const [documentAssociations, setDocumentAssociations] = useState<ImagingBalsheetAssociationRow[]>([]);
  const [heroNote, setHeroNote] = useState("");
  const [heroMessage, setHeroMessage] = useState("");
  const resizeStateRef = useRef<{
    key: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const cellRefs = useRef<Array<Array<HTMLTableCellElement | null>>>([]);
  const selectionInputRef = useRef<HTMLInputElement | null>(null);
  const selectionSelectRef = useRef<HTMLSelectElement | null>(null);
  const inlineCellInputRef = useRef<HTMLInputElement | null>(null);
  const inlineCellSelectRef = useRef<HTMLSelectElement | null>(null);
  const heroMenuWrapRef = useRef<HTMLDivElement | null>(null);
  const cancelInlineEditRef = useRef(false);
  const keyproofWorksheetPanelRef = useRef<HTMLDivElement | null>(null);
  const keyproofReviewPanelRef = useRef<HTMLDivElement | null>(null);
  const keyproofReviewRequestRef = useRef(0);

  const postingDateIso = displayDateToIso(postingDate);
  useEffect(() => {
    if (!postingDate) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextSearchParams.get("day") !== postingDate) {
      nextSearchParams.set("day", postingDate);
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [postingDate, searchParams, setSearchParams]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          amount: acc.amount + parseAmount(row.amount),
          nick: acc.nick + parseAmount(row.nick),
          raul: acc.raul + parseAmount(row.raul),
          unposted: acc.unposted + parseAmount(row.unposted),
          misc: acc.misc + parseAmount(row.misc),
        }),
        { amount: 0, nick: 0, raul: 0, unposted: 0, misc: 0 }
      ),
    [rows]
  );

  const groupedRows = useMemo(() => {
    const groupMap = new Map<string, BalsheetEntry[]>();

    for (const row of rows) {
      const groupKey = String(row.type ?? "").trim() || "Ungrouped";
      const groupRows = groupMap.get(groupKey) ?? [];
      groupRows.push(row);
      groupMap.set(groupKey, groupRows);
    }

    const groupEntries = Array.from(groupMap.entries()).sort(([leftKey], [rightKey]) =>
      compareGroupedKeys(leftKey, rightKey, sortField, sortDirection)
    );

    return groupEntries.map(([groupKey, groupRows]) => ({
      groupKey,
      rows: [...groupRows].sort((left, right) => compareSheetRows(left, right, sortField, sortDirection)),
      totals: groupRows.reduce(
        (acc, row) => ({
          amount: acc.amount + parseAmount(row.amount),
          nick: acc.nick + parseAmount(row.nick),
          raul: acc.raul + parseAmount(row.raul),
          unposted: acc.unposted + parseAmount(row.unposted),
          misc: acc.misc + parseAmount(row.misc),
        }),
        { amount: 0, nick: 0, raul: 0, unposted: 0, misc: 0 }
      ),
    }));
  }, [rows, sortDirection, sortField]);

  const typeTotals = useMemo(
    () =>
      groupedRows.map((group) => ({
        type: group.groupKey,
        amount: group.totals.amount,
        count: group.rows.length,
      })),
    [groupedRows]
  );

  const visibleRows = useMemo(
    () => groupedRows.flatMap((group) => (collapsedGroups.has(group.groupKey) ? [] : group.rows)),
    [collapsedGroups, groupedRows]
  );

  const documentAssociationMap = useMemo(() => {
    const map = new Map<string, ImagingBalsheetAssociationRow>();
    for (const row of documentAssociations) {
      map.set(row.entryId, row);
    }
    return map;
  }, [documentAssociations]);

  const keyproofDifferenceTotal = useMemo(
    () => keyproofReview?.rows.reduce((total, row) => total + getDisplayedReviewDifference(row), 0) ?? 0,
    [keyproofReview]
  );

  const selectedCell = useMemo(() => {
    if (!activeCell) {
      return null;
    }

    const row = visibleRows[activeCell.rowIndex];
    const column = sheetColumns[activeCell.columnIndex];
    if (!row || !column) {
      return null;
    }

    const rawValue =
      column.key === "entry_id"
        ? row.entry_id
        : column.key === "images"
          ? "View images"
          : column.numeric
            ? formatCurrency(row[column.key as keyof BalsheetEntry])
            : String(row[column.key as keyof BalsheetEntry] ?? "");

    return {
      address: `${columnIndexToLetters(activeCell.columnIndex)}${activeCell.rowIndex + 2}`,
      label: column.label,
      value: rawValue,
      rowId: row.entry_id,
      row,
      columnKey: column.key,
      numeric: !!column.numeric,
    };
  }, [activeCell, visibleRows]);

  useEffect(() => {
    if (!selectedCell) {
      setIsEditingSelection(false);
      setSelectionDraft("");
      return;
    }

    if (!isEditingSelection) {
      setSelectionDraft(selectedCell.value ?? "");
    }
  }, [isEditingSelection, selectedCell]);

  useEffect(() => {
    if (isEditingSelection) {
      if (sheetLocked) {
        selectionInputRef.current?.focus();
        selectionInputRef.current?.select();
      } else if (selectedCell?.columnKey === "misc_type") {
        selectionSelectRef.current?.focus();
      } else if (selectedCell?.columnKey === "poster") {
        inlineCellSelectRef.current?.focus();
      } else {
        inlineCellInputRef.current?.focus();
        inlineCellInputRef.current?.select();
      }
    }
  }, [isEditingSelection, selectedCell, sheetLocked]);

  useEffect(() => {
    if (sheetLocked) {
      setIsEditingSelection(false);
    }
  }, [sheetLocked]);

  async function updateSelectedCell(nextValue: string) {
    if (!selectedCell?.rowId || !selectedCell.row) {
      return;
    }

    if (selectedCell.columnKey === "entry_id" || selectedCell.columnKey === "images") {
      return;
    }

    const nextRow: BalsheetEntry = {
      ...selectedCell.row,
      [selectedCell.columnKey]: selectedCell.row[selectedCell.columnKey],
    };

    const writableNextRow = nextRow as unknown as Record<string, unknown>;

    if (selectedCell.numeric) {
      const parsed = Number.parseFloat(nextValue.replace(/[$,]/g, ""));
      writableNextRow[selectedCell.columnKey] = Number.isFinite(parsed) ? parsed : 0;
    } else {
      writableNextRow[selectedCell.columnKey] = nextValue;
    }

    if (["amount", "unposted", "misc", "poster"].includes(String(selectedCell.columnKey))) {
      const split = derivePosterSplit(writableNextRow as Pick<BalsheetEntry, "amount" | "unposted" | "misc" | "poster">);
      writableNextRow.nick = split.nick;
      writableNextRow.raul = split.raul;
    }

    const response = await updateBalsheetEntry(selectedCell.rowId, nextRow);
    setRows((previousRows) =>
      previousRows.map((row) => (row.entry_id === selectedCell.rowId ? response.data : row))
    );
    void loadKeyproofReview();
    if (keyproofReviewOpen) {
      void loadKeyproofReviewIssues();
    }
  }

  function beginInlineCellEdit(rowIndex: number, columnIndex: number) {
    if (sheetLocked) {
      return;
    }

    const row = visibleRows[rowIndex];
    const column = sheetColumns[columnIndex];
    if (!row || !column || column.key === "entry_id" || column.key === "images") {
      return;
    }

    setActiveCell({ rowIndex, columnIndex });
    setSelectionDraft(
      column.numeric ? formatCurrency(row[column.key]) : String(row[column.key] ?? "")
    );
    setIsEditingSelection(true);
    cancelInlineEditRef.current = false;
  }

  async function commitInlineCellEdit(nextValue?: string) {
    if (!selectedCell || sheetLocked) {
      return;
    }

    const valueToSave = nextValue ?? selectionDraft;
    setLoading(true);
    setMessage(null);
    try {
      await updateSelectedCell(valueToSave);
      setError(null);
      setMessage(`Saved ${selectedCell.label} for ${selectedCell.address}.`);
      setIsEditingSelection(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save cell");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectionInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (!isEditingSelection) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void commitInlineCellEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setSelectionDraft(selectedCell?.value ?? "");
      cancelInlineEditRef.current = true;
      setIsEditingSelection(false);
    }
  }

  function handleClearSelectedCell() {
    if (!selectedCell) {
      return;
    }

    if (selectedCell.columnKey === "entry_id" || selectedCell.columnKey === "images") {
      setError(null);
      setMessage("That cell is not editable.");
      return;
    }

    if (sheetLocked) {
      setError(null);
      setMessage("Cell locked.");
      return;
    }

    void (async () => {
      setLoading(true);
      setMessage(null);
      try {
        await updateSelectedCell(selectedCell.numeric ? "0" : "");
        setError(null);
        setMessage(`Cleared ${selectedCell.label} for ${selectedCell.address}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to clear cell");
      } finally {
        setLoading(false);
      }
    })();
  }

  function handleDeleteSelectedRow() {
    const rowId = selectedCell?.rowId;
    if (!rowId) {
      return;
    }

    if (sheetLocked) {
      setError(null);
      setMessage("Cell locked.");
      return;
    }

    if (!window.confirm(`Delete row ${selectedCell.address} (${selectedCell.rowId})?`)) {
      return;
    }

    void (async () => {
      setLoading(true);
      setMessage(null);
      try {
        await deleteBalsheetEntry(rowId);
        setRows((previousRows) => previousRows.filter((row) => row.entry_id !== rowId));
        setActiveCell(null);
        setSelectionDraft("");
        setIsEditingSelection(false);
        void loadKeyproofReview();
        if (keyproofReviewOpen) {
          void loadKeyproofReviewIssues();
        }
        setError(null);
        setMessage(`Deleted row ${rowId}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete row");
      } finally {
        setLoading(false);
      }
    })();
  }

  function focusCell(rowIndex: number, columnIndex: number) {
    const target = cellRefs.current[rowIndex]?.[columnIndex];
    target?.focus();
  }

  function toggleSheetLock() {
    if (sheetLocked) {
      const response = window.prompt('Type "confirm" to unlock the sheet.');
      if (response?.trim().toLowerCase() !== "confirm") {
        setError(null);
        setMessage("Unlock cancelled.");
        return;
      }
    }

    setSheetLocked((current) => !current);
    setError(null);
    setMessage(null);
  }

  async function loadKeyproofReview(targetPostingDate = postingDate) {
    if (!targetPostingDate) {
      setKeyproofReviewError("No posting day is selected.");
      setKeyproofReview(null);
      return;
    }

    const requestId = ++keyproofReviewRequestRef.current;
    setKeyproofReviewLoading(true);
    setKeyproofReviewError(null);

    try {
      const response = await getBalsheetKeyproofReview(targetPostingDate);
      if (requestId !== keyproofReviewRequestRef.current) {
        return;
      }
      setKeyproofReview(response.data);
    } catch (error) {
      if (requestId !== keyproofReviewRequestRef.current) {
        return;
      }
      setKeyproofReview(null);
      setKeyproofReviewError(error instanceof Error ? error.message : "Failed to load keyproof review.");
    } finally {
      if (requestId === keyproofReviewRequestRef.current) {
        setKeyproofReviewLoading(false);
      }
    }
  }

  async function loadKeyproofReviewIssues() {
    setKeyproofReviewLoading(true);
    setKeyproofReviewError(null);

    try {
      const response = await getBalsheetKeyproofIssues();
      setKeyproofReviewIssues(response.data);
    } catch (error) {
      setKeyproofReviewIssues(null);
      setKeyproofReviewError(error instanceof Error ? error.message : "Failed to load keyproof review.");
    } finally {
      setKeyproofReviewLoading(false);
    }
  }

  function openKeyproofReview() {
    setKeyproofWorksheetOpen(false);
    setKeyproofReviewOpen(true);
  }

  function closeKeyproofReview() {
    setKeyproofReviewOpen(false);
  }

  function openKeyproofWorksheet() {
    setKeyproofReviewOpen(false);
    setKeyproofWorksheetOpen(true);
  }

  function closeKeyproofWorksheet() {
    setKeyproofWorksheetOpen(false);
    setBalanceBorrowOpen(false);
  }

  function openBalanceBorrowTrial() {
    const fallbackSourceDate = shiftPostingDate(postingDate || day || "", -1) || postingDate || day || "";
    setKeyproofWorksheetOpen(false);
    setBalanceBorrowError(null);
    setBalanceBorrowReview(null);
    setBalanceBorrowSelectedRow(null);
    setBalanceBorrowSourceDate(fallbackSourceDate);
    setBalanceBorrowOpen(true);
    void loadBalanceBorrowTrial(fallbackSourceDate);
  }

  function openWorksheetImages(row: BalsheetKeyproofReviewRow) {
    const pdfUrl = `${API_BASE}/attachments/${encodeURIComponent(String(row.attachmentId))}/original`;
    const openedWindow = window.open(pdfUrl, "_blank", "noopener,noreferrer");
    if (!openedWindow) {
      setError("Your browser blocked the PDF tab from opening.");
    }
  }

  function openBalsheetEntryImages(row: BalsheetEntry) {
    if (!row.entry_id) {
      setError("This row does not have an entry ID yet.");
      return;
    }

    const params = new URLSearchParams();
    params.set("day", normalizeImageDay(postingDate));
    params.set("entryId", String(row.entry_id));
    const imageUrl = `/view-images?${params.toString()}`;
    const openedWindow = window.open(imageUrl, "_blank", "noopener,noreferrer");
    if (!openedWindow) {
      setError("Your browser blocked the image tab from opening.");
    }
  }

  function closeBalanceBorrowTrial() {
    setBalanceBorrowOpen(false);
    setBalanceBorrowError(null);
    setBalanceBorrowLoading(false);
    setBalanceBorrowSubmitting(false);
  }

  async function loadBalanceBorrowTrial(sourcePostingDate = balanceBorrowSourceDate) {
    const normalizedSourceDate = normalizeDisplayDate(sourcePostingDate || "") || sourcePostingDate || "";
    if (!normalizedSourceDate) {
      setBalanceBorrowReview(null);
      setBalanceBorrowSelectedRow(null);
      setBalanceBorrowError("Select a source date to review balances.");
      return;
    }

    setBalanceBorrowLoading(true);
    setBalanceBorrowError(null);

    try {
      const response = await getBalsheetKeyproofReview(normalizedSourceDate);
      const rows = [...response.data.rows].sort(
        (left, right) => Math.abs(getDisplayedReviewDifference(right)) - Math.abs(getDisplayedReviewDifference(left))
      );
      const nextSelectedRow = rows.find((row) => !isNearZero(getDisplayedReviewDifference(row))) ?? rows[0] ?? null;
      setBalanceBorrowReview(response.data);
      setBalanceBorrowSelectedRow(nextSelectedRow);
      if (!nextSelectedRow) {
        setBalanceBorrowError("No open balances were found on that day.");
      }
    } catch (error) {
      setBalanceBorrowReview(null);
      setBalanceBorrowSelectedRow(null);
      setBalanceBorrowError(error instanceof Error ? error.message : "Failed to load source day balances.");
    } finally {
      setBalanceBorrowLoading(false);
    }
  }

  async function acceptBalanceBorrowTrial() {
    if (!postingDate) {
      setBalanceBorrowError("No target posting day is selected.");
      return;
    }

    if (!balanceBorrowReview || !balanceBorrowSelectedRow) {
      setBalanceBorrowError("Select a source day balance first.");
      return;
    }

    const sourceAmount = getDisplayedReviewDifference(balanceBorrowSelectedRow);
    if (isNearZero(sourceAmount)) {
      setBalanceBorrowError("The selected balance is already at zero.");
      return;
    }

    const appliedAmount = roundToCents(-Math.abs(sourceAmount));

    const confirmed = window.confirm(
      `Apply ${formatCurrency(appliedAmount)} from ${balanceBorrowReview.postingDate} (${balanceBorrowSelectedRow.site}) to ${postingDate}?`
    );
    if (!confirmed) {
      return;
    }

    setBalanceBorrowSubmitting(true);
    setMessage(null);
    try {
      await createBalsheetTransfer({
        source_date: balanceBorrowReview.postingDate,
        target_date: postingDate,
        site: balanceBorrowSelectedRow.site,
        amount: appliedAmount,
        source_entry_id: String(balanceBorrowSelectedRow.attachmentId),
        source_filename: balanceBorrowSelectedRow.filename,
        notes: `Borrowed from ${balanceBorrowReview.postingDate} / ${balanceBorrowSelectedRow.site}`,
      });
      await loadRows(postingDate);
      setBalanceBorrowOpen(false);
      setError(null);
      setMessage(`Applied ${formatCurrency(appliedAmount)} from ${balanceBorrowReview.postingDate} to ${postingDate}.`);
    } catch (error) {
      setBalanceBorrowError(error instanceof Error ? error.message : "Failed to apply borrowed balance.");
    } finally {
      setBalanceBorrowSubmitting(false);
    }
  }

  async function deleteWorksheetKeyproof(row: BalsheetKeyproofReviewRow) {
    const writtenConfirmation = window.prompt(
      `Type DELETE KEYPROOF to remove ${row.filename} from the worksheet.`
    );
    if (writtenConfirmation?.trim().toUpperCase() !== "DELETE KEYPROOF") {
      setBalanceBorrowError(null);
      setMessage("Keyproof delete cancelled.");
      return;
    }

    setBalanceBorrowSubmitting(true);
    setMessage(null);
    try {
      await deleteKeyproof(row.attachmentId);
      await loadKeyproofReview(postingDate);
      if (keyproofWorksheetOpen) {
        await loadKeyproofReview(postingDate);
      }
      setError(null);
      setMessage(`Deleted keyproof for ${row.filename}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to delete keyproof.");
    } finally {
      setBalanceBorrowSubmitting(false);
    }
  }

  async function movePostingDay(deltaDays: number) {
    const nextPostingDate = shiftPostingDate(postingDate || day || "", deltaDays);
    if (!nextPostingDate) {
      return;
    }

    setPostingDate(nextPostingDate);
    await loadRows(nextPostingDate);
  }

  function getVisibleRowsFor(rowsList: BalsheetEntry[]) {
    const groupMap = new Map<string, BalsheetEntry[]>();

    for (const row of rowsList) {
      const groupKey = String(row.type ?? "").trim() || "Ungrouped";
      const groupRows = groupMap.get(groupKey) ?? [];
      groupRows.push(row);
      groupMap.set(groupKey, groupRows);
    }

    const groupEntries = Array.from(groupMap.entries()).sort(([leftKey], [rightKey]) =>
      compareGroupedKeys(leftKey, rightKey, sortField, sortDirection)
    );

    return groupEntries.flatMap(([groupKey, groupRows]) =>
      collapsedGroups.has(groupKey) ? [] : [...groupRows].sort((left, right) => compareSheetRows(left, right, sortField, sortDirection))
    );
  }

  async function addBalsheetRow() {
    const targetPostingDay = postingDate || normalizeDisplayDate(day) || "";
    if (!targetPostingDay) {
      setError("No posting day is available for adding a Balsheet row.");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const response = await createBalsheetEntry({
        posting_date: targetPostingDay,
        type: "",
        amount: 0,
        payer: "",
        check_number: "",
        edi: "",
        poster: "",
        eob: "",
        unposted: 0,
        misc: 0,
        misc_type: "",
        notes: "",
        nick: 0,
        raul: 0,
        needs: "",
        from_date: "",
        to_date: "",
      });

      const refreshedRows = await loadRows(targetPostingDay);
      const createdRowId = response.data.entry_id ?? "";
      const visibleRowsAfterRefresh = getVisibleRowsFor(refreshedRows);
      const createdRowIndex = visibleRowsAfterRefresh.findIndex((row) => row.entry_id === createdRowId);
      if (createdRowIndex >= 0) {
        setSheetLocked(false);
        setActiveCell({ rowIndex: createdRowIndex, columnIndex: 2 });
        setSelectionDraft(String(visibleRowsAfterRefresh[createdRowIndex]?.type ?? ""));
        setIsEditingSelection(true);
      }
      setError(null);
      setMessage("Added new row.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add Balsheet row");
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(columnKey: "entry_id" | keyof BalsheetEntry) {
    const nextDirection =
      sortField === columnKey
        ? sortDirection === "asc"
          ? "desc"
          : "asc"
        : columnKey === "amount" || columnKey === "nick" || columnKey === "raul" || columnKey === "unposted" || columnKey === "misc"
          ? "desc"
          : "asc";

    setSortField(columnKey);
    setSortDirection(nextDirection);
  }

  function toggleGroup(groupKey: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
    setActiveCell(null);
  }

  function handleCellKeyDown(event: ReactKeyboardEvent<HTMLTableCellElement>, rowIndex: number, columnIndex: number) {
    let nextRow = rowIndex;
    let nextColumn = columnIndex;

    if (event.key === "ArrowUp") {
      nextRow -= 1;
    } else if (event.key === "ArrowDown") {
      nextRow += 1;
    } else if (event.key === "ArrowLeft") {
      nextColumn -= 1;
    } else if (event.key === "ArrowRight") {
      nextColumn += 1;
    } else {
      return;
    }

    event.preventDefault();
    const rowCount = visibleRows.length;
    const columnCount = sheetColumns.length;
    if (nextRow < 0 || nextRow >= rowCount || nextColumn < 0 || nextColumn >= columnCount) {
      return;
    }
    focusCell(nextRow, nextColumn);
  }

  function startColumnResize(event: ReactPointerEvent<HTMLDivElement>, key: string) {
    event.preventDefault();
    event.stopPropagation();
    const currentWidth = columnWidths[key] ?? defaultColumnWidths[key] ?? 140;
    resizeStateRef.current = {
      key,
      startX: event.clientX,
      startWidth: currentWidth,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const activeResize = resizeStateRef.current;
      if (!activeResize || activeResize.key !== key) {
        return;
      }

      const nextWidth = Math.max(80, activeResize.startWidth + (moveEvent.clientX - activeResize.startX));
      setColumnWidths((previous) => ({ ...previous, [key]: nextWidth }));
    };

    const handlePointerUp = () => {
      resizeStateRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function getCellStyle(isNumeric: boolean, rowIndex: number, columnIndex: number): CSSProperties {
    const isActive = activeCell?.rowIndex === rowIndex && activeCell?.columnIndex === columnIndex;
    return {
      ...(isNumeric ? styles.numericTd : styles.td),
      ...(isActive ? styles.cellFocused : null),
    };
  }

  function isEdiHighlighted(row: BalsheetEntry) {
    return String(row.edi ?? "").trim().toUpperCase() === "Y";
  }

  function getSortIndicator(columnKey: "entry_id" | keyof BalsheetEntry) {
    if (sortField !== columnKey) {
      return "\u2195";
    }

    return sortDirection === "asc" ? "\u25B2" : "\u25BC";
  }

  async function loadRows(date = postingDate) {
    let loadedRows: BalsheetEntry[] = [];
    setLoading(true);
    setMessage(null);
    try {
      const [rowsResponse, notesResponse] = await Promise.all([getBalsheet(date), getBalsheetNotes(date)]);
      loadedRows = rowsResponse.data;
      setRows(loadedRows);
      try {
        const miscResponse = await getMisc();
        const nextMiscOptions = normalizeMiscTypeOptions(
          miscResponse.data.map((entry: MiscEntry) => String(entry.misc_type ?? ""))
        );
        setMiscTypeOptions(nextMiscOptions);
      } catch {
        setMiscTypeOptions([]);
      }
      const savedNote = String(notesResponse.data[0]?.notes ?? "").trim();
      const savedMessage = String(notesResponse.data[0]?.message ?? "").trim();
      setHeroNote(savedNote);
      if (!savedMessage && isWeekendPostingDate(date)) {
        await upsertBalsheetNoteMessage(date, weekendHeroMessage);
        setHeroMessage(weekendHeroMessage);
      } else {
        setHeroMessage(savedMessage);
      }
      void loadKeyproofReview(date);
      if (keyproofReviewOpen) {
        void loadKeyproofReviewIssues();
      }
      if (documentMarkersEnabled) {
        void loadDocumentMarkers(date);
      } else {
        setDocumentAssociations([]);
      }
      setError(null);
    } catch (err) {
      setRows([]);
      setHeroNote("");
      setHeroMessage("");
      setDocumentAssociations([]);
      setError(err instanceof Error ? err.message : "Failed to load Balsheet");
    } finally {
      setLoading(false);
    }

    return loadedRows;
  }

  async function loadDocumentMarkers(date = postingDate) {
    const normalizedDate = normalizeDisplayDate(date) || date || "";
    if (!normalizedDate) {
      setDocumentAssociations([]);
      return;
    }

    setDocumentMarkersLoading(true);
    try {
      const response = await getImagingBalsheetAssociations(normalizedDate);
      setDocumentAssociations(response.data.rows);
    } catch {
      setDocumentAssociations([]);
    } finally {
      setDocumentMarkersLoading(false);
    }
  }

  async function importBankingRows() {
    const selectedPostingDay = postingDate || normalizeDisplayDate(day) || "";
    if (!selectedPostingDay) {
      setError("No posting day is available for importing banking rows.");
      return;
    }

    let targetBankDay = currentBankDay;
    try {
      const bankDayResponse = await lookupCalendarBankDay(selectedPostingDay);
      targetBankDay = bankDayResponse.data.bankDay || targetBankDay;
      setCurrentBankDay(targetBankDay);
    } catch {
      // If the lookup fails, fall back to the current cached value.
    }

    if (!targetBankDay) {
      setError(`No bank day is mapped to ${selectedPostingDay}.`);
      return;
    }

    const confirmed = window.confirm(
      `Import banking rows into ${selectedPostingDay} using bank day ${targetBankDay}? This will replace existing BANK-* rows for that day only.`
    );
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const response = await importBalsheetFromBanking(selectedPostingDay, targetBankDay);
      await loadRows(selectedPostingDay);
      setMessage(
        `Imported ${response.data.rowsImported} banking row${response.data.rowsImported === 1 ? "" : "s"} into Balsheet.`
      );
    } catch (err) {
      setRows([]);
      setMessage(null);
      setError(err instanceof Error ? err.message : "Failed to import banking rows");
    } finally {
      setLoading(false);
    }
  }

  async function clearCurrentBalsheet() {
    if (!postingDate) {
      setError("No posting day is selected to clear.");
      return;
    }

    const confirmed = window.confirm(`Clear all Balsheet rows for ${postingDate}?`);
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const response = await clearBalsheet(postingDate);
      await loadRows(response.data.postingDate);
      setMessage(
        `Cleared ${response.data.rowsDeleted} Balsheet row${response.data.rowsDeleted === 1 ? "" : "s"} for ${response.data.postingDate}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear Balsheet");
    } finally {
      setLoading(false);
    }
  }

  async function saveCurrentBalsheet() {
    const selectedPostingDay = postingDate || normalizeDisplayDate(day) || "";
    if (!selectedPostingDay) {
      setError("No posting day is available for saving Balsheet rows.");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const response = await saveBalsheetEntries(rows, selectedPostingDay);
      await loadRows(selectedPostingDay);
      setError(null);
      setMessage(
        `Saved ${response.data.rowsImported} Balsheet row${response.data.rowsImported === 1 ? "" : "s"} to the table.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Balsheet rows");
    } finally {
      setLoading(false);
    }
  }

  async function editHeroMessage() {
    const currentValue = heroMessage;
    const nextValue = window.prompt("Enter message", currentValue);
    if (nextValue === null) {
      return;
    }

    const normalizedMessage = nextValue.trim();
    setMessage(null);
    try {
      await upsertBalsheetNoteMessage(postingDate, normalizedMessage);
      setHeroMessage(normalizedMessage);
      setError(null);
      setMessage(normalizedMessage ? "Message updated." : "Message cleared.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save message");
    }
  }

  async function editHeroNote() {
    const currentValue = heroNote;
    const nextValue = window.prompt("Enter note", currentValue);
    if (nextValue === null) {
      return;
    }

    const normalizedNote = nextValue.trim();
    setMessage(null);
    try {
      await upsertBalsheetNoteText(postingDate, normalizedNote);
      setHeroNote(normalizedNote);
      setError(null);
      setMessage(normalizedNote ? "Note updated." : "Note cleared.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    }
  }

  useEffect(() => {
    getBalsheetWorkday()
      .then((response) => {
        const workday = response.data.current_work_day || response.data.posting_date;
        const currentDay = normalizeDisplayDate(day) || workday;
        setPostingDate(currentDay);
        return loadRows(currentDay);
      })
      .catch((err) => {
        setRows([]);
        setHeroNote("");
        setHeroMessage("");
        setError(err instanceof Error ? err.message : "Failed to load Balsheet");
      })
      .finally(() => setLoading(false));
  }, [day]);

  useEffect(() => {
    if (!postingDate) {
      setCurrentBankDay("");
      return;
    }

    let cancelled = false;

    lookupCalendarBankDay(postingDate)
      .then((response: { data: { bankDay: string | null } }) => {
        if (!cancelled) {
          setCurrentBankDay(response.data.bankDay || "");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentBankDay("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [postingDate]);

  useEffect(() => {
    void loadKeyproofReview(postingDate);
  }, [postingDate]);

  useEffect(() => {
    if (!keyproofWorksheetOpen) {
      return;
    }

    void loadKeyproofReview(postingDate);
  }, [keyproofWorksheetOpen, postingDate]);

  useEffect(() => {
    if (!keyproofReviewOpen) {
      return;
    }

    void loadKeyproofReviewIssues();
  }, [keyproofReviewOpen]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!keyproofReviewOpen) {
        return;
      }

      const target = event.target as Node | null;
      if (keyproofReviewPanelRef.current && target && !keyproofReviewPanelRef.current.contains(target)) {
        closeKeyproofReview();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeKeyproofReview();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [keyproofReviewOpen]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!keyproofWorksheetOpen) {
        return;
      }

      const target = event.target as Node | null;
      if (keyproofWorksheetPanelRef.current && target && !keyproofWorksheetPanelRef.current.contains(target)) {
        closeKeyproofWorksheet();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeKeyproofWorksheet();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [keyproofWorksheetOpen]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!heroMenuOpen) {
        return;
      }

      const target = event.target as Node | null;
      if (heroMenuWrapRef.current && target && !heroMenuWrapRef.current.contains(target)) {
        setHeroMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setHeroMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [heroMenuOpen]);

  return (
    <AdminShell
      sidebarCopy=""
      onBack={() => navigate("/cash")}
      backButtonFirst
      priorityNavItemIds={["/balsheet", "/site-review", "/tools"]}
      sidebarAction={
        <div style={{ display: "grid", gap: "8px" }}>
          <div style={styles.sidebarCard}>
            <div style={styles.sidebarCardLabel}>Posting Day</div>
            <label style={styles.postingDayLabel}>
              <span style={styles.postingDayLabelText}>Select posting date</span>
              <input
                type="date"
                value={postingDateIso}
                style={styles.postingDayInput}
                onChange={(event) => {
                  const nextPostingDate = normalizeDisplayDate(event.target.value);
                  setPostingDate(nextPostingDate);
                  void loadRows(nextPostingDate);
                }}
              />
            </label>
            <div style={styles.postingDayBankDay}>Current bank day: {currentBankDay || "Loading..."}</div>
          </div>

          <div style={styles.sidebarTotalsCard}>
            <div style={styles.sidebarCardLabel}>Totals by Column</div>
            <div style={styles.sidebarTotalsGrid}>
              <div style={styles.sidebarTotalsRow}>
                <span style={styles.sidebarTotalsLabel}>Amount</span>
                <span style={styles.sidebarTotalsValue}>{formatCurrency(totals.amount)}</span>
              </div>
              <div style={styles.sidebarTotalsRow}>
                <span style={styles.sidebarTotalsLabel}>Nick</span>
                <span style={styles.sidebarTotalsValue}>{formatCurrency(totals.nick)}</span>
              </div>
              <div style={styles.sidebarTotalsRow}>
                <span style={styles.sidebarTotalsLabel}>Raul</span>
                <span style={styles.sidebarTotalsValue}>{formatCurrency(totals.raul)}</span>
              </div>
              <div style={styles.sidebarTotalsRow}>
                <span style={styles.sidebarTotalsLabel}>UnPosted</span>
                <span style={styles.sidebarTotalsValue}>{formatCurrency(totals.unposted)}</span>
              </div>
              <div style={styles.sidebarTotalsRow}>
                <span style={styles.sidebarTotalsLabel}>Misc</span>
                <span style={styles.sidebarTotalsValue}>{formatCurrency(totals.misc)}</span>
              </div>
            </div>
          </div>

          <div style={styles.sidebarTotalsCard}>
            <div style={styles.sidebarCardLabel}>Totals by Type</div>
            <div style={styles.sidebarTotalsGrid}>
              {typeTotals.length === 0 ? (
                <div style={styles.sidebarTotalsEmpty}>No type totals available.</div>
              ) : (
                typeTotals.map((typeTotal) => (
                  <div key={typeTotal.type} style={styles.sidebarTotalsRow}>
                    <span style={styles.sidebarTotalsLabel}>{typeTotal.type}</span>
                    <span style={styles.sidebarTotalsValue}>{formatCurrency(typeTotal.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      }
    >
      <section style={styles.content} aria-busy={loading}>
        {loading && <div style={styles.loadingOverlay}>Loading Balsheet...</div>}
        <section style={styles.heroShell}>
            <div style={styles.heroCopy}>
              <div style={styles.kicker}>Balance Sheet</div>
              <h1 style={styles.title}>Balsheet</h1>
              <div style={styles.heroSubtitleRow}>
                <p style={styles.subtitle}>{heroMessage || "\u00A0"}</p>
                <button type="button" style={styles.heroMessageEditButton} onClick={() => editHeroMessage()}>
                  Edit
                </button>
              </div>
              <div style={styles.heroActions}>
                <div ref={heroMenuWrapRef} style={styles.heroMenuWrap}>
                  <button
                    type="button"
                    style={styles.heroMenuButton}
                    onClick={() => setHeroMenuOpen((current) => !current)}
                    aria-label="More actions"
                    aria-expanded={heroMenuOpen}
                    title="More actions"
                  >
                    ...
                  </button>
                  {heroMenuOpen ? (
                    <div style={styles.heroMenuPanel} role="menu" aria-label="Balsheet actions">
                      <button
                        type="button"
                        style={styles.heroMenuItemButton}
                        role="menuitem"
                        onClick={() => {
                          setHeroMenuOpen(false);
                          void saveCurrentBalsheet();
                        }}
                      >
                        Save Balsheet
                      </button>
                      <button
                        type="button"
                        style={styles.heroMenuItemButton}
                        role="menuitem"
                        onClick={() => {
                          setHeroMenuOpen(false);
                          loadRows();
                        }}
                      >
                        Refresh
                      </button>
                      <button
                        type="button"
                        style={styles.heroMenuItemButton}
                        role="menuitem"
                        onClick={() => {
                          setHeroMenuOpen(false);
                          clearCurrentBalsheet();
                        }}
                      >
                        Clear Balsheet
                      </button>
                    </div>
                  ) : null}
                </div>
                <button style={styles.importBankingButton} type="button" onClick={() => importBankingRows()}>
                  Import Banking
                </button>
                <button style={styles.importBankingButton} type="button" onClick={openKeyproofWorksheet}>
                  Worksheet
                </button>
                <button style={styles.importBankingButton} type="button" onClick={openKeyproofReview}>
                  Keyproof Review
                </button>
              </div>
            </div>

          <div style={styles.heroArt}>
            <div style={styles.heroKeyproofCard}>
              <div style={styles.heroKeyproofLabel}>Open Balance</div>
              <div style={styles.heroKeyproofValue}>{formatCurrency(keyproofDifferenceTotal)}</div>
            </div>
            <div style={styles.heroStatusCard}>
              <div style={styles.heroStatusTop}>
                <span style={styles.statusPill}>Notes</span>
                <span style={styles.statusDot} />
                <button style={styles.heroNoteButton} type="button" onClick={() => editHeroNote()}>
                  Edit
                </button>
              </div>
              <div style={styles.heroStatusText}>{heroNote || "\u00A0"}</div>
            </div>
          </div>
        </section>

        <div style={styles.statusArea}>
          {error ? (
            <div style={styles.error}>{error}</div>
          ) : message ? (
            <div style={styles.message}>{message}</div>
          ) : (
            <div style={styles.statusPlaceholder} aria-hidden="true">
              &nbsp;
            </div>
          )}
        </div>

        {keyproofWorksheetOpen ? (
          <div style={styles.keyproofReviewOverlay} aria-hidden="false">
            <div
              ref={keyproofWorksheetPanelRef}
              style={styles.keyproofReviewPanel}
              role="dialog"
              aria-label="Keyproof worksheet"
            >
              <div style={styles.keyproofReviewHeader}>
                <div style={styles.keyproofReviewHeaderCopy}>
                  <div style={styles.keyproofReviewKicker}>Worksheet</div>
                  <div style={styles.keyproofReviewTitle}>Compare keyproof summaries to live Balsheet totals</div>
                  <div style={styles.keyproofReviewMeta}>
                    Selected posting day: {keyproofReview?.postingDate || postingDate}
                  </div>
                </div>
                <div style={styles.keyproofWorksheetHeaderActions}>
                  <button type="button" style={styles.keyproofReviewSecondaryButton} onClick={openBalanceBorrowTrial}>
                    Borrow Balance
                  </button>
                  <button type="button" style={styles.keyproofReviewCloseButton} onClick={closeKeyproofWorksheet}>
                    Close
                  </button>
                </div>
              </div>

              {keyproofReviewLoading ? (
                <div style={styles.keyproofReviewLoading}>Loading worksheet...</div>
              ) : keyproofReviewError ? (
                <div style={styles.keyproofReviewError}>{keyproofReviewError}</div>
              ) : !keyproofReview ? (
                <div style={styles.keyproofReviewEmpty}>No worksheet data is available for this posting day.</div>
              ) : (
                <>
                  <div style={styles.keyproofReviewSummaryGrid}>
                    <div style={styles.keyproofReviewSummaryCard}>
                      <div style={styles.keyproofReviewSummaryLabel}>Keyproofs</div>
                      <div style={styles.keyproofReviewSummaryValue}>{keyproofReview.keyproofCount}</div>
                    </div>
                    <div style={styles.keyproofReviewSummaryCard}>
                      <div style={styles.keyproofReviewSummaryLabel}>Balsheet matched</div>
                      <div style={styles.keyproofReviewSummaryValue}>{keyproofReview.balsheetMatchedCount}</div>
                    </div>
                    <div style={styles.keyproofReviewSummaryCard}>
                      <div style={styles.keyproofReviewSummaryLabel}>Spring Lane matched</div>
                      <div style={styles.keyproofReviewSummaryValue}>{keyproofReview.springLaneMatchedCount}</div>
                    </div>
                    <div style={styles.keyproofReviewSummaryCard}>
                      <div style={styles.keyproofReviewSummaryLabel}>Borrowed balance</div>
                      <div style={styles.keyproofReviewSummaryValue}>
                        {formatCurrency(
                          keyproofReview.rows.reduce((total, row) => total + parseAmount(row.borrowedTransferTotal ?? 0), 0)
                        )}
                      </div>
                    </div>
                    <div style={styles.keyproofReviewSummaryCard}>
                      <div style={styles.keyproofReviewSummaryLabel}>Total difference</div>
                      <div style={styles.keyproofReviewSummaryValue}>{formatCurrency(keyproofDifferenceTotal)}</div>
                    </div>
                  </div>

                  <div style={styles.keyproofReviewTableWrap}>
                    {keyproofReview.rows.length === 0 ? (
                      <div style={styles.keyproofReviewEmpty}>No keyproof rows were found for this posting day.</div>
                    ) : (
                      keyproofReview.rows.map((row) => {
                        const isSpringLaneSite = /spring lane/i.test(`${row.site || ""} ${row.filename || ""}`);
                        const keyproofSubtotal = isSpringLaneSite
                          ? row.keyproofTotal + row.eftExpectedTotal + row.lockboxExpectedTotal
                          : row.keyproofTotal;
                        const balsheetSubtotal = isSpringLaneSite
                          ? row.itemizationBalsheetTotal + row.eftBalsheetTotal + row.lockboxBalsheetTotal
                          : row.balsheetActualTotal;
                        const difference = keyproofSubtotal - balsheetSubtotal;

                        return (
                          <div key={row.attachmentId} style={styles.keyproofReviewTableRow}>
                            <div style={styles.keyproofReviewTableSummaryRow}>
                              <div style={styles.keyproofReviewTableSiteCell}>
                                <div style={styles.keyproofReviewTableSiteTitle}>{row.site}</div>
                                <div style={styles.keyproofReviewTableSiteMeta}>
                                  {row.filename}
                                  <br />
                                  {row.batchDate}
                                </div>
                              </div>
                              <div style={styles.keyproofReviewTableCellRight}>{formatCurrency(keyproofSubtotal)}</div>
                              <div style={styles.keyproofReviewTableCellRight}>{formatCurrency(balsheetSubtotal)}</div>
                              <div
                                style={{
                                  ...styles.keyproofReviewTableCellRight,
                                  ...(Math.abs(difference) < 0.005
                                    ? styles.keyproofReviewTableDifferenceGood
                                    : styles.keyproofReviewTableDifferenceWarn),
                                }}
                              >
                                {formatCurrency(difference)}
                              </div>
                            </div>

                            <div style={styles.keyproofReviewTableActions}>
                              <button
                                type="button"
                                style={styles.keyproofReviewSecondaryButton}
                                onClick={() => openWorksheetImages(row)}
                              >
                                View images
                              </button>
                              <button
                                type="button"
                                style={styles.keyproofReviewOpenButton}
                                onClick={() => void deleteWorksheetKeyproof(row)}
                                disabled={balanceBorrowSubmitting}
                              >
                                Delete keyproof
                              </button>
                            </div>

                            {isSpringLaneSite ? (
                              <>
                                <div style={styles.keyproofReviewTableAttachmentRow}>Spring Lane breakdown</div>
                                <div style={styles.keyproofReviewTableDetailRow}>
                                  <div style={styles.keyproofReviewTableDetailLabel}>Itemized</div>
                                  <div style={styles.keyproofReviewTableDetailValue}>
                                    {formatCurrency(row.itemizationBalsheetTotal)}
                                  </div>
                                  <div style={styles.keyproofReviewTableDetailValue}>
                                    {formatCurrency(row.keyproofTotal)}
                                  </div>
                                  <div
                                    style={{
                                      ...styles.keyproofReviewTableDetailValue,
                                      ...(Math.abs(row.itemizationDifference) < 0.005
                                        ? styles.keyproofReviewTableDifferenceGood
                                        : styles.keyproofReviewTableDifferenceWarn),
                                    }}
                                  >
                                    {formatCurrency(row.itemizationDifference)}
                                  </div>
                                </div>
                                <div style={styles.keyproofReviewTableDetailRow}>
                                  <div style={styles.keyproofReviewTableDetailLabel}>EFT</div>
                                  <div style={styles.keyproofReviewTableDetailValue}>
                                    {formatCurrency(row.eftBalsheetTotal)}
                                  </div>
                                  <div style={styles.keyproofReviewTableDetailValue}>
                                    {formatCurrency(row.eftExpectedTotal)}
                                  </div>
                                  <div style={styles.keyproofReviewTableDetailValue}>
                                    {formatCurrency(row.eftExpectedTotal - row.eftBalsheetTotal)}
                                  </div>
                                </div>
                                <div style={styles.keyproofReviewTableDetailRow}>
                                  <div style={styles.keyproofReviewTableDetailLabel}>Lockbox</div>
                                  <div style={styles.keyproofReviewTableDetailValue}>
                                    {formatCurrency(row.lockboxBalsheetTotal)}
                                  </div>
                                  <div style={styles.keyproofReviewTableDetailValue}>
                                    {formatCurrency(row.lockboxExpectedTotal)}
                                  </div>
                                  <div style={styles.keyproofReviewTableDetailValue}>
                                    {formatCurrency(row.lockboxExpectedTotal - row.lockboxBalsheetTotal)}
                                  </div>
                                </div>
                                {Math.abs(parseAmount(row.borrowedTransferTotal ?? 0)) > 0.005 ? (
                                  <div style={styles.keyproofReviewTableDetailRow}>
                                    <div style={styles.keyproofReviewTableDetailLabel}>Borrowed balance</div>
                                    <div style={styles.keyproofReviewTableDetailValue}>
                                      {formatCurrency(row.borrowedTransferTotal ?? 0)}
                                    </div>
                                    <div style={styles.keyproofReviewTableDetailValue} />
                                    <div
                                      style={{
                                        ...styles.keyproofReviewTableDetailValue,
                                        ...(Math.abs(getDisplayedReviewDifference(row)) < 0.005
                                          ? styles.keyproofReviewTableDifferenceGood
                                          : styles.keyproofReviewTableDifferenceWarn),
                                      }}
                                    >
                                      {formatCurrency(getDisplayedReviewDifference(row))}
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        {balanceBorrowOpen ? (
          <div style={styles.keyproofReviewOverlay} aria-hidden="false">
            <div style={styles.balanceBorrowPanel} role="dialog" aria-label="Borrow balance trial">
              <div style={styles.keyproofReviewHeader}>
                <div style={styles.keyproofReviewHeaderCopy}>
                  <div style={styles.keyproofReviewKicker}>Trial</div>
                  <div style={styles.keyproofReviewTitle}>Borrow a balance from another day</div>
                  <div style={styles.keyproofReviewMeta}>
                    Apply a source-day site balance to the current posting day before committing it to the worksheet.
                  </div>
                </div>
                <button type="button" style={styles.keyproofReviewCloseButton} onClick={closeBalanceBorrowTrial}>
                  Close
                </button>
              </div>

              <div style={styles.balanceBorrowControls}>
                <label style={styles.balanceBorrowField}>
                  <span style={styles.balanceBorrowFieldLabel}>Source date</span>
                  <input
                    type="date"
                    value={displayDateToIso(balanceBorrowSourceDate)}
                    style={styles.balanceBorrowDateInput}
                    onChange={(event) => {
                      const nextSourceDate = normalizeDisplayDate(event.target.value);
                      setBalanceBorrowSourceDate(nextSourceDate);
                      void loadBalanceBorrowTrial(nextSourceDate);
                    }}
                  />
                </label>
                <button
                  type="button"
                  style={styles.keyproofReviewSecondaryButton}
                  onClick={() => void loadBalanceBorrowTrial(balanceBorrowSourceDate)}
                  disabled={balanceBorrowLoading || balanceBorrowSubmitting}
                >
                  {balanceBorrowLoading ? "Loading..." : "Load day"}
                </button>
              </div>

              {balanceBorrowLoading ? (
                <div style={styles.keyproofReviewLoading}>Loading source balances...</div>
              ) : balanceBorrowError ? (
                <div style={styles.keyproofReviewError}>{balanceBorrowError}</div>
              ) : !balanceBorrowReview ? (
                <div style={styles.keyproofReviewEmpty}>Pick a source date to review its open balances.</div>
              ) : (
                <>
                  <div style={styles.keyproofReviewSummaryGrid}>
                    <div style={styles.keyproofReviewSummaryCard}>
                      <div style={styles.keyproofReviewSummaryLabel}>Source date</div>
                      <div style={styles.keyproofReviewSummaryValue}>{balanceBorrowReview.postingDate}</div>
                    </div>
                    <div style={styles.keyproofReviewSummaryCard}>
                      <div style={styles.keyproofReviewSummaryLabel}>Open balances</div>
                      <div style={styles.keyproofReviewSummaryValue}>{balanceBorrowReview.keyproofCount}</div>
                    </div>
                    <div style={styles.keyproofReviewSummaryCard}>
                      <div style={styles.keyproofReviewSummaryLabel}>Selected amount</div>
                      <div style={styles.keyproofReviewSummaryValue}>
                        {formatCurrency(balanceBorrowSelectedRow ? getDisplayedReviewDifference(balanceBorrowSelectedRow) : 0)}
                      </div>
                    </div>
                    <div style={styles.keyproofReviewSummaryCard}>
                      <div style={styles.keyproofReviewSummaryLabel}>Target day</div>
                      <div style={styles.keyproofReviewSummaryValue}>{postingDate}</div>
                    </div>
                  </div>

                  <div style={styles.balanceBorrowPreview}>
                    <div style={styles.balanceBorrowPreviewLine}>
                      <span style={styles.balanceBorrowPreviewLabel}>Current worksheet difference</span>
                      <span style={styles.balanceBorrowPreviewValue}>{formatCurrency(keyproofDifferenceTotal)}</span>
                    </div>
                    <div style={styles.balanceBorrowPreviewLine}>
                      <span style={styles.balanceBorrowPreviewLabel}>Projected worksheet difference</span>
                      <span style={styles.balanceBorrowPreviewValue}>
                        {formatCurrency(
                          roundToCents(
                            keyproofDifferenceTotal +
                              (balanceBorrowSelectedRow ? -Math.abs(getDisplayedReviewDifference(balanceBorrowSelectedRow)) : 0)
                          )
                        )}
                      </span>
                    </div>
                  </div>

                  <div style={styles.keyproofReviewTableWrap}>
                    {balanceBorrowReview.rows.length === 0 ? (
                      <div style={styles.keyproofReviewEmpty}>No open balances were found on that day.</div>
                    ) : (
                      balanceBorrowReview.rows.map((row) => {
                        const isSelected = balanceBorrowSelectedRow?.attachmentId === row.attachmentId;
                        const displayedDifference = getDisplayedReviewDifference(row);

                        return (
                          <button
                            key={row.attachmentId}
                            type="button"
                            style={{
                              ...styles.balanceBorrowRowButton,
                              ...(isSelected ? styles.balanceBorrowRowButtonSelected : null),
                            }}
                            onClick={() => setBalanceBorrowSelectedRow(row)}
                          >
                            <div style={styles.keyproofReviewTableSummaryRow}>
                              <div style={styles.keyproofReviewTableSiteCell}>
                                <div style={styles.keyproofReviewTableSiteTitle}>{row.site}</div>
                                <div style={styles.keyproofReviewTableSiteMeta}>
                                  {row.filename}
                                  <br />
                                  {row.batchDate}
                                </div>
                              </div>
                              <div style={styles.keyproofReviewTableCellRight}>{formatCurrency(row.keyproofTotal)}</div>
                              <div style={styles.keyproofReviewTableCellRight}>{formatCurrency(row.balsheetActualTotal)}</div>
                              <div
                                style={{
                                  ...styles.keyproofReviewTableCellRight,
                                  ...(Math.abs(displayedDifference) < 0.005
                                    ? styles.keyproofReviewTableDifferenceGood
                                    : styles.keyproofReviewTableDifferenceWarn),
                                }}
                              >
                                {formatCurrency(displayedDifference)}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div style={styles.balanceBorrowFooter}>
                    <button
                      type="button"
                      style={styles.selectionActionRowDeleteButton}
                      onClick={() => void acceptBalanceBorrowTrial()}
                      disabled={balanceBorrowSubmitting || !balanceBorrowSelectedRow}
                    >
                      {balanceBorrowSubmitting ? "Applying..." : "Accept Trial"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        {keyproofReviewOpen && (
          <div style={styles.keyproofReviewOverlay} aria-hidden="false">
            <div ref={keyproofReviewPanelRef} style={styles.keyproofReviewPanel} role="dialog" aria-label="Keyproof review">
              <div style={styles.keyproofReviewHeader}>
                  <div style={styles.keyproofReviewHeaderCopy}>
                  <div style={styles.keyproofReviewKicker}>Keyproof Review</div>
                  <div style={styles.keyproofReviewTitle}>Open keyproof balances</div>
                  <div style={styles.keyproofReviewMeta}>
                    Keyproofs with a balance across all posting days
                  </div>
                </div>
                <button type="button" style={styles.keyproofReviewCloseButton} onClick={closeKeyproofReview}>
                  Close
                </button>
              </div>

              {keyproofReviewLoading ? (
                <div style={styles.keyproofReviewLoading}>Loading keyproof review...</div>
              ) : keyproofReviewError ? (
                <div style={styles.keyproofReviewError}>{keyproofReviewError}</div>
              ) : keyproofReviewIssues ? (
                <>
                  <div style={styles.keyproofReviewSummaryGrid}>
                    <div style={styles.keyproofReviewSummaryCard}>
                      <div style={styles.keyproofReviewSummaryLabel}>Open items</div>
                      <div style={styles.keyproofReviewSummaryValue}>{keyproofReviewIssues.openCount}</div>
                    </div>
                    <div style={styles.keyproofReviewSummaryCard}>
                      <div style={styles.keyproofReviewSummaryLabel}>Days affected</div>
                      <div style={styles.keyproofReviewSummaryValue}>{keyproofReviewIssues.postingDateCount}</div>
                    </div>
                    <div style={styles.keyproofReviewSummaryCard}>
                      <div style={styles.keyproofReviewSummaryLabel}>Open balance</div>
                      <div style={styles.keyproofReviewSummaryValue}>{formatCurrency(keyproofReviewIssues.openBalanceTotal)}</div>
                    </div>
                  </div>

                  <div style={styles.keyproofReviewTableWrap}>
                    {keyproofReviewIssues.rows.length === 0 ? (
                      <div style={styles.keyproofReviewEmpty}>No open keyproof balances were found.</div>
                    ) : (
                      keyproofReviewIssues.rows.map((row) => (
                        <button
                          key={row.attachmentId}
                          type="button"
                          style={styles.keyproofIssueRowButton}
                          onClick={() => {
                            const nextPostingDate = normalizeDisplayDate(row.batchDate || "") || row.batchDate || "";
                            if (!nextPostingDate) {
                              return;
                            }

                            setKeyproofReviewOpen(false);
                            setKeyproofReviewIssues(null);
                            setPostingDate(nextPostingDate);
                            void loadRows(nextPostingDate);
                          }}
                        >
                          <div style={styles.keyproofIssueRowTop}>
                            <div style={styles.keyproofIssueRowDate}>{row.batchDate}</div>
                            <div
                              style={{
                                ...styles.keyproofIssueRowDifference,
                                ...(Math.abs(row.difference) < 0.005
                                  ? styles.keyproofReviewTableDifferenceGood
                                  : styles.keyproofReviewTableDifferenceWarn),
                              }}
                            >
                              {formatCurrency(row.difference)}
                            </div>
                          </div>
                          <div style={styles.keyproofIssueRowSite}>{row.site}</div>
                          <div style={styles.keyproofIssueRowMeta}>
                            <span>Keyproof {formatCurrency(row.keyproofTotal)}</span>
                            <span>Balsheet {formatCurrency(row.balsheetActualTotal)}</span>
                          </div>
                          <div style={styles.keyproofIssueRowHint}>Open day on Balsheet</div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        <div
          style={{
            ...styles.selectionBar,
            ...(sheetLocked ? styles.selectionBarLocked : styles.selectionBarUnlocked),
          }}
        >
          <div style={styles.selectionNavCluster}>
            <button
              type="button"
              style={styles.selectionNavButton}
              onClick={() => void movePostingDay(-1)}
              aria-label="Previous day"
              title="Previous day"
            >
              &lt;
            </button>
            <button
              type="button"
              style={styles.selectionNavButton}
              onClick={() => void movePostingDay(1)}
              aria-label="Next day"
              title="Next day"
            >
              &gt;
            </button>
            <button
              type="button"
              style={styles.selectionAddButton}
              onClick={() => void addBalsheetRow()}
              aria-label="Add row"
              title="Add row"
            >
              +
            </button>
          </div>
          <button
            type="button"
            style={{
              ...styles.selectionLockButton,
              ...(sheetLocked ? styles.selectionLockButtonLocked : styles.selectionLockButtonUnlocked),
            }}
            onClick={toggleSheetLock}
            aria-pressed={sheetLocked}
            aria-label={sheetLocked ? "Unlock Sheet" : "Lock Sheet"}
            title={sheetLocked ? "Unlock Sheet" : "Lock Sheet"}
          >
            <span style={styles.selectionLockIcon} aria-hidden="true">
              {sheetLocked ? "\uD83D\uDD12" : "\uD83D\uDD13"}
            </span>
            <span style={styles.selectionLockText}>Lock Sheet</span>
          </button>
          <button
            type="button"
            style={{
              ...styles.selectionDocsButton,
              ...(documentMarkersEnabled ? styles.selectionDocsButtonActive : styles.selectionDocsButtonInactive),
            }}
            onClick={() => {
              setDocumentMarkersEnabled((current) => {
                const next = !current;
                if (next && !documentAssociations.length && !documentMarkersLoading) {
                  void loadDocumentMarkers();
                }
                if (!next) {
                  setDocumentAssociations([]);
                }
                return next;
              });
            }}
            aria-pressed={documentMarkersEnabled}
            aria-label={documentMarkersEnabled ? "Hide document markers" : "Show document markers"}
            title={documentMarkersEnabled ? "Hide document markers" : "Show document markers"}
          >
            {documentMarkersLoading ? "Docs..." : documentMarkersEnabled ? "Docs On" : "Docs"}
          </button>
          <div style={styles.selectionInputWrap}>
            <div style={styles.selectionInputLabel}>{selectedCell?.label ?? "Active cell"}</div>
            <div style={styles.selectionInputRow}>
              <div style={styles.selectionInputStack}>
                {selectedCell?.columnKey === "misc_type" && isEditingSelection && !sheetLocked ? (
                  <select
                    ref={selectionSelectRef}
                    multiple
                    size={Math.min(6, Math.max(3, normalizeMiscTypeOptions(miscTypeOptions, selectionDraft).length))}
                    value={splitMiscTypeValues(selectionDraft)}
                    onChange={(event) => {
                      const nextValues = Array.from(event.currentTarget.selectedOptions, (option) => option.value);
                      setSelectionDraft(joinMiscTypeValues(nextValues));
                    }}
                    onKeyDown={handleSelectionInputKeyDown}
                    onBlur={() => {
                      if (cancelInlineEditRef.current) {
                        cancelInlineEditRef.current = false;
                        return;
                      }
                      void commitInlineCellEdit();
                    }}
                    style={styles.selectionMultiSelect}
                    aria-label="Active cell value"
                  >
                    {normalizeMiscTypeOptions(miscTypeOptions, selectionDraft).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    ref={selectionInputRef}
                    readOnly={!isEditingSelection || sheetLocked}
                    value={selectedCell ? selectionDraft : "Select a cell to view its contents"}
                    onChange={(event) => setSelectionDraft(event.target.value)}
                    onKeyDown={handleSelectionInputKeyDown}
                    style={styles.selectionInput}
                    aria-label="Active cell value"
                  />
                )}
                {selectedCell?.columnKey === "misc_type" && isEditingSelection && !sheetLocked && (
                  <div style={styles.selectionHint}>Hold Ctrl or Cmd to pick multiple misc types.</div>
                )}
              </div>
              <div style={styles.selectionActionStack}>
                <button type="button" style={styles.selectionActionDangerButton} onClick={handleClearSelectedCell}>
                  Clear
                </button>
                <button type="button" style={styles.selectionActionRowDeleteButton} onClick={handleDeleteSelectedRow}>
                  Delete Row
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...styles.tableWrap,
            ...(sheetLocked ? null : styles.tableWrapUnlocked),
          }}
        >
          <table style={styles.table}>
            <colgroup>
              {sheetColumns.map((column) => (
                <col key={column.key} style={{ width: columnWidths[column.key] ?? defaultColumnWidths[column.key] ?? 140 }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {sheetColumns.map((column) => (
                  <th key={column.key} style={{ ...styles.th, width: columnWidths[column.key] ?? defaultColumnWidths[column.key] ?? 140 }}>
                    {column.sortable === false ? (
                      <span style={styles.thLabel}>{column.label}</span>
                    ) : (
                      <button
                        type="button"
                        style={styles.headerButton}
                        onClick={() => toggleSort(column.key as "entry_id" | keyof BalsheetEntry)}
                      >
                        <span style={styles.thLabel}>{column.label}</span>
                        <span style={styles.sortIndicator}>{getSortIndicator(column.key as "entry_id" | keyof BalsheetEntry)}</span>
                      </button>
                    )}
                    <div
                      aria-hidden="true"
                      style={styles.resizeHandle}
                      onPointerDown={(event) => startColumnResize(event, column.key)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedRows.length === 0 ? (
                <tr>
                  <td style={styles.emptyStateTd} colSpan={sheetColumns.length}>
                    No Balsheet rows imported for this posting day yet.
                  </td>
                </tr>
              ) : (
                (() => {
                  let visibleRowIndex = 0;

                  return groupedRows.flatMap((group) => {
                    const isCollapsed = collapsedGroups.has(group.groupKey);
                    const rowsMarkup = isCollapsed
                      ? []
                      : group.rows.map((row) => {
                          const rowIndex = visibleRowIndex++;
                          const highlightRow = isEdiHighlighted(row);
                          return (
                            <tr key={row.entry_id} style={highlightRow ? styles.ediHighlightRow : undefined}>
                              {sheetColumns.map((column, columnIndex) => (
                                (() => {
                                  const isInlineEditingCell =
                                    !!selectedCell &&
                                    isEditingSelection &&
                                    !sheetLocked &&
                                    selectedCell.rowId === row.entry_id &&
                                    selectedCell.columnKey === column.key;

                                  return (
                                <td
                                  key={column.key}
                                  ref={(element) => {
                                    if (!cellRefs.current[rowIndex]) {
                                      cellRefs.current[rowIndex] = [];
                                    }
                                    cellRefs.current[rowIndex][columnIndex] = element;
                                  }}
                                  tabIndex={0}
                                  onFocus={() => setActiveCell({ rowIndex, columnIndex })}
                                  onKeyDown={(event) => handleCellKeyDown(event, rowIndex, columnIndex)}
                                  onDoubleClick={() => beginInlineCellEdit(rowIndex, columnIndex)}
                                  style={getCellStyle(!!column.numeric, rowIndex, columnIndex)}
                                >
                                  {isInlineEditingCell ? (
                                      column.key === "poster" ? (
                                        <select
                                          ref={inlineCellSelectRef}
                                          value={selectionDraft}
                                          onChange={(event) => {
                                            const nextValue = event.target.value;
                                            setSelectionDraft(nextValue);
                                            void commitInlineCellEdit(nextValue);
                                          }}
                                          onBlur={() => {
                                            if (cancelInlineEditRef.current) {
                                              cancelInlineEditRef.current = false;
                                              return;
                                            }
                                            void commitInlineCellEdit();
                                          }}
                                          style={styles.inlineCellSelect}
                                          aria-label={`Edit ${column.label}`}
                                        >
                                          <option value="">Select poster</option>
                                          <option value="Nick">Nick</option>
                                          <option value="Raul">Raul</option>
                                        </select>
                                      ) : column.key === "misc_type" ? (
                                        <select
                                          ref={inlineCellSelectRef}
                                          multiple
                                          size={Math.min(6, Math.max(3, normalizeMiscTypeOptions(miscTypeOptions, selectionDraft).length))}
                                          value={splitMiscTypeValues(selectionDraft)}
                                          onChange={(event) => {
                                            const nextValues = Array.from(event.currentTarget.selectedOptions, (option) => option.value);
                                            setSelectionDraft(joinMiscTypeValues(nextValues));
                                          }}
                                          onKeyDown={handleSelectionInputKeyDown}
                                          onBlur={() => {
                                            if (cancelInlineEditRef.current) {
                                              cancelInlineEditRef.current = false;
                                              return;
                                            }
                                            void commitInlineCellEdit();
                                          }}
                                          style={styles.inlineCellMultiSelect}
                                          aria-label={`Edit ${column.label}`}
                                        >
                                          {normalizeMiscTypeOptions(miscTypeOptions, selectionDraft).map((option) => (
                                            <option key={option} value={option}>
                                              {option}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <input
                                          ref={inlineCellInputRef}
                                          value={selectionDraft}
                                          onChange={(event) => setSelectionDraft(event.target.value)}
                                          onKeyDown={handleSelectionInputKeyDown}
                                          onBlur={() => {
                                            if (cancelInlineEditRef.current) {
                                              cancelInlineEditRef.current = false;
                                              return;
                                            }
                                            void commitInlineCellEdit();
                                          }}
                                          style={styles.inlineCellInput}
                                          aria-label={`Edit ${column.label}`}
                                        />
                                      )
                                  ) : column.key === "entry_id" ? (
                                    row.entry_id
                                  ) : column.key === "images" ? (
                                    <button
                                      type="button"
                                      style={styles.sheetImageButton}
                                      onClick={() => openBalsheetEntryImages(row)}
                                      title="Open PDF in a new tab"
                                    >
                                      Open PDF
                                    </button>
                                  ) : column.key === "eob" ? (
                                    <div style={styles.eobCellStack}>
                                      <span>{String(row.eob ?? "")}</span>
                                      {documentMarkersEnabled ? (
                                        (() => {
                                          const association = documentAssociationMap.get(String(row.entry_id ?? ""));
                                          const hasConfirmedDocument =
                                            !!association &&
                                            (association.linkedFiles.length > 0 || Boolean(association.siteAssociation));
                                          return hasConfirmedDocument ? (
                                            <span style={styles.eobDocumentMarker} title="Associated image or PDF">
                                              ✓
                                            </span>
                                          ) : null;
                                        })()
                                      ) : null}
                                    </div>
                                  ) : column.numeric ? (
                                    formatCurrency(row[column.key])
                                  ) : (
                                    String(row[column.key] ?? "")
                                  )}
                                </td>
                                  );
                                })()
                              ))}
                            </tr>
                          );
                        });

                    return [
                      <tr key={`group-${group.groupKey}`} style={styles.groupHeaderRow}>
                        <td style={styles.groupHeaderCell} colSpan={sheetColumns.length}>
                      <button type="button" style={styles.groupHeaderButton} onClick={() => toggleGroup(group.groupKey)}>
                            <span style={styles.groupHeaderGlyph}>{isCollapsed ? "\u25B8" : "\u25BE"}</span>
                            <span style={styles.groupHeaderLabel}>{group.groupKey}</span>
                            <span style={styles.groupHeaderMeta}>
                              {group.rows.length} row{group.rows.length === 1 ? "" : "s"} \u00B7 {formatCurrency(group.totals.amount)} amount
                            </span>
                          </button>
                        </td>
                      </tr>,
                      ...rowsMarkup,
                    ];
                  });
                })()
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    boxSizing: "border-box",
    padding: "18px",
    background: "#f6f7f9",
    color: "#16304d",
    textAlign: "left",
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
    display: "grid",
    gridTemplateColumns: "250px minmax(0, 1fr)",
    gap: "18px",
    position: "relative",
    overflow: "hidden",
  },
  shell: {
    minHeight: "100vh",
    padding: "18px",
    display: "grid",
    gridTemplateColumns: "250px minmax(0, 1fr)",
    gap: "18px",
    position: "relative",
    overflow: "hidden",
    color: "#16304d",
    background: "#f6f7f9",
  },
  glowBlue: {
    position: "absolute",
    top: "-120px",
    left: "-120px",
    width: "360px",
    height: "360px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(146, 198, 255, 0.35) 0%, rgba(146, 198, 255, 0) 70%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  glowPink: {
    position: "absolute",
    right: "-100px",
    top: "110px",
    width: "320px",
    height: "320px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255, 186, 213, 0.30) 0%, rgba(255, 186, 213, 0) 72%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  sidebar: {
    position: "relative",
    zIndex: 1,
    padding: "18px 16px",
    borderRadius: "28px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.72)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.10)",
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    justifyContent: "flex-start",
    paddingBottom: "14px",
    marginBottom: "16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.18)",
  },
  brandMark: {
    width: "52px",
    height: "52px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.76)",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    boxShadow: "0 12px 22px rgba(95, 128, 172, 0.08)",
    overflow: "hidden",
    flexShrink: 0,
  },
  brandMarkImage: {
    width: "88%",
    height: "88%",
    objectFit: "contain",
    objectPosition: "center",
  },
  brandWomenMark: {
    width: "116px",
    height: "60px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.64)",
    border: "1px solid rgba(140, 160, 184, 0.10)",
    boxShadow: "0 10px 18px rgba(95, 128, 172, 0.06)",
    overflow: "hidden",
    padding: "4px",
    flexShrink: 0,
  },
  brandWomenImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "center",
  },
  sidebarCopy: {
    margin: "0 0 16px",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#516579",
  },
  navStack: {
    display: "grid",
    gap: "10px",
  },
  navButton: {
    height: "46px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    borderRadius: "16px",
    background: "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(236,245,255,0.95) 54%, rgba(255,236,244,0.92) 100%)",
    color: "#16304d",
    textAlign: "left",
    padding: "0 14px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 12px 26px rgba(52, 84, 120, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    letterSpacing: "0.01em",
  },
  navButtonLabel: {
    fontSize: "14px",
    fontWeight: 800,
  },
  navButtonGlyph: {
    width: "22px",
    height: "22px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.76)",
    color: "#8aa5c6",
    fontSize: "12px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
  },
  sidebarCard: {
    marginTop: "10px",
    padding: "10px 12px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, rgba(235, 245, 255, 0.95) 0%, rgba(255, 234, 243, 0.90) 100%)",
    border: "1px solid rgba(176, 194, 218, 0.22)",
  },
  sidebarTotalsCard: {
    marginTop: "8px",
    padding: "10px 12px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, rgba(243, 248, 255, 0.96) 0%, rgba(255, 244, 248, 0.92) 100%)",
    border: "1px solid rgba(176, 194, 218, 0.20)",
  },
  sidebarCardLabel: {
    fontSize: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#6d7f93",
    fontWeight: 800,
    marginBottom: "4px",
  },
  sidebarCardValue: {
    fontSize: "13px",
    fontWeight: 800,
    marginBottom: "4px",
    lineHeight: 1.15,
  },
  sidebarCardMeta: {
    fontSize: "9px",
    lineHeight: 1.3,
    color: "#5d7187",
  },
  sidebarTotalsGrid: {
    display: "grid",
    gap: "4px",
  },
  sidebarTotalsEmpty: {
    padding: "2px 0 0",
    fontSize: "9px",
    color: "#5e6f82",
    fontWeight: 600,
  },
  sidebarTotalsRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "8px",
  },
  sidebarTotalsLabel: {
    fontSize: "9px",
    color: "#5e6f82",
    fontWeight: 700,
  },
  sidebarTotalsValue: {
    fontSize: "10px",
    color: "#15304f",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  content: {
    position: "relative",
    zIndex: 1,
    minWidth: 0,
    display: "grid",
    gap: "10px",
    paddingTop: "88px",
  },
  loadingOverlay: {
    position: "fixed",
    inset: "18px",
    zIndex: 30,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    padding: "20px 24px",
    borderRadius: "28px",
    background: "rgba(246, 249, 252, 0.62)",
    backdropFilter: "blur(8px)",
    color: "#17314f",
    fontSize: "15px",
    fontWeight: 800,
    pointerEvents: "auto",
    cursor: "wait",
  },
  heroShell: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(260px, 0.85fr)",
    gap: "14px",
    alignItems: "center",
    padding: "14px 16px",
    borderRadius: "28px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    background: "linear-gradient(135deg, rgba(255,255,255,0.90) 0%, rgba(248,250,253,0.88) 50%, rgba(255,244,248,0.92) 100%)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.08)",
  },
  heroCopy: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    minWidth: 0,
  },
  kicker: {
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: "12px",
    fontWeight: 800,
    color: "#74879c",
    marginBottom: "10px",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 800,
    color: "#16304d",
  },
  subtitle: {
    margin: "6px 0 0",
    maxWidth: "760px",
    fontSize: "15px",
    lineHeight: 1.55,
    color: "#b23361",
  },
  heroSubtitleRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    flexWrap: "wrap",
  },
  heroMessageEditButton: {
    height: "28px",
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid rgba(158, 176, 204, 0.22)",
    background: "rgba(255,255,255,0.95)",
    color: "#3f4a57",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    cursor: "pointer",
    boxShadow: "0 8px 16px rgba(52, 84, 120, 0.08)",
    flex: "0 0 auto",
    marginTop: "6px",
  },
  heroActions: {
    position: "fixed",
    top: "18px",
    left: "282px",
    right: "16px",
    zIndex: 4,
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 18px 36px rgba(52, 84, 120, 0.08)",
  },
  heroMenuWrap: {
    position: "relative",
    flex: "0 0 auto",
  },
  heroMenuButton: {
    height: "38px",
    minWidth: "44px",
    padding: "0 12px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.95)",
    color: "#3f4a57",
    fontSize: "18px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 22px rgba(52, 84, 120, 0.08)",
  },
  heroMenuPanel: {
    position: "absolute",
    top: "46px",
    left: 0,
    zIndex: 25,
    display: "grid",
    gap: "6px",
    minWidth: "180px",
    padding: "8px",
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.98)",
    backdropFilter: "blur(16px)",
    boxShadow: "0 18px 36px rgba(52, 84, 120, 0.14)",
  },
  heroMenuItemButton: {
    height: "36px",
    padding: "0 12px",
    borderRadius: "10px",
    border: "1px solid rgba(188, 193, 203, 0.35)",
    background: "rgba(255,255,255,0.96)",
    color: "#3f4a57",
    fontSize: "12px",
    fontWeight: 800,
    textAlign: "left",
    cursor: "pointer",
  },
  primaryButton: {
    height: "38px",
    padding: "0 12px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.95)",
    color: "#3f4a57",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 22px rgba(52, 84, 120, 0.08)",
    flex: "1 1 0",
    minWidth: 0,
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    height: "38px",
    padding: "0 12px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.95)",
    color: "#3f4a57",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 22px rgba(52, 84, 120, 0.08)",
    flex: "1 1 0",
    minWidth: 0,
    whiteSpace: "nowrap",
  },
  importBankingButton: {
    height: "32px",
    padding: "0 10px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.95)",
    color: "#3f4a57",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(52, 84, 120, 0.08)",
    flex: "0 0 auto",
    whiteSpace: "nowrap",
  },
  keyproofReviewOverlay: {
    position: "fixed",
    top: "18px",
    right: "18px",
    bottom: "18px",
    left: "282px",
    zIndex: 60,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "90px 18px 18px",
    background: "rgba(20, 34, 52, 0.24)",
    backdropFilter: "blur(6px)",
    boxSizing: "border-box",
  },
  keyproofReviewPanel: {
    width: "min(980px, 100%)",
    maxHeight: "calc(100vh - 126px)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    borderRadius: "28px",
    padding: "18px",
    background: "rgba(255,255,255,0.98)",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    boxShadow: "0 32px 68px rgba(15, 25, 38, 0.24)",
  },
  keyproofReviewHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "14px",
  },
  keyproofReviewHeaderCopy: {
    display: "grid",
    gap: "4px",
    minWidth: 0,
  },
  keyproofReviewKicker: {
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    fontSize: "11px",
    fontWeight: 800,
    color: "#74879c",
  },
  keyproofReviewTitle: {
    fontSize: "22px",
    fontWeight: 900,
    color: "#16304d",
  },
  keyproofReviewMeta: {
    fontSize: "13px",
    lineHeight: 1.4,
    color: "#587089",
  },
  keyproofReviewCloseButton: {
    height: "36px",
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    background: "rgba(255,255,255,0.96)",
    color: "#3f4a57",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(52, 84, 120, 0.08)",
    flex: "0 0 auto",
  },
  keyproofReviewSecondaryButton: {
    height: "36px",
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    background: "rgba(255,255,255,0.96)",
    color: "#3f4a57",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(52, 84, 120, 0.08)",
    flex: "0 0 auto",
  },
  keyproofWorksheetHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  balanceBorrowPanel: {
    width: "min(980px, 100%)",
    maxHeight: "calc(100vh - 126px)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    borderRadius: "28px",
    padding: "18px",
    background: "rgba(255,255,255,0.98)",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    boxShadow: "0 32px 68px rgba(15, 25, 38, 0.24)",
    position: "relative",
    zIndex: 1,
    pointerEvents: "auto",
  },
  balanceBorrowControls: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  balanceBorrowField: {
    display: "grid",
    gap: "6px",
    minWidth: "240px",
  },
  balanceBorrowFieldLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  balanceBorrowDateInput: {
    height: "36px",
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    background: "rgba(255,255,255,0.96)",
    color: "#3f4a57",
    fontSize: "12px",
    fontWeight: 800,
    boxShadow: "0 10px 18px rgba(52, 84, 120, 0.08)",
  },
  balanceBorrowPreview: {
    display: "grid",
    gap: "8px",
    padding: "14px",
    borderRadius: "18px",
    background: "rgba(246, 249, 252, 0.88)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
  },
  balanceBorrowPreviewLine: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  balanceBorrowPreviewLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  balanceBorrowPreviewValue: {
    fontSize: "18px",
    fontWeight: 900,
    color: "#16304d",
  },
  balanceBorrowRowButton: {
    width: "100%",
    display: "block",
    textAlign: "left",
    border: "1px solid rgba(176, 194, 218, 0.22)",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "0 12px 20px rgba(52, 84, 120, 0.06)",
    cursor: "pointer",
    padding: "14px 16px",
    marginBottom: "10px",
    color: "#16304d",
  },
  balanceBorrowRowButtonSelected: {
    border: "1px solid rgba(57, 114, 189, 0.42)",
    boxShadow: "0 12px 24px rgba(57, 114, 189, 0.12)",
    background: "linear-gradient(135deg, rgba(235, 245, 255, 0.98) 0%, rgba(255,255,255,0.98) 100%)",
  },
  balanceBorrowFooter: {
    display: "flex",
    justifyContent: "flex-end",
  },
  keyproofReviewLoading: {
    minHeight: "120px",
    display: "grid",
    placeItems: "center",
    borderRadius: "20px",
    background: "rgba(246, 249, 252, 0.96)",
    color: "#587089",
    fontWeight: 700,
  },
  keyproofReviewError: {
    padding: "14px 16px",
    borderRadius: "16px",
    background: "#fff2f2",
    border: "1px solid #f0c3c3",
    color: "#972d2d",
    fontWeight: 700,
  },
  keyproofReviewSummaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "10px",
  },
  keyproofReviewSummaryCard: {
    padding: "12px 14px",
    borderRadius: "18px",
    border: "1px solid rgba(176, 194, 218, 0.22)",
    background: "linear-gradient(135deg, rgba(243, 248, 255, 0.95) 0%, rgba(255, 239, 245, 0.92) 100%)",
  },
  keyproofReviewSummaryLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#6d7f93",
    fontWeight: 800,
    marginBottom: "6px",
  },
  keyproofReviewSummaryValue: {
    fontSize: "20px",
    fontWeight: 900,
    color: "#16304d",
  },
  keyproofReviewTableWrap: {
    display: "grid",
    gap: "10px",
    overflowY: "auto",
    paddingRight: "2px",
    minHeight: 0,
    flex: "1 1 auto",
  },
  keyproofReviewEmpty: {
    padding: "18px",
    borderRadius: "16px",
    background: "rgba(246, 249, 252, 0.96)",
    color: "#587089",
    fontWeight: 700,
  },
  keyproofReviewTableHead: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 2fr) repeat(4, minmax(120px, 1fr))",
    gap: "12px",
    padding: "0 16px 6px",
  },
  keyproofReviewTableHeadCell: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  keyproofReviewTableHeadCellRight: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#6d7f93",
    fontWeight: 800,
    textAlign: "right",
  },
  keyproofReviewTableRow: {
    display: "grid",
    gap: "10px",
    padding: "14px 16px",
    borderRadius: "18px",
    border: "1px solid rgba(176, 194, 218, 0.22)",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "0 12px 20px rgba(52, 84, 120, 0.06)",
  },
  keyproofReviewTableSummaryRow: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 2fr) repeat(3, minmax(120px, 1fr))",
    gap: "12px",
    alignItems: "start",
  },
  keyproofReviewTableAttachmentRow: {
    paddingLeft: "12px",
    fontSize: "12px",
    color: "#587089",
    lineHeight: 1.4,
  },
  keyproofReviewTableDetailRow: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 2fr) repeat(3, minmax(120px, 1fr))",
    gap: "12px",
    alignItems: "start",
    paddingLeft: "12px",
  },
  keyproofReviewTableDetailLabel: {
    fontSize: "12px",
    fontWeight: 900,
    color: "#16304d",
  },
  keyproofReviewTableDetailValue: {
    textAlign: "right",
    fontSize: "14px",
    fontWeight: 800,
    color: "#16304d",
  },
  keyproofReviewTableActions: {
    display: "flex",
    justifyContent: "flex-end",
    paddingTop: "4px",
  },
  keyproofReviewTableSiteCell: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
  },
  keyproofReviewTableSiteTitle: {
    fontSize: "15px",
    fontWeight: 900,
    color: "#16304d",
  },
  keyproofReviewTableSiteMeta: {
    fontSize: "12px",
    lineHeight: 1.35,
    color: "#587089",
    wordBreak: "break-word",
  },
  keyproofReviewTableCellRight: {
    textAlign: "right",
    fontSize: "15px",
    fontWeight: 900,
    color: "#16304d",
  },
  keyproofReviewTableDifferenceGood: {
    color: "#1f6b2a",
  },
  keyproofReviewTableDifferenceWarn: {
    color: "#a25b00",
  },
  keyproofReviewOpenButton: {
    height: "32px",
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    background: "rgba(255,255,255,0.96)",
    color: "#3f4a57",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(52, 84, 120, 0.08)",
  },
  keyproofIssueRowButton: {
    width: "100%",
    display: "grid",
    gap: "6px",
    padding: "14px 16px",
    borderRadius: "18px",
    border: "1px solid rgba(176, 194, 218, 0.22)",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "0 12px 20px rgba(52, 84, 120, 0.06)",
    cursor: "pointer",
    textAlign: "left",
    color: "#16304d",
  },
  keyproofIssueRowTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },
  keyproofIssueRowDate: {
    fontSize: "14px",
    fontWeight: 900,
    color: "#16304d",
  },
  keyproofIssueRowDifference: {
    fontSize: "14px",
    fontWeight: 900,
  },
  keyproofIssueRowSite: {
    fontSize: "16px",
    fontWeight: 900,
    color: "#16304d",
  },
  keyproofIssueRowMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    fontSize: "12px",
    color: "#587089",
    fontWeight: 700,
  },
  keyproofIssueRowHint: {
    fontSize: "12px",
    color: "#74879c",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 800,
  },
  dangerButton: {
    height: "38px",
    padding: "0 12px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.95)",
    color: "#3f4a57",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 22px rgba(52, 84, 120, 0.08)",
    flex: "1 1 0",
    minWidth: 0,
    whiteSpace: "nowrap",
  },
  heroArt: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
    alignContent: "center",
  },
  heroKeyproofCard: {
    minWidth: "104px",
    padding: "10px 12px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, rgba(243, 248, 255, 0.95) 0%, rgba(255, 239, 245, 0.9) 100%)",
    border: "1px solid rgba(175, 193, 218, 0.22)",
    boxShadow: "0 12px 24px rgba(52, 84, 120, 0.06)",
  },
  heroKeyproofLabel: {
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#6d7f93",
    fontWeight: 800,
    marginBottom: "4px",
  },
  heroKeyproofValue: {
    fontSize: "18px",
    lineHeight: 1.1,
    fontWeight: 900,
    color: "#16304d",
    whiteSpace: "nowrap",
  },
  heroStatusCard: {
    width: "min(640px, 100%)",
    flex: "1 1 auto",
    borderRadius: "24px",
    padding: "16px",
    background: "linear-gradient(135deg, rgba(243, 248, 255, 0.95) 0%, rgba(255, 239, 245, 0.92) 100%)",
    border: "1px solid rgba(175, 193, 218, 0.22)",
  },
  heroStatusTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },
  heroNoteButton: {
    height: "28px",
    padding: "0 10px",
    borderRadius: "999px",
    border: "1px solid rgba(158, 176, 204, 0.22)",
    background: "rgba(255,255,255,0.95)",
    color: "#3f4a57",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    cursor: "pointer",
    boxShadow: "0 8px 16px rgba(52, 84, 120, 0.08)",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    height: "30px",
    padding: "0 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(158, 176, 204, 0.22)",
    fontSize: "12px",
    fontWeight: 800,
    color: "#4a6179",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#8ec4ff",
    boxShadow: "0 0 0 6px rgba(142, 196, 255, 0.18)",
  },
  heroStatusTitle: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#16304d",
    marginBottom: "8px",
  },
  heroStatusText: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#2f6fb5",
    minHeight: "48px",
    whiteSpace: "pre-wrap",
  },
  error: {
    padding: "12px 14px",
    borderRadius: "14px",
    background: "#fff2f2",
    border: "1px solid #f0c3c3",
    color: "#972d2d",
    fontWeight: 600,
  },
  message: {
    padding: "12px 14px",
    borderRadius: "14px",
    background: "#eefbf3",
    border: "1px solid #cbe8d3",
    color: "#1f6b2a",
    fontWeight: 600,
  },
  statusArea: {
    minHeight: "36px",
    display: "grid",
    alignItems: "center",
  },
  statusPlaceholder: {
    minHeight: "36px",
  },
  selectionBar: {
    display: "flex",
    gap: "10px",
    alignItems: "stretch",
    flexWrap: "nowrap",
    zIndex: 5,
    padding: "10px",
    borderRadius: "18px",
    background: "rgba(246, 248, 251, 0.96)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 16px 30px rgba(52, 84, 120, 0.10)",
  },
  selectionBarLocked: {
    position: "static",
  },
  selectionBarUnlocked: {
    position: "fixed",
    top: "96px",
    left: "282px",
    right: "16px",
    zIndex: 20,
  },
  selectionNavCluster: {
    display: "grid",
    gridTemplateColumns: "34px 34px 34px",
    gap: "4px",
    alignItems: "stretch",
    flex: "0 0 auto",
  },
  selectionNavButton: {
    minHeight: "40px",
    minWidth: "34px",
    display: "grid",
    placeItems: "center",
    padding: 0,
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255,255,255,0.92)",
    color: "#36526f",
    fontSize: "18px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 16px rgba(52, 84, 120, 0.08)",
  },
  selectionAddButton: {
    minHeight: "40px",
    minWidth: "34px",
    display: "grid",
    placeItems: "center",
    padding: 0,
    borderRadius: "12px",
    border: "1px solid rgba(145, 197, 160, 0.35)",
    background: "linear-gradient(135deg, rgba(236, 250, 239, 0.98) 0%, rgba(214, 242, 220, 0.98) 100%)",
    color: "#4e8f63",
    fontSize: "20px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 16px rgba(52, 84, 120, 0.08)",
    flex: "0 0 auto",
  },
  selectionLockButton: {
    minHeight: "40px",
    minWidth: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    padding: 0,
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255,255,255,0.92)",
    color: "#36526f",
    fontSize: "16px",
    fontWeight: 800,
    letterSpacing: "0",
    cursor: "pointer",
    boxShadow: "0 8px 16px rgba(52, 84, 120, 0.08)",
    flex: "0 0 auto",
  },
  selectionLockButtonUnlocked: {
    background: "rgba(235, 247, 255, 0.96)",
    color: "#2f5f89",
  },
  selectionLockButtonLocked: {
    background: "linear-gradient(135deg, rgba(255, 236, 241, 0.98) 0%, rgba(255, 215, 226, 0.98) 100%)",
    border: "1px solid rgba(214, 106, 138, 0.28)",
    color: "#b23361",
  },
  selectionLockIcon: {
    display: "grid",
    placeItems: "center",
    width: "100%",
    fontSize: "16px",
    lineHeight: 1,
    filter: "grayscale(1) brightness(0)",
  },
  selectionLockText: {
    display: "none",
  },
  selectionDocsButton: {
    minHeight: "40px",
    minWidth: "68px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255,255,255,0.92)",
    color: "#36526f",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 16px rgba(52, 84, 120, 0.08)",
    flex: "0 0 auto",
  },
  selectionDocsButtonInactive: {
    background: "rgba(255,255,255,0.92)",
  },
  selectionDocsButtonActive: {
    background: "linear-gradient(135deg, rgba(235, 245, 255, 0.98) 0%, rgba(220, 236, 255, 0.98) 100%)",
    color: "#2f5f89",
  },
  selectionInputWrap: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
    flex: "1 1 auto",
  },
  selectionInputRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: "10px",
    alignItems: "stretch",
  },
  selectionInputStack: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
  },
  selectionInputLabel: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#6a7d92",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  selectionInlineError: {
    padding: "10px 12px",
    borderRadius: "12px",
    background: "#fff0f2",
    border: "1px solid #efc2cf",
    color: "#9a2c4d",
    fontSize: "13px",
    fontWeight: 700,
  },
  selectionInlineMessage: {
    padding: "10px 12px",
    borderRadius: "12px",
    background: "#eefbf3",
    border: "1px solid #cbe8d3",
    color: "#1f6b2a",
    fontSize: "13px",
    fontWeight: 700,
  },
  selectionInput: {
    minHeight: "52px",
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    padding: "0 14px",
    fontSize: "14px",
    color: "#17324f",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
    width: "100%",
    boxSizing: "border-box",
  },
  selectionMultiSelect: {
    minHeight: "96px",
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#17324f",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
    width: "100%",
    boxSizing: "border-box",
    overflowY: "auto",
  },
  selectionHint: {
    fontSize: "12px",
    color: "#6a7d92",
    fontWeight: 700,
    lineHeight: 1.35,
  },
  inlineCellInput: {
    width: "100%",
    minHeight: "34px",
    boxSizing: "border-box",
    border: "1px solid rgba(106, 137, 180, 0.42)",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.98)",
    padding: "6px 8px",
    color: "#17324f",
    font: "inherit",
    outline: "none",
  },
  inlineCellSelect: {
    width: "100%",
    minHeight: "34px",
    boxSizing: "border-box",
    border: "1px solid rgba(106, 137, 180, 0.42)",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.98)",
    padding: "6px 8px",
    color: "#17324f",
    font: "inherit",
    outline: "none",
  },
  inlineCellMultiSelect: {
    width: "100%",
    minHeight: "82px",
    boxSizing: "border-box",
    border: "1px solid rgba(106, 137, 180, 0.42)",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.98)",
    padding: "6px 8px",
    color: "#17324f",
    font: "inherit",
    outline: "none",
    overflowY: "auto",
  },
  selectionActionStack: {
    display: "grid",
    gridTemplateColumns: "auto auto auto",
    gap: "8px",
    alignItems: "stretch",
  },
  selectionActionDangerButton: {
    minWidth: "72px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(205, 90, 90, 0.35)",
    background: "linear-gradient(135deg, #fff2f2 0%, #ffe1e1 100%)",
    color: "#9a2828",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(191, 82, 82, 0.10)",
  },
  selectionActionRowDeleteButton: {
    minWidth: "94px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(166, 72, 95, 0.42)",
    background: "linear-gradient(135deg, rgba(255, 227, 235, 0.98) 0%, rgba(255, 204, 218, 0.98) 100%)",
    color: "#8e1f45",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(188, 84, 116, 0.12)",
  },
  sheetImageButton: {
    minWidth: "88px",
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid rgba(92, 120, 158, 0.32)",
    background: "linear-gradient(135deg, rgba(243, 249, 255, 0.98) 0%, rgba(228, 240, 255, 0.98) 100%)",
    color: "#27527d",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 16px rgba(52, 84, 120, 0.08)",
    height: "30px",
  },
  eobCellStack: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "2px",
    lineHeight: 1.05,
  },
  eobDocumentMarker: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "16px",
    padding: "1px 5px",
    borderRadius: "999px",
    background: "rgba(220, 236, 255, 0.95)",
    border: "1px solid rgba(94, 138, 186, 0.24)",
    color: "#2f5f89",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.03em",
  },
  sidebarQuickActionsCard: {
    padding: "12px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, rgba(242, 248, 255, 0.95) 0%, rgba(255, 239, 245, 0.88) 100%)",
    border: "1px solid rgba(176, 194, 218, 0.22)",
    display: "grid",
    gap: "10px",
  },
  sidebarActionDock: {
    display: "grid",
    gap: "8px",
    position: "sticky",
    top: "112px",
    alignSelf: "start",
    zIndex: 2,
  },
  sidebarQuickActionsTopRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "6px",
  },
  sidebarQuickActionsBottomRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "6px",
  },
  sidebarQuickActionButton: {
    height: "30px",
    minWidth: 0,
    borderRadius: "10px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255,255,255,0.96)",
    color: "#36526f",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 14px rgba(52, 84, 120, 0.06)",
    padding: 0,
  },
  sidebarQuickActionButtonUnlocked: {
    background: "rgba(235, 247, 255, 0.96)",
    color: "#2f5f89",
  },
  sidebarQuickActionButtonLocked: {
    background: "linear-gradient(135deg, rgba(255, 236, 241, 0.98) 0%, rgba(255, 215, 226, 0.98) 100%)",
    color: "#b23361",
  },
  sidebarQuickActionWideButton: {
    height: "32px",
    minWidth: 0,
    borderRadius: "10px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255,255,255,0.96)",
    color: "#36526f",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 14px rgba(52, 84, 120, 0.06)",
    padding: "0 8px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  postingDayLabel: {
    display: "grid",
    gap: "6px",
  },
  postingDayLabelText: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#34506d",
  },
  postingDayInput: {
    height: "36px",
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    padding: "0 12px",
    fontSize: "12px",
    color: "#17324f",
    background: "#fff",
  },
  postingDayBankDay: {
    marginTop: "6px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#35506d",
  },
  tableWrap: {
    minHeight: "420px",
    marginTop: "0",
    overflow: "auto",
    borderRadius: "22px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.9)",
    boxShadow: "0 18px 36px rgba(52, 84, 120, 0.06)",
  },
  tableWrapUnlocked: {
    position: "fixed",
    top: "184px",
    left: "282px",
    right: "16px",
    zIndex: 14,
    height: "calc(100vh - 200px)",
    maxHeight: "calc(100vh - 200px)",
    overflow: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    minWidth: "100%",
  },
  th: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "#f3f7fc",
    padding: "12px 12px 12px 10px",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#4d6177",
    borderBottom: "1px solid #d7e0ea",
    borderRight: "1px solid #e1e7ef",
    textAlign: "left",
    whiteSpace: "nowrap",
    overflow: "hidden",
    userSelect: "none",
    boxSizing: "border-box",
    verticalAlign: "middle",
  },
  headerButton: {
    width: "100%",
    padding: 0,
    border: 0,
    background: "transparent",
    color: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    cursor: "pointer",
    textAlign: "left",
  },
  thLabel: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    paddingRight: "10px",
  },
  sortIndicator: {
    flexShrink: 0,
    fontSize: "11px",
    letterSpacing: "0",
    color: "#7890a8",
  },
  resizeHandle: {
    position: "absolute",
    top: 0,
    right: 0,
    width: "8px",
    height: "100%",
    cursor: "col-resize",
    touchAction: "none",
  },
  td: {
    padding: "10px",
    borderBottom: "1px solid #edf1f5",
    borderRight: "1px solid #edf1f5",
    fontSize: "14px",
    color: "#23384f",
    verticalAlign: "top",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    outline: "none",
  },
  groupHeaderRow: {
    background: "rgba(241, 246, 252, 0.96)",
  },
  groupHeaderCell: {
    padding: "0",
    borderBottom: "1px solid #d8e1eb",
  },
  ediHighlightRow: {
    background: "#fff3a6",
  },
  groupHeaderButton: {
    width: "100%",
    minHeight: "42px",
    padding: "0 12px",
    border: 0,
    background: "linear-gradient(135deg, rgba(242,247,252,0.95) 0%, rgba(250,252,255,0.95) 100%)",
    color: "#17324f",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    cursor: "pointer",
    textAlign: "left",
    fontWeight: 800,
  },
  groupHeaderGlyph: {
    width: "18px",
    flexShrink: 0,
    color: "#4f6a84",
  },
  groupHeaderLabel: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  groupHeaderMeta: {
    flexShrink: 0,
    fontSize: "12px",
    fontWeight: 700,
    color: "#597087",
    whiteSpace: "nowrap",
  },
  numericTd: {
    padding: "10px",
    borderBottom: "1px solid #edf1f5",
    borderRight: "1px solid #edf1f5",
    fontSize: "14px",
    color: "#23384f",
    verticalAlign: "top",
    textAlign: "right",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    outline: "none",
  },
  cellFocused: {
    outline: "2px solid rgba(80, 140, 230, 0.55)",
    outlineOffset: "-2px",
    background: "rgba(222, 235, 255, 0.42)",
  },
  emptyStateTd: {
    padding: "28px 16px",
    textAlign: "center",
    color: "#5e6f82",
    fontSize: "14px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
};


