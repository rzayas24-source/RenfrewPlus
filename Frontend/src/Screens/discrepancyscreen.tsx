import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell, styles as adminStyles } from "../components/AdminShell";

export default function DiscrepancyScreen() {
  const navigate = useNavigate();

  return (
    <AdminShell
      ribbonTitle="Discrepancy"
      sidebarCopy="A dedicated Discrepancy workspace under Business."
      onBack={() => navigate("/business")}
      sidebarAction={
        <button type="button" onClick={() => navigate("/business")} style={discrepancyStyles.sidebarButton}>
          <div style={discrepancyStyles.sidebarButtonKicker}>Business</div>
          <div style={discrepancyStyles.sidebarButtonTitle}>Back to business</div>
          <div style={discrepancyStyles.sidebarButtonMeta}>Return to the business landing page from the left bar.</div>
        </button>
      }
    >
      <section style={discrepancyStyles.content}>
        <section style={discrepancyStyles.heroPane}>
          <div style={discrepancyStyles.heroCopy}>
            <div style={adminStyles.kicker}>Business feature</div>
            <h1 style={discrepancyStyles.heroTitle}>Discrepancy</h1>
            <p style={discrepancyStyles.heroSubtitle}>
              A dedicated Discrepancy workspace for business, built with the shared admin shell for consistency.
            </p>
            <div style={discrepancyStyles.heroNote}>The left menu now has a direct Discrepancy shortcut.</div>
          </div>

          <div style={discrepancyStyles.heroArt}>
            <div style={discrepancyStyles.heroCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Discrepancy window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Business feature online</div>
              <div style={adminStyles.heroStatusText}>
                This page is ready for future discrepancy review, reconciliation, or tracking tools.
              </div>
            </div>
          </div>
        </section>
      </section>
    </AdminShell>
  );
}

const discrepancyStyles: Record<string, CSSProperties> = {
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
