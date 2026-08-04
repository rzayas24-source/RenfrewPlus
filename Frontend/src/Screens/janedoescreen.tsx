import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell, styles as adminStyles } from "../components/AdminShell";

export default function JaneDoeScreen() {
  const navigate = useNavigate();

  return (
    <AdminShell
      ribbonTitle="Jane Doe"
      sidebarCopy="A dedicated collections workspace for Jane Doe."
      onBack={() => navigate("/collections")}
      sidebarAction={
        <button type="button" onClick={() => navigate("/collections")} style={janeDoeStyles.sidebarButton}>
          <div style={janeDoeStyles.sidebarButtonKicker}>Collections</div>
          <div style={janeDoeStyles.sidebarButtonTitle}>Back to collections</div>
          <div style={janeDoeStyles.sidebarButtonMeta}>Return to the collections menu from the left bar.</div>
        </button>
      }
    >
      <section style={janeDoeStyles.content}>
        <section style={janeDoeStyles.heroPane}>
          <div style={janeDoeStyles.heroCopy}>
            <div style={adminStyles.kicker}>Collections screen</div>
            <h1 style={janeDoeStyles.heroTitle}>Jane Doe</h1>
            <p style={janeDoeStyles.heroSubtitle}>
              A focused workspace for Jane Doe, built with the shared admin shell so it stays consistent with the
              rest of the app.
            </p>
            <div style={janeDoeStyles.heroNote}>Use the left bar to jump back to Collections whenever you need to.</div>
          </div>

          <div style={janeDoeStyles.heroArt}>
            <div style={janeDoeStyles.heroCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Jane Doe window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Dedicated shell, familiar layout</div>
              <div style={adminStyles.heroStatusText}>
                The page is intentionally simple for now, giving us a clean destination to expand later without
                changing the shell.
              </div>
            </div>
          </div>
        </section>
      </section>
    </AdminShell>
  );
}

const janeDoeStyles: Record<string, CSSProperties> = {
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
