import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { styles as adminStyles } from "./adminscreen";

type CashMetric = {
  label: string;
  value: string;
  detail: string;
};

type CashShortcut = {
  title: string;
  meta: string;
  tone: "blue" | "pink" | "mist" | "pearl";
  action: string;
  path: string;
};

export default function CashScreen() {
  const navigate = useNavigate();

  const metrics: CashMetric[] = [
    {
      label: "Mode",
      value: "Cash workspace",
      detail: "A calm place for deposits, review, and cash posting work.",
    },
    {
      label: "Focus",
      value: "Payments + follow-up",
      detail: "Keep the cash path visible without changing the shell language.",
    },
    {
      label: "Style",
      value: "Matches admin",
      detail: "Same cards, same spacing, same soft shell treatment.",
    },
  ];

  const shortcuts: CashShortcut[] = [
    {
      title: "Cash Entries",
      meta: "Review cash lines and keep the posting queue moving.",
      tone: "blue",
      action: "Open Cash Entries",
      path: "/balsheet/view",
    },
    {
      title: "Deposit Review",
      meta: "Check totals, confirmations, and items waiting on attention.",
      tone: "pink",
      action: "Open Review",
      path: "/approved",
    },
    {
      title: "Cash Notes",
      meta: "Use this space for reminders, exceptions, and handoff details.",
      tone: "mist",
      action: "Open Notes",
      path: "/site",
    },
    {
      title: "Site Review",
      meta: "Open the new review screen that follows the same calm shell.",
      tone: "pearl",
      action: "Open Site Review",
      path: "/site-review",
    },
    {
      title: "Banking",
      meta: "Open the banking screen for bank-side follow-up and review.",
      tone: "mist",
      action: "Open Banking",
      path: "/banking",
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
          A soft cash console for deposits, review, and posting work.
        </p>

        <nav style={adminStyles.navStack} aria-label="Cash navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/")}>
            <span style={adminStyles.navButtonLabel}>Home</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/balsheet/view")}>
            <span style={adminStyles.navButtonLabel}>Balance Sheet</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/import")}>
            <span style={adminStyles.navButtonLabel}>Import</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/banking")}>
            <span style={adminStyles.navButtonLabel}>Banking</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/site-review")}>
            <span style={adminStyles.navButtonLabel}>Site Review</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/835-match")}>
            <span style={adminStyles.navButtonLabel}>835 Match</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Today</div>
          <div style={adminStyles.sidebarCardValue}>Cash workspace ready</div>
          <div style={adminStyles.sidebarCardMeta}>
            The same calm shell keeps cash work in the same visual family as the admin window.
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Cash screen</div>
            <p style={adminStyles.subtitle}>
              A calm workspace for cash review, posting, and exception handling.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.primaryButton} type="button" onClick={() => navigate("/balsheet/view")}>
                Open Balance Sheet
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/approved")}>
                Open Approved
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/banking")}>
                Open Banking
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Cash window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Same shell, cash focus</div>
              <div style={adminStyles.heroStatusText}>
                This page uses the admin styling so the new cash area feels native to the workspace.
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
              <div style={adminStyles.sectionKicker}>Cash tools</div>
              <h2 style={adminStyles.sectionTitle}>The same card layout, now focused on cash work</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              We kept the admin styling so the new screen feels like part of the same system.
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
                  ...cashToneStyles[shortcut.tone],
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

const cashToneStyles: Record<CashShortcut["tone"], CSSProperties> = {
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
