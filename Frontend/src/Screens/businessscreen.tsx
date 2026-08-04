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
  heroArt: {
    ...cashStyles.heroArt,
  },
  heroCard: {
    ...cashStyles.heroStatusCard,
  },
};
