import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { styles as adminStyles } from "./adminscreen";
import { getDuplicateCheckSpreadsheet, type DuplicateCheckSpreadsheetResponse, type DuplicateCheckRow } from "../api/duplicatecheck_api";

type DuplicateMetric = {
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

export default function DuplicateCheckScreen() {
  const navigate = useNavigate();
  const [data, setData] = useState<DuplicateCheckSpreadsheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await getDuplicateCheckSpreadsheet();
        if (!active) return;
        setData(response.data);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load duplicate check data");
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

  const metrics: DuplicateMetric[] = [
    {
      label: "Posting Day",
      value: data?.currentWorkDay || "Not set",
      detail: "Current posting day from work_state.",
    },
    {
      label: "Bank Day",
      value: data?.bankDay || "No mapping",
      detail: "The bank day mapped from the current posting day.",
    },
    {
      label: "Duplicate Rows",
      value: String(data?.duplicateCount ?? 0),
      detail: "Rows whose filename appears more than once for the selected bank day.",
    },
    {
      label: "Duplicate Files",
      value: String(data?.duplicateFilenames ?? 0),
      detail: "Unique filenames with more than one matching row.",
    },
  ];

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const duplicateFilenameList = data?.duplicateFilenameList ?? [];

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
          A soft workspace for duplicate filename review and bank-day checks.
        </p>

        <nav style={adminStyles.navStack} aria-label="Duplicate check navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/tools")}>
            <span style={adminStyles.navButtonLabel}>Back</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Today</div>
          <div style={adminStyles.sidebarCardValue}>{data?.currentWorkDay || "Loading..."}</div>
          <div style={adminStyles.sidebarCardMeta}>
            Focused on duplicate filenames for the active bank day.
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Duplicate Check</div>
            <p style={adminStyles.subtitle}>
              Spreadsheet view of duplicate filenames for the current bank day.
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
                <span style={adminStyles.statusPill}>Duplicate window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Filename repetition check</div>
              <div style={adminStyles.heroStatusText}>
                This view mirrors the utility script by showing only filenames that appear more than once on the current bank day.
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

        <section style={duplicateStyles.tableSection}>
          <div style={duplicateStyles.tableHeader}>
            <button type="button" style={duplicateStyles.sectionHeaderButton} onClick={() => setCollapsed((current) => !current)}>
              <div style={duplicateStyles.sectionHeaderCopy}>
                <div style={adminStyles.sectionKicker}>Duplicate filenames</div>
                <h2 style={{ ...adminStyles.sectionTitle, ...duplicateStyles.singleLineTitle }}>
                  Duplicate filename rows for the selected bank day
                </h2>
              </div>
              <div style={duplicateStyles.collapseChip}>{collapsed ? "Expand" : "Collapse"}</div>
            </button>
            <div style={duplicateStyles.sectionMetaWrap}>
              <div style={adminStyles.sectionMeta}>
                {loading
                  ? "Loading duplicate filename data..."
                  : data?.bankDay
                    ? `${data.duplicateCount} duplicate row(s) across ${data.duplicateFilenames} filename(s).`
                    : "No bank day mapping found."}
              </div>
            <div style={duplicateStyles.subtotalStrip}>
              <div style={duplicateStyles.subtotalItem}>
                <span style={duplicateStyles.subtotalLabel}>Rows</span>
                <span style={duplicateStyles.subtotalValue}>{rows.length}</span>
              </div>
                <div style={duplicateStyles.subtotalItem}>
                  <span style={duplicateStyles.subtotalLabel}>Files</span>
                  <span style={duplicateStyles.subtotalValue}>{data?.duplicateFilenames ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          {!loading && duplicateFilenameList.length > 0 && (
            <div style={duplicateStyles.filenameListCard}>
              <div style={duplicateStyles.filenameListTitle}>Duplicate filenames found</div>
              <div style={duplicateStyles.filenameList}>
                {duplicateFilenameList.map((filename) => (
                  <div key={filename} style={duplicateStyles.filenamePill}>
                    {filename}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div style={duplicateStyles.errorBanner}>{error}</div>}

          {!error && !collapsed && rows.length === 0 && !loading && (
            <div style={duplicateStyles.emptyState}>
              No duplicate filenames were found for the current bank day.
            </div>
          )}

          {!collapsed && rows.length > 0 && (
            <div style={duplicateStyles.tableWrap}>
              <table style={duplicateStyles.table}>
                <thead>
                  <tr>
                    <th style={duplicateStyles.th}>Filename</th>
                    <th style={duplicateStyles.th}>EDI Check</th>
                    <th style={duplicateStyles.th}>Lockbox</th>
                    <th style={duplicateStyles.th}>EFT</th>
                    <th style={duplicateStyles.th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: DuplicateCheckRow) => (
                    <tr key={`${row.filename}-${row.ediCheck}-${row.date}`}>
                      <td style={duplicateStyles.td}>{row.filename}</td>
                      <td style={duplicateStyles.td}>{row.ediCheck}</td>
                      <td style={duplicateStyles.td}>{formatAmount(row.lockboxAmount)}</td>
                      <td style={duplicateStyles.td}>{formatAmount(row.eftAmount)}</td>
                      <td style={duplicateStyles.td}>{row.date}</td>
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

const duplicateStyles: Record<string, CSSProperties> = {
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
    minWidth: "860px",
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
  filenameListCard: {
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.84)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
    padding: "16px",
    display: "grid",
    gap: "10px",
  },
  filenameListTitle: {
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#597085",
  },
  filenameList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  filenamePill: {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(245, 249, 255, 0.95)",
    border: "1px solid rgba(171, 186, 207, 0.38)",
    color: "#17324f",
    fontSize: "12px",
    fontWeight: 700,
    wordBreak: "break-word",
  },
};

