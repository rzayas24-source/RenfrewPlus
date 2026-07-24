import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ItemizationGrid, { type ItemizationField } from "./itemizationgrid";

type ItemizationForm = Record<ItemizationField, string | number>;

type ItemizationItem = ItemizationForm & {
  id: number;
  importId: number;
  type: string;
  amount: number;
  misc: number;
};

function parseAmount(value: unknown) {
  const parsed = Number.parseFloat(String(value || "").replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: unknown) {
  return parseAmount(value).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function keyproofStorageKey(id: string) {
  return `keyproof:${id}`;
}

function getRequiredTotal(attachmentId: string | null, fallback: string | null) {
  if (attachmentId) {
    const saved = window.localStorage.getItem(keyproofStorageKey(attachmentId));

    if (saved) {
      try {
        const keyproof = JSON.parse(saved) as Record<string, string>;
        return ["cash", "check", "creditCard", "foreignCheck", "wireTransfer", "misc"].reduce(
          (total, field) => total + parseAmount(keyproof[field]),
          0
        );
      } catch {
        window.localStorage.removeItem(keyproofStorageKey(attachmentId));
      }
    }
  }

  return parseAmount(fallback);
}

function makeInitialForm(type: string): ItemizationForm {
  return {
    type,
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
    from: "",
    to: "",
  };
}

function applyPosterBalance(form: ItemizationForm) {
  const amount = parseAmount(form.amount);
  const poster = String(form.poster || "");

  if (poster === "Nick") {
    return { ...form, nick: formatCurrency(amount), raul: formatCurrency(0) };
  }

  if (poster === "Raul") {
    return { ...form, nick: formatCurrency(0), raul: formatCurrency(amount) };
  }

  return { ...form, nick: formatCurrency(0), raul: formatCurrency(0) };
}

const buttonStyle: CSSProperties = {
  height: "44px",
  padding: "0 18px",
  borderRadius: "14px",
  border: "1px solid rgba(188, 193, 203, 0.68)",
  background: "rgba(255, 255, 255, 0.96)",
  color: "#15304f",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 14px 24px rgba(119, 151, 198, 0.10)",
};

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: "100vh",
    padding: "18px",
    position: "relative",
    overflowX: "hidden",
    overflowY: "auto",
    color: "#16304d",
    background:
      "radial-gradient(circle at top left, rgba(146, 198, 255, 0.22) 0%, rgba(146, 198, 255, 0) 34%), radial-gradient(circle at top right, rgba(255, 186, 213, 0.18) 0%, rgba(255, 186, 213, 0) 30%), linear-gradient(180deg, #f6f9fc 0%, #eef4fb 100%)",
  },
  content: {
    position: "relative",
    zIndex: 1,
    maxWidth: "1600px",
    margin: "0 auto",
    display: "grid",
    gap: "18px",
    width: "100%",
    minWidth: 0,
  },
  headerCard: {
    borderRadius: "28px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.74)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.10)",
    padding: "22px 24px",
    display: "grid",
    gap: "18px",
    gridTemplateColumns: "minmax(0, 1fr)",
    alignItems: "center",
    minWidth: 0,
  },
  kicker: {
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: "12px",
    fontWeight: 800,
    color: "#74879c",
    marginBottom: "8px",
  },
  title: {
    margin: 0,
    fontSize: "38px",
    lineHeight: 1.05,
    fontWeight: 900,
    color: "#17314f",
  },
  subtitle: {
    margin: "10px 0 0",
    maxWidth: "760px",
    fontSize: "16px",
    lineHeight: 1.7,
    color: "#536579",
  },
  headerActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "18px",
  },
  sheetCard: {
    borderRadius: "28px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.74)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.10)",
    padding: "8px 16px 10px",
    minWidth: 0,
  },
  sheetSectionHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "12px",
    alignItems: "center",
    marginBottom: "16px",
  },
  sectionKicker: {
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    fontSize: "12px",
    fontWeight: 800,
    color: "#74879c",
    marginBottom: "8px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 900,
    color: "#17314f",
  },
  sectionMeta: {
    fontSize: "14px",
    lineHeight: 1.55,
    color: "#5d7187",
    maxWidth: "100%",
    textAlign: "left",
  },
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
    marginTop: "2px",
  },
  toolbarGroup: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
    minWidth: 0,
  },
  controlButton: {
    ...buttonStyle,
    minWidth: "44px",
    padding: "0 14px",
    flex: "0 0 auto",
  },
  controlButtonDanger: {
    ...buttonStyle,
    borderColor: "rgba(224, 180, 180, 0.8)",
    flex: "0 0 auto",
  },
  previewWrap: {
    display: "grid",
    gap: "4px",
    flex: "1 1 280px",
    minWidth: "220px",
    alignSelf: "center",
  },
  previewLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  previewInput: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(188, 193, 203, 0.86)",
    background: "rgba(255, 255, 255, 0.98)",
    color: "#17314f",
    fontSize: "15px",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.7)",
  },
  previewInputReadonly: {
    background: "#f2f5f9",
    color: "#556173",
  },
  summaryBar: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
    marginTop: "16px",
  },
  summaryChip: {
    borderRadius: "16px",
    padding: "12px 14px",
    border: "1px solid rgba(188, 193, 203, 0.68)",
    background: "rgba(255, 255, 255, 0.96)",
    boxShadow: "0 12px 22px rgba(119, 151, 198, 0.08)",
  },
  summaryLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
    marginBottom: "6px",
  },
  summaryValue: {
    fontSize: "18px",
    fontWeight: 900,
    color: "#17314f",
  },
  summaryValueGood: {
    color: "#1f6b2a",
  },
  summaryValueWarn: {
    color: "#a15c00",
  },
  footerBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: "16px",
  },
  footerMeta: {
    fontSize: "14px",
    color: "#5d7187",
  },
  selectionTip: {
    borderRadius: "16px",
    padding: "12px 14px",
    background: "rgba(255, 255, 255, 0.86)",
    border: "1px solid rgba(176, 194, 218, 0.22)",
    color: "#5d7187",
    fontSize: "14px",
  },
  lockedBadge: {
    borderRadius: "999px",
    padding: "8px 12px",
    background: "transparent",
    border: 0,
    fontWeight: 800,
  },
  lockedBadgeLocked: {
    color: "#b42318",
  },
  lockedBadgeUnlocked: {
    color: "#067647",
  },
  pdfOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(19, 31, 46, 0.26)",
    backdropFilter: "blur(6px)",
    display: "block",
    padding: "0",
  },
  pdfWindow: {
    position: "absolute",
    width: "min(1180px, calc(100vw - 36px))",
    height: "min(84vh, 900px)",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.24)",
    background: "rgba(255,255,255,0.98)",
    boxShadow: "0 28px 70px rgba(11, 24, 40, 0.26)",
    overflow: "hidden",
    resize: "both",
    minWidth: "720px",
    minHeight: "520px",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },
  pdfHeader: {
    flex: "0 0 auto",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    padding: "14px 16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.18)",
    background: "linear-gradient(180deg, rgba(248, 250, 253, 0.98) 0%, rgba(241, 245, 250, 0.98) 100%)",
  },
  pdfTitle: {
    fontSize: "16px",
    fontWeight: 900,
    color: "#17314f",
  },
  pdfMeta: {
    marginTop: "4px",
    fontSize: "13px",
    color: "#5f6b7a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "44vw",
  },
  pdfControls: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  pdfControlButton: {
    height: "38px",
    minWidth: "38px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.24)",
    background: "#ffffff",
    color: "#35506d",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(52, 84, 120, 0.08)",
  },
  pdfCloseButton: {
    height: "38px",
    minWidth: "38px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(200, 90, 90, 0.28)",
    background: "#fff5f5",
    color: "#a32121",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(52, 84, 120, 0.08)",
  },
  pdfBody: {
    flex: "1 1 auto",
    minHeight: 0,
    overflow: "hidden",
    background: "#eef3f8",
  },
  pdfStageWrap: {
    width: "100%",
    height: "100%",
    overflow: "auto",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "16px",
    boxSizing: "border-box",
  },
  pdfStage: {
    width: "100%",
    height: "100%",
    transformOrigin: "top center",
  },
  pdfFrame: {
    width: "100%",
    height: "100%",
    border: 0,
    borderRadius: "18px",
    background: "#ffffff",
  },
  pdfDock: {
    position: "fixed",
    right: "18px",
    bottom: "18px",
    zIndex: 1001,
    height: "44px",
    padding: "0 16px",
    borderRadius: "999px",
    border: "1px solid rgba(140, 160, 184, 0.24)",
    background: "rgba(255,255,255,0.96)",
    color: "#17314f",
    fontWeight: 900,
    boxShadow: "0 18px 34px rgba(11, 24, 40, 0.20)",
    cursor: "pointer",
  },
};

export default function Itemization() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const attachmentId = searchParams.get("attachmentId");
  const site = searchParams.get("site") || "";
  const importId = Number(attachmentId || 0);
  const storageKey = attachmentId ? `itemization:${attachmentId}` : "";

  const [items, setItems] = useState<ItemizationItem[]>(() => {
    if (!storageKey) return [];
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return [];
    try {
      return JSON.parse(saved) as ItemizationItem[];
    } catch {
      window.localStorage.removeItem(storageKey);
      return [];
    }
  });

  const [sortField, setSortField] = useState<ItemizationField>("poster");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [selectedField, setSelectedField] = useState<ItemizationField>("type");
  const [selectionDraft, setSelectionDraft] = useState("");
  const [isEditingSelection, setIsEditingSelection] = useState(false);
  const [sheetLocked, setSheetLocked] = useState(true);
  const [originalPdfOpen, setOriginalPdfOpen] = useState(false);
  const [originalPdfMinimized, setOriginalPdfMinimized] = useState(false);
  const [originalPdfZoom, setOriginalPdfZoom] = useState(1);
  const [originalPdfPosition, setOriginalPdfPosition] = useState({ x: 0, y: 0 });
  const [originalPdfSize, setOriginalPdfSize] = useState({ width: 0, height: 0 });
  const [originalPdfScroll, setOriginalPdfScroll] = useState({ left: 0, top: 0 });
  const [originalPdfDragging, setOriginalPdfDragging] = useState(false);
  const originalPdfDragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const originalPdfWindowRef = useRef<HTMLDivElement | null>(null);
  const originalPdfScrollRef = useRef<HTMLDivElement | null>(null);
  const requiredTotal = getRequiredTotal(attachmentId, searchParams.get("requiredTotal"));

  useEffect(() => {
    if (selectedRowId != null || items.length === 0) {
      return;
    }

    const firstRow = items[0];
    if (firstRow) {
      setSelectedRowId(firstRow.id);
      setSelectedField("type");
      setSelectionDraft(String(firstRow.type ?? ""));
    }
  }, [items, selectedRowId]);

  const saveItems = (nextItems: ItemizationItem[]) => {
    setItems(nextItems);
    if (storageKey) {
      window.localStorage.setItem(storageKey, JSON.stringify(nextItems));
    }
  };

  const updateField = (field: ItemizationField, value: string) => {
    setSelectionDraft(value);
    if (selectedRowId == null || !isEditingSelection || sheetLocked) {
      return;
    }

    commitCellValue(selectedRowId, field, value);
  };

  const commitCellValue = (rowId: number, field: ItemizationField, value: string) => {
    const nextDraft = field === "amount" || field === "unposted" || field === "misc" || field === "nick" || field === "raul"
      ? formatCurrency(value)
      : value;

    saveItems(
      items.map((item) => {
        if (item.id !== rowId) return item;

        const nextItem = { ...item, [field]: value } as ItemizationItem;
        if (field === "amount" || field === "poster") {
          return applyPosterBalance(nextItem) as ItemizationItem;
        }
        if (field === "unposted" || field === "misc" || field === "nick" || field === "raul") {
          return { ...nextItem, [field]: formatCurrency(value) } as ItemizationItem;
        }
        return nextItem;
      })
    );

    if (selectedRowId === rowId && selectedField === field) {
      setSelectionDraft(nextDraft);
    }
  };

  const selectedRow = useMemo(() => items.find((item) => item.id === selectedRowId) || null, [items, selectedRowId]);

  const sortedItems = useMemo(() => {
    const nextItems = [...items];
    const numericSortFields = new Set<ItemizationField>(["amount", "unposted", "misc", "nick", "raul"]);

    nextItems.sort((left, right) => {
      const leftValue = left[sortField];
      const rightValue = right[sortField];
      let comparison = 0;

      if (numericSortFields.has(sortField)) {
        comparison = parseAmount(leftValue) - parseAmount(rightValue);
      } else {
        comparison = String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, {
          sensitivity: "base",
        });
      }

      if (comparison === 0) {
        comparison = Number(left.id) - Number(right.id);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return nextItems;
  }, [items, sortDirection, sortField]);

  const sortedSelectedIndex = useMemo(
    () => sortedItems.findIndex((item) => item.id === selectedRowId),
    [selectedRowId, sortedItems]
  );

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, item) => ({
          total: acc.total + Number(item.amount || 0),
        }),
        { total: 0 }
      ),
    [items]
  );

  const remaining = requiredTotal - totals.total;

  const titleText = attachmentId ? `Attachment #${attachmentId}` : "Itemization sheet";

  const syncSelectionDraftFromSelection = (rowId: number, field: ItemizationField) => {
    const row = items.find((item) => item.id === rowId);
    if (!row) return;

    const value = row[field];
    setSelectionDraft(field === "amount" || field === "unposted" || field === "misc" || field === "nick" || field === "raul" ? formatCurrency(value) : String(value ?? ""));
  };

  const selectCell = (rowId: number, field: ItemizationField) => {
    setSelectedRowId(rowId);
    setSelectedField(field);
    setIsEditingSelection(false);
    syncSelectionDraftFromSelection(rowId, field);
  };

  const createRow = () => {
    const nextItem: ItemizationItem = {
      ...makeInitialForm(site),
      id: Date.now(),
      importId,
      type: site,
      amount: 0,
      misc: 0,
    } as ItemizationItem;

    saveItems([...items, nextItem]);
    setSelectedRowId(nextItem.id);
    setSelectedField("type");
    setSelectionDraft(String(nextItem.type || ""));
    setIsEditingSelection(true);
    setSheetLocked(false);
  };

  const openOriginalPdf = () => {
    if (!attachmentId) return;
    setOriginalPdfPosition({
      x: Math.max(16, Math.round(window.innerWidth * 0.08)),
      y: Math.max(16, Math.round(window.innerHeight * 0.08)),
    });
    setOriginalPdfSize({
      width: Math.min(1180, Math.max(720, Math.round(window.innerWidth * 0.84))),
      height: Math.min(900, Math.max(520, Math.round(window.innerHeight * 0.84))),
    });
    setOriginalPdfOpen(true);
    setOriginalPdfMinimized(false);
    setOriginalPdfZoom(1);
    setOriginalPdfScroll({ left: 0, top: 0 });
  };

  const minimizeOriginalPdf = () => {
    if (originalPdfWindowRef.current) {
      const rect = originalPdfWindowRef.current.getBoundingClientRect();
      setOriginalPdfSize({
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      });
    }
    if (originalPdfScrollRef.current) {
      setOriginalPdfScroll({
        left: originalPdfScrollRef.current.scrollLeft,
        top: originalPdfScrollRef.current.scrollTop,
      });
    }
    setOriginalPdfMinimized(true);
  };

  const restoreOriginalPdf = () => {
    setOriginalPdfMinimized(false);
  };

  const closeOriginalPdf = () => {
    setOriginalPdfOpen(false);
    setOriginalPdfMinimized(false);
    setOriginalPdfZoom(1);
    setOriginalPdfDragging(false);
    originalPdfDragRef.current = null;
  };

  const zoomOriginalPdfIn = () => {
    setOriginalPdfZoom((current) => Math.min(current + 0.25, 3));
  };

  const zoomOriginalPdfOut = () => {
    setOriginalPdfZoom((current) => Math.max(current - 0.25, 0.5));
  };

  const resetOriginalPdfZoom = () => {
    setOriginalPdfZoom(1);
  };

  const onOriginalPdfHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement | null)?.closest("button")) {
      return;
    }

    event.preventDefault();
    originalPdfDragRef.current = {
      offsetX: event.clientX - originalPdfPosition.x,
      offsetY: event.clientY - originalPdfPosition.y,
    };
    setOriginalPdfDragging(true);
  };

  useEffect(() => {
    if (!originalPdfDragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!originalPdfDragRef.current) return;

      setOriginalPdfPosition({
        x: Math.max(12, event.clientX - originalPdfDragRef.current.offsetX),
        y: Math.max(12, event.clientY - originalPdfDragRef.current.offsetY),
      });
    };

    const handlePointerUp = () => {
      setOriginalPdfDragging(false);
      originalPdfDragRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [originalPdfDragging]);

  useEffect(() => {
    if (!originalPdfOpen || originalPdfMinimized || !originalPdfWindowRef.current) {
      return;
    }

    const windowElement = originalPdfWindowRef.current;
    const observer = new ResizeObserver(() => {
      const rect = windowElement.getBoundingClientRect();
      setOriginalPdfSize({
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      });
    });

    observer.observe(windowElement);

    const rect = windowElement.getBoundingClientRect();
    setOriginalPdfSize({
      width: Math.max(0, Math.round(rect.width)),
      height: Math.max(0, Math.round(rect.height)),
    });

    return () => observer.disconnect();
  }, [originalPdfOpen, originalPdfMinimized]);

  useEffect(() => {
    if (!originalPdfOpen || originalPdfMinimized || !originalPdfScrollRef.current) {
      return;
    }

    originalPdfScrollRef.current.scrollLeft = originalPdfScroll.left;
    originalPdfScrollRef.current.scrollTop = originalPdfScroll.top;
  }, [originalPdfOpen, originalPdfMinimized, originalPdfScroll.left, originalPdfScroll.top]);

  const handleClearSelectedCell = () => {
    if (selectedRowId == null || sheetLocked) return;
    commitCellValue(selectedRowId, selectedField, "");
    setSelectionDraft("");
    setIsEditingSelection(true);
  };

  const handleDeleteSelectedRow = () => {
    if (selectedRowId == null || sheetLocked) return;

    const nextItems = items.filter((item) => item.id !== selectedRowId);
    saveItems(nextItems);

    if (nextItems.length === 0) {
      setSelectedRowId(null);
      setSelectionDraft("");
      setIsEditingSelection(false);
      return;
    }

    const nextSelected = nextItems[Math.min(nextItems.length - 1, Math.max(0, sortedSelectedIndex))];
    setSelectedRowId(nextSelected.id);
    setSelectedField("type");
    setSelectionDraft(String(nextSelected.type ?? ""));
  };

  const handleSort = (field: ItemizationField, direction: "asc" | "desc") => {
    setSortField(field);
    setSortDirection(direction);
  };

  const selectedPreviewLabel = selectedRow ? `${selectedField} - row ${selectedRow.id}` : "";
  const selectedPreviewValue = selectedRow ? selectionDraft : "Select a cell in the grid";

  return (
    <main style={styles.shell}>
      <div style={styles.content}>
        <section style={styles.headerCard}>
          <div>
            <div style={styles.kicker}>Spreadsheet workflow</div>
            <h1 style={styles.title}>Itemization</h1>
            <p style={styles.subtitle}>
              Spreadsheet-style review with the control row you preferred, replacing the old vertical entry inputs.
            </p>
            <div style={styles.headerActions}>
              <button style={buttonStyle} type="button" onClick={() => navigate(-1)}>
                Back to Keyproof
              </button>
              <button style={buttonStyle} type="button" onClick={openOriginalPdf} disabled={!attachmentId}>
                Original PDF
              </button>
              {originalPdfOpen && originalPdfMinimized && (
                <button type="button" style={buttonStyle} onClick={restoreOriginalPdf}>
                  Restore PDF
                </button>
              )}
              <button style={buttonStyle} type="button" onClick={() => navigate("/balsheet/view")}>
                Go to Balsheet
              </button>
            </div>
          </div>
        </section>

        <section style={styles.sheetCard}>
          <div style={styles.toolbar}>
            <div style={styles.toolbarGroup}>
              <button type="button" style={buttonStyle} onClick={createRow}>
                Create New Row
              </button>
            </div>

            <button
              type="button"
              style={buttonStyle}
              onClick={() => setSheetLocked((current) => !current)}
              aria-pressed={sheetLocked}
            >
              {sheetLocked ? "Unlock" : "Lock"}
            </button>

            <div style={styles.previewWrap}>
              {selectedPreviewLabel ? <div style={styles.previewLabel}>{selectedPreviewLabel}</div> : null}
              <input
                value={selectedPreviewValue}
                readOnly={sheetLocked || !isEditingSelection || selectedRowId == null}
                onChange={(event) => updateField(selectedField, event.target.value)}
                style={{
                  ...styles.previewInput,
                  ...(sheetLocked || !isEditingSelection || selectedRowId == null ? styles.previewInputReadonly : {}),
                }}
                aria-label="Cell preview"
              />
            </div>

            <button type="button" style={buttonStyle} onClick={handleClearSelectedCell} disabled={selectedRowId == null}>
              Clear
            </button>
            <button
              type="button"
              style={styles.controlButtonDanger}
              onClick={handleDeleteSelectedRow}
              disabled={selectedRowId == null}
            >
              Delete Row
            </button>
            <div style={{ ...styles.lockedBadge, ...(sheetLocked ? styles.lockedBadgeLocked : styles.lockedBadgeUnlocked) }}>
              {sheetLocked ? "Sheet Locked" : "Sheet Unlocked"}
            </div>
          </div>
        </section>

        <section style={styles.sheetCard}>
          <div style={styles.sheetSectionHeader}>
          </div>

          <ItemizationGrid
            items={sortedItems}
            selectedRowId={selectedRowId}
            selectedField={selectedField}
            sheetLocked={sheetLocked}
            onSelectCell={selectCell}
            onCommitCell={commitCellValue}
            onSort={handleSort}
            sortField={sortField}
            sortDirection={sortDirection}
          />

          <div style={styles.summaryBar}>
            <div style={styles.summaryChip}>
              <div style={styles.summaryLabel}>Requires Itemization</div>
              <div style={styles.summaryValue}>${requiredTotal.toFixed(2)}</div>
            </div>
            <div style={styles.summaryChip}>
              <div style={styles.summaryLabel}>Itemized</div>
              <div style={styles.summaryValue}>${totals.total.toFixed(2)}</div>
            </div>
            <div style={styles.summaryChip}>
              <div style={styles.summaryLabel}>Difference</div>
              <div style={{ ...styles.summaryValue, ...(Math.abs(remaining) < 0.005 ? styles.summaryValueGood : styles.summaryValueWarn) }}>
                ${remaining.toFixed(2)}
              </div>
            </div>
          </div>

          <div style={styles.footerBar}>
            <div style={styles.footerMeta}>{attachmentId ? `Attachment #${attachmentId}` : "No attachment selected."}</div>
          </div>

        </section>

        {originalPdfOpen && attachmentId && !originalPdfMinimized && (
          <div style={styles.pdfOverlay}>
            <div
              ref={originalPdfWindowRef}
              style={{
                ...styles.pdfWindow,
                left: `${originalPdfPosition.x}px`,
                top: `${originalPdfPosition.y}px`,
                width: `${originalPdfSize.width || 0}px`,
                height: `${originalPdfSize.height || 0}px`,
              }}
            >
              <div
                style={{
                  ...styles.pdfHeader,
                  cursor: originalPdfDragging ? "grabbing" : "grab",
                  touchAction: "none",
                }}
                onPointerDown={onOriginalPdfHeaderPointerDown}
              >
                <div>
                  <div style={styles.pdfTitle}>Original PDF</div>
                  <div style={styles.pdfMeta}>{titleText}</div>
                </div>
                <div style={styles.pdfControls}>
                  <button type="button" style={styles.pdfControlButton} onClick={zoomOriginalPdfOut}>
                    -
                  </button>
                  <button type="button" style={styles.pdfControlButton} onClick={resetOriginalPdfZoom}>
                    {Math.round(originalPdfZoom * 100)}%
                  </button>
                  <button type="button" style={styles.pdfControlButton} onClick={zoomOriginalPdfIn}>
                    +
                  </button>
                  <button type="button" style={styles.pdfControlButton} onClick={minimizeOriginalPdf} title="Minimize">
                    _
                  </button>
                  <button type="button" style={styles.pdfCloseButton} onClick={closeOriginalPdf} title="Close">
                    ×
                  </button>
                </div>
              </div>
              <div style={styles.pdfBody}>
                <div
                  ref={originalPdfScrollRef}
                  style={styles.pdfStageWrap}
                  onScroll={() => {
                    if (!originalPdfScrollRef.current) return;
                    setOriginalPdfScroll({
                      left: originalPdfScrollRef.current.scrollLeft,
                      top: originalPdfScrollRef.current.scrollTop,
                    });
                  }}
                >
                  <div
                    style={{
                      ...styles.pdfStage,
                      transform: `scale(${originalPdfZoom})`,
                    }}
                  >
                    <iframe
                      src={`http://localhost:8000/attachments/${attachmentId}/original`}
                      title={`Original PDF ${attachmentId}`}
                      style={styles.pdfFrame}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
