import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApprovedList } from "../api/approvedlist_api";
import type { ApprovedBatch } from "../api/approvedlist_api";

const approvedHeroButtonStyle: CSSProperties = {
  height: "44px",
  padding: "0 18px",
  borderRadius: "14px",
  border: "1px solid rgba(188, 193, 203, 0.68)",
  background: "rgba(255, 255, 255, 0.96)",
  color: "#15304f",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 14px 24px rgba(119, 151, 198, 0.10)",
};

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: "100vh",
    padding: "18px",
    position: "relative",
    overflow: "hidden",
    color: "#16304d",
    background:
      "radial-gradient(circle at top left, rgba(146, 198, 255, 0.22) 0%, rgba(146, 198, 255, 0) 34%), radial-gradient(circle at top right, rgba(255, 186, 213, 0.20) 0%, rgba(255, 186, 213, 0) 30%), linear-gradient(180deg, #f6f9fc 0%, #eef4fb 100%)",
  },
  content: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: "18px",
    maxWidth: "1280px",
    margin: "0 auto",
  },
  heroShell: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(260px, 0.8fr)",
    gap: "18px",
    padding: "24px",
    borderRadius: "28px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.72)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.10)",
  },
  kicker: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    fontSize: "12px",
    fontWeight: 800,
    color: "#607089",
  },
  title: {
    margin: "8px 0 0",
    fontSize: "38px",
    lineHeight: 1.05,
    fontWeight: 900,
    color: "#17314f",
  },
  subtitle: {
    margin: "10px 0 0",
    maxWidth: "760px",
    fontSize: "16px",
    lineHeight: 1.7,
    color: "#536579",
  },
  heroActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "20px",
  },
  heroArt: {
    display: "grid",
    alignContent: "center",
  },
  heroStatusCard: {
    borderRadius: "24px",
    padding: "18px",
    background:
      "linear-gradient(135deg, rgba(243, 248, 255, 0.95) 0%, rgba(255, 239, 245, 0.92) 100%)",
    border: "1px solid rgba(175, 193, 218, 0.22)",
    boxShadow: "0 18px 34px rgba(84, 112, 153, 0.10)",
  },
  heroStatusTitle: {
    marginTop: "12px",
    fontSize: "18px",
    fontWeight: 800,
    color: "#17314f",
  },
  heroStatusText: {
    marginTop: "8px",
    lineHeight: 1.6,
    color: "#526579",
    fontSize: "14px",
  },
  card: {
    padding: "20px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    background: "rgba(255, 255, 255, 0.84)",
    backdropFilter: "blur(16px)",
    boxShadow: "0 20px 42px rgba(52, 84, 120, 0.08)",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "820px",
  },
  th: {
    textAlign: "left",
    padding: "12px 14px",
    fontSize: "13px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#617089",
    borderBottom: "1px solid rgba(165, 180, 200, 0.25)",
  },
  td: {
    padding: "14px",
    borderBottom: "1px solid rgba(214, 223, 233, 0.72)",
    color: "#20364f",
    fontSize: "14px",
    verticalAlign: "top",
  },
  error: {
    marginBottom: "12px",
    color: "#a32121",
    fontWeight: 700,
  },
};

const ApprovedList = () => {
  const navigate = useNavigate();
  const [approved, setApproved] = useState<ApprovedBatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getApprovedList()
      .then((res) => {
        setApproved(res.data);
        setError(null);
      })
      .catch((err) => {
        setApproved([]);
        setError(err instanceof Error ? err.message : "Failed to load approved batches");
      });
  }, []);

  return (
    <main style={styles.shell}>
      <section style={styles.content}>
        <section style={styles.heroShell}>
          <div>
            <p style={styles.kicker}>Approved items</p>
            <h1 style={styles.title}>Approved Site Batches</h1>
            <p style={styles.subtitle}>
              A calm, current-style view of approved batches with the same soft white controls used across the newer
              screens.
            </p>

            <div style={styles.heroActions}>
              <button style={approvedHeroButtonStyle} type="button" onClick={() => navigate("/site-review")}>
                Site Review
              </button>
            </div>
          </div>

          <div style={styles.heroArt}>
            <div style={styles.heroStatusCard}>
              <div style={styles.heroStatusTitle}>Approved list view</div>
              <div style={styles.heroStatusText}>
                The list keeps the same shell treatment so it feels like part of the same workspace.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.card}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Import ID</th>
                  <th style={styles.th}>Filename</th>
                  <th style={styles.th}>Site</th>
                  <th style={styles.th}>Detail</th>
                  <th style={styles.th}>Total</th>
                  <th style={styles.th}>Date</th>
                </tr>
              </thead>
              <tbody>
                {approved.map((row) => (
                  <tr key={row.id}>
                    <td style={styles.td}>{row.id}</td>
                    <td style={styles.td}>{row.filename}</td>
                    <td style={styles.td}>{row.site}</td>
                    <td style={styles.td}>{row.detail}</td>
                    <td style={styles.td}>
                      {Number(row.total || 0).toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                    </td>
                    <td style={styles.td}>{row.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
};

export default ApprovedList;
