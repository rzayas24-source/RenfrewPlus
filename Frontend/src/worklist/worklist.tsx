import type { CSSProperties, ReactNode, FormEvent } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createTask,
  deleteTask as apiDeleteTask,
  getTasks,
  replaceTasks,
  updateTask as apiUpdateTask,
  type TaskDraft,
  type TaskRecord,
} from "../api/tasks_api";
import { getCalendarStatus } from "../api/calendar_api";

type WorklistMode = "docked" | "expanded";
type WorklistView = "worklist" | "task";
const WORKLIST_CATEGORY = "worklist";
const TASK_CATEGORY = "task";

type WorklistItem = {
  id: string;
  title: string;
  notes: string;
  category: string;
  actionType?: "none" | "url" | "copy" | "copy_details";
  actionLabel?: string;
  actionValue?: string;
  done: boolean;
  sortOrder: number;
  updatedAt: string;
  completedAt?: string;
};

type PostingDatePattern = "mm.dd.yy" | "mm/dd/yy" | "mm-dd-yy" | "mm.dd.yyyy" | "mm/dd/yyyy" | "mm-dd-yyyy";

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
  view: WorklistView;
  postingDate: string;
  showWorklist: () => void;
  showTaskList: () => void;
  toggleItem: (id: string) => void;
  deleteItem: (id: string) => void;
  addItem: (title: string, notes: string) => void;
  replaceItems: (items: WorklistItem[], targetView?: WorklistView) => void;
};

const WORKLIST_ITEMS_KEY = "renfrew:worklist-items";
const WORKLIST_MODE_KEY = "renfrew:worklist-mode";
const WORKLIST_VIEW_KEY = "renfrew:worklist-view";
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

function loadView(key: string, fallback: WorklistView): WorklistView {
  if (typeof window === "undefined") {
    return fallback;
  }

  const saved = window.localStorage.getItem(key);
  if (saved === "worklist" || saved === "task") {
    return saved;
  }

  return fallback;
}

function taskRecordToWorklistItem(task: TaskRecord, categoryOverride?: string): WorklistItem {
  return {
    id: task.id,
    title: task.title,
    notes: task.details,
    category: categoryOverride || task.category,
    actionType: task.action_type,
    actionLabel: task.action_label,
    actionValue: task.action_value,
    done: task.done,
    sortOrder: task.sort_order,
    updatedAt: task.updated_at,
    completedAt: task.completed_at || undefined,
  };
}

function worklistItemToTaskDraft(
  item: WorklistItem,
  overrides: Partial<TaskDraft> & { task_list?: TaskDraft["task_list"] } = {}
): TaskDraft {
  return {
    id: item.id,
    task_list: overrides.task_list || "live",
    title: item.title,
    details: item.notes,
    category: item.category,
    recurrence: "none",
    action_type: (item.actionType || "none") as TaskDraft["action_type"],
    action_label: item.actionLabel || "",
    action_value: item.actionValue || "",
    done: item.done,
    sort_order: overrides.sort_order,
    next_due_at: undefined,
    completed_at: item.completedAt || undefined,
    created_at: overrides.created_at,
    updated_at: overrides.updated_at,
  };
}

function normalizeWorklistItem(item: WorklistItem): WorklistItem {
  return {
    ...item,
    id: String(item.id),
    title: String(item.title || "").trim(),
    notes: String(item.notes || "").trim(),
    category: String(item.category || "").trim(),
    actionType: item.actionType || "none",
    actionLabel: String(item.actionLabel || "").trim(),
    actionValue: String(item.actionValue || "").trim(),
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 0,
    updatedAt: String(item.updatedAt || new Date().toISOString()),
    completedAt: item.completedAt || undefined,
  };
}

function loadLegacyItems() {
  if (typeof window === "undefined") {
    return [] as WorklistItem[];
  }

  const saved = window.localStorage.getItem(WORKLIST_ITEMS_KEY);
  if (!saved) {
    return [] as WorklistItem[];
  }

  try {
    const parsed = JSON.parse(saved) as WorklistItem[];
    return Array.isArray(parsed) ? parsed.map(normalizeWorklistItem).filter((item) => item.title.length > 0) : [];
  } catch {
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

function isWorklistCategory(value: string) {
  return String(value || "").trim().toLowerCase() === WORKLIST_CATEGORY.toLowerCase();
}

function todayMmddyyyy() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const year = String(now.getFullYear());
  return `${month}/${day}/${year}`;
}

function parsePostingDate(value: string | null | undefined) {
  const fallback = todayMmddyyyy();
  const candidate = String(value || "").trim() || fallback;
  const match = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/.exec(candidate);
  if (match) {
    const month = String(Number(match[1])).padStart(2, "0");
    const day = String(Number(match[2])).padStart(2, "0");
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return { month, day, year };
  }

  const parsed = new Date(candidate);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      month: String(parsed.getMonth() + 1).padStart(2, "0"),
      day: String(parsed.getDate()).padStart(2, "0"),
      year: String(parsed.getFullYear()),
    };
  }

  return parsePostingDate(fallback);
}

function formatPostingDate(value: string | null | undefined, pattern: PostingDatePattern | string) {
  const { month, day, year } = parsePostingDate(value);
  const normalizedPattern = String(pattern).trim().toLowerCase();

  return normalizedPattern
    .replaceAll("yyyy", year)
    .replaceAll("yy", year.slice(-2))
    .replaceAll("mm", month)
    .replaceAll("dd", day);
}

function resolveDetails(value: string, postingDate: string | null | undefined) {
  const raw = String(value || "");
  const command = raw.trim().match(/^#show\s+posting\s+date\s+in\s+format\s+(.+?)#$/i);
  if (!command) {
    return raw;
  }

  return formatPostingDate(postingDate, command[1]);
}

export function WorklistProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(() => loadBoolean(WORKLIST_OPEN_KEY, false));
  const [mode, setMode] = useState<WorklistMode>(() => loadMode(WORKLIST_MODE_KEY, "docked"));
  const [view, setView] = useState<WorklistView>(() => loadView(WORKLIST_VIEW_KEY, "worklist"));
  const [postingDate, setPostingDate] = useState(() => todayMmddyyyy());
  const [items, setItems] = useState<WorklistItem[]>([]);

  useEffect(() => {
    window.localStorage.setItem(WORKLIST_OPEN_KEY, String(isOpen));
  }, [isOpen]);

  useEffect(() => {
    window.localStorage.setItem(WORKLIST_MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    window.localStorage.setItem(WORKLIST_VIEW_KEY, view);
  }, [view]);

  useEffect(() => {
    let mounted = true;

    void getCalendarStatus()
      .then((response) => {
        if (!mounted) {
          return;
        }

        setPostingDate(response.data.currentWorkDay || response.data.today || todayMmddyyyy());
      })
      .catch(() => {
        if (mounted) {
          setPostingDate(todayMmddyyyy());
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadVisibleTasks() {
      try {
        const taskList = view === "worklist" ? "template" : "live";
        let fetched: TaskRecord[] = await getTasks(taskList);
        if (view === "task" && !fetched.length) {
          const legacy = loadLegacyItems();
          if (legacy.length) {
            await replaceTasks(
              "live",
              legacy.map((item, index) => worklistItemToTaskDraft(item, { sort_order: index }))
            );
            fetched = await getTasks("live");
          }
        }

        if (mounted) {
          const filtered = fetched.filter((task: TaskRecord) =>
            view === "worklist" ? isWorklistCategory(task.category) : !isWorklistCategory(task.category)
          );
          setItems(
            filtered.map((task: TaskRecord) =>
              taskRecordToWorklistItem(task, view === "worklist" ? WORKLIST_CATEGORY : TASK_CATEGORY)
            )
          );
        }
      } catch {
        if (mounted) {
          setItems([]);
        }
      }
    }

    void loadVisibleTasks();
    return () => {
      mounted = false;
    };
  }, [view]);

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
      view,
      postingDate,
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
      showWorklist: () => setView("worklist"),
      showTaskList: () => setView("task"),
      toggleItem: (id: string) => {
        const current = items.find((item) => item.id === id);
        if (!current) {
          return;
        }

        const now = new Date().toISOString();
        const nextItem = {
          ...current,
          done: !current.done,
          updatedAt: now,
          completedAt: !current.done ? undefined : now,
        };

        const activeTaskList: TaskDraft["task_list"] = view === "worklist" ? "template" : "live";

        void apiUpdateTask(id, worklistItemToTaskDraft(nextItem, { task_list: activeTaskList }))
          .then((updated) => {
            setItems((currentItems) =>
              currentItems.map((item) =>
                item.id === id ? taskRecordToWorklistItem(updated, view === "worklist" ? WORKLIST_CATEGORY : TASK_CATEGORY) : item
              )
            );
          })
          .catch(() => undefined);
      },
      deleteItem: (id: string) => {
        void apiDeleteTask(id)
          .then(() => {
            setItems((current) => current.filter((item) => item.id !== id));
          })
          .catch(() => undefined);
      },
      addItem: (title: string, notes: string) => {
        const nextTitle = title.trim();
        if (!nextTitle) {
          return;
        }

        const now = new Date().toISOString();
        const sortOrder = items.length ? Math.min(...items.map((item) => item.sortOrder)) - 1 : 0;

        void createTask({
          id: makeId(),
          task_list: "live",
          title: nextTitle,
          details: notes.trim(),
          category: TASK_CATEGORY,
          recurrence: "none",
          action_type: "none",
          action_label: "",
          action_value: "",
          done: false,
          sort_order: sortOrder,
          next_due_at: undefined,
          completed_at: undefined,
          created_at: now,
          updated_at: now,
        })
          .then((created) => {
            setItems((current) => [taskRecordToWorklistItem(created, TASK_CATEGORY), ...current]);
            setIsOpen(true);
          })
          .catch(() => undefined);
      },
      replaceItems: (nextItems: WorklistItem[], targetView = view) => {
        const normalizedItems = nextItems.map(normalizeWorklistItem);
        void replaceTasks(
          targetView === "worklist" ? "template" : "live",
          normalizedItems.map((item, index) => worklistItemToTaskDraft(item, { sort_order: index }))
        )
          .then(() => {
            setItems(normalizedItems);
            setIsOpen(true);
          })
          .catch(() => undefined);
      },
    };
  }, [isOpen, items, mode, postingDate, view]);

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
  const {
    isOpen,
    mode,
    view,
    postingDate,
    close,
    expand,
    dock,
    items,
    remainingCount,
    completedCount,
    showWorklist,
    showTaskList,
    toggleItem,
    deleteItem,
    addItem,
    replaceItems,
  } = useWorklist();
  const [titleDraft, setTitleDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setTitleDraft("");
      setNotesDraft("");
      setIsMenuOpen(false);
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

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!isMenuOpen) {
        return;
      }

      const target = event.target as Node | null;
      if (menuWrapRef.current && target && !menuWrapRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isMenuOpen]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addItem(titleDraft, notesDraft);
    setTitleDraft("");
    setNotesDraft("");
  }

  function handleEdit() {
    window.location.assign("/worklist-editor");
  }

  function handleRefresh() {
    const now = new Date().toISOString();
    replaceItems(
      items.map((item) => ({
        ...item,
        done: false,
        completedAt: undefined,
        updatedAt: now,
      })),
      "worklist"
    );
    showWorklist();
    setIsMenuOpen(false);
  }

  if (!isRendered || typeof document === "undefined") {
    return null;
  }

  const isExpanded = mode === "expanded";
  const isWorklistView = view === "worklist";
  const isCompactDockedWorklist = isWorklistView && !isExpanded;
  const dockedWidth = isWorklistView ? "250px" : "250px";
  const shadeStyles: CSSProperties = {
    ...styles.shade,
    width: isExpanded ? "min(720px, calc(100vw - 36px))" : dockedWidth,
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
          <div style={styles.headerRow}>
            <button
              type="button"
              onClick={close}
              aria-label="Retract work list"
              title="Retract work list"
              style={styles.closeButton}
            >
              -
            </button>
            <div style={styles.headerCountBlock}>
              <div style={styles.headerKicker}>Task count</div>
              <div style={styles.headerMeta}>
                {isWorklistView ? `${items.length} preset items` : `${remainingCount} open, ${completedCount} done`}
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
          <div style={styles.headerRow}>
            <button
              type="button"
              onClick={showTaskList}
              title="Show normal task list"
              aria-label="Show normal task list"
              style={!isWorklistView ? styles.viewButtonActive : styles.viewButton}
            >
              Task
            </button>
            <button
              type="button"
              onClick={showWorklist}
              title="Show preset worklist"
              aria-label="Show preset worklist"
              style={isWorklistView ? styles.viewButtonActive : styles.viewButton}
            >
              Worklist
            </button>
            <div ref={menuWrapRef} style={styles.menuWrap}>
              <button
                type="button"
                onClick={() => setIsMenuOpen((current) => !current)}
                title="More actions"
                aria-label="More actions"
                aria-expanded={isMenuOpen}
                style={styles.menuButton}
              >
                ...
              </button>
              {isMenuOpen ? (
                <div style={styles.menuPanel} role="menu" aria-label="Work list actions">
                  <button type="button" onClick={handleEdit} style={styles.menuItemButton} role="menuitem">
                    Edit
                  </button>
                  <button type="button" onClick={handleRefresh} style={styles.menuItemButton} role="menuitem">
                    Refresh
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div style={styles.body}>
          <div style={styles.listWrap}>
            {items.length === 0 ? (
              <div style={styles.emptyState}>
                {isWorklistView
                  ? "No preset worklist items yet. Open the worklist editor to populate them."
                  : "No task items yet. Add the first one below."}
              </div>
            ) : (
              items.map((item) => (
                <article
                  key={item.id}
                  style={
                    item.done
                      ? isCompactDockedWorklist
                        ? styles.itemCardDoneCompact
                        : styles.itemCardDone
                      : isCompactDockedWorklist
                        ? styles.itemCardCompact
                        : styles.itemCard
                  }
                >
                  <div style={styles.itemTop}>
                    <label style={styles.itemTitleRow}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleItem(item.id)}
                        style={styles.checkbox}
                      />
                      <span style={styles.itemTitle}>{item.title}</span>
                    </label>
                  </div>
                  {isWorklistView && item.actionType && item.actionType !== "none" ? (
                    <div style={styles.itemActionRow}>
                      {item.actionType === "url" ? (
                        <a
                          href={item.actionValue}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.actionButtonLink}
                        >
                          {item.actionLabel || "Open"}
                        </a>
                      ) : item.actionType === "copy_details" ? (
                        <button
                          type="button"
                          style={styles.actionButton}
                          onClick={() => {
                            const renderedNotes = resolveDetails(item.notes, postingDate);
                            void navigator.clipboard.writeText(renderedNotes || "");
                          }}
                        >
                          {item.actionLabel || "Copy details"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          style={styles.actionButton}
                          onClick={() => {
                            void navigator.clipboard.writeText(item.actionValue || "");
                          }}
                        >
                          {item.actionLabel || "Copy"}
                        </button>
                      )}
                    </div>
                  ) : null}
                  {(() => {
                    const renderedNotes = resolveDetails(item.notes, postingDate);
                    return renderedNotes ? <div style={styles.itemNotes}>{renderedNotes}</div> : null;
                  })()}
                  <div style={styles.itemFooter}>
                    <span style={styles.itemMeta}>{formatUpdatedAt(item.updatedAt)}</span>
                    {!isWorklistView ? (
                      <button type="button" onClick={() => deleteItem(item.id)} style={styles.deleteButton}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>

          {isExpanded && !isWorklistView ? (
            <form style={styles.form} onSubmit={handleSubmit}>
              <div style={styles.fieldGrid}>
                <label style={styles.fieldGroup}>
                  <span style={styles.fieldLabel}>Task</span>
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    placeholder="New task"
                    style={styles.input}
                  />
                </label>
              </div>
              <label style={styles.fieldGroup}>
                <span style={styles.fieldLabel}>Notes</span>
                <textarea
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  placeholder="Optional notes"
                  rows={4}
                  style={styles.textarea}
                />
              </label>
              <div style={styles.fieldGrid}>
              </div>
              <div style={styles.formActions}>
                <button type="submit" style={styles.addButton}>
                  Add item
                </button>
              </div>
            </form>
          ) : null}
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
    boxSizing: "border-box",
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
    gap: "10px",
    padding: "14px",
    borderBottom: "1px solid rgba(135, 157, 179, 0.18)",
  },
  headerRow: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
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
    justifySelf: "start",
  },
  headerCountBlock: {
    minWidth: 0,
    justifySelf: "center",
    textAlign: "center",
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
    justifySelf: "end",
  },
  editorButton: {
    height: "30px",
    padding: "0 10px",
    borderRadius: "999px",
    border: "1px solid rgba(143, 183, 228, 0.18)",
    background: "rgba(255,255,255,0.9)",
    color: "#5a7faa",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
  },
  menuWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    zIndex: 3,
    justifySelf: "end",
  },
  menuButton: {
    height: "30px",
    width: "36px",
    padding: 0,
    borderRadius: "999px",
    border: "1px solid rgba(143, 183, 228, 0.18)",
    background: "rgba(255,255,255,0.9)",
    color: "#315b88",
    fontSize: "20px",
    fontWeight: 800,
    lineHeight: 1,
    cursor: "pointer",
  },
  menuPanel: {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    display: "grid",
    gap: "4px",
    minWidth: "140px",
    padding: "6px",
    borderRadius: "16px",
    border: "1px solid rgba(143, 183, 228, 0.18)",
    background: "rgba(255,255,255,0.98)",
    boxShadow: "0 16px 32px rgba(52, 84, 120, 0.14)",
    zIndex: 2,
  },
  menuItemButton: {
    height: "32px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "none",
    background: "transparent",
    color: "#17324f",
    fontSize: "12px",
    fontWeight: 700,
    textAlign: "left",
    cursor: "pointer",
  },
  viewButton: {
    height: "30px",
    padding: "0 10px",
    borderRadius: "999px",
    border: "1px solid rgba(143, 183, 228, 0.18)",
    background: "rgba(255,255,255,0.84)",
    color: "#5a7faa",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
    justifySelf: "start",
  },
  viewButtonActive: {
    height: "30px",
    padding: "0 10px",
    borderRadius: "999px",
    border: "1px solid rgba(86, 144, 224, 0.34)",
    background: "linear-gradient(180deg, rgba(118, 186, 255, 0.22), rgba(118, 186, 255, 0.12))",
    color: "#24527f",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
    justifySelf: "start",
  },
  body: {
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    overflow: "hidden",
    overflowX: "hidden",
    flex: 1,
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
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    overflowY: "auto",
    overflowX: "hidden",
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    alignItems: "stretch",
    paddingRight: "2px",
  },
  inlineActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
  },
  secondaryButton: {
    height: "32px",
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid rgba(143, 183, 228, 0.22)",
    background: "rgba(255,255,255,0.86)",
    color: "#315b88",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
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
    minWidth: 0,
    width: "100%",
    overflow: "hidden",
    flexShrink: 0,
    position: "relative",
  },
  itemCardCompact: {
    padding: "9px",
    borderRadius: "15px",
    border: "1px solid rgba(143, 183, 228, 0.14)",
    background: "rgba(255,255,255,0.94)",
    boxShadow: "0 9px 16px rgba(52, 84, 120, 0.05)",
    display: "grid",
    gap: "7px",
    minWidth: 0,
    width: "100%",
    overflow: "hidden",
    flexShrink: 0,
    position: "relative",
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
    minWidth: 0,
    width: "100%",
    overflow: "hidden",
    flexShrink: 0,
    position: "relative",
  },
  itemCardDoneCompact: {
    padding: "9px",
    borderRadius: "15px",
    border: "1px solid rgba(143, 183, 228, 0.12)",
    background: "rgba(236, 244, 255, 0.94)",
    boxShadow: "0 9px 16px rgba(52, 84, 120, 0.05)",
    display: "grid",
    gap: "7px",
    opacity: 0.8,
    minWidth: 0,
    width: "100%",
    overflow: "hidden",
    flexShrink: 0,
    position: "relative",
  },
  itemTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "10px",
    minWidth: 0,
  },
  itemTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
    flex: 1,
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
    minWidth: 0,
    overflowWrap: "anywhere",
    whiteSpace: "normal",
  },
  pillMuted: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "24px",
    padding: "0 10px",
    borderRadius: "999px",
    background: "rgba(95, 113, 131, 0.10)",
    color: "#5b6d7f",
    fontSize: "11px",
    fontWeight: 800,
  },
  itemNotes: {
    fontSize: "12px",
    lineHeight: 1.55,
    color: "#5c7083",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  itemActionRow: {
    display: "flex",
    justifyContent: "flex-start",
    minWidth: 0,
  },
  actionButton: {
    height: "30px",
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid rgba(118, 186, 255, 0.30)",
    background: "linear-gradient(180deg, rgba(118, 186, 255, 0.18), rgba(118, 186, 255, 0.08))",
    color: "#24527f",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  actionButtonLink: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "30px",
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid rgba(118, 186, 255, 0.30)",
    background: "linear-gradient(180deg, rgba(118, 186, 255, 0.18), rgba(118, 186, 255, 0.08))",
    color: "#24527f",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "none",
  },
  itemMetaLine: {
    fontSize: "11px",
    color: "#4f7092",
    fontWeight: 700,
  },
  itemFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    minWidth: 0,
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
  fieldGrid: {
    display: "grid",
    gap: "10px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  fieldGroup: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
  },
  fieldLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#5a7faa",
    fontWeight: 800,
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
  select: {
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
