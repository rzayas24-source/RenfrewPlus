import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createCrashlog, getCrashlogs, type CrashlogRow } from "../api/crashlogs_api";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from "./adminscreen";

const INCIDENT_HISTORY_ITEMS = [
  {
    date: "2026-08-13",
    title: "Phase 1 browser crash / candidate filtering cleanup",
    details:
      "The app servers were stable during the incident. The crash was most likely caused by the browser session or a transient frontend runtime issue, not a backend outage.",
    notes:
      "During the same work session, Phase 1 candidate filtering was updated to exclude cached image artifacts (.png and .jpg), and the backend was restarted and verified.",
  },
];

const DEFAULT_FORM = {
  status: "Open",
  severity: "Info",
  screen: "",
  summary: "",
  details: "",
  frontend_health: "",
  backend_health: "",
  browser_health: "",
  created_by: "",
};

export default function CrashLogScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [rows, setRows] = useState<CrashlogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [incidentAt, setIncidentAt] = useState(new Date().toISOString().slice(0, 19));

  useEffect(() => {
    let active = true;

    getCrashlogs()
      .then((response) => {
        if (!active) {
          return;
        }
        setRows(response.data.rows);
        setError(null);
      })
      .catch((err) => {
        if (active) {
          setRows([]);
          setError(err instanceof Error ? err.message : "Failed to load crash logs");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    const openCount = rows.filter((row) => row.status.toLowerCase() !== "closed").length;
    const criticalCount = rows.filter((row) => row.severity.toLowerCase() === "critical").length;
    return {
      count: rows.length,
      openCount,
      criticalCount,
    };
  }, [rows]);

  async function refreshLogs() {
    const response = await getCrashlogs();
    setRows(response.data.rows);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await createCrashlog({
        incident_at: incidentAt,
        status: form.status,
        severity: form.severity,
        screen: form.screen || location.pathname + location.search,
        summary: form.summary,
        details: form.details,
        frontend_health: form.frontend_health,
        backend_health: form.backend_health,
        browser_health: form.browser_health,
        created_by: form.created_by,
      });

      if (response.data.row) {
        setRows((current) => [response.data.row!, ...current]);
      } else {
        await refreshLogs();
      }

      setForm(DEFAULT_FORM);
      setIncidentAt(new Date().toISOString().slice(0, 19));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save crash log");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminShell
      sidebarCopy="A durable incident history for browser crashes, app issues, and other support notes."
      sidebarCardLabel="Crashlogs"
      sidebarCardValue={`${totals.count} entries`}
      sidebarCardMeta={`${totals.openCount} open, ${totals.criticalCount} critical.`}
      onBack={() => navigate("/admin")}
      hideBackButton
      useGlobalMenuFallback={false}
      ribbonTitle="Crashlogs"
    >
      <section style={styles.page}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Admin incident log</div>
            <p style={adminStyles.subtitle}>Record app crashes and support incidents in one place.</p>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Incident history</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Crashlogs table</div>
              <div style={adminStyles.heroStatusText}>
                Keep the important details together: screen, summary, severity, browser state, and server health.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          <article style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Entries</div>
            <div style={styles.summaryValue}>{totals.count}</div>
            <div style={styles.summaryMeta}>Saved crash and incident notes.</div>
          </article>
          <article style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Open</div>
            <div style={styles.summaryValue}>{totals.openCount}</div>
            <div style={styles.summaryMeta}>Incidents not marked closed yet.</div>
          </article>
          <article style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Critical</div>
            <div style={styles.summaryValue}>{totals.criticalCount}</div>
            <div style={styles.summaryMeta}>High priority issues at a glance.</div>
          </article>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Incident history</div>
              <h2 style={adminStyles.sectionTitle}>App-side incident notes</h2>
            </div>
            <div style={adminStyles.sectionMeta}>Baked into the app</div>
          </div>

          <div style={styles.historyList}>
            {INCIDENT_HISTORY_ITEMS.map((item) => (
              <article key={item.date} style={styles.historyCard}>
                <div style={styles.historyTopRow}>
                  <div>
                    <div style={styles.historyDate}>{item.date}</div>
                    <div style={styles.historyTitle}>{item.title}</div>
                  </div>
                </div>
                <div style={styles.historyDetails}>{item.details}</div>
                <div style={styles.historyNotes}>{item.notes}</div>
              </article>
            ))}
          </div>
        </section>

        {error && <div style={styles.errorBanner}>{error}</div>}

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>New entry</div>
              <h2 style={adminStyles.sectionTitle}>Log an incident</h2>
            </div>
          </div>

          <form style={styles.formGrid} onSubmit={handleSubmit}>
            <label style={styles.field}>
              <span style={styles.label}>Incident time</span>
              <input
                type="datetime-local"
                value={incidentAt}
                onChange={(event) => setIncidentAt(event.target.value)}
                style={adminStyles.input}
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Status</span>
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                style={adminStyles.input}
              >
                <option value="Open">Open</option>
                <option value="Investigating">Investigating</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Severity</span>
              <select
                value={form.severity}
                onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value }))}
                style={adminStyles.input}
              >
                <option value="Info">Info</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Screen</span>
              <input
                value={form.screen}
                onChange={(event) => setForm((current) => ({ ...current, screen: event.target.value }))}
                placeholder={location.pathname + location.search}
                style={adminStyles.input}
              />
            </label>
            <label style={styles.fieldFull}>
              <span style={styles.label}>Summary</span>
              <input
                value={form.summary}
                onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                placeholder="Short incident summary"
                style={adminStyles.input}
                required
              />
            </label>
            <label style={styles.fieldFull}>
              <span style={styles.label}>Details</span>
              <textarea
                value={form.details}
                onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))}
                placeholder="What happened, what was healthy, and what changed"
                style={{ ...adminStyles.input, minHeight: "120px", resize: "vertical" }}
                required
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Frontend health</span>
              <input
                value={form.frontend_health}
                onChange={(event) => setForm((current) => ({ ...current, frontend_health: event.target.value }))}
                placeholder="Example: 5174 alive"
                style={adminStyles.input}
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Backend health</span>
              <input
                value={form.backend_health}
                onChange={(event) => setForm((current) => ({ ...current, backend_health: event.target.value }))}
                placeholder="Example: 8001 alive"
                style={adminStyles.input}
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Browser health</span>
              <input
                value={form.browser_health}
                onChange={(event) => setForm((current) => ({ ...current, browser_health: event.target.value }))}
                placeholder="Example: in-app browser unavailable"
                style={adminStyles.input}
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Logged by</span>
              <input
                value={form.created_by}
                onChange={(event) => setForm((current) => ({ ...current, created_by: event.target.value }))}
                placeholder="Optional"
                style={adminStyles.input}
              />
            </label>
            <div style={styles.formActions}>
              <button type="submit" style={adminStyles.primaryButton} disabled={submitting}>
                {submitting ? "Saving..." : "Save crash log"}
              </button>
            </div>
          </form>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>History</div>
              <h2 style={adminStyles.sectionTitle}>Recent incidents</h2>
            </div>
            <div style={adminStyles.sectionMeta}>{loading ? "Loading..." : `${rows.length} log(s)`}</div>
          </div>

          <div style={styles.logList}>
            {rows.length === 0 ? (
              <div style={styles.emptyState}>No crash logs yet.</div>
            ) : (
              rows.map((row) => (
                <article key={row.id} style={styles.logCard}>
                  <div style={styles.logTopRow}>
                    <div>
                      <div style={styles.logTitle}>{row.summary}</div>
                      <div style={styles.logMeta}>
                        {row.created_at} · {row.screen || "No screen recorded"}
                      </div>
                    </div>
                    <div style={styles.badgeRow}>
                      <span style={{ ...styles.badge, ...severityStyles[row.severity.toLowerCase()] }}>{row.severity}</span>
                      <span style={{ ...styles.badge, ...statusStyles[row.status.toLowerCase()] }}>{row.status}</span>
                    </div>
                  </div>
                  <div style={styles.logDetails}>{row.details}</div>
                  <div style={styles.logHealthGrid}>
                    <div style={styles.healthPill}>Frontend: {row.frontend_health || "n/a"}</div>
                    <div style={styles.healthPill}>Backend: {row.backend_health || "n/a"}</div>
                    <div style={styles.healthPill}>Browser: {row.browser_health || "n/a"}</div>
                    <div style={styles.healthPill}>Incident: {row.incident_at}</div>
                  </div>
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
  card: {
    borderRadius: "22px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.96)",
    padding: "18px",
    boxShadow: "0 18px 36px rgba(52, 84, 120, 0.06)",
  },
  historyList: {
    display: "grid",
    gap: "12px",
  },
  historyCard: {
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,253,0.96))",
    padding: "16px",
    display: "grid",
    gap: "8px",
  },
  historyTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  historyDate: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#6d7f93",
    fontWeight: 800,
    marginBottom: "6px",
  },
  historyTitle: {
    fontSize: "16px",
    fontWeight: 900,
    color: "#17324f",
  },
  historyDetails: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#31465d",
  },
  historyNotes: {
    fontSize: "13px",
    lineHeight: 1.55,
    color: "#5f7288",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "12px",
    marginBottom: "14px",
    flexWrap: "wrap",
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
  formActions: {
    gridColumn: "1 / -1",
    display: "flex",
    justifyContent: "flex-end",
    paddingTop: "4px",
  },
  logList: {
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
  logCard: {
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,250,253,0.96))",
    padding: "16px",
  },
  logTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  logTitle: {
    fontSize: "16px",
    fontWeight: 900,
    color: "#17324f",
  },
  logMeta: {
    marginTop: "4px",
    fontSize: "13px",
    color: "#6d7f93",
    fontWeight: 700,
  },
  badgeRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  logDetails: {
    marginTop: "12px",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#31465d",
  },
  logHealthGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
    marginTop: "12px",
  },
  healthPill: {
    borderRadius: "999px",
    background: "rgba(236, 245, 255, 0.88)",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 800,
    color: "#17324f",
  },
};

const severityStyles: Record<string, CSSProperties> = {
  info: { background: "rgba(231, 245, 255, 0.95)", color: "#1f5f99" },
  low: { background: "rgba(236, 248, 238, 0.95)", color: "#2e6f45" },
  medium: { background: "rgba(255, 245, 229, 0.96)", color: "#8a5a00" },
  high: { background: "rgba(255, 236, 232, 0.96)", color: "#a84427" },
  critical: { background: "rgba(255, 226, 231, 0.98)", color: "#a1122d" },
};

const statusStyles: Record<string, CSSProperties> = {
  open: { background: "rgba(255, 245, 229, 0.96)", color: "#8a5a00" },
  investigating: { background: "rgba(231, 239, 255, 0.96)", color: "#284f9b" },
  resolved: { background: "rgba(236, 248, 238, 0.95)", color: "#2e6f45" },
  closed: { background: "rgba(240, 243, 247, 0.98)", color: "#46576b" },
};
