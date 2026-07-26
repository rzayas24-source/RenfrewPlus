import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";

interface Props {
  keyproofTotal: number;
  itemizationTotal: number;
  onEditKeyproof: () => void;
  onEditItemization: () => void;
  onAccept: () => void;
}

export default function BalanceCheck({
  keyproofTotal,
  itemizationTotal,
  onEditKeyproof,
  onEditItemization,
  onAccept,
}: Props) {
  const navigate = useNavigate();
  const matches = keyproofTotal === itemizationTotal;

  return (
    <AdminShell
      sidebarCopy="Compare the two totals before moving forward."
      sidebarCardLabel="Status"
      sidebarCardValue={matches ? "Balanced" : "Needs review"}
      sidebarCardMeta="Keep the check step visually consistent with the rest of the balance sheet section."
      onBack={() => navigate(-1)}
      ribbonTitle="Balance Check Menu"
    >
      <section style={styles.content}>
        <section style={styles.heroShell}>
          <div style={styles.heroCopy}>
            <div style={styles.kicker}>Balance Check</div>
            <h1 style={styles.title}>Review totals</h1>
            <p style={styles.subtitle}>Keyproof and itemization should line up before you continue.</p>
            <div style={styles.heroActions}>
              {matches ? (
                <button onClick={onAccept} style={styles.primaryButton} type="button">
                  Accept and Move to Next Batch
                </button>
              ) : (
                <>
                  <button onClick={onEditKeyproof} style={styles.primaryButton} type="button">
                    Edit Keyproof
                  </button>
                  <button onClick={onEditItemization} style={styles.secondaryButton} type="button">
                    Edit Itemization
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={styles.heroArt}>
            <div style={styles.heroStatusCard}>
              <div style={styles.heroStatusTop}>
                <span style={styles.statusPill}>Balance status</span>
                <span style={styles.statusDot} />
              </div>
              <div style={styles.heroStatusTitle}>{matches ? "Aligned totals" : "Out of balance"}</div>
              <div style={styles.heroStatusText}>
                Keyproof Total: ${keyproofTotal.toFixed(2)}
                <br />
                Itemization Total: ${itemizationTotal.toFixed(2)}
              </div>
            </div>
          </div>
        </section>

        {!matches && <div style={styles.error}>Batch does not balance.</div>}
      </section>
    </AdminShell>
  );
}

const styles: Record<string, CSSProperties> = {
  content: {
    display: "grid",
    gap: "18px",
    minWidth: 0,
    paddingTop: "88px",
  },
  heroShell: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, 0.9fr)",
    gap: "18px",
    alignItems: "stretch",
    padding: "24px",
    borderRadius: "32px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    background: "linear-gradient(135deg, rgba(255,255,255,0.90) 0%, rgba(248,250,253,0.88) 50%, rgba(255,244,248,0.92) 100%)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.08)",
  },
  heroCopy: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: 0,
  },
  kicker: {
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: "12px",
    fontWeight: 800,
    color: "#74879c",
    marginBottom: "10px",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 800,
    color: "#16304d",
  },
  subtitle: {
    margin: "8px 0 0",
    maxWidth: "760px",
    fontSize: "16px",
    lineHeight: 1.7,
    color: "#536579",
  },
  heroActions: {
    position: "fixed",
    top: "18px",
    left: "282px",
    right: "16px",
    zIndex: 4,
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 18px 36px rgba(52, 84, 120, 0.08)",
  },
  primaryButton: {
    height: "44px",
    padding: "0 18px",
    border: "1px solid rgba(106, 137, 180, 0.24)",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #dbeeff 0%, #c6ddfb 100%)",
    color: "#15304f",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 14px 24px rgba(119, 151, 198, 0.16)",
  },
  secondaryButton: {
    height: "44px",
    padding: "0 18px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.9)",
    color: "#35506d",
    fontWeight: 800,
    cursor: "pointer",
  },
  heroArt: {
    display: "grid",
    gap: "14px",
    alignContent: "center",
  },
  heroStatusCard: {
    borderRadius: "24px",
    padding: "18px",
    background: "linear-gradient(135deg, rgba(243, 248, 255, 0.95) 0%, rgba(255, 239, 245, 0.92) 100%)",
    border: "1px solid rgba(175, 193, 218, 0.22)",
  },
  heroStatusTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    height: "30px",
    padding: "0 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(158, 176, 204, 0.22)",
    fontSize: "12px",
    fontWeight: 800,
    color: "#4a6179",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#8ec4ff",
    boxShadow: "0 0 0 6px rgba(142, 196, 255, 0.18)",
  },
  heroStatusTitle: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#16304d",
    marginBottom: "8px",
  },
  heroStatusText: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#5a6c80",
  },
  error: {
    padding: "14px 16px",
    borderRadius: "18px",
    background: "rgba(255, 237, 237, 0.94)",
    border: "1px solid rgba(224, 107, 107, 0.30)",
    color: "#a32121",
    fontWeight: 700,
  },
};
