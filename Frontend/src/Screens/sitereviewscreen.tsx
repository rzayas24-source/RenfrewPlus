import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { styles as adminStyles } from "./adminscreen";

type SiteReviewMetric = {
  label: string;
  value: string;
  detail: string;
};

type SiteReviewShortcut = {
  title: string;
  meta: string;
  tone: "blue" | "pink" | "mist" | "pearl";
  action: string;
  path: string;
};

export default function SiteReviewScreen() {
  const navigate = useNavigate();

  const metrics: SiteReviewMetric[] = [
    {
      label: "Mode",
      value: "Site review workspace",
      detail: "A calm place for reviewing site items, follow-up, and handoff notes.",
    },
    {
      label: "Focus",
      value: "Review + action",
      detail: "Keep the new site review flow visible without changing the shell language.",
    },
    {
      label: "Style",
      value: "Matches cash",
      detail: "Same cards, same spacing, same soft shell treatment.",
    },
  ];

  const shortcuts: SiteReviewShortcut[] = [
    {
      title: "Review Queue",
      meta: "Open the site review queue and keep work moving.",
      tone: "blue",
      action: "Open Queue",
      path: "/site",
    },
    {
      title: "Cash Workspace",
      meta: "Jump back to the cash screen when you need the broader menu.",
      tone: "pink",
      action: "Open Cash",
      path: "/cash",
    },
    {
      title: "Site Notes",
      meta: "Use this card for reminders, exceptions, and follow-up details.",
      tone: "mist",
      action: "Open Notes",
      path: "/approved",
    },
    {
      title: "Workspace Home",
      meta: "Return to the main dashboard whenever you need the full menu.",
      tone: "pearl",
      action: "Back to Main",
      path: "/",
    },
  ];

  return (
    <main style={adminStyles.shell}>
      <div style={adminStyles.glowBlue} />
      <div style={adminStyles.glowPink} />

      <aside style={adminStyles.sidebar}>
        <div style={adminStyles.brandWrap}>
          <div style={adminStyles.brandMark} aria-hidden="true">
            <img src="/favicon.svg" alt="" style={adminStyles.brandMarkImage} />
          </div>
          <div style={adminStyles.brandWomenMark} aria-hidden="true">
            <img src="/renfrew-gazebo.png" alt="" style={adminStyles.brandWomenImage} />
          </div>
        </div>

        <p style={adminStyles.sidebarCopy}>
          A soft site review console that keeps the new screen in the same visual family as Cash.
        </p>

        <nav style={adminStyles.navStack} aria-label="Site review navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/")}>
            <span style={adminStyles.navButtonLabel}>Home</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/cash")}>
            <span style={adminStyles.navButtonLabel}>Cash</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/site")}>
            <span style={adminStyles.navButtonLabel}>Site</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/approved")}>
            <span style={adminStyles.navButtonLabel}>Approved Batches</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Today</div>
          <div style={adminStyles.sidebarCardValue}>Site review ready</div>
          <div style={adminStyles.sidebarCardMeta}>
            The same calm shell keeps site review work aligned with the cash workspace.
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Site review screen</div>
            <p style={adminStyles.subtitle}>
              A calm workspace for site review, follow-up, and exception handling.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.primaryButton} type="button" onClick={() => navigate("/site")}>
                Open Site
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/cash")}>
                Open Cash
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Site review window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Same shell, site focus</div>
              <div style={adminStyles.heroStatusText}>
                This page copies the cash styling so the new site review area feels native to the workspace.
              </div>
            </div>
          </div>
        </section>

        <section style={adminStyles.statsGrid}>
          {metrics.map((metric) => (
            <article key={metric.label} style={adminStyles.statCard}>
              <div style={adminStyles.statLabel}>{metric.label}</div>
              <div style={adminStyles.statValue}>{metric.value}</div>
              <div style={adminStyles.statDetail}>{metric.detail}</div>
            </article>
          ))}
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Site review tools</div>
              <h2 style={adminStyles.sectionTitle}>The same card layout, now focused on site review work</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              We reused the cash shell so the new screen stays visually consistent.
            </div>
          </div>

          <div style={adminStyles.widgetGrid}>
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.title}
                type="button"
                onClick={() => navigate(shortcut.path)}
                style={{
                  ...adminStyles.widgetCard,
                  ...siteReviewToneStyles[shortcut.tone],
                }}
              >
                <div style={adminStyles.widgetTop}>
                  <div style={adminStyles.widgetBadge}>{shortcut.title}</div>
                </div>
                <div style={adminStyles.widgetBody}>
                  <div style={adminStyles.widgetTitle}>{shortcut.title}</div>
                  <div style={adminStyles.widgetMeta}>{shortcut.meta}</div>
                </div>
                <div style={adminStyles.widgetAction}>{shortcut.action}</div>
              </button>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

const siteReviewToneStyles: Record<SiteReviewShortcut["tone"], CSSProperties> = {
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
