import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDevNote, deleteDevNote, getDevNotes, updateDevNote, type DevNoteRow } from "../api/devnotes_api";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from "./adminscreen";

type DevNoteFormState = {
  category: string;
  title: string;
  notes: string;
  is_done: boolean;
};

const DEV_NOTE_CATEGORIES = ["Todo", "Reminder", "Feature", "Idea"] as const;

const DEFAULT_DEV_NOTE_FORM: DevNoteFormState = {
  category: "Todo",
  title: "",
  notes: "",
  is_done: false,
};

export default function DevNoteScreen() {
  const navigate = useNavigate();
  const [devNotes, setDevNotes] = useState<DevNoteRow[]>([]);
  const [devNotesLoading, setDevNotesLoading] = useState(true);
  const [devNotesSubmitting, setDevNotesSubmitting] = useState(false);
  const [devNotesError, setDevNotesError] = useState<string | null>(null);
  const [editingDevNoteId, setEditingDevNoteId] = useState<number | null>(null);
  const [devNoteForm, setDevNoteForm] = useState<DevNoteFormState>(DEFAULT_DEV_NOTE_FORM);

  useEffect(() => {
    let active = true;

    getDevNotes()
      .then((response) => {
        if (!active) return;
        setDevNotes(response.data.rows);
        setDevNotesError(null);
      })
      .catch((error) => {
        if (!active) return;
        setDevNotes([]);
        setDevNotesError(error instanceof Error ? error.message : "Failed to load Dev Notes");
      })
      .finally(() => {
        if (active) setDevNotesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const devNoteStats = useMemo(() => {
    const done = devNotes.filter((note) => note.is_done).length;
    return {
      total: devNotes.length,
      open: devNotes.length - done,
      done,
      latestUpdated: devNotes[0]?.updated_at ?? "",
    };
  }, [devNotes]);

  function resetDevNoteForm() {
    setDevNoteForm(DEFAULT_DEV_NOTE_FORM);
    setEditingDevNoteId(null);
  }

  function editDevNote(note: DevNoteRow) {
    setEditingDevNoteId(note.id);
    setDevNoteForm({
      category: note.category || "Todo",
      title: note.title,
      notes: note.notes,
      is_done: note.is_done,
    });
  }

  async function refreshDevNotes() {
    const response = await getDevNotes();
    setDevNotes(response.data.rows);
  }

  async function handleDevNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDevNotesSubmitting(true);
    setDevNotesError(null);

    try {
      const payload = {
        category: devNoteForm.category,
        title: devNoteForm.title,
        notes: devNoteForm.notes,
        is_done: devNoteForm.is_done,
      };

      const response =
        editingDevNoteId === null
          ? await createDevNote(payload)
          : await updateDevNote(editingDevNoteId, payload);

      const savedRow = response.data.row;
      if (savedRow) {
        setDevNotes((current) => {
          const next = current.filter((note) => note.id !== savedRow.id);
          next.unshift(savedRow);
          return next.sort((left, right) => {
            if (left.is_done !== right.is_done) {
              return Number(left.is_done) - Number(right.is_done);
            }
            return right.updated_at.localeCompare(left.updated_at) || right.id - left.id;
          });
        });
      } else {
        await refreshDevNotes();
      }

      resetDevNoteForm();
    } catch (error) {
      setDevNotesError(error instanceof Error ? error.message : "Failed to save Dev Note");
    } finally {
      setDevNotesSubmitting(false);
    }
  }

  async function handleDevNoteDelete(note: DevNoteRow) {
    if (!window.confirm(`Delete the Dev Note "${note.title}"?`)) {
      return;
    }

    setDevNotesSubmitting(true);
    setDevNotesError(null);

    try {
      await deleteDevNote(note.id);
      setDevNotes((current) => current.filter((item) => item.id !== note.id));
      if (editingDevNoteId === note.id) {
        resetDevNoteForm();
      }
    } catch (error) {
      setDevNotesError(error instanceof Error ? error.message : "Failed to delete Dev Note");
    } finally {
      setDevNotesSubmitting(false);
    }
  }

  return (
    <AdminShell
      sidebarCopy="A quiet scratchpad for reminders, feature ideas, and quick to-dos."
      sidebarCardLabel="Dev Notes"
      sidebarCardValue={`${devNoteStats.open} open`}
      sidebarCardMeta={`${devNoteStats.done} done, ${devNoteStats.total} total.`}
      onBack={() => navigate("/admin")}
      hideBackButton
      useGlobalMenuFallback={false}
    >
      <section style={styles.page}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Admin screen</div>
            <p style={adminStyles.subtitle}>Dev Notes</p>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Notes board</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Keep the next thing visible</div>
              <div style={adminStyles.heroStatusText}>
                A quick place to capture reminders, feature ideas, and the little tasks we do not want to lose.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          <article style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Total</div>
            <div style={styles.summaryValue}>{devNoteStats.total}</div>
            <div style={styles.summaryMeta}>All saved notes.</div>
          </article>
          <article style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Open</div>
            <div style={styles.summaryValue}>{devNoteStats.open}</div>
            <div style={styles.summaryMeta}>Items still waiting.</div>
          </article>
          <article style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Done</div>
            <div style={styles.summaryValue}>{devNoteStats.done}</div>
            <div style={styles.summaryMeta}>Finished notes and tasks.</div>
          </article>
        </section>

        {devNotesError && <div style={styles.errorBanner}>{devNotesError}</div>}

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>{editingDevNoteId === null ? "New note" : "Editing note"}</div>
              <h2 style={adminStyles.sectionTitle}>{editingDevNoteId === null ? "Add a Dev Note" : "Update Dev Note"}</h2>
            </div>
            <div style={styles.cardHeaderMeta}>
              {editingDevNoteId === null ? "Capture something quickly." : "Make a quick adjustment, then save."}
            </div>
          </div>

          <form style={styles.formGrid} onSubmit={handleDevNoteSubmit}>
            <label style={styles.field}>
              <span style={styles.label}>Category</span>
              <select
                value={devNoteForm.category}
                onChange={(event) => setDevNoteForm((current) => ({ ...current, category: event.target.value }))}
                style={adminStyles.input}
              >
                {DEV_NOTE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Title</span>
              <input
                value={devNoteForm.title}
                onChange={(event) => setDevNoteForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Short reminder or feature name"
                style={adminStyles.input}
                required
              />
            </label>

            <label style={styles.fieldFull}>
              <span style={styles.label}>Notes</span>
              <textarea
                value={devNoteForm.notes}
                onChange={(event) => setDevNoteForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Describe the reminder, todo, or feature idea."
                style={styles.textarea}
                rows={6}
                required
              />
            </label>

            <label style={styles.checkRow}>
              <input
                type="checkbox"
                checked={devNoteForm.is_done}
                onChange={(event) => setDevNoteForm((current) => ({ ...current, is_done: event.target.checked }))}
                style={styles.checkbox}
              />
              <span style={styles.checkLabel}>Mark as done</span>
            </label>

            <div style={styles.formActions}>
              <button type="button" style={styles.secondaryButton} onClick={resetDevNoteForm} disabled={devNotesSubmitting}>
                Clear
              </button>
              <button type="submit" style={adminStyles.primaryButton} disabled={devNotesSubmitting}>
                {devNotesSubmitting ? "Saving..." : editingDevNoteId === null ? "Add note" : "Save changes"}
              </button>
            </div>
          </form>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Saved notes</div>
              <h2 style={adminStyles.sectionTitle}>Recent Dev Notes</h2>
            </div>
            <div style={styles.cardHeaderMeta}>
              {devNotesLoading ? "Loading..." : `${devNotes.length} note${devNotes.length === 1 ? "" : "s"}`}
              {devNoteStats.latestUpdated ? ` | Updated ${devNoteStats.latestUpdated}` : ""}
            </div>
          </div>

          <div style={styles.noteList}>
            {devNotesLoading ? (
              <div style={styles.emptyState}>Loading Dev Notes...</div>
            ) : devNotes.length === 0 ? (
              <div style={styles.emptyState}>No Dev Notes yet. Add one above.</div>
            ) : (
              devNotes.map((note) => (
                <article key={note.id} style={styles.noteCard}>
                  <div style={styles.noteTopRow}>
                    <div style={styles.noteHeadingBlock}>
                      <div style={styles.noteTitleRow}>
                        <div style={styles.noteTitle}>{note.title}</div>
                        {note.is_done ? <span style={{ ...styles.badge, ...styles.doneBadge }}>Done</span> : null}
                      </div>
                      <div style={styles.noteMeta}>
                        <span style={styles.categoryPill}>{note.category}</span>
                        <span>Updated {note.updated_at}</span>
                      </div>
                    </div>
                    <div style={styles.noteActionGroup}>
                      <button type="button" style={styles.noteButton} onClick={() => editDevNote(note)}>
                        Edit
                      </button>
                      <button type="button" style={styles.noteButtonDanger} onClick={() => handleDevNoteDelete(note)}>
                        Delete
                      </button>
                    </div>
                  </div>
                  <div style={styles.noteBody}>{note.notes}</div>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </AdminShell>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "grid",
    gap: "18px",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
  },
  summaryCard: {
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.94)",
    padding: "16px",
    boxShadow: "0 14px 28px rgba(52, 84, 120, 0.06)",
  },
  summaryLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  summaryValue: {
    marginTop: "8px",
    fontSize: "30px",
    fontWeight: 900,
    color: "#17324f",
  },
  summaryMeta: {
    marginTop: "6px",
    fontSize: "13px",
    color: "#5f7288",
    lineHeight: 1.45,
  },
  errorBanner: {
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid rgba(220, 96, 96, 0.22)",
    background: "rgba(255, 240, 240, 0.96)",
    color: "#9c3042",
    fontWeight: 700,
  },
  card: {
    borderRadius: "22px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.96)",
    padding: "18px",
    boxShadow: "0 18px 36px rgba(52, 84, 120, 0.06)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "12px",
    marginBottom: "14px",
    flexWrap: "wrap",
  },
  cardHeaderMeta: {
    fontSize: "13px",
    color: "#5f7288",
    fontWeight: 700,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },
  field: {
    display: "grid",
    gap: "6px",
  },
  fieldFull: {
    display: "grid",
    gap: "6px",
    gridColumn: "1 / -1",
  },
  label: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#4f6277",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  textarea: {
    width: "100%",
    minHeight: "170px",
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.24)",
    background: "rgba(255,255,255,0.98)",
    color: "#17324f",
    padding: "12px 14px",
    fontSize: "14px",
    lineHeight: 1.55,
    outline: "none",
    resize: "vertical",
    boxShadow: "inset 0 1px 2px rgba(52, 84, 120, 0.03)",
  },
  checkRow: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  checkbox: {
    width: "18px",
    height: "18px",
    accentColor: "#6d91bf",
  },
  checkLabel: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#35506d",
  },
  formActions: {
    gridColumn: "1 / -1",
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    flexWrap: "wrap",
    paddingTop: "2px",
  },
  secondaryButton: {
    height: "44px",
    padding: "0 18px",
    borderRadius: "14px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    background: "rgba(255,255,255,0.9)",
    color: "#35506d",
    fontWeight: 800,
    cursor: "pointer",
  },
  noteList: {
    display: "grid",
    gap: "12px",
  },
  emptyState: {
    padding: "18px",
    borderRadius: "16px",
    background: "rgba(245, 248, 252, 0.92)",
    color: "#667a90",
    fontWeight: 700,
  },
  noteCard: {
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,253,0.96))",
    padding: "16px",
  },
  noteTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  noteHeadingBlock: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
    flex: 1,
  },
  noteTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  noteTitle: {
    fontSize: "16px",
    fontWeight: 900,
    color: "#17324f",
    lineHeight: 1.2,
    wordBreak: "break-word",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    background: "rgba(236, 245, 255, 0.96)",
    color: "#274f84",
  },
  doneBadge: {
    background: "rgba(236, 248, 238, 0.96)",
    color: "#2e6f45",
  },
  noteMeta: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
    fontSize: "12px",
    color: "#6d7f93",
    fontWeight: 700,
  },
  categoryPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: "999px",
    background: "rgba(224, 237, 250, 0.95)",
    color: "#35506d",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  noteActionGroup: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  noteButton: {
    minHeight: "36px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255,255,255,0.95)",
    color: "#35506d",
    fontWeight: 800,
    cursor: "pointer",
  },
  noteButtonDanger: {
    minHeight: "36px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(220, 96, 96, 0.20)",
    background: "rgba(255, 242, 242, 0.96)",
    color: "#9c3042",
    fontWeight: 800,
    cursor: "pointer",
  },
  noteBody: {
    marginTop: "12px",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#31465d",
    whiteSpace: "pre-wrap",
  },
};
