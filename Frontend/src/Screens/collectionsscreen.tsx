import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell, styles as adminStyles } from "../components/AdminShell";
type CollectionsMetric = {
  label: string;
  value: string;
  detail: string;
};

type CollectionsShortcut = {
  title: string;
  meta: string;
  tone: "blue" | "pink" | "mist" | "pearl";
  action: string;
  path: string;
};

export default function CollectionsScreen() {
  const navigate = useNavigate();

  const metrics: CollectionsMetric[] = [
    {
      label: "Mode",
      value: "Collections workspace",
      detail: "A calm place for receivables follow-up and collection tracking.",
    },
    {
      label: "Focus",
      value: "Follow-up + recovery",
      detail: "Keep collections work visible without changing the shell language.",
    },
    {
      label: "Style",
      value: "Matches cash",
      detail: "Same cards, same spacing, same soft shell treatment.",
    },
  ];

  const shortcuts: CollectionsShortcut[] = [
    {
      title: "Statements",
      meta: "Open statement-related review and support screens.",
      tone: "blue",
      action: "Open Statements",
      path: "/statements",
    },
    {
      title: "Requests",
      meta: "Open request-related workflow tools and review screens.",
      tone: "pink",
      action: "Open Requests",
      path: "/request",
    },
    {
      title: "Research",
      meta: "Open research-related workflow tools and review screens.",
      tone: "mist",
      action: "Open Research",
      path: "/research",
    },
    {
      title: "Finance",
      meta: "Open finance-related workflow tools and review screens.",
      tone: "pearl",
      action: "Open Finance",
      path: "/finance",
    },
    {
      title: "Business",
      meta: "Open business-related workflow tools and review screens.",
      tone: "mist",
      action: "Open Business",
      path: "/business",
    },
  ];

  return (
    <AdminShell
      ribbonTitle="Collections Menu"
      sidebarCopy="A soft collections console for follow-up, recovery, and receivables work."
      onBack={() => navigate("/")}
    >
      <section style={collectionsStyles.content}>
        <section style={collectionsStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Collections screen</div>
            <p style={adminStyles.subtitle}>
              A calm workspace for collections follow-up, statements, requests, and research tracking.
            </p>

            <div style={collectionsStyles.heroActions}>
              <button style={adminStyles.primaryButton} type="button" onClick={() => navigate("/statements")}>
                Open Statements
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/finance")}>
                Open Finance
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/business")}>
                Open Business
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Collections window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Same shell, collections focus</div>
              <div style={adminStyles.heroStatusText}>
                This page uses the cash-style layout so the new collections area feels native to the workspace.
              </div>
            </div>
          </div>
        </section>

        <section style={adminStyles.statsGrid}>
          {metrics.map((metric) => (
            <article key={metric.label} style={adminStyles.statCard}>
              <div style={adminStyles.statLabel}>{metric.label}</div>
              <div style={adminStyles.statValue}>{metric.value}</div>
              <div style={adminStyles.statDetail}>{metric.detail}</div>
            </article>
          ))}
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Collections tools</div>
              <h2 style={adminStyles.sectionTitle}>The same card layout, now focused on collections work</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              We kept the cash-style shell so the new screen stays consistent with the rest of the workspace.
            </div>
          </div>

          <div style={adminStyles.widgetGrid}>
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.title}
                type="button"
                onClick={() => navigate(shortcut.path)}
                style={{
                  ...adminStyles.widgetCard,
                  ...collectionsToneStyles[shortcut.tone],
                }}
              >
                <div style={adminStyles.widgetTop}>
                  <div style={adminStyles.widgetBadge}>{shortcut.title}</div>
                </div>
                <div style={adminStyles.widgetBody}>
                  <div style={adminStyles.widgetTitle}>{shortcut.title}</div>
                  <div style={adminStyles.widgetMeta}>{shortcut.meta}</div>
                </div>
                <div style={adminStyles.widgetAction}>{shortcut.action}</div>
              </button>
            ))}
          </div>
        </section>
      </section>
    </AdminShell>
  );
}

const collectionsToneStyles: Record<CollectionsShortcut["tone"], CSSProperties> = {
  blue: {
    background: "linear-gradient(145deg, rgba(212, 232, 255, 0.95), rgba(255, 255, 255, 0.92))",
  },
  pink: {
    background: "linear-gradient(145deg, rgba(255, 225, 236, 0.96), rgba(255, 255, 255, 0.92))",
  },
  mist: {
    background: "linear-gradient(145deg, rgba(231, 240, 247, 0.96), rgba(255, 255, 255, 0.92))",
  },
  pearl: {
    background: "linear-gradient(145deg, rgba(248, 244, 239, 0.96), rgba(255, 255, 255, 0.92))",
  },
};

const collectionsStyles: Record<string, CSSProperties> = {
  content: {
    ...adminStyles.content,
    paddingTop: "0",
  },
  heroShell: {
    ...adminStyles.heroShell,
    position: "relative",
    top: "auto",
    zIndex: 1,
  },
  heroActions: {
    ...adminStyles.heroActions,
    position: "static",
    top: "auto",
    left: "auto",
    right: "auto",
    zIndex: "auto",
    marginTop: "8px",
    padding: 0,
    border: "0",
    background: "transparent",
    backdropFilter: "none",
    boxShadow: "none",
  },
};

