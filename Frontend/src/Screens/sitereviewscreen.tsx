import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from "./adminscreen";

type SiteReviewMetric = {
  label: string;
  value: string;
  detail: string;
};

type SiteReviewShortcut = {
  title: string;
  meta: string;
  tone: "blue" | "pink" | "mist" | "pearl";
  action: string;
  path: string;
};

export default function SiteReviewScreen() {
  const navigate = useNavigate();

  const metrics: SiteReviewMetric[] = [
    {
      label: "Mode",
      value: "Pending Items workspace",
      detail: "A calm place for reviewing pending items, follow-up, and handoff notes.",
    },
    {
      label: "Focus",
      value: "Review + action",
      detail: "Keep the new pending-items flow visible without changing the shell language.",
    },
    {
      label: "Style",
      value: "Matches cash",
      detail: "Same cards, same spacing, same soft shell treatment.",
    },
  ];

  const shortcuts: SiteReviewShortcut[] = [
    {
      title: "Review Queue",
      meta: "Open the pending items queue and keep work moving.",
      tone: "blue",
      action: "Open Queue",
      path: "/site",
    },
    {
      title: "Cash Workspace",
      meta: "Jump back to the cash screen when you need the broader menu.",
      tone: "pink",
      action: "Open Cash",
      path: "/cash",
    },
    {
      title: "Snapshot Generator",
      meta: "Render review snapshots for the downloaded email bundle.",
      tone: "mist",
      action: "Open Snapshots",
      path: "/snapshot-generator",
    },
    {
      title: "Pending Notes",
      meta: "Use this card for reminders, exceptions, and follow-up details.",
      tone: "pearl",
      action: "Open Notes",
      path: "/approved",
    },
    {
      title: "Workspace Home",
      meta: "Return to the main dashboard whenever you need the full menu.",
      tone: "blue",
      action: "Back to Main",
      path: "/",
    },
  ];

  return (
    <AdminShell
      sidebarCopy="A soft pending items console that keeps the new screen in the same visual family as Cash."
      onBack={() => navigate("/cash")}
      sidebarCardLabel="Today"
      sidebarCardValue="Pending items ready"
      sidebarCardMeta="The same calm shell keeps pending-items work aligned with the cash workspace."
    >
      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Batches Screen</div>
            <p style={adminStyles.subtitle}>
              A calm workspace for pending items, follow-up, and exception handling.
            </p>

            <div style={adminStyles.heroActions}>
              <button
                style={{
                  ...adminStyles.primaryButton,
                  ...siteReviewHeroButtonStyle,
                }}
                type="button"
                onClick={() => navigate("/site")}
              >
                Pending
              </button>
              <button
                style={{
                  ...adminStyles.secondaryButton,
                  ...siteReviewHeroButtonStyle,
                }}
                type="button"
                onClick={() => navigate("/approved")}
              >
                Approved
              </button>
              <button
                style={{
                  ...adminStyles.secondaryButton,
                  ...siteReviewHeroButtonStyle,
                }}
                type="button"
                onClick={() => navigate("/email-downloader")}
              >
                Email Downloader
              </button>
              <button
                style={{
                  ...adminStyles.secondaryButton,
                  ...siteReviewHeroButtonStyle,
                }}
                type="button"
                onClick={() => navigate("/snapshot-generator")}
              >
                Snapshot Generator
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Pending items window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Same shell, pending-items focus</div>
              <div style={adminStyles.heroStatusText}>
                This page copies the cash styling so the new pending-items area feels native to the workspace.
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
              <div style={adminStyles.sectionKicker}>Pending items tools</div>
              <h2 style={adminStyles.sectionTitle}>The same card layout, now focused on pending items work</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              We reused the cash shell so the new screen stays visually consistent.
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
                  ...siteReviewToneStyles[shortcut.tone],
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

const siteReviewToneStyles: Record<SiteReviewShortcut["tone"], CSSProperties> = {
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

const siteReviewHeroButtonStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.96)",
  color: "#15304f",
  border: "1px solid rgba(188, 193, 203, 0.68)",
  boxShadow: "0 14px 24px rgba(119, 151, 198, 0.10)",
};


