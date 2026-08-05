import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from "./adminscreen";

type CheckState = "Done" | "Partial" | "Need to do";

type CheckItem = {
  area: string;
  requirement: string;
  appStatus: CheckState;
  action: string;
};

type Section = {
  title: string;
  summary: string;
  items: CheckItem[];
};

type Milestone = {
  title: string;
  detail: string;
  owner: "App team" | "Shared";
  status: CheckState;
};

const authImpactSteps = [
  "Document that backend auth already exists and uses salted password hashes plus parameterized signin lookup.",
  "Keep the login flow behind a separate auth boundary if we split the service later.",
  "Add throttling, lockout, and generic failure messages around sign-in attempts.",
  "Return a signed session result to the main app and record the design in Security.",
];

const impactItems = [
  {
    title: "Sensitive drafts moved out of browser storage",
    detail: "Keyproof, itemization, and balance-check data now persist through the backend instead of relying on client-side caches.",
  },
  {
    title: "HIPAA exposure is lower on the app side",
    detail: "Removing browser-held workflow state reduces the chance of sensitive financial or PHI-adjacent data lingering on a workstation.",
  },
  {
    title: "Auth control is easier to document",
    detail: "The app can point to a known backend auth path, salted hashing, and parameterized signin lookup in the security record.",
  },
];

const sections: Section[] = [
  {
    title: "Access control",
    summary: "This is the first line of defense for both HIPAA and financial data.",
    items: [
      {
        area: "User accounts",
        requirement: "Every user must have a unique account and password.",
        appStatus: "Done",
        action:
          "Backend auth tables, login flow, profile updates, and password reset paths are already in place. Document the authentication path and ensure shared accounts are never used.",
      },
      {
        area: "Role-based access",
        requirement: "Limit users to the minimum necessary access for their job.",
        appStatus: "Partial",
        action: "Roles exist, but every PHI and financial route still needs server-side permission checks.",
      },
      {
        area: "MFA",
        requirement: "Admins and sensitive users should have multi-factor authentication.",
        appStatus: "Need to do",
        action: "Add MFA for privileged access, especially for any account that can view exports or admin data.",
      },
      {
        area: "Session timeout",
        requirement: "Idle sessions should lock out after a defined period.",
        appStatus: "Need to do",
        action: "Add idle timeout, absolute timeout, and re-authentication for high-risk actions. The new profile screen does not replace session controls.",
      },
    ],
  },
  {
    title: "Data handling",
    summary: "Protect the data itself, not just the login page.",
    items: [
      {
        area: "Browser storage",
        requirement: "Sensitive PHI or financial data should not live in localStorage.",
        appStatus: "Done",
        action: "Sensitive workflow drafts now persist through the backend, which keeps them out of browser storage.",
      },
      {
        area: "Minimum necessary",
        requirement: "Only show the smallest amount of data needed to do the task.",
        appStatus: "Partial",
        action: "Split views so users see masked or truncated values unless their role requires full detail.",
      },
      {
        area: "Encryption at rest",
        requirement: "Databases, exports, and backups should be encrypted.",
        appStatus: "Need to do",
        action: "Turn on encryption for the database, file shares, backup volume, and any attachment storage.",
      },
      {
        area: "Transmission security",
        requirement: "PHI and financial data should only move over secure channels.",
        appStatus: "Need to do",
        action: "Force HTTPS or private-network TLS for the frontend, backend, and any service calls.",
      },
    ],
  },
  {
    title: "Monitoring and audit",
    summary: "You need a trail of who touched what and when.",
    items: [
      {
        area: "Audit logs",
        requirement: "Record logins, reads, edits, exports, deletes, and admin changes.",
        appStatus: "Need to do",
        action: "Add immutable audit logs with user, action, record, time, and result.",
      },
      {
        area: "Alerting",
        requirement: "Detect repeated failures, unusual exports, and privilege changes.",
        appStatus: "Need to do",
        action: "Add alerts for suspicious access patterns and admin events.",
      },
      {
        area: "Review process",
        requirement: "Someone should review logs and exceptions on a schedule.",
        appStatus: "Need to do",
        action: "Assign a weekly or monthly review and keep evidence of that review.",
      },
      {
        area: "Backup recovery",
        requirement: "You must be able to restore the system and data after loss.",
        appStatus: "Partial",
        action: "Backups exist in practice, but recovery testing and written retention rules still need to be formalized.",
      },
    ],
  },
  {
    title: "Policies and operations",
    summary: "Compliance also lives outside the codebase.",
    items: [
      {
        area: "Risk analysis",
        requirement: "Perform and document a HIPAA security risk analysis.",
        appStatus: "Need to do",
        action: "Inventory data flows, threats, and controls, then track remediation items to closure.",
      },
      {
        area: "Workforce training",
        requirement: "Train staff on HIPAA, phishing, and data handling rules.",
        appStatus: "Need to do",
        action: "Set up onboarding and annual refreshers with proof of completion.",
      },
      {
        area: "Vendor review",
        requirement: "Make sure any third party touching PHI or financial data is covered by the right agreement.",
        appStatus: "Need to do",
        action: "Confirm BAAs for PHI and security obligations for any financial-data service providers.",
      },
      {
        area: "Retention and disposal",
        requirement: "Keep data only as long as needed and dispose of it securely.",
        appStatus: "Partial",
        action: "Define retention windows for uploads, drafts, exports, backups, and logs, then automate cleanup.",
      },
    ],
  },
];

const mileMarkers: Milestone[] = [
  {
    title: "Unique sign-in for every user",
    detail: "No shared accounts; every user action must map back to one person.",
    owner: "App team",
    status: "Done",
  },
  {
    title: "Backend auth endpoint",
    detail: "The app already has a server-side login flow that validates signins and passwords, plus self-service profile updates and admin password resets.",
    owner: "App team",
    status: "Done",
  },
  {
    title: "Role-based access enforced server-side",
    detail: "Sensitive screens and APIs must check permissions before returning data.",
    owner: "App team",
    status: "Partial",
  },
  {
    title: "PHI and financial data removed from browser storage",
    detail: "Sensitive drafts should not live in localStorage or other client-side caches.",
    owner: "App team",
    status: "Done",
  },
  {
    title: "Audit logs for access and changes",
    detail: "View, edit, export, delete, and admin events should be recorded and reviewable.",
    owner: "App team",
    status: "Need to do",
  },
  {
    title: "Export controls and watermarking",
    detail: "Exports should be limited by role and clearly traceable.",
    owner: "App team",
    status: "Need to do",
  },
  {
    title: "Session timeout and re-authentication",
    detail: "Idle sessions should lock and sensitive actions should require fresh authentication. Profile editing still needs the session controls to be defined separately.",
    owner: "App team",
    status: "Need to do",
  },
  {
    title: "Minimum-necessary views",
    detail: "Mask or hide fields unless the current role truly needs full detail.",
    owner: "App team",
    status: "Partial",
  },
  {
    title: "Risk analysis, training, and IT controls",
    detail: "Handled outside the app by IT and compliance, but tracked here for awareness.",
    owner: "Shared",
    status: "Need to do",
  },
];

export default function HipaaScreen() {
  const navigate = useNavigate();

  const totals = useMemo(() => {
    const counts = { done: 0, partial: 0, need: 0 };
    for (const section of sections) {
      for (const item of section.items) {
        if (item.appStatus === "Done") counts.done += 1;
        if (item.appStatus === "Partial") counts.partial += 1;
        if (item.appStatus === "Need to do") counts.need += 1;
      }
    }
    return counts;
  }, []);

  return (
    <AdminShell
      sidebarCopy="A practical HIPAA and financial-data readiness checklist for this internal app."
      sidebarCardLabel="Checklist"
      sidebarCardValue={`${totals.done} done`}
      sidebarCardMeta={`${totals.partial} partial, ${totals.need} remaining.`}
      onBack={() => navigate("/admin")}
      hideBackButton
      useGlobalMenuFallback={false}
      ribbonTitle="HIPAA"
    >
      <section style={styles.page}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>HIPAA readiness</div>
            <p style={adminStyles.subtitle}>
              What HIPAA and financial-data controls require, what this app already covers, and what still needs work.
            </p>
            <div style={styles.heroActions}>
              <button type="button" style={adminStyles.primaryButton} onClick={() => navigate("/admin/users")}>
                Review users
              </button>
              <button type="button" style={adminStyles.secondaryButton} onClick={() => navigate("/admin/config")}>
                Review config
              </button>
              <button type="button" style={adminStyles.secondaryButton} onClick={() => navigate("/admin/security")}>
                Open Security
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Internal app</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Compliance snapshot</div>
              <div style={adminStyles.heroStatusText}>
                This screen is a working checklist, not a legal opinion. It helps us track the controls we can implement
                in software versus the policies and agreements that must happen outside the app.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Done</div>
            <div style={styles.summaryValue}>{totals.done}</div>
            <div style={styles.summaryMeta}>Controls already visible in the app or backend.</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Partial</div>
            <div style={styles.summaryValue}>{totals.partial}</div>
            <div style={styles.summaryMeta}>Controls started, but not yet complete enough for HIPAA use.</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Need to do</div>
            <div style={styles.summaryValue}>{totals.need}</div>
            <div style={styles.summaryMeta}>Required items still missing from code or operations.</div>
          </div>
        </section>

        <section style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>App team mile markers</div>
              <h2 style={adminStyles.sectionTitle}>Software-side checkpoints we can own</h2>
            </div>
            <div style={adminStyles.sectionMeta}>8 milestones</div>
          </div>

          <div style={styles.milestoneList}>
            {mileMarkers.map((marker) => (
              <article key={marker.title} style={styles.milestoneCard}>
                <div style={styles.checkTopRow}>
                  <div>
                    <div style={styles.checkArea}>{marker.title}</div>
                    <div style={styles.checkRequirement}>{marker.detail}</div>
                  </div>
                  <div style={styles.milestoneMetaWrap}>
                    <span style={styles.ownerPill}>{marker.owner}</span>
                    <span style={{ ...styles.badge, ...badgeStyles[marker.status] }}>{marker.status}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {sections.map((section) => (
          <section key={section.title} style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={adminStyles.sectionKicker}>{section.title}</div>
                <h2 style={adminStyles.sectionTitle}>{section.summary}</h2>
              </div>
              <div style={adminStyles.sectionMeta}>{section.items.length} checks</div>
            </div>

            <div style={styles.checkList}>
              {section.items.map((item) => (
                <article key={`${section.title}:${item.area}`} style={styles.checkCard}>
                  <div style={styles.checkTopRow}>
                    <div>
                      <div style={styles.checkArea}>{item.area}</div>
                      <div style={styles.checkRequirement}>{item.requirement}</div>
                    </div>
                    <span style={{ ...styles.badge, ...badgeStyles[item.appStatus] }}>{item.appStatus}</span>
                  </div>
                  <div style={styles.checkAction}>{item.action}</div>
                </article>
              ))}
            </div>
          </section>
        ))}

        <section style={styles.actionPlan}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Suggested order</div>
              <h2 style={adminStyles.sectionTitle}>What to do first</h2>
            </div>
          </div>
          <ol style={styles.planList}>
            <li>Put route-level authorization on every screen that can read or change PHI or financial data.</li>
            <li>Remove sensitive draft data from browser storage and move it to controlled server-side storage.</li>
            <li>Add audit logging for access, edits, exports, deletes, and admin changes.</li>
            <li>Turn on MFA, session timeout, encryption, and backup recovery testing.</li>
            <li>Finish the written HIPAA risk analysis, retention policy, training, and vendor review.</li>
          </ol>
        </section>

        <section style={styles.actionPlan}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Auth impact</div>
              <h2 style={adminStyles.sectionTitle}>What the auth boundary changes</h2>
            </div>
            <div style={adminStyles.sectionMeta}>{authImpactSteps.length} steps to employ</div>
          </div>
          <p style={styles.calloutText}>
            Backend auth is already in place, so the plan is now about documenting it, hardening the surrounding
            controls, and deciding whether we want to split it into a separate boundary later. That lowers the work a
            bit, but it does not replace parameterized SQL, session controls, or audit logging.
          </p>
          <ul style={styles.planList}>
            {authImpactSteps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <button type="button" style={adminStyles.secondaryButton} onClick={() => navigate("/admin/security")}>
            View Security record
          </button>
        </section>

        <section style={styles.actionPlan}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Impact</div>
              <h2 style={adminStyles.sectionTitle}>What changed because of the app work</h2>
            </div>
          </div>
          <div style={styles.impactList}>
            {impactItems.map((item) => (
              <article key={item.title} style={styles.impactCard}>
                <div style={styles.impactTitle}>{item.title}</div>
                <div style={styles.impactDetail}>{item.detail}</div>
              </article>
            ))}
          </div>
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
  sectionCard: {
    display: "grid",
    gap: "14px",
    padding: "18px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  checkList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "12px",
  },
  milestoneList: {
    display: "grid",
    gap: "12px",
  },
  milestoneCard: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(145deg, rgba(250,252,255,1) 0%, rgba(241,246,252,0.96) 100%)",
    display: "grid",
    gap: "10px",
  },
  checkCard: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(145deg, rgba(251,252,254,1) 0%, rgba(241,246,252,0.96) 100%)",
    display: "grid",
    gap: "10px",
  },
  checkTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
  },
  checkArea: {
    fontSize: "14px",
    fontWeight: 900,
    color: "#17324f",
  },
  checkRequirement: {
    marginTop: "4px",
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#536579",
  },
  checkAction: {
    fontSize: "12px",
    lineHeight: 1.55,
    color: "#405266",
  },
  milestoneMetaWrap: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  ownerPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "82px",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    background: "rgba(224, 237, 250, 0.95)",
    color: "#35506d",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    whiteSpace: "nowrap",
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
  actionPlan: {
    display: "grid",
    gap: "12px",
    padding: "18px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
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
  impactList: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  impactCard: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.9)",
    display: "grid",
    gap: "6px",
  },
  impactTitle: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#17314f",
  },
  impactDetail: {
    fontSize: "13px",
    lineHeight: 1.5,
    color: "#5d7187",
  },
  calloutText: {
    margin: 0,
    color: "#405266",
    fontSize: "13px",
    lineHeight: 1.6,
    fontWeight: 600,
  },
};

const badgeStyles: Record<CheckState, CSSProperties> = {
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
