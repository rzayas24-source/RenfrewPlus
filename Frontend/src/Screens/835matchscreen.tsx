import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { styles as adminStyles } from "./adminscreen";
import { WorklistBrandButton } from "../worklist/worklist";
import {
  commitSourceMatch,
  getSourceMatchDetail,
  getSourceMatchHistory,
  getSourceMatchWorklist,
  type SourceMatchCandidate,
  type SourceMatchDetail,
  type SourceMatchHistoryRow,
  type SourceMatchWorklistRow,
  type SourceMatchWorklistSummary,
} from "../api/match_api";

type MatchAction = {
  title: string;
  meta: string;
  tone: "blue" | "pink" | "mist" | "pearl";
  action: string;
  onClick: () => void;
};

type StatusTone = "blue" | "pink" | "mist" | "pearl" | "success" | "warning";

type StatusChip = {
  label: string;
  detail: string;
  tone: StatusTone;
};

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const unmatchedText = (value: string | null | undefined) => {
  const text = (value ?? "").trim();
  return text === "" ? "UNMATCHED" : text;
};

const formatAmount = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return "";
  const raw = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(raw)) return String(value);
  return moneyFmt.format(raw);
};

const formatDate = (value: string | null | undefined) => value ?? "";

const defaultStatusChip: StatusChip = {
  label: "Idle",
  detail: "Pick an action or a candidate row to get visible feedback here.",
  tone: "mist",
};

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
  const [selectedEdiId, setSelectedEdiId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SourceMatchDetail | null>(null);
  const [selectedEftIds, setSelectedEftIds] = useState<number[]>([]);
  const [selectedLockboxIds, setSelectedLockboxIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [queueRevision, setQueueRevision] = useState<string | null>(null);
  const [showMatches, setShowMatches] = useState(false);
  const [matchHistory, setMatchHistory] = useState<SourceMatchHistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [statusChip, setStatusChip] = useState<StatusChip>(defaultStatusChip);

  const loadWorklist = async (preferredId?: number | null) => {
    setError(null);
    setStatusChip({
      label: "Refreshing queue",
      detail: "Rebuilding the unmatched 835 worklist from the source tables.",
      tone: "blue",
    });

    try {
      const response = await getSourceMatchWorklist(75, queueRevision);
      const nextRevision = response.data.revision ?? null;
      setQueueRevision(nextRevision);

      if (response.data.changed === false) {
        setMessage("Queue already current.");
        setStatusChip({
          label: "Queue current",
          detail: "No incremental changes were returned for the worklist.",
          tone: "mist",
        });
        setLoading(false);
        return;
      }

      const nextWorklist = response.data.rows ?? [];
      const nextSummary = response.data.summary ?? null;
      const nextSelectedId =
        preferredId ??
        selectedEdiId ??
        nextWorklist[0]?.edi.id ??
        null;

      setSummary(nextSummary);
      setWorklist(nextWorklist);
      setMessage("Queue refreshed with incremental updates.");
      setStatusChip({
        label: "Queue refreshed",
        detail:
          nextSelectedId !== null
            ? `Loaded ${nextWorklist.length} queue row(s) and focused EDI #${nextSelectedId}.`
            : `Loaded ${nextWorklist.length} queue row(s).`,
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
    setShowMatches(false);
    setSelectedEdiId(ediId);
    setSelectedEftIds([]);
    setSelectedLockboxIds([]);
    setStatusChip({
      label: `Loading EDI #${ediId}`,
      detail: "Fetching candidate EFT and Lockbox rows for the selected source record.",
      tone: "blue",
    });

    try {
      const response = await getSourceMatchDetail(ediId);
      const nextDetail = response.data;
      setDetail(nextDetail);
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

  const loadMatchHistory = async () => {
    setError(null);
    setMessage(null);
    setLoadingHistory(true);
    setStatusChip({
      label: "Loading archive",
      detail: "Opening the committed 835 match history.",
      tone: "mist",
    });

    try {
      const response = await getSourceMatchHistory(100);
      setMatchHistory(response.data.rows ?? []);
      setShowMatches(true);
      setMessage(`Loaded ${response.data.count} committed 835 match(es).`);
      setStatusChip({
        label: "Archive loaded",
        detail: `${response.data.count} committed match(es) are visible in the archive.`,
        tone: "success",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load match history");
      setStatusChip({
        label: "Archive error",
        detail: "The committed match archive could not be loaded.",
        tone: "warning",
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const setSelectionStatus = (kind: "eft" | "lockbox", rowId: number, selected: boolean) => {
    setStatusChip({
      label: `${kind === "eft" ? "EFT" : "Lockbox"} #${rowId} ${selected ? "selected" : "cleared"}`,
      detail: selected
        ? "That candidate is now part of the current match set."
        : "That candidate was removed from the current selection.",
      tone: selected ? "success" : "mist",
    });
  };

  useEffect(() => {
    void loadWorklist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSelection = (kind: "eft" | "lockbox", row: SourceMatchCandidate) => {
    if (kind === "eft") {
      setSelectedEftIds((current) => {
        const selected = current.includes(row.id);
        setSelectionStatus("eft", row.id, !selected);
        return selected ? current.filter((value) => value !== row.id) : [...current, row.id];
      });
      return;
    }

    setSelectedLockboxIds((current) => {
      const selected = current.includes(row.id);
      setSelectionStatus("lockbox", row.id, !selected);
      return selected ? current.filter((value) => value !== row.id) : [...current, row.id];
    });
  };

  const commitSelectedMatch = async () => {
    if (selectedEdiId === null || !detail) {
      return;
    }

    const eftIds =
      selectedEftIds.length > 0
        ? selectedEftIds
        : detail.eftCandidates.filter((row) => row.strongMatch).map((row) => row.id);
    const lockboxIds =
      selectedLockboxIds.length > 0
        ? selectedLockboxIds
        : detail.lockboxCandidates.filter((row) => row.strongMatch).map((row) => row.id);

    if (eftIds.length === 0 && lockboxIds.length === 0) {
      setError("No strong or selected candidates are available for this EDI row.");
      return;
    }

    setCommitting(true);
    setError(null);
    setMessage(null);
    setStatusChip({
      label: `Committing EDI #${selectedEdiId}`,
      detail: "Sending the selected EFT and Lockbox rows to the commit endpoint.",
      tone: "blue",
    });

    try {
      const response = await commitSourceMatch({
        edi_id: selectedEdiId,
        eft_ids: eftIds,
        lockbox_ids: lockboxIds,
      });

      const matchedEft = response.data.eftMatched ?? 0;
      const matchedLockbox = response.data.lockboxMatched ?? 0;
      setMessage(
        `Done: committed EDI ${selectedEdiId}. ${matchedEft} EFT row(s) and ${matchedLockbox} Lockbox row(s) were marked matched.`
      );
      setStatusChip({
        label: "Commit complete",
        detail: `EDI ${selectedEdiId} matched ${matchedEft} EFT and ${matchedLockbox} Lockbox row(s).`,
        tone: "success",
      });
      await loadWorklist(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to commit match");
      setStatusChip({
        label: "Commit error",
        detail: "The selected match could not be committed.",
        tone: "warning",
      });
    } finally {
      setCommitting(false);
    }
  };

  const actions: MatchAction[] = [
    {
      title: "Refresh Queue",
      meta: "Rebuild the unmatched EDI queue from the source tables.",
      tone: "blue",
      action: "Reload",
      onClick: () => void loadWorklist(selectedEdiId),
    },
    {
      title: "Clear Picks",
      meta: "Drop the currently selected EFT and Lockbox candidates.",
      tone: "mist",
      action: "Clear",
      onClick: () => {
        setSelectedEftIds([]);
        setSelectedLockboxIds([]);
        setMessage("Candidate selections cleared.");
        setStatusChip({
          label: "Picks cleared",
          detail: "The current EFT and Lockbox selections were reset.",
          tone: "mist",
        });
      },
    },
    {
      title: "View Matches",
      meta: "Open the committed 835 match archive and review what has already been matched.",
      tone: "pearl",
      action: showMatches ? "Viewing" : "Open",
      onClick: () => void loadMatchHistory(),
    },
    {
      title: "Cash Workspace",
      meta: "Jump back to the cash shell if you need the broader flow.",
      tone: "pink",
      action: "Open Cash",
      onClick: () => {
        setStatusChip({
          label: "Opening cash",
          detail: "Switching to the cash workspace.",
          tone: "pink",
        });
        navigate("/cash");
      },
    },
    {
      title: "Site Review",
      meta: "Use the matching side bar to move into site follow-up.",
      tone: "pearl",
      action: "Open Site Review",
      onClick: () => {
        setStatusChip({
          label: "Opening site review",
          detail: "Switching to the site review workspace.",
          tone: "pearl",
        });
        navigate("/site-review");
      },
    },
  ];

  const strongCount = detail
    ? detail.eftCandidates.filter((row) => row.strongMatch).length +
      detail.lockboxCandidates.filter((row) => row.strongMatch).length
    : 0;
  const matchedCount = detail ? detail.matchedEft.length + detail.matchedLockbox.length : 0;

  return (
    <main style={adminStyles.shell}>
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
          Source-driven 835 matching. We look at EDI first, then confirm against unmatched EFT and Lockbox rows.
        </p>

        <nav style={adminStyles.navStack} aria-label="835 match navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/cash")}>
            <span style={adminStyles.navButtonLabel}>Back</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Queue</div>
          <div style={adminStyles.sidebarCardValue}>
            {summary ? `${summary.ediUnmatched} EDI rows` : "Loading queue"}
          </div>
          <div style={adminStyles.sidebarCardMeta}>
            Strong hits can be committed. Close matches stay in the queue for manual review.
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>835 Match screen</div>
            <p style={adminStyles.subtitle}>
              A source-first workspace for matching EDI against Lockbox and EFT. Strong hits can be committed, while close
              matches stay in the queue for review.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.primaryButton} type="button" onClick={() => void loadWorklist(selectedEdiId)}>
                Refresh Queue
              </button>
              <button
                style={adminStyles.secondaryButton}
                type="button"
                onClick={commitSelectedMatch}
                disabled={committing || selectedEdiId === null || !detail}
              >
                {committing ? "Committing..." : "Commit"}
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
                  {statusChip.label}
                </span>
                <span
                  style={{
                    ...adminStyles.statusDot,
                    ...statusToneStyles[statusChip.tone].dot,
                  }}
                />
              </div>
              <div style={adminStyles.heroStatusTitle}>Match what is known first</div>
              <div style={adminStyles.heroStatusText}>{statusChip.detail}</div>
            </div>
          </div>
        </section>

        <section style={adminStyles.statsGrid}>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>EDI</div>
            <div style={adminStyles.statValue}>{summary ? summary.ediUnmatched : "..."}</div>
            <div style={adminStyles.statDetail}>Unmatched source rows waiting for review.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>EFT</div>
            <div style={adminStyles.statValue}>{summary ? summary.eftUnmatched : "..."}</div>
            <div style={adminStyles.statDetail}>Available payment rows in the source of truth.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Lockbox</div>
            <div style={adminStyles.statValue}>{summary ? summary.lockboxUnmatched : "..."}</div>
            <div style={adminStyles.statDetail}>Legacy bank rows still open for matching.</div>
          </article>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Match actions</div>
              <h2 style={adminStyles.sectionTitle}>Fast actions for queue control and source-driven matching</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              {detail
                ? `${strongCount} strong candidate(s) found. Close matches stay visible for manual review.`
                : "Pick an EDI row to inspect strong and close candidates."}
            </div>
          </div>

          <div style={adminStyles.widgetGrid}>
            {actions.map((action) => (
              <button
                key={action.title}
                type="button"
                onClick={action.onClick}
                style={{
                  ...adminStyles.widgetCard,
                  ...matchToneStyles[action.tone],
                }}
              >
                <div style={adminStyles.widgetTop}>
                  <div style={adminStyles.widgetBadge}>{action.title}</div>
                </div>
                <div style={adminStyles.widgetBody}>
                  <div style={adminStyles.widgetTitle}>{action.title}</div>
                  <div style={adminStyles.widgetMeta}>{action.meta}</div>
                </div>
                <div style={adminStyles.widgetAction}>{action.action}</div>
              </button>
            ))}
          </div>
        </section>

        <section style={matchStyles.workspace}>
          <article style={matchStyles.panel}>
            <div style={matchStyles.panelHeader}>
              <div>
                <div style={adminStyles.sectionKicker}>EDI worklist</div>
                <h2 style={adminStyles.sectionTitle}>Unmatched source rows</h2>
              </div>
              <div style={matchStyles.panelMeta}>
                {loading ? "Loading..." : `${worklist.length} visible`}
              </div>
            </div>

            {error && <div style={matchStyles.errorBanner}>{error}</div>}
            {message && <div style={matchStyles.successBanner}>{message}</div>}

            <div style={matchStyles.listScroll}>
              <div style={matchStyles.list}>
                {worklist.map((row) => {
                  const selected = row.edi.id === selectedEdiId;
                  return (
                    <div key={row.edi.id} style={matchStyles.rowWrap}>
                      <button
                        type="button"
                        onClick={() => void loadDetail(row.edi.id)}
                        style={{
                          ...matchStyles.rowCard,
                          ...(selected ? matchStyles.rowCardSelected : {}),
                        }}
                      >
                        <div style={matchStyles.rowTop}>
                          <div style={matchStyles.rowId}>EDI #{row.edi.id}</div>
                          <div style={matchStyles.rowBadge}>
                            {row.strongCandidateCount > 0
                              ? "Strong hit"
                              : row.closeCandidateCount > 0
                                ? "Close match"
                                : "Review"}
                          </div>
                        </div>
                        <div style={matchStyles.rowGrid}>
                          <div>
                            <div style={matchStyles.rowLabel}>Check</div>
                            <div style={matchStyles.rowValue}>{row.edi.checkNumber || "(blank)"}</div>
                          </div>
                          <div>
                            <div style={matchStyles.rowLabel}>Amount</div>
                            <div style={matchStyles.rowValue}>{formatAmount(row.edi.amount)}</div>
                          </div>
                          <div>
                            <div style={matchStyles.rowLabel}>Date</div>
                            <div style={matchStyles.rowValue}>{formatDate(row.edi.date)}</div>
                          </div>
                          <div>
                            <div style={matchStyles.rowLabel}>Matches</div>
                            <div style={matchStyles.rowValue}>
                              {row.eftCandidateCount} EFT / {row.lockboxCandidateCount} Lockbox
                            </div>
                          </div>
                        </div>
                        <div style={matchStyles.rowFooter}>
                          <span>Batch {row.edi.batchnum || "-"}</span>
                          <span>Trans {row.edi.transnum || "-"}</span>
                          <span>Status {unmatchedText(row.edi.matchstatus)}</span>
                        </div>
                      </button>

                      {selected && (
                        <div style={matchStyles.inlineDetailCard}>
                          <div style={matchStyles.inlineDetailHeader}>
                            Selected row detail
                            <span style={matchStyles.inlineDetailPill}>
                              {row.strongCandidateCount > 0
                                ? `${row.strongCandidateCount} strong`
                                : `${row.closeCandidateCount} close`}
                            </span>
                          </div>
                          <div style={matchStyles.inlineDetailGrid}>
                            <span>Check {row.edi.checkNumber || "(blank)"}</span>
                            <span>Amount {formatAmount(row.edi.amount)}</span>
                            <span>Date {formatDate(row.edi.date)}</span>
                            <span>Status {unmatchedText(row.edi.matchstatus)}</span>
                          </div>
                          <div style={matchStyles.inlineDetailMeta}>
                            {row.closeCandidateCount > 0
                              ? `${row.closeCandidateCount} close match(es) are available for manual review.`
                              : "Strong matches are ready to commit."}
                            {matchedCount > 0 ? ` ${matchedCount} committed match(es) are visible in the detail panel.` : ""}
                          </div>
                          <button style={matchStyles.inlineCommitButton} type="button" onClick={commitSelectedMatch}>
                            Commit
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!loading && !worklist.length && (
                  <div style={matchStyles.emptyState}>
                    No unmatched EDI rows with candidates are waiting. Once new ETL lands, they will appear here.
                  </div>
                )}
              </div>
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
              <div style={matchStyles.panelMeta}>
                {showMatches
                  ? `${matchHistory.length} committed match(es)`
                  : detail
                    ? `Check ${detail.edi.checkNumber || "(blank)"}`
                    : "No row selected"}
              </div>
            </div>

            {showMatches ? (
              <div style={matchStyles.detailScroll}>
                <div style={matchStyles.historyPanel}>
                  <div style={matchStyles.detailHeader}>835 match archive</div>
                  <div style={matchStyles.matchedMeta}>
                    {loadingHistory
                      ? "Loading committed match history..."
                      : "These are the EDI rows already committed to EFT and Lockbox."}
                  </div>
                  {matchHistory.length ? (
                    <div style={matchStyles.historyList}>
                      {matchHistory.map((row) => (
                        <button
                          key={`history-${row.edi.id}`}
                          type="button"
                          style={matchStyles.historyCard}
                          onClick={() => void loadDetail(row.edi.id)}
                        >
                          <div style={matchStyles.rowTop}>
                            <div style={matchStyles.rowId}>EDI #{row.edi.id}</div>
                            <div style={matchStyles.rowBadge}>Matched</div>
                          </div>
                          <div style={matchStyles.rowGrid}>
                            <div>
                              <div style={matchStyles.rowLabel}>Check</div>
                              <div style={matchStyles.rowValue}>{row.edi.checkNumber || "(blank)"}</div>
                            </div>
                            <div>
                              <div style={matchStyles.rowLabel}>Amount</div>
                              <div style={matchStyles.rowValue}>{formatAmount(row.edi.amount)}</div>
                            </div>
                            <div>
                              <div style={matchStyles.rowLabel}>Date</div>
                              <div style={matchStyles.rowValue}>{formatDate(row.edi.date)}</div>
                            </div>
                            <div>
                              <div style={matchStyles.rowLabel}>Matched</div>
                              <div style={matchStyles.rowValue}>
                                {row.matchedEft.length} EFT / {row.matchedLockbox.length} Lockbox
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={matchStyles.emptyState}>No committed 835 matches have been recorded yet.</div>
                  )}
                  <button
                    style={matchStyles.inlineCommitButton}
                    type="button"
                    onClick={() => {
                      setShowMatches(false);
                      if (detail) {
                        void loadDetail(detail.edi.id);
                      }
                    }}
                  >
                    Back to Detail
                  </button>
                </div>
              </div>
            ) : detail ? (
              <div style={matchStyles.detailScroll}>
                <div style={matchStyles.detailStack}>
                  <div style={matchStyles.detailCard}>
                    <div style={matchStyles.detailHeader}>Selected EDI row</div>
                    <div style={matchStyles.detailGrid}>
                      <div>
                        <div style={matchStyles.rowLabel}>Check</div>
                        <div style={matchStyles.detailValue}>{detail.edi.checkNumber || "(blank)"}</div>
                      </div>
                      <div>
                        <div style={matchStyles.rowLabel}>Amount</div>
                        <div style={matchStyles.detailValue}>{formatAmount(detail.edi.amount)}</div>
                      </div>
                      <div>
                        <div style={matchStyles.rowLabel}>Date</div>
                        <div style={matchStyles.detailValue}>{formatDate(detail.edi.date)}</div>
                      </div>
                      <div>
                        <div style={matchStyles.rowLabel}>Status</div>
                        <div style={matchStyles.detailValue}>{unmatchedText(detail.edi.matchstatus)}</div>
                      </div>
                    </div>
                  </div>

                  <div style={matchStyles.matchedSection}>
                    <div style={matchStyles.detailHeader}>Matched rows</div>
                    <div style={matchStyles.matchedMeta}>
                      {matchedCount > 0
                        ? "These rows are already marked MATCHED for the selected EDI check."
                        : "No committed rows are recorded for this EDI yet."}
                    </div>
                    <div style={matchStyles.matchedColumns}>
                      <div style={matchStyles.matchedColumn}>
                        <div style={matchStyles.candidateHeader}>EFT matched</div>
                        {detail.matchedEft.length ? (
                          detail.matchedEft.map((row) => (
                            <div key={`matched-eft-${row.id}`} style={matchStyles.matchedCard}>
                              <div style={matchStyles.rowTop}>
                                <div style={matchStyles.rowId}>EFT #{row.id}</div>
                                <div style={matchStyles.rowBadge}>Matched</div>
                              </div>
                              <div style={matchStyles.rowGrid}>
                                <div>
                                  <div style={matchStyles.rowLabel}>Check</div>
                                  <div style={matchStyles.rowValue}>{row.checkNumber || "(blank)"}</div>
                                </div>
                                <div>
                                  <div style={matchStyles.rowLabel}>Amount</div>
                                  <div style={matchStyles.rowValue}>{formatAmount(row.amount)}</div>
                                </div>
                                <div>
                                  <div style={matchStyles.rowLabel}>Date</div>
                                  <div style={matchStyles.rowValue}>{formatDate(row.date)}</div>
                                </div>
                                <div>
                                  <div style={matchStyles.rowLabel}>Status</div>
                                  <div style={matchStyles.rowValue}>{unmatchedText(row.matchstatus)}</div>
                                </div>
                              </div>
                              <div style={matchStyles.rowFooter}>
                                <span>Batch {row.batchnum || "-"}</span>
                                <span>Trans {row.transnum || "-"}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={matchStyles.emptyMatched}>No EFT matches recorded yet.</div>
                        )}
                      </div>

                      <div style={matchStyles.matchedColumn}>
                        <div style={matchStyles.candidateHeader}>Lockbox matched</div>
                        {detail.matchedLockbox.length ? (
                          detail.matchedLockbox.map((row) => (
                            <div key={`matched-lockbox-${row.id}`} style={matchStyles.matchedCard}>
                              <div style={matchStyles.rowTop}>
                                <div style={matchStyles.rowId}>Lockbox #{row.id}</div>
                                <div style={matchStyles.rowBadge}>Matched</div>
                              </div>
                              <div style={matchStyles.rowGrid}>
                                <div>
                                  <div style={matchStyles.rowLabel}>Check</div>
                                  <div style={matchStyles.rowValue}>{row.checkNumber || "(blank)"}</div>
                                </div>
                                <div>
                                  <div style={matchStyles.rowLabel}>Amount</div>
                                  <div style={matchStyles.rowValue}>{formatAmount(row.amount)}</div>
                                </div>
                                <div>
                                  <div style={matchStyles.rowLabel}>Date</div>
                                  <div style={matchStyles.rowValue}>{formatDate(row.date)}</div>
                                </div>
                                <div>
                                  <div style={matchStyles.rowLabel}>Status</div>
                                  <div style={matchStyles.rowValue}>{unmatchedText(row.matchstatus)}</div>
                                </div>
                              </div>
                              <div style={matchStyles.rowFooter}>
                                <span>Batch {row.batchnum || "-"}</span>
                                <span>Trans {row.transnum || "-"}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={matchStyles.emptyMatched}>No Lockbox matches recorded yet.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={matchStyles.splitGrid}>
                    <div style={matchStyles.candidateColumn}>
                      <div style={matchStyles.candidateHeader}>EFT candidates</div>
                      {detail.eftCandidates.length ? (
                        detail.eftCandidates.map((row) => {
                          const selected = selectedEftIds.includes(row.id);
                          return (
                            <button
                              key={`eft-${row.id}`}
                              type="button"
                              onClick={() => toggleSelection("eft", row)}
                              style={{
                                ...matchStyles.candidateCard,
                                ...(selected ? matchStyles.candidateCardSelected : {}),
                                ...(row.strongMatch ? matchStyles.candidateCardStrong : {}),
                              }}
                            >
                              <div style={matchStyles.rowTop}>
                                <div style={matchStyles.rowId}>EFT #{row.id}</div>
                                <div style={matchStyles.rowBadge}>
                                  {row.strongMatch ? "Strong hit" : row.closeMatch ? "Close match" : row.reason}
                                </div>
                              </div>
                              <div style={matchStyles.rowGrid}>
                                <div>
                                  <div style={matchStyles.rowLabel}>Check</div>
                                  <div style={matchStyles.rowValue}>{row.checkNumber || "(blank)"}</div>
                                </div>
                                <div>
                                  <div style={matchStyles.rowLabel}>Amount</div>
                                  <div style={matchStyles.rowValue}>{formatAmount(row.amount)}</div>
                                </div>
                                <div>
                                  <div style={matchStyles.rowLabel}>Date</div>
                                  <div style={matchStyles.rowValue}>{formatDate(row.date)}</div>
                                </div>
                                <div>
                                  <div style={matchStyles.rowLabel}>Status</div>
                                  <div style={matchStyles.rowValue}>{unmatchedText(row.matchstatus)}</div>
                                </div>
                              </div>
                              <div style={matchStyles.rowFooter}>
                                <span>Batch {row.batchnum || "-"}</span>
                                <span>Trans {row.transnum || "-"}</span>
                                <span>{selected ? "Selected" : "Click to select"}</span>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div style={matchStyles.emptyCandidate}>No EFT candidates found for this EDI row.</div>
                      )}
                    </div>

                    <div style={matchStyles.candidateColumn}>
                      <div style={matchStyles.candidateHeader}>Lockbox candidates</div>
                      {detail.lockboxCandidates.length ? (
                        detail.lockboxCandidates.map((row) => {
                          const selected = selectedLockboxIds.includes(row.id);
                          return (
                            <button
                              key={`lockbox-${row.id}`}
                              type="button"
                              onClick={() => toggleSelection("lockbox", row)}
                              style={{
                                ...matchStyles.candidateCard,
                                ...(selected ? matchStyles.candidateCardSelected : {}),
                                ...(row.strongMatch ? matchStyles.candidateCardStrong : {}),
                              }}
                            >
                              <div style={matchStyles.rowTop}>
                                <div style={matchStyles.rowId}>Lockbox #{row.id}</div>
                                <div style={matchStyles.rowBadge}>
                                  {row.strongMatch ? "Strong hit" : row.closeMatch ? "Close match" : row.reason}
                                </div>
                              </div>
                              <div style={matchStyles.rowGrid}>
                                <div>
                                  <div style={matchStyles.rowLabel}>Check</div>
                                  <div style={matchStyles.rowValue}>{row.checkNumber || "(blank)"}</div>
                                </div>
                                <div>
                                  <div style={matchStyles.rowLabel}>Amount</div>
                                  <div style={matchStyles.rowValue}>{formatAmount(row.amount)}</div>
                                </div>
                                <div>
                                  <div style={matchStyles.rowLabel}>Date</div>
                                  <div style={matchStyles.rowValue}>{formatDate(row.date)}</div>
                                </div>
                                <div>
                                  <div style={matchStyles.rowLabel}>Status</div>
                                  <div style={matchStyles.rowValue}>{unmatchedText(row.matchstatus)}</div>
                                </div>
                              </div>
                              <div style={matchStyles.rowFooter}>
                                <span>Batch {row.batchnum || "-"}</span>
                                <span>Trans {row.transnum || "-"}</span>
                                <span>{selected ? "Selected" : "Click to select"}</span>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div style={matchStyles.emptyCandidate}>No Lockbox candidates found for this EDI row.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={matchStyles.emptyState}>
                Select an unmatched EDI row on the left to inspect candidate EFT and Lockbox matches.
              </div>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}

const matchToneStyles: Record<MatchAction["tone"], CSSProperties> = {
  blue: {
    background: "linear-gradient(145deg, rgba(212, 232, 255, 0.95), rgba(255, 255, 255, 0.92))",
  },
  pink: {
    background: "linear-gradient(145deg, rgba(255, 225, 236, 0.96), rgba(255, 255, 255, 0.92))",
  },
  mist: {
    background: "linear-gradient(145deg, rgba(231, 240, 247, 0.96), rgba(255, 255, 255, 0.92))",
  },
  pearl: {
    background: "linear-gradient(145deg, rgba(248, 244, 239, 0.96), rgba(255, 255, 255, 0.92))",
  },
};

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
  list: {
    display: "grid",
    gap: "12px",
  },
  rowWrap: {
    display: "grid",
    gap: "10px",
  },
  listScroll: {
    display: "grid",
    gap: "12px",
    minHeight: 0,
    overflowY: "auto",
    paddingRight: "6px",
    flex: "1 1 auto",
  },
  rowCard: {
    width: "100%",
    textAlign: "left",
    borderRadius: "20px",
    padding: "16px",
    border: "1px solid rgba(171, 186, 207, 0.28)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,253,0.92))",
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(52, 84, 120, 0.05)",
  },
  rowCardSelected: {
    border: "1px solid rgba(138, 168, 214, 0.65)",
    boxShadow: "0 16px 28px rgba(111, 146, 196, 0.12)",
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
  inlineDetailCard: {
    borderRadius: "18px",
    padding: "14px",
    background: "linear-gradient(145deg, rgba(244, 249, 255, 0.98), rgba(255, 247, 250, 0.96))",
    border: "1px solid rgba(138, 168, 214, 0.32)",
    boxShadow: "0 12px 22px rgba(111, 146, 196, 0.10)",
    display: "grid",
    gap: "10px",
  },
  inlineDetailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    fontSize: "13px",
    fontWeight: 800,
    color: "#17324f",
  },
  inlineDetailPill: {
    borderRadius: "999px",
    padding: "4px 10px",
    background: "rgba(225, 235, 247, 0.95)",
    color: "#365067",
    fontSize: "11px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  inlineDetailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px 12px",
    fontSize: "12px",
    color: "#53697f",
    fontWeight: 700,
  },
  inlineDetailMeta: {
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#496077",
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




