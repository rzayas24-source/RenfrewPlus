import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

export default function BalanceSheetMenu() {
  const navigate = useNavigate();

  return (
    <main style={styles.shell}>
      <div style={styles.glowBlue} />
      <div style={styles.glowPink} />

      <aside style={styles.sidebar}>
        <div style={styles.brandWrap}>
          <div style={styles.brandMark} aria-hidden="true">
            <img src="/favicon.svg" alt="" style={styles.brandMarkImage} />
          </div>
          <div style={styles.brandTitleBlock}>
            <div style={styles.brandKicker}>Balance Sheet</div>
            <div style={styles.brandTitle}>Balsheet Hub</div>
          </div>
        </div>

        <p style={styles.sidebarCopy}>
          Choose the balance sheet flow you want to open.
        </p>

        <nav style={styles.navStack} aria-label="Balance sheet navigation">
          <button className="sidebar-nav-button" style={styles.navButton} type="button" onClick={() => navigate("/balsheet/view")}>
            <span style={styles.navButtonLabel}>Balsheet View</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>â†—</span>
          </button>
          <button className="sidebar-nav-button" style={styles.navButton} type="button" onClick={() => navigate("/balsheet/entry")}>
            <span style={styles.navButtonLabel}>Balsheet Entry</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>â†—</span>
          </button>
          <button className="sidebar-nav-button" style={styles.navButton} type="button" onClick={() => navigate("/balsheet/bulk")}>
            <span style={styles.navButtonLabel}>Balsheet Bulk</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>â†—</span>
          </button>
          <button className="sidebar-nav-button" style={styles.navButton} type="button" onClick={() => navigate("/")}>
            <span style={styles.navButtonLabel}>Back to Main</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>â†—</span>
          </button>
        </nav>

        <div style={styles.sidebarCard}>
          <div style={styles.sidebarCardLabel}>Style</div>
          <div style={styles.sidebarCardValue}>Same soft shell</div>
          <div style={styles.sidebarCardMeta}>
            This section now follows the same calmer card-and-sidebar treatment as the main screen.
          </div>
        </div>
      </aside>

      <section style={styles.content}>
        <section style={styles.heroShell}>
          <div style={styles.heroCopy}>
            <div style={styles.kicker}>Balance Sheet</div>
            <h1 style={styles.title}>Balsheet Hub</h1>
            <p style={styles.subtitle}>
              Open the view, entry, or bulk posting workflow from the same visual language as the home screen.
            </p>
            <div style={styles.heroActions}>
              <button style={styles.primaryButton} type="button" onClick={() => navigate("/balsheet/view")}>
                Open View
              </button>
              <button style={styles.secondaryButton} type="button" onClick={() => navigate("/balsheet/entry")}>
                Open Entry
              </button>
            </div>
          </div>

          <div style={styles.heroArt}>
            <div style={styles.heroStatusCard}>
              <div style={styles.heroStatusTop}>
                <span style={styles.statusPill}>Balance Sheet</span>
                <span style={styles.statusDot} />
              </div>
              <div style={styles.heroStatusTitle}>Workspace ready</div>
              <div style={styles.heroStatusText}>
                The three Balsheet paths are grouped here in the same gentler theme as the main screen.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.cardGrid}>
          <button style={styles.cardButton} type="button" onClick={() => navigate("/balsheet/view")}>
            <span style={styles.cardTitle}>Balsheet View</span>
            <span style={styles.cardMeta}>Review and edit the master sheet.</span>
          </button>
          <button style={styles.cardButton} type="button" onClick={() => navigate("/balsheet/entry")}>
            <span style={styles.cardTitle}>Balsheet Entry</span>
            <span style={styles.cardMeta}>Post one manual entry into Balsheet.</span>
          </button>
          <button style={styles.cardButton} type="button" onClick={() => navigate("/balsheet/bulk")}>
            <span style={styles.cardTitle}>Balsheet Bulk</span>
            <span style={styles.cardMeta}>Post itemized rows into Balsheet.</span>
          </button>
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
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
    textAlign: "left",
    background: "#f6f7f9",
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
  brandTitleBlock: {
    minWidth: 0,
  },
  brandKicker: {
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontSize: "11px",
    color: "#74879c",
    fontWeight: 800,
    marginBottom: "4px",
  },
  brandTitle: {
    fontSize: "16px",
    lineHeight: 1.2,
    fontWeight: 800,
    color: "#16304d",
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
    background: "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(236,245,255,0.95) 54%, rgba(255,236,244,0.92) 100%)",
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
    display: "grid",
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
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 800,
    color: "#16304d",
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
    border: "1px solid rgba(106, 137, 180, 0.24)",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #dbeeff 0%, #c6ddfb 100%)",
    color: "#15304f",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 14px 24px rgba(119, 151, 198, 0.16)",
  },
  secondaryButton: {
    height: "44px",
    padding: "0 18px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    borderRadius: "14px",
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
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 280px))",
    gap: "12px",
  },
  cardButton: {
    minHeight: "118px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.84)",
    color: "#1f2933",
    textAlign: "left",
    padding: "16px",
    cursor: "pointer",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
  },
  cardTitle: {
    display: "block",
    fontSize: "18px",
    fontWeight: 800,
    marginBottom: "8px",
    color: "#17324f",
  },
  cardMeta: {
    display: "block",
    color: "#5f6b7a",
    fontSize: "14px",
  },
};
