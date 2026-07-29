import type { ChangeEvent, CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import {
  getAttachmentById,
  getNextAttachment,
  getPendingAttachment,
  getPreviousAttachment,
  rejectAttachment,
  repairAttachmentSnapshot,
  updateAttachmentSite,
} from "../api/attachmentreview_api";
import type { PendingAttachment } from "../api/attachmentreview_api";
import { fetchPendingByDay } from "../api/introscreen_api";
import { getSites, type SiteOption } from "../api/keyproof_api";
import { API_BASE } from "../config/apiBase";
import { styles as adminStyles } from "./adminscreen";

const snapshotUrl = (id: number) => `${API_BASE}/attachments/${id}/snapshot`;

type SnapshotStatus = "loading" | "ready" | "missing" | "repairing";

export default function AttachmentReviewScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const day = searchParams.get("day");
  const attachmentIdParam = searchParams.get("attachmentId");
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [site, setSite] = useState("");
  const [zoom, setZoom] = useState(1);
  const [isHeroMenuOpen, setIsHeroMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingSites, setLoadingSites] = useState(true);
  const [pendingByDay, setPendingByDay] = useState<Record<string, Array<{ id: number; filename: string }>>>({});
  const [error, setError] = useState<string | null>(null);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [savingSite, setSavingSite] = useState(false);
  const [repairingSnapshots, setRepairingSnapshots] = useState(false);
  const [snapshotRefreshToken, setSnapshotRefreshToken] = useState(0);
  const [snapshotStatus, setSnapshotStatus] = useState<SnapshotStatus>("loading");
  const heroMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getSites()
      .then((response) => {
        setSites(response.data);
        setSiteError(null);
      })
      .catch((err) => {
        setSites([]);
        setSiteError(err instanceof Error ? err.message : "Failed to load sites");
      })
      .finally(() => {
        setLoadingSites(false);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    const request = attachmentIdParam ? getAttachmentById(Number(attachmentIdParam)) : getPendingAttachment(day);

    request
      .then((data) => {
        const nextAttachment = data.done ? null : data;
        setAttachment(nextAttachment);
        setSite(nextAttachment?.site || "");
        setError(null);
      })
      .catch((err) => {
        setAttachment(null);
        setError(err instanceof Error ? err.message : "Failed to load attachment");
      })
      .finally(() => setLoading(false));
  }, [day, attachmentIdParam]);

  useEffect(() => {
    fetchPendingByDay()
      .then((data) => {
        setPendingByDay(data ?? {});
      })
      .catch(() => {
        setPendingByDay({});
      });
  }, [day]);

  useEffect(() => {
    if (!attachment) {
      setSnapshotStatus("missing");
      return;
    }

    setSnapshotStatus("loading");
  }, [attachment?.id, snapshotRefreshToken]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!isHeroMenuOpen) {
        return;
      }

      const target = event.target as Node | null;
      if (target && heroMenuRef.current?.contains(target)) {
        return;
      }

      setIsHeroMenuOpen(false);
    }

    window.addEventListener("mousedown", handleDocumentClick);
    return () => window.removeEventListener("mousedown", handleDocumentClick);
  }, [isHeroMenuOpen]);

  const siteOptions = useMemo(() => sites, [sites]);
  const currentDayBatch = useMemo(() => {
    if (!day) {
      return [];
    }

    return Array.isArray(pendingByDay[day]) ? pendingByDay[day] : [];
  }, [day, pendingByDay]);
  const batchCount = currentDayBatch.length;
  const batchPosition = useMemo(() => {
    if (!attachment || currentDayBatch.length === 0) {
      return null;
    }

    const currentIndex = currentDayBatch.findIndex((item) => item.id === attachment.id);
    return currentIndex >= 0 ? currentIndex + 1 : null;
  }, [attachment, currentDayBatch]);
  const batchPositionLabel = useMemo(() => {
    if (!attachment) {
      return day ? "Loading day bundle position..." : "Loading batch position...";
    }

    if (!day) {
      return "Batch position available when a day is selected.";
    }

    if (!batchCount) {
      return "No items found in this day bundle.";
    }

    if (!batchPosition) {
      return `Item not found in this batch.`;
    }

    return `Item ${batchPosition} of ${batchCount}`;
  }, [attachment, batchCount, batchPosition, day]);

  function zoomIn() {
    setZoom((current) => Math.min(current + 0.25, 3));
  }

  function zoomOut() {
    setZoom((current) => Math.max(current - 0.25, 0.5));
  }

  function resetZoom() {
    setZoom(1);
  }

  function openSites() {
    setIsHeroMenuOpen(false);
    navigate("/sites");
  }

  async function repairSnapshot() {
    if (!attachment) {
      return;
    }

    setIsHeroMenuOpen(false);
    setRepairingSnapshots(true);
    setError(null);
    setSnapshotStatus("repairing");

    try {
      await repairAttachmentSnapshot(attachment.id);
      setSnapshotRefreshToken((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run snapshot repair");
      setSnapshotStatus("missing");
    } finally {
      setRepairingSnapshots(false);
    }
  }

  async function saveSite(nextSite: string, currentId: number) {
    setSavingSite(true);
    setSiteError(null);
    setError(null);
    try {
      await updateAttachmentSite(currentId, nextSite);
      setAttachment((current) => (current ? { ...current, site: nextSite } : current));
    } catch (err) {
      setSiteError(err instanceof Error ? err.message : "Failed to update site");
    } finally {
      setSavingSite(false);
    }
  }

  async function handleSiteChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextSite = event.target.value;
    setSite(nextSite);
    setError(null);

    if (!attachment || !nextSite) {
      return;
    }

    await saveSite(nextSite, attachment.id);
  }

  async function moveToNext(currentId: number) {
    if (!site) {
      setError("Please define Site first");
      return;
    }

    const next = await getNextAttachment(currentId, day);
    const nextAttachment = next.done ? null : next;
    setAttachment(nextAttachment);
    setSite(nextAttachment?.site || "");
  }

  async function moveToPrevious(currentId: number) {
    if (!site) {
      setError("Please define Site first");
      return;
    }

    const previous = await getPreviousAttachment(currentId, day);
    const previousAttachment = previous.done ? null : previous;
    setAttachment(previousAttachment);
    setSite(previousAttachment?.site || "");
  }

  async function handleReview() {
    if (!attachment) return;
    if (!site) {
      setError("Please define Site first");
      return;
    }

    if (attachment.site !== site) {
      await saveSite(site, attachment.id);
    }

    const params = new URLSearchParams({ attachmentId: String(attachment.id) });

    if (day) {
      params.set("day", day);
    }

    params.set("site", site);

    navigate(`/keyproof?${params.toString()}`);
  }

  async function handleReject() {
    if (!attachment) return;
    if (!site) {
      setError("Please define Site first");
      return;
    }

    const currentId = attachment.id;
    await rejectAttachment(currentId);
    await moveToNext(currentId);
  }

  const snapshotStatusLabel = useMemo(() => {
    if (!attachment) {
      return "No attachment";
    }

    switch (snapshotStatus) {
      case "ready":
        return "Snapshot ready";
      case "missing":
        return "Snapshot missing";
      case "repairing":
        return "Repairing snapshot";
      case "loading":
      default:
        return "Snapshot loading";
    }
  }, [attachment, snapshotStatus]);

  const snapshotStatusStyle = useMemo<CSSProperties>(() => {
    const base: CSSProperties = {
      ...adminStyles.statusPill,
      padding: "6px 12px",
      textTransform: "none",
      letterSpacing: "0.02em",
    };

    switch (snapshotStatus) {
      case "ready":
        return {
          ...base,
          background: "rgba(228, 247, 237, 0.98)",
          color: "#1f6f43",
        };
      case "missing":
        return {
          ...base,
          background: "rgba(255, 235, 235, 0.98)",
          color: "#a32121",
        };
      case "repairing":
        return {
          ...base,
          background: "rgba(255, 246, 220, 0.98)",
          color: "#8a5a00",
        };
      case "loading":
      default:
        return {
          ...base,
          background: "rgba(224, 237, 250, 0.95)",
          color: "#35506d",
        };
    }
  }, [snapshotStatus]);

  if (loading) {
    return (
      <main style={adminStyles.shell}>
        <div style={adminStyles.glowBlue} />
        <div style={adminStyles.glowPink} />
        <div style={attachmentStyles.loadingState}>Loading attachment review...</div>
      </main>
    );
  }

  return (
    <AdminShell
      sidebarCopy="Review each attachment, assign its site, and carry the selected site forward."
      onBack={() => navigate("/site")}
      sidebarAction={
        <div style={attachmentStyles.sidebarField}>
          <span style={attachmentStyles.fieldLabel}>Choose site</span>
          <select
            style={attachmentStyles.select}
            value={site}
            onChange={(event) => void handleSiteChange(event)}
            disabled={loadingSites || savingSite}
          >
            <option value="">Select site</option>
            {siteOptions.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      }
      sidebarCardLabel="Batch items"
      sidebarCardValue={String(batchCount ?? "...")}
      sidebarCardMeta={day ? "Counted from the current batch day." : "Counted from all items in the flow."}
    >
      <section style={adminStyles.content}>
        <section
          style={{
            ...adminStyles.heroShell,
            overflow: "visible",
            zIndex: 5,
          }}
        >
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Attachment review</div>
            <p style={adminStyles.subtitle}>
              Review the snapshot, assign the site from the sidebar, and move through the day bundle with previous and next controls.
            </p>

            <div style={adminStyles.heroActions}>
              <button
                style={adminStyles.secondaryButton}
                type="button"
                onClick={() => void moveToPrevious(attachment?.id || 0)}
                disabled={!attachment || savingSite}
              >
                Previous
              </button>
              <button
                style={adminStyles.secondaryButton}
                type="button"
                onClick={() => void moveToNext(attachment?.id || 0)}
                disabled={!attachment || savingSite}
              >
                Next
              </button>
              <button
                style={adminStyles.primaryButton}
                type="button"
                onClick={() => void handleReview()}
                disabled={!attachment || savingSite}
              >
                Review
              </button>
              <button
                style={attachmentStyles.rejectButton}
                type="button"
                onClick={() => void handleReject()}
                disabled={!attachment || savingSite}
              >
                Reject
              </button>
            </div>
          </div>

          <div
            style={{
              ...adminStyles.heroArt,
              position: "relative",
              zIndex: 6,
            }}
          >
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <div style={attachmentStyles.statusPillRow}>
                  <span style={adminStyles.statusPill}>Batch {day || "all"}</span>
                  <span style={snapshotStatusStyle}>{snapshotStatusLabel}</span>
                </div>
                <div
                  ref={heroMenuRef}
                  style={{
                    ...attachmentStyles.heroMenuWrap,
                    zIndex: 20,
                  }}
                >
                  <span style={adminStyles.statusDot} />
                  <button
                    style={attachmentStyles.heroMenuButton}
                    type="button"
                    onClick={() => setIsHeroMenuOpen((current) => !current)}
                    aria-label="Open actions"
                    aria-expanded={isHeroMenuOpen}
                  >
                    ...
                  </button>
                  {isHeroMenuOpen && (
                    <div style={attachmentStyles.heroMenuDropdown} role="menu" aria-label="Attachment actions">
                      <button style={attachmentStyles.heroMenuItem} type="button" onClick={openSites} role="menuitem">
                        Sites
                      </button>
                      <button
                        style={attachmentStyles.heroMenuItem}
                        type="button"
                        onClick={() => void repairSnapshot()}
                        role="menuitem"
                        disabled={repairingSnapshots}
                      >
                        {repairingSnapshots ? "Repairing snapshot..." : "Repair snapshot"}
                      </button>
                      <button
                        style={attachmentStyles.heroMenuItem}
                        type="button"
                        onClick={() => {
                          resetZoom();
                          setIsHeroMenuOpen(false);
                        }}
                        role="menuitem"
                      >
                        Reset zoom
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div style={adminStyles.heroStatusTitle}>
                {attachment ? attachment.filename : "No attachment selected"}
              </div>
              <div style={adminStyles.heroStatusText}>
                The image gets more room now that the site metadata lives in the sidebar.
              </div>
            </div>
          </div>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Attachment controls</div>
              <h2 style={adminStyles.sectionTitle}>Review the snapshot with zoom</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              <strong>{batchPositionLabel}.</strong> The reviewer keeps the same day bundle together while you step through each file.
            </div>
          </div>

          {error && <div style={attachmentStyles.errorBanner}>{error}</div>}
          {siteError && <div style={attachmentStyles.errorBanner}>{siteError}</div>}

          {!attachment && !error && (
            <div style={attachmentStyles.emptyState}>No attachments for this day.</div>
          )}

          {attachment && (
            <div style={attachmentStyles.reviewGrid}>
              <div style={attachmentStyles.snapshotPane}>
                <div style={attachmentStyles.snapshotToolbar}>
                  <button style={attachmentStyles.zoomButton} type="button" onClick={zoomOut}>
                    -
                  </button>
                  <button style={attachmentStyles.zoomButton} type="button" onClick={resetZoom}>
                    {Math.round(zoom * 100)}%
                  </button>
                  <button style={attachmentStyles.zoomButton} type="button" onClick={zoomIn}>
                    +
                  </button>
                </div>

                <div style={attachmentStyles.snapshotCard}>
                  <img
                    src={`${snapshotUrl(attachment.id)}?v=${snapshotRefreshToken}`}
                    alt={attachment.filename}
                    onLoad={() => setSnapshotStatus("ready")}
                    onError={() => setSnapshotStatus("missing")}
                    style={{
                      ...attachmentStyles.snapshot,
                      transform: `scale(${zoom})`,
                    }}
                  />
                </div>

                <div style={attachmentStyles.actionBar}>
                  <button
                    style={adminStyles.secondaryButton}
                    onClick={() => void moveToPrevious(attachment.id)}
                    disabled={savingSite || repairingSnapshots}
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    style={adminStyles.primaryButton}
                    onClick={() => void handleReview()}
                    disabled={savingSite || repairingSnapshots}
                    type="button"
                  >
                    Review
                  </button>
                  <button
                    style={attachmentStyles.rejectButton}
                    onClick={() => void handleReject()}
                    disabled={savingSite || repairingSnapshots}
                    type="button"
                  >
                    Reject
                  </button>
                  <button
                    style={adminStyles.secondaryButton}
                    onClick={() => void moveToNext(attachment.id)}
                    disabled={savingSite || repairingSnapshots}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </section>

    </AdminShell>
  );
}

const attachmentStyles: Record<string, CSSProperties> = {
  loadingState: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    color: "#5f6b7a",
    fontSize: "18px",
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
  reviewGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "16px",
    alignItems: "start",
  },
  sidebarField: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "10px",
  },
  statusPillRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  heroMenuWrap: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    overflow: "visible",
  },
  heroMenuButton: {
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    border: "1px solid rgba(158, 176, 204, 0.24)",
    background: "rgba(255,255,255,0.9)",
    color: "#35506d",
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: 1,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(52, 84, 120, 0.08)",
  },
  heroMenuDropdown: {
    position: "absolute",
    top: "42px",
    right: 0,
    zIndex: 30,
    minWidth: "180px",
    borderRadius: "16px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255,255,255,0.98)",
    boxShadow: "0 16px 36px rgba(52, 84, 120, 0.16)",
    overflow: "hidden",
  },
  heroMenuItem: {
    width: "100%",
    display: "block",
    textAlign: "left",
    padding: "11px 14px",
    border: 0,
    background: "transparent",
    color: "#35506d",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  fieldLabel: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#27405e",
  },
  select: {
    height: "44px",
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.30)",
    background: "#ffffff",
    color: "#1f2933",
    padding: "0 12px",
    fontSize: "15px",
    outline: "none",
  },
  siteHint: {
    fontSize: "14px",
    color: "#5f6b7a",
    marginTop: "12px",
  },
  snapshotPane: {
    display: "grid",
    gap: "14px",
  },
  snapshotToolbar: {
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  zoomButton: {
    height: "40px",
    minWidth: "40px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.28)",
    background: "rgba(255,255,255,0.92)",
    color: "#35506d",
    fontWeight: 800,
    cursor: "pointer",
  },
  snapshotCard: {
    padding: "18px",
    borderRadius: "28px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.82)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
    overflow: "auto",
    maxHeight: "72vh",
  },
  snapshot: {
    display: "block",
    width: "100%",
    maxHeight: "none",
    objectFit: "contain",
    borderRadius: "20px",
    background: "#ffffff",
    transformOrigin: "center center",
  },
  actionBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    justifyContent: "flex-end",
  },
  rejectButton: {
    height: "44px",
    padding: "0 18px",
    borderRadius: "14px",
    border: "1px solid rgba(200, 90, 90, 0.28)",
    background: "#fff5f5",
    color: "#a32121",
    fontWeight: 800,
    cursor: "pointer",
  },
};
