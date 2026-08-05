import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from "./adminscreen";

type Status = "Done" | "Partial" | "Need to do";

type AuthStep = {
  title: string;
  detail: string;
  status: Status;
};

type DeploymentStep = {
  step: string;
  purpose: string;
};

const authSteps: AuthStep[] = [
  {
    title: "Unique sign-in records",
    detail: "Every user account maps to one identity and one password hash.",
    status: "Done",
  },
  {
    title: "Salted password hashing",
    detail: "Passwords are hashed with PBKDF2-HMAC-SHA256 and a random salt before storage.",
    status: "Done",
  },
  {
    title: "Parameterized signin lookup",
    detail: "The login query uses bound parameters instead of string-built SQL.",
    status: "Done",
  },
  {
    title: "Generic login failure",
    detail: "The app returns the same error for invalid signin and password attempts.",
    status: "Done",
  },
  {
    title: "Active account check",
    detail: "Disabled users are blocked before authentication completes.",
    status: "Done",
  },
  {
    title: "Profile and password reset flow",
    detail: "Signed-in users can update their own display name, phone number, and password, while admins can reset passwords from Users.",
    status: "Done",
  },
  {
    title: "Auth boundary isolation",
    detail: "The next step is still to move auth into a dedicated service boundary if we want stronger separation.",
    status: "Partial",
  },
];

const deploymentSteps: DeploymentStep[] = [
  {
    step: "Create an auth service boundary",
    purpose: "Keep login logic and password verification isolated from the rest of the app flow.",
  },
  {
    step: "Move login and bootstrap flows behind that boundary",
    purpose: "Ensure all sign-in requests enter through one controlled path.",
  },
  {
    step: "Keep all DB access parameterized",
    purpose: "Use bound parameters only so user input cannot become executable SQL.",
  },
  {
    step: "Hand back a signed session result",
    purpose: "Let the main app consume identity state without handling raw passwords again.",
  },
  {
    step: "Add throttling and lockout",
    purpose: "Reduce guessing attacks and noisy sign-in abuse.",
  },
  {
    step: "Log auth events",
    purpose: "Record sign-ins, failures, admin changes, and password updates for review.",
  },
];

export default function SecurityScreen() {
  const navigate = useNavigate();

  const counts = useMemo(() => {
    const totals = { done: 0, partial: 0, need: 0 };
    for (const item of authSteps) {
      if (item.status === "Done") totals.done += 1;
      if (item.status === "Partial") totals.partial += 1;
      if (item.status === "Need to do") totals.need += 1;
    }
    return totals;
  }, []);

  return (
    <AdminShell
      sidebarCopy="Document what the auth side has already done, what still needs to happen, and how the boundary is shaped."
      sidebarCardLabel="Auth steps"
      sidebarCardValue={`${counts.done} done`}
      sidebarCardMeta={`${counts.partial} partial, ${counts.need} remaining.`}
      onBack={() => navigate("/admin")}
      hideBackButton
      useGlobalMenuFallback={false}
      ribbonTitle="Security"
    >
      <section style={styles.page}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Security module</div>
            <p style={adminStyles.subtitle}>
              Auth-side documentation for signin protocols, SQL safety, password handling, profile updates, and the
              isolation path we can own in the app.
            </p>
            <div style={styles.heroActions}>
              <button type="button" style={adminStyles.primaryButton} onClick={() => navigate("/admin/hipaa")}>
                Open HIPAA
              </button>
              <button type="button" style={adminStyles.secondaryButton} onClick={() => navigate("/admin/users")}>
                Open Users
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Auth boundary</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>What we control</div>
              <div style={adminStyles.heroStatusText}>
                The app team can harden sign-in, isolate the auth flow, parameterize database calls, manage profile
                updates, and document the steps taken. IT still owns the host, network, and identity infrastructure
                around it.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Done</div>
            <div style={styles.summaryValue}>{counts.done}</div>
            <div style={styles.summaryMeta}>Auth behaviors already visible in the current codebase.</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Partial</div>
            <div style={styles.summaryValue}>{counts.partial}</div>
            <div style={styles.summaryMeta}>Controls that exist but need stronger separation or expansion.</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Need to do</div>
            <div style={styles.summaryValue}>{counts.need}</div>
            <div style={styles.summaryMeta}>Missing controls to finish the auth-side hardening plan.</div>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Auth-side steps taken</div>
              <h2 style={adminStyles.sectionTitle}>What the current code already does</h2>
            </div>
            <div style={adminStyles.sectionMeta}>{authSteps.length} documented controls</div>
          </div>

          <div style={styles.stepList}>
            {authSteps.map((item) => (
              <article key={item.title} style={styles.stepCard}>
                <div style={styles.stepTopRow}>
                  <div>
                    <div style={styles.stepTitle}>{item.title}</div>
                    <div style={styles.stepDetail}>{item.detail}</div>
                  </div>
                  <span style={{ ...styles.badge, ...statusStyles[item.status] }}>{item.status}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Isolation plan</div>
              <h2 style={adminStyles.sectionTitle}>Steps to employ a separate auth boundary</h2>
            </div>
            <div style={adminStyles.sectionMeta}>{deploymentSteps.length} steps</div>
          </div>

          <ol style={styles.planList}>
            {deploymentSteps.map((item) => (
              <li key={item.step}>
                <strong>{item.step}:</strong> {item.purpose}
              </li>
            ))}
          </ol>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>What to document</div>
              <h2 style={adminStyles.sectionTitle}>Evidence to keep in the security record</h2>
            </div>
            <button type="button" style={adminStyles.secondaryButton} onClick={() => navigate("/admin/hipaa")}>
              View HIPAA impact
            </button>
          </div>

          <ul style={styles.bulletList}>
            <li>Auth endpoints and what each one does.</li>
            <li>The password hashing scheme, salt format, and iteration count.</li>
            <li>SQL parameterization patterns used in auth queries.</li>
            <li>The profile and password reset flow for signed-in users and admins.</li>
            <li>Lockout, throttling, and session timeout settings.</li>
            <li>Who reviewed and approved the auth boundary design.</li>
          </ul>
        </section>
      </section>
    </AdminShell>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "grid",
    gap: "18px",
  },
  heroActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginTop: "8px",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  summaryCard: {
    padding: "16px",
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
    display: "grid",
    gap: "6px",
  },
  summaryLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  summaryValue: {
    fontSize: "34px",
    lineHeight: 1,
    fontWeight: 900,
    color: "#17324f",
  },
  summaryMeta: {
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#5e7186",
  },
  card: {
    display: "grid",
    gap: "14px",
    padding: "18px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  stepList: {
    display: "grid",
    gap: "12px",
  },
  stepCard: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(145deg, rgba(251,252,254,1) 0%, rgba(241,246,252,0.96) 100%)",
    display: "grid",
    gap: "10px",
  },
  stepTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
  },
  stepTitle: {
    fontSize: "14px",
    fontWeight: 900,
    color: "#17324f",
  },
  stepDetail: {
    marginTop: "4px",
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#536579",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "92px",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  },
  planList: {
    margin: 0,
    paddingLeft: "18px",
    display: "grid",
    gap: "10px",
    color: "#405266",
    lineHeight: 1.6,
    fontSize: "13px",
    fontWeight: 600,
  },
  bulletList: {
    margin: 0,
    paddingLeft: "18px",
    display: "grid",
    gap: "10px",
    color: "#405266",
    lineHeight: 1.6,
    fontSize: "13px",
    fontWeight: 600,
  },
};

const statusStyles: Record<Status, CSSProperties> = {
  Done: {
    background: "rgba(224, 245, 230, 0.95)",
    color: "#24623e",
    borderColor: "rgba(59, 156, 99, 0.22)",
  },
  Partial: {
    background: "rgba(255, 245, 219, 0.95)",
    color: "#8a5b07",
    borderColor: "rgba(205, 153, 35, 0.22)",
  },
  "Need to do": {
    background: "rgba(255, 230, 230, 0.96)",
    color: "#a32121",
    borderColor: "rgba(179, 58, 58, 0.22)",
  },
};
