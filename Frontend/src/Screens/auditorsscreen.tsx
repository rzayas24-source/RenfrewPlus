import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ALL_MENU_OPTIONS } from "../navigation/menuConfig";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from "./adminscreen";

type SheetKey = "screens" | "scripts" | "paths" | "elements" | "relationships";

type SheetButton = {
  key: SheetKey;
  label: string;
  meta: string;
};

type AuditItem = {
  name: string;
  detail: string;
  owner: "App team" | "IT" | "Shared";
  impact: string;
};

type RelationshipItem = {
  source: string;
  target: string;
  effect: string;
  owner: "App team" | "IT" | "Shared";
};

type SheetLink = {
  label: string;
  path: string;
};

type SelectedItem = {
  sheet: SheetKey;
  name: string;
};

const sheetButtons: SheetButton[] = [
  { key: "screens", label: "Screens", meta: "All routes and admin views" },
  { key: "scripts", label: "Scripts", meta: "Python files and helpers" },
  { key: "paths", label: "Paths", meta: "Config and storage locations" },
  { key: "elements", label: "Elements", meta: "Core components and workflow parts" },
  { key: "relationships", label: "Relationships", meta: "How the items affect each other" },
];

const scriptItems: AuditItem[] = [
  {
    name: "Script/api.py",
    detail: "Primary FastAPI application and server-side workflow entrypoint.",
    owner: "App team",
    impact: "Controls most API routes, persistence, file operations, and admin data.",
  },
  {
    name: "Script/config_manager.py",
    detail: "Loads and merges workflow config values and resolves paths.",
    owner: "App team",
    impact: "Sets the server root, database file, and storage folders used at runtime.",
  },
  {
    name: "Script/db.py",
    detail: "Shared SQLite connection helper used by backend scripts.",
    owner: "App team",
    impact: "Centralizes database access for helper jobs and background utilities.",
  },
  {
    name: "Script/system_calendar_core.py",
    detail: "Calendar and workday state helpers used by review flows.",
    owner: "App team",
    impact: "Feeds date-aware navigation, queue filtering, and batch planning.",
  },
  {
    name: "Script/system_banking_core.py",
    detail: "Banking spreadsheet and reconciliation helpers.",
    owner: "App team",
    impact: "Supports balsheet, balance, and matching workflows.",
  },
  {
    name: "Script/system_source_match_core.py",
    detail: "Match and reconciliation logic for source records.",
    owner: "App team",
    impact: "Backs matching dashboards and source-level review actions.",
  },
  {
    name: "Script/source_table_schema.py",
    detail: "Ensures source table structures and mirror tables are created.",
    owner: "App team",
    impact: "Keeps imported source data aligned with the backend schema.",
  },
  {
    name: "Script/site_emaildownloader.py",
    detail: "Outlook email intake and attachment download helper.",
    owner: "IT",
    impact: "Depends on Outlook access and writes inbound files to the workflow folders.",
  },
  {
    name: "Script/site_snapshotgenerator.py",
    detail: "Generates review snapshots for attachments and files.",
    owner: "App team",
    impact: "Depends on image libraries, Poppler for PDFs, and the snapshots folder.",
  },
  {
    name: "Script/utility_checknumber-search.pyw",
    detail: "Supporting utility for check-number lookup and search.",
    owner: "App team",
    impact: "Helps users trace matching and review data across the workflow.",
  },
];

const pathItems: AuditItem[] = [
  {
    name: "Script/config.json",
    detail: "Source of truth for workflow_root, database path, and storage folders.",
    owner: "App team",
    impact: "Controls where the backend reads and writes when deployed on a server.",
  },
  {
    name: "database.db",
    detail: "Primary SQLite database for imported files, saved states, and users.",
    owner: "IT",
    impact: "Must exist and remain writable on the server host.",
  },
  {
    name: "1.TRN / 2.ERA / 3.HTML",
    detail: "Workflow folders for transfer files and processed outputs.",
    owner: "IT",
    impact: "Used by the EFT, ERA, and HTML flows when files are loaded and renamed.",
  },
  {
    name: "4.Emails",
    detail: "Email downloader output folder for attachments and message body text.",
    owner: "IT",
    impact: "Populated by Outlook intake and consumed by review screens.",
  },
  {
    name: "Import_Flywire",
    detail: "Fly Wire upload and processing root.",
    owner: "IT",
    impact: "Used when importing and storing workbook artifacts.",
  },
  {
    name: "snapshots",
    detail: "Rendered image storage for attachment previews.",
    owner: "IT",
    impact: "Used by review queues and the snapshot generator.",
  },
  {
    name: "EDI_Pending",
    detail: "Staging folder for EDI-related pending work.",
    owner: "IT",
    impact: "Supports pending EDI review and staging workflows.",
  },
  {
    name: "Poppler bin path",
    detail: "Binary path needed for PDF-to-image rendering.",
    owner: "IT",
    impact: "Allows PDF snapshots to be created when available on the host.",
  },
];

const elementItems: AuditItem[] = [
  {
    name: "AdminShell",
    detail: "Shared admin shell layout and navigation container.",
    owner: "App team",
    impact: "Keeps the admin modules visually consistent and easy to extend.",
  },
  {
    name: "FastAPI endpoints",
    detail: "Backend routes that handle workflow reads, writes, and uploads.",
    owner: "App team",
    impact: "Connects the frontend to saved state and server-side processing.",
  },
  {
    name: "SQLite tables",
    detail: "Tables that store imported rows, saved states, user data, and review records.",
    owner: "Shared",
    impact: "Tie the workflow screens to persistent data that can be moved later.",
  },
  {
    name: "Attachment snapshots",
    detail: "Preview images for the queue and review screens.",
    owner: "App team",
    impact: "Let reviewers see files without leaving the workflow shell.",
  },
  {
    name: "Keyproof and itemization",
    detail: "The review steps that collect cash, check, credit card, EFT, and item rows.",
    owner: "App team",
    impact: "Drive the reconciliation and balance-check flow.",
  },
  {
    name: "Authentication layer",
    detail: "Backend auth and password handling that support login and role checks.",
    owner: "App team",
    impact: "Controls who can reach sensitive admin and workflow data.",
  },
];

const relationshipItems: RelationshipItem[] = [
  {
    source: "Config file",
    target: "Paths and scripts",
    effect: "Moves the app between hosts without hardcoding locations.",
    owner: "App team",
  },
  {
    source: "Backend API",
    target: "Screens",
    effect: "Feeds saved state, uploads, and review actions to the UI.",
    owner: "App team",
  },
  {
    source: "Database file",
    target: "Keyproof / itemization / schema",
    effect: "Persists workflow state so the app can reload data after navigation or restart.",
    owner: "Shared",
  },
  {
    source: "Email downloader",
    target: "Snapshots and attachments",
    effect: "Creates the inbound review set the queue screens work from.",
    owner: "IT",
  },
  {
    source: "Snapshot generator",
    target: "Attachment review screens",
    effect: "Produces the images that make review possible inside the app.",
    owner: "App team",
  },
  {
    source: "Auth boundary",
    target: "HIPAA and security controls",
    effect: "Defines who can see or change PHI-adjacent and financial data.",
    owner: "App team",
  },
  {
    source: "Dependencies",
    target: "Server deployment",
    effect: "Lists the runtime and host capabilities that must be present before go-live.",
    owner: "IT",
  },
];

const relationshipSheetItems: AuditItem[] = relationshipItems.map((item) => ({
  name: `${item.source} -> ${item.target}`,
  detail: item.effect,
  owner: item.owner,
  impact: item.effect,
}));

const selectedItemLinks: Record<string, SelectedItem[]> = {
  Admin: [
    { sheet: "scripts", name: "Script/api.py" },
    { sheet: "elements", name: "AdminShell" },
    { sheet: "relationships", name: "Backend API -> Screens" },
  ],
  Config: [
    { sheet: "paths", name: "Script/config.json" },
    { sheet: "scripts", name: "Script/config_manager.py" },
    { sheet: "relationships", name: "Config file -> Paths and scripts" },
  ],
  HIPAA: [
    { sheet: "elements", name: "Authentication layer" },
    { sheet: "scripts", name: "Script/api.py" },
    { sheet: "relationships", name: "Auth boundary -> HIPAA and security controls" },
  ],
  Security: [
    { sheet: "elements", name: "Authentication layer" },
    { sheet: "scripts", name: "Script/api.py" },
    { sheet: "relationships", name: "Auth boundary -> HIPAA and security controls" },
  ],
  Portability: [
    { sheet: "paths", name: "Script/config.json" },
    { sheet: "scripts", name: "Script/config_manager.py" },
    { sheet: "relationships", name: "Dependencies -> Server deployment" },
  ],
  Dependencies: [
    { sheet: "paths", name: "Script/config.json" },
    { sheet: "scripts", name: "Script/config_manager.py" },
    { sheet: "relationships", name: "Dependencies -> Server deployment" },
  ],
  Schema: [
    { sheet: "elements", name: "SQLite tables" },
    { sheet: "paths", name: "database.db" },
    { sheet: "scripts", name: "Script/source_table_schema.py" },
  ],
  Auditors: [
    { sheet: "screens", name: "Admin" },
    { sheet: "relationships", name: "Config file -> Paths and scripts" },
  ],
  Tables: [
    { sheet: "elements", name: "SQLite tables" },
    { sheet: "paths", name: "database.db" },
    { sheet: "scripts", name: "Script/source_table_schema.py" },
  ],
  Users: [
    { sheet: "elements", name: "Authentication layer" },
    { sheet: "scripts", name: "Script/api.py" },
  ],
  "Balance Check": [
    { sheet: "elements", name: "Keyproof and itemization" },
    { sheet: "scripts", name: "Script/system_banking_core.py" },
    { sheet: "paths", name: "database.db" },
  ],
  Keyproof: [
    { sheet: "elements", name: "Keyproof and itemization" },
    { sheet: "scripts", name: "Script/api.py" },
    { sheet: "paths", name: "database.db" },
  ],
  Itemization: [
    { sheet: "elements", name: "Keyproof and itemization" },
    { sheet: "scripts", name: "Script/api.py" },
    { sheet: "paths", name: "database.db" },
  ],
  "Attachments": [
    { sheet: "elements", name: "Attachment snapshots" },
    { sheet: "scripts", name: "Script/site_snapshotgenerator.py" },
    { sheet: "paths", name: "snapshots" },
  ],
  "Snapshot Generator": [
    { sheet: "elements", name: "Attachment snapshots" },
    { sheet: "scripts", name: "Script/site_snapshotgenerator.py" },
    { sheet: "paths", name: "snapshots" },
  ],
  "Email Downloader": [
    { sheet: "scripts", name: "Script/site_emaildownloader.py" },
    { sheet: "paths", name: "4.Emails" },
    { sheet: "relationships", name: "Email downloader -> Snapshots and attachments" },
  ],
};

function dedupeSelectedItems(items: SelectedItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.sheet}:${item.name}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getCrossContextLinks(selected: SelectedItem | null) {
  if (!selected) {
    return [] as SelectedItem[];
  }

  const base = selectedItemLinks[selected.name] ?? [];

  if (selected.sheet === "screens") {
    switch (selected.name) {
      case "Import":
        return dedupeSelectedItems([
          ...base,
          { sheet: "scripts", name: "Script/api.py" },
          { sheet: "scripts", name: "Script/site_emaildownloader.py" },
          { sheet: "scripts", name: "Script/site_snapshotgenerator.py" },
          { sheet: "paths", name: "4.Emails" },
          { sheet: "paths", name: "Import_Flywire" },
          { sheet: "paths", name: "snapshots" },
          { sheet: "elements", name: "FastAPI endpoints" },
          { sheet: "elements", name: "Attachment snapshots" },
          { sheet: "relationships", name: "Email downloader -> Snapshots and attachments" },
          { sheet: "relationships", name: "Snapshot generator -> Attachment review screens" },
          { sheet: "relationships", name: "Config file -> Paths and scripts" },
        ]);
      case "Keyproof":
      case "Itemization":
      case "Balance Check":
        return dedupeSelectedItems([
          ...base,
          { sheet: "scripts", name: "Script/api.py" },
          { sheet: "scripts", name: "Script/system_banking_core.py" },
          { sheet: "paths", name: "database.db" },
          { sheet: "paths", name: "snapshots" },
          { sheet: "elements", name: "Keyproof and itemization" },
          { sheet: "elements", name: "SQLite tables" },
          { sheet: "relationships", name: "Database file -> Keyproof / itemization / schema" },
        ]);
      case "Attachments":
      case "Snapshot Generator":
      case "Email Downloader":
        return dedupeSelectedItems([
          ...base,
          { sheet: "scripts", name: "Script/api.py" },
          { sheet: "scripts", name: "Script/site_snapshotgenerator.py" },
          { sheet: "paths", name: "snapshots" },
          { sheet: "paths", name: "4.Emails" },
          { sheet: "elements", name: "Attachment snapshots" },
          { sheet: "relationships", name: "Snapshot generator -> Attachment review screens" },
          { sheet: "relationships", name: "Email downloader -> Snapshots and attachments" },
        ]);
      case "Admin":
      case "Config":
      case "HIPAA":
      case "Security":
      case "Portability":
      case "Dependencies":
      case "Schema":
      case "Auditors":
      case "Tables":
      case "Users":
        return dedupeSelectedItems([
          ...base,
          { sheet: "scripts", name: "Script/api.py" },
          { sheet: "scripts", name: "Script/config_manager.py" },
          { sheet: "paths", name: "Script/config.json" },
          { sheet: "paths", name: "database.db" },
          { sheet: "elements", name: "AdminShell" },
          { sheet: "elements", name: "Authentication layer" },
          { sheet: "elements", name: "SQLite tables" },
          { sheet: "relationships", name: "Backend API -> Screens" },
          { sheet: "relationships", name: "Config file -> Paths and scripts" },
          { sheet: "relationships", name: "Auth boundary -> HIPAA and security controls" },
          { sheet: "relationships", name: "Dependencies -> Server deployment" },
        ]);
      default:
        return dedupeSelectedItems([
          ...base,
          { sheet: "scripts", name: "Script/api.py" },
          { sheet: "paths", name: "Script/config.json" },
          { sheet: "elements", name: "FastAPI endpoints" },
          { sheet: "relationships", name: "Backend API -> Screens" },
        ]);
    }
  }

  if (selected.sheet === "scripts") {
    switch (selected.name) {
      case "Script/api.py":
        return dedupeSelectedItems([
          ...base,
          { sheet: "screens", name: "Admin" },
          { sheet: "screens", name: "Config" },
          { sheet: "screens", name: "HIPAA" },
          { sheet: "screens", name: "Security" },
          { sheet: "screens", name: "Portability" },
          { sheet: "screens", name: "Dependencies" },
          { sheet: "screens", name: "Schema" },
          { sheet: "screens", name: "Auditors" },
          { sheet: "screens", name: "Tables" },
          { sheet: "screens", name: "Users" },
          { sheet: "screens", name: "Balance Check" },
          { sheet: "screens", name: "Keyproof" },
          { sheet: "screens", name: "Itemization" },
          { sheet: "screens", name: "Attachments" },
          { sheet: "screens", name: "Snapshot Generator" },
          { sheet: "screens", name: "Email Downloader" },
          { sheet: "screens", name: "Import" },
          { sheet: "paths", name: "Script/config.json" },
          { sheet: "paths", name: "database.db" },
          { sheet: "elements", name: "FastAPI endpoints" },
          { sheet: "elements", name: "Authentication layer" },
          { sheet: "relationships", name: "Backend API -> Screens" },
          { sheet: "relationships", name: "Auth boundary -> HIPAA and security controls" },
        ]);
      case "Script/config_manager.py":
        return dedupeSelectedItems([
          ...base,
          { sheet: "screens", name: "Config" },
          { sheet: "screens", name: "Portability" },
          { sheet: "screens", name: "Dependencies" },
          { sheet: "screens", name: "Schema" },
          { sheet: "paths", name: "Script/config.json" },
          { sheet: "paths", name: "database.db" },
          { sheet: "relationships", name: "Config file -> Paths and scripts" },
        ]);
      case "Script/db.py":
      case "Script/source_table_schema.py":
        return dedupeSelectedItems([
          ...base,
          { sheet: "screens", name: "Schema" },
          { sheet: "screens", name: "Tables" },
          { sheet: "screens", name: "Keyproof" },
          { sheet: "screens", name: "Itemization" },
          { sheet: "screens", name: "Balance Check" },
          { sheet: "paths", name: "database.db" },
          { sheet: "elements", name: "SQLite tables" },
          { sheet: "relationships", name: "Database file -> Keyproof / itemization / schema" },
        ]);
      case "Script/site_emaildownloader.py":
        return dedupeSelectedItems([
          ...base,
          { sheet: "screens", name: "Email Downloader" },
          { sheet: "screens", name: "Import" },
          { sheet: "screens", name: "Attachments" },
          { sheet: "screens", name: "Snapshot Generator" },
          { sheet: "paths", name: "4.Emails" },
          { sheet: "paths", name: "snapshots" },
          { sheet: "relationships", name: "Email downloader -> Snapshots and attachments" },
        ]);
      case "Script/site_snapshotgenerator.py":
        return dedupeSelectedItems([
          ...base,
          { sheet: "screens", name: "Snapshot Generator" },
          { sheet: "screens", name: "Attachments" },
          { sheet: "screens", name: "Import" },
          { sheet: "paths", name: "snapshots" },
          { sheet: "elements", name: "Attachment snapshots" },
          { sheet: "relationships", name: "Snapshot generator -> Attachment review screens" },
        ]);
      case "Script/system_banking_core.py":
        return dedupeSelectedItems([
          ...base,
          { sheet: "screens", name: "Balance Check" },
          { sheet: "screens", name: "Keyproof" },
          { sheet: "screens", name: "Itemization" },
          { sheet: "paths", name: "database.db" },
          { sheet: "relationships", name: "Database file -> Keyproof / itemization / schema" },
        ]);
      case "Script/system_calendar_core.py":
        return dedupeSelectedItems([
          ...base,
          { sheet: "screens", name: "Calendar" },
          { sheet: "screens", name: "Import" },
          { sheet: "screens", name: "Attachments" },
          { sheet: "paths", name: "Script/config.json" },
          { sheet: "relationships", name: "Config file -> Paths and scripts" },
        ]);
      case "Script/system_source_match_core.py":
      case "Script/utility_checknumber-search.pyw":
        return dedupeSelectedItems([
          ...base,
          { sheet: "screens", name: "Duplicate Check" },
          { sheet: "screens", name: "835 Match" },
          { sheet: "screens", name: "Site Review" },
          { sheet: "paths", name: "database.db" },
          { sheet: "relationships", name: "Backend API -> Screens" },
        ]);
      default:
        return dedupeSelectedItems([
          ...base,
          { sheet: "screens", name: "Admin" },
          { sheet: "paths", name: "Script/config.json" },
          { sheet: "relationships", name: "Config file -> Paths and scripts" },
        ]);
    }
  }

  return dedupeSelectedItems([
    ...base,
    { sheet: "screens", name: "Admin" },
    { sheet: "scripts", name: "Script/api.py" },
    { sheet: "paths", name: "Script/config.json" },
  ]);
}

const sheetLinks: Record<SheetKey, SheetLink> = {
  screens: { label: "Open Admin", path: "/admin" },
  scripts: { label: "Open Dependencies", path: "/admin/dependencies" },
  paths: { label: "Open Dependencies", path: "/admin/dependencies" },
  elements: { label: "Open Schema", path: "/admin/schema" },
  relationships: { label: "Open Portability", path: "/admin/portability" },
};

type SheetContent = {
  title: string;
  description: string;
  items: AuditItem[];
};

const sheetData: Record<SheetKey, SheetContent> = {
  screens: {
    title: "Screens",
    description: "All visible routes and admin pages in the app.",
    items: ALL_MENU_OPTIONS.filter((option) => option.kind === "screen" && Boolean(option.path)).map((option) => ({
      name: option.label,
      detail: `${option.path} - ${option.meta}`,
      owner: option.id.startsWith("/admin") ? "App team" : "Shared",
      impact: option.path?.startsWith("/admin")
        ? "Admin-only view that supports support, readiness, or configuration work."
        : "User-facing or workflow screen that drives day-to-day processing.",
    })),
  },
  scripts: {
    title: "Scripts",
    description: "Backend and helper scripts that the app depends on.",
    items: scriptItems,
  },
  paths: {
    title: "Paths",
    description: "Filesystem and config locations that the server must provide.",
    items: pathItems,
  },
  elements: {
    title: "Elements",
    description: "Core app parts and workflow building blocks.",
    items: elementItems,
  },
  relationships: {
    title: "Relationships",
    description: "How the major technical pieces affect each other.",
    items: relationshipSheetItems,
  },
};

export default function AuditorsScreen() {
  const navigate = useNavigate();
  const [selectedSheet, setSelectedSheet] = useState<SheetKey>("screens");
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  const currentSheet = sheetData[selectedSheet];
  const currentSheetLink = sheetLinks[selectedSheet];
  const totals = useMemo(() => {
    const screens = sheetData.screens.items.length;
    const scripts = sheetData.scripts.items.length;
    const paths = sheetData.paths.items.length;
    const elements = sheetData.elements.items.length;
    return { screens, scripts, paths, elements };
  }, []);

  const relatedItems = useMemo(() => {
    const directLinks = getCrossContextLinks(selectedItem);
    return directLinks
      .map((link) => {
        const sheetItems = sheetData[link.sheet].items;
        const match = sheetItems.find((item) => item.name === link.name);
        return match ? { ...match, sheet: link.sheet } : null;
      })
      .filter((item): item is AuditItem & { sheet: SheetKey } => Boolean(item));
  }, [selectedItem]);

  const selectedItemSummary = selectedItem
    ? sheetData[selectedItem.sheet].items.find((item) => item.name === selectedItem.name) ?? null
    : null;
  const selectedItemRoute = useMemo(() => {
    if (!selectedItem) {
      return null;
    }

    if (selectedItem.sheet === "screens") {
      const screen = ALL_MENU_OPTIONS.find((option) => option.kind === "screen" && option.label === selectedItem.name);
      return screen?.path ?? null;
    }

    return null;
  }, [selectedItem]);

  return (
    <AdminShell
      sidebarCopy="A technical audit hub for screens, scripts, paths, elements, and the relationships between them."
      sidebarCardLabel="Auditors"
      sidebarCardValue={currentSheet.title}
      sidebarCardMeta={`${totals.screens} screens, ${totals.scripts} scripts, ${totals.paths} paths, ${totals.elements} elements.`}
      onBack={() => navigate("/admin")}
      hideBackButton
      useGlobalMenuFallback={false}
      ribbonTitle="Auditors"
    >
      <section style={styles.page}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Technical data sheets</div>
            <p style={adminStyles.subtitle}>
              Use the buttons to switch between the different audit sheets. Each sheet is focused on one technical layer
              and shows how that layer affects the others.
            </p>
            <div style={styles.sheetButtons}>
              {sheetButtons.map((button) => (
                <button
                  key={button.key}
                  type="button"
                  style={{
                    ...styles.sheetButton,
                    ...(selectedSheet === button.key ? styles.sheetButtonActive : null),
                  }}
                  onClick={() => setSelectedSheet(button.key)}
                >
                  <span style={styles.sheetButtonTitle}>{button.label}</span>
                  <span style={styles.sheetButtonMeta}>{button.meta}</span>
                </button>
              ))}
            </div>
            <div style={styles.heroActions}>
              <button type="button" style={adminStyles.primaryButton} onClick={() => navigate(currentSheetLink.path)}>
                {currentSheetLink.label}
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Audit hub</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>What this page shows</div>
              <div style={adminStyles.heroStatusText}>
                The screen, script, path, element, and relationship sheets are all read-only reference views for the
                app's technical structure.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          <article style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Current sheet</div>
            <div style={styles.summaryValue}>{currentSheet.title}</div>
            <div style={styles.summaryMeta}>{currentSheet.description}</div>
          </article>
          <article style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Sheet buttons</div>
            <div style={styles.summaryValue}>{sheetButtons.length}</div>
            <div style={styles.summaryMeta}>Each button opens one audit data sheet.</div>
          </article>
          <article style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Relationship view</div>
            <div style={styles.summaryValue}>{relationshipItems.length}</div>
            <div style={styles.summaryMeta}>How the major technical items affect each other.</div>
          </article>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>{currentSheet.title}</div>
              <h2 style={adminStyles.sectionTitle}>{currentSheet.description}</h2>
            </div>
            <div style={adminStyles.sectionMeta}>{currentSheet.items.length} items</div>
          </div>

          <div style={styles.itemGrid}>
            {currentSheet.items.map((item) => (
              <article
                key={item.name}
                style={{
                  ...styles.itemCard,
                  ...(selectedItem?.sheet === selectedSheet && selectedItem.name === item.name ? styles.itemCardSelected : null),
                }}
                onClick={() => setSelectedItem({ sheet: selectedSheet, name: item.name })}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedItem({ sheet: selectedSheet, name: item.name });
                  }
                }}
              >
                <div style={styles.itemTopRow}>
                  <div>
                    <div style={styles.itemTitle}>{item.name}</div>
                    <div style={styles.itemDetail}>{item.detail}</div>
                  </div>
                  <div style={styles.itemMetaWrap}>
                    <span style={styles.ownerPill}>{item.owner}</span>
                  </div>
                </div>
                <div style={styles.itemImpact}>
                  <strong>Effect:</strong> {item.impact}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Impact</div>
              <h2 style={adminStyles.sectionTitle}>Why this audit hub helps</h2>
            </div>
          </div>
          <div style={styles.impactList}>
            <article style={styles.impactCard}>
              <div style={styles.impactTitle}>Cross-system visibility</div>
              <div style={styles.impactDetail}>
                You can trace a screen back to its script, its paths, and the database or file storage it depends on.
              </div>
            </article>
            <article style={styles.impactCard}>
              <div style={styles.impactTitle}>Change impact review</div>
              <div style={styles.impactDetail}>
                When one technical layer changes, it is easier to see which other parts need to move with it.
              </div>
            </article>
            <article style={styles.impactCard}>
              <div style={styles.impactTitle}>Server handoff</div>
              <div style={styles.impactDetail}>
                This gives you a practical list to review with IT before deployment or migration.
              </div>
            </article>
          </div>
        </section>

        {selectedItemSummary && (
          <div style={styles.modalOverlay} onClick={() => setSelectedItem(null)} role="presentation">
            <section
              style={styles.modalCard}
              role="dialog"
              aria-modal="true"
              aria-labelledby="auditor-modal-title"
              aria-describedby="auditor-modal-description"
              onClick={(event) => event.stopPropagation()}
            >
              <div style={styles.modalHeader}>
                <div>
                  <div style={adminStyles.sectionKicker}>Cross context</div>
                  <h2 id="auditor-modal-title" style={adminStyles.sectionTitle}>
                    Related items
                  </h2>
                </div>
                <button type="button" style={adminStyles.secondaryButton} onClick={() => setSelectedItem(null)}>
                  Close
                </button>
              </div>

              <div id="auditor-modal-description" style={styles.selectedCallout}>
                <div style={styles.itemTitle}>{selectedItemSummary.name}</div>
                <div style={styles.itemDetail}>{selectedItemSummary.detail}</div>
                <div style={styles.itemImpact}>
                  <strong>Effect:</strong> {selectedItemSummary.impact}
                </div>
                {selectedItemRoute && (
                  <div style={styles.modalActionRow}>
                    <button
                      type="button"
                      style={adminStyles.primaryButton}
                      onClick={() => navigate(selectedItemRoute)}
                    >
                      {selectedItemSummary.name === "Import" ? "Import selected" : "Open selected"}
                    </button>
                  </div>
                )}
              </div>

              <div style={styles.modalSectionTitle}>Related items</div>
              <div style={styles.relatedGrid}>
                {relatedItems.length > 0 ? (
                  relatedItems.map((item) => (
                    <article
                      key={`${item.sheet}:${item.name}`}
                      style={styles.relatedCard}
                      onClick={() => setSelectedItem({ sheet: item.sheet, name: item.name })}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedItem({ sheet: item.sheet, name: item.name });
                        }
                      }}
                    >
                      <div style={styles.relatedTopRow}>
                        <div>
                          <div style={styles.relatedTitle}>{item.name}</div>
                          <div style={styles.relatedMeta}>{item.sheet.toUpperCase()}</div>
                        </div>
                        <span style={styles.ownerPill}>{item.owner}</span>
                      </div>
                      <div style={styles.relatedDetail}>{item.detail}</div>
                      <div style={styles.relatedImpact}>
                        <strong>Effect:</strong> {item.impact}
                      </div>
                    </article>
                  ))
                ) : (
                  <div style={styles.relatedEmpty}>No mapped related items yet for this selection.</div>
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "grid",
    gap: "18px",
  },
  sheetButtons: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "10px",
    marginTop: "8px",
  },
  sheetButton: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 16px 28px rgba(52, 84, 120, 0.06)",
    display: "grid",
    gap: "6px",
    cursor: "pointer",
    textAlign: "left",
  },
  sheetButtonActive: {
    border: "1px solid rgba(106, 137, 180, 0.24)",
    background: "linear-gradient(135deg, #dbeeff 0%, #c6ddfb 100%)",
  },
  sheetButtonTitle: {
    fontSize: "14px",
    fontWeight: 900,
    color: "#17324f",
  },
  sheetButtonMeta: {
    fontSize: "12px",
    lineHeight: 1.4,
    color: "#5e7186",
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
    fontSize: "28px",
    lineHeight: 1,
    fontWeight: 900,
    color: "#17324f",
    wordBreak: "break-word",
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
  itemGrid: {
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
    cursor: "pointer",
    transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
  },
  itemCardSelected: {
    border: "1px solid rgba(106, 137, 180, 0.32)",
    boxShadow: "0 20px 34px rgba(86, 125, 180, 0.12)",
    transform: "translateY(-1px)",
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
  itemImpact: {
    fontSize: "12px",
    lineHeight: 1.55,
    color: "#405266",
  },
  selectedCallout: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(106, 137, 180, 0.20)",
    background: "linear-gradient(135deg, rgba(221, 239, 255, 0.72) 0%, rgba(255,255,255,0.94) 100%)",
    display: "grid",
    gap: "8px",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    display: "grid",
    placeItems: "center",
    padding: "24px",
    background: "rgba(10, 18, 30, 0.52)",
    backdropFilter: "blur(8px)",
  },
  modalCard: {
    width: "min(920px, 100%)",
    maxHeight: "min(88vh, 920px)",
    overflow: "auto",
    borderRadius: "28px",
    border: "1px solid rgba(140, 160, 184, 0.24)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,249,253,0.98) 100%)",
    boxShadow: "0 32px 80px rgba(0, 0, 0, 0.28)",
    padding: "18px",
    display: "grid",
    gap: "14px",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  modalActionRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "4px",
  },
  modalSectionTitle: {
    fontSize: "14px",
    fontWeight: 900,
    color: "#17324f",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  relatedGrid: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  relatedCard: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.9)",
    display: "grid",
    gap: "8px",
    cursor: "pointer",
  },
  relatedTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
  },
  relatedTitle: {
    fontSize: "14px",
    fontWeight: 900,
    color: "#17324f",
  },
  relatedMeta: {
    marginTop: "4px",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  relatedDetail: {
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#536579",
  },
  relatedImpact: {
    fontSize: "12px",
    lineHeight: 1.55,
    color: "#405266",
  },
  relatedEmpty: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px dashed rgba(140, 160, 184, 0.30)",
    color: "#5e7186",
    background: "rgba(255,255,255,0.75)",
    fontSize: "13px",
    lineHeight: 1.55,
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
