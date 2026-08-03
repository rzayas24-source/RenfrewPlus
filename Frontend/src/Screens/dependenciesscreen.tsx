import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from "./adminscreen";

type Status = "Ready" | "Partial" | "Needed";

type DependencyItem = {
  name: string;
  whyItIsNeeded: string;
  owner: "App team" | "IT";
  status: Status;
};

type DependencyGroup = {
  title: string;
  summary: string;
  items: DependencyItem[];
};

const dependencyGroups: DependencyGroup[] = [
  {
    title: "Server runtime",
    summary: "The backend runs as a Python service and needs the right runtime around it.",
    items: [
      {
        name: "Python 3 runtime",
        whyItIsNeeded: "Runs the backend API, scheduled helpers, and server-side workflow scripts.",
        owner: "IT",
        status: "Needed",
      },
      {
        name: "FastAPI application server",
        whyItIsNeeded: "Hosts the API endpoints the frontend calls for review, saving, and file actions.",
        owner: "IT",
        status: "Needed",
      },
      {
        name: "ASGI runner such as Uvicorn",
        whyItIsNeeded: "Provides the process that actually serves the FastAPI app in production.",
        owner: "IT",
        status: "Needed",
      },
      {
        name: "SQLite support",
        whyItIsNeeded: "The app currently stores workflow data in the SQLite database file configured in `config.json`.",
        owner: "IT",
        status: "Ready",
      },
    ],
  },
  {
    title: "Python packages",
    summary: "These are the external libraries the backend code imports today.",
    items: [
      {
        name: "fastapi",
        whyItIsNeeded: "Routes, request parsing, and file upload endpoints depend on it.",
        owner: "App team",
        status: "Ready",
      },
      {
        name: "pandas",
        whyItIsNeeded: "Used by the backend for tabular data handling and exports.",
        owner: "App team",
        status: "Ready",
      },
      {
        name: "openpyxl",
        whyItIsNeeded: "Reads and writes Excel workbooks used by itemization and Fly Wire flows.",
        owner: "App team",
        status: "Ready",
      },
      {
        name: "Pillow",
        whyItIsNeeded: "Generates and processes snapshot images for review screens.",
        owner: "App team",
        status: "Ready",
      },
      {
        name: "xlrd",
        whyItIsNeeded: "Reads legacy Excel files used by snapshot and import workflows.",
        owner: "App team",
        status: "Ready",
      },
      {
        name: "python-multipart",
        whyItIsNeeded: "Allows FastAPI file-upload endpoints to receive uploaded workbooks.",
        owner: "App team",
        status: "Partial",
      },
      {
        name: "pdf2image",
        whyItIsNeeded: "Renders PDFs into images when the snapshot generator needs a PDF preview.",
        owner: "App team",
        status: "Partial",
      },
      {
        name: "pywin32",
        whyItIsNeeded: "Supports Outlook COM automation for the email downloader on Windows machines.",
        owner: "IT",
        status: "Partial",
      },
    ],
  },
  {
    title: "Filesystem and data",
    summary: "The server must have these paths and data files available.",
    items: [
      {
        name: "config.json",
        whyItIsNeeded: "Holds workflow_root, database path, and folder locations the backend resolves at startup.",
        owner: "App team",
        status: "Ready",
      },
      {
        name: "database.db",
        whyItIsNeeded: "Stores imported files, review state, users, and saved workflow records.",
        owner: "IT",
        status: "Ready",
      },
      {
        name: "1.TRN / 2.ERA / 3.HTML",
        whyItIsNeeded: "Inbound and processed file folders for the EFT, ERA, and HTML workflows.",
        owner: "IT",
        status: "Partial",
      },
      {
        name: "4.Emails",
        whyItIsNeeded: "Email downloader output folder used for downloaded attachments and message text.",
        owner: "IT",
        status: "Partial",
      },
      {
        name: "Import_Flywire",
        whyItIsNeeded: "Storage root for Fly Wire uploads and processing.",
        owner: "IT",
        status: "Partial",
      },
      {
        name: "snapshots",
        whyItIsNeeded: "Holds rendered attachment snapshots for the queue and review screens.",
        owner: "IT",
        status: "Partial",
      },
      {
        name: "EDI_Pending",
        whyItIsNeeded: "Holds pending EDI work and related staging files.",
        owner: "IT",
        status: "Partial",
      },
    ],
  },
  {
    title: "External systems",
    summary: "These are the outside services or host features the app expects.",
    items: [
      {
        name: "Outlook desktop / MAPI access",
        whyItIsNeeded: "The email downloader can connect to Outlook folders when it is available on the host.",
        owner: "IT",
        status: "Partial",
      },
      {
        name: "Poppler binaries",
        whyItIsNeeded: "Required for PDF snapshot rendering when the snapshot generator processes PDFs.",
        owner: "IT",
        status: "Partial",
      },
      {
        name: "Network access to the backend API",
        whyItIsNeeded: "The frontend talks to the backend through the configured API base URL.",
        owner: "IT",
        status: "Ready",
      },
      {
        name: "File-share permissions",
        whyItIsNeeded: "The host must be able to read and write the configured workflow folders.",
        owner: "IT",
        status: "Needed",
      },
    ],
  },
];

const deploymentNotes = [
  "Keep config-driven paths external so the server can move without code changes.",
  "Install the Python packages used by the backend and helper scripts.",
  "Provision the workflow folders and database file on the server.",
  "Confirm host-specific tools such as Outlook and Poppler before go-live.",
];

const impactItems = [
  {
    title: "This page is the server checklist",
    detail: "It shows what the app needs in place before the backend can run cleanly on a server.",
  },
  {
    title: "App-owned vs IT-owned is explicit",
    detail: "The app team can keep the code portable, but IT still owns the machine, folders, packages, and external tools.",
  },
  {
    title: "Good for handoff",
    detail: "This gives you a practical list to review with infrastructure before any server cutover.",
  },
];

export default function DependenciesScreen() {
  const navigate = useNavigate();

  const totals = useMemo(() => {
    const counts = { ready: 0, partial: 0, needed: 0 };
    for (const group of dependencyGroups) {
      for (const item of group.items) {
        if (item.status === "Ready") counts.ready += 1;
        if (item.status === "Partial") counts.partial += 1;
        if (item.status === "Needed") counts.needed += 1;
      }
    }
    return counts;
  }, []);

  return (
    <AdminShell
      sidebarCopy="A server dependency checklist for the app, the backend runtime, and the infrastructure that has to exist around them."
      sidebarCardLabel="Dependencies"
      sidebarCardValue={`${totals.ready} ready`}
      sidebarCardMeta={`${totals.partial} partial, ${totals.needed} needed.`}
      onBack={() => navigate("/admin")}
      hideBackButton
      useGlobalMenuFallback={false}
      ribbonTitle="Dependencies"
    >
      <section style={styles.page}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Server dependencies</div>
            <p style={adminStyles.subtitle}>
              This page lists the code, packages, data paths, and host capabilities that must exist before the app can
              run on a server.
            </p>
            <div style={styles.heroActions}>
              <button type="button" style={adminStyles.primaryButton} onClick={() => navigate("/admin/portability")}>
                Open Portability
              </button>
              <button type="button" style={adminStyles.secondaryButton} onClick={() => navigate("/admin/hipaa")}>
                Open HIPAA
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Server ready</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>What the server must have</div>
              <div style={adminStyles.heroStatusText}>
                The app is portable only if the server has the right runtime, the expected folders, and the host-side
                tools that the workflow scripts rely on.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Ready</div>
            <div style={styles.summaryValue}>{totals.ready}</div>
            <div style={styles.summaryMeta}>Dependencies the code already expects and can use as-is.</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Partial</div>
            <div style={styles.summaryValue}>{totals.partial}</div>
            <div style={styles.summaryMeta}>Items that may work now, but still need host validation or setup.</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Needed</div>
            <div style={styles.summaryValue}>{totals.needed}</div>
            <div style={styles.summaryMeta}>Required items still missing from the server plan.</div>
          </div>
        </section>

        {dependencyGroups.map((group) => (
          <section key={group.title} style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <div style={adminStyles.sectionKicker}>{group.title}</div>
                <h2 style={adminStyles.sectionTitle}>{group.summary}</h2>
              </div>
              <div style={adminStyles.sectionMeta}>{group.items.length} items</div>
            </div>

            <div style={styles.itemList}>
              {group.items.map((item) => (
                <article key={`${group.title}:${item.name}`} style={styles.itemCard}>
                  <div style={styles.itemTopRow}>
                    <div>
                      <div style={styles.itemTitle}>{item.name}</div>
                      <div style={styles.itemDetail}>{item.whyItIsNeeded}</div>
                    </div>
                    <div style={styles.itemMetaWrap}>
                      <span style={styles.ownerPill}>{item.owner}</span>
                      <span style={{ ...styles.badge, ...statusStyles[item.status] }}>{item.status}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Deployment notes</div>
              <h2 style={adminStyles.sectionTitle}>What to verify before running on a server</h2>
            </div>
          </div>

          <ol style={styles.planList}>
            {deploymentNotes.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Impact</div>
              <h2 style={adminStyles.sectionTitle}>Why this list matters</h2>
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
  itemMetaWrap: {
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
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
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
    color: "#17324f",
  },
  impactDetail: {
    fontSize: "13px",
    lineHeight: 1.5,
    color: "#5d7187",
  },
};

const statusStyles: Record<Status, CSSProperties> = {
  Ready: {
    background: "rgba(224, 245, 230, 0.95)",
    color: "#24623e",
    borderColor: "rgba(59, 156, 99, 0.22)",
  },
  Partial: {
    background: "rgba(255, 245, 219, 0.95)",
    color: "#8a5b07",
    borderColor: "rgba(205, 153, 35, 0.22)",
  },
  Needed: {
    background: "rgba(255, 230, 230, 0.96)",
    color: "#a32121",
    borderColor: "rgba(179, 58, 58, 0.22)",
  },
};
