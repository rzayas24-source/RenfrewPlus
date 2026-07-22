import type { CSSProperties, ReactNode, FormEvent } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type WorklistMode = "docked" | "expanded";

type WorklistItem = {
  id: string;
  title: string;
  notes: string;
  done: boolean;
  updatedAt: string;
};

type WorklistContextValue = {
  isOpen: boolean;
  mode: WorklistMode;
  items: WorklistItem[];
  remainingCount: number;
  completedCount: number;
  open: () => void;
  close: () => void;
  toggle: () => void;
  expand: () => void;
  dock: () => void;
  toggleItem: (id: string) => void;
  deleteItem: (id: string) => void;
  addItem: (title: string, notes: string) => void;
};

const WORKLIST_ITEMS_KEY = "renfrew:worklist-items";
const WORKLIST_MODE_KEY = "renfrew:worklist-mode";
const WORKLIST_OPEN_KEY = "renfrew:worklist-open";

const WorklistContext = createContext<WorklistContextValue | null>(null);

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `worklist-${Date.now()}`;
}

function loadBoolean(key: string, fallback: boolean) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const saved = window.localStorage.getItem(key);
  if (saved === null) {
    return fallback;
  }

  return saved === "true";
}

function loadMode(key: string, fallback: WorklistMode): WorklistMode {
  if (typeof window === "undefined") {
    return fallback;
  }

  const saved = window.localStorage.getItem(key);
  if (saved === "expanded" || saved === "docked") {
    return saved;
  }

  return fallback;
}

function loadItems() {
  if (typeof window === "undefined") {
    return [] as WorklistItem[];
  }

  const saved = window.localStorage.getItem(WORKLIST_ITEMS_KEY);
  if (!saved) {
    return [] as WorklistItem[];
  }

  try {
    const parsed = JSON.parse(saved) as WorklistItem[];
    return Array.isArray(parsed)
      ? parsed
          .map((item) => ({
            id: String(item.id || makeId()),
            title: String(item.title || "").trim(),
            notes: String(item.notes || "").trim(),
            done: !!item.done,
            updatedAt: String(item.updatedAt || new Date().toISOString()),
          }))
          .filter((item) => item.title.length > 0)
      : [];
  } catch {
    window.localStorage.removeItem(WORKLIST_ITEMS_KEY);
    return [];
  }
}

function formatUpdatedAt(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function WorklistProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(() => loadBoolean(WORKLIST_OPEN_KEY, false));
  const [mode, setMode] = useState<WorklistMode>(() => loadMode(WORKLIST_MODE_KEY, "docked"));
  const [items, setItems] = useState<WorklistItem[]>(() => loadItems());

  useEffect(() => {
    window.localStorage.setItem(WORKLIST_OPEN_KEY, String(isOpen));
  }, [isOpen]);

  useEffect(() => {
    window.localStorage.setItem(WORKLIST_MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    window.localStorage.setItem(WORKLIST_ITEMS_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const value = useMemo<WorklistContextValue>(() => {
    return {
      isOpen,
      mode,
      items,
      remainingCount: items.filter((item) => !item.done).length,
      completedCount: items.filter((item) => item.done).length,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((current) => !current),
      expand: () => {
        setMode("expanded");
        setIsOpen(true);
      },
      dock: () => {
        setMode("docked");
        setIsOpen(true);
      },
      toggleItem: (id: string) => {
        setItems((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  done: !item.done,
                  updatedAt: new Date().toISOString(),
                }
              : item
          )
        );
      },
      deleteItem: (id: string) => {
        setItems((current) => current.filter((item) => item.id !== id));
      },
      addItem: (title: string, notes: string) => {
        const nextTitle = title.trim();
        if (!nextTitle) {
          return;
        }

        setItems((current) => [
          {
            id: makeId(),
            title: nextTitle,
            notes: notes.trim(),
            done: false,
            updatedAt: new Date().toISOString(),
          },
          ...current,
        ]);
        setIsOpen(true);
      },
    };
  }, [isOpen, items, mode]);

  return <WorklistContext.Provider value={value}>{children}</WorklistContext.Provider>;
}

export function useWorklist() {
  const context = useContext(WorklistContext);
  if (!context) {
    throw new Error("useWorklist must be used inside a WorklistProvider");
  }

  return context;
}

export function WorklistBrandButton({
  children,
  style,
  ariaLabel = "Open work list",
}: {
  children: ReactNode;
  style?: CSSProperties;
  ariaLabel?: string;
}) {
  const { isOpen, toggle } = useWorklist();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isOpen}
      aria-label={ariaLabel}
      title={isOpen ? "Retract work list" : "Open work list"}
      style={{
        ...styles.launcher,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function WorklistShade() {
  const { isOpen, mode, close, expand, dock, items, remainingCount, completedCount, toggleItem, deleteItem, addItem } =
    useWorklist();
  const [titleDraft, setTitleDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [isRendered, setIsRendered] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setTitleDraft("");
      setNotesDraft("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setIsRendered(false);
    }, 560);

    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addItem(titleDraft, notesDraft);
    setTitleDraft("");
    setNotesDraft("");
  }

  if (!isRendered || typeof document === "undefined") {
    return null;
  }

  const isExpanded = mode === "expanded";
  const shadeStyles: CSSProperties = {
    ...styles.shade,
    width: isExpanded ? "min(720px, calc(100vw - 36px))" : "250px",
    height: isExpanded ? "min(82vh, calc(100vh - 36px))" : "min(78vh, calc(100vh - 36px))",
    opacity: isOpen ? 1 : 0,
    transform: isOpen ? "translateY(0) scaleY(1)" : "translateY(-28px) scaleY(0.02)",
    filter: isOpen ? "blur(0)" : "blur(2px)",
    boxShadow: isOpen ? "0 30px 72px rgba(52, 84, 120, 0.18)" : "0 12px 28px rgba(52, 84, 120, 0.08)",
    transition: isOpen
      ? "transform 1350ms cubic-bezier(0.16, 0.84, 0.24, 1), opacity 420ms ease, filter 540ms ease, box-shadow 1350ms ease"
      : "transform 560ms cubic-bezier(0.12, 0.84, 0.22, 1), opacity 320ms ease, filter 420ms ease, box-shadow 560ms ease",
  };

  return createPortal(
    <div style={styles.portal} aria-hidden={!isOpen}>
      <aside
        style={shadeStyles}
        role="dialog"
        aria-label="Work list"
      >
        <div style={styles.shadeRail} />
        <div style={styles.shadeHeader}>
          <button
            type="button"
            onClick={close}
            aria-label="Retract work list"
            title="Retract work list"
            style={styles.closeButton}
          >
            -
          </button>
          <div style={styles.headerCopy}>
            <div style={styles.headerKicker}>Work list</div>
            <div style={styles.headerTitle}>On-the-fly tasks</div>
            <div style={styles.headerMeta}>
              {remainingCount} open, {completedCount} done
            </div>
          </div>
          <button
            type="button"
            onClick={isExpanded ? dock : expand}
            title={isExpanded ? "Dock to sidebar" : "Expand over screen"}
            aria-label={isExpanded ? "Dock to sidebar" : "Expand over screen"}
            style={styles.modeButton}
          >
            {isExpanded ? "Dock" : "Expand"}
          </button>
        </div>

        <div style={styles.body}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Pinned for the current screen</div>
            <div style={styles.summaryText}>
              This shade sits over the sidebar, then opens wider when you need more room to work.
            </div>
          </div>

          <div style={styles.listWrap}>
            {items.length === 0 ? (
              <div style={styles.emptyState}>
                No work items yet. Add the first one below.
              </div>
            ) : (
              items.map((item) => (
                <article key={item.id} style={item.done ? styles.itemCardDone : styles.itemCard}>
                  <label style={styles.itemTop}>
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleItem(item.id)}
                      style={styles.checkbox}
                    />
                    <span style={styles.itemTitle}>{item.title}</span>
                  </label>
                  {item.notes ? <div style={styles.itemNotes}>{item.notes}</div> : null}
                  <div style={styles.itemFooter}>
                    <span style={styles.itemMeta}>{formatUpdatedAt(item.updatedAt)}</span>
                    <button type="button" onClick={() => deleteItem(item.id)} style={styles.deleteButton}>
                      Remove
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <form style={styles.form} onSubmit={handleSubmit}>
            <input
              type="text"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              placeholder="New task"
              style={styles.input}
            />
            <textarea
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              placeholder="Optional notes"
              rows={isExpanded ? 4 : 3}
              style={styles.textarea}
            />
            <div style={styles.formActions}>
              <button type="submit" style={styles.addButton}>
                Add item
              </button>
            </div>
          </form>
        </div>
      </aside>
    </div>,
    document.body
  );
}

const styles: Record<string, CSSProperties> = {
  launcher: {
    position: "relative",
    cursor: "pointer",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    padding: 0,
    appearance: "none",
    WebkitAppearance: "none",
    background: "transparent",
    display: "grid",
  },
  launcherDot: {
    position: "absolute",
    top: "6px",
    right: "6px",
    width: "12px",
    height: "12px",
    borderRadius: "999px",
    background: "linear-gradient(180deg, #46d36a 0%, #18a44a 100%)",
    boxShadow: "0 0 0 4px rgba(70, 211, 106, 0.18)",
    animation: "worklistPulse 2.6s ease-in-out infinite",
  },
  portal: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 2500,
  },
  shade: {
    position: "fixed",
    top: "98px",
    left: "18px",
    maxWidth: "calc(100vw - 36px)",
    borderRadius: "28px",
    border: "1px solid rgba(143, 183, 228, 0.26)",
    background:
      "linear-gradient(180deg, rgba(233, 244, 255, 0.98) 0%, rgba(248, 252, 255, 0.97) 52%, rgba(225, 238, 255, 0.95) 100%)",
    boxShadow: "0 30px 72px rgba(52, 84, 120, 0.18)",
    overflow: "hidden",
    pointerEvents: "auto",
    display: "flex",
    flexDirection: "column",
    backdropFilter: "blur(20px)",
    transformOrigin: "top left",
  },
  shadeRail: {
    height: "6px",
    background: "linear-gradient(90deg, rgba(118, 186, 255, 0.98), rgba(79, 145, 232, 0.98))",
  },
  shadeHeader: {
    display: "grid",
    gridTemplateColumns: "36px minmax(0, 1fr) auto",
    gap: "12px",
    alignItems: "center",
    padding: "14px",
    borderBottom: "1px solid rgba(135, 157, 179, 0.18)",
  },
  closeButton: {
    width: "36px",
    height: "36px",
    borderRadius: "999px",
    border: "1px solid rgba(143, 183, 228, 0.20)",
    background: "rgba(255,255,255,0.96)",
    color: "#2f5f96",
    fontSize: "20px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 16px rgba(52, 84, 120, 0.08)",
  },
  headerCopy: {
    minWidth: 0,
  },
  headerKicker: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "#4f84c6",
    fontWeight: 800,
  },
  headerTitle: {
    marginTop: "2px",
    fontSize: "18px",
    fontWeight: 800,
    color: "#17324f",
  },
  headerMeta: {
    marginTop: "2px",
    fontSize: "12px",
    color: "#617588",
    fontWeight: 700,
  },
  modeButton: {
    height: "34px",
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid rgba(143, 183, 228, 0.22)",
    background: "rgba(255,255,255,0.96)",
    color: "#315b88",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  body: {
    padding: "14px",
    display: "grid",
    gap: "12px",
    overflow: "hidden",
    minHeight: 0,
  },
  summaryCard: {
    padding: "12px 14px",
    borderRadius: "20px",
    border: "1px solid rgba(143, 183, 228, 0.16)",
    background: "rgba(255,255,255,0.78)",
  },
  summaryLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#5a7faa",
    fontWeight: 800,
    marginBottom: "4px",
  },
  summaryText: {
    fontSize: "13px",
    lineHeight: 1.55,
    color: "#365a80",
  },
  listWrap: {
    display: "grid",
    gap: "10px",
    overflowY: "auto",
    minHeight: 0,
    paddingRight: "2px",
  },
  emptyState: {
    padding: "16px",
    borderRadius: "18px",
    border: "1px dashed rgba(143, 183, 228, 0.24)",
    background: "rgba(255,255,255,0.72)",
    color: "#55687b",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  itemCard: {
    padding: "12px",
    borderRadius: "18px",
    border: "1px solid rgba(143, 183, 228, 0.14)",
    background: "rgba(255,255,255,0.94)",
    boxShadow: "0 12px 22px rgba(52, 84, 120, 0.06)",
    display: "grid",
    gap: "10px",
  },
  itemCardDone: {
    padding: "12px",
    borderRadius: "18px",
    border: "1px solid rgba(143, 183, 228, 0.12)",
    background: "rgba(236, 244, 255, 0.94)",
    boxShadow: "0 12px 22px rgba(52, 84, 120, 0.05)",
    display: "grid",
    gap: "10px",
    opacity: 0.8,
  },
  itemTop: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "13px",
    color: "#17324f",
    fontWeight: 800,
  },
  checkbox: {
    width: "16px",
    height: "16px",
    margin: 0,
    accentColor: "#46d36a",
    cursor: "pointer",
  },
  itemTitle: {
    lineHeight: 1.4,
  },
  itemNotes: {
    fontSize: "12px",
    lineHeight: 1.55,
    color: "#5c7083",
    whiteSpace: "pre-wrap",
  },
  itemFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },
  itemMeta: {
    fontSize: "11px",
    color: "#6d8194",
    fontWeight: 700,
  },
  deleteButton: {
    border: "none",
    background: "transparent",
    color: "#a15353",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 800,
    padding: 0,
  },
  form: {
    display: "grid",
    gap: "10px",
    paddingTop: "2px",
  },
  input: {
    height: "38px",
    borderRadius: "12px",
    border: "1px solid rgba(143, 183, 228, 0.20)",
    background: "rgba(255,255,255,0.96)",
    padding: "0 12px",
    outline: "none",
    color: "#17324f",
  },
  textarea: {
    borderRadius: "12px",
    border: "1px solid rgba(143, 183, 228, 0.20)",
    background: "rgba(255,255,255,0.96)",
    padding: "10px 12px",
    outline: "none",
    color: "#17324f",
    resize: "none",
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
  },
  addButton: {
    height: "36px",
    padding: "0 14px",
    borderRadius: "12px",
    border: "1px solid rgba(118, 186, 255, 0.30)",
    background: "linear-gradient(180deg, rgba(118, 186, 255, 0.18), rgba(118, 186, 255, 0.08))",
    color: "#24527f",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
};
