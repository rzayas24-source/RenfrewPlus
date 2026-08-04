import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell, styles as adminStyles } from "../components/AdminShell";
import { styles as cashStyles } from "./cashscreen";

export default function BusinessScreen() {
  const navigate = useNavigate();

  return (
    <AdminShell
      ribbonTitle="Business"
      sidebarCopy="A business workspace with a dedicated Discrepancy feature in the left bar."
      onBack={() => navigate("/")}
      useGlobalMenuFallback={false}
    >
      <section style={businessStyles.content}>
        <section style={businessStyles.heroPane}>
          <div style={businessStyles.heroCopy}>
            <div style={adminStyles.kicker}>Business section</div>
            <p style={businessStyles.subtitle}>Business workspace</p>
          </div>

          <div style={businessStyles.heroArt}>
            <div style={businessStyles.heroCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Business window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Business flow board</div>
              <div style={adminStyles.heroStatusText}>A quiet space for business review, reconciliation, and follow-up.</div>
            </div>
          </div>
        </section>

        <button type="button" onClick={() => navigate("/discrepancy")} style={businessStyles.discrepancyButton}>
          <div style={businessStyles.discrepancyButtonKicker}>Open feature</div>
          <div style={businessStyles.discrepancyButtonTitle}>Discrepancy</div>
          <div style={businessStyles.discrepancyButtonMeta}>
            Jump directly into the discrepancy workspace from the business landing page.
          </div>
        </button>
      </section>
    </AdminShell>
  );
}

const businessStyles: Record<string, CSSProperties> = {
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
  discrepancyButton: {
    marginTop: "10px",
    width: "fit-content",
    minWidth: "220px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    borderRadius: "18px",
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
    background: "linear-gradient(135deg, rgba(236, 245, 255, 0.98) 0%, rgba(255, 239, 246, 0.96) 100%)",
    boxShadow: "0 10px 20px rgba(52, 84, 120, 0.07)",
    display: "grid",
    gap: "4px",
    color: "#16304d",
  },
  discrepancyButtonKicker: {
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6c7f95",
    fontWeight: 800,
  },
  discrepancyButtonTitle: {
    fontSize: "15px",
    fontWeight: 900,
    lineHeight: 1.1,
  },
  discrepancyButtonMeta: {
    fontSize: "11px",
    lineHeight: 1.35,
    color: "#5d7187",
  },
  heroArt: {
    ...cashStyles.heroArt,
  },
  heroCard: {
    ...cashStyles.heroStatusCard,
  },
};
