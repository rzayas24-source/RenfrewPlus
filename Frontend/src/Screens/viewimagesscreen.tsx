import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminShell, styles as adminStyles } from "../components/AdminShell";
import { API_BASE } from "../config/apiBase";
import { styles as cashStyles } from "./cashscreen";
import { createPortal } from "react-dom";
import {
  buildImagingFileOpenUrl,
  commitImagingExactMatches,
  confirmImagingBalsheetLink,
  deleteImagingBalsheetLink,
  findImagingLockboxMatches,
  getImagingBalsheetAssociations,
  refreshImagingBalsheetAssociations,
  type ImagingBalsheetAssociationResponse,
  type ImagingBalsheetAssociationRow,
  type ImagingDocumentSuggestion,
} from "../api/balsheet_api";

type ImagingPhase = "idle" | "loaded" | "matched" | "review" | "lockbox";
type ImagingReviewFile = {
  filePath: string;
  fileName: string;
  source: "linked" | "suggested";
  matchMethod?: string;
  confidence?: number;
  bookmarkPage?: number;
};

export default function ViewImagesScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDate = searchParams.get("day") ?? "";

  const [postingDate, setPostingDate] = useState(() => displayDateToIso(initialDate));
  const [phase, setPhase] = useState<ImagingPhase>(initialDate ? "loaded" : "idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ImagingBalsheetAssociationResponse | null>(null);
  const [previewPath, setPreviewPath] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewPage, setPreviewPage] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [lockboxRowId, setLockboxRowId] = useState("");
  const [lockboxError, setLockboxError] = useState<string | null>(null);
  const [actionDetail, setActionDetail] = useState<string | null>(null);

  useEffect(() => {
    if (!initialDate) {
      return;
    }

    void loadDate(initialDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDate]);

  const phaseTitle = useMemo(() => {
    if (phase === "matched") return "Matches refreshed";
    if (phase === "review") return "Reviewing rows";
    if (phase === "lockbox") return "Lockbox image association";
    if (phase === "loaded") return "Date loaded";
    return "Awaiting date";
  }, [phase]);

  const exactMatchCount = useMemo(
    () => data?.rows.filter((row) => row.linkedFiles.length === 0 && row.matches[0]?.confidence === 1).length ?? 0,
    [data]
  );

  const lockboxRows = useMemo(
    () => data?.rows.filter((row) => row.type.trim().toLowerCase() === "lockbox") ?? [],
    [data]
  );

  const allRows = useMemo(() => data?.rows ?? [], [data]);

  const nonReviewGridStyle =
    phase === "lockbox"
      ? {
          ...viewImagesStyles.grid,
          gridTemplateColumns: "minmax(0, 1fr)",
        }
      : {
          ...viewImagesStyles.grid,
          gridTemplateColumns: "minmax(0, 1fr)",
        };

  const reviewRowsByType = useMemo(() => {
    const grouped = new Map<string, ImagingBalsheetAssociationRow[]>();

    for (const row of data?.rows ?? []) {
      const typeLabel = row.type.trim() || "Unspecified";
      const bucket = grouped.get(typeLabel) ?? [];
      bucket.push(row);
      grouped.set(typeLabel, bucket);
    }

    return Array.from(grouped.entries())
      .map(([type, rows]) => ({
        type,
        rows,
      }))
      .sort((left, right) => left.type.localeCompare(right.type));
  }, [data]);

  const selectedLockboxRow = useMemo(() => {
    if (!lockboxRows.length) {
      return null;
    }

    return lockboxRows.find((row) => row.entryId === lockboxRowId) ?? lockboxRows[0];
  }, [lockboxRows, lockboxRowId]);

  useEffect(() => {
    if (phase !== "lockbox" || !lockboxRows.length) {
      return;
    }

    const lockboxCandidate = lockboxRows.find((row) => row.linkedFiles.length === 0) ?? lockboxRows[0];
    if (lockboxCandidate && lockboxCandidate.entryId !== lockboxRowId) {
      setLockboxRowId(lockboxCandidate.entryId);
      setLockboxError(null);
    }
  }, [lockboxRows, lockboxRowId, phase]);

  async function loadDate(nextDate = postingDate) {
    const normalizedDate = isoDateToDisplay(nextDate);
    if (!normalizedDate) {
      setError("Enter a date first.");
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await getImagingBalsheetAssociations(normalizedDate);
      setData(response.data);
      setPhase("loaded");
      setSearchParams({ day: normalizedDate }, { replace: true });
    } catch (loadError) {
      setData(null);
      setError(formatImagingError(loadError, "GET", `${API_BASE}/imaging/balsheet-associations?posting_date=${encodeURIComponent(normalizedDate)}`));
    } finally {
      setLoading(false);
    }
  }

  async function refreshMatches() {
    const normalizedDate = isoDateToDisplay(postingDate);
    if (!normalizedDate) {
      setError("Enter a date first.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await refreshImagingBalsheetAssociations(normalizedDate);
      setData(response.data);
      setPhase("matched");
      setSearchParams({ day: normalizedDate }, { replace: true });
      setActionDetail(`Auto Match refreshed ${response.data.rowCount} row${response.data.rowCount === 1 ? "" : "s"} from ${response.data.indexCount} indexed file${response.data.indexCount === 1 ? "" : "s"}.`);
    } catch (refreshError) {
      setError(
        formatImagingError(
          refreshError,
          "POST",
          `${API_BASE}/imaging/balsheet-associations/refresh (posting_date=${encodeURIComponent(normalizedDate)})`
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function commitExactMatches() {
    const normalizedDate = isoDateToDisplay(postingDate);
    if (!normalizedDate) {
      setError("Enter a date first.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await commitImagingExactMatches(normalizedDate);
      setData(response.data.data);
      setPhase("review");
      setSearchParams({ day: normalizedDate }, { replace: true });
      setActionDetail(
        `Commit 100% committed ${response.data.committedCount} exact match${response.data.committedCount === 1 ? "" : "es"}, skipped ${response.data.skippedCount}.`
      );
      const firstCommittedRow = response.data.data.rows.find((row) => row.linkedFiles.length > 0);
      const firstCommittedFile = firstCommittedRow?.linkedFiles[0];
      if (firstCommittedFile) {
        setPreviewPath(firstCommittedFile.filePath);
        setPreviewTitle(firstCommittedFile.fileName);
        setIsPreviewOpen(true);
      }
    } catch (commitError) {
      setError(
        formatImagingError(
          commitError,
          "POST",
          `${API_BASE}/imaging/balsheet-associations/confirm-exact (posting_date=${encodeURIComponent(normalizedDate)})`
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmMatch(row: ImagingBalsheetAssociationRow, match: ImagingDocumentSuggestion) {
    setLoading(true);
    setError(null);
    try {
      await confirmImagingBalsheetLink({
        entryId: row.entryId,
        filePath: match.filePath,
        checkNumber: row.checkNumber,
        matchMethod: match.matchMethod,
        confidence: match.confidence,
        postingDate: data?.postingDate ?? isoDateToDisplay(postingDate),
        payer: row.payer,
        amount: row.amount,
      });
      await loadDate(displayDateToIso(data?.postingDate ?? isoDateToDisplay(postingDate)));
      setPhase("review");
      setPreviewPath(match.filePath);
      setPreviewTitle(match.fileName);
    } catch (confirmError) {
      setError(
        formatImagingError(confirmError, "POST", `${API_BASE}/imaging/balsheet-links/confirm -> ${match.filePath}`)
      );
    } finally {
      setLoading(false);
    }
  }

  async function findLockboxMatches() {
    const normalizedDate = isoDateToDisplay(data?.postingDate ?? postingDate);
    if (!normalizedDate) {
      setLockboxError("Load a date first.");
      return;
    }

    setLoading(true);
    setLockboxError(null);
    try {
      const response = await findImagingLockboxMatches(normalizedDate);
      setData(response.data);
      setPhase("lockbox");
      setSearchParams({ day: normalizedDate }, { replace: true });
      const firstRecommendedRow = response.data.rows.find(
        (row) => row.type.trim().toLowerCase() === "lockbox" && row.recommendations.length > 0
      );
      const firstRecommendation = firstRecommendedRow?.recommendations[0];
      if (firstRecommendation) {
        setPreviewDocument(firstRecommendation.filePath, firstRecommendation.fileName, firstRecommendation.bookmarkPage || 0);
      }
    } catch (findError) {
      setLockboxError(
        formatImagingError(
          findError,
          "POST",
          `${API_BASE}/imaging/lockbox-associations/find-matches (posting_date=${encodeURIComponent(normalizedDate)})`
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function getLockboxPrimaryDocument(row: ImagingBalsheetAssociationRow) {
    return row.linkedFiles[0] ?? row.recommendations[0] ?? row.matches[0] ?? null;
  }

  async function previewLockboxRow(row: ImagingBalsheetAssociationRow) {
    const file = getLockboxPrimaryDocument(row);
    if (!file) {
      setLockboxError("No document is available for this row.");
      return;
    }

    setLockboxError(null);
    setPreviewDocument(file.filePath, file.fileName, file.bookmarkPage || 0);
    setIsPreviewOpen(true);
    setPhase("lockbox");
  }

  async function associateLockboxRow(row: ImagingBalsheetAssociationRow) {
    const suggested = row.recommendations[0] ?? row.matches[0];
    if (!suggested) {
      setLockboxError("No suggested document is available for this row.");
      return;
    }

    if (row.linkedFiles.length > 0) {
      setLockboxError("This row is already associated. Disassociate it first if you want to replace the link.");
      return;
    }

    setLoading(true);
    setLockboxError(null);
    try {
      const lockboxImageDate = data?.postingDate ?? isoDateToDisplay(postingDate);
      await confirmImagingBalsheetLink({
        entryId: row.entryId,
        filePath: suggested.filePath,
        checkNumber: row.checkNumber,
        matchMethod: suggested.matchMethod,
        confidence: suggested.confidence,
        bookmarkPage: suggested.bookmarkPage,
        bookmarkTitle: suggested.bookmarkTitle,
        sourceQuery: row.payer || row.checkNumber,
        postingDate: lockboxImageDate,
        lockboxImageDate,
        payer: row.payer,
        amount: row.amount,
      });
      await loadDate(displayDateToIso(data?.postingDate ?? isoDateToDisplay(postingDate)));
      setPhase("lockbox");
    } catch (associateError) {
      setLockboxError(
        formatImagingError(
          associateError,
          "POST",
          `${API_BASE}/imaging/balsheet-links/confirm -> ${suggested.filePath}`
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function autoAssociateHighConfidenceLockbox() {
    const normalizedDate = isoDateToDisplay(data?.postingDate ?? postingDate);
    if (!normalizedDate) {
      setLockboxError("Load a date first.");
      return;
    }

    const candidates = lockboxRows.filter(
      (row) => row.linkedFiles.length === 0 && (row.recommendations[0]?.confidence ?? row.matches[0]?.confidence ?? 0) >= 0.94
    );

    if (candidates.length === 0) {
      setLockboxError("No lockbox rows reached the 94% threshold.");
      return;
    }

    setLoading(true);
    setLockboxError(null);
    try {
      const lockboxImageDate = normalizedDate;
      for (const row of candidates) {
        const suggested = row.recommendations[0] ?? row.matches[0];
        if (!suggested) {
          continue;
        }

        await confirmImagingBalsheetLink({
          entryId: row.entryId,
          filePath: suggested.filePath,
          checkNumber: row.checkNumber,
          matchMethod: suggested.matchMethod,
          confidence: suggested.confidence,
          bookmarkPage: suggested.bookmarkPage,
          bookmarkTitle: suggested.bookmarkTitle,
          sourceQuery: row.payer || row.checkNumber,
          postingDate: lockboxImageDate,
          lockboxImageDate,
          payer: row.payer,
          amount: row.amount,
        });
      }

      await loadDate(displayDateToIso(normalizedDate));
      setPhase("lockbox");
    } catch (autoAssociateError) {
      setLockboxError(
        formatImagingError(
          autoAssociateError,
          "POST",
          `${API_BASE}/imaging/balsheet-links/confirm (batch auto-associate >=94%)`
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function disassociateLockboxRow(row: ImagingBalsheetAssociationRow) {
    const linked = row.linkedFiles[0];
    if (!linked) {
      setLockboxError("This row does not have a confirmed association to remove.");
      return;
    }

    setLoading(true);
    setLockboxError(null);
    try {
      await deleteImagingBalsheetLink(linked.linkId);
      await loadDate(displayDateToIso(data?.postingDate ?? isoDateToDisplay(postingDate)));
      setPhase("lockbox");
    } catch (disassociateError) {
      setLockboxError(
        formatImagingError(
          disassociateError,
          "DELETE",
          `${API_BASE}/imaging/balsheet-links/${encodeURIComponent(linked.linkId)}`
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function setPreviewDocument(filePath: string, fileName: string, page = 0) {
    setPreviewPath(filePath);
    setPreviewTitle(fileName);
    setPreviewPage(page);
  }

  function openDocument(filePath: string, fileName: string, page = 0, nextPhase: ImagingPhase = "review") {
    setPreviewDocument(filePath, fileName, page);
    setIsPreviewOpen(true);
    setPhase(nextPhase);
  }

  function getReviewFile(row: ImagingBalsheetAssociationRow): ImagingReviewFile | null {
    const linked = row.linkedFiles[0];
    if (linked) {
      return {
        filePath: linked.filePath,
        fileName: linked.fileName,
        source: "linked",
        matchMethod: linked.matchMethod,
        confidence: linked.confidence,
        bookmarkPage: linked.bookmarkPage,
      };
    }

    const match = row.matches[0];
    if (match) {
      return {
        filePath: match.filePath,
        fileName: match.fileName,
        source: "suggested",
        matchMethod: match.matchMethod,
        confidence: match.confidence,
        bookmarkPage: match.bookmarkPage,
      };
    }

    return null;
  }

  const sidebarActions = (
    <div style={viewImagesStyles.sidebarStack}>
      <label style={viewImagesStyles.sidebarDateField}>
        <span style={viewImagesStyles.dateLabel}>Date</span>
        <input
          type="date"
          value={postingDate}
          onChange={(event) => setPostingDate(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void loadDate();
            }
          }}
          autoComplete="off"
          style={viewImagesStyles.sidebarDateInput}
        />
        <span style={viewImagesStyles.dateHelp}>Pick the day to load Balsheet rows.</span>
      </label>

      <button
        type="button"
        onClick={() => void loadDate()}
        style={{
          ...adminStyles.navButton,
          ...(phase === "loaded" ? adminStyles.navButtonBack : null),
        }}
        disabled={loading}
      >
        <span style={adminStyles.navButtonLabel}>Load Date</span>
        <span style={adminStyles.navButtonGlyph}>&gt;</span>
      </button>

      <button
        type="button"
        onClick={() => void refreshMatches()}
        style={{
          ...adminStyles.navButton,
          ...(phase === "matched" ? adminStyles.navButtonBack : null),
        }}
        disabled={loading || !postingDate.trim()}
      >
        <span style={adminStyles.navButtonLabel}>Auto Match</span>
        <span style={adminStyles.navButtonGlyph}>&gt;</span>
      </button>

      <button
        type="button"
        onClick={() => void commitExactMatches()}
        style={adminStyles.navButton}
        disabled={loading || !data}
        title={exactMatchCount > 0 ? `Commit ${exactMatchCount} exact match${exactMatchCount === 1 ? "" : "es"}` : "Commit exact matches if any are available"}
      >
        <span style={adminStyles.navButtonLabel}>Commit 100% {exactMatchCount > 0 ? `(${exactMatchCount})` : ""}</span>
        <span style={adminStyles.navButtonGlyph}>&gt;</span>
      </button>

      <button
        type="button"
        onClick={() => setPhase("review")}
        style={{
          ...adminStyles.navButton,
          ...(phase === "review" ? adminStyles.navButtonBack : null),
        }}
        disabled={!data}
      >
        <span style={adminStyles.navButtonLabel}>Review Matches</span>
        <span style={adminStyles.navButtonGlyph}>&gt;</span>
      </button>

      <button
        type="button"
        onClick={() => setPhase("lockbox")}
        style={{
          ...adminStyles.navButton,
          ...(phase === "lockbox" ? adminStyles.navButtonBack : null),
        }}
        disabled={!data}
      >
        <span style={adminStyles.navButtonLabel}>Lockbox Images</span>
        <span style={adminStyles.navButtonGlyph}>&gt;</span>
      </button>

      <button type="button" onClick={() => navigate("/collections")} style={adminStyles.navButton}>
        <span style={adminStyles.navButtonLabel}>Collections</span>
        <span style={adminStyles.navButtonGlyph}>&gt;</span>
      </button>
    </div>
  );

  useEffect(() => {
    if (!isPreviewOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPreviewOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPreviewOpen]);

  const previewUrl = previewPath ? buildImagingFileOpenUrl(previewPath, previewPage) : "";

  return (
    <AdminShell
      sidebarCopy="A dedicated imaging workspace for matching Balsheet rows to source files and opening the original PDF."
      onBack={() => navigate("/collections")}
      useGlobalMenuFallback={false}
      hideSidebarBackMenu
      hideSidebarBackStyles
      sidebarAction={sidebarActions}
      sidebarCardLabel="Status"
      sidebarCardValue={phaseTitle}
      sidebarCardMeta={
        data
          ? `${data.rowCount} row${data.rowCount === 1 ? "" : "s"} loaded, ${data.indexCount} indexed file${data.indexCount === 1 ? "" : "s"} available.`
          : "Enter a date and load the day's Balsheet rows."
      }
    >
      <section style={viewImagesStyles.content}>
        <section style={viewImagesStyles.heroShell}>
          <div style={viewImagesStyles.heroCopy}>
            <div style={viewImagesStyles.kicker}>View Images workspace</div>
            <p style={viewImagesStyles.subtitle}>Associate PDFs to Balsheet rows</p>
          </div>

          <div style={viewImagesStyles.heroArt}>
            <div style={viewImagesStyles.heroStatusCard}>
              <div style={viewImagesStyles.heroStatusTop}>
                <span style={viewImagesStyles.statusPill}>
                  Phase {phase === "idle" ? "0" : phase === "loaded" ? "1" : phase === "matched" ? "2" : "3"}
                </span>
                <span style={viewImagesStyles.statusDot} />
              </div>
              <div style={viewImagesStyles.heroStatusTitle}>{phaseTitle}</div>
              <div style={viewImagesStyles.heroStatusText}>
                {data
                  ? `${data.rows.length} Balsheet row${data.rows.length === 1 ? "" : "s"} returned for ${data.postingDate}.`
                  : "No date has been loaded yet. Start with the date field on the left."}
              </div>
            </div>
          </div>
        </section>

        {error && <div style={viewImagesStyles.errorBanner}>{error}</div>}
        {actionDetail && <div style={viewImagesStyles.infoBanner}>{actionDetail}</div>}

        {data && (
          <section style={viewImagesStyles.workspaceShell}>
            <div style={viewImagesStyles.sectionHeader}>
              <div>
                <div style={adminStyles.sectionKicker}>Matched rows</div>
                <h2 style={adminStyles.sectionTitle}>Balsheet rows and suggested documents</h2>
                <div style={viewImagesStyles.sectionDate}>
                  Considering: {data?.postingDate || postingDate || "No date selected"}
                </div>
              </div>
              <div style={adminStyles.sectionMeta}>
                Confirm a suggested file to save the association, then use the view button to open the original PDF.
              </div>
            </div>

            {phase === "review" && (
              <div style={viewImagesStyles.reviewGrid}>
                <div style={viewImagesStyles.reviewTableWrap}>
                  {reviewRowsByType.length === 0 ? (
                    <div style={viewImagesStyles.emptyState}>No Balsheet rows were found for {data.postingDate}.</div>
                  ) : (
                    reviewRowsByType.map((group) => (
                      <section key={group.type} style={viewImagesStyles.reviewGroup}>
                        <div style={viewImagesStyles.reviewGroupHeader}>
                          <div>
                            <div style={adminStyles.sectionKicker}>Review matches</div>
                            <h3 style={adminStyles.sectionTitle}>{group.type}</h3>
                          </div>
                          <div style={viewImagesStyles.reviewGroupMeta}>
                            {group.rows.length} row{group.rows.length === 1 ? "" : "s"}
                          </div>
                        </div>

                        <div style={viewImagesStyles.reviewTableHeader}>
                          <div>Type</div>
                          <div>Amount</div>
                          <div>Payer</div>
                          <div>Check #</div>
                          <div>Image</div>
                        </div>

                        {group.rows.map((row) => {
                          const reviewFile = getReviewFile(row);
                          return (
                            <div key={row.entryId} style={viewImagesStyles.reviewTableRow}>
                              <div style={viewImagesStyles.reviewColumnType}>{row.type || group.type}</div>
                              <div style={viewImagesStyles.reviewColumnAmount}>{formatCurrency(row.amount)}</div>
                              <div style={viewImagesStyles.reviewColumnPayer}>{row.payer || "Untitled payer"}</div>
                              <div style={viewImagesStyles.reviewColumnCheck}>{row.checkNumber || "No check number"}</div>
                              <div style={viewImagesStyles.reviewColumnImage}>
                                {reviewFile ? (
                                  <div style={viewImagesStyles.reviewImageInline}>
                                    <button
                                      type="button"
                                      style={viewImagesStyles.smallButton}
                                      onClick={() => openDocument(reviewFile.filePath, reviewFile.fileName, reviewFile.bookmarkPage || 0)}
                                    >
                                      View Image
                                    </button>
                                    <span style={viewImagesStyles.reviewImageMeta}>
                                      {typeof reviewFile.confidence === "number"
                                        ? `${Math.round(reviewFile.confidence * 100)}% match`
                                        : "Matched"}
                                    </span>
                                  </div>
                                ) : (
                                  <span style={viewImagesStyles.reviewImageMeta}>No image matched</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </section>
                    ))
                  )}
                </div>

              </div>
            )}

            {phase !== "review" && (
              <div style={nonReviewGridStyle}>
                {phase === "lockbox" && (
                  <article style={viewImagesStyles.lockboxPanel}>
                    <div style={viewImagesStyles.lockboxPanelTop}>
                      <div>
                        <div style={adminStyles.sectionKicker}>Lockbox images</div>
                        <h3 style={adminStyles.sectionTitle}>Lockbox</h3>
                      </div>
                      <div style={viewImagesStyles.lockboxPanelMeta}>
                        <strong>Considering: {data?.postingDate || isoDateToDisplay(postingDate) || "No date selected"}</strong>
                        <br />
                        Review each lockbox row, preview the suggested PDF, then associate or disassociate the confirmed link.
                      </div>
                    </div>

                    <div style={viewImagesStyles.lockboxPanelActions}>
                      <button
                        type="button"
                        onClick={() => void findLockboxMatches()}
                        disabled={loading || lockboxRows.length === 0}
                        style={adminStyles.navButton}
                      >
                        <span style={adminStyles.navButtonLabel}>{loading ? "Scanning..." : "Find Matches"}</span>
                        <span style={adminStyles.navButtonGlyph}>&gt;</span>
                      </button>
                      <div style={viewImagesStyles.lockboxSourceBadge}>
                        Source file: {selectedLockboxRow?.recommendations[0]?.fileName || "scan to resolve"}
                      </div>
                      <button
                        type="button"
                        onClick={() => void autoAssociateHighConfidenceLockbox()}
                        disabled={loading || lockboxRows.length === 0}
                        style={adminStyles.navButton}
                      >
                        <span style={adminStyles.navButtonLabel}>Auto Associate 94%+</span>
                        <span style={adminStyles.navButtonGlyph}>&gt;</span>
                      </button>
                    </div>

                    {lockboxError && <div style={viewImagesStyles.errorBanner}>{lockboxError}</div>}

                    {lockboxRows.length === 0 ? (
                      <div style={viewImagesStyles.emptyInline}>
                        No lockbox rows were found for {data.postingDate}.
                      </div>
                    ) : (
                      <div style={viewImagesStyles.lockboxTableWrap}>
                        <div style={viewImagesStyles.lockboxTableHeader}>
                          <div>Date</div>
                          <div>Amount</div>
                          <div>Payer</div>
                          <div>Check #</div>
                          <div>Status</div>
                          <div>Actions</div>
                        </div>
                        {lockboxRows.map((row) => {
                          const linked = row.linkedFiles[0] ?? null;
                          const suggested = row.recommendations[0] ?? row.matches[0] ?? null;
                          const recommendations = row.recommendations.slice(0, 2);
                          const primary = linked ?? suggested;
                          const rowSelected = row.entryId === selectedLockboxRow?.entryId;
                          return (
                            <div
                              key={row.entryId}
                              style={{
                                ...viewImagesStyles.lockboxTableRow,
                                ...(rowSelected ? viewImagesStyles.lockboxTableRowSelected : null),
                              }}
                              onClick={() => {
                                setLockboxRowId(row.entryId);
                              }}
                              role="button"
                              tabIndex={0}
                            >
                              <div style={viewImagesStyles.lockboxCell}>{row.postingDate}</div>
                              <div style={viewImagesStyles.lockboxCellAmount}>{formatCurrency(row.amount)}</div>
                              <div style={viewImagesStyles.lockboxCellStrong}>{row.payer || "unknown"}</div>
                              <div style={viewImagesStyles.lockboxCell}>{row.checkNumber || "—"}</div>
                              <div style={viewImagesStyles.lockboxCellMeta}>
                                {linked
                                  ? `Linked ${((linked.bookmarkPage ?? 0) > 0) ? `· page ${linked.bookmarkPage}` : ""}`
                                  : suggested
                                    ? `${Math.round(suggested.confidence * 100)}% suggested`
                                    : "No match"}
                              </div>
                              <div style={viewImagesStyles.lockboxActionRow} onClick={(event) => event.stopPropagation()}>
                                <button
                                  type="button"
                                  style={viewImagesStyles.smallButton}
                                  onClick={() => void previewLockboxRow(row)}
                                  disabled={!primary}
                                  title={primary ? "Preview the PDF" : "No preview available"}
                                >
                                  Preview
                                </button>
                                <button
                                  type="button"
                                  style={viewImagesStyles.smallButtonSecondary}
                                  onClick={() => void associateLockboxRow(row)}
                                  disabled={!suggested || Boolean(linked) || loading}
                                  title={suggested ? "Associate the suggested PDF" : "No suggestion available"}
                                >
                                  Associate
                                </button>
                                <button
                                  type="button"
                                  style={viewImagesStyles.smallButton}
                                  onClick={() => void disassociateLockboxRow(row)}
                                  disabled={!linked || loading}
                                  title={linked ? "Remove the confirmed link" : "Nothing to remove"}
                                >
                                  Disassociate
                                </button>
                              </div>
                              <div style={viewImagesStyles.lockboxRecommendationBlock}>
                                {recommendations.length > 0 ? (
                                  <>
                                    <div style={viewImagesStyles.lockboxRecommendationLabel}>Match recommendations</div>
                                    {recommendations.map((recommendation) => (
                                      <div key={`${row.entryId}-${recommendation.filePath}`} style={viewImagesStyles.lockboxRecommendationLine}>
                                        <div style={viewImagesStyles.lockboxRecommendationTop}>
                                          <span style={viewImagesStyles.lockboxRecommendationScore}>
                                            {Math.round(recommendation.confidence * 100)}% match
                                          </span>
                                          <span style={viewImagesStyles.lockboxRecommendationMeta}>
                                            check {recommendation.foundCheckNumber || row.checkNumber || "—"} · amount{" "}
                                            {recommendation.foundAmount || formatCurrency(row.amount)} · page{" "}
                                            {recommendation.bookmarkPage > 0 ? recommendation.bookmarkPage : "?"}
                                          </span>
                                        </div>
                                        <div style={viewImagesStyles.lockboxRecommendationTitle}>
                                          {recommendation.fileName}
                                          {recommendation.bookmarkTitle ? ` · ${recommendation.bookmarkTitle}` : ""}
                                        </div>
                                        {recommendation.snippet ? (
                                          <div style={viewImagesStyles.lockboxRecommendationSnippet}>{recommendation.snippet}</div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </>
                                ) : (
                                  <div style={viewImagesStyles.lockboxRecommendationEmpty}>
                                    Click Find Matches to scan bookmarks, check numbers, and amounts for this row.
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                )}

                {phase !== "lockbox" && (
                  <div style={viewImagesStyles.rowsColumn}>
                    {allRows.length === 0 ? (
                      <div style={viewImagesStyles.emptyState}>No Balsheet rows were found for {data.postingDate}.</div>
                    ) : (
                      allRows.map((row) => (
                        <article key={row.entryId} style={viewImagesStyles.rowCard}>
                          <div style={viewImagesStyles.rowTop}>
                            <div>
                              <div style={viewImagesStyles.rowTitle}>{row.payer || "Untitled payer"}</div>
                              <div style={viewImagesStyles.rowMeta}>
                                {row.postingDate} · {formatCurrency(row.amount)} · {row.checkNumber || "No check number"}
                              </div>
                            </div>
                            <span style={viewImagesStyles.rowBadge}>
                              {row.linkedFiles.length > 0 ? `${row.linkedFiles.length} linked` : `${row.matches.length} suggested`}
                            </span>
                          </div>

                          <div style={viewImagesStyles.fileList}>
                            {row.linkedFiles.length > 0 && (
                              <div style={viewImagesStyles.fileGroup}>
                                <div style={viewImagesStyles.fileGroupLabel}>Confirmed files</div>
                                {row.linkedFiles.map((file) => (
                                  <div key={file.linkId} style={viewImagesStyles.fileItem}>
                                    <div style={viewImagesStyles.fileItemCopy}>
                                      <div style={viewImagesStyles.fileItemTitle}>{file.fileName}</div>
                                      <div style={viewImagesStyles.fileItemMeta}>
                                        {file.matchMethod} · {Math.round(file.confidence * 100)}% match
                                        {file.lockboxImageDate ? ` · lockbox ${file.lockboxImageDate}` : ""}
                                      </div>
                                    </div>
                                    <div style={viewImagesStyles.fileItemActions}>
                                      <button
                                        type="button"
                                        style={viewImagesStyles.smallButton}
                                        onClick={() => openDocument(file.filePath, file.fileName)}
                                      >
                                        View PDF
                                      </button>
                                      <a
                                        href={buildImagingFileOpenUrl(file.filePath)}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={viewImagesStyles.smallLink}
                                      >
                                        Open
                                      </a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div style={viewImagesStyles.fileGroup}>
                              <div style={viewImagesStyles.fileGroupLabel}>Suggested matches</div>
                              {row.matches.length > 0 ? (
                                row.matches.map((match) => (
                                  <div key={match.filePath} style={viewImagesStyles.fileItem}>
                                    <div style={viewImagesStyles.fileItemCopy}>
                                      <div style={viewImagesStyles.fileItemTitle}>{match.fileName}</div>
                                      <div style={viewImagesStyles.fileItemMeta}>
                                        {match.matchMethod} · {Math.round(match.confidence * 100)}% match
                                        {match.isArchived ? " · archived" : ""}
                                      </div>
                                    </div>
                                    <div style={viewImagesStyles.fileItemActions}>
                                      <button
                                        type="button"
                                        style={viewImagesStyles.smallButton}
                                        onClick={() => openDocument(match.filePath, match.fileName)}
                                      >
                                        View PDF
                                      </button>
                                      <button
                                        type="button"
                                        style={viewImagesStyles.smallButtonSecondary}
                                        onClick={() => void confirmMatch(row, match)}
                                      >
                                        Associate
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div style={viewImagesStyles.emptyInline}>No filename match found yet.</div>
                              )}
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                )}

              </div>
            )}

            {isPreviewOpen && previewPath
              ? createPortal(
                  <div
                    style={viewImagesStyles.previewOverlay}
                    role="dialog"
                    aria-modal="true"
                    aria-label={previewTitle || "Original PDF"}
                    onClick={() => setIsPreviewOpen(false)}
                  >
                    <div style={viewImagesStyles.previewModal} onClick={(event) => event.stopPropagation()}>
                      <div style={viewImagesStyles.previewHeader}>
                        <div>
                          <div style={adminStyles.sectionKicker}>Original PDF</div>
                          <h2 style={adminStyles.sectionTitle}>{previewTitle || "No document selected"}</h2>
                          <div style={viewImagesStyles.previewMeta}>
                            {previewPage > 0 ? `Page ${previewPage}` : "Full document preview"}
                          </div>
                        </div>
                        <div style={viewImagesStyles.previewHeaderActions}>
                          <button
                            type="button"
                            style={viewImagesStyles.smallButtonSecondary}
                            onClick={() => setIsPreviewOpen(false)}
                          >
                            Close
                          </button>
                          <a href={previewUrl} target="_blank" rel="noreferrer" style={viewImagesStyles.previewOpenLink}>
                            Open in new tab
                          </a>
                        </div>
                      </div>

                      <iframe
                        title={previewTitle || "Original PDF"}
                        src={previewUrl}
                        style={viewImagesStyles.previewFrame}
                      />
                    </div>
                  </div>,
                  document.body
                )
              : null}
          </section>
        )}
      </section>
    </AdminShell>
  );
}

function formatCurrency(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed)
    ? parsed.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "$0.00";
}

function isoDateToDisplay(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return raw;
  }

  const displayMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!displayMatch) {
    return "";
  }

  const month = displayMatch[1].padStart(2, "0");
  const day = displayMatch[2].padStart(2, "0");
  const year = displayMatch[3].length === 2 ? `20${displayMatch[3]}` : displayMatch[3];
  return `${month}/${day}/${year}`;
}

function displayDateToIso(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return raw;
  }

  const displayMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!displayMatch) {
    return "";
  }

  const month = displayMatch[1].padStart(2, "0");
  const day = displayMatch[2].padStart(2, "0");
  const year = displayMatch[3].length === 2 ? `20${displayMatch[3]}` : displayMatch[3];
  return `${year}-${month}-${day}`;
}

function formatImagingError(error: unknown, method: string, requestLabel: string) {
  if (typeof error === "object" && error && "isAxiosError" in error) {
    const axiosError = error as {
      message?: string;
      code?: string;
      response?: { status?: number; statusText?: string; data?: unknown };
    };
    const status = axiosError.response?.status;
    const statusText = axiosError.response?.statusText;
    const responseData =
      typeof axiosError.response?.data === "string"
        ? axiosError.response.data
        : axiosError.response?.data
          ? JSON.stringify(axiosError.response.data)
          : "";

    return [
      `Imaging request failed: ${method} ${requestLabel}`,
      status ? `Status: ${status}${statusText ? ` ${statusText}` : ""}` : null,
      axiosError.code ? `Code: ${axiosError.code}` : null,
      axiosError.message ? `Message: ${axiosError.message}` : null,
      responseData ? `Response: ${responseData}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (error instanceof Error) {
    return `Imaging request failed: ${method} ${requestLabel} | Message: ${error.message}`;
  }

  return `Imaging request failed: ${method} ${requestLabel}`;
}

const viewImagesStyles: Record<string, CSSProperties> = {
  content: {
    ...adminStyles.content,
    paddingTop: "8px",
  },
  heroShell: {
    ...cashStyles.heroShell,
    position: "relative",
    top: "auto",
    zIndex: 1,
  },
  heroCopy: {
    ...cashStyles.heroCopy,
  },
  kicker: {
    ...cashStyles.kicker,
  },
  subtitle: {
    ...cashStyles.subtitle,
  },
  errorBanner: {
    marginTop: "14px",
    padding: "12px 14px",
    borderRadius: "16px",
    background: "rgba(255, 239, 239, 0.96)",
    border: "1px solid rgba(206, 116, 116, 0.24)",
    color: "#a64444",
    fontSize: "13px",
    fontWeight: 700,
  },
  infoBanner: {
    marginTop: "14px",
    padding: "12px 14px",
    borderRadius: "16px",
    background: "rgba(236, 245, 255, 0.96)",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    color: "#17324f",
    fontSize: "13px",
    fontWeight: 700,
  },
  heroArt: {
    ...cashStyles.heroArt,
    minWidth: "280px",
  },
  heroStatusCard: {
    ...cashStyles.heroStatusCard,
    width: "100%",
  },
  heroStatusTop: {
    ...cashStyles.heroStatusTop,
  },
  statusPill: {
    ...cashStyles.statusPill,
  },
  statusDot: {
    ...cashStyles.statusDot,
  },
  heroStatusTitle: {
    ...cashStyles.heroStatusTitle,
  },
  heroStatusText: {
    ...cashStyles.heroStatusText,
  },
  sidebarStack: {
    display: "grid",
    gap: "10px",
  },
  sidebarDateField: {
    display: "grid",
    gap: "6px",
    marginBottom: "4px",
  },
  sidebarDateInput: {
    width: "100%",
    height: "46px",
    borderRadius: "16px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255,255,255,0.92)",
    color: "#16304d",
    fontSize: "16px",
    fontWeight: 700,
    padding: "0 14px",
    outline: "none",
    boxShadow: "0 12px 22px rgba(52, 84, 120, 0.06)",
  },
  dateHelp: {
    fontSize: "12px",
    lineHeight: 1.35,
    color: "#667a90",
    fontWeight: 600,
    marginTop: "-2px",
  },
  workspaceShell: {
    display: "grid",
    gap: "18px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  sectionDate: {
    marginTop: "8px",
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(236, 245, 255, 0.88)",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    fontSize: "13px",
    fontWeight: 900,
    color: "#17324f",
    letterSpacing: "0.01em",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 0.95fr)",
    gap: "18px",
    alignItems: "start",
  },
  reviewGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "18px",
    alignItems: "start",
  },
  reviewTableWrap: {
    display: "grid",
    width: "100%",
    gap: "8px",
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 20px 40px rgba(52, 84, 120, 0.07)",
    padding: "10px 14px 12px",
  },
  reviewGroup: {
    display: "grid",
    gap: "6px",
    paddingBottom: "4px",
  },
  reviewGroupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "16px",
    padding: "0 4px",
  },
  reviewGroupMeta: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#60748a",
    whiteSpace: "nowrap",
  },
  reviewTableHeader: {
    display: "grid",
    gridTemplateColumns: "110px 120px minmax(180px, 1fr) 160px 160px",
    gap: "10px",
    padding: "8px 12px",
    borderRadius: "14px",
    background: "rgba(241, 246, 252, 0.96)",
    color: "#496179",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  reviewTableRow: {
    display: "grid",
    gridTemplateColumns: "110px 120px minmax(180px, 1fr) 160px 160px",
    gap: "10px",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: "14px",
    background: "rgba(250, 252, 255, 0.96)",
    border: "1px solid rgba(140, 160, 184, 0.12)",
  },
  reviewColumnType: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#17324f",
  },
  reviewColumnAmount: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#17324f",
  },
  reviewColumnPayer: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#4f6277",
  },
  reviewColumnCheck: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#4f6277",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  reviewColumnImage: {
    display: "grid",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  reviewImageInline: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    whiteSpace: "nowrap",
    flexWrap: "nowrap",
    minWidth: 0,
  },
  reviewImageMeta: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "12px",
    color: "#667a90",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  rowsColumn: {
    display: "grid",
    gap: "10px",
  },
  rowCard: {
    borderRadius: "22px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 20px 40px rgba(52, 84, 120, 0.07)",
    padding: "12px 14px",
    display: "grid",
    gap: "10px",
  },
  rowTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "10px",
  },
  rowTitle: {
    fontSize: "16px",
    fontWeight: 900,
    color: "#16304d",
  },
  rowMeta: {
    marginTop: "2px",
    fontSize: "12px",
    lineHeight: 1.3,
    color: "#5d7187",
  },
  rowBadge: {
    padding: "5px 9px",
    borderRadius: "999px",
    background: "rgba(236, 245, 255, 0.96)",
    color: "#315b88",
    fontSize: "11px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  fileList: {
    display: "grid",
    gap: "8px",
  },
  fileGroup: {
    display: "grid",
    gap: "8px",
  },
  fileGroupLabel: {
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6c7f95",
  },
  fileItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    padding: "9px 12px",
    borderRadius: "16px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(135deg, rgba(247,250,255,0.98) 0%, rgba(255,247,251,0.94) 100%)",
  },
  fileItemCopy: {
    display: "grid",
    gap: "1px",
    minWidth: 0,
  },
  fileItemTitle: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#17324f",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileItemMeta: {
    fontSize: "11px",
    color: "#5d7187",
    lineHeight: 1.25,
  },
  fileItemActions: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexShrink: 0,
  },
  smallButton: {
    border: "1px solid rgba(140, 160, 184, 0.20)",
    borderRadius: "999px",
    padding: "6px 10px",
    background: "rgba(255,255,255,0.94)",
    color: "#16304d",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(52, 84, 120, 0.06)",
  },
  smallButtonSecondary: {
    border: "1px solid rgba(140, 160, 184, 0.20)",
    borderRadius: "999px",
    padding: "6px 10px",
    background: "linear-gradient(135deg, rgba(236, 245, 255, 0.98), rgba(255, 239, 246, 0.96))",
    color: "#16304d",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(52, 84, 120, 0.06)",
  },
  smallLink: {
    fontSize: "11px",
    fontWeight: 800,
    color: "#315b88",
    textDecoration: "none",
  },
  emptyState: {
    padding: "18px",
    borderRadius: "18px",
    border: "1px dashed rgba(140, 160, 184, 0.30)",
    background: "rgba(255,255,255,0.72)",
    color: "#5d7187",
    fontSize: "13px",
    fontWeight: 700,
  },
  emptyInline: {
    padding: "12px 14px",
    borderRadius: "16px",
    border: "1px dashed rgba(140, 160, 184, 0.24)",
    background: "rgba(255,255,255,0.76)",
    color: "#5d7187",
    fontSize: "12px",
    fontWeight: 700,
  },
  previewCard: {
    borderRadius: "22px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 20px 40px rgba(52, 84, 120, 0.07)",
    padding: "16px",
    display: "grid",
    gap: "12px",
  },
  previewHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  previewHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  previewMeta: {
    marginTop: "6px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#667a90",
  },
  previewOpenLink: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#315b88",
    textDecoration: "none",
    padding: "8px 10px",
    borderRadius: "999px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    background: "rgba(236, 245, 255, 0.70)",
  },
  previewFrame: {
    width: "100%",
    height: "calc(100vh - 190px)",
    minHeight: "520px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    borderRadius: "16px",
    background: "#ffffff",
  },
  previewOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 5000,
    display: "grid",
    placeItems: "center",
    padding: "12px",
    background: "rgba(16, 26, 38, 0.54)",
    backdropFilter: "blur(10px)",
  },
  previewModal: {
    width: "min(1680px, calc(100vw - 24px))",
    height: "calc(100vh - 24px)",
    maxHeight: "calc(100vh - 24px)",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    gap: "14px",
    padding: "16px",
    borderRadius: "26px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,249,254,0.98) 100%)",
    boxShadow: "0 32px 80px rgba(7, 17, 29, 0.34)",
    overflow: "hidden",
  },
  previewEmpty: {
    minHeight: "420px",
    display: "grid",
    placeItems: "center",
    borderRadius: "16px",
    border: "1px dashed rgba(140, 160, 184, 0.24)",
    background: "rgba(247,250,255,0.88)",
    color: "#5d7187",
    fontSize: "13px",
    fontWeight: 700,
    textAlign: "center",
    padding: "24px",
  },
  lockboxPanel: {
    display: "grid",
    gap: "14px",
    padding: "16px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,249,254,0.98) 100%)",
    boxShadow: "0 20px 44px rgba(52, 84, 120, 0.08)",
  },
  lockboxPanelTop: {
    display: "grid",
    gap: "10px",
  },
  lockboxPanelMeta: {
    maxWidth: "58ch",
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#5d7187",
    fontWeight: 600,
  },
  lockboxPanelActions: {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  lockboxSourceBadge: {
    fontSize: "11px",
    fontWeight: 800,
    color: "#5d7187",
    padding: "8px 10px",
    borderRadius: "999px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(241, 246, 252, 0.86)",
  },
  lockboxTableWrap: {
    display: "grid",
    gap: "8px",
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "0 20px 40px rgba(52, 84, 120, 0.07)",
    padding: "10px 12px 12px",
    overflowX: "auto",
  },
  lockboxTableHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(96px, 110px) minmax(110px, 120px) minmax(170px, 1.15fr) minmax(110px, 120px) minmax(150px, 0.9fr) minmax(240px, auto)",
    gap: "10px",
    padding: "8px 10px",
    borderRadius: "14px",
    background: "rgba(241, 246, 252, 0.96)",
    color: "#496179",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    minWidth: "920px",
    alignItems: "center",
  },
  lockboxTableRow: {
    display: "grid",
    gridTemplateColumns: "minmax(96px, 110px) minmax(110px, 120px) minmax(170px, 1.15fr) minmax(110px, 120px) minmax(150px, 0.9fr) minmax(240px, auto)",
    gap: "10px",
    alignItems: "center",
    padding: "10px 10px",
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.12)",
    background: "rgba(250, 252, 255, 0.96)",
    minWidth: "920px",
    cursor: "pointer",
  },
  lockboxTableRowSelected: {
    borderColor: "rgba(49, 91, 136, 0.28)",
    background: "linear-gradient(135deg, rgba(236, 245, 255, 0.96), rgba(255, 248, 251, 0.92))",
    boxShadow: "0 12px 22px rgba(52, 84, 120, 0.08)",
  },
  lockboxCell: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#4f6277",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  lockboxCellStrong: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#17324f",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  lockboxCellAmount: {
    fontSize: "13px",
    fontWeight: 900,
    color: "#17324f",
    textAlign: "right",
  },
  lockboxCellMeta: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#60748a",
    lineHeight: 1.3,
  },
  lockboxActionRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "nowrap",
    justifyContent: "flex-start",
    minWidth: 0,
  },
  lockboxRecommendationBlock: {
    gridColumn: "1 / -1",
    display: "grid",
    gap: "6px",
    paddingTop: "2px",
  },
  lockboxRecommendationLabel: {
    fontSize: "10px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6c7f95",
  },
  lockboxRecommendationLine: {
    display: "grid",
    gap: "2px",
    padding: "8px 10px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(140, 160, 184, 0.10)",
  },
  lockboxRecommendationTop: {
    display: "flex",
    alignItems: "baseline",
    gap: "10px",
    flexWrap: "wrap",
  },
  lockboxRecommendationScore: {
    fontSize: "11px",
    fontWeight: 900,
    color: "#17324f",
  },
  lockboxRecommendationMeta: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#5d7187",
  },
  lockboxRecommendationTitle: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#17324f",
  },
  lockboxRecommendationSnippet: {
    fontSize: "11px",
    lineHeight: 1.35,
    color: "#6b7f95",
    maxWidth: "84ch",
  },
  lockboxRecommendationEmpty: {
    fontSize: "11px",
    lineHeight: 1.4,
    color: "#6b7f95",
    fontWeight: 600,
  },
  lockboxForm: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
    gap: "10px",
    alignItems: "end",
  },
  lockboxField: {
    display: "grid",
    gap: "6px",
  },
  lockboxSelect: {
    width: "100%",
    minHeight: "44px",
    borderRadius: "16px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    background: "rgba(255,255,255,0.94)",
    color: "#17324f",
    fontSize: "13px",
    fontWeight: 700,
    padding: "0 12px",
    outline: "none",
    boxShadow: "0 10px 20px rgba(52, 84, 120, 0.05)",
  },
  lockboxInput: {
    width: "100%",
    minHeight: "44px",
    borderRadius: "16px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    background: "rgba(255,255,255,0.94)",
    color: "#17324f",
    fontSize: "13px",
    fontWeight: 700,
    padding: "0 12px",
    outline: "none",
    boxShadow: "0 10px 20px rgba(52, 84, 120, 0.05)",
  },
  lockboxResultList: {
    display: "grid",
    gap: "10px",
  },
  lockboxResultCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "11px 12px",
    borderRadius: "16px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(135deg, rgba(247,250,255,0.98) 0%, rgba(255,248,251,0.96) 100%)",
  },
  lockboxResultCopy: {
    display: "grid",
    gap: "3px",
    minWidth: 0,
  },
  lockboxResultTitle: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#17324f",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  lockboxResultMeta: {
    fontSize: "11px",
    color: "#5d7187",
    fontWeight: 700,
    lineHeight: 1.25,
  },
  lockboxResultSnippet: {
    fontSize: "11px",
    lineHeight: 1.35,
    color: "#6b7f95",
    maxWidth: "72ch",
  },
};
