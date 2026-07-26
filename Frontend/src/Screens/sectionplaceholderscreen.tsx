import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { styles as adminStyles } from "./adminscreen";
import { WorklistBrandButton } from "../worklist/worklist";

interface SectionPlaceholderScreenProps {
  title: string;
  description: string;
}

export default function SectionPlaceholderScreen({ title, description }: SectionPlaceholderScreenProps) {
  const navigate = useNavigate();

  return (
    <main style={adminStyles.shell}>
      <div style={adminStyles.glowBlue} />
      <div style={adminStyles.glowPink} />

      <aside style={adminStyles.sidebar}>
        <div style={adminStyles.brandWrap}>
          <WorklistBrandButton style={adminStyles.brandMark} ariaLabel="Open work list from the branding button">
            <img src="/favicon.svg" alt="" style={adminStyles.brandMarkImage} />
          </WorklistBrandButton>
          <div style={adminStyles.brandWomenMark} aria-hidden="true">
            <img src="/renfrew-gazebo.png" alt="" style={adminStyles.brandWomenImage} />
          </div>
        </div>

        <p style={adminStyles.sidebarCopy}>
          A placeholder workspace for {title.toLowerCase()} is ready to be filled in.
        </p>

        <nav style={adminStyles.navStack} aria-label={`${title} navigation`}>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/")}>
            <span style={adminStyles.navButtonLabel}>Home</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/cash")}>
            <span style={adminStyles.navButtonLabel}>Cash</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Status</div>
          <div style={adminStyles.sidebarCardValue}>{title}</div>
          <div style={adminStyles.sidebarCardMeta}>{description}</div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
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
    </main>
  );
}

const placeholderStyles: Record<string, CSSProperties> = {
  heroActions: {
    position: "fixed",
    top: "18px",
    left: "282px",
    right: "16px",
    zIndex: 4,
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 18px 36px rgba(52, 84, 120, 0.08)",
  },
};
