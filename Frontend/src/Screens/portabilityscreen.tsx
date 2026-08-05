import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from "./adminscreen";

type Status = "Done" | "Partial" | "Need to do";

type PortabilityItem = {
  area: string;
  whatItMeans: string;
  status: Status;
  nextStep: string;
};

type MigrationPhase = {
  title: string;
  objective: string;
  items: string[];
  doneWhen: string;
};

const portabilityItems: PortabilityItem[] = [
  {
    area: "Config-driven paths",
    whatItMeans: "Workflow folders are already driven by `Script/config.json` instead of being hardcoded everywhere.",
    status: "Done",
    nextStep: "Keep using config as the source of truth for any future host change.",
  },
  {
    area: "Backend API",
    whatItMeans: "The backend already runs as a FastAPI service and can be started on another machine.",
    status: "Done",
    nextStep: "Keep the API separate from the frontend so it can move cleanly later.",
  },
  {
    area: "Frontend build",
    whatItMeans: "The frontend builds cleanly and is separate from the backend runtime.",
    status: "Done",
    nextStep: "Keep the frontend build independent from the backend runtime.",
  },
  {
    area: "Build and startup",
    whatItMeans: "The build and backend startup paths now have portable Python entrypoints, with PowerShell and bash wrappers kept as convenience layers.",
    status: "Done",
    nextStep: "Keep the Python launchers as the canonical path and treat shell wrappers as optional helpers.",
  },
  {
    area: "Browser drafts",
    whatItMeans: "Workflow drafts now persist through the backend instead of relying on browser `localStorage`.",
    status: "Done",
    nextStep: "Keep sensitive workflow state server-backed so the app stays portable.",
  },
  {
    area: "Database location",
    whatItMeans: "The app already uses a local SQLite database file, but server migration needs an intentional storage plan.",
    status: "Partial",
    nextStep: "Keep the database path configurable and document the future server location.",
  },
  {
    area: "File shares and attachments",
    whatItMeans: "Folders for emails, EDI, HTML, snapshots, and imports need mapped server storage.",
    status: "Partial",
    nextStep: "Keep each folder path externally configurable so it can move later.",
  },
  {
    area: "Auth and roles",
    whatItMeans: "Backend auth now includes profile updates, password resets, and sign-off, but server rollout still needs session, access, and logging policies around it.",
    status: "Partial",
    nextStep: "Keep auth isolated enough that later hosting changes do not break login, profile, or sign-off flows.",
  },
  {
    area: "Monitoring and backup",
    whatItMeans: "Logging and backup are mostly an IT concern, but the app should still document expectations now.",
    status: "Partial",
    nextStep: "Document the logging and backup assumptions the app depends on.",
  },
];

const migrationPhases: MigrationPhase[] = [
  {
    title: "Phase 1: Baseline the laptop",
    objective: "Make the current work laptop reproducible before we move anything.",
    items: [
      "Capture the current config in `Script/config.json`.",
      "Verify the canonical launch paths still work.",
      "Record the current database and storage locations.",
      "Confirm the laptop has a usable backup before changes.",
    ],
    doneWhen: "You can rebuild and relaunch without guessing at paths or state.",
  },
  {
    title: "Phase 2: Make storage server-ready",
    objective: "Move every machine-specific folder into config or environment.",
    items: [
      "Keep the database location fully configurable.",
      "Keep emails, snapshots, imports, and EDI folders externally configurable.",
      "Decide which folders become server-mounted shares versus local disk.",
      "Verify paths resolve from config instead of code.",
    ],
    doneWhen: "The app can point at a new machine without code edits.",
  },
  {
    title: "Phase 3: Harden auth and sessions",
    objective: "Make login and access control survive a server move.",
    items: [
      "Review the login and role flow in the backend.",
      "Keep the profile and password-reset flow aligned with the current auth record.",
      "Define idle timeout and session behavior.",
      "Confirm audit logging expectations for sign-in and role changes.",
      "Keep the security boundary independent of the laptop trust model.",
    ],
    doneWhen: "Auth still behaves correctly after the app is hosted elsewhere.",
  },
  {
    title: "Phase 4: Separate portable core from Windows-only pieces",
    objective: "Keep the app usable even when Windows-only helpers are absent.",
    items: [
      "Keep Outlook COM automation explicitly marked as Windows-only.",
      "Treat bundled Poppler as a convenience, not a hidden requirement.",
      "Add capability checks for optional tooling.",
      "Make the portable core work without the laptop-specific helpers.",
    ],
    doneWhen: "The portable path is clear and the exceptions are explicit.",
  },
  {
    title: "Phase 5: Pilot and cut over",
    objective: "Validate the server with real workflows before switching users.",
    items: [
      "Stand up a test server with the same config structure.",
      "Point the app at server storage and the server database.",
      "Run login, attachments, snapshots, worklists, and imports end to end.",
      "Test backup and restore before cutover, then switch daily use.",
    ],
    doneWhen: "The server can run the app without depending on the laptop.",
  },
];

const impactItems = [
  {
    title: "Browser drafts are no longer a portability blocker",
    detail: "Keyproof and itemization now rely on persisted backend state, which makes the app easier to move later.",
  },
  {
    title: "Build and startup are portable",
    detail: "The backend and build now have Python entrypoints, so PowerShell and bash wrappers are convenience layers instead of required launch paths.",
  },
  {
    title: "Windows-only pieces are explicit",
    detail: "Outlook COM and bundled Windows Poppler are isolated and documented, so they do not hide the rest of the app's portable path.",
  },
];

const quickWins = [
  "Keep all folder paths in `Script/config.json`.",
  "Use `python build.py` and `python Start-WorkflowBackend.py` as the canonical entrypoints.",
  "Keep PowerShell and bash wrappers as convenience layers only.",
  "Use explicit `en-US` formatting when the UI expects US dates and currency.",
  "Keep browser-held workflow state out of `localStorage` when it matters beyond one machine.",
];

const mediumFixes = [
  "Push more storage targets into config, especially the database and file shares.",
  "Keep the backend and frontend separately deployable.",
  "Add capability checks for optional tooling like Poppler instead of assuming it is always present.",
  "Keep auth, role checks, and audit logging server-side so they move with the app.",
  "Add multi-OS build verification when practical.",
];

const windowsOnlyExceptions = [
  "Outlook COM automation in `Script/site_emaildownloader.py`.",
  "Bundled Windows Poppler for PDF rendering on Windows machines.",
  "PowerShell helper scripts for Windows operators.",
];

export default function PortabilityScreen() {
  const navigate = useNavigate();

  const score = useMemo(() => {
    const totals = { done: 0, partial: 0, need: 0 };
    for (const item of portabilityItems) {
      if (item.status === "Done") totals.done += 1;
      if (item.status === "Partial") totals.partial += 1;
      if (item.status === "Need to do") totals.need += 1;
    }

    const rawScore = ((totals.done * 100) + (totals.partial * 50)) / portabilityItems.length;
    return {
      done: totals.done,
      partial: totals.partial,
      need: totals.need,
      percent: Math.round(rawScore),
    };
  }, []);

  const scoreLabel = score.percent >= 80 ? "Strong" : score.percent >= 60 ? "Moderate" : "Needs work";

  return (
    <AdminShell
      sidebarCopy="A phased laptop-to-server plan for keeping the app portable without breaking the current work machine."
      sidebarCardLabel="Portability"
      sidebarCardValue={`${score.percent}%`}
      sidebarCardMeta={`${score.done} done, ${score.partial} partial, ${score.need} remaining.`}
      onBack={() => navigate("/admin")}
      hideBackButton
      useGlobalMenuFallback={false}
      ribbonTitle="Portability"
    >
      <section style={styles.page}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Portability plan</div>
            <p style={adminStyles.subtitle}>
              What is already portable, what still needs to be cleaned up in dev, and how to move from the work laptop
              to a server in phases.
            </p>
            <div style={styles.heroActions}>
              <button type="button" style={adminStyles.primaryButton} onClick={() => navigate("/admin/security")}>
                Open Security
              </button>
              <button type="button" style={adminStyles.secondaryButton} onClick={() => navigate("/admin/hipaa")}>
                Open HIPAA
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Server move</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Readiness score</div>
              <div style={adminStyles.heroStatusText}>
                {score.percent}% ready now. The app is portable in shape, and the biggest browser-state issue is now
                handled in code. Storage, backup, and session hardening still need IT-side planning before a real
                server cutover from the work laptop.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Score</div>
            <div style={styles.summaryValue}>{score.percent}%</div>
            <div style={styles.summaryMeta}>{scoreLabel} portability readiness.</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Done</div>
            <div style={styles.summaryValue}>{score.done}</div>
            <div style={styles.summaryMeta}>Already portable or already decoupled enough to migrate.</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Remaining</div>
            <div style={styles.summaryValue}>{score.partial + score.need}</div>
            <div style={styles.summaryMeta}>Items that still need server planning or code changes.</div>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>What is already done</div>
              <h2 style={adminStyles.sectionTitle}>Built to stay portable</h2>
            </div>
            <div style={adminStyles.sectionMeta}>Dev-ready foundations</div>
          </div>

          <div style={styles.itemList}>
            {portabilityItems.filter((item) => item.status === "Done").map((item) => (
              <article key={item.area} style={styles.itemCard}>
                <div style={styles.itemTopRow}>
                  <div>
                    <div style={styles.itemTitle}>{item.area}</div>
                    <div style={styles.itemDetail}>{item.whatItMeans}</div>
                  </div>
                  <span style={{ ...styles.badge, ...statusStyles[item.status] }}>{item.status}</span>
                </div>
                <div style={styles.nextStep}><strong>Next:</strong> {item.nextStep}</div>
              </article>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Needs work</div>
              <h2 style={adminStyles.sectionTitle}>What still needs to be cleaned up in dev</h2>
            </div>
            <div style={adminStyles.sectionMeta}>Dev blockers</div>
          </div>

          <div style={styles.itemList}>
            {portabilityItems.filter((item) => item.status !== "Done").map((item) => (
              <article key={item.area} style={styles.itemCard}>
                <div style={styles.itemTopRow}>
                  <div>
                    <div style={styles.itemTitle}>{item.area}</div>
                    <div style={styles.itemDetail}>{item.whatItMeans}</div>
                  </div>
                  <span style={{ ...styles.badge, ...statusStyles[item.status] }}>{item.status}</span>
                </div>
                <div style={styles.nextStep}><strong>Next:</strong> {item.nextStep}</div>
              </article>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Portability plan</div>
              <h2 style={adminStyles.sectionTitle}>Migration phases from laptop to server</h2>
            </div>
            <div style={adminStyles.sectionMeta}>{migrationPhases.length} phases</div>
          </div>

          <div style={styles.phaseGrid}>
            {migrationPhases.map((phase) => (
              <article key={phase.title} style={styles.phaseCard}>
                <div style={styles.phaseTitle}>{phase.title}</div>
                <div style={styles.phaseObjective}>{phase.objective}</div>
                <ul style={styles.phaseList}>
                  {phase.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div style={styles.phaseDoneWhen}>
                  <strong>Done when:</strong> {phase.doneWhen}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Impact</div>
              <h2 style={adminStyles.sectionTitle}>What the recent app changes improved</h2>
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

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Portability playbook</div>
              <h2 style={adminStyles.sectionTitle}>What to do next</h2>
            </div>
            <div style={adminStyles.sectionMeta}>Repo guidance</div>
          </div>

          <div style={styles.playbookGrid}>
            <article style={styles.playbookCard}>
              <div style={styles.playbookTitle}>Quick wins</div>
              <ul style={styles.playbookList}>
                {quickWins.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article style={styles.playbookCard}>
              <div style={styles.playbookTitle}>Medium fixes</div>
              <ul style={styles.playbookList}>
                {mediumFixes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article style={styles.playbookCard}>
              <div style={styles.playbookTitle}>Windows-only exceptions</div>
              <ul style={styles.playbookList}>
                {windowsOnlyExceptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Final score</div>
              <h2 style={adminStyles.sectionTitle}>Portability score</h2>
            </div>
          </div>
          <p style={styles.calloutText}>
            {score.percent}% ready. The app is directionally portable already, and the latest work made startup,
            profile, and sign-off paths more portable too. It still needs dev-stage cleanup around server storage
            mapping, backup planning, and auth/session policy before it should be considered ready for a real server
            move off the work laptop.
          </p>
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
  itemList: {
    display: "grid",
    gap: "12px",
  },
  phaseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
  },
  phaseCard: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(145deg, rgba(251,252,254,1) 0%, rgba(241,246,252,0.96) 100%)",
    display: "grid",
    gap: "10px",
  },
  phaseTitle: {
    fontSize: "14px",
    fontWeight: 900,
    color: "#17324f",
  },
  phaseObjective: {
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#536579",
  },
  phaseList: {
    margin: 0,
    paddingLeft: "18px",
    display: "grid",
    gap: "8px",
    color: "#4c6074",
    lineHeight: 1.5,
    fontSize: "13px",
  },
  phaseDoneWhen: {
    fontSize: "12px",
    lineHeight: 1.55,
    color: "#405266",
  },
  itemCard: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(145deg, rgba(251,252,254,1) 0%, rgba(241,246,252,0.96) 100%)",
    display: "grid",
    gap: "10px",
  },
  itemTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
  },
  itemTitle: {
    fontSize: "14px",
    fontWeight: 900,
    color: "#17324f",
  },
  itemDetail: {
    marginTop: "4px",
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#536579",
  },
  nextStep: {
    fontSize: "12px",
    lineHeight: 1.55,
    color: "#405266",
  },
  impactList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  playbookGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  playbookCard: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(145deg, rgba(251,252,254,1) 0%, rgba(241,246,252,0.96) 100%)",
    display: "grid",
    gap: "10px",
  },
  playbookTitle: {
    fontSize: "14px",
    fontWeight: 900,
    color: "#17324f",
  },
  playbookList: {
    margin: 0,
    paddingLeft: "18px",
    display: "grid",
    gap: "8px",
    color: "#4c6074",
    lineHeight: 1.5,
    fontSize: "13px",
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
  calloutText: {
    margin: 0,
    color: "#405266",
    fontSize: "13px",
    lineHeight: 1.6,
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
