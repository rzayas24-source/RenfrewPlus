import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { restoreAttachmentToPending } from "../api/attachmentreview_api";
import { getSiteReviewHistory, type ReviewHistoryRow, type ReviewHistoryView } from "../api/siteReviewHistory_api";
import { useAppConfig } from "../config/appConfig";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from "./adminscreen";

type SiteReviewScreenProps = {
  initialView?: ReviewHistoryView;
};

type ReviewViewOption = {
  id: ReviewHistoryView;
  label: string;
  detail: string;
};

const DEFAULT_VIEW_OPTIONS: ReviewViewOption[] = [
  { id: "approved", label: "Approved", detail: "Rows that were approved and sent forward." },
  { id: "rejected", label: "Rejected", detail: "Rows that were rejected with notes." },
  { id: "complete", label: "Complete", detail: "The full batch history in the order it came together." },
];

export default function SiteReviewScreen({ initialView = "complete" }: SiteReviewScreenProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appConfig = useAppConfig();
  const [rows, setRows] = useState<ReviewHistoryRow[]>([]);
  const [expandedBatchKeys, setExpandedBatchKeys] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const reviewUi = appConfig?.ui?.siteReview;
  const viewOptions = useMemo(
    () =>
      DEFAULT_VIEW_OPTIONS.map((option) => {
        const override = reviewUi?.views?.[option.id];
        return {
          ...option,
          label: override?.label ?? option.label,
          detail: override?.detail ?? option.detail,
        };
      }),
    [reviewUi]
  );

  const activeView = normalizeView(searchParams.get("view"), initialView);
  const activeOption = viewOptions.find((option) => option.id === activeView) ?? viewOptions[2];

  const loadRows = async () => {
    setLoading(true);
    try {
      const data = await getSiteReviewHistory(activeView);
      setRows(activeView === "complete" ? data.filter(hasBatchId) : data);
      setError(null);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Failed to load site review history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [activeView]);

  const approvedCount = useMemo(() => rows.filter((row) => row.status === "Approved").length, [rows]);
  const rejectedCount = useMemo(() => rows.filter((row) => row.status === "Rejected").length, [rows]);
  const pendingCount = useMemo(() => rows.filter((row) => row.status === "Pending").length, [rows]);

  const visibleRows = useMemo(() => {
    if (activeView === "approved") {
      return rows.filter((row) => row.status === "Approved");
    }

    if (activeView === "rejected") {
      return rows.filter((row) => row.status === "Rejected");
    }

    return rows;
  }, [activeView, rows]);

  const batchGroups = useMemo(() => groupRowsByBatch(rows), [rows]);
  const visibleBatchGroups = useMemo(() => groupRowsByBatch(visibleRows), [visibleRows]);
  const uniqueVisibleBatches = visibleBatchGroups.length;
  const isBatchExpanded = (key: string) => expandedBatchKeys.has(key);
  const toggleBatchExpanded = (key: string) => {
    setExpandedBatchKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const sidebarMeta =
    activeView === "complete"
      ? `${rows.length} total record${rows.length === 1 ? "" : "s"} across ${batchGroups.length} batch group${
          batchGroups.length === 1 ? "" : "s"
        }.`
      : `${visibleRows.length} matching record${visibleRows.length === 1 ? "" : "s"} across ${uniqueVisibleBatches} batch group${
          uniqueVisibleBatches === 1 ? "" : "s"
        }.`;

  const heroSubtitle =
    reviewUi?.heroSubtitle?.[activeView] ??
    (activeView === "complete"
      ? "Review the full batch history from first arrival to final outcome, all in one place."
      : activeView === "approved"
        ? "Review only the approved records while keeping the same shell and layout."
        : "Review only the rejected records while keeping the same shell and layout.");

  const heroStatusTitle =
    reviewUi?.heroStatusTitle?.[activeView] ??
    (activeView === "complete"
      ? `${rows.length} records in history`
      : `${visibleRows.length} ${activeOption.label.toLowerCase()} record${visibleRows.length === 1 ? "" : "s"}`);

  const heroStatusText =
    reviewUi?.heroStatusText?.[activeView] ??
    (activeView === "complete"
      ? `The timeline below groups records by batch number so you can see how each file moved through the workflow, including ${pendingCount} row${
          pendingCount === 1 ? "" : "s"
        } still queued for review.`
      : `The table below shows only ${activeOption.label.toLowerCase()} records, using the same structure as the other views.`);

  const openView = (view: ReviewHistoryView) => {
    navigate(`/site-review?view=${view}`);
  };

  const openEmailDownloader = () => {
    navigate("/email-downloader");
  };

  const openSnapshotGenerator = () => {
    navigate("/snapshot-generator");
  };

  const openPendingAttachment = (row: ReviewHistoryRow) => {
    const params = new URLSearchParams({ attachmentId: String(row.id) });
    if (row.batchDate) {
      params.set("day", row.batchDate);
    }
    navigate(`/attachments?${params.toString()}`);
  };

  const restorePending = async (row: ReviewHistoryRow) => {
    setRestoringId(row.id);
    setError(null);

    try {
      await restoreAttachmentToPending(row.id);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore attachment to pending");
    } finally {
      setRestoringId(null);
    }
  };

  if (loading) {
    return (
      <AdminShell
        sidebarCopy={reviewUi?.sidebarCopy ?? "A unified history workspace for approved, rejected, and complete batch views."}
        onBack={() => navigate("/cash")}
        hideBackButton
        ribbonTitle={reviewUi?.heroKicker ?? "Site Review History"}
        hiddenNavItemIds={["/email-downloader", "/snapshot-generator"]}
      >
        <div style={screenStyles.loadingState}>Loading site review history...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      sidebarCopy={reviewUi?.sidebarCopy ?? "A unified history workspace for approved, rejected, and complete batch views."}
      onBack={() => navigate("/cash")}
      hideBackButton
      ribbonTitle={reviewUi?.heroKicker ?? "Site Review History"}
      hiddenNavItemIds={["/email-downloader", "/snapshot-generator"]}
      sidebarCardLabel="Active view"
      sidebarCardValue={activeOption.label}
      sidebarCardMeta={sidebarMeta}
    >
      <section style={adminStyles.content}>
        <section style={screenStyles.heroBar}>
          <div style={screenStyles.viewTabs} role="group" aria-label="Site review views">
            {viewOptions.map((option) => {
              const active = option.id === activeView;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => openView(option.id)}
                  style={{
                    ...screenStyles.viewTab,
                    ...(active ? (option.id === "complete" ? screenStyles.viewTabCompleteActive : screenStyles.viewTabActive) : null),
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div style={screenStyles.heroBarCopy}>
            <div style={adminStyles.kicker}>Site review history</div>
            <div style={screenStyles.heroBarTitle}>{activeOption.label}</div>
          </div>

          <div style={screenStyles.heroBarActions}>
            <button type="button" style={screenStyles.heroBarButton} onClick={openEmailDownloader}>
              Email Downloader
            </button>
            <button type="button" style={screenStyles.heroBarButton} onClick={openSnapshotGenerator}>
              Snapshot Generator
            </button>
          </div>
        </section>

        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Site review</div>
            <p style={adminStyles.subtitle}>{heroSubtitle}</p>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>
                  {activeView === "complete" ? "Complete history" : `${activeOption.label} history`}
                </span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>{heroStatusTitle}</div>
              <div style={adminStyles.heroStatusText}>{heroStatusText}</div>
            </div>
          </div>
        </section>

        <section style={adminStyles.statsGrid}>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Visible</div>
            <div style={adminStyles.statValue}>{visibleRows.length}</div>
            <div style={adminStyles.statDetail}>Records matching the active view.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Approved</div>
            <div style={adminStyles.statValue}>{approvedCount}</div>
            <div style={adminStyles.statDetail}>Rows that made it through review.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Rejected</div>
            <div style={adminStyles.statValue}>{rejectedCount}</div>
            <div style={adminStyles.statDetail}>Rows that were stopped with notes.</div>
          </article>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Batch history</div>
              <h2 style={adminStyles.sectionTitle}>
                {activeView === "complete" ? "See the full batch timeline" : `See only ${activeOption.label.toLowerCase()} rows`}
              </h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              {activeView === "complete"
                ? "Rows stay grouped by batch so you can trace the full path of each file."
                : "The same layout stays in place while the rows are filtered by status."}
            </div>
          </div>

          {error && <div style={screenStyles.errorBanner}>{error}</div>}

          {!error && visibleRows.length === 0 && (
            <div style={screenStyles.emptyState}>No {activeOption.label.toLowerCase()} records were found.</div>
          )}

          {!error && activeView !== "complete" && visibleRows.length > 0 && (
            <div style={screenStyles.tableWrap}>
              <table style={screenStyles.table}>
                <thead>
                  <tr>
                    <th style={screenStyles.th}>Import ID</th>
                    <th style={screenStyles.th}>Batch</th>
                    <th style={screenStyles.th}>Filename</th>
                    <th style={screenStyles.th}>Site</th>
                    <th style={screenStyles.th}>Detail / Note</th>
                    <th style={screenStyles.th}>Amount</th>
                    <th style={screenStyles.th}>Processed</th>
                    <th style={screenStyles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      <td style={screenStyles.td}>{row.id}</td>
                      <td style={screenStyles.td}>{getBatchLabel(row)}</td>
                      <td style={screenStyles.td}>{row.filename}</td>
                      <td style={screenStyles.td}>{row.site || "-"}</td>
                      <td style={screenStyles.td}>{getDetailText(row)}</td>
                      <td style={screenStyles.td}>{formatCurrency(row.total)}</td>
                      <td style={screenStyles.td}>{formatDate(row.processedAt)}</td>
                      <td style={screenStyles.td}>
                        <button
                          type="button"
                          onClick={() => openPendingAttachment(row)}
                          style={screenStyles.openButton}
                        >
                          Open Attachments
                        </button>
                        <button
                          type="button"
                          onClick={() => restorePending(row)}
                          style={screenStyles.restoreButton}
                          disabled={restoringId === row.id}
                        >
                          {restoringId === row.id ? "Restoring..." : "Restore to Pending"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!error && activeView === "complete" && batchGroups.length > 0 && (
            <div style={screenStyles.batchStack}>
              {batchGroups.map((group) => (
                <article key={group.key} style={screenStyles.batchCard}>
                  <div style={screenStyles.batchHeader}>
                    <div>
                      <div style={screenStyles.batchKicker}>Batch {group.label}</div>
                      <div style={screenStyles.batchTitle}>
                        {group.rows.length} record{group.rows.length === 1 ? "" : "s"}
                      </div>
                      <div style={screenStyles.batchMeta}>{summarizeGroup(group.rows)}</div>
                    </div>
                    <div style={screenStyles.batchHeaderActions}>
                      <div style={screenStyles.batchPills}>
                        <span style={screenStyles.batchPill}>{countStatus(group.rows, "Approved")} approved</span>
                        <span style={screenStyles.batchPill}>{countStatus(group.rows, "Rejected")} rejected</span>
                        <span style={screenStyles.batchPill}>{countStatus(group.rows, "Pending")} to review</span>
                      </div>
                      <button
                        type="button"
                        aria-expanded={isBatchExpanded(group.key)}
                        onClick={() => toggleBatchExpanded(group.key)}
                        style={screenStyles.batchToggle}
                      >
                        {isBatchExpanded(group.key) ? "Collapse" : "Expand"}
                      </button>
                    </div>
                  </div>

                  {isBatchExpanded(group.key) && (
                    <div style={screenStyles.batchRows}>
                      {group.rows.map((row) => (
                        <div key={row.id} style={screenStyles.batchRow}>
                          <div style={screenStyles.batchRowTop}>
                            <div style={screenStyles.batchRowTitle}>{row.filename}</div>
                            <span style={{ ...screenStyles.statusChip, ...statusChipStyle(row.status) }}>
                              {formatStatusLabel(row.status)}
                            </span>
                          </div>
                          <div style={screenStyles.batchRowMeta}>
                            {row.site || "No site"} - {getDetailText(row)} - {formatDate(row.processedAt)}
                          </div>
                          <div style={screenStyles.batchRowActions}>
                            <button type="button" onClick={() => openPendingAttachment(row)} style={screenStyles.openButton}>
                              Open Attachments
                            </button>
                            <button
                              type="button"
                              onClick={() => restorePending(row)}
                              style={screenStyles.restoreButton}
                              disabled={restoringId === row.id}
                            >
                              {restoringId === row.id ? "Restoring..." : "Restore to Pending"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </AdminShell>
  );
}

function normalizeView(value: string | null, fallback: ReviewHistoryView): ReviewHistoryView {
  const lowered = (value || "").toLowerCase();
  if (lowered === "approved" || lowered === "rejected" || lowered === "complete") {
    return lowered;
  }

  return fallback;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown date";
  }

  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(value: number) {
  return Number(value || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function getBatchKey(row: ReviewHistoryRow) {
  return row.batchId?.trim() || row.batchDate?.trim() || `row:${row.id}`;
}

function getBatchLabel(row: ReviewHistoryRow) {
  if (row.batchId) {
    return row.batchId;
  }

  if (row.batchDate) {
    return formatDate(row.batchDate);
  }

  if (row.batchId) {
    return row.batchId;
  }

  return "Unbatched";
}

function getDetailText(row: ReviewHistoryRow) {
  if (row.status === "Approved") {
    return row.detail || "Approved";
  }

  if (row.status === "Rejected") {
    return row.reason || "Rejected";
  }

  return row.detail || row.reason || "To review";
}

function countStatus(rows: ReviewHistoryRow[], status: string) {
  return rows.filter((row) => row.status === status).length;
}

function summarizeGroup(rows: ReviewHistoryRow[]) {
  const approved = countStatus(rows, "Approved");
  const rejected = countStatus(rows, "Rejected");
  const pending = countStatus(rows, "Pending");

  return `${approved} approved, ${rejected} rejected, ${pending} to review`;
}

function formatStatusLabel(status: string) {
  if (status === "Pending") {
    return "To review";
  }

  return status;
}

function groupRowsByBatch(rows: ReviewHistoryRow[]) {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      rows: ReviewHistoryRow[];
    }
  >();

  for (const row of rows) {
    const key = getBatchKey(row);
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
      continue;
    }

    groups.set(key, {
      key,
      label: getBatchLabel(row),
      rows: [row],
    });
  }

  return Array.from(groups.values());
}

function hasBatchId(row: ReviewHistoryRow) {
  return Boolean(row.batchId?.trim());
}

function statusChipStyle(status: string): CSSProperties {
  if (status === "Approved") {
    return {
      background: "rgba(220, 244, 228, 0.95)",
      color: "#1f6b3a",
      border: "1px solid rgba(119, 190, 143, 0.40)",
    };
  }

  if (status === "Rejected") {
    return {
      background: "rgba(255, 231, 232, 0.95)",
      color: "#9d2d3e",
      border: "1px solid rgba(219, 148, 160, 0.42)",
    };
  }

  return {
    background: "rgba(255, 244, 214, 0.95)",
    color: "#8a5b00",
    border: "1px solid rgba(232, 194, 110, 0.42)",
  };
}

const screenStyles: Record<string, CSSProperties> = {
  loadingState: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    color: "#5f6b7a",
    fontSize: "18px",
  },
  viewTabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  heroBar: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 18px 36px rgba(52, 84, 120, 0.08)",
    position: "fixed",
    top: "18px",
    left: "282px",
    right: "16px",
    zIndex: 4,
  },
  heroBarCopy: {
    display: "grid",
    gap: "6px",
    minWidth: "220px",
    flex: "1 1 260px",
  },
  heroBarActions: {
    display: "flex",
    gap: "10px",
    marginLeft: "auto",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  heroBarButton: {
    height: "42px",
    padding: "0 14px",
    borderRadius: "999px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(243,248,255,0.94) 100%)",
    color: "#17324f",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 22px rgba(52, 84, 120, 0.08)",
  },
  heroBarTitle: {
    fontSize: "18px",
    lineHeight: 1.25,
    fontWeight: 900,
    color: "#17324f",
  },
  heroBarSubtitle: {
    fontSize: "13px",
    lineHeight: 1.35,
    color: "#5c7087",
    fontWeight: 700,
  },
  viewTab: {
    minWidth: "136px",
    height: "44px",
    padding: "0 18px",
    borderRadius: "14px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    background: "rgba(255,255,255,0.9)",
    color: "#35506d",
    textAlign: "center",
    cursor: "pointer",
    fontWeight: 800,
    boxShadow: "0 14px 24px rgba(119, 151, 198, 0.08)",
  },
  viewTabActive: {
    background: "linear-gradient(135deg, #dbeeff 0%, #c6ddfb 100%)",
    border: "1px solid rgba(106, 137, 180, 0.24)",
    color: "#15304f",
    boxShadow: "0 14px 24px rgba(119, 151, 198, 0.16)",
  },
  viewTabCompleteActive: {
    background: "rgba(255,255,255,0.98)",
    border: "1px solid rgba(140, 160, 184, 0.55)",
    color: "#17324f",
    boxShadow: "0 14px 24px rgba(119, 151, 198, 0.08)",
  },
  errorBanner: {
    marginBottom: "14px",
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid #f0b4b4",
    background: "#fff5f5",
    color: "#a32121",
  },
  emptyState: {
    padding: "18px 16px",
    borderRadius: "16px",
    border: "1px dashed rgba(140, 160, 184, 0.30)",
    background: "rgba(255,255,255,0.8)",
    color: "#5f6b7a",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "940px",
    background: "rgba(255,255,255,0.84)",
    borderRadius: "18px",
    overflow: "hidden",
  },
  th: {
    textAlign: "left",
    padding: "12px 14px",
    fontSize: "13px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#617089",
    borderBottom: "1px solid rgba(165, 180, 200, 0.25)",
  },
  td: {
    padding: "14px",
    borderBottom: "1px solid rgba(214, 223, 233, 0.72)",
    color: "#20364f",
    fontSize: "14px",
    verticalAlign: "top",
  },
  openButton: {
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(245, 249, 253, 0.95)",
    color: "#1f364d",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(31, 54, 77, 0.06)",
  },
  restoreButton: {
    marginLeft: "8px",
    border: "1px solid rgba(196, 165, 112, 0.28)",
    background: "rgba(255, 248, 233, 0.98)",
    color: "#8a5a16",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(122, 92, 30, 0.06)",
  },
  batchStack: {
    display: "grid",
    gap: "14px",
  },
  batchCard: {
    padding: "18px",
    borderRadius: "22px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.88)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
  },
  batchHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "flex-start",
    marginBottom: "14px",
    flexWrap: "wrap",
  },
  batchHeaderActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  batchKicker: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#72859a",
    fontWeight: 800,
    marginBottom: "8px",
  },
  batchTitle: {
    fontSize: "20px",
    fontWeight: 800,
    color: "#17324f",
    marginBottom: "4px",
  },
  batchMeta: {
    color: "#64788f",
    fontSize: "14px",
  },
  batchPills: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    justifyContent: "flex-end",
  },
  batchPill: {
    padding: "7px 10px",
    borderRadius: "999px",
    border: "1px solid rgba(154, 172, 192, 0.22)",
    background: "rgba(245, 248, 252, 0.98)",
    color: "#4b6178",
    fontSize: "12px",
    fontWeight: 700,
  },
  batchRows: {
    display: "grid",
    gap: "10px",
  },
  batchRowActions: {
    display: "flex",
    justifyContent: "flex-end",
    paddingTop: "8px",
  },
  batchToggle: {
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(245, 249, 253, 0.95)",
    color: "#1f364d",
    borderRadius: "999px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(31, 54, 77, 0.06)",
  },
  batchRow: {
    padding: "14px 15px",
    borderRadius: "16px",
    border: "1px solid rgba(214, 223, 233, 0.72)",
    background: "rgba(250, 252, 255, 0.94)",
  },
  batchRowTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    marginBottom: "6px",
  },
  batchRowTitle: {
    fontSize: "15px",
    fontWeight: 800,
    color: "#20364f",
  },
  batchRowMeta: {
    color: "#627589",
    fontSize: "13px",
    lineHeight: 1.4,
  },
  statusChip: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "84px",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 800,
  },
};
