import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

export type ItemizationField =
  | "type"
  | "amount"
  | "payer"
  | "check_number"
  | "edi"
  | "poster"
  | "eob"
  | "unposted"
  | "misc"
  | "misc_type"
  | "notes"
  | "nick"
  | "raul"
  | "needs"
  | "from"
  | "to";

interface Item {
  id: number;
  importId: number;
  type: string | number;
  amount: number;
  payer?: string | number;
  check_number?: string | number;
  edi?: string | number;
  poster?: string | number;
  eob?: string | number;
  unposted?: string | number;
  misc?: string | number;
  misc_type?: string | number;
  notes?: string | number;
  nick?: string | number;
  raul?: string | number;
  needs?: string | number;
  from?: string | number;
  to?: string | number;
}

interface Props {
  items: Item[];
  selectedRowId: number | null;
  selectedField: ItemizationField;
  sheetLocked: boolean;
  onSelectCell: (rowId: number, field: ItemizationField) => void;
  onCommitCell: (rowId: number, field: ItemizationField, value: string) => void;
  onSort: (field: ItemizationField, direction: "asc" | "desc") => void;
  sortField: ItemizationField;
  sortDirection: "asc" | "desc";
}

export const itemizationSheetFields: ItemizationField[] = [
  "type",
  "amount",
  "payer",
  "check_number",
  "edi",
  "poster",
  "eob",
  "unposted",
  "misc",
  "misc_type",
  "notes",
  "nick",
  "raul",
  "needs",
  "from",
  "to",
];

const columns: Array<{ key: ItemizationField; label: string }> = [
  { key: "type", label: "Type" },
  { key: "amount", label: "Amount" },
  { key: "payer", label: "Payer" },
  { key: "check_number", label: "Check #" },
  { key: "edi", label: "EDI" },
  { key: "poster", label: "Poster" },
  { key: "eob", label: "EOB" },
  { key: "unposted", label: "UnPosted" },
  { key: "misc", label: "Misc" },
  { key: "misc_type", label: "Misc Type" },
  { key: "notes", label: "Notes" },
  { key: "nick", label: "Nick" },
  { key: "raul", label: "Raul" },
  { key: "needs", label: "Needs" },
  { key: "from", label: "From" },
  { key: "to", label: "To" },
];

const defaultColumnWidths: Record<string, number> = {
  type: 170,
  amount: 140,
  payer: 190,
  check_number: 150,
  edi: 130,
  poster: 150,
  eob: 130,
  unposted: 140,
  misc: 130,
  misc_type: 160,
  notes: 300,
  nick: 130,
  raul: 130,
  needs: 140,
  from: 140,
  to: 140,
};

const editableFields = new Set<ItemizationField>([
  "type",
  "amount",
  "payer",
  "check_number",
  "edi",
  "poster",
  "eob",
  "unposted",
  "misc",
  "misc_type",
  "notes",
  "nick",
  "raul",
  "needs",
  "from",
  "to",
]);

const numericFields = new Set<ItemizationField>(["amount", "unposted", "misc", "nick", "raul"]);

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function formatCellValue(item: Item, key: ItemizationField) {
  const value = item[key];

  if (value == null || value === "") {
    return "-";
  }

  if (key === "amount" || key === "unposted" || key === "misc" || key === "nick" || key === "raul") {
    return formatAmount(Number(value || 0));
  }

  return String(value);
}

function getRawCellValue(item: Item, key: ItemizationField) {
  const value = item[key];
  if (value == null) {
    return "";
  }

  if (numericFields.has(key)) {
    return String(value).replace(/[$,]/g, "");
  }

  return String(value);
}

const styles: Record<string, CSSProperties> = {
  root: {
    display: "grid",
    gap: "12px",
    minWidth: 0,
  },
  scrollToolbar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scrollGroup: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  scrollButton: {
    height: "38px",
    minWidth: "38px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(188, 193, 203, 0.68)",
    background: "rgba(255, 255, 255, 0.96)",
    color: "#15304f",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(119, 151, 198, 0.08)",
  },
  tableWrap: {
    maxHeight: "62vh",
    overflow: "auto",
    borderRadius: "20px",
    border: "1px solid rgba(165, 180, 200, 0.25)",
    background: "rgba(255, 255, 255, 0.86)",
    position: "relative",
  },
  table: {
    width: "100%",
    minWidth: "1820px",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  th: {
    position: "sticky",
    top: 0,
    zIndex: 1,
    padding: 0,
    background: "linear-gradient(180deg, rgba(252, 253, 255, 0.99) 0%, rgba(245, 248, 252, 0.99) 100%)",
    borderBottom: "1px solid rgba(221, 230, 239, 0.95)",
    borderRight: "1px solid rgba(224, 231, 239, 0.9)",
  },
  thInner: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "2px",
    minHeight: "48px",
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 2px 8px 12px",
    color: "#17314f",
    fontWeight: 900,
  },
  thLabelWrap: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    minWidth: 0,
    flex: "1 1 auto",
  },
  thLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "left",
    fontSize: "14px",
    letterSpacing: "0.01em",
  },
  sortGroup: {
    display: "flex",
    gap: "2px",
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    flexShrink: 0,
    justifyContent: "flex-end",
    marginLeft: "auto",
  },
  sortButton: {
    height: "20px",
    minWidth: "22px",
    padding: "0 4px",
    borderRadius: "999px",
    border: "1px solid rgba(190, 200, 213, 0.86)",
    background: "rgba(255, 255, 255, 0.9)",
    color: "#4b627b",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
  },
  sortButtonActive: {
    background: "linear-gradient(135deg, rgba(223, 236, 250, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)",
    borderColor: "rgba(106, 137, 180, 0.42)",
    color: "#17314f",
  },
  resizeHandle: {
    position: "absolute",
    top: 0,
    right: 0,
    width: "16px",
    height: "100%",
    cursor: "col-resize",
    touchAction: "none",
    borderRadius: "0",
    background: "linear-gradient(180deg, rgba(185, 200, 216, 0.08) 0%, rgba(185, 200, 216, 0.22) 50%, rgba(185, 200, 216, 0.08) 100%)",
  },
  td: {
    padding: "12px 14px",
    borderBottom: "1px solid rgba(214, 223, 233, 0.72)",
    borderRight: "1px solid rgba(224, 231, 239, 0.9)",
    color: "#20364f",
    fontSize: "14px",
    verticalAlign: "top",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    cursor: "pointer",
  },
  tdNotes: {
    whiteSpace: "normal",
    overflow: "hidden",
    textOverflow: "clip",
  },
  tdActions: {
    padding: "10px 12px",
    borderBottom: "1px solid rgba(214, 223, 233, 0.72)",
    borderRight: "1px solid rgba(224, 231, 239, 0.9)",
  },
  editButton: {
    height: "36px",
    padding: "0 14px",
    borderRadius: "12px",
    border: "1px solid rgba(188, 193, 203, 0.68)",
    background: "rgba(255, 255, 255, 0.96)",
    color: "#15304f",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(119, 151, 198, 0.08)",
  },
  emptyState: {
    padding: "18px",
    color: "#5d7187",
    textAlign: "center",
  },
  activeRow: {
    background: "rgba(231, 240, 247, 0.42)",
  },
  activeCell: {
    background: "rgba(219, 238, 255, 0.85)",
    boxShadow: "inset 0 0 0 1px rgba(106, 137, 180, 0.32)",
  },
  editingInput: {
    width: "100%",
    border: "1px solid rgba(106, 137, 180, 0.38)",
    borderRadius: "10px",
    background: "rgba(255, 255, 255, 0.98)",
    padding: "8px 10px",
    color: "#17314f",
    fontSize: "14px",
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  },
  editingWrap: {
    display: "grid",
    gap: "6px",
  },
  editingHint: {
    fontSize: "11px",
    color: "#6d7f93",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 800,
  },
};

export default function Itemization({
  items,
  selectedRowId,
  selectedField,
  sheetLocked,
  onSelectCell,
  onCommitCell,
  onSort,
  sortField,
  sortDirection,
}: Props) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(defaultColumnWidths);
  const [editingCell, setEditingCell] = useState<{ rowId: number; field: ItemizationField } | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const resizeStateRef = useRef<{ field: ItemizationField; startX: number; startWidth: number } | null>(null);

  const widthList = useMemo(
    () =>
      columns.map((column) => {
        const key = column.key;
        return `${columnWidths[key] ?? defaultColumnWidths[key] ?? 140}px`;
      }),
    [columnWidths]
  );

  const scrollBy = (left: number, top: number) => {
    const container = tableWrapRef.current;
    if (!container) return;

    container.scrollBy({ left, top, behavior: "smooth" });
  };

  const beginResize = (field: ItemizationField, event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      field,
      startX: event.clientX,
      startWidth: columnWidths[field] ?? defaultColumnWidths[field] ?? 140,
    };
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!resizeStateRef.current) return;

      const { field, startX, startWidth } = resizeStateRef.current;
      const nextWidth = Math.max(80, Math.round(startWidth + (event.clientX - startX)));

      setColumnWidths((current) => ({
        ...current,
        [field]: nextWidth,
      }));
    };

    const handlePointerUp = () => {
      resizeStateRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const openEditor = (rowId: number, field: ItemizationField) => {
    if (sheetLocked || !editableFields.has(field)) {
      onSelectCell(rowId, field);
      return;
    }

    const item = items.find((entry) => entry.id === rowId);
    if (!item) return;

    onSelectCell(rowId, field);
    setEditingCell({ rowId, field });
    setDraftValue(getRawCellValue(item, field));
  };

  const commitEditor = () => {
    if (!editingCell) return;

    onCommitCell(editingCell.rowId, editingCell.field, draftValue);
    setEditingCell(null);
  };

  return (
    <div style={styles.root}>
      <div style={styles.scrollToolbar}>
        <div style={styles.scrollGroup}>
          <button type="button" style={styles.scrollButton} onClick={() => scrollBy(-320, 0)} aria-label="Scroll left">
            ←
          </button>
          <button type="button" style={styles.scrollButton} onClick={() => scrollBy(320, 0)} aria-label="Scroll right">
            →
          </button>
          <button type="button" style={styles.scrollButton} onClick={() => scrollBy(0, -220)} aria-label="Scroll up">
            ↑
          </button>
          <button type="button" style={styles.scrollButton} onClick={() => scrollBy(0, 220)} aria-label="Scroll down">
            ↓
          </button>
        </div>
        <div style={styles.scrollGroup}>
          <button
            type="button"
            style={styles.scrollButton}
            onClick={() => {
              const container = tableWrapRef.current;
              if (!container) return;
              container.scrollTo({ left: 0, top: 0, behavior: "smooth" });
            }}
          >
            Top Left
          </button>
          <button
            type="button"
            style={styles.scrollButton}
            onClick={() => {
              const container = tableWrapRef.current;
              if (!container) return;
              container.scrollTo({ left: container.scrollWidth, top: container.scrollHeight, behavior: "smooth" });
            }}
          >
            Bottom Right
          </button>
        </div>
      </div>

      <div ref={tableWrapRef} style={styles.tableWrap}>
        <table style={styles.table}>
          <colgroup>
            {columns.map((column, index) => (
              <col key={column.key} style={{ width: widthList[index] }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((column) => {
                const isActiveSort = sortField === column.key;

                return (
                  <th key={column.key} style={styles.th}>
                    <div style={styles.thInner}>
                      <div style={styles.thLabelWrap}>
                        <span style={styles.thLabel}>{column.label}</span>
                        <div style={styles.sortGroup}>
                          <button
                            type="button"
                            style={{
                              ...styles.sortButton,
                              ...(isActiveSort && sortDirection === "asc" ? styles.sortButtonActive : {}),
                            }}
                            onClick={() => onSort(column.key as ItemizationField, "asc")}
                            title="Sort ascending"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            style={{
                              ...styles.sortButton,
                              ...(isActiveSort && sortDirection === "desc" ? styles.sortButtonActive : {}),
                            }}
                            onClick={() => onSort(column.key as ItemizationField, "desc")}
                            title="Sort descending"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                      <span
                        style={styles.resizeHandle}
                        onPointerDown={(event) => beginResize(column.key as ItemizationField, event)}
                        aria-label={`Resize ${column.label}`}
                        role="separator"
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td style={styles.emptyState} colSpan={columns.length}>
                  No itemization rows yet. Create a row above to start building the sheet.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isSelectedRow = selectedRowId === item.id;

                return (
                  <tr key={item.id} style={isSelectedRow ? styles.activeRow : undefined}>
                    {itemizationSheetFields.map((field) => {
                      const isSelectedCell = isSelectedRow && selectedField === field;
                      const isEditing = editingCell?.rowId === item.id && editingCell.field === field;
                      const cellStyle = {
                        ...styles.td,
                        ...(field === "notes" ? styles.tdNotes : {}),
                        ...(isSelectedCell ? styles.activeCell : {}),
                      };

                      return (
                        <td
                          key={field}
                          style={cellStyle}
                          onClick={() => onSelectCell(item.id, field)}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            openEditor(item.id, field);
                          }}
                        >
                          {isEditing ? (
                            <div style={styles.editingWrap}>
                              <input
                                autoFocus
                                value={draftValue}
                                onChange={(event) => setDraftValue(event.target.value)}
                                onBlur={commitEditor}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    commitEditor();
                                  }
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    setEditingCell(null);
                                  }
                                }}
                                style={styles.editingInput}
                                aria-label={`${field} cell editor`}
                              />
                              <div style={styles.editingHint}>{sheetLocked ? "Locked" : "Editing"}</div>
                            </div>
                          ) : (
                            formatCellValue(item, field)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
