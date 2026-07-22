import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { styles as adminStyles } from "./adminscreen";
import { WorklistBrandButton } from "../worklist/worklist";

type ImportMetric = {
  label: string;
  value: string;
  detail: string;
};

type ImportShortcut = {
  title: string;
  meta: string;
  tone: "blue" | "pink" | "mist" | "pearl";
  action: string;
  path: string;
};

export default function ImportScreen() {
  const navigate = useNavigate();

  const metrics: ImportMetric[] = [
    {
      label: "Mode",
      value: "Import workspace",
      detail: "A calm place for bringing source files into the workflow.",
    },
    {
      label: "Focus",
      value: "Queue + staging",
      detail: "Keep import work visible without changing the shell language.",
    },
    {
      label: "Style",
      value: "Matches cash",
      detail: "Same cards, same spacing, same soft shell treatment.",
    },
  ];

  const shortcuts: ImportShortcut[] = [
    {
      title: "Pending Attachments",
      meta: "Open the review queue for inbound items that still need attention.",
      tone: "blue",
      action: "Open Pending",
      path: "/attachments",
    },
    {
      title: "Site Review",
      meta: "Move into site follow-up with the same visual family.",
      tone: "pink",
      action: "Open Site Review",
      path: "/site-review",
    },
    {
      title: "Cash Workspace",
      meta: "Jump back to cash whenever you need the broader flow.",
      tone: "mist",
      action: "Open Cash",
      path: "/cash",
    },
    {
      title: "Lockbox Upload",
      meta: "Open the dedicated lockbox upload screen for bank-side staging.",
      tone: "blue",
      action: "Open Lockbox Upload",
      path: "/lockbox-import",
    },
    {
      title: "EFT Upload",
      meta: "Open the EFT upload screen for DEP_1101_TRAN work.",
      tone: "mist",
      action: "Open EFT Upload",
      path: "/eft-upload",
    },
    {
      title: "Banking",
      meta: "Review source-of-truth banking rows after import lands.",
      tone: "pearl",
      action: "Open Banking",
      path: "/banking",
    },
    {
      title: "835 Match",
      meta: "Go to the matching screen for EDI, EFT, and Lockbox follow-up.",
      tone: "mist",
      action: "Open Match",
      path: "/835-match",
    },
    {
      title: "Main Workspace",
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
          <WorklistBrandButton style={adminStyles.brandMark} ariaLabel="Open work list from the branding button">
            <img src="/favicon.svg" alt="" style={adminStyles.brandMarkImage} />
          </WorklistBrandButton>
          <div style={adminStyles.brandWomenMark} aria-hidden="true">
            <img src="/renfrew-gazebo.png" alt="" style={adminStyles.brandWomenImage} />
          </div>
        </div>

        <p style={adminStyles.sidebarCopy}>
          A soft import console for bringing files into the workflow with the same calm shell as Cash.
        </p>

        <nav style={adminStyles.navStack} aria-label="Import navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/cash")}>
            <span style={adminStyles.navButtonLabel}>Back</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/lockbox-import")}>
            <span style={adminStyles.navButtonLabel}>Lockbox Upload</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/eft-upload")}>
            <span style={adminStyles.navButtonLabel}>EFT Upload</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/835-upload")}>
            <span style={adminStyles.navButtonLabel}>835 Upload</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Today</div>
          <div style={adminStyles.sidebarCardValue}>Import workspace ready</div>
          <div style={adminStyles.sidebarCardMeta}>
            The same calm shell keeps import work in the same visual family as the cash window.
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Import screen</div>
            <p style={adminStyles.subtitle}>
              A calm workspace for staging inbound files, checking progress, and following import work through the system.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.primaryButton} type="button" onClick={() => navigate("/attachments")}>
                Open Pending
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/lockbox-import")}>
                Open Lockbox Upload
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/eft-upload")}>
                Open EFT Upload
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/banking")}>
                Open Banking
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/cash")}>
                Open Cash
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Import window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Same shell, import focus</div>
              <div style={adminStyles.heroStatusText}>
                This page uses the import styling so the new EFT area feels native to the workspace.
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
              <div style={adminStyles.sectionKicker}>Import tools</div>
              <h2 style={adminStyles.sectionTitle}>The same card layout, now focused on import work</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              We kept the import styling so the new screen feels like part of the same system.
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
                  ...importToneStyles[shortcut.tone],
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

const importToneStyles: Record<ImportShortcut["tone"], CSSProperties> = {
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



