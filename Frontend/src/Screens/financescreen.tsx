import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell, styles as adminStyles } from "../components/AdminShell";
import { styles as cashStyles } from "./cashscreen";

export default function FinanceScreen() {
  const navigate = useNavigate();

  return (
    <AdminShell
      ribbonTitle="Finance"
      sidebarCopy="A finance workspace with a dedicated Misc feature on the left bar."
      onBack={() => navigate("/")}
      sidebarAction={
        <div style={financeStyles.sidebarActionStack}>
          <button type="button" onClick={() => navigate("/misc")} style={financeStyles.sidebarNavButton}>
            <div style={financeStyles.sidebarNavKicker}>Finance</div>
            <div style={financeStyles.sidebarNavTitle}>Misc</div>
            <div style={financeStyles.sidebarNavMeta}>Open the Misc workspace from the left menu.</div>
          </button>
        </div>
      }
    >
      <section style={financeStyles.content}>
        <section style={financeStyles.heroPane}>
          <div style={financeStyles.heroCopy}>
            <div style={adminStyles.kicker}>Finance section</div>
            <p style={financeStyles.subtitle}>Finance workspace</p>
          </div>

          <div style={financeStyles.heroArt}>
            <div style={financeStyles.heroCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Finance window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Finance flow board</div>
              <div style={adminStyles.heroStatusText}>A quiet space for finance review, cross-checks, and follow-up.</div>
            </div>
          </div>
        </section>
      </section>
    </AdminShell>
  );
}

const financeStyles: Record<string, CSSProperties> = {
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
  sidebarActionStack: {
    display: "grid",
    gap: "10px",
  },
  sidebarNavButton: {
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
  sidebarNavKicker: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#6c7f95",
    fontWeight: 800,
  },
  sidebarNavTitle: {
    fontSize: "18px",
    fontWeight: 900,
    lineHeight: 1.1,
  },
  sidebarNavMeta: {
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#5d7187",
  },
};
