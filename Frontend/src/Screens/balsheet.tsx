import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  clearBalsheet,
  createBalsheetEntry,
  deleteBalsheetEntry,
  getBalsheet,
  getBalsheetNotes,
  getBalsheetWorkday,
  importBalsheetFromBanking,
  updateBalsheetEntry,
  upsertBalsheetNoteText,
  upsertBalsheetNoteMessage,
  type BalsheetEntry,
} from "../api/balsheet_api";

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

const sheetColumns: Array<{ key: "entry_id" | keyof BalsheetEntry; label: string; numeric?: boolean }> = [
  { key: "entry_id", label: "EntryID" },
  ...columns,
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
};

function parseAmount(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: unknown) {
  return parseAmount(value).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
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

export default function Balsheet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [sheetLocked, setSheetLocked] = useState(true);
  const [heroNote, setHeroNote] = useState("");
  const [heroMessage, setHeroMessage] = useState("");
  const resizeStateRef = useRef<{
    key: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const cellRefs = useRef<Array<Array<HTMLTableCellElement | null>>>([]);
  const selectionInputRef = useRef<HTMLInputElement | null>(null);

  const postingDateIso = displayDateToIso(postingDate);

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

    const groupEntries = Array.from(groupMap.entries()).sort(([leftKey], [rightKey]) => {
      const direction = sortField === "type" ? sortDirection : "asc";
      const comparison = leftKey.localeCompare(rightKey, undefined, { sensitivity: "base" });
      return direction === "asc" ? comparison : -comparison;
    });

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
        : column.numeric
          ? formatCurrency(row[column.key])
          : String(row[column.key] ?? "");

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
      selectionInputRef.current?.focus();
      selectionInputRef.current?.select();
    }
  }, [isEditingSelection]);

  useEffect(() => {
    if (sheetLocked) {
      setIsEditingSelection(false);
    }
  }, [sheetLocked]);

  async function updateSelectedCell(nextValue: string) {
    if (!selectedCell?.rowId || !selectedCell.row) {
      return;
    }

    if (selectedCell.columnKey === "entry_id") {
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

    const response = await updateBalsheetEntry(selectedCell.rowId, nextRow);
    setRows((previousRows) =>
      previousRows.map((row) => (row.entry_id === selectedCell.rowId ? response.data : row))
    );
  }

  function handleEditSelectedCell() {
    if (!selectedCell) {
      return;
    }

    if (sheetLocked) {
      setError(null);
      setMessage("Cell locked.");
      return;
    }

    if (!isEditingSelection) {
      setSelectionDraft(selectedCell.value ?? "");
      setIsEditingSelection(true);
      return;
    }

    void (async () => {
      setLoading(true);
      setMessage(null);
      try {
        await updateSelectedCell(selectionDraft);
        setError(null);
        setMessage(`Saved ${selectedCell.label} for ${selectedCell.address}.`);
        setIsEditingSelection(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save cell");
      } finally {
        setLoading(false);
      }
    })();
  }

  function handleSelectionInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!isEditingSelection) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void (async () => {
        setLoading(true);
        setMessage(null);
        try {
          await updateSelectedCell(selectionDraft);
          setError(null);
          setMessage(`Saved ${selectedCell?.label ?? "cell"} for ${selectedCell?.address ?? ""}.`);
          setIsEditingSelection(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to save cell");
        } finally {
          setLoading(false);
        }
      })();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setSelectionDraft(selectedCell?.value ?? "");
      setIsEditingSelection(false);
    }
  }

  function handleClearSelectedCell() {
    if (!selectedCell) {
      return;
    }

    if (sheetLocked) {
      setError(null);
      setMessage("Cell locked.");
      return;
    }

    if (!window.confirm(`Clear ${selectedCell.label} for ${selectedCell.address}?`)) {
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
    setSheetLocked((current) => !current);
    setMessage(null);
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

    const groupEntries = Array.from(groupMap.entries()).sort(([leftKey], [rightKey]) => {
      const direction = sortField === "type" ? sortDirection : "asc";
      const comparison = leftKey.localeCompare(rightKey, undefined, { sensitivity: "base" });
      return direction === "asc" ? comparison : -comparison;
    });

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
      return "↕";
    }

    return sortDirection === "asc" ? "↑" : "↓";
  }

  async function loadRows(date = postingDate) {
    let loadedRows: BalsheetEntry[] = [];
    setLoading(true);
    setMessage(null);
    try {
      const [rowsResponse, notesResponse] = await Promise.all([getBalsheet(date), getBalsheetNotes(date)]);
      loadedRows = rowsResponse.data;
      setRows(loadedRows);
      const savedNote = String(notesResponse.data[0]?.notes ?? "").trim();
      const savedMessage = String(notesResponse.data[0]?.message ?? "").trim();
      setHeroNote(savedNote);
      if (!savedMessage && isWeekendPostingDate(date)) {
        await upsertBalsheetNoteMessage(date, weekendHeroMessage);
        setHeroMessage(weekendHeroMessage);
      } else {
        setHeroMessage(savedMessage);
      }
      setError(null);
    } catch (err) {
      setRows([]);
      setHeroNote("");
      setHeroMessage("");
      setError(err instanceof Error ? err.message : "Failed to load Balsheet");
    } finally {
      setLoading(false);
    }

    return loadedRows;
  }

  async function importBankingRows() {
    const targetBankDay = currentBankDay;
    if (!targetBankDay) {
      setError("No bank day is available for importing banking rows.");
      return;
    }
    const selectedPostingDay = postingDate || normalizeDisplayDate(day) || "";
    if (!selectedPostingDay) {
      setError("No posting day is available for importing banking rows.");
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
        setCurrentBankDay(response.data.current_bank_day || "");
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

  if (loading) {
    return <main style={styles.page}>Loading Balsheet...</main>;
  }

  return (
    <main style={styles.shell}>
      <div style={styles.glowBlue} />
      <div style={styles.glowPink} />

      <aside style={styles.sidebar}>
        <div style={styles.brandWrap}>
          <div style={styles.brandMark} aria-hidden="true">
            <img src="/favicon.svg" alt="" style={styles.brandMarkImage} />
          </div>
          <div style={styles.brandWomenMark} aria-hidden="true">
            <img src="/renfrew-gazebo.png" alt="" style={styles.brandWomenImage} />
          </div>
        </div>

        <p style={styles.sidebarCopy}>Read-only balance sheet view for the current posting day.</p>

        <nav style={styles.navStack} aria-label="Balance sheet navigation">
          <button
            className="sidebar-nav-button"
            style={styles.navButton}
            type="button"
            onClick={() => navigate("/cash")}
          >
            <span style={styles.navButtonLabel}>Back</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>
              &gt;
            </span>
          </button>
        </nav>

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
      </aside>

      <section style={styles.content}>
        <section style={styles.heroShell}>
            <div style={styles.heroCopy}>
              <div style={styles.kicker}>Balance Sheet</div>
              <h1 style={styles.title}>Balsheet</h1>
              <p style={styles.subtitle}>{heroMessage || "\u00A0"}</p>
              <div style={styles.heroActions}>
                <button style={styles.primaryButton} type="button" onClick={() => loadRows()}>
                  Refresh
                </button>
                <button style={styles.secondaryButton} type="button" onClick={() => importBankingRows()}>
                  Import Banking
                </button>
                <button style={styles.dangerButton} type="button" onClick={() => clearCurrentBalsheet()}>
                  Clear Balsheet
                </button>
                <button style={styles.secondaryButton} type="button" onClick={() => editHeroMessage()}>
                  Edit Message
                </button>
              </div>
            </div>

          <div style={styles.heroArt}>
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

        <div style={styles.selectionBar}>
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
              {sheetLocked ? "🔒" : "🔓"}
            </span>
            <span style={styles.selectionLockText}>Lock Sheet</span>
          </button>
          <div style={styles.selectionInputWrap}>
            <div style={styles.selectionInputLabel}>{selectedCell?.label ?? "Active cell"}</div>
            <div style={styles.selectionInputRow}>
              <input
                ref={selectionInputRef}
                readOnly={!isEditingSelection || sheetLocked}
                value={selectedCell ? selectionDraft : "Select a cell to view its contents"}
                onChange={(event) => setSelectionDraft(event.target.value)}
                onKeyDown={handleSelectionInputKeyDown}
                style={styles.selectionInput}
                aria-label="Active cell value"
              />
              <div style={styles.selectionActionStack}>
                <button type="button" style={styles.selectionActionButton} onClick={handleEditSelectedCell}>
                  {isEditingSelection ? "Save" : "Edit"}
                </button>
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

        <div style={styles.tableWrap}>
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
                    <button type="button" style={styles.headerButton} onClick={() => toggleSort(column.key)}>
                      <span style={styles.thLabel}>{column.label}</span>
                      <span style={styles.sortIndicator}>{getSortIndicator(column.key)}</span>
                    </button>
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
                                  style={getCellStyle(!!column.numeric, rowIndex, columnIndex)}
                                >
                                  {column.key === "entry_id"
                                    ? row.entry_id
                                    : column.numeric
                                      ? formatCurrency(row[column.key])
                                      : String(row[column.key] ?? "")}
                                </td>
                              ))}
                            </tr>
                          );
                        });

                    return [
                      <tr key={`group-${group.groupKey}`} style={styles.groupHeaderRow}>
                        <td style={styles.groupHeaderCell} colSpan={sheetColumns.length}>
                          <button type="button" style={styles.groupHeaderButton} onClick={() => toggleGroup(group.groupKey)}>
                            <span style={styles.groupHeaderGlyph}>{isCollapsed ? "▸" : "▾"}</span>
                            <span style={styles.groupHeaderLabel}>{group.groupKey}</span>
                            <span style={styles.groupHeaderMeta}>
                              {group.rows.length} row{group.rows.length === 1 ? "" : "s"} · {formatCurrency(group.totals.amount)} amount
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
    </main>
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
    marginTop: "18px",
    padding: "16px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, rgba(235, 245, 255, 0.95) 0%, rgba(255, 234, 243, 0.90) 100%)",
    border: "1px solid rgba(176, 194, 218, 0.22)",
  },
  sidebarTotalsCard: {
    marginTop: "14px",
    padding: "14px 16px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, rgba(243, 248, 255, 0.96) 0%, rgba(255, 244, 248, 0.92) 100%)",
    border: "1px solid rgba(176, 194, 218, 0.20)",
  },
  sidebarCardLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
    marginBottom: "8px",
  },
  sidebarCardValue: {
    fontSize: "18px",
    fontWeight: 800,
    marginBottom: "8px",
  },
  sidebarCardMeta: {
    fontSize: "13px",
    lineHeight: 1.55,
    color: "#5d7187",
  },
  sidebarTotalsGrid: {
    display: "grid",
    gap: "8px",
  },
  sidebarTotalsEmpty: {
    padding: "6px 0 2px",
    fontSize: "13px",
    color: "#5e6f82",
    fontWeight: 600,
  },
  sidebarTotalsRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "12px",
  },
  sidebarTotalsLabel: {
    fontSize: "13px",
    color: "#5e6f82",
    fontWeight: 700,
  },
  sidebarTotalsValue: {
    fontSize: "14px",
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
  heroActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "14px",
  },
  primaryButton: {
    height: "44px",
    padding: "0 18px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.95)",
    color: "#3f4a57",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 22px rgba(52, 84, 120, 0.08)",
  },
  secondaryButton: {
    height: "44px",
    padding: "0 18px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.95)",
    color: "#3f4a57",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 22px rgba(52, 84, 120, 0.08)",
  },
  dangerButton: {
    height: "44px",
    padding: "0 18px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.95)",
    color: "#3f4a57",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 22px rgba(52, 84, 120, 0.08)",
  },
  heroArt: {
    display: "grid",
    alignContent: "center",
  },
  heroStatusCard: {
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
    display: "grid",
    gridTemplateColumns: "110px 40px minmax(0, 1fr)",
    gap: "10px",
    alignItems: "stretch",
  },
  selectionNavCluster: {
    display: "grid",
    gridTemplateColumns: "34px 34px 34px",
    gap: "4px",
    alignItems: "stretch",
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
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255,255,255,0.92)",
    color: "#2f6fb5",
    fontSize: "20px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 16px rgba(52, 84, 120, 0.08)",
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
  selectionInputWrap: {
    display: "grid",
    gap: "6px",
  },
  selectionInputRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: "10px",
    alignItems: "stretch",
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
  selectionActionStack: {
    display: "grid",
    gridTemplateColumns: "auto auto auto",
    gap: "8px",
    alignItems: "stretch",
  },
  selectionActionButton: {
    minWidth: "62px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(156, 176, 201, 0.40)",
    background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(235,242,250,0.98) 100%)",
    color: "#23405e",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(94, 120, 154, 0.10)",
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
  postingDayLabel: {
    display: "grid",
    gap: "6px",
  },
  postingDayLabelText: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#34506d",
  },
  postingDayInput: {
    height: "36px",
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    padding: "0 12px",
    fontSize: "14px",
    color: "#17324f",
    background: "#fff",
  },
  postingDayBankDay: {
    marginTop: "6px",
    fontSize: "13px",
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
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    minWidth: "100%",
  },
  th: {
    position: "sticky",
    top: 0,
    zIndex: 1,
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
