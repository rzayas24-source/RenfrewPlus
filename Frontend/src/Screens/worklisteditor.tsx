import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTemplateTasks, importTemplateToLive, replaceTasks, type TaskDraft, type TaskRecord } from "../api/tasks_api";
import { styles as adminStyles } from "./adminscreen";
import {
  DEFAULT_DAILY_WORKLIST_TEMPLATE,
  normalizeDailyWorklistItem,
  type DailyWorklistActionType,
  type DailyWorklistTemplateItem,
} from "../worklist/dailyWorklistTemplate";
import { WorklistBrandButton } from "../worklist/worklist";

function makeId(title: string) {
  return `daily-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || Date.now()}`;
}

function createBlankItem(index: number): DailyWorklistTemplateItem {
  return {
    id: `daily-item-${index}-${Date.now()}`,
    title: "",
    details: "",
    category: "worklist",
    actionType: "none",
    actionLabel: "",
    actionValue: "",
  };
}

function nextTemplateItem(items: DailyWorklistTemplateItem[]) {
  return createBlankItem(items.length + 1);
}

function taskRecordToTemplateItem(task: TaskRecord): DailyWorklistTemplateItem {
  return {
    id: task.id,
    title: task.title,
    details: task.details,
    category: "worklist",
    actionType: task.action_type,
    actionLabel: task.action_label,
    actionValue: task.action_value,
  };
}

function templateItemToTaskDraft(item: DailyWorklistTemplateItem, taskList: string, sortOrder: number): TaskDraft {
  const normalized = normalizeDailyWorklistItem(item);
  return {
    id: normalized.id,
    task_list: taskList,
    title: normalized.title,
    details: normalized.details,
    category: normalized.category,
    recurrence: "none",
    action_type: normalized.actionType,
    action_label: normalized.actionLabel,
    action_value: normalized.actionValue,
    done: false,
    sort_order: sortOrder,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export default function WorklistEditorScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState<DailyWorklistTemplateItem[]>(DEFAULT_DAILY_WORKLIST_TEMPLATE);
  const [savedLabel, setSavedLabel] = useState("Unsaved changes");

  useEffect(() => {
    let mounted = true;

    async function loadTemplate() {
      try {
        let fetched = await getTemplateTasks();
        if (!fetched.length) {
          const normalized = DEFAULT_DAILY_WORKLIST_TEMPLATE.map((item, index) => templateItemToTaskDraft(item, "template", index));
          await replaceTasks("template", normalized);
          fetched = await getTemplateTasks();
          setSavedLabel("Seeded database template");
        } else {
          setSavedLabel("Loaded template from database");
        }

        if (mounted) {
          setItems(fetched.map(taskRecordToTemplateItem));
        }
      } catch {
        if (mounted) {
          setItems(DEFAULT_DAILY_WORKLIST_TEMPLATE);
          setSavedLabel("Using default template");
        }
      }
    }

    void loadTemplate();
    return () => {
      mounted = false;
    };
  }, []);

  function updateItem(id: string, patch: Partial<DailyWorklistTemplateItem>) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
            }
          : item
      )
    );
  }

  function addItem() {
    setItems((current) => [...current, nextTemplateItem(current)]);
  }

  function duplicateItem(id: string) {
    setItems((current) => {
      const match = current.find((item) => item.id === id);
      if (!match) {
        return current;
      }

      const copy: DailyWorklistTemplateItem = {
        ...match,
        id: makeId(`${match.title}-copy`),
      };
      const index = current.findIndex((item) => item.id === id);
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function moveItem(id: string, direction: -1 | 1) {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function saveTemplate() {
    const normalized = items.map((item) => normalizeDailyWorklistItem(item)).filter((item) => item.title.length > 0);
    return replaceTasks(
      "template",
      normalized.map((item, index) => templateItemToTaskDraft(item, "template", index))
    )
      .then(() => getTemplateTasks())
      .then((fetched) => {
        setItems(fetched.map(taskRecordToTemplateItem));
        setSavedLabel(`Saved ${fetched.length} items to database`);
      })
      .catch(() => undefined);
  }

  function restoreDefaults() {
    return replaceTasks(
      "template",
      DEFAULT_DAILY_WORKLIST_TEMPLATE.map((item, index) => templateItemToTaskDraft(item, "template", index))
    )
      .then(() => getTemplateTasks())
      .then((fetched) => {
        setItems(fetched.map(taskRecordToTemplateItem));
        setSavedLabel("Reset database template to defaults");
      })
      .catch(() => undefined);
  }

  function loadIntoLiveWorklist() {
    void Promise.resolve(saveTemplate())
      .then(() => importTemplateToLive("template", "live"))
      .then(() => navigate("/tools"))
      .catch(() => undefined);
  }

  return (
    <main style={adminStyles.shell}>
      <div style={adminStyles.glowBlue} />
      <div style={adminStyles.glowPink} />

      <aside style={adminStyles.sidebar}>
        <div style={adminStyles.brandWrap}>
          <WorklistBrandButton style={adminStyles.brandMark} ariaLabel="Open work list from the branding button">
            <img src="/favicon.svg" alt="" style={adminStyles.brandMarkImage} />
          </WorklistBrandButton>
          <div style={adminStyles.brandWomenMark} aria-hidden="true">
            <img src="/renfrew-gazebo.png" alt="" style={adminStyles.brandWomenImage} />
          </div>
        </div>

        <p style={adminStyles.sidebarCopy}>
          Edit the seeded daily work list here, then push it into the live work list when you are ready.
        </p>

        <nav style={adminStyles.navStack} aria-label="Worklist editor navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/tools")}>
            <span style={adminStyles.navButtonLabel}>Back to Tools</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button
            className="sidebar-nav-button"
            style={adminStyles.navButton}
            type="button"
            onClick={loadIntoLiveWorklist}
          >
            <span style={adminStyles.navButtonLabel}>Load into Work list</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Template</div>
          <div style={adminStyles.sidebarCardValue}>{items.length} items</div>
          <div style={adminStyles.sidebarCardMeta}>Worklist category stays fixed for the preset list.</div>
        </div>
      </aside>

      <section style={styles.content}>
        <div style={styles.hero}>
          <div>
            <div style={adminStyles.sectionKicker}>Daily worklist</div>
            <h1 style={styles.title}>Prepopulated workflow editor</h1>
            <p style={styles.subtitle}>
              Tune the starter list, save it to the browser, and send it into the live work list when you want to use it.
            </p>
          </div>
          <div style={styles.heroActions}>
            <button type="button" onClick={addItem} style={styles.primaryButton}>
              Add row
            </button>
            <button type="button" onClick={saveTemplate} style={styles.secondaryButton}>
              Save template
            </button>
            <button type="button" onClick={restoreDefaults} style={styles.secondaryButton}>
              Reset defaults
            </button>
          </div>
        </div>

        <div style={styles.notice}>{savedLabel}</div>

        <div style={styles.list}>
          {items.map((item, index) => (
            <article key={item.id} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={styles.cardIndex}>{index + 1}</div>
                <div style={styles.cardActions}>
                  <button type="button" onClick={() => moveItem(item.id, -1)} style={styles.iconButton}>
                    ↑
                  </button>
                  <button type="button" onClick={() => moveItem(item.id, 1)} style={styles.iconButton}>
                    ↓
                  </button>
                  <button type="button" onClick={() => duplicateItem(item.id)} style={styles.iconButton}>
                    Duplicate
                  </button>
                  <button type="button" onClick={() => removeItem(item.id)} style={styles.dangerButton}>
                    Remove
                  </button>
                </div>
              </div>

              <div style={styles.grid}>
                <label style={styles.field}>
                  <span style={styles.label}>Task</span>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(event) => updateItem(item.id, { title: event.target.value })}
                    style={styles.input}
                  />
                </label>
                <label style={styles.fieldWide}>
                  <span style={styles.label}>Details</span>
                  <textarea
                    value={item.details}
                    onChange={(event) => updateItem(item.id, { details: event.target.value })}
                    rows={2}
                    style={styles.textarea}
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Action</span>
                  <select
                    value={item.actionType}
                    onChange={(event) =>
                      updateItem(item.id, {
                        actionType: event.target.value as DailyWorklistActionType,
                      })
                    }
                    style={styles.input}
                  >
                    <option value="none">No action</option>
                    <option value="url">Open link</option>
                    <option value="copy">Copy path</option>
                    <option value="copy_details">Copy details</option>
                  </select>
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Action label</span>
                  <input
                    type="text"
                    value={item.actionLabel}
                    onChange={(event) => updateItem(item.id, { actionLabel: event.target.value })}
                    placeholder="Open, Copy path, Copy details..."
                    style={styles.input}
                  />
                </label>
                <label style={styles.fieldWide}>
                  <span style={styles.label}>Action value</span>
                  <input
                    type="text"
                    value={item.actionValue}
                    onChange={(event) => updateItem(item.id, { actionValue: event.target.value })}
                    placeholder="URL or local path"
                    style={styles.input}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  content: {
    flex: 1,
    display: "grid",
    gap: "16px",
    minWidth: 0,
  },
  hero: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "16px",
    padding: "18px 20px",
    borderRadius: "24px",
    border: "1px solid rgba(143, 183, 228, 0.18)",
    background: "rgba(255,255,255,0.88)",
    boxShadow: "0 18px 44px rgba(52, 84, 120, 0.08)",
  },
  title: {
    margin: "4px 0 0",
    fontSize: "28px",
    lineHeight: 1.1,
    color: "#17324f",
  },
  subtitle: {
    margin: "8px 0 0",
    maxWidth: "760px",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#55708a",
  },
  heroActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    justifyContent: "flex-end",
  },
  primaryButton: {
    height: "38px",
    padding: "0 14px",
    borderRadius: "999px",
    border: "1px solid rgba(118, 186, 255, 0.30)",
    background: "linear-gradient(180deg, rgba(118, 186, 255, 0.20), rgba(118, 186, 255, 0.09))",
    color: "#24527f",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    height: "38px",
    padding: "0 14px",
    borderRadius: "999px",
    border: "1px solid rgba(143, 183, 228, 0.22)",
    background: "rgba(255,255,255,0.92)",
    color: "#315b88",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  notice: {
    padding: "10px 14px",
    borderRadius: "16px",
    border: "1px solid rgba(143, 183, 228, 0.18)",
    background: "rgba(255,255,255,0.82)",
    color: "#4f7092",
    fontSize: "12px",
    fontWeight: 700,
  },
  list: {
    display: "grid",
    gap: "12px",
    paddingBottom: "12px",
  },
  card: {
    padding: "14px",
    borderRadius: "22px",
    border: "1px solid rgba(143, 183, 228, 0.16)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 14px 28px rgba(52, 84, 120, 0.06)",
    display: "grid",
    gap: "12px",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  cardIndex: {
    width: "30px",
    height: "30px",
    borderRadius: "999px",
    background: "rgba(118, 186, 255, 0.14)",
    color: "#24527f",
    display: "grid",
    placeItems: "center",
    fontSize: "12px",
    fontWeight: 800,
    flexShrink: 0,
  },
  cardActions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px",
  },
  iconButton: {
    height: "30px",
    padding: "0 10px",
    borderRadius: "999px",
    border: "1px solid rgba(143, 183, 228, 0.22)",
    background: "rgba(255,255,255,0.92)",
    color: "#315b88",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  dangerButton: {
    height: "30px",
    padding: "0 10px",
    borderRadius: "999px",
    border: "1px solid rgba(214, 120, 120, 0.22)",
    background: "rgba(255,255,255,0.92)",
    color: "#a15353",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  field: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
  },
  fieldWide: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
    gridColumn: "1 / -1",
  },
  label: {
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
  textarea: {
    borderRadius: "12px",
    border: "1px solid rgba(143, 183, 228, 0.20)",
    background: "rgba(255,255,255,0.96)",
    padding: "10px 12px",
    outline: "none",
    color: "#17324f",
    resize: "vertical",
  },
};
