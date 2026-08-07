import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";

export default function AdminScreen() {
  const navigate = useNavigate();

  return (
    <AdminShell
      sidebarCopy="A soft admin console for RenfrewPlus support, visibility, and system oversight."
      onBack={() => navigate("/")}
      hideBackButton
      useGlobalMenuFallback={false}
    >
      <section style={styles.heroShell}>
        <div style={styles.heroCopy}>
          <div style={styles.kicker}>Admin screen</div>
          <p style={styles.subtitle}>
            Admin Screen
          </p>
        </div>

        <div style={styles.heroArt}>
          <div style={styles.heroStatusCard}>
            <div style={styles.heroStatusTop}>
              <span style={styles.statusPill}>Admin window</span>
              <span style={styles.statusDot} />
            </div>
            <div style={styles.heroStatusTitle}>Screen identity</div>
            <div style={styles.heroStatusText}>
              A quiet landing area for admin tools, permissions, and support work.
            </div>
          </div>
        </div>
      </section>

      <section style={styles.quickActions}>
        <button type="button" style={styles.actionButton} onClick={() => navigate("/admin/config")}>
          <span style={styles.actionTitle}>Config</span>
          <span style={styles.actionMeta}>Edit live app config</span>
        </button>
        <button type="button" style={styles.actionButton} onClick={() => navigate("/admin/hipaa")}>
          <span style={styles.actionTitle}>HIPAA</span>
          <span style={styles.actionMeta}>Review readiness gaps and controls</span>
        </button>
        <button type="button" style={styles.actionButton} onClick={() => navigate("/admin/security")}>
          <span style={styles.actionTitle}>Security</span>
          <span style={styles.actionMeta}>Document auth-side controls and steps</span>
        </button>
        <button type="button" style={styles.actionButton} onClick={() => navigate("/admin/portability")}>
          <span style={styles.actionTitle}>Portability</span>
          <span style={styles.actionMeta}>Plan server migration readiness</span>
        </button>
        <button type="button" style={styles.actionButton} onClick={() => navigate("/admin/dependencies")}>
          <span style={styles.actionTitle}>Dependencies</span>
          <span style={styles.actionMeta}>Review server prerequisites</span>
        </button>
        <button type="button" style={styles.actionButton} onClick={() => navigate("/admin/schema")}>
          <span style={styles.actionTitle}>Schema</span>
          <span style={styles.actionMeta}>Review table structure</span>
        </button>
        <button type="button" style={styles.actionButton} onClick={() => navigate("/admin/auditors")}>
          <span style={styles.actionTitle}>Auditors</span>
          <span style={styles.actionMeta}>Open technical data sheets</span>
        </button>
        <button type="button" style={styles.actionButton} onClick={() => navigate("/worklist-editor")}>
          <span style={styles.actionTitle}>Daily Worklist</span>
          <span style={styles.actionMeta}>Manage the daily work queue</span>
        </button>
        <button type="button" style={styles.actionButton} onClick={() => navigate("/admin/menus")}>
          <span style={styles.actionTitle}>Menu Builder</span>
          <span style={styles.actionMeta}>Shape sidebar navigation</span>
        </button>
        <button type="button" style={styles.actionButton} onClick={() => navigate("/sites")}>
          <span style={styles.actionTitle}>Sites</span>
          <span style={styles.actionMeta}>Maintain site names</span>
        </button>
        <button type="button" style={styles.actionButton} onClick={() => navigate("/admin/tables")}>
          <span style={styles.actionTitle}>Tables</span>
          <span style={styles.actionMeta}>Browse database tables</span>
        </button>
        <button type="button" style={styles.actionButton} onClick={() => navigate("/admin/roles")}>
          <span style={styles.actionTitle}>Roles</span>
          <span style={styles.actionMeta}>Define screen access</span>
        </button>
        <button type="button" style={styles.actionButton} onClick={() => navigate("/admin/users")}>
          <span style={styles.actionTitle}>Users</span>
          <span style={styles.actionMeta}>Manage signins and passwords</span>
        </button>
        <button type="button" style={styles.actionButton} onClick={() => navigate("/misc-editor")}>
          <span style={styles.actionTitle}>Misc Editor</span>
          <span style={styles.actionMeta}>Maintain lookup labels</span>
        </button>
      </section>

      <div style={styles.contentWatermark} aria-hidden="true">
        <img src="/renfrew-womenline.png" alt="" style={styles.contentWatermarkImage} />
      </div>
    </AdminShell>
  );
}

export const styles: Record<string, CSSProperties> = {
  // Watermark rule: keep it below the hero as a separate centered block, never as an overlay.
  // Hero rule: keep the admin hero compact, two-column, and screen-identifying without extra body sections.
  contentWatermark: {
    display: "grid",
    placeItems: "center",
    pointerEvents: "none",
    marginTop: "-14px",
    padding: "8px 0 0",
  },
  contentWatermarkImage: {
    width: "min(560px, 72vw)",
    height: "auto",
    opacity: 0.12,
    filter: "grayscale(100%) contrast(0.94)",
    objectFit: "contain",
    mixBlendMode: "multiply",
  },
  content: {
    position: "relative",
    zIndex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    paddingTop: "88px",
  },
  heroShell: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.9fr)",
    gap: "12px",
    padding: "14px 16px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(243,247,252,0.96) 42%, rgba(247,250,255,0.92) 100%)",
    boxShadow: "0 24px 48px rgba(52, 84, 120, 0.08)",
    overflow: "hidden",
    position: "sticky",
    top: "16px",
    zIndex: 2,
  },
  heroCopy: {
    display: "grid",
    gap: "8px",
    alignContent: "start",
  },
  kicker: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    maxWidth: "none",
    fontSize: "20px",
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
    color: "#536579",
    fontWeight: 800,
  },
  heroActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    position: "fixed",
    top: "18px",
    left: "282px",
    right: "16px",
    zIndex: 4,
    padding: "12px 16px",
    borderRadius: "18px",
    background: "rgba(255, 255, 255, 0.90)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    boxShadow: "0 16px 28px rgba(52, 84, 120, 0.10)",
  },
  primaryButton: {
    height: "44px",
    padding: "0 18px",
    borderRadius: "14px",
    border: "1px solid rgba(106, 137, 180, 0.24)",
    background: "linear-gradient(135deg, #dbeeff 0%, #c6ddfb 100%)",
    color: "#15304f",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 14px 24px rgba(119, 151, 198, 0.16)",
  },
  secondaryButton: {
    height: "44px",
    padding: "0 18px",
    borderRadius: "14px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    background: "rgba(255,255,255,0.9)",
    color: "#35506d",
    fontWeight: 800,
    cursor: "pointer",
  },
  heroArt: {
    display: "grid",
    alignItems: "stretch",
  },
  quickActions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginTop: "18px",
  },
  actionButton: {
    minHeight: "88px",
    padding: "14px 16px",
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(243,248,255,0.96) 48%, rgba(255,239,246,0.94) 100%)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.08)",
    cursor: "pointer",
    textAlign: "left",
    display: "grid",
    gap: "6px",
    alignContent: "start",
  },
  actionTitle: {
    fontSize: "15px",
    fontWeight: 900,
    color: "#17324f",
  },
  actionMeta: {
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#5e7186",
  },
  heroStatusCard: {
    padding: "12px",
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(236,243,251,0.96) 100%)",
    boxShadow: "0 18px 38px rgba(52, 84, 120, 0.08)",
    display: "grid",
    gap: "6px",
    alignContent: "start",
  },
  heroStatusTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(224, 237, 250, 0.95)",
    color: "#35506d",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  statusDot: {
    width: "11px",
    height: "11px",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #4caf7d 0%, #79d8a9 100%)",
    boxShadow: "0 0 0 6px rgba(76, 175, 125, 0.12)",
  },
  heroStatusTitle: {
    fontSize: "16px",
    lineHeight: 1.08,
    fontWeight: 900,
    color: "#17324f",
  },
  heroStatusText: {
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#536579",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "16px",
  },
  statCard: {
    padding: "18px",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.84)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
  },
  statLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#72859a",
    marginBottom: "10px",
    fontWeight: 800,
  },
  statValue: {
    fontSize: "20px",
    fontWeight: 800,
    color: "#17324f",
    marginBottom: "8px",
  },
  statDetail: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#597085",
  },
  widgetSection: {
    padding: "20px",
    borderRadius: "30px",
    background: "rgba(255,255,255,0.74)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 20px 42px rgba(52, 84, 120, 0.06)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "16px",
  },
  sectionKicker: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#74879c",
    fontWeight: 800,
    marginBottom: "8px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "24px",
    color: "#17324f",
  },
  sectionMeta: {
    maxWidth: "340px",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#5e7186",
  },
};
