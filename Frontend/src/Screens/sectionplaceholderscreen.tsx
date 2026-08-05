import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell, styles as adminStyles } from "../components/AdminShell";

interface SectionPlaceholderScreenProps {
  title: string;
  description: string;
}

export default function SectionPlaceholderScreen({ title, description }: SectionPlaceholderScreenProps) {
  const navigate = useNavigate();

  return (
    <AdminShell
      ribbonTitle={title}
      sidebarCopy={`A placeholder workspace for ${title.toLowerCase()} is ready to be filled in.`}
      sidebarCardLabel="Status"
      sidebarCardValue={title}
      sidebarCardMeta={description}
      onBack={() => navigate("/cash")}
      hideSidebarNavButtons
    >
      <section style={placeholderStyles.content}>
        <section style={placeholderStyles.heroShell}>
          <div style={placeholderStyles.heroCopy}>
            <div style={adminStyles.kicker}>{title}</div>
            <p style={adminStyles.subtitle}>{description}</p>
            <div style={placeholderStyles.heroActions}>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/cash")}>
                Open Cash
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Section ready</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Coming next</div>
              <div style={adminStyles.heroStatusText}>
                This route is now live so the new menu button lands somewhere stable.
              </div>
            </div>
          </div>
        </section>
      </section>
    </AdminShell>
  );
}

const placeholderStyles: Record<string, CSSProperties> = {
  content: {
    ...adminStyles.content,
    paddingTop: "8px",
  },
  heroShell: {
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
  heroActions: {
    marginTop: "18px",
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    alignItems: "center",
  },
};
