import { useNavigate } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from "./adminscreen";

type ImportMetric = {
  label: string;
  value: string;
  detail: string;
};

export default function ImportScreen() {
  const navigate = useNavigate();

  const metrics: ImportMetric[] = [
    {
      label: "Mode",
      value: "Import workspace",
      detail: "A calm place for bringing source files into the workflow.",
    },
    {
      label: "Focus",
      value: "Queue + staging",
      detail: "Keep import work visible without changing the shell language.",
    },
    {
      label: "Style",
      value: "Matches cash",
      detail: "Same cards, same spacing, same soft shell treatment.",
    },
  ];

  return (
    <AdminShell
      sidebarCopy="A soft import console for bringing files into the workflow with the same calm shell as Cash."
      onBack={() => navigate("/cash")}
    >
      <section style={{ ...adminStyles.content, paddingTop: "0" }}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Import screen</div>
            <p style={adminStyles.subtitle}>
              A calm workspace for staging inbound files, checking progress, and following import work through the system.
            </p>

          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Import window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Same shell, import focus</div>
              <div style={adminStyles.heroStatusText}>
                This page uses the import styling so the new EFT area feels native to the workspace.
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

      </section>
    </AdminShell>
  );
}

