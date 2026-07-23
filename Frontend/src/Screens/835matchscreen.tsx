import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { styles as adminStyles } from "./adminscreen";
import { WorklistBrandButton } from "../worklist/worklist";
import {
  commitSourceMatch,
  commitAllExactMatches,
  getSourceMatchDetail,
  getSourceMatchWorklist,
  type SourceMatchDetail,
  type SourceMatchWorklistRow,
  type SourceMatchWorklistSummary,
} from "../api/match_api";

type StatusTone = "blue" | "pink" | "mist" | "pearl" | "success" | "warning";

type StatusChip = {
  label: string;
  detail: string;
  tone: StatusTone;
};

type CommitState = StatusChip;

type WorklistSortKey = "edi" | "match" | "lockbox" | "eft" | "possible";
type WorklistSortDir = "asc" | "desc";

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const formatAmount = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return "";
  const raw = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(raw)) return String(value);
  return moneyFmt.format(raw);
};

const formatDate = (value: string | null | undefined) => value ?? "";

const isMatchedStatus = (value: string | null | undefined) => !!value && value.trim().toUpperCase().startsWith("MATCHED");

const formatMatchStatus = (value: string | null | undefined) => {
  const text = (value || "").trim();
  if (!text) return "UNMATCHED";
  if (!text.toUpperCase().startsWith("MATCHED")) return text;
  const [, provenance] = text.split("|");
  return provenance ? `MATCHED (${provenance})` : "MATCHED";
};

const defaultStatusChip: StatusChip = {
  label: "Idle",
  detail: "Pick an action or a candidate row to get visible feedback here.",
  tone: "mist",
};

const defaultCommitState: CommitState = {
  label: "Ready",
  detail: "Commit the best candidates for the selected row.",
  tone: "mist",
};

const WORKLIST_PAGE_SIZE = 250;

const statusToneStyles: Record<StatusTone, { pill: CSSProperties; dot: CSSProperties }> = {
  blue: {
    pill: {
      background: "rgba(235, 245, 255, 0.92)",
      borderColor: "rgba(151, 181, 219, 0.28)",
      color: "#35506d",
    },
    dot: {
      background: "#8ec4ff",
      boxShadow: "0 0 0 6px rgba(142, 196, 255, 0.18)",
    },
  },
  pink: {
    pill: {
      background: "rgba(255, 236, 244, 0.94)",
      borderColor: "rgba(220, 168, 196, 0.3)",
      color: "#6b4a5d",
    },
    dot: {
      background: "#ff9fc5",
      boxShadow: "0 0 0 6px rgba(255, 159, 197, 0.18)",
    },
  },
  mist: {
    pill: {
      background: "rgba(239, 245, 250, 0.96)",
      borderColor: "rgba(171, 186, 207, 0.24)",
      color: "#4b6178",
    },
    dot: {
      background: "#a7bdd5",
      boxShadow: "0 0 0 6px rgba(167, 189, 213, 0.16)",
    },
  },
  pearl: {
    pill: {
      background: "rgba(249, 245, 239, 0.96)",
      borderColor: "rgba(207, 193, 174, 0.28)",
      color: "#66584a",
    },
    dot: {
      background: "#d8b88d",
      boxShadow: "0 0 0 6px rgba(216, 184, 141, 0.18)",
    },
  },
  success: {
    pill: {
      background: "rgba(224, 245, 229, 0.96)",
      borderColor: "rgba(143, 198, 156, 0.3)",
      color: "#24563a",
    },
    dot: {
      background: "#7fca90",
      boxShadow: "0 0 0 6px rgba(127, 202, 144, 0.18)",
    },
  },
  warning: {
    pill: {
      background: "rgba(255, 236, 224, 0.96)",
      borderColor: "rgba(219, 169, 130, 0.3)",
      color: "#7a4a24",
    },
    dot: {
      background: "#f0a46a",
      boxShadow: "0 0 0 6px rgba(240, 164, 106, 0.18)",
    },
  },
};

export default function Match835Screen() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SourceMatchWorklistSummary | null>(null);
  const [worklist, setWorklist] = useState<SourceMatchWorklistRow[]>([]);
  const [worklistPage, setWorklistPage] = useState(1);
  const [worklistTotalPages, setWorklistTotalPages] = useState(1);
  const [worklistTotalRows, setWorklistTotalRows] = useState(0);
  const [worklistHasPreviousPage, setWorklistHasPreviousPage] = useState(false);
  const [worklistHasNextPage, setWorklistHasNextPage] = useState(false);
  const [worklistSortBy, setWorklistSortBy] = useState<WorklistSortKey>("edi");
  const [worklistSortDir, setWorklistSortDir] = useState<WorklistSortDir>("asc");
  const [showMatchedRows, setShowMatchedRows] = useState(true);
  const [showUnmatchedRows, setShowUnmatchedRows] = useState(true);
  const [latestYearOnly, setLatestYearOnly] = useState(false);
  const [latestYear, setLatestYear] = useState<number | null>(null);
  const [selectedEdiId, setSelectedEdiId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SourceMatchDetail | null>(null);
  const [selectedEftCandidateId, setSelectedEftCandidateId] = useState<number | null>(null);
  const [selectedLockboxCandidateId, setSelectedLockboxCandidateId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [queueRevision, setQueueRevision] = useState<string | null>(null);
  const [statusChip, setStatusChip] = useState<StatusChip>(defaultStatusChip);
  const [commitState, setCommitState] = useState<CommitState>(defaultCommitState);
  const [committing, setCommitting] = useState(false);
  const [bulkCommitState, setBulkCommitState] = useState<CommitState>({
    label: "Bulk ready",
    detail: "Commit all exact matches without review.",
    tone: "mist",
  });
  const [bulkCommitting, setBulkCommitting] = useState(false);

  const loadWorklist = async (
    preferredId?: number | null,
    nextPage: number = worklistPage,
    nextSortBy: WorklistSortKey = worklistSortBy,
    nextSortDir: WorklistSortDir = worklistSortDir,
    nextShowMatchedRows: boolean = showMatchedRows,
    nextShowUnmatchedRows: boolean = showUnmatchedRows,
    nextLatestYearOnly: boolean = latestYearOnly,
  ) => {
    setError(null);
    setStatusChip({
      label: "Refreshing queue",
      detail: "Rebuilding the unmatched 835 worklist from the source tables.",
      tone: "blue",
    });

    try {
      const response = await getSourceMatchWorklist(
        WORKLIST_PAGE_SIZE,
        queueRevision,
        nextPage,
        nextSortBy,
        nextSortDir,
        nextShowMatchedRows,
        nextShowUnmatchedRows,
        nextLatestYearOnly,
      );
      const nextRevision = response.data.revision ?? null;
      setQueueRevision(nextRevision);
      setLatestYear(response.data.latestYear ?? null);

      const nextWorklist = response.data.rows ?? [];
      const nextSummary = response.data.summary ?? null;
      const nextPageNumber = response.data.page ?? nextPage;
      const nextTotalPages = response.data.totalPages ?? 1;
      const nextTotalRows = response.data.totalRows ?? nextWorklist.length;
      const nextHasPreviousPage = response.data.hasPreviousPage ?? nextPageNumber > 1;
      const nextHasNextPage = response.data.hasNextPage ?? nextPageNumber < nextTotalPages;
      const resolvedSortBy = (response.data.sortBy as WorklistSortKey | undefined) ?? nextSortBy;
      const resolvedSortDir = (response.data.sortDir as WorklistSortDir | undefined) ?? nextSortDir;
      const nextSelectedId =
        (preferredId && nextWorklist.some((row) => row.edi.id === preferredId) ? preferredId : null) ??
        (selectedEdiId && nextWorklist.some((row) => row.edi.id === selectedEdiId) ? selectedEdiId : null) ??
        nextWorklist[0]?.edi.id ??
        null;

      setSummary(nextSummary);
      setWorklist(nextWorklist);
      setWorklistPage(nextPageNumber);
      setWorklistTotalPages(nextTotalPages);
      setWorklistTotalRows(nextTotalRows);
      setWorklistHasPreviousPage(nextHasPreviousPage);
      setWorklistHasNextPage(nextHasNextPage);
      setWorklistSortBy(resolvedSortBy);
      setWorklistSortDir(resolvedSortDir);
      setMessage(response.data.changed === false ? "Queue already current." : "Queue refreshed with incremental updates.");
      setStatusChip({
        label: "Queue refreshed",
        detail:
          nextSelectedId !== null
            ? `Loaded page ${nextPageNumber} of ${nextTotalPages} with ${nextWorklist.length} row(s) and focused EDI #${nextSelectedId}.`
            : `Loaded page ${nextPageNumber} of ${nextTotalPages} with ${nextWorklist.length} row(s).`,
        tone: "success",
      });

      if (nextSelectedId !== null) {
        await loadDetail(nextSelectedId);
      } else {
        setSelectedEdiId(null);
        setDetail(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the match queue");
      setWorklist([]);
      setSummary(null);
      setSelectedEdiId(null);
      setDetail(null);
      setStatusChip({
        label: "Queue error",
        detail: "The match queue could not be refreshed.",
        tone: "warning",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (ediId: number) => {
    setError(null);
    setMessage(null);
    setSelectedEdiId(ediId);
    setSelectedEftCandidateId(null);
    setSelectedLockboxCandidateId(null);
    setStatusChip({
      label: `Loading EDI #${ediId}`,
      detail: "Fetching candidate EFT and Lockbox rows for the selected source record.",
      tone: "blue",
    });

    try {
      const response = await getSourceMatchDetail(ediId);
      const nextDetail = response.data;
      setDetail(nextDetail);
      setSelectedEftCandidateId(nextDetail.eftCandidates.find((candidate) => candidate.exactMatch)?.id ?? nextDetail.eftCandidates[0]?.id ?? null);
      setSelectedLockboxCandidateId(
        nextDetail.lockboxCandidates.find((candidate) => candidate.exactMatch)?.id ?? nextDetail.lockboxCandidates[0]?.id ?? null,
      );
      setStatusChip({
        label: `EDI #${ediId} loaded`,
        detail: `${nextDetail.eftCandidates.length} EFT and ${nextDetail.lockboxCandidates.length} Lockbox candidate(s) available.`,
        tone: "pearl",
      });

      if (!selectedEdiId) {
        setSelectedEdiId(ediId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load match detail");
      setDetail(null);
      setStatusChip({
        label: "Detail error",
        detail: `Failed to load EDI #${ediId}.`,
        tone: "warning",
      });
    }
  };

  const commitBestMatch = async () => {
    if (!detail) {
      setCommitState({
        label: "No row",
        detail: "Select a row before committing.",
        tone: "warning",
      });
      return;
    }

    const eftCandidate =
      detail.eftCandidates.find((candidate) => candidate.id === selectedEftCandidateId) ??
      detail.eftCandidates.find((candidate) => candidate.exactMatch) ??
      detail.eftCandidates[0] ??
      null;
    const lockboxCandidate =
      detail.lockboxCandidates.find((candidate) => candidate.id === selectedLockboxCandidateId) ??
      detail.lockboxCandidates.find((candidate) => candidate.exactMatch) ??
      detail.lockboxCandidates[0] ??
      null;
    const eftId = eftCandidate?.id;
    const lockboxId = lockboxCandidate?.id;

    if (!eftId && !lockboxId) {
      setCommitState({
        label: "Not exact",
        detail: "Select an EFT or Lockbox candidate first.",
        tone: "warning",
      });
      return;
    }

    setCommitting(true);
      setCommitState({
        label: "Committing",
        detail: `Submitting EDI #${detail.edi.id} with the selected candidate(s).`,
        tone: "blue",
      });

    try {
      const response = await commitSourceMatch({
        edi_id: detail.edi.id,
        eft_ids: eftId ? [eftId] : [],
        lockbox_ids: lockboxId ? [lockboxId] : [],
      });

      setCommitState({
        label: "Committed",
        detail: `EDI #${response.data.edi_id} updated: ${response.data.eftMatched} EFT, ${response.data.lockboxMatched} Lockbox.`,
        tone: "success",
      });
      setStatusChip({
        label: "Commit complete",
        detail: `EDI #${response.data.edi_id} was committed and the worklist will refresh.`,
        tone: "success",
      });
      setMessage(`Committed EDI #${response.data.edi_id}.`);
      await loadWorklist(detail.edi.id, worklistPage, worklistSortBy, worklistSortDir);
    } catch (err) {
      setCommitState({
        label: "Commit failed",
        detail: err instanceof Error ? err.message : "The commit request could not be completed.",
        tone: "warning",
      });
    } finally {
      setCommitting(false);
    }
  };

  const commitAllExact = async () => {
    setBulkCommitting(true);
    setBulkCommitState({
      label: "Bulk committing",
      detail: "Submitting every exact match on file.",
      tone: "blue",
    });

    try {
      const response = await commitAllExactMatches();
      const exactCount = response.data.exactMatched ?? response.data.strongMatched ?? response.data.ediMatched;

      setBulkCommitState({
        label: "Bulk committed",
        detail: `${exactCount} exact match${exactCount === 1 ? "" : "es"} committed.`,
        tone: "success",
      });
      setStatusChip({
        label: "Bulk commit complete",
        detail: `${exactCount} exact match${exactCount === 1 ? "" : "es"} were committed from the records.`,
        tone: "success",
      });
      setMessage(`Committed ${exactCount} exact match${exactCount === 1 ? "" : "es"}.`);
      await loadWorklist(selectedEdiId, worklistPage, worklistSortBy, worklistSortDir);
    } catch (err) {
      setBulkCommitState({
        label: "Bulk failed",
        detail: err instanceof Error ? err.message : "The bulk commit request could not be completed.",
        tone: "warning",
      });
    } finally {
      setBulkCommitting(false);
    }
  };

  useEffect(() => {
    void loadWorklist(undefined, 1, "edi", "asc");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (nextShowMatchedRows: boolean, nextShowUnmatchedRows: boolean, nextLatestYearOnly: boolean) => {
    setShowMatchedRows(nextShowMatchedRows);
    setShowUnmatchedRows(nextShowUnmatchedRows);
    setLatestYearOnly(nextLatestYearOnly);
    void loadWorklist(selectedEdiId, 1, worklistSortBy, worklistSortDir, nextShowMatchedRows, nextShowUnmatchedRows, nextLatestYearOnly);
  };

  const toggleSort = (column: WorklistSortKey) => {
    const nextSortDir: WorklistSortDir =
      worklistSortBy === column ? (worklistSortDir === "asc" ? "desc" : "asc") : column === "edi" ? "asc" : "desc";
    setWorklistSortBy(column);
    setWorklistSortDir(nextSortDir);
    void loadWorklist(selectedEdiId, 1, column, nextSortDir);
  };

  const goToPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(1, nextPage), Math.max(1, worklistTotalPages));
    void loadWorklist(selectedEdiId, safePage, worklistSortBy, worklistSortDir);
  };

  return (
    <main style={{ ...adminStyles.shell, overflowX: "hidden", overflowY: "auto", alignItems: "start" }}>
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
          Source-driven 835 matching. We look at EDI first, then confirm against EFT and Lockbox rows.
        </p>

        <nav style={adminStyles.navStack} aria-label="835 match navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/cash")}>
            <span style={adminStyles.navButtonLabel}>Cash</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Queue</div>
          <div style={adminStyles.sidebarCardValue}>
            {summary ? `${summary.ediRows} EDI rows` : "Loading matrix"}
          </div>
          <div style={adminStyles.sidebarCardMeta}>
            Y means matched, P means possible, and N means no match yet.
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>835 Match screen</div>
            <p style={adminStyles.subtitle}>
              A compact matrix for seeing Y, P, and N at a glance. Select a row to preview the best EFT and Lockbox comparison.
            </p>
            <div style={matchStyles.heroFilterSummary}>
              <div style={matchStyles.heroFilterRow}>
                <span style={matchStyles.heroFilterLabel}>Rolling year on file:</span>
                <span style={matchStyles.heroFilterValue}>{latestYear ?? "Unavailable"}</span>
              </div>
              <div style={matchStyles.heroFilterRow}>
                <span style={matchStyles.heroFilterLabel}>Matched:</span>
                <span style={matchStyles.heroFilterValue}>{showMatchedRows ? "Shown" : "Hidden"}</span>
              </div>
              <div style={matchStyles.heroFilterRow}>
                <span style={matchStyles.heroFilterLabel}>Non-matches:</span>
                <span style={matchStyles.heroFilterValue}>{showUnmatchedRows ? "Shown" : "Hidden"}</span>
              </div>
            </div>
            <div style={adminStyles.heroActions}>
              <button
                type="button"
                aria-pressed={showMatchedRows}
                style={showMatchedRows ? adminStyles.primaryButton : adminStyles.secondaryButton}
                onClick={() => applyFilters(!showMatchedRows, showUnmatchedRows, latestYearOnly)}
              >
                Matched
              </button>
              <button
                type="button"
                aria-pressed={showUnmatchedRows}
                style={showUnmatchedRows ? adminStyles.primaryButton : adminStyles.secondaryButton}
                onClick={() => applyFilters(showMatchedRows, !showUnmatchedRows, latestYearOnly)}
              >
                Non-matches
              </button>
              <button
                type="button"
                aria-pressed={latestYearOnly}
                style={latestYearOnly ? adminStyles.primaryButton : adminStyles.secondaryButton}
                onClick={() => applyFilters(showMatchedRows, showUnmatchedRows, !latestYearOnly)}
                disabled={!latestYear}
              >
                Rolling year
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span
                  style={{
                    ...adminStyles.statusPill,
                    ...statusToneStyles[statusChip.tone].pill,
                  }}
                >
                  {summary ? `${summary.ediRows} rows` : "Loading"}
                </span>
                <span
                  style={{
                    ...adminStyles.statusDot,
                    ...statusToneStyles[statusChip.tone].dot,
                  }}
                />
              </div>
              <div style={adminStyles.heroStatusTitle}>Y means matched, P means possible, N means review</div>
              <div style={adminStyles.heroStatusText}>{statusChip.detail}</div>
            </div>
          </div>
        </section>

        <section style={matchStyles.workspace}>
          <article style={matchStyles.panel}>
            <div style={matchStyles.panelHeader}>
              <div>
                <div style={adminStyles.sectionKicker}>EDI worklist</div>
                <h2 style={adminStyles.sectionTitle}>Match status grid</h2>
              </div>
              <div style={matchStyles.panelMeta}>
                {loading ? "Loading..." : `${worklist.length} visible`}
              </div>
            </div>

            {error && <div style={matchStyles.errorBanner}>{error}</div>}
            {message && <div style={matchStyles.successBanner}>{message}</div>}
            <div style={matchStyles.gridSummaryBar}>
              <div style={matchStyles.gridSummaryChip}>
                <span style={matchStyles.gridSummaryLabel}>Rows</span>
                <span style={matchStyles.gridSummaryValue}>{summary ? summary.ediRows : 0}</span>
              </div>
              <div style={matchStyles.gridSummaryChip}>
                <span style={matchStyles.gridSummaryLabel}>Y</span>
                <span style={matchStyles.gridSummaryValue}>{summary ? summary.ediMatched : 0}</span>
              </div>
              <div style={matchStyles.gridSummaryChip}>
                <span style={matchStyles.gridSummaryLabel}>P</span>
                <span style={matchStyles.gridSummaryValue}>{summary ? summary.ediPossible : 0}</span>
              </div>
              <div style={matchStyles.gridSummaryChip}>
                <span style={matchStyles.gridSummaryLabel}>N</span>
                <span style={matchStyles.gridSummaryValue}>{summary ? summary.ediReview : 0}</span>
              </div>
            </div>

            <div style={matchStyles.pagerBar}>
              <div style={matchStyles.pagerMeta}>
                Page {worklistPage} of {worklistTotalPages} · {worklistTotalRows} total · {WORKLIST_PAGE_SIZE} per page
              </div>
              <div style={matchStyles.pagerActions}>
                <button
                  type="button"
                  style={matchStyles.pagerButton}
                  onClick={() => goToPage(worklistPage - 1)}
                  disabled={!worklistHasPreviousPage || loading}
                >
                  Previous
                </button>
                <button
                  type="button"
                  style={matchStyles.pagerButton}
                  onClick={() => goToPage(worklistPage + 1)}
                  disabled={!worklistHasNextPage || loading}
                >
                  Next
                </button>
              </div>
            </div>

            <div style={matchStyles.gridScroll}>
              {worklist.length ? (
                <table style={matchStyles.matrixTable}>
                  <thead>
                    <tr>
                      <th style={matchStyles.matrixHeadCellId}>
                        <button type="button" style={matchStyles.sortHeaderButton} onClick={() => toggleSort("edi")}>
                          <span>EDI</span>
                          <span style={matchStyles.sortHeaderGlyph}>{worklistSortBy === "edi" ? (worklistSortDir === "asc" ? "▲" : "▼") : ""}</span>
                        </button>
                      </th>
                      <th style={matchStyles.matrixHeadCellCenter}>
                        <button type="button" style={matchStyles.sortHeaderButton} onClick={() => toggleSort("match")}>
                          <span>Match</span>
                          <span style={matchStyles.sortHeaderGlyph}>{worklistSortBy === "match" ? (worklistSortDir === "asc" ? "▲" : "▼") : ""}</span>
                        </button>
                      </th>
                      <th style={matchStyles.matrixHeadCellCenter}>
                        <button type="button" style={matchStyles.sortHeaderButton} onClick={() => toggleSort("lockbox")}>
                          <span>Lockbox</span>
                          <span style={matchStyles.sortHeaderGlyph}>{worklistSortBy === "lockbox" ? (worklistSortDir === "asc" ? "▲" : "▼") : ""}</span>
                        </button>
                      </th>
                      <th style={matchStyles.matrixHeadCellCenter}>
                        <button type="button" style={matchStyles.sortHeaderButton} onClick={() => toggleSort("eft")}>
                          <span>EFT</span>
                          <span style={matchStyles.sortHeaderGlyph}>{worklistSortBy === "eft" ? (worklistSortDir === "asc" ? "▲" : "▼") : ""}</span>
                        </button>
                      </th>
                      <th style={matchStyles.matrixHeadCellPossible}>
                        <button type="button" style={matchStyles.sortHeaderButton} onClick={() => toggleSort("possible")}>
                          <span>Possible Match</span>
                          <span style={matchStyles.sortHeaderGlyph}>{worklistSortBy === "possible" ? (worklistSortDir === "asc" ? "▲" : "▼") : ""}</span>
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {worklist.map((row) => {
                      const selected = row.edi.id === selectedEdiId;
                      return (
                        <tr
                          key={row.edi.id}
                          style={{
                            ...matchStyles.matrixRow,
                            ...(row.matchCode === "Y"
                              ? matchStyles.matrixRowY
                              : row.possibleMatchLabel
                                ? matchStyles.matrixRowP
                                : matchStyles.matrixRowN),
                            ...(selected ? matchStyles.gridRowSelected : {}),
                          }}
                          onClick={() => void loadDetail(row.edi.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              void loadDetail(row.edi.id);
                            }
                          }}
                        >
                          <td style={{ ...matchStyles.matrixCellId, ...(selected ? matchStyles.gridCellSelected : {}) }}>
                            EDI {row.edi.id}
                          </td>
                          <td style={{ ...matchStyles.matrixCellCenter, ...(selected ? matchStyles.gridCellSelected : {}) }}>
                              <span
                                style={{
                                  ...matchStyles.matrixLetter,
                                  ...statusToneStyles[row.matchCode === "Y" ? "success" : row.possibleMatchLabel ? "warning" : "mist"].pill,
                                }}
                              >
                              {row.matchCode}
                              </span>
                            </td>
                          <td style={{ ...matchStyles.matrixCellCenter, ...(selected ? matchStyles.gridCellSelected : {}) }}>
                            {row.lockboxMatchCode ? (
                              <span style={{ ...matchStyles.matrixLetter, ...statusToneStyles.success.pill }}>Y</span>
                            ) : (
                              <span style={matchStyles.matrixMuted}>-</span>
                            )}
                          </td>
                          <td style={{ ...matchStyles.matrixCellCenter, ...(selected ? matchStyles.gridCellSelected : {}) }}>
                            {row.eftMatchCode ? (
                              <span style={{ ...matchStyles.matrixLetter, ...statusToneStyles.success.pill }}>Y</span>
                            ) : (
                              <span style={matchStyles.matrixMuted}>-</span>
                            )}
                          </td>
                          <td style={{ ...matchStyles.matrixCellPossible, ...(selected ? matchStyles.gridCellSelected : {}) }}>
                            {row.possibleMatchLabel || <span style={matchStyles.matrixMuted}>-</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={matchStyles.emptyState}>
                  {loading
                    ? "Loading the match matrix..."
                    : "No EDI rows are available for the matrix yet."}
                </div>
              )}
            </div>
          </article>

      <article style={matchStyles.panelSticky}>
            <div style={matchStyles.panelHeader}>
              <div>
                <div style={adminStyles.sectionKicker}>Candidate detail</div>
                <h2 style={adminStyles.sectionTitle}>
                  {detail ? `EDI ${detail.edi.id}` : "Select an EDI row"}
                </h2>
              </div>
              <div style={matchStyles.panelActions}>
                <span
                  style={{
                    ...matchStyles.commitPill,
                    ...statusToneStyles[commitState.tone].pill,
                  }}
                >
                  {commitState.label}
                </span>
                <button
                  type="button"
                  style={matchStyles.inlineCommitButton}
                  onClick={() => void commitBestMatch()}
                  disabled={!detail || committing}
                >
                  {committing ? "Committing..." : "Commit"}
                </button>
                <span
                  style={{
                    ...matchStyles.commitPill,
                    ...statusToneStyles[bulkCommitState.tone].pill,
                  }}
                >
                  {bulkCommitState.label}
                </span>
                <button
                  type="button"
                  style={matchStyles.inlineCommitButton}
                  onClick={() => void commitAllExact()}
                  disabled={bulkCommitting}
                >
                  {bulkCommitting ? "Committing all..." : "Commit All 100%"}
                </button>
              </div>
            </div>
            <div style={matchStyles.panelMeta}>
              {detail ? `Check ${detail.edi.checkNumber || "(blank)"}` : "No row selected"}
            </div>

            <div style={matchStyles.detailScroll}>
              {detail ? (
                <div style={matchStyles.previewStack}>
                  <div style={matchStyles.previewCard}>
                    <div style={matchStyles.detailHeader}>Selected row</div>
                    <div style={matchStyles.previewGrid}>
                      <div>
                        <div style={matchStyles.rowLabel}>EDI</div>
                        <div style={matchStyles.rowValue}>#{detail.edi.id}</div>
                      </div>
                      <div>
                        <div style={matchStyles.rowLabel}>Match</div>
                        <div style={matchStyles.rowValue}>{formatMatchStatus(detail.edi.matchstatus)}</div>
                      </div>
                      <div>
                        <div style={matchStyles.rowLabel}>Check</div>
                        <div style={matchStyles.rowValue}>{detail.edi.checkNumber || "(blank)"}</div>
                      </div>
                      <div>
                        <div style={matchStyles.rowLabel}>Amount</div>
                        <div style={matchStyles.rowValue}>{formatAmount(detail.edi.amount)}</div>
                      </div>
                      <div>
                        <div style={matchStyles.rowLabel}>Date</div>
                        <div style={matchStyles.rowValue}>{formatDate(detail.edi.date)}</div>
                      </div>
                      <div>
                        <div style={matchStyles.rowLabel}>Status</div>
                        <div style={matchStyles.rowValue}>
                          {isMatchedStatus(detail.edi.matchstatus) ? "Y" : "N"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={matchStyles.previewColumns}>
                    <div style={matchStyles.previewCard}>
                      <div style={matchStyles.detailHeader}>Matched EFT</div>
                      {detail.matchedEft[0] ? (
                        <div style={matchStyles.previewBody}>
                          <div style={matchStyles.previewLine}>Score {detail.matchedEft[0].score}</div>
                          <div style={matchStyles.previewLine}>Reason {detail.matchedEft[0].reason}</div>
                          <div style={matchStyles.previewLine}>Check {detail.matchedEft[0].checkNumber || "(blank)"}</div>
                          <div style={matchStyles.previewLine}>Amount {formatAmount(detail.matchedEft[0].amount)}</div>
                          <div style={matchStyles.previewLine}>Date {formatDate(detail.matchedEft[0].date)}</div>
                        </div>
                      ) : (
                        <div style={matchStyles.emptyState}>No matched EFT record on file.</div>
                      )}
                    </div>

                    <div style={matchStyles.previewCard}>
                      <div style={matchStyles.detailHeader}>Matched Lockbox</div>
                      {detail.matchedLockbox[0] ? (
                        <div style={matchStyles.previewBody}>
                          <div style={matchStyles.previewLine}>Score {detail.matchedLockbox[0].score}</div>
                          <div style={matchStyles.previewLine}>Reason {detail.matchedLockbox[0].reason}</div>
                          <div style={matchStyles.previewLine}>Check {detail.matchedLockbox[0].checkNumber || "(blank)"}</div>
                          <div style={matchStyles.previewLine}>Amount {formatAmount(detail.matchedLockbox[0].amount)}</div>
                          <div style={matchStyles.previewLine}>Date {formatDate(detail.matchedLockbox[0].date)}</div>
                        </div>
                      ) : (
                        <div style={matchStyles.emptyState}>No matched Lockbox record on file.</div>
                      )}
                    </div>
                  </div>

                  <div style={matchStyles.previewColumns}>
                    <div style={matchStyles.previewCard}>
                      <div style={matchStyles.detailHeader}>Best EFT candidate</div>
                      {detail.eftCandidates[0] ? (
                        <div style={matchStyles.previewBody}>
                          <div style={matchStyles.previewLine}>Score {detail.eftCandidates[0].score}</div>
                          <div style={matchStyles.previewLine}>Reason {detail.eftCandidates[0].reason}</div>
                          <div style={matchStyles.previewLine}>Check {detail.eftCandidates[0].checkNumber || "(blank)"}</div>
                          <div style={matchStyles.previewLine}>Amount {formatAmount(detail.eftCandidates[0].amount)}</div>
                          <div style={matchStyles.previewLine}>Date {formatDate(detail.eftCandidates[0].date)}</div>
                        </div>
                      ) : (
                        <div style={matchStyles.emptyState}>No EFT candidate.</div>
                      )}
                    </div>

                    <div style={matchStyles.previewCard}>
                      <div style={matchStyles.detailHeader}>Best Lockbox candidate</div>
                      {detail.lockboxCandidates[0] ? (
                        <div style={matchStyles.previewBody}>
                          <div style={matchStyles.previewLine}>Score {detail.lockboxCandidates[0].score}</div>
                          <div style={matchStyles.previewLine}>Reason {detail.lockboxCandidates[0].reason}</div>
                          <div style={matchStyles.previewLine}>Check {detail.lockboxCandidates[0].checkNumber || "(blank)"}</div>
                          <div style={matchStyles.previewLine}>Amount {formatAmount(detail.lockboxCandidates[0].amount)}</div>
                          <div style={matchStyles.previewLine}>Date {formatDate(detail.lockboxCandidates[0].date)}</div>
                        </div>
                      ) : (
                        <div style={matchStyles.emptyState}>No Lockbox candidate.</div>
                      )}
                    </div>
                  </div>

                  <div style={matchStyles.previewColumns}>
                    <div style={matchStyles.previewCard}>
                      <div style={matchStyles.detailHeader}>Pick EFT candidate</div>
                      {detail.eftCandidates.length ? (
                        <div style={matchStyles.candidatePanel}>
                          {detail.eftCandidates.map((candidate) => {
                            const isSelected = candidate.id === selectedEftCandidateId;
                            return (
                              <button
                                key={candidate.id}
                                type="button"
                                style={{
                                  ...matchStyles.candidateCard,
                                  ...(isSelected ? matchStyles.candidateCardSelected : {}),
                                  ...(candidate.exactMatch ? matchStyles.candidateCardStrong : {}),
                                }}
                                onClick={() => setSelectedEftCandidateId(candidate.id)}
                                aria-pressed={isSelected}
                              >
                                <div style={matchStyles.candidateHeader}>
                                  EFT #{candidate.id} {candidate.exactMatch ? "Matched" : ""}
                                </div>
                                <div style={matchStyles.previewBody}>
                                  <div style={matchStyles.previewLine}>Score {candidate.score ?? 0}</div>
                                  <div style={matchStyles.previewLine}>Reason {candidate.reason || "review"}</div>
                                  <div style={matchStyles.previewLine}>Check {candidate.checkNumber || "(blank)"}</div>
                                  <div style={matchStyles.previewLine}>Amount {formatAmount(candidate.amount)}</div>
                                  <div style={matchStyles.previewLine}>Date {formatDate(candidate.date)}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={matchStyles.emptyState}>No EFT candidates available.</div>
                      )}
                    </div>

                    <div style={matchStyles.previewCard}>
                      <div style={matchStyles.detailHeader}>Pick Lockbox candidate</div>
                      {detail.lockboxCandidates.length ? (
                        <div style={matchStyles.candidatePanel}>
                          {detail.lockboxCandidates.map((candidate) => {
                            const isSelected = candidate.id === selectedLockboxCandidateId;
                            return (
                              <button
                                key={candidate.id}
                                type="button"
                                style={{
                                  ...matchStyles.candidateCard,
                                  ...(isSelected ? matchStyles.candidateCardSelected : {}),
                                  ...(candidate.exactMatch ? matchStyles.candidateCardStrong : {}),
                                }}
                                onClick={() => setSelectedLockboxCandidateId(candidate.id)}
                                aria-pressed={isSelected}
                              >
                                <div style={matchStyles.candidateHeader}>
                                  Lockbox #{candidate.id} {candidate.exactMatch ? "Matched" : ""}
                                </div>
                                <div style={matchStyles.previewBody}>
                                  <div style={matchStyles.previewLine}>Score {candidate.score ?? 0}</div>
                                  <div style={matchStyles.previewLine}>Reason {candidate.reason || "review"}</div>
                                  <div style={matchStyles.previewLine}>Check {candidate.checkNumber || "(blank)"}</div>
                                  <div style={matchStyles.previewLine}>Amount {formatAmount(candidate.amount)}</div>
                                  <div style={matchStyles.previewLine}>Date {formatDate(candidate.date)}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={matchStyles.emptyState}>No Lockbox candidates available.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={matchStyles.emptyState}>Select a row on the left to preview its best candidate matches.</div>
              )}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

const matchStyles: Record<string, CSSProperties> = {
  workspace: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)",
    gap: "18px",
    alignItems: "stretch",
  },
  panel: {
    borderRadius: "28px",
    padding: "20px",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    maxHeight: "calc(100vh - 36px)",
  },
  panelSticky: {
    borderRadius: "28px",
    padding: "20px",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    position: "sticky",
    top: "16px",
    alignSelf: "start",
    maxHeight: "calc(100vh - 32px)",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "baseline",
    marginBottom: "14px",
  },
  panelMeta: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#597085",
  },
  pagerBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    marginBottom: "12px",
    padding: "10px 12px",
    borderRadius: "16px",
    background: "rgba(247, 250, 253, 0.96)",
    border: "1px solid rgba(171, 186, 207, 0.22)",
    flexWrap: "wrap",
  },
  pagerMeta: {
    fontSize: "12px",
    color: "#597085",
    fontWeight: 700,
  },
  pagerActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  pagerButton: {
    minHeight: "34px",
    padding: "0 14px",
    borderRadius: "12px",
    border: "1px solid rgba(106, 137, 180, 0.32)",
    background: "rgba(255,255,255,0.96)",
    color: "#17324f",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  filterBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    marginBottom: "12px",
    padding: "10px 12px",
    borderRadius: "16px",
    background: "rgba(247, 250, 253, 0.96)",
    border: "1px solid rgba(171, 186, 207, 0.22)",
    flexWrap: "wrap",
  },
  filterMeta: {
    fontSize: "12px",
    color: "#597085",
    fontWeight: 700,
  },
  filterActions: {
    display: "grid",
    gap: "10px",
    width: "100%",
  },
  filterButton: {
    height: "46px",
    padding: "0 16px",
    borderRadius: "16px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    background: "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(236,245,255,0.95) 54%, rgba(255,236,244,0.92) 100%)",
    color: "#17324f",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.01em",
    textTransform: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    cursor: "pointer",
    boxShadow: "0 12px 26px rgba(52, 84, 120, 0.08)",
    whiteSpace: "nowrap",
    width: "100%",
    textAlign: "left",
  },
  filterButtonActive: {
    borderColor: "rgba(109, 142, 186, 0.42)",
    color: "#12314c",
    boxShadow: "0 14px 30px rgba(52, 84, 120, 0.12)",
  },
  filterButtonCopy: {
    display: "grid",
    gap: "2px",
    minWidth: 0,
  },
  filterButtonLabel: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#17324f",
  },
  filterButtonValue: {
    fontSize: "11px",
    fontWeight: 800,
    color: "#6c8096",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  filterButtonGlyph: {
    width: "22px",
    height: "22px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.76)",
    color: "#8aa5c6",
    fontSize: "12px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
    flex: "0 0 auto",
  },
  heroFilterSummary: {
    display: "grid",
    gap: "6px",
    marginTop: "10px",
    marginBottom: "10px",
    padding: "10px 12px",
    borderRadius: "16px",
    background: "rgba(247, 250, 253, 0.84)",
    border: "1px solid rgba(171, 186, 207, 0.18)",
  },
  heroFilterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "baseline",
  },
  heroFilterLabel: {
    fontSize: "11px",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontWeight: 800,
    color: "#718498",
  },
  heroFilterValue: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#17324f",
  },
  panelActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  commitPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "38px",
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid transparent",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  gridScroll: {
    display: "block",
    minHeight: 0,
    overflowX: "hidden",
    overflowY: "auto",
    paddingRight: "6px",
    flex: "1 1 auto",
  },
  gridSummaryBar: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "10px",
    marginBottom: "12px",
  },
  gridSummaryChip: {
    borderRadius: "16px",
    padding: "12px 14px",
    background: "linear-gradient(180deg, rgba(248,250,253,0.98), rgba(239,245,255,0.96))",
    border: "1px solid rgba(171, 186, 207, 0.24)",
    display: "grid",
    gap: "4px",
  },
  gridSummaryLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#718498",
    fontWeight: 800,
  },
  gridSummaryValue: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#17324f",
  },
  matrixTable: {
    width: "100%",
    minWidth: "0",
    tableLayout: "fixed",
    borderCollapse: "collapse",
  },
  matrixHeadCellId: {
    textAlign: "left",
    width: "92px",
    padding: "9px 8px",
    fontSize: "11px",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#66798d",
    borderBottom: "1px solid rgba(171, 186, 207, 0.32)",
  },
  sortHeaderButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: 0,
    border: 0,
    background: "transparent",
    color: "inherit",
    font: "inherit",
    cursor: "pointer",
    textTransform: "inherit",
    letterSpacing: "inherit",
  },
  sortHeaderGlyph: {
    minWidth: "12px",
    color: "#91a3b6",
    fontSize: "10px",
    lineHeight: 1,
  },
  matrixHeadCellCenter: {
    textAlign: "center",
    width: "68px",
    padding: "9px 6px",
    fontSize: "11px",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#66798d",
    borderBottom: "1px solid rgba(171, 186, 207, 0.32)",
  },
  matrixHeadCellPossible: {
    textAlign: "left",
    width: "180px",
    padding: "9px 8px",
    fontSize: "11px",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#66798d",
    borderBottom: "1px solid rgba(171, 186, 207, 0.32)",
  },
  matrixRow: {
    cursor: "pointer",
  },
  matrixRowY: {
    background: "rgba(233, 247, 236, 0.96)",
  },
  matrixRowP: {
    background: "rgba(255, 248, 227, 0.96)",
  },
  matrixRowN: {
    background: "rgba(245, 249, 252, 0.96)",
  },
  matrixCellId: {
    width: "92px",
    padding: "9px 8px",
    fontSize: "13px",
    fontWeight: 800,
    color: "#17324f",
    borderBottom: "1px solid rgba(171, 186, 207, 0.20)",
    whiteSpace: "nowrap",
  },
  matrixCellCenter: {
    width: "68px",
    padding: "9px 6px",
    textAlign: "center",
    fontSize: "12px",
    fontWeight: 800,
    color: "#17324f",
    borderBottom: "1px solid rgba(171, 186, 207, 0.20)",
  },
  matrixCellPossible: {
    width: "180px",
    padding: "9px 8px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#17324f",
    borderBottom: "1px solid rgba(171, 186, 207, 0.20)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  matrixLetter: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "28px",
    minHeight: "26px",
    borderRadius: "999px",
    border: "1px solid rgba(140, 160, 184, 0.26)",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.12em",
  },
  matrixMuted: {
    color: "#8a9aad",
    fontWeight: 700,
  },
  gridTable: {
    width: "100%",
    minWidth: "980px",
    borderCollapse: "separate",
    borderSpacing: "0 4px",
  },
  gridHeadCell: {
    position: "sticky",
    top: 0,
    zIndex: 1,
    textAlign: "left",
    padding: "10px 12px",
    fontSize: "11px",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#6e8195",
    background: "rgba(248, 250, 253, 0.96)",
    backdropFilter: "blur(10px)",
  },
  gridHeadCellNumeric: {
    position: "sticky",
    top: 0,
    zIndex: 1,
    textAlign: "right",
    padding: "10px 12px",
    fontSize: "11px",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#6e8195",
    background: "rgba(248, 250, 253, 0.96)",
    backdropFilter: "blur(10px)",
  },
  gridRow: {
    cursor: "pointer",
    transition: "transform 0.14s ease, box-shadow 0.14s ease",
  },
  gridRowOdd: {
    background: "rgba(255,255,255,0.92)",
  },
  gridRowEven: {
    background: "rgba(245, 249, 252, 0.95)",
  },
  gridRowSelected: {
    transform: "translateY(-1px)",
  },
  gridCellSelected: {
    background: "rgba(235, 244, 255, 0.99)",
  },
  gridCell: {
    padding: "10px 12px",
    fontSize: "13px",
    color: "#19324d",
    verticalAlign: "middle",
    borderTop: "1px solid rgba(171, 186, 207, 0.22)",
    borderBottom: "1px solid rgba(171, 186, 207, 0.22)",
    background: "inherit",
  },
  gridCellStrong: {
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 800,
    color: "#16304d",
    verticalAlign: "middle",
    borderTop: "1px solid rgba(171, 186, 207, 0.22)",
    borderBottom: "1px solid rgba(171, 186, 207, 0.22)",
    background: "inherit",
  },
  gridCellNumeric: {
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 800,
    color: "#19324d",
    verticalAlign: "middle",
    textAlign: "right",
    borderTop: "1px solid rgba(171, 186, 207, 0.22)",
    borderBottom: "1px solid rgba(171, 186, 207, 0.22)",
    background: "inherit",
  },
  gridStatusPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  gridStatusMeta: {
    fontSize: "11px",
    lineHeight: 1.45,
    color: "#617589",
  },
  gridActionButton: {
    minHeight: "30px",
    padding: "0 10px",
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.26)",
    background: "rgba(255,255,255,0.96)",
    color: "#19324d",
    fontWeight: 700,
    cursor: "pointer",
  },
  rowTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
    marginBottom: "12px",
  },
  rowId: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#16304d",
  },
  rowBadge: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#4b6178",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  rowGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px 16px",
  },
  rowLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#74879c",
    fontWeight: 800,
    marginBottom: "4px",
  },
  rowValue: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#19324d",
  },
  rowFooter: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "12px",
    fontSize: "12px",
    color: "#62768b",
    fontWeight: 700,
  },
  historyPanel: {
    display: "grid",
    gap: "12px",
  },
  historyList: {
    display: "grid",
    gap: "12px",
    maxHeight: "56vh",
    overflowY: "auto",
    paddingRight: "6px",
  },
  historyCard: {
    width: "100%",
    textAlign: "left",
    borderRadius: "18px",
    padding: "14px",
    border: "1px solid rgba(171, 186, 207, 0.28)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.97), rgba(247,249,252,0.94))",
    boxShadow: "0 10px 20px rgba(52, 84, 120, 0.05)",
    cursor: "pointer",
    display: "grid",
    gap: "10px",
  },
  inlineCommitButton: {
    minHeight: "38px",
    borderRadius: "14px",
    border: "1px solid rgba(106, 137, 180, 0.45)",
    background: "rgba(235, 242, 252, 0.98)",
    color: "#17324f",
    padding: "0 14px",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
    justifySelf: "start",
  },
  detailStack: {
    display: "grid",
    gap: "14px",
  },
  detailScroll: {
    minHeight: 0,
    overflowY: "auto",
    paddingRight: "6px",
    flex: "1 1 auto",
  },
  previewStack: {
    display: "grid",
    gap: "14px",
  },
  previewColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },
  previewCard: {
    borderRadius: "22px",
    padding: "16px",
    background: "linear-gradient(135deg, rgba(243, 248, 255, 0.95) 0%, rgba(255, 239, 245, 0.92) 100%)",
    border: "1px solid rgba(175, 193, 218, 0.22)",
    display: "grid",
    gap: "12px",
  },
  previewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px 16px",
  },
  previewBody: {
    display: "grid",
    gap: "8px",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  previewLine: {
    color: "#17324f",
    fontWeight: 700,
  },
  detailCard: {
    borderRadius: "22px",
    padding: "16px",
    background: "linear-gradient(135deg, rgba(243, 248, 255, 0.95) 0%, rgba(255, 239, 245, 0.92) 100%)",
    border: "1px solid rgba(175, 193, 218, 0.22)",
  },
  matchedSection: {
    borderRadius: "22px",
    padding: "16px",
    background: "linear-gradient(135deg, rgba(247, 251, 255, 0.98) 0%, rgba(255, 248, 250, 0.95) 100%)",
    border: "1px solid rgba(175, 193, 218, 0.18)",
    display: "grid",
    gap: "12px",
  },
  matchedMeta: {
    fontSize: "13px",
    lineHeight: 1.5,
    color: "#567087",
    fontWeight: 600,
  },
  matchedColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
  },
  matchedColumn: {
    display: "grid",
    gap: "10px",
    minWidth: 0,
  },
  candidatePanel: {
    display: "grid",
    gap: "10px",
  },
  matchedCard: {
    borderRadius: "18px",
    padding: "14px",
    background: "rgba(255,255,255,0.94)",
    border: "1px solid rgba(171, 186, 207, 0.24)",
    boxShadow: "0 10px 20px rgba(52, 84, 120, 0.04)",
    display: "grid",
    gap: "10px",
  },
  emptyMatched: {
    borderRadius: "16px",
    padding: "14px",
    background: "rgba(250, 252, 255, 0.96)",
    border: "1px dashed rgba(171, 186, 207, 0.34)",
    color: "#667a90",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  strongHitCard: {
    borderRadius: "22px",
    padding: "16px",
    background: "linear-gradient(135deg, rgba(238, 248, 241, 0.95) 0%, rgba(255, 250, 241, 0.92) 100%)",
    border: "1px solid rgba(171, 204, 184, 0.26)",
    display: "grid",
    gap: "12px",
  },
  detailHeader: {
    fontSize: "15px",
    fontWeight: 800,
    color: "#17324f",
    marginBottom: "12px",
  },
  strongHitText: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#2c4b38",
    fontWeight: 600,
  },
  strongHitButton: {
    minHeight: "44px",
    borderRadius: "16px",
    border: "1px solid rgba(131, 175, 143, 0.45)",
    background: "linear-gradient(145deg, rgba(198, 234, 206, 0.98), rgba(229, 247, 233, 0.95))",
    color: "#24422f",
    padding: "0 16px",
    fontSize: "14px",
    fontWeight: 800,
    cursor: "pointer",
    justifySelf: "start",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px 16px",
  },
  detailValue: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#19324d",
  },
  splitGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },
  candidateColumn: {
    display: "grid",
    gap: "12px",
    minWidth: 0,
  },
  candidateHeader: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#17324f",
  },
  candidateCard: {
    width: "100%",
    textAlign: "left",
    borderRadius: "18px",
    padding: "14px",
    border: "1px solid rgba(171, 186, 207, 0.28)",
    background: "rgba(255,255,255,0.94)",
    cursor: "pointer",
  },
  candidateCardSelected: {
    border: "1px solid rgba(106, 137, 180, 0.55)",
    boxShadow: "0 14px 24px rgba(111, 146, 196, 0.12)",
  },
  candidateCardStrong: {
    background: "linear-gradient(180deg, rgba(246, 251, 255, 0.98), rgba(255, 245, 248, 0.96))",
  },
  emptyState: {
    borderRadius: "18px",
    padding: "18px",
    textAlign: "center",
    color: "#5a6c80",
    background: "rgba(255,255,255,0.9)",
    border: "1px dashed rgba(171, 186, 207, 0.45)",
    lineHeight: 1.6,
  },
  emptyCandidate: {
    borderRadius: "18px",
    padding: "16px",
    color: "#5a6c80",
    background: "rgba(255,255,255,0.9)",
    border: "1px dashed rgba(171, 186, 207, 0.45)",
    lineHeight: 1.6,
  },
  successBanner: {
    marginBottom: "12px",
    borderRadius: "16px",
    padding: "12px 14px",
    background: "rgba(220, 242, 228, 0.9)",
    border: "1px solid rgba(136, 193, 150, 0.35)",
    color: "#1e4f2d",
    fontWeight: 700,
  },
  errorBanner: {
    marginBottom: "12px",
    borderRadius: "16px",
    padding: "12px 14px",
    background: "rgba(255, 232, 232, 0.92)",
    border: "1px solid rgba(214, 128, 128, 0.35)",
    color: "#7a1d1d",
    fontWeight: 700,
  },
};




