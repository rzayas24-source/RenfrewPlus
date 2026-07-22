import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { styles as adminStyles } from "./adminscreen";
import { getOtherDaySpreadsheet, type OtherDaySpreadsheetResponse, type OtherDayRow } from "../api/otherday_api";

type OtherDayMetric = {
  label: string;
  value: string;
  detail: string;
};

function formatAmount(value: string) {
  if (!value) return "";
  const parsed = Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(parsed)) return value;
  return parsed.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function OtherDayScreen() {
  const navigate = useNavigate();
  const [data, setData] = useState<OtherDaySpreadsheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayCollapsed, setTodayCollapsed] = useState(false);
  const [missingCollapsed, setMissingCollapsed] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await getOtherDaySpreadsheet();
        if (!active) return;
        setData(response.data);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load other-day spreadsheet");
        setData(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const metrics: OtherDayMetric[] = [
    {
      label: "Posting Day",
      value: data?.currentWorkDay || "Not set",
      detail: "Current work day pulled from work_state.",
    },
    {
      label: "Bank Day",
      value: data?.bankDay || "No mapping",
      detail: "The bank day mapped from the current posting day.",
    },
    {
      label: "Today Rows",
      value: String(data?.rowCount ?? 0),
      detail: "Rows for the mapped bank day.",
    },
    {
      label: "Missing Rows",
      value: String(data?.missingCount ?? 0),
      detail: "Rows from filenames where the total count does not match today's count.",
    },
  ];

  const todayRows = useMemo(() => data?.rows ?? [], [data]);
  const missingRows = useMemo(() => data?.missingRows ?? [], [data]);

  const todayFilenamesWithMissing = data?.filenamesWithMissing ?? 0;

  return (
    <main style={adminStyles.shell}>
      <div style={adminStyles.glowBlue} />
      <div style={adminStyles.glowPink} />

      <aside style={adminStyles.sidebar}>
        <div style={adminStyles.brandWrap}>
          <div style={adminStyles.brandMark} aria-hidden="true">
            <img src="/favicon.svg" alt="" style={adminStyles.brandMarkImage} />
          </div>
          <div style={adminStyles.brandWomenMark} aria-hidden="true">
            <img src="/renfrew-gazebo.png" alt="" style={adminStyles.brandWomenImage} />
          </div>
        </div>

        <p style={adminStyles.sidebarCopy}>
          A soft workspace for other-day check review and count comparison.
        </p>

        <nav style={adminStyles.navStack} aria-label="Other day navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/tools")}>
            <span style={adminStyles.navButtonLabel}>Back</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Current Work Day</div>
          <div style={adminStyles.sidebarCardValue}>{data?.currentWorkDay || "Loading..."}</div>
          <div style={adminStyles.sidebarCardMeta}>Mapped bank day: {data?.bankDay || "Loading..."}</div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Other Day Check</div>
            <p style={adminStyles.subtitle}>
              Spreadsheet view of the current bank day, filename counts, and any filenames with missing rows.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.primaryButton} type="button" onClick={() => navigate("/tools")}>
                Back to Tools
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/banking")}>
                Open Banking
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Other day window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Counts by filename</div>
              <div style={adminStyles.heroStatusText}>
                This view mirrors the utility script by comparing total filename occurrences against the current bank day.
              </div>
            </div>
          </div>
        </section>

        <section style={adminStyles.statsGrid}>
          {metrics.map((metric) => (
            <article key={metric.label} style={adminStyles.statCard}>
              <div style={adminStyles.statLabel}>{metric.label}</div>
              <div style={adminStyles.statValue}>{metric.value}</div>
              <div style={adminStyles.statDetail}>{metric.detail}</div>
            </article>
          ))}
        </section>

        <section style={otherDayStyles.tableSection}>
          <div style={otherDayStyles.tableHeader}>
            <button type="button" style={otherDayStyles.sectionHeaderButton} onClick={() => setTodayCollapsed((current) => !current)}>
              <div style={otherDayStyles.sectionHeaderCopy}>
                <div style={adminStyles.sectionKicker}>Today Rows</div>
                <h2 style={{ ...adminStyles.sectionTitle, ...otherDayStyles.singleLineTitle }}>
                  Current bank day rows from EDI
                </h2>
              </div>
              <div style={otherDayStyles.collapseChip}>{todayCollapsed ? "Expand" : "Collapse"}</div>
            </button>
            <div style={otherDayStyles.sectionMetaWrap}>
              <div style={adminStyles.sectionMeta}>
                {loading
                  ? "Loading EDI rows..."
                  : data?.bankDay
                    ? `Showing ${data.rowCount} rows for bank day ${data.bankDay}.`
                    : "No bank day mapping found."}
              </div>
              <div style={otherDayStyles.subtotalStrip}>
                <div style={otherDayStyles.subtotalItem}>
                  <span style={otherDayStyles.subtotalLabel}>Rows</span>
                  <span style={otherDayStyles.subtotalValue}>{data?.rowCount ?? 0}</span>
                </div>
                <div style={otherDayStyles.subtotalItem}>
                  <span style={otherDayStyles.subtotalLabel}>Files</span>
                  <span style={otherDayStyles.subtotalValue}>{todayFilenamesWithMissing}</span>
                </div>
              </div>
            </div>
          </div>

          {error && <div style={otherDayStyles.errorBanner}>{error}</div>}

          {!error && !todayCollapsed && todayRows.length === 0 && !loading && (
            <div style={otherDayStyles.emptyState}>
              No rows were found for the current bank day.
            </div>
          )}

          {!todayCollapsed && todayRows.length > 0 && (
            <div style={otherDayStyles.tableWrap}>
              <table style={otherDayStyles.table}>
                <thead>
                  <tr>
                    <th style={otherDayStyles.th}>Filename</th>
                    <th style={otherDayStyles.th}>Check #</th>
                    <th style={otherDayStyles.th}>EDI Amt</th>
                    <th style={otherDayStyles.th}>Bank Date</th>
                    <th style={otherDayStyles.thCenter}>A / B</th>
                  </tr>
                </thead>
                <tbody>
                  {todayRows.map((row: OtherDayRow) => (
                    <tr key={`${row.filename}-${row.checkNumber}-${row.bankDay}`}>
                      <td style={otherDayStyles.td}>{row.filename}</td>
                      <td style={otherDayStyles.td}>{row.checkNumber}</td>
                      <td style={otherDayStyles.td}>{formatAmount(row.ediAmount)}</td>
                      <td style={otherDayStyles.td}>{row.bankDay}</td>
                      <td style={otherDayStyles.tdCenter}>{row.counts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={otherDayStyles.tableSection}>
          <div style={otherDayStyles.tableHeader}>
            <button type="button" style={otherDayStyles.sectionHeaderButton} onClick={() => setMissingCollapsed((current) => !current)}>
              <div style={otherDayStyles.sectionHeaderCopy}>
                <div style={adminStyles.sectionKicker}>Missing Items</div>
                <h2 style={{ ...adminStyles.sectionTitle, ...otherDayStyles.singleLineTitle }}>
                  Filenames where total count is greater than today&apos;s count
                </h2>
              </div>
              <div style={otherDayStyles.collapseChip}>{missingCollapsed ? "Expand" : "Collapse"}</div>
            </button>
            <div style={otherDayStyles.sectionMetaWrap}>
              <div style={adminStyles.sectionMeta}>
                {loading
                  ? "Loading missing item rows..."
                  : missingRows.length > 0
                    ? `${missingRows.length} rows found across ${data?.filenamesWithMissing ?? 0} filenames.`
                    : "No missing items found for the current bank day."}
              </div>
              <div style={otherDayStyles.subtotalStrip}>
                <div style={otherDayStyles.subtotalItem}>
                  <span style={otherDayStyles.subtotalLabel}>Rows</span>
                  <span style={otherDayStyles.subtotalValue}>{missingRows.length}</span>
                </div>
                <div style={otherDayStyles.subtotalItem}>
                  <span style={otherDayStyles.subtotalLabel}>Files</span>
                  <span style={otherDayStyles.subtotalValue}>{data?.filenamesWithMissing ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          {!error && !missingCollapsed && missingRows.length === 0 && !loading && (
            <div style={otherDayStyles.emptyState}>
              No missing item filenames were found.
            </div>
          )}

          {!missingCollapsed && missingRows.length > 0 && (
            <div style={otherDayStyles.tableWrap}>
              <table style={otherDayStyles.table}>
                <thead>
                  <tr>
                    <th style={otherDayStyles.th}>Filename</th>
                    <th style={otherDayStyles.th}>Check #</th>
                    <th style={otherDayStyles.th}>EDI Amt</th>
                    <th style={otherDayStyles.th}>Bank Date</th>
                    <th style={otherDayStyles.thCenter}>A / B</th>
                  </tr>
                </thead>
                <tbody>
                  {missingRows.map((row: OtherDayRow) => (
                    <tr key={`${row.filename}-${row.checkNumber}-${row.bankDay}-${row.matchstatus}`}>
                      <td style={otherDayStyles.td}>{row.filename}</td>
                      <td style={otherDayStyles.td}>{row.checkNumber}</td>
                      <td style={otherDayStyles.td}>{formatAmount(row.ediAmount)}</td>
                      <td style={otherDayStyles.td}>{row.bankDay}</td>
                      <td style={otherDayStyles.tdCenter}>{row.counts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

const otherDayStyles: Record<string, CSSProperties> = {
  tableSection: {
    display: "grid",
    gap: "16px",
    marginTop: "18px",
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  sectionHeaderButton: {
    appearance: "none",
    border: "0",
    background: "transparent",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "14px",
    flex: "1 1 420px",
    minWidth: 0,
    textAlign: "left",
  },
  sectionHeaderCopy: {
    minWidth: 0,
    display: "grid",
    gap: "2px",
  },
  singleLineTitle: {
    whiteSpace: "nowrap",
    fontSize: "18px",
    lineHeight: 1.1,
  },
  sectionMetaWrap: {
    display: "grid",
    gap: "10px",
    justifyItems: "end",
    flex: "1 1 320px",
  },
  collapseChip: {
    flexShrink: 0,
    minHeight: "32px",
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid rgba(171, 186, 207, 0.42)",
    background: "rgba(255,255,255,0.9)",
    color: "#385065",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.04em",
    display: "inline-flex",
    alignItems: "center",
  },
  subtotalStrip: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    justifyContent: "flex-end",
  },
  subtotalItem: {
    minWidth: "120px",
    borderRadius: "16px",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    background: "rgba(255,255,255,0.8)",
    padding: "10px 12px",
    display: "grid",
    gap: "2px",
  },
  subtotalLabel: {
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#6a7f95",
  },
  subtotalValue: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#17324f",
  },
  errorBanner: {
    borderRadius: "18px",
    border: "1px solid rgba(186, 92, 92, 0.2)",
    background: "rgba(255, 241, 241, 0.94)",
    color: "#8d2f2f",
    padding: "14px 16px",
    fontWeight: 700,
  },
  emptyState: {
    borderRadius: "22px",
    border: "1px dashed rgba(171, 186, 207, 0.55)",
    background: "rgba(255,255,255,0.72)",
    color: "#597085",
    padding: "18px 20px",
    fontWeight: 700,
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.84)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    minWidth: "840px",
  },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#597085",
    borderBottom: "1px solid rgba(140, 160, 184, 0.12)",
    background: "rgba(245, 248, 252, 0.9)",
  },
  thCenter: {
    textAlign: "center",
    padding: "14px 16px",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#597085",
    borderBottom: "1px solid rgba(140, 160, 184, 0.12)",
    background: "rgba(245, 248, 252, 0.9)",
  },
  td: {
    padding: "14px 16px",
    fontSize: "14px",
    color: "#17324f",
    borderBottom: "1px solid rgba(140, 160, 184, 0.08)",
  },
  tdCenter: {
    padding: "14px 16px",
    fontSize: "14px",
    color: "#17324f",
    borderBottom: "1px solid rgba(140, 160, 184, 0.08)",
    textAlign: "center",
    fontWeight: 800,
  },
};

