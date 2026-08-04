import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell, styles as adminStyles } from "../components/AdminShell";

export default function MiscScreen() {
  const navigate = useNavigate();

  return (
    <AdminShell
      ribbonTitle="Misc"
      sidebarCopy="A dedicated Misc page under Finance."
      onBack={() => navigate("/finance")}
      sidebarAction={
        <button type="button" onClick={() => navigate("/finance")} style={miscStyles.sidebarButton}>
          <div style={miscStyles.sidebarButtonKicker}>Finance</div>
          <div style={miscStyles.sidebarButtonTitle}>Back to finance</div>
          <div style={miscStyles.sidebarButtonMeta}>Return to the finance landing page from the left bar.</div>
        </button>
      }
    >
      <section style={miscStyles.content}>
        <section style={miscStyles.heroPane}>
          <div style={miscStyles.heroCopy}>
            <div style={adminStyles.kicker}>Finance feature</div>
            <h1 style={miscStyles.heroTitle}>Misc</h1>
            <p style={miscStyles.heroSubtitle}>
              A dedicated Misc workspace for finance, built with the shared admin shell for consistency.
            </p>
            <div style={miscStyles.heroNote}>The left menu now has a direct Misc shortcut.</div>
          </div>

          <div style={miscStyles.heroArt}>
            <div style={miscStyles.heroCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Misc window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Finance feature online</div>
              <div style={adminStyles.heroStatusText}>
                This page is ready for future Misc-specific tools, notes, or reporting.
              </div>
            </div>
          </div>
        </section>
      </section>
    </AdminShell>
  );
}

const miscStyles: Record<string, CSSProperties> = {
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
  sidebarButton: {
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
  sidebarButtonKicker: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#6c7f95",
    fontWeight: 800,
  },
  sidebarButtonTitle: {
    fontSize: "18px",
    fontWeight: 900,
    lineHeight: 1.1,
  },
  sidebarButtonMeta: {
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#5d7187",
  },
};
