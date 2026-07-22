import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorklistBrandButton } from "../worklist/worklist";
import { getAdminTable, getAdminTables } from "../api/admin_tables_api";
import type { AdminTableDetail, AdminTableSummary } from "../api/admin_tables_api";

const ROW_LIMIT = 250;

export default function AdminTableScreen() {
  const navigate = useNavigate();
  const [tables, setTables] = useState<AdminTableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableDetail, setTableDetail] = useState<AdminTableDetail | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "rows" | "cols">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [previewSortField, setPreviewSortField] = useState<string>("rowid");
  const [previewSortDirection, setPreviewSortDirection] = useState<"asc" | "desc">("asc");
  const [previewPage, setPreviewPage] = useState(0);
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRequestIdRef = useRef(0);

  useEffect(() => {
    getAdminTables()
      .then((response) => {
        const nextTables = response.data;
        setTables(nextTables);
        setSelectedTable((current) => current ?? nextTables[0]?.name ?? null);
        setError(null);
      })
      .catch((err) => {
        setTables([]);
        setSelectedTable(null);
        setError(err instanceof Error ? err.message : "Failed to load tables");
      })
      .finally(() => setLoadingTables(false));
  }, []);

  useEffect(() => {
    if (!selectedTable) {
      setTableDetail(null);
      return;
    }

    setPreviewPage(0);
    setPreviewSortField("rowid");
    setPreviewSortDirection("asc");
    loadTableDetail(selectedTable, ROW_LIMIT, 0, "rowid", "asc");
  }, [selectedTable]);

  function loadTableDetail(
    tableName: string,
    limit: number,
    offset: number,
    sortField = previewSortField,
    sortDirection = previewSortDirection
  ) {
    const requestId = ++previewRequestIdRef.current;
    setLoadingDetail(true);
    getAdminTable(tableName, limit, offset, sortField, sortDirection)
      .then((response) => {
        if (requestId !== previewRequestIdRef.current) {
          return;
        }
        setTableDetail(response.data);
        setError(null);
      })
      .catch((err) => {
        if (requestId !== previewRequestIdRef.current) {
          return;
        }
        setTableDetail(null);
        setError(err instanceof Error ? err.message : "Failed to load table");
      })
      .finally(() => {
        if (requestId === previewRequestIdRef.current) {
          setLoadingDetail(false);
        }
      });
  }

  const filteredTables = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return tables;
    }

    return tables.filter((table) => {
      if (table.name.toLowerCase().includes(query)) {
        return true;
      }

      return table.columns.some((column) => column.name.toLowerCase().includes(query));
    });
  }, [search, tables]);

  const visibleTables = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    const sorted = [...filteredTables].sort((left, right) => {
      let comparison = 0;

      if (sortField === "rows") {
        comparison = left.rowCount - right.rowCount;
      } else if (sortField === "cols") {
        comparison = left.columnCount - right.columnCount;
      } else {
        comparison = left.name.localeCompare(right.name);
      }

      if (comparison === 0 && sortField !== "name") {
        comparison = left.name.localeCompare(right.name);
      }

      return comparison * direction;
    });

    return sorted;
  }, [filteredTables, sortDirection, sortField]);

  const selectedSummary = useMemo(
    () => tables.find((table) => table.name === selectedTable) ?? null,
    [selectedTable, tables]
  );

  const columnNames = tableDetail?.columns.map((column) => column.name) ?? [];
  const visibleRows = useMemo(() => {
    return tableDetail?.rows ?? [];
  }, [tableDetail]);

  const previewStart = tableDetail && tableDetail.rows.length > 0 ? previewPage * ROW_LIMIT + 1 : 0;
  const previewEnd = tableDetail ? previewPage * ROW_LIMIT + tableDetail.rows.length : 0;
  const hasPreviousPage = previewPage > 0;
  const hasNextPage = Boolean(tableDetail && tableDetail.rows.length === ROW_LIMIT && previewEnd < tableDetail.rowCount);

  const changePreviewPage = (nextPage: number) => {
    if (!selectedTable) {
      return;
    }

    const safePage = Math.max(0, nextPage);
    setPreviewPage(safePage);
    loadTableDetail(selectedTable, ROW_LIMIT, safePage * ROW_LIMIT, previewSortField, previewSortDirection);
  };

  const togglePreviewSort = (field: string) => {
    if (!selectedTable) {
      return;
    }

    const isActive = previewSortField === field;
    const nextDirection = isActive && previewSortDirection === "asc" ? "desc" : "asc";
    setPreviewSortField(field);
    setPreviewSortDirection(nextDirection);
    setPreviewPage(0);
    loadTableDetail(selectedTable, ROW_LIMIT, 0, field, nextDirection);
  };

  return (
    <main style={styles.shell}>
      <div style={styles.glowBlue} />
      <div style={styles.glowPink} />

      <aside style={styles.sidebar}>
        <div style={styles.brandWrap}>
          <WorklistBrandButton style={styles.brandMark} ariaLabel="Open work list from the branding button">
            <img src="/favicon.svg" alt="" style={styles.brandMarkImage} />
          </WorklistBrandButton>
          <div style={styles.brandWomenMark} aria-hidden="true">
            <img src="/renfrew-gazebo.png" alt="" style={styles.brandWomenImage} />
          </div>
        </div>

        <p style={styles.sidebarCopy}>
          Browse every database table, inspect columns, and preview live rows without leaving the admin shell.
        </p>

        <nav style={styles.navStack} aria-label="Admin table navigation">
          <button className="sidebar-nav-button" style={styles.navButton} type="button" onClick={() => navigate("/admin")}>
            <span style={styles.navButtonLabel}>Back</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={styles.sidebarCard}>
          <div style={styles.sidebarCardLabel}>Tables</div>
          <div style={styles.sidebarCardValue}>{tables.length}</div>
          <div style={styles.sidebarCardMeta}>
            {selectedSummary ? `${selectedSummary.rowCount} rows in ${selectedSummary.name}` : "Select a table to inspect it."}
          </div>
        </div>
      </aside>

      <section style={styles.content}>
        <section style={styles.heroShell}>
          <div style={styles.heroCopy}>
            <div style={styles.kicker}>Table viewer</div>
            <p style={styles.subtitle}>
              A read-only view of every SQLite table in the active workflow database.
            </p>

            <div style={styles.heroActions}>
              <button style={styles.primaryButton} type="button" onClick={() => navigate("/admin")}>
                Back to Admin
              </button>
              <button
                style={styles.secondaryButton}
                type="button"
                onClick={() =>
                  selectedTable &&
                  loadTableDetail(selectedTable, ROW_LIMIT, previewPage * ROW_LIMIT, previewSortField, previewSortDirection)
                }
                disabled={!selectedTable || loadingDetail}
              >
                Refresh 250
              </button>
            </div>
          </div>

          <div style={styles.heroArt}>
            <div style={styles.heroStatusCard}>
              <div style={styles.heroStatusTop}>
                <span style={styles.statusPill}>Read only</span>
                <span style={styles.statusDot} />
              </div>
              <div style={styles.heroStatusTitle}>Database browser</div>
              <div style={styles.heroStatusText}>
                Search by table or column name, then inspect rows directly from SQLite.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          <article style={styles.statCard}>
            <div style={styles.statLabel}>Tables</div>
            <div style={styles.statValue}>{tables.length}</div>
            <div style={styles.statDetail}>All visible user tables in the active database.</div>
          </article>
          <article style={styles.statCard}>
            <div style={styles.statLabel}>Selected</div>
            <div style={styles.statValue}>{selectedSummary?.name ?? "None"}</div>
            <div style={styles.statDetail}>{selectedSummary ? `${selectedSummary.columnCount} columns` : "Choose a table on the left."}</div>
          </article>
          <article style={styles.statCard}>
            <div style={styles.statLabel}>Preview</div>
            <div style={styles.statValue}>{tableDetail?.rowCount ?? 0}</div>
            <div style={styles.statDetail}>Rows returned from the preview endpoint.</div>
          </article>
        </section>

        <section style={styles.tableBrowser}>
          <div style={styles.tableListPane}>
            <div style={styles.panelHeader}>
              <div>
                <div style={styles.sectionKicker}>All tables</div>
                <h2 style={styles.sectionTitle}>Database tables</h2>
              </div>
              <div style={styles.sectionMeta}>
                {loadingTables ? "Loading..." : `${filteredTables.length} shown`}
              </div>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tables or columns"
              style={styles.searchInput}
            />

            <div style={styles.tableList}>
              <div style={styles.tableListHeader}>
                <button
                  type="button"
                  style={styles.tableListHeaderButton}
                  onClick={() => {
                    if (sortField === "name") {
                      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
                    } else {
                      setSortField("name");
                      setSortDirection("asc");
                    }
                  }}
                  >
                    <span>Table</span>
                    <span style={styles.tableListHeaderIcon}>
                    {sortField === "name" ? getSortLabel(sortDirection) : "Sort"}
                    </span>
                  </button>
                <button
                  type="button"
                  style={styles.tableListHeaderButton}
                  onClick={() => {
                    if (sortField === "rows") {
                      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
                    } else {
                      setSortField("rows");
                      setSortDirection("desc");
                    }
                  }}
                >
                  <span>Rows</span>
                  <span style={styles.tableListHeaderIcon}>
                    {sortField === "rows" ? getSortLabel(sortDirection) : "Sort"}
                  </span>
                </button>
                <button
                  type="button"
                  style={styles.tableListHeaderButton}
                  onClick={() => {
                    if (sortField === "cols") {
                      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
                    } else {
                      setSortField("cols");
                      setSortDirection("desc");
                    }
                  }}
                >
                  <span>Cols</span>
                  <span style={styles.tableListHeaderIcon}>
                    {sortField === "cols" ? getSortLabel(sortDirection) : "Sort"}
                  </span>
                </button>
              </div>

              {visibleTables.map((table) => {
                const active = table.name === selectedTable;
                return (
                  <button
                    key={table.name}
                    type="button"
                    onClick={() => setSelectedTable(table.name)}
                    style={{
                      ...styles.tableListItem,
                      ...(active ? styles.tableListItemActive : {}),
                    }}
                  >
                    <div style={styles.tableListName}>{table.name}</div>
                    <div style={styles.tableListMeta}>
                      {table.rowCount} rows {table.columnCount ? `• ${table.columnCount} cols` : ""}
                    </div>
                  </button>
                );
              })}

                {!visibleTables.length && !loadingTables && (
                  <div style={styles.emptyState}>No tables match that search.</div>
                )}
              </div>
            </div>

          <div style={styles.detailPane}>
            <div style={styles.panelHeader}>
              <div>
                <div style={styles.sectionKicker}>Preview</div>
                <h2 style={styles.sectionTitle}>{tableDetail?.name ?? "Select a table"}</h2>
              </div>
              <div style={styles.sectionMeta}>
                {loadingDetail
                  ? "Loading preview..."
                  : tableDetail
                    ? `${tableDetail.rowCount} rows total`
                    : "0 rows total"}
              </div>
            </div>

            {error && <div style={styles.errorText}>{error}</div>}

            {tableDetail && (
              <>
                <div style={styles.columnStrip}>
                  {columnNames.map((columnName) => (
                    <span key={columnName} style={styles.columnChip}>
                      {columnName}
                    </span>
                  ))}
                </div>

                <div style={styles.previewPager}>
                  <div style={styles.previewPagerMeta}>
                    {tableDetail.rows.length
                      ? `Showing rows ${previewStart} - ${previewEnd} of ${tableDetail.rowCount}`
                      : "No rows to show"}
                  </div>
                  <div style={styles.previewPagerButtons}>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() => changePreviewPage(previewPage - 1)}
                      disabled={!hasPreviousPage || loadingDetail}
                    >
                      Previous 250
                    </button>
                    <button
                      type="button"
                      style={styles.primaryButton}
                      onClick={() => changePreviewPage(previewPage + 1)}
                      disabled={!hasNextPage || loadingDetail}
                    >
                      Next 250
                    </button>
                  </div>
                </div>

                <div style={styles.tableWrap}>
                  <table style={styles.dataTable}>
                    <thead>
                      <tr>
                        <th style={styles.headerCell}>
                          <button
                            type="button"
                            style={styles.headerSortButton}
                            onClick={() => togglePreviewSort("rowid")}
                          >
                            <span>rowid</span>
                            <span style={styles.headerSortIcon}>
                              {previewSortField === "rowid" ? getSortLabel(previewSortDirection) : "Sort"}
                            </span>
                          </button>
                        </th>
                        {columnNames.map((columnName) => (
                          <th key={columnName} style={styles.headerCell}>
                            <button
                              type="button"
                              style={styles.headerSortButton}
                              onClick={() => togglePreviewSort(columnName)}
                            >
                              <span>{columnName}</span>
                              <span style={styles.headerSortIcon}>
                                {previewSortField === columnName ? getSortLabel(previewSortDirection) : "Sort"}
                              </span>
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row, index) => (
                        <tr key={`${tableDetail.name}-${index}`}>
                          <td style={styles.bodyCell}>{String(row.rowid ?? "")}</td>
                          {columnNames.map((columnName) => (
                            <td key={columnName} style={styles.bodyCell}>
                              {formatCell(row[columnName])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!visibleRows.length && <div style={styles.emptyState}>This table has no rows to preview.</div>}
              </>
            )}

            {!tableDetail && !error && !loadingDetail && (
              <div style={styles.emptyState}>Select a table on the left to preview rows.</div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function getSortLabel(direction: "asc" | "desc") {
  return direction === "asc" ? "Low \u2192 High" : "High \u2192 Low";
}

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: "100vh",
    padding: "18px",
    display: "grid",
    gridTemplateColumns: "250px minmax(0, 1fr)",
    gap: "18px",
    position: "relative",
    overflow: "hidden",
    color: "#16304d",
  },
  glowBlue: {
    position: "absolute",
    top: "-120px",
    left: "-120px",
    width: "360px",
    height: "360px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(146, 198, 255, 0.45) 0%, rgba(146, 198, 255, 0) 70%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  glowPink: {
    position: "absolute",
    right: "-100px",
    top: "110px",
    width: "320px",
    height: "320px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255, 186, 213, 0.42) 0%, rgba(255, 186, 213, 0) 72%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  sidebar: {
    position: "relative",
    zIndex: 1,
    padding: "18px 16px",
    borderRadius: "28px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.72)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.10)",
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    justifyContent: "flex-start",
    paddingBottom: "14px",
    marginBottom: "16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.18)",
  },
  brandMark: {
    width: "52px",
    height: "52px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.76)",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    boxShadow: "0 12px 22px rgba(95, 128, 172, 0.08)",
    overflow: "hidden",
    flexShrink: 0,
  },
  brandMarkImage: {
    width: "88%",
    height: "88%",
    objectFit: "contain",
    objectPosition: "center",
  },
  brandWomenMark: {
    width: "116px",
    height: "60px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.64)",
    border: "1px solid rgba(140, 160, 184, 0.10)",
    boxShadow: "0 10px 18px rgba(95, 128, 172, 0.06)",
    overflow: "hidden",
    padding: "4px",
    flexShrink: 0,
  },
  brandWomenImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "center",
  },
  sidebarCopy: {
    margin: "0 0 16px",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#516579",
  },
  navStack: {
    display: "grid",
    gap: "10px",
  },
  navButton: {
    height: "46px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    borderRadius: "16px",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(236,245,255,0.95) 54%, rgba(255,236,244,0.92) 100%)",
    color: "#16304d",
    textAlign: "left",
    padding: "0 14px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 12px 26px rgba(52, 84, 120, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    letterSpacing: "0.01em",
  },
  navButtonLabel: {
    fontSize: "14px",
    fontWeight: 800,
  },
  navButtonGlyph: {
    width: "22px",
    height: "22px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.76)",
    color: "#8aa5c6",
    fontSize: "12px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
  },
  sidebarCard: {
    marginTop: "18px",
    padding: "16px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, rgba(235, 245, 255, 0.95) 0%, rgba(255, 234, 243, 0.90) 100%)",
    border: "1px solid rgba(176, 194, 218, 0.22)",
  },
  sidebarCardLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
    marginBottom: "8px",
  },
  sidebarCardValue: {
    fontSize: "18px",
    fontWeight: 800,
    marginBottom: "8px",
  },
  sidebarCardMeta: {
    fontSize: "13px",
    lineHeight: 1.55,
    color: "#5d7187",
  },
  content: {
    position: "relative",
    zIndex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  heroShell: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, 0.9fr)",
    gap: "18px",
    alignItems: "stretch",
    padding: "24px",
    borderRadius: "32px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    background: "linear-gradient(135deg, rgba(255,255,255,0.90) 0%, rgba(248,250,253,0.88) 50%, rgba(255,244,248,0.92) 100%)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.08)",
  },
  heroCopy: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: 0,
  },
  kicker: {
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: "12px",
    fontWeight: 800,
    color: "#74879c",
    marginBottom: "10px",
  },
  subtitle: {
    margin: "8px 0 0",
    maxWidth: "760px",
    fontSize: "16px",
    lineHeight: 1.7,
    color: "#536579",
  },
  heroActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "20px",
  },
  primaryButton: {
    height: "44px",
    padding: "0 18px",
    borderRadius: "14px",
    border: "1px solid rgba(106, 137, 180, 0.24)",
    background: "linear-gradient(135deg, #dbeeff 0%, #c6ddfb 100%)",
    color: "#15304f",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 14px 24px rgba(119, 151, 198, 0.16)",
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
  heroArt: {
    display: "grid",
    gap: "14px",
    alignContent: "center",
  },
  heroStatusCard: {
    borderRadius: "24px",
    padding: "18px",
    background: "linear-gradient(135deg, rgba(243, 248, 255, 0.95) 0%, rgba(255, 239, 245, 0.92) 100%)",
    border: "1px solid rgba(175, 193, 218, 0.22)",
  },
  heroStatusTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    height: "30px",
    padding: "0 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(158, 176, 204, 0.22)",
    fontSize: "12px",
    fontWeight: 800,
    color: "#4a6179",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#8ec4ff",
    boxShadow: "0 0 0 6px rgba(142, 196, 255, 0.18)",
  },
  heroStatusTitle: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#16304d",
    marginBottom: "8px",
  },
  heroStatusText: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#5a6c80",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "16px",
  },
  statCard: {
    padding: "18px",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.84)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
  },
  statLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#72859a",
    marginBottom: "10px",
    fontWeight: 800,
  },
  statValue: {
    fontSize: "20px",
    fontWeight: 800,
    color: "#17324f",
    marginBottom: "8px",
  },
  statDetail: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#597085",
  },
  tableBrowser: {
    display: "grid",
    gridTemplateColumns: "340px minmax(0, 1fr)",
    gap: "16px",
    minHeight: 0,
    flex: 1,
  },
  tableListPane: {
    padding: "20px",
    borderRadius: "30px",
    background: "rgba(255,255,255,0.74)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 20px 42px rgba(52, 84, 120, 0.06)",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  detailPane: {
    padding: "20px",
    borderRadius: "30px",
    background: "rgba(255,255,255,0.74)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 20px 42px rgba(52, 84, 120, 0.06)",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    marginBottom: "14px",
  },
  sectionKicker: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#74879c",
    fontWeight: 800,
    marginBottom: "8px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "24px",
    color: "#17324f",
  },
  sectionMeta: {
    maxWidth: "300px",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#5e7186",
    textAlign: "right",
  },
  searchInput: {
    height: "42px",
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    background: "rgba(255,255,255,0.88)",
    padding: "0 14px",
    fontSize: "14px",
    color: "#17324f",
    outline: "none",
    marginBottom: "12px",
  },
  tableList: {
    display: "grid",
    gap: "10px",
    overflow: "auto",
    minHeight: 0,
  },
  tableListHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 72px 72px",
    gap: "8px",
    padding: "0 4px 2px",
  },
  tableListHeaderButton: {
    appearance: "none",
    border: "none",
    background: "transparent",
    padding: "0 4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    color: "#5a7087",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: "pointer",
  },
  tableListHeaderIcon: {
    fontSize: "11px",
    lineHeight: 1,
    color: "#7a8ea4",
  },
  tableListItem: {
    width: "100%",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(145deg, rgba(249, 252, 255, 0.98) 0%, rgba(243, 247, 252, 0.92) 100%)",
    padding: "14px",
    textAlign: "left",
    cursor: "pointer",
  },
  tableListItemActive: {
    borderColor: "rgba(130, 163, 211, 0.45)",
    boxShadow: "0 12px 24px rgba(126, 154, 190, 0.16)",
    background: "linear-gradient(145deg, rgba(231, 243, 255, 0.98) 0%, rgba(250, 252, 255, 0.96) 100%)",
  },
  tableListName: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#17324f",
    marginBottom: "4px",
  },
  tableListMeta: {
    fontSize: "13px",
    lineHeight: 1.4,
    color: "#5b6f84",
  },
  columnStrip: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  previewPager: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  previewPagerMeta: {
    fontSize: "13px",
    color: "#5e7186",
    fontWeight: 700,
  },
  previewPagerButtons: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  columnChip: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "28px",
    padding: "0 10px",
    borderRadius: "999px",
    background: "rgba(236, 244, 252, 0.95)",
    border: "1px solid rgba(169, 188, 210, 0.22)",
    color: "#4c6076",
    fontSize: "12px",
    fontWeight: 700,
  },
  tableWrap: {
    overflow: "auto",
    borderRadius: "22px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.92)",
    flex: 1,
    minHeight: 0,
  },
  dataTable: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "100%",
  },
  headerCell: {
    position: "sticky",
    top: 0,
    background: "#edf4fb",
    color: "#17324f",
    textAlign: "left",
    padding: "12px 10px",
    fontSize: "13px",
    fontWeight: 800,
    borderBottom: "1px solid rgba(140, 160, 184, 0.2)",
    whiteSpace: "nowrap",
  },
  headerSortButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "0",
    border: "none",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    cursor: "pointer",
    textAlign: "left",
  },
  headerSortIcon: {
    fontSize: "11px",
    color: "#6f8499",
    lineHeight: 1,
    flexShrink: 0,
  },
  bodyCell: {
    padding: "10px",
    fontSize: "13px",
    color: "#32485f",
    borderBottom: "1px solid rgba(228, 234, 242, 0.9)",
    verticalAlign: "top",
    whiteSpace: "nowrap",
  },
  emptyState: {
    padding: "16px",
    borderRadius: "18px",
    border: "1px dashed rgba(156, 174, 197, 0.35)",
    background: "rgba(248, 251, 255, 0.9)",
    color: "#5b6f84",
    fontSize: "14px",
  },
  errorText: {
    padding: "12px 14px",
    borderRadius: "16px",
    background: "rgba(255, 237, 237, 0.9)",
    color: "#8f1f1f",
    fontSize: "14px",
  },
};



