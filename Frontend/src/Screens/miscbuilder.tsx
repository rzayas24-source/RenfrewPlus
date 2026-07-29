import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createMiscEntry, deleteMiscEntry, getMisc, updateMiscEntry, type MiscEntry } from "../api/balsheet_api";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from "./adminscreen";

type MiscDraft = {
  label: string;
  details: string;
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function createDraft(): MiscDraft {
  return {
    label: "",
    details: "",
  };
}

export default function MiscBuilderScreen() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<MiscEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<MiscDraft>(createDraft());
  const [editingRow, setEditingRow] = useState<MiscEntry | null>(null);
  const [editDraft, setEditDraft] = useState<MiscDraft>(createDraft());

  useEffect(() => {
    void loadRows();
  }, []);

  const sortedRows = useMemo(() => {
    return [...rows].sort((left, right) => {
      const leftLabel = left.misc_type.trim().toLowerCase();
      const rightLabel = right.misc_type.trim().toLowerCase();
      if (leftLabel !== rightLabel) {
        return leftLabel.localeCompare(rightLabel);
      }
      return left.created_at.localeCompare(right.created_at);
    });
  }, [rows]);

  const labelOptions = useMemo(() => {
    return Array.from(new Set(sortedRows.map((row) => row.misc_type.trim()).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right)
    );
  }, [sortedRows]);

  const stats = useMemo(() => {
    return {
      total: sortedRows.length,
      labels: labelOptions.length,
      latest: sortedRows[0]?.created_at ?? "",
    };
  }, [labelOptions.length, sortedRows]);

  async function loadRows() {
    setLoading(true);
    setError(null);
    try {
      const response = await getMisc();
      setRows(response.data);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Failed to load misc list");
    } finally {
      setLoading(false);
    }
  }

  const refreshRows = async () => {
    setMessage(null);
    await loadRows();
  };

  const startEdit = (row: MiscEntry) => {
    setEditingRow(row);
    setEditDraft({
      label: row.misc_type,
      details: row.details,
    });
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingRow(null);
  };

  const saveNewRow = async () => {
    const label = newDraft.label.trim();
    if (!label) {
      setError("A misc label is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await createMiscEntry({
        posting_date: todayString(),
        amount: 0,
        misc_type: label,
        details: newDraft.details.trim(),
      });
      setNewDraft(createDraft());
      setMessage("Misc option added.");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add misc option");
    } finally {
      setSaving(false);
    }
  };

  const saveEditRow = async () => {
    if (!editingRow) {
      return;
    }

    const label = editDraft.label.trim();
    if (!label) {
      setError("A misc label is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateMiscEntry(editingRow.misc_id, {
        posting_date: editingRow.posting_date || todayString(),
        amount: Number(editingRow.amount || 0),
        misc_type: label,
        details: editDraft.details.trim(),
      });
      setEditingRow(null);
      setMessage("Misc option saved.");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save misc option");
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (row: MiscEntry) => {
    const confirmed = window.confirm(`Delete misc option "${row.misc_type}"?`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await deleteMiscEntry(row.misc_id);
      if (editingRow?.misc_id === row.misc_id) {
        setEditingRow(null);
      }
      setMessage("Misc option deleted.");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete misc option");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      sidebarCopy="Maintain reusable Misc labels and notes that other screens can use in dropdowns."
      onBack={() => navigate("/admin")}
      hideBackButton
      useGlobalMenuFallback={false}
      ribbonTitle="Misc Editor"
    >
      <section style={adminStyles.content}>
        <section style={adminStyles.heroActions}>
          <button type="button" style={adminStyles.primaryButton} onClick={() => void refreshRows()} disabled={loading || saving}>
            Refresh
          </button>
          <button type="button" style={adminStyles.secondaryButton} onClick={() => setNewDraft(createDraft())} disabled={saving}>
            Clear draft
          </button>

          <div style={styles.toolbarMeta}>
            <span>{loading ? "Loading..." : `${stats.total} rows`}</span>
            <span>{stats.labels} labels</span>
          </div>
        </section>

        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Misc lookup list</div>
            <p style={adminStyles.subtitle}>
              Keep a small reusable list of misc choices so other screens can offer faster dropdown picks.
            </p>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Lookup table</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Dropdown source</div>
              <div style={adminStyles.heroStatusText}>
                Add the labels you want to reuse, then pull them into itemization and review screens.
              </div>
            </div>
          </div>
        </section>

        <section style={adminStyles.statsGrid}>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Rows</div>
            <div style={adminStyles.statValue}>{stats.total}</div>
            <div style={adminStyles.statDetail}>Saved misc options available to other features.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Labels</div>
            <div style={adminStyles.statValue}>{stats.labels}</div>
            <div style={adminStyles.statDetail}>Unique labels that can power dropdowns.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Latest</div>
            <div style={adminStyles.statValue}>{stats.latest || "None"}</div>
            <div style={adminStyles.statDetail}>Most recent saved lookup item.</div>
          </article>
        </section>

        {(error || message) && (
          <section style={styles.noticeStack}>
            {error && <div style={styles.errorBanner}>{error}</div>}
            {!error && message && <div style={styles.successBanner}>{message}</div>}
          </section>
        )}

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Add misc</div>
              <h2 style={adminStyles.sectionTitle}>Create a new dropdown option</h2>
            </div>
            <div style={adminStyles.sectionMeta}>Type a label once, then reuse it anywhere you need a quicker pick list.</div>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Label</span>
              <input
                type="text"
                list="misc-label-options"
                placeholder="Example: Adjustment"
                value={newDraft.label}
                onChange={(event) => setNewDraft((current) => ({ ...current, label: event.target.value }))}
                style={styles.input}
              />
              <datalist id="misc-label-options">
                {labelOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>

            <label style={styles.fieldFull}>
              <span style={styles.label}>Details</span>
              <textarea
                value={newDraft.details}
                onChange={(event) => setNewDraft((current) => ({ ...current, details: event.target.value }))}
                placeholder="Optional notes to help explain this choice."
                style={styles.textarea}
              />
            </label>

            <div style={styles.actionsRow}>
              <button type="button" style={adminStyles.primaryButton} onClick={() => void saveNewRow()} disabled={saving}>
                Add Option
              </button>
            </div>
          </div>
        </section>

        {editingRow && (
          <section style={adminStyles.widgetSection}>
            <div style={adminStyles.sectionHeader}>
              <div>
                <div style={adminStyles.sectionKicker}>Edit misc</div>
                <h2 style={adminStyles.sectionTitle}>Update the selected option</h2>
              </div>
              <div style={adminStyles.sectionMeta}>Change the label or notes, then save to refresh any dropdowns that use it.</div>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Label</span>
                <input
                  type="text"
                  list="misc-label-options"
                  value={editDraft.label}
                  onChange={(event) => setEditDraft((current) => ({ ...current, label: event.target.value }))}
                  style={styles.input}
                />
              </label>

              <label style={styles.fieldFull}>
                <span style={styles.label}>Details</span>
                <textarea
                  value={editDraft.details}
                  onChange={(event) => setEditDraft((current) => ({ ...current, details: event.target.value }))}
                  style={styles.textarea}
                />
              </label>

              <div style={styles.actionsRow}>
                <button type="button" style={adminStyles.primaryButton} onClick={() => void saveEditRow()} disabled={saving}>
                  Save Changes
                </button>
                <button type="button" style={adminStyles.secondaryButton} onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          </section>
        )}

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Misc list</div>
              <h2 style={adminStyles.sectionTitle}>Reusable dropdown values</h2>
            </div>
            <div style={adminStyles.sectionMeta}>{loading ? "Loading..." : `${sortedRows.length} rows shown`}</div>
          </div>

          {loading ? (
            <div style={styles.emptyState}>Loading misc list...</div>
          ) : sortedRows.length === 0 ? (
            <div style={styles.emptyState}>No misc labels saved yet.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Label</th>
                    <th style={styles.th}>Details</th>
                    <th style={styles.th}>Created</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr key={row.misc_id} style={styles.row}>
                      <td style={styles.tdLabel}>{row.misc_type || "-"}</td>
                      <td style={styles.td}>{row.details || "-"}</td>
                      <td style={styles.td}>{row.created_at || "-"}</td>
                      <td style={styles.tdActions}>
                        <button type="button" style={styles.actionButton} onClick={() => startEdit(row)} disabled={saving}>
                          Edit
                        </button>
                        <button type="button" style={styles.deleteButton} onClick={() => void removeRow(row)} disabled={saving}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </AdminShell>
  );
}

const styles: Record<string, CSSProperties> = {
  toolbarMeta: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginLeft: "auto",
    color: "#5f6b7a",
    fontSize: "13px",
    fontWeight: 700,
  },
  noticeStack: {
    display: "grid",
    gap: "10px",
  },
  errorBanner: {
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid rgba(212, 161, 161, 0.34)",
    background: "rgba(255, 244, 244, 0.96)",
    color: "#9d3a3a",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.45,
  },
  successBanner: {
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid rgba(163, 212, 181, 0.34)",
    background: "rgba(244, 255, 247, 0.96)",
    color: "#27633f",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.45,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
    alignItems: "start",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  fieldFull: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    gridColumn: "1 / -1",
  },
  label: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#27405e",
  },
  input: {
    height: "44px",
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.30)",
    background: "#ffffff",
    color: "#1f2933",
    padding: "0 12px",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
  },
  textarea: {
    minHeight: "120px",
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.30)",
    background: "#ffffff",
    color: "#1f2933",
    padding: "12px",
    fontSize: "15px",
    lineHeight: 1.5,
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
  },
  actionsRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
    gridColumn: "1 / -1",
  },
  emptyState: {
    padding: "18px 16px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.82)",
    border: "1px dashed rgba(140, 160, 184, 0.30)",
    color: "#5f6b7a",
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.82)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "760px",
  },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    borderBottom: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(247, 250, 253, 0.92)",
  },
  row: {
    background: "rgba(255,255,255,0.88)",
  },
  tdLabel: {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.12)",
    verticalAlign: "top",
    color: "#17324f",
    fontWeight: 800,
  },
  td: {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.12)",
    verticalAlign: "top",
    color: "#35506d",
  },
  tdActions: {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.12)",
    verticalAlign: "top",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  actionButton: {
    height: "36px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.28)",
    background: "#ffffff",
    color: "#35506d",
    fontWeight: 700,
    cursor: "pointer",
  },
  deleteButton: {
    height: "36px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(200, 90, 90, 0.28)",
    background: "#fff5f5",
    color: "#a32121",
    fontWeight: 700,
    cursor: "pointer",
  },
};
