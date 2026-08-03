import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminTables } from "../api/admin_tables_api";
import type { AdminTableSummary } from "../api/admin_tables_api";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from "./adminscreen";

type Status = "Ready" | "Partial" | "Needed";

type SchemaMilestone = {
  title: string;
  detail: string;
  owner: "App team" | "IT";
  status: Status;
};

const schemaMilestones: SchemaMilestone[] = [
  {
    title: "Table inventory visible",
    detail: "The admin table API already exposes the live SQLite tables and their column metadata.",
    owner: "App team",
    status: "Ready",
  },
  {
    title: "Schema documentation in the app",
    detail: "This page turns the metadata into a human-readable schema overview for support and migration work.",
    owner: "App team",
    status: "Ready",
  },
  {
    title: "Foreign key map review",
    detail: "The database relationships still need a more formal relationship map for server planning.",
    owner: "App team",
    status: "Partial",
  },
  {
    title: "Migration target schema",
    detail: "A future server database should mirror the current logical schema before any cutover.",
    owner: "IT",
    status: "Needed",
  },
];

const schemaImpact = [
  {
    title: "Faster handoff",
    detail: "The schema page makes it easier to review what data structures exist before a server move or audit.",
  },
  {
    title: "Better change control",
    detail: "Having the schema visible in admin reduces guesswork when new tables or columns are introduced.",
  },
  {
    title: "Supports portability planning",
    detail: "Knowing the current schema is the first step toward recreating it on another host or database engine.",
  },
];

export default function SchemaScreen() {
  const navigate = useNavigate();
  const [tables, setTables] = useState<AdminTableSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getAdminTables()
      .then((response) => {
        if (!active) {
          return;
        }
        setTables(response.data);
        setError(null);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setTables([]);
        setError(err instanceof Error ? err.message : "Failed to load schema");
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
    const tableCount = tables.length;
    const columnCount = tables.reduce((sum, table) => sum + table.columnCount, 0);
    const largestTable = [...tables].sort((left, right) => right.columnCount - left.columnCount)[0] ?? null;

    return {
      tableCount,
      columnCount,
      largestTable,
    };
  }, [tables]);

  return (
    <AdminShell
      sidebarCopy="A schema view for the live SQLite structure the app is actually using."
      sidebarCardLabel="Schema"
      sidebarCardValue={`${totals.tableCount} tables`}
      sidebarCardMeta={`${totals.columnCount} columns across the active database.`}
      onBack={() => navigate("/admin")}
      hideBackButton
      useGlobalMenuFallback={false}
      ribbonTitle="Schema"
    >
      <section style={styles.page}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Schema explorer</div>
            <p style={adminStyles.subtitle}>
              A read-only map of the tables and columns currently exposed by the app's database metadata endpoint.
            </p>
            <div style={styles.heroActions}>
              <button type="button" style={adminStyles.primaryButton} onClick={() => navigate("/admin/tables")}>
                Open Tables
              </button>
              <button type="button" style={adminStyles.secondaryButton} onClick={() => navigate("/admin/dependencies")}>
                Open Dependencies
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Read only</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Live schema snapshot</div>
              <div style={adminStyles.heroStatusText}>
                This page shows the current table names, row counts, and column definitions that the backend reports.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          <article style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Tables</div>
            <div style={styles.summaryValue}>{totals.tableCount}</div>
            <div style={styles.summaryMeta}>Active tables visible from the database endpoint.</div>
          </article>
          <article style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Columns</div>
            <div style={styles.summaryValue}>{totals.columnCount}</div>
            <div style={styles.summaryMeta}>Total columns across the current schema.</div>
          </article>
          <article style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Largest table</div>
            <div style={styles.summaryValue}>{totals.largestTable?.name ?? "None"}</div>
            <div style={styles.summaryMeta}>
              {totals.largestTable ? `${totals.largestTable.columnCount} columns` : "No tables loaded yet."}
            </div>
          </article>
        </section>

        {error && <div style={styles.errorBanner}>{error}</div>}

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Current schema</div>
              <h2 style={adminStyles.sectionTitle}>Tables and columns</h2>
            </div>
            <div style={adminStyles.sectionMeta}>{loading ? "Loading..." : `${tables.length} tables`}</div>
          </div>

          <div style={styles.tableList}>
            {tables.map((table) => (
              <article key={table.name} style={styles.tableCard}>
                <div style={styles.tableCardHeader}>
                  <div>
                    <div style={styles.tableTitle}>{table.name}</div>
                    <div style={styles.tableMeta}>{table.rowCount} row(s)</div>
                  </div>
                  <span style={styles.tableBadge}>{table.columnCount} columns</span>
                </div>

                <div style={styles.columnGrid}>
                  {table.columns.map((column) => (
                    <div key={`${table.name}:${column.name}`} style={styles.columnChip}>
                      <div style={styles.columnName}>{column.name}</div>
                      <div style={styles.columnMeta}>
                        {column.type || "unknown"}
                        {column.primaryKey ? " - PK" : ""}
                        {column.notNull ? " - NOT NULL" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Milestones</div>
              <h2 style={adminStyles.sectionTitle}>Schema readiness checkpoints</h2>
            </div>
          </div>

          <div style={styles.milestoneList}>
            {schemaMilestones.map((item) => (
              <article key={item.title} style={styles.milestoneCard}>
                <div style={styles.milestoneTopRow}>
                  <div>
                    <div style={styles.milestoneTitle}>{item.title}</div>
                    <div style={styles.milestoneDetail}>{item.detail}</div>
                  </div>
                  <div style={styles.milestoneMetaWrap}>
                    <span style={styles.ownerPill}>{item.owner}</span>
                    <span style={{ ...styles.statusBadge, ...statusStyles[item.status] }}>{item.status}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Impact</div>
              <h2 style={adminStyles.sectionTitle}>Why add this screen</h2>
            </div>
          </div>
          <div style={styles.impactList}>
            {schemaImpact.map((item) => (
              <article key={item.title} style={styles.impactCard}>
                <div style={styles.impactTitle}>{item.title}</div>
                <div style={styles.impactDetail}>{item.detail}</div>
              </article>
            ))}
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
  heroActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginTop: "8px",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  summaryCard: {
    padding: "16px",
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
    display: "grid",
    gap: "6px",
  },
  summaryLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  summaryValue: {
    fontSize: "32px",
    lineHeight: 1,
    fontWeight: 900,
    color: "#17324f",
    wordBreak: "break-word",
  },
  summaryMeta: {
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#5e7186",
  },
  errorBanner: {
    padding: "14px 16px",
    borderRadius: "18px",
    background: "rgba(255, 237, 237, 0.94)",
    border: "1px solid rgba(224, 107, 107, 0.30)",
    color: "#a32121",
    fontWeight: 700,
  },
  card: {
    display: "grid",
    gap: "14px",
    padding: "18px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  tableList: {
    display: "grid",
    gap: "12px",
  },
  tableCard: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(145deg, rgba(251,252,254,1) 0%, rgba(241,246,252,0.96) 100%)",
    display: "grid",
    gap: "12px",
  },
  tableCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  tableTitle: {
    fontSize: "15px",
    fontWeight: 900,
    color: "#17324f",
  },
  tableMeta: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#536579",
    fontWeight: 600,
  },
  tableBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "92px",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    background: "rgba(224, 237, 250, 0.95)",
    color: "#35506d",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    whiteSpace: "nowrap",
  },
  columnGrid: {
    display: "grid",
    gap: "10px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  columnChip: {
    padding: "12px",
    borderRadius: "16px",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    background: "rgba(255,255,255,0.88)",
    display: "grid",
    gap: "4px",
  },
  columnName: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#17324f",
  },
  columnMeta: {
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#536579",
  },
  milestoneList: {
    display: "grid",
    gap: "12px",
  },
  milestoneCard: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(145deg, rgba(250,252,255,1) 0%, rgba(241,246,252,0.96) 100%)",
    display: "grid",
    gap: "10px",
  },
  milestoneTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
  },
  milestoneTitle: {
    fontSize: "14px",
    fontWeight: 900,
    color: "#17324f",
  },
  milestoneDetail: {
    marginTop: "4px",
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#536579",
  },
  milestoneMetaWrap: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  ownerPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "82px",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    background: "rgba(224, 237, 250, 0.95)",
    color: "#35506d",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    whiteSpace: "nowrap",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "92px",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  },
  impactList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  impactCard: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.9)",
    display: "grid",
    gap: "6px",
  },
  impactTitle: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#17324f",
  },
  impactDetail: {
    fontSize: "13px",
    lineHeight: 1.5,
    color: "#5d7187",
  },
};

const statusStyles: Record<Status, CSSProperties> = {
  Ready: {
    background: "rgba(224, 245, 230, 0.95)",
    color: "#24623e",
    borderColor: "rgba(59, 156, 99, 0.22)",
  },
  Partial: {
    background: "rgba(255, 245, 219, 0.95)",
    color: "#8a5b07",
    borderColor: "rgba(205, 153, 35, 0.22)",
  },
  Needed: {
    background: "rgba(255, 230, 230, 0.96)",
    color: "#a32121",
    borderColor: "rgba(179, 58, 58, 0.22)",
  },
};
