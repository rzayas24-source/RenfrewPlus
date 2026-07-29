import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createMiscEntry, deleteMiscEntry, getMisc, updateMiscEntry, type MiscEntry } from "../api/balsheet_api";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from "./adminscreen";

type MiscDraft = {
  posting_date: string;
  amount: string;
  misc_type: string;
  details: string;
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function createDraft(postingDate: string): MiscDraft {
  return {
    posting_date: postingDate,
    amount: "",
    misc_type: "",
    details: "",
  };
}

function parseAmount(value: string) {
  const normalized = value.replace(/[$,]/g, "").trim();
  if (!normalized) {
    return 0;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string) {
  if (!value) {
    return "Not set";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MiscEditorScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDay = searchParams.get("day") ?? todayString();
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [rows, setRows] = useState<MiscEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<MiscDraft>(createDraft(initialDay));
  const [editingRow, setEditingRow] = useState<MiscEntry | null>(null);
  const [editDraft, setEditDraft] = useState<MiscDraft>(createDraft(initialDay));

  useEffect(() => {
    const urlDay = searchParams.get("day");
    if (urlDay && urlDay !== selectedDay) {
      setSelectedDay(urlDay);
    }
  }, [searchParams, selectedDay]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set("day", selectedDay);
    if (searchParams.get("day") !== selectedDay) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, selectedDay, setSearchParams]);

  useEffect(() => {
    setNewDraft((current) => ({
      ...current,
      posting_date: selectedDay,
    }));
  }, [selectedDay]);

  useEffect(() => {
    void loadRows(selectedDay);
  }, [selectedDay]);

  const totalAmount = useMemo(() => rows.reduce((total, row) => total + Number(row.amount || 0), 0), [rows]);

  const latestCreated = useMemo(() => rows[0]?.created_at ?? "", [rows]);

  async function loadRows(day: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await getMisc(day);
      setRows(response.data);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Failed to load misc rows");
    } finally {
      setLoading(false);
    }
  }

  const refreshRows = async () => {
    setMessage(null);
    await loadRows(selectedDay);
  };

  const handleDayChange = (value: string) => {
    setSelectedDay(value);
    setMessage(null);
  };

  const startEdit = (row: MiscEntry) => {
    setEditingRow(row);
    setEditDraft({
      posting_date: row.posting_date,
      amount: Number(row.amount || 0).toFixed(2),
      misc_type: row.misc_type,
      details: row.details,
    });
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingRow(null);
  };

  const saveNewRow = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await createMiscEntry({
        posting_date: newDraft.posting_date.trim() || selectedDay,
        amount: parseAmount(newDraft.amount),
        misc_type: newDraft.misc_type.trim(),
        details: newDraft.details.trim(),
      });
      setNewDraft(createDraft(selectedDay));
      setMessage("Misc row added.");
      await loadRows(selectedDay);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add misc row");
    } finally {
      setSaving(false);
    }
  };

  const saveEditRow = async () => {
    if (!editingRow) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateMiscEntry(editingRow.misc_id, {
        posting_date: editDraft.posting_date.trim() || selectedDay,
        amount: parseAmount(editDraft.amount),
        misc_type: editDraft.misc_type.trim(),
        details: editDraft.details.trim(),
      });
      setEditingRow(null);
      setMessage("Misc row saved.");
      await loadRows(selectedDay);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save misc row");
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (row: MiscEntry) => {
    const confirmed = window.confirm(`Delete misc row for ${row.posting_date}?`);
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
      setMessage("Misc row deleted.");
      await loadRows(selectedDay);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete misc row");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      sidebarCopy="Create and maintain Misc rows for a selected posting day."
      onBack={() => navigate("/admin")}
      hideBackButton
      ribbonTitle="Misc Editor"
    >
      <section style={adminStyles.content}>
        <section style={adminStyles.heroActions}>
          <label style={styles.dayField}>
            <span style={styles.dayLabel}>Posting day</span>
            <input
              type="date"
              value={selectedDay}
              onChange={(event) => handleDayChange(event.target.value)}
              style={styles.dateInput}
            />
          </label>

          <button type="button" style={adminStyles.primaryButton} onClick={() => void refreshRows()} disabled={loading || saving}>
            Refresh
          </button>
          <button type="button" style={adminStyles.secondaryButton} onClick={() => handleDayChange(todayString())} disabled={saving}>
            Today
          </button>

          <div style={styles.toolbarMeta}>
            <span>{loading ? "Loading..." : `${rows.length} rows`}</span>
            <span>{formatCurrency(totalAmount)} total</span>
          </div>
        </section>

        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Misc editor</div>
            <p style={adminStyles.subtitle}>
              Add, update, and remove Misc detail rows for the selected posting day.
            </p>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Selected day</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>{selectedDay}</div>
              <div style={adminStyles.heroStatusText}>
                {rows.length > 0
                  ? `${rows.length} misc rows found for this day.`
                  : "No misc rows found for this day yet."}
              </div>
            </div>
          </div>
        </section>

        <section style={adminStyles.statsGrid}>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Rows</div>
            <div style={adminStyles.statValue}>{rows.length}</div>
            <div style={adminStyles.statDetail}>All Misc entries for the selected posting day.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Total</div>
            <div style={adminStyles.statValue}>{formatCurrency(totalAmount)}</div>
            <div style={adminStyles.statDetail}>Sum of the amounts currently loaded on screen.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Latest</div>
            <div style={adminStyles.statValue}>{latestCreated ? formatDateTime(latestCreated) : "None"}</div>
            <div style={adminStyles.statDetail}>Most recent created_at timestamp in the current day.</div>
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
              <h2 style={adminStyles.sectionTitle}>Create a new Misc row</h2>
            </div>
            <div style={adminStyles.sectionMeta}>The posting day defaults to the day you are viewing now.</div>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Posting date</span>
              <input
                type="date"
                value={newDraft.posting_date}
                onChange={(event) => setNewDraft((current) => ({ ...current, posting_date: event.target.value }))}
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Amount</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={newDraft.amount}
                onChange={(event) => setNewDraft((current) => ({ ...current, amount: event.target.value }))}
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Misc type</span>
              <input
                type="text"
                placeholder="Example: Adjustment"
                value={newDraft.misc_type}
                onChange={(event) => setNewDraft((current) => ({ ...current, misc_type: event.target.value }))}
                style={styles.input}
              />
            </label>

            <label style={styles.fieldFull}>
              <span style={styles.label}>Details</span>
              <textarea
                value={newDraft.details}
                onChange={(event) => setNewDraft((current) => ({ ...current, details: event.target.value }))}
                placeholder="Add any supporting notes here."
                style={styles.textarea}
              />
            </label>

            <div style={styles.actionsRow}>
              <button type="button" style={adminStyles.primaryButton} onClick={() => void saveNewRow()} disabled={saving}>
                Add Misc Row
              </button>
            </div>
          </div>
        </section>

        {editingRow && (
          <section style={adminStyles.widgetSection}>
            <div style={adminStyles.sectionHeader}>
              <div>
                <div style={adminStyles.sectionKicker}>Edit misc</div>
                <h2 style={adminStyles.sectionTitle}>Update the selected Misc row</h2>
              </div>
              <div style={adminStyles.sectionMeta}>You are editing an existing row. Save to keep the changes.</div>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Posting date</span>
                <input
                  type="date"
                  value={editDraft.posting_date}
                  onChange={(event) => setEditDraft((current) => ({ ...current, posting_date: event.target.value }))}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Amount</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editDraft.amount}
                  onChange={(event) => setEditDraft((current) => ({ ...current, amount: event.target.value }))}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Misc type</span>
                <input
                  type="text"
                  value={editDraft.misc_type}
                  onChange={(event) => setEditDraft((current) => ({ ...current, misc_type: event.target.value }))}
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
              <h2 style={adminStyles.sectionTitle}>Rows for {selectedDay}</h2>
            </div>
            <div style={adminStyles.sectionMeta}>{loading ? "Loading..." : `${rows.length} rows shown`}</div>
          </div>

          {loading ? (
            <div style={styles.emptyState}>Loading misc rows...</div>
          ) : rows.length === 0 ? (
            <div style={styles.emptyState}>No misc rows found for this day.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Posting Date</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Misc Type</th>
                    <th style={styles.th}>Details</th>
                    <th style={styles.th}>Created</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.misc_id} style={styles.row}>
                      <td style={styles.td}>{row.posting_date}</td>
                      <td style={styles.tdAmount}>{formatCurrency(Number(row.amount || 0))}</td>
                      <td style={styles.td}>{row.misc_type || "-"}</td>
                      <td style={styles.tdDetails}>{row.details || "-"}</td>
                      <td style={styles.td}>{formatDateTime(row.created_at)}</td>
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
  dayField: {
    display: "grid",
    gap: "6px",
    minWidth: "190px",
  },
  dayLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  dateInput: {
    height: "44px",
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255,255,255,0.94)",
    padding: "0 12px",
    fontSize: "14px",
    color: "#17324f",
    boxSizing: "border-box",
  },
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
    minWidth: "980px",
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
  td: {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.12)",
    verticalAlign: "top",
    color: "#35506d",
  },
  tdAmount: {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.12)",
    verticalAlign: "top",
    color: "#17324f",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  tdDetails: {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.12)",
    verticalAlign: "top",
    color: "#35506d",
    minWidth: "280px",
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
