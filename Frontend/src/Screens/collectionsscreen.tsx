import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell, styles as adminStyles } from "../components/AdminShell";

export default function CollectionsScreen() {
  const navigate = useNavigate();

  return (
    <AdminShell
      ribbonTitle="Collections Menu"
      sidebarCopy="A soft collections console for follow-up, recovery, and receivables work."
      onBack={() => navigate("/")}
      sidebarAction={
        <button
          type="button"
          onClick={() => navigate("/view-images")}
          style={collectionsStyles.sidebarImagingButton}
        >
          <div style={collectionsStyles.sidebarImagingKicker}>Imaging</div>
          <div style={collectionsStyles.sidebarImagingTitle}>Open imaging</div>
          <div style={collectionsStyles.sidebarImagingMeta}>
            Jump straight into the image viewer from the left bar.
          </div>
        </button>
      }
    >
      <section style={collectionsStyles.content}>
        <section style={collectionsStyles.heroPane}>
          <div style={collectionsStyles.heroCopy}>
            <div style={adminStyles.kicker}>Collections screen</div>
            <h1 style={collectionsStyles.heroTitle}>Collections workspace</h1>
            <p style={collectionsStyles.heroSubtitle}>
              A focused place for follow-up, recovery, and receivables work. The Imaging shortcut now lives in the
              left bar so the center of the page can stay clean and intentional.
            </p>
            <div style={collectionsStyles.heroNote}>
              Use the sidebar to jump into imaging whenever you need it.
            </div>
          </div>

          <div style={collectionsStyles.heroArt}>
            <div style={collectionsStyles.heroCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Collections window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Clean main pane, fast imaging access</div>
              <div style={adminStyles.heroStatusText}>
                We removed the extra cards and quick actions so this screen reads like a single workspace instead of
                a dashboard.
              </div>
            </div>
          </div>
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
    ...adminStyles.heroShell,
    position: "relative",
    top: "auto",
    zIndex: 1,
    minHeight: "320px",
    alignItems: "stretch",
    padding: "28px",
    gap: "24px",
    background: "linear-gradient(135deg, rgba(247, 250, 255, 0.98) 0%, rgba(255, 244, 248, 0.94) 100%)",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    boxShadow: "0 26px 60px rgba(52, 84, 120, 0.10)",
  },
  heroCopy: {
    ...adminStyles.heroCopy,
    maxWidth: "640px",
  },
  heroTitle: {
    margin: "8px 0 0",
    fontSize: "clamp(2.4rem, 4vw, 4rem)",
    lineHeight: 0.98,
    letterSpacing: "-0.05em",
    color: "#16304d",
    fontWeight: 900,
  },
  heroSubtitle: {
    margin: "14px 0 0",
    fontSize: "18px",
    lineHeight: 1.65,
    color: "#4f6277",
    maxWidth: "56ch",
  },
  heroNote: {
    marginTop: "18px",
    display: "inline-flex",
    alignItems: "center",
    padding: "12px 16px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    color: "#5b6f84",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.35,
  },
  heroArt: {
    ...adminStyles.heroArt,
    minWidth: "280px",
    display: "flex",
    alignItems: "stretch",
  },
  heroCard: {
    ...adminStyles.heroStatusCard,
    width: "100%",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 16px 36px rgba(52, 84, 120, 0.08)",
  },
  sidebarImagingButton: {
    width: "100%",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    borderRadius: "20px",
    padding: "16px",
    textAlign: "left",
    cursor: "pointer",
    background: "linear-gradient(135deg, rgba(236, 245, 255, 0.98) 0%, rgba(255, 239, 246, 0.96) 100%)",
    boxShadow: "0 14px 28px rgba(52, 84, 120, 0.08)",
    display: "grid",
    gap: "6px",
    color: "#16304d",
  },
  sidebarImagingKicker: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#6c7f95",
    fontWeight: 800,
  },
  sidebarImagingTitle: {
    fontSize: "18px",
    fontWeight: 900,
    lineHeight: 1.1,
  },
  sidebarImagingMeta: {
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#5d7187",
  },
};
