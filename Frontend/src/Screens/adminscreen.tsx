import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

type WidgetTone = "blue" | "pink" | "mist" | "pearl";

interface WidgetCard {
  title: string;
  meta: string;
  tone: WidgetTone;
  action: string;
  path: string;
  footnote: string;
}

interface StatCard {
  label: string;
  value: string;
  detail: string;
}

export default function AdminScreen() {
  const navigate = useNavigate();

  const widgets: WidgetCard[] = [
    {
      title: "Tables",
      meta: "Browse every table in the live SQLite database.",
      tone: "blue",
      action: "Open Table Viewer",
      path: "/admin/tables",
      footnote: "Database",
    },
    {
      title: "Users",
      meta: "Review access, roles, and support contacts.",
      tone: "pink",
      action: "Open Users",
      path: "/approved",
      footnote: "Access",
    },
    {
      title: "Logs",
      meta: "Track recent actions and operational notes.",
      tone: "mist",
      action: "Open Logs",
      path: "/site",
      footnote: "Audit",
    },
    {
      title: "Settings",
      meta: "Adjust workflow defaults and shell preferences.",
      tone: "pearl",
      action: "Open Settings",
      path: "/home",
      footnote: "Config",
    },
  ];

  const stats: StatCard[] = [
    {
      label: "Mode",
      value: "Admin console",
      detail: "Same polished shell, tuned for support and oversight.",
    },
    {
      label: "Focus",
      value: "Controls + review",
      detail: "Keep the operating tools easy to reach and easy to read.",
    },
    {
      label: "Style",
      value: "Matched main screen",
      detail: "The new window uses the same airy layout and branding.",
    },
  ];

  return (
    <main style={styles.shell}>
      <div style={styles.glowBlue} />
      <div style={styles.glowPink} />

      <aside style={styles.sidebar}>
        <div style={styles.brandWrap}>
          <div style={styles.brandMark} aria-hidden="true">
            <img src="/favicon.svg" alt="" style={styles.brandMarkImage} />
          </div>
          <div style={styles.brandWomenMark} aria-hidden="true">
            <img src="/renfrew-womenline.png" alt="" style={styles.brandWomenImage} />
          </div>
        </div>

        <p style={styles.sidebarCopy}>
          A soft admin console for workflow support, visibility, and system oversight.
        </p>

        <nav style={styles.navStack} aria-label="Admin navigation">
          <button className="sidebar-nav-button" style={styles.navButton} type="button" onClick={() => navigate("/")}>
            <span style={styles.navButtonLabel}>Main</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={styles.navButton} type="button" onClick={() => navigate("/admin/tables")}>
            <span style={styles.navButtonLabel}>Tables</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={styles.navButton} type="button" onClick={() => navigate("/site")}>
            <span style={styles.navButtonLabel}>Site</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={styles.navButton} type="button" onClick={() => navigate("/balance-sheet")}>
            <span style={styles.navButtonLabel}>Balance Sheet</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={styles.navButton} type="button" onClick={() => navigate("/approved")}>
            <span style={styles.navButtonLabel}>Approved Batches</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={styles.sidebarCard}>
          <div style={styles.sidebarCardLabel}>Today</div>
          <div style={styles.sidebarCardValue}>Admin support ready</div>
          <div style={styles.sidebarCardMeta}>
            The window keeps the same calm layout so admin tools feel like part of the same app.
          </div>
        </div>
      </aside>

      <section style={styles.content}>
        <section style={styles.heroShell}>
          <div style={styles.heroCopy}>
            <div style={styles.kicker}>Admin screen</div>
            <p style={styles.subtitle}>
              A calm workspace for admin tools, support actions, and workflow oversight.
            </p>

            <div style={styles.heroActions}>
              <button style={styles.primaryButton} type="button" onClick={() => navigate("/site")}>
                Open Site
              </button>
              <button style={styles.secondaryButton} type="button" onClick={() => navigate("/balance-sheet")}>
                Open Balance Sheet
              </button>
            </div>
          </div>

          <div style={styles.heroArt}>
            <div style={styles.heroStatusCard}>
              <div style={styles.heroStatusTop}>
                <span style={styles.statusPill}>Admin window</span>
                <span style={styles.statusDot} />
              </div>
              <div style={styles.heroStatusTitle}>Same shell, new role</div>
              <div style={styles.heroStatusText}>
                This page is meant to look and feel like the main screen while serving admin tasks.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.statsGrid}>
          {stats.map((stat) => (
            <article key={stat.label} style={styles.statCard}>
              <div style={styles.statLabel}>{stat.label}</div>
              <div style={styles.statValue}>{stat.value}</div>
              <div style={styles.statDetail}>{stat.detail}</div>
            </article>
          ))}
        </section>

        <section style={styles.widgetSection}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionKicker}>Admin tools</div>
              <h2 style={styles.sectionTitle}>Everything stays in the same visual language</h2>
            </div>
            <div style={styles.sectionMeta}>
              The left rail and cards follow the same structure so the new window feels native to the workspace.
            </div>
          </div>

          <div style={styles.widgetGrid}>
            {widgets.map((widget) => (
              <button
                key={widget.title}
                type="button"
                onClick={() => navigate(widget.path)}
                style={{
                  ...styles.widgetCard,
                  ...toneStyles[widget.tone],
                }}
              >
                <div style={styles.widgetTop}>
                  <div style={styles.widgetBadge}>{widget.footnote}</div>
                </div>
                <div style={styles.widgetBody}>
                  <div style={styles.widgetTitle}>{widget.title}</div>
                  <div style={styles.widgetMeta}>{widget.meta}</div>
                </div>
                <div style={styles.widgetAction}>{widget.action}</div>
              </button>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: "100vh",
    padding: "18px",
    display: "grid",
    gridTemplateColumns: "250px minmax(0, 1fr)",
    gap: "18px",
    position: "relative",
    overflow: "hidden",
    color: "#16304d",
  },
  glowBlue: {
    position: "absolute",
    top: "-120px",
    left: "-120px",
    width: "360px",
    height: "360px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(146, 198, 255, 0.45) 0%, rgba(146, 198, 255, 0) 70%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  glowPink: {
    position: "absolute",
    right: "-100px",
    top: "110px",
    width: "320px",
    height: "320px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255, 186, 213, 0.42) 0%, rgba(255, 186, 213, 0) 72%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  sidebar: {
    position: "relative",
    zIndex: 1,
    padding: "18px 16px",
    borderRadius: "28px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.72)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.10)",
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    justifyContent: "flex-start",
    paddingBottom: "14px",
    marginBottom: "16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.18)",
  },
  brandMark: {
    width: "52px",
    height: "52px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.76)",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    boxShadow: "0 12px 22px rgba(95, 128, 172, 0.08)",
    overflow: "hidden",
    flexShrink: 0,
  },
  brandMarkImage: {
    width: "88%",
    height: "88%",
    objectFit: "contain",
    objectPosition: "center",
  },
  brandWomenMark: {
    width: "104px",
    height: "52px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.64)",
    border: "1px solid rgba(140, 160, 184, 0.10)",
    boxShadow: "0 10px 18px rgba(95, 128, 172, 0.06)",
    overflow: "hidden",
    flexShrink: 0,
  },
  brandWomenImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  sidebarCopy: {
    margin: "0 0 16px",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#516579",
  },
  navStack: {
    display: "grid",
    gap: "10px",
  },
  navButton: {
    height: "46px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    borderRadius: "16px",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(236,245,255,0.95) 54%, rgba(255,236,244,0.92) 100%)",
    color: "#16304d",
    textAlign: "left",
    padding: "0 14px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 12px 26px rgba(52, 84, 120, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    letterSpacing: "0.01em",
  },
  navButtonLabel: {
    fontSize: "14px",
    fontWeight: 800,
  },
  navButtonGlyph: {
    width: "22px",
    height: "22px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.76)",
    color: "#8aa5c6",
    fontSize: "12px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
  },
  sidebarCard: {
    marginTop: "18px",
    padding: "16px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, rgba(235, 245, 255, 0.95) 0%, rgba(255, 234, 243, 0.90) 100%)",
    border: "1px solid rgba(176, 194, 218, 0.22)",
  },
  sidebarCardLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
    marginBottom: "8px",
  },
  sidebarCardValue: {
    fontSize: "18px",
    fontWeight: 800,
    marginBottom: "8px",
  },
  sidebarCardMeta: {
    fontSize: "13px",
    lineHeight: 1.55,
    color: "#5d7187",
  },
  content: {
    position: "relative",
    zIndex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  heroShell: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, 0.9fr)",
    gap: "18px",
    alignItems: "stretch",
    padding: "24px",
    borderRadius: "32px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    background: "linear-gradient(135deg, rgba(255,255,255,0.90) 0%, rgba(248,250,253,0.88) 50%, rgba(255,244,248,0.92) 100%)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.08)",
  },
  heroCopy: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: 0,
  },
  kicker: {
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: "12px",
    fontWeight: 800,
    color: "#74879c",
    marginBottom: "10px",
  },
  subtitle: {
    margin: "8px 0 0",
    maxWidth: "760px",
    fontSize: "16px",
    lineHeight: 1.7,
    color: "#536579",
  },
  heroActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "20px",
  },
  primaryButton: {
    height: "44px",
    padding: "0 18px",
    borderRadius: "14px",
    border: "1px solid rgba(106, 137, 180, 0.24)",
    background: "linear-gradient(135deg, #dbeeff 0%, #c6ddfb 100%)",
    color: "#15304f",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 14px 24px rgba(119, 151, 198, 0.16)",
  },
  secondaryButton: {
    height: "44px",
    padding: "0 18px",
    borderRadius: "14px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    background: "rgba(255,255,255,0.9)",
    color: "#35506d",
    fontWeight: 800,
    cursor: "pointer",
  },
  heroArt: {
    display: "grid",
    gap: "14px",
    alignContent: "center",
  },
  heroStatusCard: {
    borderRadius: "24px",
    padding: "18px",
    background: "linear-gradient(135deg, rgba(243, 248, 255, 0.95) 0%, rgba(255, 239, 245, 0.92) 100%)",
    border: "1px solid rgba(175, 193, 218, 0.22)",
  },
  heroStatusTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    height: "30px",
    padding: "0 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(158, 176, 204, 0.22)",
    fontSize: "12px",
    fontWeight: 800,
    color: "#4a6179",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#8ec4ff",
    boxShadow: "0 0 0 6px rgba(142, 196, 255, 0.18)",
  },
  heroStatusTitle: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#16304d",
    marginBottom: "8px",
  },
  heroStatusText: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#5a6c80",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "16px",
  },
  statCard: {
    padding: "18px",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.84)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
  },
  statLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#72859a",
    marginBottom: "10px",
    fontWeight: 800,
  },
  statValue: {
    fontSize: "20px",
    fontWeight: 800,
    color: "#17324f",
    marginBottom: "8px",
  },
  statDetail: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#597085",
  },
  widgetSection: {
    padding: "20px",
    borderRadius: "30px",
    background: "rgba(255,255,255,0.74)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 20px 42px rgba(52, 84, 120, 0.06)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "16px",
  },
  sectionKicker: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#74879c",
    fontWeight: 800,
    marginBottom: "8px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "24px",
    color: "#17324f",
  },
  sectionMeta: {
    maxWidth: "340px",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#5e7186",
  },
  widgetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },
  widgetCard: {
    minHeight: "168px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    padding: "18px",
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxShadow: "0 16px 34px rgba(52, 84, 120, 0.06)",
  },
  widgetTop: {
    display: "flex",
    justifyContent: "flex-start",
  },
  widgetBadge: {
    display: "inline-flex",
    alignItems: "center",
    height: "28px",
    padding: "0 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.7)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    color: "#50657a",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  widgetBody: {
    display: "grid",
    gap: "8px",
  },
  widgetTitle: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#17324f",
  },
  widgetMeta: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#566a7f",
  },
  widgetAction: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#35506d",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
};

const toneStyles: Record<WidgetTone, CSSProperties> = {
  blue: {
    background: "linear-gradient(145deg, rgba(229, 244, 255, 0.96) 0%, rgba(252, 252, 255, 0.92) 100%)",
  },
  pink: {
    background: "linear-gradient(145deg, rgba(255, 235, 245, 0.96) 0%, rgba(255, 252, 254, 0.92) 100%)",
  },
  mist: {
    background: "linear-gradient(145deg, rgba(240, 245, 250, 0.96) 0%, rgba(252, 253, 255, 0.92) 100%)",
  },
  pearl: {
    background: "linear-gradient(145deg, rgba(251, 247, 242, 0.96) 0%, rgba(255, 254, 252, 0.92) 100%)",
  },
};
