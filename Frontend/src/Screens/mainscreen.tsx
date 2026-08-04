import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";

export default function MainScreen() {
  const navigate = useNavigate();

  return (
    <AdminShell
      sidebarCopy="A soft, polished command center for the review flow, balance sheet, and completed batches."
      onBack={() => navigate("/")}
      hideBackButton
      useGlobalMenuFallback={false}
      ribbonTitle="Main Menu"
    >
      <section style={styles.content}>
        <section style={styles.heroShell}>
          <div style={styles.heroCopy}>
            <div style={styles.kicker}>Main screen</div>
            <div style={styles.heroWordmarkWrap}>
              <img
                src="/renfrewplus-banner-tight.png"
                alt="RenfrewPlus wordmark"
                style={styles.heroWordmark}
              />
            </div>
            <p style={styles.subtitle}>
              A calm workspace for review, approvals, and balance-sheet work.
            </p>
          </div>

          <div style={styles.heroArt}>
            <div style={styles.heroLogoCard}>
              <img
                src="/renfrew-womenline.png"
                alt="Renfrew girls holding hands mark"
                style={styles.heroLogoImage}
              />
            </div>

            <div style={styles.heroStatusCard}>
              <div style={styles.heroStatusTop}>
                <span style={styles.statusPill}>Live workspace</span>
                <span style={styles.statusDot} />
              </div>
              <div style={styles.heroStatusTitle}>Soft launch look</div>
              <div style={styles.heroStatusText}>
                Baby blue, pink, and light grey for a calmer first impression.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.careGrid}>
          <article style={styles.careCard}>
            <div style={styles.careMedia}>
              <img src="/women-care-reception.png" alt="Womens care center reception" style={styles.careImage} />
            </div>
          </article>

          <article style={styles.careCard}>
            <div style={styles.careMedia}>
              <img src="/women-care-group.png" alt="Women in a supportive group setting" style={styles.careImage} />
            </div>
          </article>
        </section>
      </section>
    </AdminShell>
  );
}

export const styles: Record<string, CSSProperties> = {
  content: {
    position: "relative",
    zIndex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    gap: "8px",
    height: "calc(100vh - 32px)",
  },
  heroShell: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, 0.9fr)",
    gap: "12px",
    alignItems: "stretch",
    padding: "16px",
    borderRadius: "32px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.90) 0%, rgba(248,250,253,0.88) 50%, rgba(255,244,248,0.92) 100%)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.08)",
  },
  heroCopy: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minWidth: 0,
    paddingTop: "6px",
    height: "100%",
  },
  heroWordmarkWrap: {
    maxWidth: "500px",
    padding: "0 0 4px",
  },
  heroWordmark: {
    display: "block",
    width: "100%",
    height: "auto",
  },
  kicker: {
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: "11px",
    fontWeight: 800,
    color: "#74879c",
    marginBottom: "8px",
  },
  subtitle: {
    margin: "6px 0 0",
    maxWidth: "760px",
    fontSize: "14px",
    lineHeight: 1.55,
    color: "#536579",
  },
  heroArt: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  heroLogoCard: {
    flex: 1,
    minHeight: "160px",
    padding: "14px",
    borderRadius: "28px",
    background: "rgba(255,255,255,0.94)",
    border: "1px solid rgba(140, 160, 184, 0.12)",
    display: "grid",
    placeItems: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), 0 18px 34px rgba(52, 84, 120, 0.08)",
  },
  heroLogoImage: {
    width: "100%",
    maxWidth: "280px",
    height: "auto",
    display: "block",
  },
  heroStatusCard: {
    padding: "12px 14px",
    borderRadius: "24px",
    background: "linear-gradient(135deg, rgba(226, 243, 255, 0.98) 0%, rgba(255, 235, 244, 0.96) 100%)",
    border: "1px solid rgba(140, 160, 184, 0.18)",
  },
  heroStatusTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "8px",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "6px 10px",
    background: "rgba(255,255,255,0.8)",
    color: "#4f647a",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  statusDot: {
    width: "11px",
    height: "11px",
    borderRadius: "50%",
    background: "#95c6ff",
    boxShadow: "0 0 0 6px rgba(149, 198, 255, 0.20)",
    flexShrink: 0,
  },
  heroStatusTitle: {
    fontSize: "16px",
    fontWeight: 800,
    marginBottom: "6px",
    color: "#16304d",
  },
  heroStatusText: {
    fontSize: "13px",
    lineHeight: 1.45,
    color: "#5d7187",
  },
  careGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
    flex: 1,
    minHeight: 0,
    alignItems: "stretch",
  },
  careCard: {
    minHeight: 0,
    borderRadius: "28px",
    padding: "10px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(135deg, rgba(255,255,255,0.93) 0%, rgba(247,250,254,0.92) 55%, rgba(255,242,247,0.90) 100%)",
    boxShadow: "0 22px 40px rgba(52, 84, 120, 0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flex: 1,
  },
  careMedia: {
    borderRadius: "22px",
    overflow: "hidden",
    border: "1px solid rgba(140, 160, 184, 0.12)",
    background: "linear-gradient(135deg, rgba(226, 243, 255, 0.78) 0%, rgba(255, 236, 244, 0.76) 100%)",
    minHeight: "140px",
    display: "grid",
    placeItems: "center",
  },
  careImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    display: "block",
    opacity: 0.95,
  },
};
