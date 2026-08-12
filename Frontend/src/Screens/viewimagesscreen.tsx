import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminShell, styles as adminStyles } from "../components/AdminShell";
import { API_BASE } from "../config/apiBase";
import { styles as cashStyles } from "./cashscreen";
import { createPortal } from "react-dom";
import {
  buildImagingFileOpenUrl,
  buildImagingSiteDocumentOpenUrl,
  buildImagingSitePageUrl,
  commitImagingExactMatches,
  confirmImagingBalsheetLink,
  deleteImagingBalsheetLink,
  deleteImagingSitePageAssociation,
  findImagingLockboxMatches,
  getImagingFlywireDetails,
  getImagingSiteWorkbench,
  getImagingBalsheetAssociations,
  refreshImagingBalsheetAssociations,
  replaceImagingFile,
  saveImagingSitePageAssociation,
  type ImagingBalsheetAssociationResponse,
  type ImagingBalsheetAssociationRow,
  type ImagingDocumentSuggestion,
  type ImagingFlywireDetailsResponse,
  type ImagingKeyproofSummary,
  type ImagingSitePageAssociation,
  type ImagingSiteWorkbenchResponse,
} from "../api/balsheet_api";

type ImagingPhase = "idle" | "loaded" | "matched" | "review" | "lockbox" | "site";
type ImagingReviewFile = {
  filePath?: string;
  fileName: string;
  source: "linked" | "site" | "suggested";
  matchMethod?: string;
  confidence?: number;
  bookmarkPage?: number;
  openUrl?: string;
  keyproof?: ImagingKeyproofSummary;
  pageImageUrl?: string;
  marker?: SitePostingMarker | null;
  markerStatus?: SiteMarkerStatus;
  markerLabel?: string;
  itemDetails?: ImagingAssociatedItemDetails;
};
type SiteMarkerStatus = "post" | "do_not_post" | "misc";
type SitePostingMarker = { x: number; y: number; width: number; height: number };
type ImagingAssociatedItemDetails = {
  site: string;
  postingDate: string;
  amount: number;
  payer: string;
  checkNumber: string;
  eob: string;
  note: string;
  markerStatus: SiteMarkerStatus;
};

function formatSiteMarkerStatus(status: SiteMarkerStatus | null | undefined) {
  switch (status) {
    case "do_not_post":
      return "Do Not Post";
    case "misc":
      return "Misc";
    default:
      return "Post";
  }
}

function siteMarkerStatusColor(status: SiteMarkerStatus | null | undefined) {
  switch (status) {
    case "do_not_post":
      return "#b4232a";
    case "misc":
      return "#7a5a1a";
    default:
      return "#8a6500";
  }
}

function siteMarkerStatusFillStyle(status: SiteMarkerStatus | null | undefined) {
  switch (status) {
    case "do_not_post":
      return viewImagesStyles.sitePostingMarkerStop;
    case "misc":
      return viewImagesStyles.sitePostingMarkerMisc;
    default:
      return viewImagesStyles.sitePostingMarkerPost;
  }
}

function markerFromAssociation(association: ImagingSitePageAssociation | null): SitePostingMarker | null {
  if (
    association?.markerX == null ||
    association.markerY == null ||
    association.markerWidth == null ||
    association.markerHeight == null
  ) {
    return null;
  }
  return {
    x: association.markerX,
    y: association.markerY,
    width: association.markerWidth,
    height: association.markerHeight,
  };
}

function appendCacheToken(url: string, token: number) {
  if (!token) {
    return url;
  }

  const [base, hash = ""] = url.split("#", 2);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}v=${token}${hash ? `#${hash}` : ""}`;
}

const keyproofAmountLabels: Record<string, string> = {
  cash: "Cash",
  check: "Check",
  creditCard: "Credit Card",
  eft: "EFT",
  lockbox: "Lockbox",
  foreignCheck: "Foreign Check",
  wireTransfer: "Wire Transfer",
  misc: "Misc",
};

function KeyproofDetailsBanner({ details }: { details: ImagingKeyproofSummary | null | undefined }) {
  if (!details?.available) {
    return <div style={viewImagesStyles.keyproofBannerEmpty}>No saved KeyProof details are linked to this document.</div>;
  }

  const amounts = Object.entries(details.amounts ?? {}).filter(([, amount]) => Math.abs(Number(amount)) > 0.005);
  return (
    <section style={viewImagesStyles.keyproofBanner} aria-label="Related KeyProof details">
      <div style={viewImagesStyles.keyproofBannerLead}>
        <span style={viewImagesStyles.keyproofBannerKicker}>KeyProof</span>
        <strong>{details.site || "Site not recorded"}</strong>
        <span>{details.batchDate || "Date not recorded"}</span>
      </div>
      <div style={viewImagesStyles.keyproofBannerTotals}>
        <span>KeyProof total <strong>{formatCurrency(details.keyproofTotal ?? 0)}</strong></span>
        <span>Paperwork <strong>{formatCurrency(details.paperworkTotal ?? 0)}</strong></span>
      </div>
      <div style={viewImagesStyles.keyproofBannerAmounts}>
        {amounts.map(([field, amount]) => (
          <span key={field} style={viewImagesStyles.keyproofAmountPill}>
            {keyproofAmountLabels[field] || field} <strong>{formatCurrency(Number(amount))}</strong>
          </span>
        ))}
      </div>
    </section>
  );
}

function AssociatedItemBanner({
  details,
  note,
  onNoteChange,
  drawing,
  queueNumber,
  notesOpen,
  onToggleNotes,
}: {
  details: ImagingAssociatedItemDetails;
  note?: string;
  onNoteChange?: (value: string) => void;
  drawing?: boolean;
  queueNumber?: number;
  notesOpen?: boolean;
  onToggleNotes?: () => void;
}) {
  return (
    <section style={viewImagesStyles.associatedItemBanner} aria-label="Associated itemization details">
      <div style={viewImagesStyles.associatedItemLead}>
        <span style={viewImagesStyles.keyproofBannerKicker}>Associated itemization</span>
        <strong>
          {queueNumber ? `#${queueNumber} · ` : ""}
          {details.site || "Site not recorded"}
        </strong>
        <span>{details.postingDate || "Date not recorded"}</span>
      </div>
      <div style={viewImagesStyles.associatedItemAmount}>{formatCurrency(details.amount)}</div>
      <div style={viewImagesStyles.associatedItemFacts}>
        <span>Payer <strong>{details.payer || "Not recorded"}</strong></span>
        <span>Reference <strong>{details.checkNumber || "Not recorded"}</strong></span>
        <span>EOB <strong>{details.eob || "Not recorded"}</strong></span>
        <span>
          Decision <strong style={{ color: siteMarkerStatusColor(details.markerStatus) }}>
            {formatSiteMarkerStatus(details.markerStatus)}
          </strong>
        </span>
        {details.note && <span>Saved note <strong>{details.note}</strong></span>}
      </div>
      {onNoteChange && (
        <div style={viewImagesStyles.associatedItemControls}>
          <button type="button" style={viewImagesStyles.siteNotesButton} onClick={onToggleNotes}>
            Notes
          </button>
          {notesOpen && (
            <input
              value={note ?? ""}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Notes"
              style={viewImagesStyles.siteBookmarkNote}
            />
          )}
          {notesOpen && (
            <span style={viewImagesStyles.siteBookmarkHint}>
              {drawing ? "Drag a box over the details on the page." : "Save with the green association button."}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

export default function ViewImagesScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDate = searchParams.get("day") ?? "";
  const initialEntryId = searchParams.get("entryId") ?? "";
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const autoOpenedReviewEntryIdRef = useRef("");

  const [postingDate, setPostingDate] = useState(() => displayDateToIso(initialDate));
  const [phase, setPhase] = useState<ImagingPhase>(initialDate ? "review" : "idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ImagingBalsheetAssociationResponse | null>(null);
  const [previewPath, setPreviewPath] = useState("");
  const [previewDirectUrl, setPreviewDirectUrl] = useState("");
  const [previewKeyproof, setPreviewKeyproof] = useState<ImagingKeyproofSummary | null>(null);
  const [previewPageImageUrl, setPreviewPageImageUrl] = useState("");
  const [previewPageImageBaseUrl, setPreviewPageImageBaseUrl] = useState("");
  const [previewMarker, setPreviewMarker] = useState<SitePostingMarker | null>(null);
  const [previewMarkerStatus, setPreviewMarkerStatus] = useState<SiteMarkerStatus>("post");
  const [previewMarkerLabel, setPreviewMarkerLabel] = useState("");
  const [previewItemDetails, setPreviewItemDetails] = useState<ImagingAssociatedItemDetails | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewPage, setPreviewPage] = useState(0);
  const [previewRefreshToken, setPreviewRefreshToken] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [replacementTarget, setReplacementTarget] = useState<ImagingReviewFile | null>(null);
  const [lockboxRowId, setLockboxRowId] = useState("");
  const [lockboxError, setLockboxError] = useState<string | null>(null);
  const [actionDetail, setActionDetail] = useState<string | null>(null);
  const [flywireRow, setFlywireRow] = useState<ImagingBalsheetAssociationRow | null>(null);
  const [flywireDetails, setFlywireDetails] = useState<ImagingFlywireDetailsResponse | null>(null);
  const [flywireLoading, setFlywireLoading] = useState(false);
  const [flywireError, setFlywireError] = useState<string | null>(null);
  const [siteWorkbench, setSiteWorkbench] = useState<ImagingSiteWorkbenchResponse | null>(null);
  const [siteWorkbenchLoading, setSiteWorkbenchLoading] = useState(false);
  const [siteWorkbenchSaving, setSiteWorkbenchSaving] = useState(false);
  const [siteWorkbenchError, setSiteWorkbenchError] = useState<string | null>(null);
  const [siteWorkbenchEntryId, setSiteWorkbenchEntryId] = useState("");
  const [siteWorkbenchDocumentId, setSiteWorkbenchDocumentId] = useState(0);
  const [siteWorkbenchPage, setSiteWorkbenchPage] = useState(1);
  const [siteWorkbenchNote, setSiteWorkbenchNote] = useState("");
  const [siteWorkbenchNotesOpen, setSiteWorkbenchNotesOpen] = useState(false);
  const [siteMarkerStatus, setSiteMarkerStatus] = useState<SiteMarkerStatus>("post");
  const [siteMarker, setSiteMarker] = useState<SitePostingMarker | null>(null);
  const [siteMarkerDrawing, setSiteMarkerDrawing] = useState(false);
  const [siteMarkerStart, setSiteMarkerStart] = useState<{ x: number; y: number } | null>(null);
  const [selectedReviewEntryId, setSelectedReviewEntryId] = useState(initialEntryId);
  const loadRequestRef = useRef(0);
  const initial835RefreshDoneRef = useRef(false);
  const reviewModeRequestedRef = useRef(false);
  const replacementTargetRef = useRef<ImagingReviewFile | null>(null);

  useEffect(() => {
    if (!initialDate) {
      return;
    }

    let cancelled = false;
    const runInitialLoad = async () => {
      await loadDate(initialDate);
      if (cancelled) {
        return;
      }

      if (!initial835RefreshDoneRef.current) {
        initial835RefreshDoneRef.current = true;
        await refreshMatches(initialDate);
      }
    };

    void runInitialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      cancelled = true;
    };
  }, [initialDate]);

  useEffect(() => {
    if (!initialEntryId) {
      setSelectedReviewEntryId("");
      autoOpenedReviewEntryIdRef.current = "";
      return;
    }

    setSelectedReviewEntryId(initialEntryId);
  }, [initialEntryId]);

  useEffect(() => {
    if (!initialEntryId || !data?.rows.length) {
      return;
    }

    const selectedRow = data.rows.find((row) => row.entryId === initialEntryId);
    if (!selectedRow) {
      return;
    }

    const reviewFile = getReviewFile(selectedRow);
    if (!reviewFile || autoOpenedReviewEntryIdRef.current === selectedRow.entryId) {
      return;
    }

    autoOpenedReviewEntryIdRef.current = selectedRow.entryId;
    setSelectedReviewEntryId(selectedRow.entryId);
    openReviewDocument(reviewFile);
  }, [data, initialEntryId]);

  const phaseTitle = useMemo(() => {
    if (phase === "matched") return "Image index refreshed";
    if (phase === "review") return "Reviewing rows";
    if (phase === "lockbox") return "Lockbox image association";
    if (phase === "site") return "Site image association";
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

  const siteRows = useMemo(
    () =>
      data?.rows.filter((row) => {
        const type = row.type.trim().toLowerCase();
        return type !== "eft" && type !== "lockbox";
      }) ?? [],
    [data]
  );
  const siteImageQueueRows = useMemo(
    () => siteRows.filter((row) => row.eob.trim().toUpperCase() !== "P"),
    [siteRows]
  );

  const allRows = useMemo(() => data?.rows ?? [], [data]);
  const getFlywireMatchCount = (
    flywire:
      | {
          matchCount?: number;
          exactMatchCount?: number;
        }
      | null
      | undefined
  ) => flywire?.matchCount ?? flywire?.exactMatchCount ?? 0;
  const selectedSiteWorkbenchDocument = useMemo(
    () => siteWorkbench?.documents.find((document) => document.importedFileId === siteWorkbenchDocumentId) ?? null,
    [siteWorkbench, siteWorkbenchDocumentId]
  );
  const selectedSiteWorkbenchItem = useMemo(
    () => siteWorkbench?.queue.find((item) => item.entryId === siteWorkbenchEntryId) ?? null,
    [siteWorkbench, siteWorkbenchEntryId]
  );

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
    const inputDate = displayDateToIso(nextDate);
    if (!normalizedDate || !inputDate) {
      setError("Enter a date first.");
      setData(null);
      return;
    }

    const requestId = ++loadRequestRef.current;
    setPostingDate(inputDate);
    setLoading(true);
    setError(null);
    try {
      const response = await getImagingBalsheetAssociations(normalizedDate);
      if (requestId !== loadRequestRef.current) {
        return;
      }
      setData(response.data);
      if (!reviewModeRequestedRef.current) {
        setPhase("matched");
      }
      setSearchParams({ day: inputDate }, { replace: true });
    } catch (loadError) {
      if (requestId !== loadRequestRef.current) {
        return;
      }
      setData(null);
      setError(formatImagingError(loadError, "GET", `${API_BASE}/imaging/balsheet-associations?posting_date=${encodeURIComponent(normalizedDate)}`));
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }

  async function refreshMatches(nextDate = postingDate) {
    const normalizedDate = isoDateToDisplay(nextDate);
    if (!normalizedDate) {
      setError("Enter a date first.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await refreshImagingBalsheetAssociations(normalizedDate);
      setData(response.data);
      if (!reviewModeRequestedRef.current) {
        setPhase("matched");
      }
      setSearchParams({ day: normalizedDate }, { replace: true });
      setActionDetail(`Image index refreshed. Recalculated ${response.data.rowCount} row${response.data.rowCount === 1 ? "" : "s"} from ${response.data.indexCount} indexed file${response.data.indexCount === 1 ? "" : "s"}.`);
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
    const returnPhase: ImagingPhase = phase === "site" ? "site" : "review";
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
      setPhase(returnPhase);
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

  function openPhase1() {
    reviewModeRequestedRef.current = false;
    setPhase("matched");
    void refreshMatches(postingDate);
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
      const nextSearchDate = displayDateToIso(normalizedDate) || normalizedDate;
      setSearchParams({ day: nextSearchDate }, { replace: true });
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

  async function disassociateLinkedFile(row: ImagingBalsheetAssociationRow) {
    const linked = row.linkedFiles[0];
    if (!linked) {
      setError("This row does not have a confirmed association to remove.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await deleteImagingBalsheetLink(linked.linkId);
      await loadDate(displayDateToIso(data?.postingDate ?? isoDateToDisplay(postingDate)));
      setPhase(phase === "site" ? "site" : "review");
      setActionDetail(`Removed the confirmed file link for ${row.checkNumber || row.payer || "the selected row"}.`);
    } catch (disassociateError) {
      setError(
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
    setPreviewDirectUrl("");
    setPreviewKeyproof(null);
    setPreviewPageImageUrl("");
    setPreviewPageImageBaseUrl("");
    setPreviewMarker(null);
    setPreviewMarkerStatus("post");
    setPreviewMarkerLabel("");
    setPreviewItemDetails(null);
    setPreviewTitle(fileName);
    setPreviewPage(page);
    setPreviewRefreshToken((token) => token + 1);
  }

  function openDocument(filePath: string, fileName: string, page = 0, nextPhase: ImagingPhase = "review") {
    setPreviewDocument(filePath, fileName, page);
    setIsPreviewOpen(true);
    setPhase(nextPhase);
  }

  function openReviewDocument(file: ImagingReviewFile) {
    setPreviewPath(file.filePath ?? "");
    setPreviewDirectUrl(file.openUrl ?? "");
    setPreviewKeyproof(file.keyproof ?? null);
    setPreviewPageImageBaseUrl(file.pageImageUrl ?? "");
    setPreviewPageImageUrl(file.pageImageUrl ? appendCacheToken(file.pageImageUrl, previewRefreshToken + 1) : "");
    setPreviewMarker(file.marker ?? null);
    setPreviewMarkerStatus(file.markerStatus ?? "post");
    setPreviewMarkerLabel(file.markerLabel ?? "");
    setPreviewItemDetails(file.itemDetails ?? null);
    setPreviewTitle(file.fileName);
    setPreviewPage(file.bookmarkPage ?? 0);
    setPreviewRefreshToken((token) => token + 1);
    setIsPreviewOpen(true);
    setPhase("review");
  }

  useEffect(() => {
    if (!previewPageImageBaseUrl) {
      return;
    }

    setPreviewPageImageUrl(appendCacheToken(previewPageImageBaseUrl, previewRefreshToken));
  }, [previewPageImageBaseUrl, previewRefreshToken]);

  function startReplaceScan(file: ImagingReviewFile) {
    if (!file.filePath) {
      setError("This image does not expose a replaceable file path.");
      return;
    }

    setError(null);
    setReplacementTarget(file);
    replacementTargetRef.current = file;
    if (typeof replaceFileInputRef.current?.showPicker === "function") {
      replaceFileInputRef.current.showPicker();
      return;
    }
    replaceFileInputRef.current?.click();
  }

  async function handleReplaceFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      setReplacementTarget(null);
      return;
    }

    const target = replacementTargetRef.current ?? replacementTarget;
    if (!target?.filePath) {
      setReplacementTarget(null);
      setError("No replacement target is selected.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await replaceImagingFile(target.filePath, file);
      await loadDate(data?.postingDate ?? postingDate);
      setPreviewRefreshToken((token) => token + 1);
      setActionDetail(
        `Replaced ${target.fileName} with ${file.name}. Refreshed the review image snapshot and ${response.indexCount} indexed file${response.indexCount === 1 ? "" : "s"}.`
      );
    } catch (replaceError) {
      setError(
        formatImagingError(
          replaceError,
          "POST",
          `${API_BASE}/imaging/files/replace -> ${target.filePath}`
        )
      );
    } finally {
      setReplacementTarget(null);
      replacementTargetRef.current = null;
      setLoading(false);
    }
  }

  async function openFlywireDetails(row: ImagingBalsheetAssociationRow) {
    setFlywireRow(row);
    setFlywireDetails(null);
    setFlywireError(null);
    setFlywireLoading(true);
    try {
      const response = await getImagingFlywireDetails(row.entryId);
      setFlywireDetails(response.data);
    } catch (detailsError) {
      setFlywireError(formatImagingError(detailsError, "GET", `${API_BASE}/imaging/balsheet/${row.entryId}/flywire`));
    } finally {
      setFlywireLoading(false);
    }
  }

  function selectSiteWorkbenchItem(entryId: string, workbench = siteWorkbench) {
    const item = workbench?.queue.find((candidate) => candidate.entryId === entryId);
    if (!item) return;
    setSiteWorkbenchEntryId(entryId);
    setSiteWorkbenchNote(item.association?.note ?? "");
    setSiteWorkbenchNotesOpen(Boolean(item.association?.note));
    setSiteMarker(markerFromAssociation(item.association));
    setSiteMarkerStatus(item.association?.markerStatus ?? "post");
    setSiteMarkerDrawing(false);
    setSiteMarkerStart(null);
    if (item.association) {
      setSiteWorkbenchDocumentId(item.association.importedFileId);
      setSiteWorkbenchPage(item.association.pageStart);
    }
  }

  async function openSiteWorkbench(row: ImagingBalsheetAssociationRow) {
    setSiteWorkbenchLoading(true);
    setSiteWorkbenchError(null);
    setSiteWorkbench(null);
    setSiteWorkbenchEntryId(row.entryId);
    try {
      const response = await getImagingSiteWorkbench(row.postingDate, row.type);
      const workbench = response.data;
      setSiteWorkbench(workbench);
      const selectedDocument = workbench.documents[0];
      const requestedItem = workbench.queue.find((item) => item.entryId === row.entryId);
      const firstPending = workbench.queue.find((item) => !item.association);
      const selectedItem = requestedItem?.association ? requestedItem : firstPending ?? requestedItem ?? workbench.queue[0];
      setSiteWorkbenchDocumentId(selectedItem?.association?.importedFileId ?? selectedDocument?.importedFileId ?? 0);
      setSiteWorkbenchEntryId(selectedItem?.entryId ?? "");
      setSiteWorkbenchPage(selectedItem?.association?.pageStart ?? 1);
      setSiteWorkbenchNote(selectedItem?.association?.note ?? "");
      setSiteWorkbenchNotesOpen(Boolean(selectedItem?.association?.note));
      setSiteMarker(markerFromAssociation(selectedItem?.association ?? null));
      setSiteMarkerStatus(selectedItem?.association?.markerStatus ?? "post");
      setSiteMarkerDrawing(false);
      setSiteMarkerStart(null);
    } catch (workbenchError) {
      setSiteWorkbenchError(
        formatImagingError(workbenchError, "GET", `${API_BASE}/imaging/site-workbench?posting_date=${row.postingDate}&site=${row.type}`)
      );
    } finally {
      setSiteWorkbenchLoading(false);
    }
  }

  async function bookmarkAndAssociateSitePage() {
    if (!siteWorkbench || !selectedSiteWorkbenchItem || !selectedSiteWorkbenchDocument) return;
    setSiteWorkbenchSaving(true);
    setSiteWorkbenchError(null);
    try {
      const response = await saveImagingSitePageAssociation({
        entryId: selectedSiteWorkbenchItem.entryId,
        importedFileId: selectedSiteWorkbenchDocument.importedFileId,
        pageNumber: siteWorkbenchPage,
        note: siteWorkbenchNote,
        marker: siteMarker,
        markerStatus: siteMarkerStatus,
      });
      const updated = response.data;
      setSiteWorkbench(updated);
      const currentIndex = updated.queue.findIndex((item) => item.entryId === selectedSiteWorkbenchItem.entryId);
      const nextPending = [
        ...updated.queue.slice(currentIndex + 1),
        ...updated.queue.slice(0, Math.max(currentIndex, 0)),
      ].find((item) => !item.association);
      if (nextPending) {
        setSiteWorkbenchEntryId(nextPending.entryId);
        setSiteWorkbenchNote("");
        setSiteWorkbenchNotesOpen(false);
        setSiteMarker(null);
        setSiteMarkerStatus("post");
        setSiteMarkerDrawing(false);
        setSiteWorkbenchPage((currentPage) =>
          Math.min(currentPage + 1, selectedSiteWorkbenchDocument.pageCount || currentPage + 1)
        );
      }
      await loadDate(displayDateToIso(updated.postingDate));
      setPhase("site");
    } catch (associationError) {
      setSiteWorkbenchError(
        formatImagingError(associationError, "POST", `${API_BASE}/imaging/site-page-associations`)
      );
    } finally {
      setSiteWorkbenchSaving(false);
    }
  }

  function changeSiteWorkbenchPage(page: number) {
    setSiteWorkbenchPage(Math.max(1, Math.min(page, selectedSiteWorkbenchDocument?.pageCount || page)));
    setSiteMarker(null);
    setSiteMarkerDrawing(false);
    setSiteMarkerStart(null);
  }

  function siteMarkerPoint(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  }

  function beginSiteMarker(event: ReactPointerEvent<HTMLDivElement>) {
    if (!siteMarkerDrawing) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = siteMarkerPoint(event);
    setSiteMarkerStart(point);
    setSiteMarker({ x: point.x, y: point.y, width: 0, height: 0 });
  }

  function updateSiteMarker(event: ReactPointerEvent<HTMLDivElement>) {
    if (!siteMarkerDrawing || !siteMarkerStart) return;
    const point = siteMarkerPoint(event);
    setSiteMarker({
      x: Math.min(siteMarkerStart.x, point.x),
      y: Math.min(siteMarkerStart.y, point.y),
      width: Math.abs(point.x - siteMarkerStart.x),
      height: Math.abs(point.y - siteMarkerStart.y),
    });
  }

  function finishSiteMarker(event: ReactPointerEvent<HTMLDivElement>) {
    if (!siteMarkerStart) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setSiteMarkerStart(null);
    setSiteMarkerDrawing(false);
    setSiteMarker((marker) => (marker && marker.width >= 0.01 && marker.height >= 0.01 ? marker : null));
  }

  async function removeSitePageAssociation(entryId: string) {
    setSiteWorkbenchSaving(true);
    setSiteWorkbenchError(null);
    try {
      const response = await deleteImagingSitePageAssociation(entryId);
      setSiteWorkbench(response.data);
      selectSiteWorkbenchItem(entryId, response.data);
      await loadDate(displayDateToIso(response.data.postingDate));
      setPhase("site");
    } catch (associationError) {
      setSiteWorkbenchError(
        formatImagingError(associationError, "DELETE", `${API_BASE}/imaging/site-page-associations/${entryId}`)
      );
    } finally {
      setSiteWorkbenchSaving(false);
    }
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

    const siteAssociation = row.siteAssociation;
    if (siteAssociation) {
      return {
        fileName: siteAssociation.fileName,
        source: "site",
        matchMethod: "site-page-bookmark",
        confidence: 1,
        bookmarkPage: siteAssociation.pageStart,
        openUrl: buildImagingSiteDocumentOpenUrl(siteAssociation.importedFileId, siteAssociation.pageStart),
        keyproof: siteAssociation.keyproof,
        pageImageUrl: buildImagingSitePageUrl(siteAssociation.importedFileId, siteAssociation.pageStart),
        marker: markerFromAssociation(siteAssociation),
        markerStatus: siteAssociation.markerStatus,
        markerLabel: `${formatSiteMarkerStatus(siteAssociation.markerStatus).toUpperCase()} · ${formatCurrency(row.amount)}`,
        itemDetails: {
          site: row.type,
          postingDate: row.postingDate,
          amount: row.amount,
          payer: row.payer,
          checkNumber: row.checkNumber,
          eob: row.eob,
          note: siteAssociation.note,
          markerStatus: siteAssociation.markerStatus,
        },
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

  useEffect(() => {
    if (phase !== "review" || !data?.rows.length || !selectedReviewEntryId) {
      return;
    }

    const selectedRow = data.rows.find((row) => row.entryId === selectedReviewEntryId);
    if (!selectedRow) {
      return;
    }

    const reviewFile = getReviewFile(selectedRow);
    if (reviewFile && autoOpenedReviewEntryIdRef.current !== selectedRow.entryId) {
      autoOpenedReviewEntryIdRef.current = selectedRow.entryId;
      openReviewDocument(reviewFile);
      return;
    }
  }, [data, phase, selectedReviewEntryId]);

  const sidebarControls = (
    <div style={viewImagesStyles.sidebarStack}>
      <label style={viewImagesStyles.sidebarDateField}>
        <input
          type="date"
          value={postingDate}
          onChange={(event) => {
            const nextDate = event.target.value;
            setPostingDate(nextDate);
            void loadDate(nextDate);
          }}
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
        onClick={() => openPhase1()}
        style={{
          ...adminStyles.navButton,
          ...(phase === "matched" ? adminStyles.navButtonBack : null),
        }}
        disabled={loading}
      >
        <span style={adminStyles.navButtonLabel}>Phase 1 - Balsheet</span>
        <span style={adminStyles.navButtonGlyph}>&gt;</span>
      </button>

      <div style={{ display: "grid", gap: "8px" }}>
        <button
          type="button"
          onClick={() => setPhase("lockbox")}
          style={{
            ...adminStyles.navButton,
            ...(phase === "lockbox" ? adminStyles.navButtonBack : null),
          }}
          disabled={!data}
        >
          <span style={adminStyles.navButtonLabel}>Phase 2 - Lockbox</span>
          <span style={adminStyles.navButtonGlyph}>&gt;</span>
        </button>

        <button
          type="button"
          onClick={() => setPhase("site")}
          style={{
            ...adminStyles.navButton,
            ...(phase === "site" ? adminStyles.navButtonBack : null),
          }}
          disabled={!data}
        >
          <span style={adminStyles.navButtonLabel}>Phase 3 - Sites</span>
          <span style={adminStyles.navButtonGlyph}>&gt;</span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          reviewModeRequestedRef.current = true;
          setPhase("review");
        }}
        style={{
          ...adminStyles.navButton,
          ...(phase === "review" ? adminStyles.navButtonBack : null),
        }}
        disabled={!data}
      >
        <span style={adminStyles.navButtonLabel}>View</span>
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

  useEffect(() => {
    if (!siteWorkbench) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (event.key === "Escape") {
        setSiteWorkbench(null);
      } else if (event.key === "ArrowRight" || event.key === "PageDown") {
        setSiteWorkbenchPage((page) => Math.min(page + 1, selectedSiteWorkbenchDocument?.pageCount || page + 1));
        setSiteMarker(null);
        setSiteMarkerDrawing(false);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        setSiteWorkbenchPage((page) => Math.max(1, page - 1));
        setSiteMarker(null);
        setSiteMarkerDrawing(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedSiteWorkbenchDocument?.pageCount, siteWorkbench]);

  const previewUrl = previewDirectUrl
    ? appendCacheToken(previewDirectUrl, previewRefreshToken)
    : previewPath
      ? appendCacheToken(buildImagingFileOpenUrl(previewPath, previewPage), previewRefreshToken)
      : "";

  return (
    <AdminShell
      sidebarCopy="A dedicated imaging workspace for matching Balsheet rows to source files and opening the original PDF."
      onBack={() => navigate("/collections")}
      backButtonFirst
      useGlobalMenuFallback
      sidebarTopCard={sidebarControls}
    >
      <input
        ref={replaceFileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        }}
        onChange={handleReplaceFileChange}
      />

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
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <div style={adminStyles.sectionMeta}>
                  Confirm a suggested file to save the association, then use the view button to open the original PDF.
                </div>
                <button
                  type="button"
                  onClick={() => void commitExactMatches()}
                  style={{
                    ...adminStyles.navButton,
                    paddingInline: "18px",
                    minHeight: "56px",
                    ...(phase === "review" ? adminStyles.navButtonBack : null),
                  }}
                  disabled={loading || !data}
                  title={
                    exactMatchCount > 0
                      ? `Commit ${exactMatchCount} exact match${exactMatchCount === 1 ? "" : "es"}`
                      : "Commit exact matches if any are available"
                  }
                >
                  <span style={adminStyles.navButtonLabel}>Commit 100% {exactMatchCount > 0 ? `(${exactMatchCount})` : ""}</span>
                  <span style={adminStyles.navButtonGlyph}>&gt;</span>
                </button>
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
                            <div style={adminStyles.sectionKicker}>View</div>
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
                          const isPaymentPlan = row.eob.trim().toUpperCase() === "P";
                          const isSelectedRow = row.entryId === selectedReviewEntryId;
                          return (
                            <div
                              key={row.entryId}
                              style={{
                                ...viewImagesStyles.reviewTableRow,
                                ...(isSelectedRow ? viewImagesStyles.reviewTableRowSelected : null),
                              }}
                            >
                              <div style={viewImagesStyles.reviewColumnType}>{row.type || group.type}</div>
                              <div style={viewImagesStyles.reviewColumnAmount}>{formatCurrency(row.amount)}</div>
                              <div style={viewImagesStyles.reviewColumnPayer}>{row.payer || "Untitled payer"}</div>
                              <div style={viewImagesStyles.reviewColumnCheck}>{row.checkNumber || "No check number"}</div>
                              <div style={viewImagesStyles.reviewColumnImage}>
                                {reviewFile || isPaymentPlan ? (
                                  <div style={viewImagesStyles.reviewImageInline}>
                                    {reviewFile && (
                                      <>
                                        <button
                                          type="button"
                                          style={viewImagesStyles.smallButton}
                                          onClick={() => openReviewDocument(reviewFile)}
                                        >
                                          View Image
                                        </button>
                                        <button
                                          type="button"
                                          style={viewImagesStyles.smallButtonSecondary}
                                          onClick={() => startReplaceScan(reviewFile)}
                                          disabled={loading}
                                        >
                                          Replace
                                        </button>
                                        <span style={viewImagesStyles.reviewImageMeta}>
                                          {typeof reviewFile.confidence === "number"
                                            ? `${Math.round(reviewFile.confidence * 100)}% image`
                                            : "Image matched"}
                                        </span>
                                      </>
                                    )}
                                    {isPaymentPlan && (
                                      <>
                                        <button
                                          type="button"
                                          style={viewImagesStyles.flywireButton}
                                          onClick={() => void openFlywireDetails(row)}
                                        >
                                          View Fly Wire
                                        </button>
                                        <span style={viewImagesStyles.reviewImageMeta}>
                                          {getFlywireMatchCount(row.flywire)
                                            ? `${Math.round((row.flywire?.confidence ?? 0) * 100)}% Fly Wire${row.flywire?.ambiguous ? ` · ${getFlywireMatchCount(row.flywire)} candidates` : ""}`
                                            : row.flywire?.available
                                              ? "Fly Wire found · no amount match"
                                              : "Fly Wire missing"}
                                        </span>
                                      </>
                                    )}
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
                    {phase === "site" && (
                      <div style={viewImagesStyles.siteImagesHeader}>
                        <div>
                          <div style={adminStyles.sectionKicker}>Site images</div>
                          <h3 style={adminStyles.sectionTitle}>Scanned paperwork by site</h3>
                        </div>
                        <div style={viewImagesStyles.siteImagesHeaderActions}>
                          <div style={viewImagesStyles.siteImagesMeta}>
                            {siteImageQueueRows.filter((row) => !row.siteAssociation).length} of {siteImageQueueRows.length} item
                            {siteImageQueueRows.length === 1 ? "" : "s"} need page association. Payment Plans use Fly Wire details.
                          </div>
                          {Array.from(new Map(siteImageQueueRows.map((row) => [row.type.trim().toLowerCase(), row])).values()).map((row) => (
                            <button
                              key={row.type}
                              type="button"
                              style={viewImagesStyles.siteWorkbenchButton}
                              onClick={() => void openSiteWorkbench(row)}
                            >
                              Open {row.type || "Site"} Queue
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {(phase === "site" ? siteRows : allRows).length === 0 ? (
                      <div style={viewImagesStyles.emptyState}>
                        {phase === "site"
                          ? `No Site Image rows were found for ${data.postingDate}.`
                          : `No Balsheet rows were found for ${data.postingDate}.`}
                      </div>
                    ) : (
                      (phase === "site" ? siteRows : allRows).map((row) => (
                        <article key={row.entryId} style={viewImagesStyles.rowCard}>
                          <div style={viewImagesStyles.rowTop}>
                            <div>
                              <div style={viewImagesStyles.rowTitle}>
                                {phase === "site" ? row.type || "Unspecified site" : row.payer || "Untitled payer"}
                              </div>
                              <div style={viewImagesStyles.rowMeta}>
                                {phase === "site" && row.payer ? `${row.payer} · ` : ""}
                                {row.postingDate} · {formatCurrency(row.amount)} · {row.checkNumber || "No check number"}
                              </div>
                            </div>
                            <div style={viewImagesStyles.rowTopActions}>
                              {phase === "site" && row.eob.trim().toUpperCase() === "P" && (
                                <button
                                  type="button"
                                  style={viewImagesStyles.flywireButton}
                                  onClick={() => void openFlywireDetails(row)}
                                >
                                  View Fly Wire Details
                                </button>
                              )}
                              <span style={viewImagesStyles.rowBadge}>
                                {phase === "site" && row.eob.trim().toUpperCase() === "P"
                                  ? getFlywireMatchCount(row.flywire)
                                    ? "Fly Wire 100%"
                                    : "Fly Wire"
                                  : phase === "site" && row.siteAssociation
                                  ? `Page ${row.siteAssociation.pageStart} associated`
                                  : row.linkedFiles.length > 0
                                    ? `${row.linkedFiles.length} linked`
                                    : `${row.matches.length} suggested`}
                              </span>
                            </div>
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
                                        onClick={() =>
                                          openDocument(file.filePath, file.fileName, file.bookmarkPage || 0, phase === "site" ? "site" : "review")
                                        }
                                      >
                                        View PDF
                                      </button>
                                      <a
                                        href={appendCacheToken(buildImagingFileOpenUrl(file.filePath), previewRefreshToken)}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={viewImagesStyles.smallLink}
                                      >
                                        Open
                                      </a>
                                      <button
                                        type="button"
                                        style={viewImagesStyles.smallButtonSecondary}
                                        onClick={() => void disassociateLinkedFile(row)}
                                        disabled={loading}
                                      >
                                        Disassociate
                                      </button>
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
                                        onClick={() => openDocument(match.filePath, match.fileName, match.bookmarkPage || 0, phase === "site" ? "site" : "review")}
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

            {isPreviewOpen && previewUrl
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

                      {previewItemDetails
                        ? <AssociatedItemBanner details={previewItemDetails} />
                        : previewKeyproof && <KeyproofDetailsBanner details={previewKeyproof} />}

                      {previewPageImageUrl ? (
                        <div style={viewImagesStyles.reviewMarkedPageCanvas}>
                          <div style={viewImagesStyles.sitePageImageStage}>
                            <img
                              src={previewPageImageUrl}
                              alt={`${previewTitle || "Site image"}, page ${previewPage}`}
                              style={viewImagesStyles.sitePageImage}
                              draggable={false}
                            />
                            {previewMarker && (
                              <div
                                style={{
                                  ...viewImagesStyles.sitePostingMarker,
                                  ...siteMarkerStatusFillStyle(previewMarkerStatus),
                                  left: `${previewMarker.x * 100}%`,
                                  top: `${previewMarker.y * 100}%`,
                                  width: `${previewMarker.width * 100}%`,
                                  height: `${previewMarker.height * 100}%`,
                                }}
                              >
                                <span style={viewImagesStyles.sitePostingMarkerLabel}>
                                  {previewMarkerLabel || formatSiteMarkerStatus(previewMarkerStatus).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <iframe
                          title={previewTitle || "Original PDF"}
                          src={previewUrl}
                          style={viewImagesStyles.previewFrame}
                        />
                      )}
                    </div>
                  </div>,
                  document.body
                )
              : null}

            {siteWorkbench || siteWorkbenchLoading || siteWorkbenchError
              ? createPortal(
                  <div style={viewImagesStyles.previewOverlay} role="dialog" aria-modal="true" aria-label="Site image association workbench">
                    <div style={viewImagesStyles.siteWorkbenchModal}>
                      <div style={viewImagesStyles.siteWorkbenchTopbar}>
                        <div>
                          <div style={viewImagesStyles.siteWorkbenchSummaryRow}>
                            <span style={viewImagesStyles.siteWorkbenchKicker}>Site image association workbench</span>
                            <div style={viewImagesStyles.siteWorkbenchSummary}>
                              {siteWorkbench
                                ? `${siteWorkbench.postingDate} · ${siteWorkbench.associatedCount} of ${siteWorkbench.queueCount} associated · ${formatCurrency(siteWorkbench.queueTotal)}`
                                : "Finding accepted Site Review paperwork..."}
                            </div>
                            <h2 style={viewImagesStyles.siteWorkbenchInlineTitle}>{siteWorkbench?.site || "Loading site queue"}</h2>
                          </div>
                        </div>
                        <div style={viewImagesStyles.previewHeaderActions}>
                          {selectedSiteWorkbenchDocument && (
                            <a
                              href={buildImagingSiteDocumentOpenUrl(selectedSiteWorkbenchDocument.importedFileId)}
                              target="_blank"
                              rel="noreferrer"
                              style={viewImagesStyles.previewOpenLink}
                            >
                              Open original PDF
                            </a>
                          )}
                          <button
                            type="button"
                            style={viewImagesStyles.smallButtonSecondary}
                            onClick={() => {
                              setSiteWorkbench(null);
                              setSiteWorkbenchError(null);
                            }}
                          >
                            Close
                          </button>
                        </div>
                      </div>

                      <div style={viewImagesStyles.siteWorkbenchBody}>
                        {siteWorkbenchError && <div style={viewImagesStyles.errorBanner}>{siteWorkbenchError}</div>}
                        {siteWorkbenchLoading && <div style={viewImagesStyles.emptyState}>Loading accepted paperwork and queue...</div>}

                        {siteWorkbench && (
                          <div style={viewImagesStyles.siteWorkbenchLayout}>
                          <section style={viewImagesStyles.siteWorkbenchViewer}>
                            <div style={viewImagesStyles.siteWorkbenchControls}>
                              <select
                                value={siteWorkbenchDocumentId}
                                onChange={(event) => {
                                  setSiteWorkbenchDocumentId(Number(event.target.value));
                                  setSiteWorkbenchPage(1);
                                  setSiteMarker(null);
                                  setSiteMarkerDrawing(false);
                                }}
                                style={viewImagesStyles.siteWorkbenchSelect}
                                aria-label="Accepted Site Review document"
                              >
                                {siteWorkbench.documents.map((document) => (
                                  <option key={document.importedFileId} value={document.importedFileId}>
                                    {document.fileName} · {formatCurrency(document.total)}
                                  </option>
                                ))}
                              </select>
                              <div style={viewImagesStyles.sitePageControls}>
                                <button
                                  type="button"
                                  style={viewImagesStyles.smallButton}
                                  onClick={() => changeSiteWorkbenchPage(siteWorkbenchPage - 1)}
                                  disabled={siteWorkbenchPage <= 1}
                                >
                                  Previous
                                </button>
                                <label style={viewImagesStyles.sitePageField}>
                                  Page
                                  <input
                                    type="number"
                                    min={1}
                                    max={selectedSiteWorkbenchDocument?.pageCount || undefined}
                                    value={siteWorkbenchPage}
                                    onChange={(event) => changeSiteWorkbenchPage(Number(event.target.value) || 1)}
                                    style={viewImagesStyles.sitePageInput}
                                  />
                                  <span>of {selectedSiteWorkbenchDocument?.pageCount || "?"}</span>
                                </label>
                                <button
                                  type="button"
                                  style={viewImagesStyles.smallButton}
                                  onClick={() => changeSiteWorkbenchPage(siteWorkbenchPage + 1)}
                                  disabled={Boolean(
                                    selectedSiteWorkbenchDocument?.pageCount &&
                                      siteWorkbenchPage >= selectedSiteWorkbenchDocument.pageCount
                                  )}
                                >
                                  Next
                                </button>
                              </div>
                              <div style={viewImagesStyles.siteMarkerControls}>
                                <button
                                  type="button"
                                  style={{
                                    ...viewImagesStyles.siteMarkerChoice,
                                    ...viewImagesStyles.siteMarkerChoicePost,
                                    ...(siteMarkerStatus === "post" ? viewImagesStyles.siteMarkerChoiceActive : null),
                                  }}
                                  onClick={() => setSiteMarkerStatus("post")}
                                >
                                  Post
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    ...viewImagesStyles.siteMarkerChoice,
                                    ...viewImagesStyles.siteMarkerChoiceStop,
                                    ...(siteMarkerStatus === "do_not_post" ? viewImagesStyles.siteMarkerChoiceActive : null),
                                  }}
                                  onClick={() => setSiteMarkerStatus("do_not_post")}
                                >
                                  Do Not Post
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    ...viewImagesStyles.siteMarkerChoice,
                                    ...viewImagesStyles.siteMarkerChoiceMisc,
                                    ...(siteMarkerStatus === "misc" ? viewImagesStyles.siteMarkerChoiceActive : null),
                                  }}
                                  onClick={() => setSiteMarkerStatus("misc")}
                                >
                                  Misc
                                </button>
                                <button
                                  type="button"
                                  style={viewImagesStyles.smallButtonSecondary}
                                  onClick={() => {
                                    setSiteMarker(null);
                                    setSiteMarkerDrawing(true);
                                  }}
                                >
                                  {siteMarker ? "Redraw Marker" : "Draw Marker"}
                                </button>
                                {siteMarker && (
                                  <button type="button" style={viewImagesStyles.siteMarkerClear} onClick={() => setSiteMarker(null)}>
                                    Clear
                                  </button>
                                )}
                              </div>
                              <button
                                type="button"
                                style={viewImagesStyles.siteAssociateButton}
                                onClick={() => void bookmarkAndAssociateSitePage()}
                                disabled={siteWorkbenchSaving || !selectedSiteWorkbenchDocument || !selectedSiteWorkbenchItem}
                              >
                                {siteWorkbenchSaving
                                  ? "Saving..."
                                  : selectedSiteWorkbenchItem
                                    ? `Associate Page ${siteWorkbenchPage} to Item #${selectedSiteWorkbenchItem.queueNumber}`
                                    : "Select a Queue Item"}
                              </button>
                            </div>

                            {selectedSiteWorkbenchItem && (
                              <AssociatedItemBanner
                                details={{
                                  site: selectedSiteWorkbenchItem.site,
                                  postingDate: selectedSiteWorkbenchItem.postingDate,
                                  amount: selectedSiteWorkbenchItem.amount,
                                  payer: selectedSiteWorkbenchItem.payer,
                                  checkNumber: selectedSiteWorkbenchItem.checkNumber,
                                  eob: selectedSiteWorkbenchItem.eob,
                                  note: siteWorkbenchNote,
                                  markerStatus: siteMarkerStatus,
                                }}
                                note={siteWorkbenchNote}
                                onNoteChange={setSiteWorkbenchNote}
                                drawing={siteMarkerDrawing}
                                queueNumber={selectedSiteWorkbenchItem.queueNumber}
                                notesOpen={siteWorkbenchNotesOpen}
                                onToggleNotes={() => setSiteWorkbenchNotesOpen((current) => !current)}
                              />
                            )}

                            {selectedSiteWorkbenchDocument ? (
                              <div style={viewImagesStyles.sitePageCanvas}>
                                <div
                                  style={{
                                    ...viewImagesStyles.sitePageImageStage,
                                    ...(siteMarkerDrawing ? viewImagesStyles.sitePageImageStageDrawing : null),
                                  }}
                                  onPointerDown={beginSiteMarker}
                                  onPointerMove={updateSiteMarker}
                                  onPointerUp={finishSiteMarker}
                                  onPointerCancel={finishSiteMarker}
                                >
                                  <img
                                    key={`${selectedSiteWorkbenchDocument.importedFileId}-${siteWorkbenchPage}-${previewRefreshToken}`}
                                    src={appendCacheToken(
                                      buildImagingSitePageUrl(selectedSiteWorkbenchDocument.importedFileId, siteWorkbenchPage),
                                      previewRefreshToken
                                    )}
                                    alt={`${selectedSiteWorkbenchDocument.fileName}, page ${siteWorkbenchPage}`}
                                    style={viewImagesStyles.sitePageImage}
                                    draggable={false}
                                  />
                                  {siteMarker && siteMarker.width > 0 && siteMarker.height > 0 && (
                                    <div
                                      style={{
                                        ...viewImagesStyles.sitePostingMarker,
                                        ...siteMarkerStatusFillStyle(siteMarkerStatus),
                                        left: `${siteMarker.x * 100}%`,
                                        top: `${siteMarker.y * 100}%`,
                                        width: `${siteMarker.width * 100}%`,
                                        height: `${siteMarker.height * 100}%`,
                                      }}
                                    >
                                      <span style={viewImagesStyles.sitePostingMarkerLabel}>
                                        #{selectedSiteWorkbenchItem?.queueNumber || "?"} · {formatSiteMarkerStatus(siteMarkerStatus).toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div style={viewImagesStyles.emptyState}>No accepted Site Review PDF matches this site and date.</div>
                            )}

                          </section>

                          <aside style={viewImagesStyles.siteQueuePanel}>
                            <div style={viewImagesStyles.siteQueueHeader}>
                              <div>
                                <div style={adminStyles.sectionKicker}>Association queue</div>
                                <strong>{siteWorkbench.queueCount - siteWorkbench.associatedCount} remaining</strong>
                              </div>
                              <span>Click an item to make it active.</span>
                            </div>
                            <div style={viewImagesStyles.siteQueueList}>
                              {siteWorkbench.queue.map((item) => {
                                const active = item.entryId === siteWorkbenchEntryId;
                                return (
                                  <button
                                    key={item.entryId}
                                    type="button"
                                    style={{
                                      ...viewImagesStyles.siteQueueItem,
                                      ...(active ? viewImagesStyles.siteQueueItemActive : null),
                                      ...(item.association ? viewImagesStyles.siteQueueItemComplete : null),
                                    }}
                                    onClick={() => selectSiteWorkbenchItem(item.entryId)}
                                  >
                                    <span style={viewImagesStyles.siteQueueNumber}>{item.queueNumber}</span>
                                    <span style={viewImagesStyles.siteQueueCopy}>
                                      <strong>{formatCurrency(item.amount)}</strong>
                                      <span>{item.payer || "Untitled payer"}</span>
                                      <small>{item.checkNumber || "No reference"}</small>
                                    </span>
                                    <span style={viewImagesStyles.siteQueueStatus}>
                                      {item.association
                                        ? `${item.association.markerWidth ? `${formatSiteMarkerStatus(item.association.markerStatus)} · ` : ""}Page ${item.association.pageStart}`
                                        : "Pending"}
                                    </span>
                                    {item.association && (
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        style={viewImagesStyles.siteUndoButton}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void removeSitePageAssociation(item.entryId);
                                        }}
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            void removeSitePageAssociation(item.entryId);
                                          }
                                        }}
                                      >
                                        Undo
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </aside>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>,
                  document.body
                )
              : null}

            {flywireRow
              ? createPortal(
                  <div
                    style={viewImagesStyles.previewOverlay}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Fly Wire details"
                    onClick={() => setFlywireRow(null)}
                  >
                    <div style={viewImagesStyles.flywireModal} onClick={(event) => event.stopPropagation()}>
                      <div style={viewImagesStyles.previewHeader}>
                        <div>
                          <div style={adminStyles.sectionKicker}>Payment Plan · Fly Wire</div>
                          <h2 style={adminStyles.sectionTitle}>{flywireRow.type || "Site payment plan"}</h2>
                          <div style={viewImagesStyles.previewMeta}>
                            {flywireRow.postingDate} · {formatCurrency(flywireRow.amount)} · {flywireRow.payer || "No payer"}
                          </div>
                        </div>
                        <button type="button" style={viewImagesStyles.smallButtonSecondary} onClick={() => setFlywireRow(null)}>
                          Close
                        </button>
                      </div>

                      <div style={viewImagesStyles.flywireModalBody}>
                        {flywireLoading && <div style={viewImagesStyles.emptyState}>Loading the Fly Wire workbook details...</div>}
                        {flywireError && <div style={viewImagesStyles.errorBanner}>{flywireError}</div>}
                        {!flywireLoading && !flywireError && flywireDetails && !flywireDetails.available && (
                          <div style={viewImagesStyles.emptyState}>No Fly Wire workbook was found for this Payment Plan date.</div>
                        )}

                        {!flywireLoading && flywireDetails?.available && (
                          <>
                            <div style={viewImagesStyles.flywireMatchSummary}>
                              <strong>
                                {getFlywireMatchCount(flywireDetails)} matching row
                                {getFlywireMatchCount(flywireDetails) === 1 ? "" : "s"}
                              </strong>
                              <span>
                                {flywireDetails.checkMatchCount && flywireDetails.checkMatchCount > 0
                                  ? "The highlighted row also matches the Balsheet check number."
                                  : flywireDetails.ambiguous
                                    ? "More than one Fly Wire row has this amount. Review the highlighted candidates."
                                    : "The highlighted row matches the Balsheet posting date and amount."}
                              </span>
                            </div>

                            {flywireDetails.documents.map((documentPayload) => (
                              <section key={documentPayload.document?.id ?? documentPayload.document?.source_filename} style={viewImagesStyles.flywireDocument}>
                                <div style={viewImagesStyles.flywireDocumentHeader}>
                                  <div>
                                    <div style={viewImagesStyles.fileGroupLabel}>Imported workbook</div>
                                    <div style={viewImagesStyles.flywireDocumentTitle}>
                                      {documentPayload.document?.source_filename || "Fly Wire workbook"}
                                    </div>
                                    <div style={viewImagesStyles.flywireDocumentMeta}>
                                      Sheet {documentPayload.document?.sheet_name || "unknown"} · Batch {documentPayload.document?.batch_id || "unknown"}
                                    </div>
                                  </div>
                                  <div style={viewImagesStyles.flywireDocumentTotal}>
                                    {formatCurrency(documentPayload.document?.total_amount ?? 0)}
                                    <span>{documentPayload.rows.length} rows</span>
                                  </div>
                                </div>

                                <div style={viewImagesStyles.flywireRows}>
                                  {[...documentPayload.rows]
                                    .sort((left, right) => {
                                      const matchDifference =
                                        Number(documentPayload.matched_row_ids.includes(right.id)) -
                                        Number(documentPayload.matched_row_ids.includes(left.id));
                                      return matchDifference || (left.position ?? 0) - (right.position ?? 0);
                                    })
                                    .map((flywireItem) => {
                                      const isMatch = documentPayload.matched_row_ids.includes(flywireItem.id);
                                      return (
                                      <article
                                        key={flywireItem.id}
                                        style={{
                                          ...viewImagesStyles.flywireRow,
                                          ...(isMatch ? viewImagesStyles.flywireRowMatched : null),
                                        }}
                                      >
                                        <div style={viewImagesStyles.flywireRowTop}>
                                          <div>
                                            <div style={viewImagesStyles.flywireRowTitle}>
                                              {flywireItem.patient_name || flywireItem.billing_name || `Fly Wire row ${flywireItem.position}`}
                                            </div>
                                            <div style={viewImagesStyles.flywireRowMeta}>
                                              {[flywireItem.location, flywireItem.department, flywireItem.payment_method, flywireItem.payment_type]
                                                .filter(Boolean)
                                                .join(" · ") || "No payment metadata"}
                                            </div>
                                          </div>
                                          <div style={viewImagesStyles.flywireRowAmount}>
                                            {formatCurrency(flywireItem.amount ?? 0)}
                                            {isMatch && <span style={viewImagesStyles.flywireExactBadge}>Exact match</span>}
                                          </div>
                                        </div>
                                        <div style={viewImagesStyles.flywireFacts}>
                                          <span>Flywire ID: {flywireItem.flywire_id || "—"}</span>
                                          <span>Account: {flywireItem.account_number || "—"}</span>
                                          <span>Billing: {flywireItem.billing_name || "—"}</span>
                                          <span>Application: {flywireItem.application || "—"}</span>
                                          <span>Time: {flywireItem.time_text || "—"}</span>
                                        </div>
                                        <details style={viewImagesStyles.flywireRawDetails}>
                                          <summary>All imported fields</summary>
                                          <pre style={viewImagesStyles.flywireRawJson}>{formatFlywireRawJson(flywireItem.raw_json)}</pre>
                                        </details>
                                      </article>
                                      );
                                    })}
                                </div>
                              </section>
                            ))}
                          </>
                        )}
                      </div>
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

function formatFlywireRawJson(value: string | null | undefined) {
  if (!value) return "No original row data was stored.";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function isoDateToDisplay(value: string | null | undefined) {
  const raw = String(value ?? "").trim().replace(/[,\s]+$/g, "");
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
  const raw = String(value ?? "").trim().replace(/[,\s]+$/g, "");
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
    gridTemplateColumns: "110px 120px minmax(180px, 1fr) 160px minmax(280px, auto)",
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
    gridTemplateColumns: "110px 120px minmax(180px, 1fr) 160px minmax(280px, auto)",
    gap: "10px",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: "14px",
    background: "rgba(250, 252, 255, 0.96)",
    border: "1px solid rgba(140, 160, 184, 0.12)",
  },
  reviewTableRowSelected: {
    borderColor: "rgba(45, 111, 176, 0.35)",
    boxShadow: "0 0 0 2px rgba(45, 111, 176, 0.10) inset",
    background: "linear-gradient(135deg, rgba(244, 249, 255, 0.98) 0%, rgba(236, 245, 255, 0.98) 100%)",
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
    flexWrap: "wrap",
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
  siteImagesHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "18px",
    flexWrap: "wrap",
    padding: "16px 18px",
    borderRadius: "22px",
    border: "1px solid rgba(52, 122, 102, 0.20)",
    background:
      "linear-gradient(135deg, rgba(235, 249, 241, 0.98) 0%, rgba(247, 252, 255, 0.96) 58%, rgba(255, 247, 235, 0.94) 100%)",
    boxShadow: "0 18px 38px rgba(38, 92, 77, 0.08)",
  },
  siteImagesMeta: {
    maxWidth: "58ch",
    color: "#4f6f66",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.5,
  },
  siteImagesHeaderActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
    flexWrap: "wrap",
  },
  siteWorkbenchButton: {
    border: "1px solid rgba(31, 108, 86, 0.28)",
    borderRadius: "999px",
    padding: "9px 13px",
    background: "#185f4d",
    color: "#ffffff",
    fontSize: "11px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(24, 95, 77, 0.16)",
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
  rowTopActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
    flexWrap: "wrap",
  },
  flywireButton: {
    border: "1px solid rgba(32, 116, 91, 0.28)",
    borderRadius: "999px",
    padding: "7px 11px",
    background: "linear-gradient(135deg, #176b55 0%, #278a6d 100%)",
    color: "#ffffff",
    fontSize: "11px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(23, 107, 85, 0.18)",
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
  reviewMarkedPageCanvas: {
    minHeight: 0,
    overflow: "auto",
    display: "grid",
    justifyItems: "center",
    alignItems: "start",
    padding: "40px 12px 14px",
    borderRadius: "16px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "radial-gradient(circle at top, #53635f 0%, #27332f 72%)",
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
    gridTemplateRows: "auto auto minmax(0, 1fr)",
    gap: "14px",
    padding: "16px",
    borderRadius: "26px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,249,254,0.98) 100%)",
    boxShadow: "0 32px 80px rgba(7, 17, 29, 0.34)",
    overflow: "hidden",
  },
  flywireModal: {
    width: "min(1440px, calc(100vw - 24px))",
    height: "calc(100vh - 24px)",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    gap: "14px",
    padding: "18px",
    borderRadius: "26px",
    border: "1px solid rgba(49, 120, 99, 0.22)",
    background: "linear-gradient(180deg, rgba(250,255,252,0.99) 0%, rgba(241,248,246,0.99) 100%)",
    boxShadow: "0 32px 80px rgba(7, 31, 24, 0.34)",
    overflow: "hidden",
  },
  siteWorkbenchModal: {
    width: "min(1780px, calc(100vw - 20px))",
    height: "calc(100vh - 20px)",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    gap: "12px",
    padding: "16px",
    borderRadius: "24px",
    border: "1px solid rgba(43, 104, 87, 0.24)",
    background: "linear-gradient(180deg, #f8fcfa 0%, #eaf3ef 100%)",
    boxShadow: "0 32px 90px rgba(6, 31, 24, 0.42)",
    overflow: "hidden",
  },
  siteWorkbenchBody: {
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    overflow: "hidden",
  },
  siteWorkbenchTopbar: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  siteWorkbenchSummary: {
    color: "#1a5f4d",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  siteWorkbenchSummaryRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "10px",
    flexWrap: "nowrap",
    minWidth: 0,
  },
  siteWorkbenchKicker: {
    color: "#187054",
    fontSize: "9px",
    fontWeight: 900,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  siteWorkbenchInlineTitle: {
    margin: 0,
    color: "#183f35",
    fontSize: "18px",
    fontWeight: 900,
    lineHeight: 1.05,
    letterSpacing: "-0.02em",
  },
  siteWorkbenchTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    flexWrap: "wrap",
    marginTop: "2px",
  },
  siteWorkbenchLayout: {
    minHeight: 0,
    height: "100%",
    flex: "1 1 auto",
    display: "flex",
    alignItems: "stretch",
    gap: "12px",
    flexWrap: "nowrap",
    overflow: "hidden",
  },
  siteWorkbenchViewer: {
    minWidth: 0,
    minHeight: 0,
    height: "100%",
    flex: "1 1 680px",
    display: "grid",
    gridTemplateRows: "auto auto minmax(0, 1fr) auto",
    gap: "10px",
    padding: "12px",
    borderRadius: "20px",
    background: "rgba(255,255,255,0.94)",
    border: "1px solid rgba(85, 127, 115, 0.18)",
    overflow: "hidden",
  },
  siteWorkbenchControls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "8px",
    flexWrap: "nowrap",
    minWidth: 0,
  },
  siteWorkbenchSelect: {
    flex: "1 1 360px",
    minWidth: "260px",
    maxWidth: "100%",
    height: "36px",
    borderRadius: "11px",
    border: "1px solid rgba(85, 127, 115, 0.22)",
    background: "#ffffff",
    color: "#183f35",
    padding: "0 10px",
    fontSize: "11px",
    fontWeight: 800,
  },
  keyproofBanner: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    padding: "10px 12px",
    borderRadius: "14px",
    border: "1px solid rgba(24, 92, 72, 0.20)",
    background: "linear-gradient(135deg, #edf8f2 0%, #fffdf4 100%)",
    color: "#183f35",
    boxShadow: "0 8px 22px rgba(28, 80, 64, 0.07)",
  },
  keyproofBannerEmpty: {
    padding: "9px 12px",
    borderRadius: "12px",
    border: "1px dashed rgba(93, 113, 135, 0.28)",
    background: "rgba(247,250,252,0.86)",
    color: "#6b7d8d",
    fontSize: "11px",
    fontWeight: 800,
  },
  keyproofBannerLead: {
    minWidth: "210px",
    display: "grid",
    gap: "2px",
    fontSize: "11px",
    color: "#537168",
  },
  keyproofBannerKicker: {
    color: "#187054",
    fontSize: "9px",
    fontWeight: 900,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  keyproofBannerTotals: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    paddingRight: "12px",
    borderRight: "1px solid rgba(47, 103, 86, 0.16)",
    color: "#49675e",
    fontSize: "11px",
    fontWeight: 700,
  },
  keyproofBannerAmounts: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flex: "1 1 340px",
    flexWrap: "wrap",
  },
  keyproofAmountPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "5px 8px",
    borderRadius: "999px",
    background: "#ffffff",
    border: "1px solid rgba(47, 103, 86, 0.14)",
    color: "#587069",
    fontSize: "10px",
    fontWeight: 800,
  },
  associatedItemBanner: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    flexWrap: "nowrap",
    padding: "9px 12px",
    borderRadius: "14px",
    border: "1px solid rgba(24, 92, 72, 0.20)",
    background: "linear-gradient(135deg, #edf8f2 0%, #fff9df 100%)",
    color: "#183f35",
    boxShadow: "0 8px 22px rgba(28, 80, 64, 0.07)",
    minWidth: 0,
    overflow: "hidden",
  },
  associatedItemLead: {
    minWidth: "200px",
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    flexWrap: "nowrap",
    color: "#537168",
    fontSize: "10px",
    lineHeight: 1.1,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  associatedItemAmount: {
    color: "#173f34",
    fontSize: "18px",
    fontWeight: 950,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  associatedItemFacts: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: "1 1 auto",
    flexWrap: "nowrap",
    color: "#5a716a",
    fontSize: "9px",
    fontWeight: 800,
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  associatedItemControls: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: "0 0 auto",
    flexWrap: "nowrap",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  siteNotesButton: {
    minHeight: "28px",
    border: "1px solid rgba(85, 127, 115, 0.22)",
    borderRadius: "999px",
    padding: "0 9px",
    background: "#ffffff",
    color: "#17483c",
    fontSize: "9px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  sitePageControls: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "nowrap",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  sitePageField: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    color: "#4f6c63",
    fontSize: "10px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  sitePageInput: {
    width: "52px",
    height: "30px",
    borderRadius: "9px",
    border: "1px solid rgba(85, 127, 115, 0.22)",
    textAlign: "center",
    color: "#173f34",
    fontWeight: 900,
  },
  sitePageCanvas: {
    minHeight: 0,
    overflow: "auto",
    overscrollBehavior: "contain",
    scrollbarGutter: "stable",
    display: "grid",
    justifyItems: "center",
    alignItems: "start",
    padding: "10px",
    borderRadius: "16px",
    background: "radial-gradient(circle at top, #53635f 0%, #27332f 72%)",
  },
  sitePageImageStage: {
    position: "relative",
    width: "min(100%, 1040px)",
    height: "fit-content",
    flex: "0 0 auto",
    userSelect: "none",
  },
  sitePageImageStageDrawing: {
    cursor: "crosshair",
    touchAction: "none",
  },
  sitePageImage: {
    display: "block",
    width: "100%",
    height: "auto",
    background: "#ffffff",
    boxShadow: "0 18px 48px rgba(0,0,0,0.32)",
  },
  sitePostingMarker: {
    position: "absolute",
    zIndex: 2,
    boxSizing: "border-box",
    pointerEvents: "none",
    borderRadius: "4px",
  },
  sitePostingMarkerPost: {
    border: "3px solid #e1a800",
    background: "rgba(255, 213, 51, 0.24)",
    boxShadow: "0 0 0 2px rgba(255,255,255,0.72), 0 8px 20px rgba(100,72,0,0.22)",
  },
  sitePostingMarkerStop: {
    border: "3px solid #c52f32",
    background: "rgba(225, 53, 57, 0.20)",
    boxShadow: "0 0 0 2px rgba(255,255,255,0.72), 0 8px 20px rgba(92,14,17,0.24)",
  },
  sitePostingMarkerMisc: {
    border: "3px solid #8c6a19",
    background: "rgba(205, 163, 62, 0.22)",
    boxShadow: "0 0 0 2px rgba(255,255,255,0.72), 0 8px 20px rgba(90,68,18,0.22)",
  },
  sitePostingMarkerLabel: {
    position: "absolute",
    left: "-3px",
    top: "-28px",
    whiteSpace: "nowrap",
    borderRadius: "6px 6px 6px 0",
    padding: "4px 7px",
    background: "#172d28",
    color: "#ffffff",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "0.04em",
  },
  siteBookmarkBar: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    padding: "10px",
    borderRadius: "16px",
    border: "1px solid rgba(38, 126, 98, 0.22)",
    background: "linear-gradient(135deg, rgba(224,247,237,0.98), rgba(248,253,251,0.98))",
  },
  siteBookmarkIdentity: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    minWidth: "220px",
  },
  siteBookmarkNote: {
    flex: "0 0 150px",
    width: "150px",
    height: "28px",
    borderRadius: "9px",
    border: "1px solid rgba(70, 125, 108, 0.22)",
    padding: "0 11px",
    color: "#173f34",
    fontSize: "9px",
    fontWeight: 700,
  },
  siteBookmarkHint: {
    color: "#54736a",
    fontSize: "9px",
    fontWeight: 800,
    lineHeight: 1.35,
    whiteSpace: "nowrap",
  },
  siteMarkerControls: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexWrap: "nowrap",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  siteMarkerChoiceMisc: {
    border: "1px solid #b5922c",
    background: "#f7df87",
    color: "#5c4610",
  },
  siteMarkerChoice: {
    minHeight: "30px",
    borderRadius: "9px",
    padding: "0 8px",
    fontSize: "10px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  siteMarkerChoicePost: {
    border: "1px solid #d9a400",
    background: "#ffe171",
    color: "#5c4300",
  },
  siteMarkerChoiceStop: {
    border: "1px solid #b92a2e",
    background: "#e5484d",
    color: "#ffffff",
  },
  siteMarkerChoiceActive: {
    boxShadow: "0 0 0 3px rgba(20, 58, 48, 0.22)",
    transform: "translateY(-1px)",
  },
  siteMarkerClear: {
    minHeight: "30px",
    border: 0,
    background: "transparent",
    color: "#875052",
    fontSize: "10px",
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "underline",
    whiteSpace: "nowrap",
  },
  siteAssociateButton: {
    minHeight: "32px",
    border: 0,
    borderRadius: "11px",
    padding: "0 12px",
    background: "linear-gradient(135deg, #156247 0%, #238b67 100%)",
    color: "#ffffff",
    fontSize: "10px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(21, 98, 71, 0.20)",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  siteQueuePanel: {
    minWidth: "280px",
    minHeight: 0,
    height: "100%",
    flex: "0 1 340px",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    gap: "10px",
    padding: "12px",
    borderRadius: "20px",
    background: "rgba(248,252,250,0.98)",
    border: "1px solid rgba(85, 127, 115, 0.18)",
    overflow: "hidden",
  },
  siteQueueHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "10px",
    color: "#5d766e",
    fontSize: "10px",
    fontWeight: 700,
  },
  siteQueueList: {
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
    scrollbarGutter: "stable",
    display: "grid",
    alignContent: "start",
    gap: "8px",
  },
  siteQueueItem: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "36px minmax(0, 1fr) auto",
    gap: "9px",
    alignItems: "center",
    padding: "10px",
    borderRadius: "15px",
    border: "1px solid rgba(100, 137, 126, 0.16)",
    background: "#ffffff",
    color: "#173f34",
    textAlign: "left",
    cursor: "pointer",
  },
  siteQueueItemActive: {
    borderColor: "rgba(33, 126, 96, 0.56)",
    boxShadow: "inset 4px 0 0 #217e60, 0 10px 24px rgba(33, 126, 96, 0.10)",
  },
  siteQueueItemComplete: {
    background: "rgba(227, 246, 238, 0.96)",
  },
  siteQueueNumber: {
    width: "30px",
    height: "30px",
    display: "inline-grid",
    placeItems: "center",
    borderRadius: "10px",
    background: "#174f3f",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: 900,
    flexShrink: 0,
  },
  siteQueueCopy: {
    minWidth: 0,
    display: "grid",
    gap: "2px",
    fontSize: "12px",
  },
  siteQueueStatus: {
    color: "#527067",
    fontSize: "10px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  siteUndoButton: {
    gridColumn: "3",
    color: "#9b3c31",
    fontSize: "10px",
    fontWeight: 900,
    textDecoration: "underline",
  },
  flywireModalBody: {
    minHeight: 0,
    overflowY: "auto",
    display: "grid",
    alignContent: "start",
    gap: "14px",
    paddingRight: "4px",
  },
  flywireMatchSummary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
    flexWrap: "wrap",
    padding: "13px 16px",
    borderRadius: "18px",
    background: "rgba(224, 244, 235, 0.92)",
    border: "1px solid rgba(49, 120, 99, 0.18)",
    color: "#275f4f",
    fontSize: "13px",
  },
  flywireDocument: {
    display: "grid",
    gap: "12px",
    padding: "16px",
    borderRadius: "22px",
    background: "rgba(255,255,255,0.94)",
    border: "1px solid rgba(92, 132, 120, 0.16)",
    boxShadow: "0 18px 36px rgba(45, 84, 72, 0.07)",
  },
  flywireDocumentHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  flywireDocumentTitle: {
    marginTop: "4px",
    color: "#183f35",
    fontSize: "16px",
    fontWeight: 900,
  },
  flywireDocumentMeta: {
    marginTop: "4px",
    color: "#668077",
    fontSize: "12px",
    fontWeight: 700,
  },
  flywireDocumentTotal: {
    display: "grid",
    justifyItems: "end",
    color: "#174c3d",
    fontSize: "20px",
    fontWeight: 900,
  },
  flywireRows: {
    display: "grid",
    gap: "9px",
  },
  flywireRow: {
    display: "grid",
    gap: "10px",
    padding: "12px 14px",
    borderRadius: "17px",
    border: "1px solid rgba(110, 140, 131, 0.14)",
    background: "rgba(247, 251, 249, 0.92)",
  },
  flywireRowMatched: {
    borderColor: "rgba(27, 135, 102, 0.48)",
    background: "linear-gradient(135deg, rgba(224,247,237,0.98), rgba(251,255,253,0.98))",
    boxShadow: "inset 4px 0 0 #238767, 0 12px 26px rgba(35, 135, 103, 0.10)",
  },
  flywireRowTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "14px",
  },
  flywireRowTitle: {
    color: "#173f34",
    fontSize: "14px",
    fontWeight: 900,
  },
  flywireRowMeta: {
    marginTop: "3px",
    color: "#668078",
    fontSize: "12px",
    fontWeight: 700,
  },
  flywireRowAmount: {
    display: "grid",
    justifyItems: "end",
    gap: "4px",
    color: "#173f34",
    fontSize: "15px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  flywireExactBadge: {
    padding: "3px 7px",
    borderRadius: "999px",
    background: "#238767",
    color: "#ffffff",
    fontSize: "9px",
    fontWeight: 900,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  flywireFacts: {
    display: "flex",
    gap: "8px 16px",
    flexWrap: "wrap",
    color: "#58736b",
    fontSize: "11px",
    fontWeight: 700,
  },
  flywireRawDetails: {
    color: "#49675e",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
  },
  flywireRawJson: {
    margin: "8px 0 0",
    padding: "12px",
    borderRadius: "12px",
    overflowX: "auto",
    background: "#15342c",
    color: "#dff4eb",
    fontSize: "11px",
    lineHeight: 1.45,
    fontWeight: 500,
    whiteSpace: "pre-wrap",
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
