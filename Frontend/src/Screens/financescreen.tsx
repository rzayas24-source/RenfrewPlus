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
      useGlobalMenuFallback={false}
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

        <button type="button" onClick={() => navigate("/misc")} style={financeStyles.miscButton}>
          Misc
        </button>
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
  miscButton: {
    marginTop: "10px",
    width: "fit-content",
    minWidth: "150px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    borderRadius: "18px",
    padding: "12px 16px",
    cursor: "pointer",
    background: "linear-gradient(135deg, rgba(236, 245, 255, 0.98) 0%, rgba(255, 239, 246, 0.96) 100%)",
    boxShadow: "0 10px 20px rgba(52, 84, 120, 0.07)",
    color: "#16304d",
    fontSize: "15px",
    fontWeight: 900,
    textAlign: "center",
  },
};
