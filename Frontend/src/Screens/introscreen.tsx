import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPendingByDay } from "../api/introscreen_api";
import { styles as adminStyles } from "./adminscreen";
import { WorklistBrandButton } from "../worklist/worklist";

interface PendingItem {
  id: number;
  filename: string;
}

interface PendingByDay {
  [day: string]: PendingItem[];
}

function formatDay(day: string) {
  if (!day || day === "Unknown") {
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

export default function IntroScreen() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingByDay>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingByDay()
      .then((data) => {
        setPending(data);
        setError(null);
      })
      .catch((err) => {
        setPending({});
        setError(err instanceof Error ? err.message : "Failed to load pending items");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const days = useMemo(() => Object.keys(pending), [pending]);
  const totalPending = useMemo(
    () => days.reduce((total, day) => total + pending[day].length, 0),
    [days, pending]
  );

  if (loading) {
    return (
      <main style={adminStyles.shell}>
        <div style={adminStyles.glowBlue} />
        <div style={adminStyles.glowPink} />
        <div style={introStyles.loadingState}>Loading pending items...</div>
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
          A calm pending-items console for moving through day-based review batches.
        </p>

        <nav style={adminStyles.navStack} aria-label="Pending navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/site-review")}>
            <span style={adminStyles.navButtonLabel}>Site Review</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>?</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/approved")}>
            <span style={adminStyles.navButtonLabel}>Approved</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>?</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/sites")}>
            <span style={adminStyles.navButtonLabel}>Sites</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>?</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Today</div>
          <div style={adminStyles.sidebarCardValue}>{totalPending} pending</div>
          <div style={adminStyles.sidebarCardMeta}>
            {days.length > 0 ? `${days.length} day group${days.length === 1 ? "" : "s"} ready to review.` : "No pending work found."}
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Pending items</div>
            <p style={adminStyles.subtitle}>
              Review the day groups, open a batch, and step straight into the attachment flow.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.primaryButton} type="button" onClick={() => navigate("/site-review")}>
                Open Site Review
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/attachments")}>
                Open Queue
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Review batches</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>One day, one bundle</div>
              <div style={adminStyles.heroStatusText}>
                Each day group opens the matching attachment queue and stays tied to that batch.
              </div>
            </div>
          </div>
        </section>

        <section style={adminStyles.statsGrid}>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Pending</div>
            <div style={adminStyles.statValue}>{totalPending}</div>
            <div style={adminStyles.statDetail}>All items currently waiting in the queue.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Days</div>
            <div style={adminStyles.statValue}>{days.length}</div>
            <div style={adminStyles.statDetail}>Grouped by the batch day for review.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Top group</div>
            <div style={adminStyles.statValue}>{days[0] ? formatDay(days[0]) : "None"}</div>
            <div style={adminStyles.statDetail}>The next day bundle waiting at the top of the stack.</div>
          </article>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Day groups</div>
              <h2 style={adminStyles.sectionTitle}>Select a batch day to review its attachments</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              The review button opens the matching day bundle in the attachments screen.
            </div>
          </div>

          {error && <div style={introStyles.errorBanner}>{error}</div>}

          {days.length === 0 && !error && <div style={introStyles.emptyState}>No pending items found.</div>}

          <div style={introStyles.dayGrid}>
            {days.map((day) => (
              <article key={day} style={introStyles.dayCard}>
                <div style={introStyles.dayTop}>
                  <div>
                    <div style={introStyles.dayLabel}>Batch Day</div>
                    <div style={introStyles.dayTitle}>{formatDay(day)}</div>
                  </div>
                  <div style={introStyles.countPill}>{pending[day].length} item{pending[day].length === 1 ? "" : "s"}</div>
                </div>

                <div style={introStyles.dayMeta}>
                  {pending[day][0]?.filename || "No filename available"}
                </div>

                <ul style={introStyles.fileList}>
                  {pending[day].map((item) => (
                    <li key={item.id} style={introStyles.fileItem}>
                      {item.filename}
                    </li>
                  ))}
                </ul>

                <div style={introStyles.dayActions}>
                  <button
                    style={adminStyles.primaryButton}
                    type="button"
                    onClick={() => navigate(`/attachments?day=${encodeURIComponent(day)}`)}
                  >
                    Review Day
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

const introStyles: Record<string, CSSProperties> = {
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
  dayGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "14px",
    alignItems: "start",
  },
  dayCard: {
    padding: "18px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.86)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
  },
  dayTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "start",
    marginBottom: "10px",
  },
  dayLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#72859a",
    fontWeight: 800,
    marginBottom: "8px",
  },
  dayTitle: {
    fontSize: "18px",
    lineHeight: 1.4,
    fontWeight: 800,
    color: "#17324f",
  },
  countPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: "999px",
    background: "rgba(214, 229, 255, 0.9)",
    color: "#1f4e91",
    fontWeight: 800,
    fontSize: "12px",
    whiteSpace: "nowrap",
  },
  dayMeta: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#597085",
    marginBottom: "14px",
  },
  fileList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gap: "8px",
  },
  fileItem: {
    padding: "10px 12px",
    borderRadius: "14px",
    background: "rgba(247, 250, 253, 0.96)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    fontSize: "14px",
    overflowWrap: "anywhere",
    color: "#35506d",
  },
  dayActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "16px",
  },
};
