import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminShell, styles as adminStyles } from "../components/AdminShell";
import { API_BASE } from "../config/apiBase";
import {
  buildImagingFileOpenUrl,
  commitImagingExactMatches,
  confirmImagingBalsheetLink,
  getImagingBalsheetAssociations,
  refreshImagingBalsheetAssociations,
  type ImagingBalsheetAssociationResponse,
  type ImagingBalsheetAssociationRow,
  type ImagingDocumentSuggestion,
} from "../api/balsheet_api";

type ImagingPhase = "idle" | "loaded" | "matched" | "review";
type ImagingReviewFile = {
  filePath: string;
  fileName: string;
  source: "linked" | "suggested";
  matchMethod?: string;
  confidence?: number;
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
    if (phase === "loaded") return "Date loaded";
    return "Awaiting date";
  }, [phase]);

  const exactMatchCount = useMemo(
    () => data?.rows.filter((row) => row.linkedFiles.length === 0 && row.matches[0]?.confidence === 1).length ?? 0,
    [data]
  );

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
      if (!previewPath && response.data.rows.length > 0) {
        const firstMatch = response.data.rows.find((row) => row.matches.length > 0 || row.linkedFiles.length > 0);
        const firstFile = firstMatch?.linkedFiles[0] ?? firstMatch?.matches[0];
        if (firstFile) {
          setPreviewPath(firstFile.filePath);
          setPreviewTitle(firstFile.fileName);
        }
      }
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
      const firstCommittedRow = response.data.data.rows.find((row) => row.linkedFiles.length > 0);
      const firstCommittedFile = firstCommittedRow?.linkedFiles[0];
      if (firstCommittedFile) {
        setPreviewPath(firstCommittedFile.filePath);
        setPreviewTitle(firstCommittedFile.fileName);
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

  function openDocument(filePath: string, fileName: string) {
    setPreviewPath(filePath);
    setPreviewTitle(fileName);
    setPhase("review");
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
        disabled={loading || !data || exactMatchCount === 0}
        title={exactMatchCount > 0 ? `Commit ${exactMatchCount} exact match${exactMatchCount === 1 ? "" : "es"}` : "No exact matches to commit"}
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

      <button type="button" onClick={() => navigate("/collections")} style={adminStyles.navButton}>
        <span style={adminStyles.navButtonLabel}>Collections</span>
        <span style={adminStyles.navButtonGlyph}>&gt;</span>
      </button>
    </div>
  );

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
            <div style={adminStyles.kicker}>View Images</div>
            <h1 style={viewImagesStyles.heroTitle}>Associate PDFs to Balsheet rows</h1>
            <p style={viewImagesStyles.heroSubtitle}>
              Enter a date, load that day's Balsheet rows, let the filename matcher suggest PDFs from `3.HTML`, then
              confirm the right source file and open the original PDF when you need it.
            </p>

            <div style={viewImagesStyles.heroNote}>
              The matcher uses check-number strings from filenames first, then keeps a manual confirm step for edge
              cases. Use the left rail to enter the date and load the day.
            </div>

            {error && <div style={viewImagesStyles.errorBanner}>{error}</div>}
          </div>

          <div style={viewImagesStyles.heroArt}>
            <div style={viewImagesStyles.heroCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Phase {phase === "idle" ? "0" : phase === "loaded" ? "1" : phase === "matched" ? "2" : "3"}</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>{phaseTitle}</div>
              <div style={adminStyles.heroStatusText}>
                {data
                  ? `${data.rows.length} Balsheet row${data.rows.length === 1 ? "" : "s"} returned for ${data.postingDate}.`
                  : "No date has been loaded yet. Start with the date field on the left."}
              </div>
            </div>
          </div>
        </section>

        {data && (
          <section style={viewImagesStyles.workspaceShell}>
            <div style={viewImagesStyles.sectionHeader}>
              <div>
                <div style={adminStyles.sectionKicker}>Matched rows</div>
                <h2 style={adminStyles.sectionTitle}>Balsheet rows and suggested documents</h2>
              </div>
              <div style={adminStyles.sectionMeta}>
                Confirm a suggested file to save the association, then use the view button to open the original PDF.
              </div>
            </div>

            {phase === "review" && (
              <div style={viewImagesStyles.reviewGrid}>
                <div style={viewImagesStyles.reviewTableWrap}>
                  <div style={viewImagesStyles.reviewTableHeader}>
                    <div>Date</div>
                    <div>Amount</div>
                    <div>Payer</div>
                    <div>Check #</div>
                    <div>Image</div>
                  </div>

                  {data.rows.length === 0 ? (
                    <div style={viewImagesStyles.emptyState}>No Balsheet rows were found for {data.postingDate}.</div>
                  ) : (
                    data.rows.map((row) => {
                      const reviewFile = getReviewFile(row);
                      return (
                        <div key={row.entryId} style={viewImagesStyles.reviewTableRow}>
                          <div style={viewImagesStyles.reviewColumnDate}>{row.postingDate}</div>
                          <div style={viewImagesStyles.reviewColumnAmount}>{formatCurrency(row.amount)}</div>
                          <div style={viewImagesStyles.reviewColumnPayer}>{row.payer || "Untitled payer"}</div>
                          <div style={viewImagesStyles.reviewColumnCheck}>{row.checkNumber || "No check number"}</div>
                          <div style={viewImagesStyles.reviewColumnImage}>
                            {reviewFile ? (
                              <>
                                <button
                                  type="button"
                                  style={viewImagesStyles.smallButton}
                                  onClick={() => openDocument(reviewFile.filePath, reviewFile.fileName)}
                                >
                                  View Image
                                </button>
                                <span style={viewImagesStyles.reviewImageMeta}>
                                  {reviewFile.source}
                                  {reviewFile.matchMethod ? ` · ${reviewFile.matchMethod}` : ""}
                                  {typeof reviewFile.confidence === "number"
                                    ? ` · ${Math.round(reviewFile.confidence * 100)}%`
                                    : ""}
                                </span>
                              </>
                            ) : (
                              <span style={viewImagesStyles.reviewImageMeta}>No image matched</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <aside style={viewImagesStyles.previewColumn}>
                  <div style={viewImagesStyles.previewCard}>
                    <div style={viewImagesStyles.previewHeader}>
                      <div>
                        <div style={adminStyles.sectionKicker}>Original PDF</div>
                        <h2 style={adminStyles.sectionTitle}>{previewTitle || "No document selected"}</h2>
                      </div>
                      {previewPath && (
                        <a
                          href={buildImagingFileOpenUrl(previewPath)}
                          target="_blank"
                          rel="noreferrer"
                          style={viewImagesStyles.previewOpenLink}
                        >
                          Open in new tab
                        </a>
                      )}
                    </div>

                    {previewPath ? (
                      <iframe
                        title={previewTitle || "Original PDF"}
                        src={buildImagingFileOpenUrl(previewPath)}
                        style={viewImagesStyles.previewFrame}
                      />
                    ) : (
                      <div style={viewImagesStyles.previewEmpty}>Pick a row image to preview the source PDF here.</div>
                    )}
                  </div>
                </aside>
              </div>
            )}

            {phase !== "review" && (
              <div style={viewImagesStyles.grid}>
              <div style={viewImagesStyles.rowsColumn}>
                {data.rows.length === 0 ? (
                  <div style={viewImagesStyles.emptyState}>No Balsheet rows were found for {data.postingDate}.</div>
                ) : (
                  data.rows.map((row) => (
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

              <aside style={viewImagesStyles.previewColumn}>
                <div style={viewImagesStyles.previewCard}>
                  <div style={viewImagesStyles.previewHeader}>
                    <div>
                      <div style={adminStyles.sectionKicker}>Original PDF</div>
                      <h2 style={adminStyles.sectionTitle}>{previewTitle || "No document selected"}</h2>
                    </div>
                    {previewPath && (
                      <a
                        href={buildImagingFileOpenUrl(previewPath)}
                        target="_blank"
                        rel="noreferrer"
                        style={viewImagesStyles.previewOpenLink}
                      >
                        Open in new tab
                      </a>
                    )}
                  </div>

                  {previewPath ? (
                    <iframe
                      title={previewTitle || "Original PDF"}
                      src={buildImagingFileOpenUrl(previewPath)}
                      style={viewImagesStyles.previewFrame}
                    />
                  ) : (
                    <div style={viewImagesStyles.previewEmpty}>
                      Pick a row match or confirmed file to preview the source PDF here.
                    </div>
                  )}
                </div>
              </aside>
              </div>
            )}
          </section>
        )}
      </section>
    </AdminShell>
  );
}

function formatCurrency(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, { style: "currency", currency: "USD" })
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
    ...adminStyles.heroShell,
    position: "relative",
    top: "auto",
    zIndex: 1,
    minHeight: "320px",
    alignItems: "stretch",
    padding: "28px",
    gap: "24px",
    background: "linear-gradient(135deg, rgba(247, 250, 255, 0.98) 0%, rgba(255, 244, 248, 0.94) 100%)",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    boxShadow: "0 26px 60px rgba(52, 84, 120, 0.10)",
  },
  heroCopy: {
    ...adminStyles.heroCopy,
    maxWidth: "640px",
  },
  heroTitle: {
    margin: "8px 0 0",
    fontSize: "clamp(2.2rem, 4vw, 3.8rem)",
    lineHeight: 0.98,
    letterSpacing: "-0.05em",
    color: "#16304d",
    fontWeight: 900,
  },
  heroSubtitle: {
    margin: "14px 0 0",
    fontSize: "18px",
    lineHeight: 1.65,
    color: "#4f6277",
    maxWidth: "58ch",
  },
  heroNote: {
    marginTop: "18px",
    display: "inline-flex",
    alignItems: "center",
    padding: "12px 16px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    color: "#5b6f84",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.35,
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
  heroArt: {
    ...adminStyles.heroArt,
    minWidth: "280px",
    display: "flex",
    alignItems: "stretch",
  },
  heroCard: {
    ...adminStyles.heroStatusCard,
    width: "100%",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 16px 36px rgba(52, 84, 120, 0.08)",
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
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 0.95fr)",
    gap: "18px",
    alignItems: "start",
  },
  reviewGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(320px, 0.9fr)",
    gap: "18px",
    alignItems: "start",
  },
  reviewTableWrap: {
    display: "grid",
    gap: "8px",
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 20px 40px rgba(52, 84, 120, 0.07)",
    padding: "14px",
  },
  reviewTableHeader: {
    display: "grid",
    gridTemplateColumns: "130px 120px minmax(180px, 1fr) 160px 160px",
    gap: "10px",
    padding: "10px 12px",
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
    gridTemplateColumns: "130px 120px minmax(180px, 1fr) 160px 160px",
    gap: "10px",
    alignItems: "center",
    padding: "12px",
    borderRadius: "14px",
    background: "rgba(250, 252, 255, 0.96)",
    border: "1px solid rgba(140, 160, 184, 0.12)",
  },
  reviewColumnDate: {
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
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "10px",
    flexWrap: "wrap",
  },
  reviewImageMeta: {
    fontSize: "12px",
    color: "#667a90",
    fontWeight: 700,
  },
  rowsColumn: {
    display: "grid",
    gap: "14px",
  },
  previewColumn: {
    position: "sticky",
    top: "16px",
    alignSelf: "start",
  },
  rowCard: {
    borderRadius: "22px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 20px 40px rgba(52, 84, 120, 0.07)",
    padding: "16px",
    display: "grid",
    gap: "14px",
  },
  rowTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  rowTitle: {
    fontSize: "18px",
    fontWeight: 900,
    color: "#16304d",
  },
  rowMeta: {
    marginTop: "4px",
    fontSize: "13px",
    lineHeight: 1.45,
    color: "#5d7187",
  },
  rowBadge: {
    padding: "7px 10px",
    borderRadius: "999px",
    background: "rgba(236, 245, 255, 0.96)",
    color: "#315b88",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  fileList: {
    display: "grid",
    gap: "12px",
  },
  fileGroup: {
    display: "grid",
    gap: "10px",
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
    gap: "12px",
    padding: "12px 14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(135deg, rgba(247,250,255,0.98) 0%, rgba(255,247,251,0.94) 100%)",
  },
  fileItemCopy: {
    display: "grid",
    gap: "2px",
    minWidth: 0,
  },
  fileItemTitle: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#17324f",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileItemMeta: {
    fontSize: "12px",
    color: "#5d7187",
    lineHeight: 1.35,
  },
  fileItemActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  smallButton: {
    border: "1px solid rgba(140, 160, 184, 0.20)",
    borderRadius: "999px",
    padding: "8px 12px",
    background: "rgba(255,255,255,0.94)",
    color: "#16304d",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(52, 84, 120, 0.06)",
  },
  smallButtonSecondary: {
    border: "1px solid rgba(140, 160, 184, 0.20)",
    borderRadius: "999px",
    padding: "8px 12px",
    background: "linear-gradient(135deg, rgba(236, 245, 255, 0.98), rgba(255, 239, 246, 0.96))",
    color: "#16304d",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(52, 84, 120, 0.06)",
  },
  smallLink: {
    fontSize: "12px",
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
    height: "760px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    borderRadius: "16px",
    background: "#ffffff",
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
};
