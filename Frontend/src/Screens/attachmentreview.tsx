import type { ChangeEvent, CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getNextAttachment,
  getPendingAttachment,
  getPreviousAttachment,
  rejectAttachment,
  updateAttachmentSite,
} from "../api/attachmentreview_api";
import type { PendingAttachment } from "../api/attachmentreview_api";
import { getSites, type SiteOption } from "../api/keyproof_api";
import { styles as adminStyles } from "./adminscreen";
import { WorklistBrandButton } from "../worklist/worklist";

function formatDay(day: string | null) {
  if (!day) {
    return "All pending";
  }

  if (day === "Unknown") {
    return "Unknown date";
  }

  const parsed = new Date(`${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return day;
  }

  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const snapshotUrl = (id: number) => `http://localhost:8000/attachments/${id}/snapshot`;

export default function AttachmentReviewScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const day = searchParams.get("day");
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [site, setSite] = useState("");
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingSites, setLoadingSites] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [savingSite, setSavingSite] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
    getPendingAttachment(day)
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
  }, [day]);

  const siteOptions = useMemo(() => sites, [sites]);

  function zoomIn() {
    setZoom((current) => Math.min(current + 0.25, 3));
  }

  function zoomOut() {
    setZoom((current) => Math.max(current - 0.25, 0.5));
  }

  function resetZoom() {
    setZoom(1);
  }

  function toggleMenu() {
    setMenuOpen((current) => !current);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  async function saveSite(nextSite: string, currentId: number) {
    setSavingSite(true);
    setSiteError(null);
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

    if (!attachment || !nextSite) {
      return;
    }

    await saveSite(nextSite, attachment.id);
  }

  async function moveToNext(currentId: number) {
    const next = await getNextAttachment(currentId, day);
    const nextAttachment = next.done ? null : next;
    setAttachment(nextAttachment);
    setSite(nextAttachment?.site || "");
  }

  async function moveToPrevious(currentId: number) {
    const previous = await getPreviousAttachment(currentId, day);
    const previousAttachment = previous.done ? null : previous;
    setAttachment(previousAttachment);
    setSite(previousAttachment?.site || "");
  }

  async function handleReview() {
    if (!attachment) return;
    if (!site) {
      setError("Please choose a site before continuing.");
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
    const currentId = attachment.id;
    await rejectAttachment(currentId);
    await moveToNext(currentId);
  }

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
          Review each pending attachment, assign its site, and carry the selected site forward.
        </p>

        <nav style={adminStyles.navStack} aria-label="Attachment review navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/site")}>
            <span style={adminStyles.navButtonLabel}>Pending</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>?</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/site-review")}>
            <span style={adminStyles.navButtonLabel}>Site Review</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>?</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Today</div>
          <div style={adminStyles.sidebarCardValue}>
            {day ? `Working day: ${formatDay(day)}` : "Working all pending items."}
          </div>
        </div>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Site</div>
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
          <div style={adminStyles.sidebarCardMeta}>
            {site ? "Stored on the import row and carried forward." : "Site is required before review."}
          </div>
        </div>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Choices</div>
          <div style={adminStyles.sidebarCardValue}>{siteOptions.length}</div>
          <div style={adminStyles.sidebarCardMeta}>Pulled from the sites table.</div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
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
                disabled={!attachment || !site || savingSite}
              >
                Previous
              </button>
              <button
                style={adminStyles.secondaryButton}
                type="button"
                onClick={() => void moveToNext(attachment?.id || 0)}
                disabled={!attachment || !site || savingSite}
              >
                Next
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Batch {day || "all"}</span>
                <div style={attachmentStyles.heroMenuWrap}>
                  <span style={adminStyles.statusDot} />
                  <button
                    style={attachmentStyles.heroMenuButton}
                    type="button"
                    onClick={toggleMenu}
                    aria-label="More review actions"
                    aria-expanded={menuOpen}
                  >
                    ...
                  </button>
                  {menuOpen && (
                    <div style={attachmentStyles.heroMenuDropdown}>
                      <button
                        type="button"
                        style={attachmentStyles.heroMenuItem}
                        onClick={() => {
                          resetZoom();
                          closeMenu();
                        }}
                      >
                        Reset zoom
                      </button>
                      <button
                        type="button"
                        style={attachmentStyles.heroMenuItem}
                        onClick={() => {
                          navigate("/sites");
                          closeMenu();
                        }}
                      >
                        Sites
                      </button>
                      <button
                        type="button"
                        style={attachmentStyles.heroMenuItem}
                        onClick={() => {
                          if (attachment) {
                            void moveToPrevious(attachment.id);
                          }
                          closeMenu();
                        }}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        style={attachmentStyles.heroMenuItem}
                        onClick={() => {
                          if (attachment) {
                            void moveToNext(attachment.id);
                          }
                          closeMenu();
                        }}
                      >
                        Next
                      </button>
                      <button
                        type="button"
                        style={attachmentStyles.heroMenuItem}
                        onClick={() => {
                          navigate("/site");
                          closeMenu();
                        }}
                      >
                        Back to pending
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div style={adminStyles.heroStatusTitle}>
                {attachment ? attachment.filename : "No pending attachment"}
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
              The reviewer keeps the same day bundle together while you step through each file.
            </div>
          </div>

          {error && <div style={attachmentStyles.errorBanner}>{error}</div>}
          {siteError && <div style={attachmentStyles.errorBanner}>{siteError}</div>}

          {!attachment && !error && (
            <div style={attachmentStyles.emptyState}>No pending attachments for this day.</div>
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
                    src={snapshotUrl(attachment.id)}
                    alt={attachment.filename}
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
                    disabled={!site || savingSite}
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    style={adminStyles.primaryButton}
                    onClick={() => void handleReview()}
                    disabled={!site || savingSite}
                    type="button"
                  >
                    Review
                  </button>
                  <button
                    style={attachmentStyles.rejectButton}
                    onClick={() => void handleReject()}
                    disabled={!site || savingSite}
                    type="button"
                  >
                    Reject
                  </button>
                  <button
                    style={adminStyles.secondaryButton}
                    onClick={() => void moveToNext(attachment.id)}
                    disabled={!site || savingSite}
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
    </main>
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
  heroMenuWrap: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
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
    zIndex: 8,
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
