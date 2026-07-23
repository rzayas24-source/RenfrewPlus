import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { styles as adminStyles } from "./adminscreen";
import { WorklistBrandButton } from "../worklist/worklist";

type ToolsMetric = {
  label: string;
  value: string;
  detail: string;
};

type ToolsShortcut = {
  title: string;
  meta: string;
  tone: "blue" | "pink" | "mist" | "pearl";
  action: string;
  path: string;
};

export default function ToolsScreen() {
  const navigate = useNavigate();

  const metrics: ToolsMetric[] = [
    {
      label: "Mode",
      value: "Tools workspace",
      detail: "A calm place for utilities, helpers, and workflow support.",
    },
    {
      label: "Focus",
      value: "Utilities + admin",
      detail: "Keep the helper path visible without changing the shell language.",
    },
    {
      label: "Style",
      value: "Matches cash",
      detail: "Same cards, same spacing, same soft shell treatment.",
    },
  ];

  const shortcuts: ToolsShortcut[] = [
    {
      title: "ERA Converter",
      meta: "Open the ERAConvert workspace for conversion and review work.",
      tone: "pearl",
      action: "Open ERA Converter",
      path: "/era-convert",
    },
    {
      title: "Calendar",
      meta: "Open the calendar workspace for posting-day review.",
      tone: "blue",
      action: "Open Calendar",
      path: "/calendar",
    },
    {
      title: "Banking",
      meta: "Review bank-side totals and matched source rows.",
      tone: "pink",
      action: "Open Banking",
      path: "/banking",
    },
    {
      title: "835 Upload",
      meta: "Move through the 835 upload shell and stage the workflow.",
      tone: "mist",
      action: "Open 835 Upload",
      path: "/835-upload",
    },
    {
      title: "Lockbox Import",
      meta: "Work with lockbox staging and review in the same shell family.",
      tone: "pearl",
      action: "Open Lockbox",
      path: "/lockbox-import",
    },
    {
      title: "Workspace Home",
      meta: "Return to the main dashboard whenever you need the full menu.",
      tone: "mist",
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
          A soft tools console for helpers, utilities, and workflow support.
        </p>

        <nav style={adminStyles.navStack} aria-label="Tools navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/")}>
            <span style={adminStyles.navButtonLabel}>Home</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button
            className="sidebar-nav-button"
            style={adminStyles.navButton}
            type="button"
            onClick={() => navigate("/era-convert")}
          >
            <span style={adminStyles.navButtonLabel}>ERA Converter</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button
            className="sidebar-nav-button"
            style={adminStyles.navButton}
            type="button"
            onClick={() => navigate("/html-convert")}
          >
            <span style={adminStyles.navButtonLabel}>HTML Converter</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button
            className="sidebar-nav-button"
            style={adminStyles.navButton}
            type="button"
            onClick={() => navigate("/otherday")}
          >
            <span style={adminStyles.navButtonLabel}>Other Day Check</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button
            className="sidebar-nav-button"
            style={adminStyles.navButton}
            type="button"
            onClick={() => navigate("/duplicatecheck")}
          >
            <span style={adminStyles.navButtonLabel}>Duplicate Check</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button
            className="sidebar-nav-button"
            style={adminStyles.navButton}
            type="button"
            onClick={() => navigate("/worklist-editor")}
          >
            <span style={adminStyles.navButtonLabel}>Daily Worklist</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>â†—</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Today</div>
          <div style={adminStyles.sidebarCardValue}>Tools workspace ready</div>
          <div style={adminStyles.sidebarCardMeta}>
            This screen uses the same calm shell as Cash so the utility area feels native to the workspace.
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Tools screen</div>
            <p style={adminStyles.subtitle}>
              A calm workspace for helpers, utility paths, and admin support.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.primaryButton} type="button" onClick={() => navigate("/calendar")}>
                Open Calendar
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/era-convert")}>
                Open ERA Converter
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/banking")}>
                Open Banking
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/835-upload")}>
                Open 835 Upload
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Tools window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Same shell, utility focus</div>
              <div style={adminStyles.heroStatusText}>
                This page mirrors the Cash screen styling so the new tools area feels native to the workspace.
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
              <div style={adminStyles.sectionKicker}>Tools</div>
              <h2 style={adminStyles.sectionTitle}>The same card layout, now focused on support work</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              We kept the Cash-style shell so the utility area stays consistent with the rest of the app.
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
                  ...toolsToneStyles[shortcut.tone],
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

const toolsToneStyles: Record<ToolsShortcut["tone"], CSSProperties> = {
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

