import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell, styles as adminStyles } from "../components/AdminShell";
import { styles as cashStyles } from "./cashscreen";

export default function CollectionsScreen() {
  const navigate = useNavigate();

  return (
    <AdminShell
      ribbonTitle="Collections Menu"
      sidebarCopy="A soft collections console for follow-up, recovery, and receivables work."
      onBack={() => navigate("/")}
      useGlobalMenuFallback={false}
    >
      <section style={collectionsStyles.content}>
        <section style={collectionsStyles.heroPane}>
          <div style={collectionsStyles.heroCopy}>
            <div style={adminStyles.kicker}>Collections screen</div>
            <p style={collectionsStyles.subtitle}>Collections workspace</p>
          </div>

          <div style={collectionsStyles.heroArt}>
            <div style={collectionsStyles.heroCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Collections window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Collections flow board</div>
              <div style={adminStyles.heroStatusText}>A quiet space for collections review, follow-up, and recovery.</div>
            </div>
          </div>
        </section>

        <section style={collectionsStyles.buttonGrid}>
          <button type="button" onClick={() => navigate("/request")} style={collectionsStyles.menuButton}>
            <span style={collectionsStyles.menuButtonTitle}>Request</span>
            <span style={collectionsStyles.menuButtonGlyph}>&gt;</span>
          </button>
          <button type="button" onClick={() => navigate("/statements")} style={collectionsStyles.menuButton}>
            <span style={collectionsStyles.menuButtonTitle}>Statements</span>
            <span style={collectionsStyles.menuButtonGlyph}>&gt;</span>
          </button>
          <button type="button" onClick={() => navigate("/jane-doe")} style={collectionsStyles.menuButton}>
            <span style={collectionsStyles.menuButtonTitle}>Jane Doe</span>
            <span style={collectionsStyles.menuButtonGlyph}>&gt;</span>
          </button>
          <button type="button" onClick={() => navigate("/view-images")} style={collectionsStyles.menuButton}>
            <span style={collectionsStyles.menuButtonTitle}>Imaging</span>
            <span style={collectionsStyles.menuButtonGlyph}>&gt;</span>
          </button>
        </section>
      </section>
    </AdminShell>
  );
}

const collectionsStyles: Record<string, CSSProperties> = {
  content: {
    ...adminStyles.content,
    paddingTop: "8px",
  },
  heroPane: {
    ...cashStyles.heroShell,
  },
  heroCopy: {
    ...cashStyles.heroCopy,
  },
  subtitle: {
    ...cashStyles.subtitle,
  },
  heroArt: {
    ...cashStyles.heroArt,
  },
  heroCard: {
    ...cashStyles.heroStatusCard,
  },
  buttonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  menuButton: {
    minHeight: "88px",
    padding: "14px 16px",
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(243,248,255,0.96) 48%, rgba(255,239,246,0.94) 100%)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.08)",
    cursor: "pointer",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  menuButtonTitle: {
    fontSize: "15px",
    fontWeight: 900,
    color: "#17324f",
  },
  menuButtonGlyph: {
    width: "26px",
    height: "26px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.76)",
    color: "#8aa5c6",
    fontSize: "13px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
    flexShrink: 0,
  },
};
