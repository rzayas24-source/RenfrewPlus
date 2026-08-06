import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth";
import { AdminShell } from "../components/AdminShell";
import { useAppConfigContext, type AppConfig } from "../config/appConfig";
import { styles as adminStyles } from "./adminscreen";

export default function AdminConfigScreen() {
  const navigate = useNavigate();
  const { requireFreshAuth } = useAuth();
  const { config, loading, error, saveConfig, refreshConfig } = useAppConfigContext();
  const [draft, setDraft] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setDraft(JSON.stringify(config, null, 2));
    }
  }, [config]);

  const parsedPreview = useMemo(() => {
    try {
      return JSON.parse(draft) as unknown;
    } catch {
      return null;
    }
  }, [draft]);

  const handleSave = async () => {
    setSaveMessage(null);
    try {
      const parsed = JSON.parse(draft) as Record<string, unknown>;
      const allowed = await requireFreshAuth();
      if (!allowed) {
        return;
      }
      await saveConfig(parsed as AppConfig);
      setSaveError(null);
      setSaveMessage("Config saved and reloaded.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Config must be valid JSON before saving.");
    }
  };

  const handleReload = async () => {
    await refreshConfig();
    setSaveMessage("Reloaded from disk.");
    setSaveError(null);
  };

  return (
    <AdminShell
      sidebarCopy="Edit the live config.json payload that drives backend paths and config-aware UI labels."
      onBack={() => navigate("/admin")}
      hideBackButton
      useGlobalMenuFallback={false}
      ribbonTitle="Config"
    >
      <section style={styles.page}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Config editor</div>
            <p style={adminStyles.subtitle}>
              Update the shared config file once and let the backend and frontend read the same values.
            </p>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Live file</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Single source of truth</div>
              <div style={adminStyles.heroStatusText}>
                Save changes here to update `Script/config.json`, then refresh the app to pick up the new labels.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.toolbar}>
          <button type="button" style={adminStyles.primaryButton} onClick={handleSave} disabled={loading}>
            Save config
          </button>
          <button type="button" style={adminStyles.secondaryButton} onClick={handleReload} disabled={loading}>
            Reload from disk
          </button>
          <div style={styles.toolbarStatus}>
            {saveError ? <span style={styles.errorText}>{saveError}</span> : null}
            {!saveError && saveMessage ? <span style={styles.successText}>{saveMessage}</span> : null}
            {!saveError && !saveMessage && error ? <span style={styles.errorText}>{error}</span> : null}
          </div>
        </section>

        <section style={styles.editorCard}>
          <div style={styles.editorHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Raw JSON</div>
              <h2 style={adminStyles.sectionTitle}>Edit the live config payload</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              {config ? "Changes are saved back to the backend config file." : "Loading config..."}
            </div>
          </div>

          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            style={styles.textarea}
            aria-label="Config JSON editor"
            placeholder={loading ? "Loading config..." : "{}"}
          />

          <div style={styles.footerRow}>
            <div style={styles.previewMeta}>
              {parsedPreview ? "JSON is valid." : "JSON is invalid until it parses cleanly."}
            </div>
            <button type="button" style={adminStyles.secondaryButton} onClick={() => setDraft(JSON.stringify(config ?? {}, null, 2))}>
              Reset draft
            </button>
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
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "12px",
  },
  toolbarStatus: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
    color: "#5f6b7a",
    fontSize: "13px",
    fontWeight: 700,
  },
  editorCard: {
    display: "grid",
    gap: "16px",
    padding: "18px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.88)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
  },
  editorHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
  },
  textarea: {
    width: "100%",
    minHeight: "520px",
    resize: "vertical",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.26)",
    padding: "16px",
    fontFamily: '"Cascadia Mono", "Consolas", "Courier New", monospace',
    fontSize: "13px",
    lineHeight: 1.6,
    color: "#17324f",
    background: "#fbfcfe",
    boxSizing: "border-box",
  },
  footerRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  previewMeta: {
    fontSize: "13px",
    color: "#5f6b7a",
    fontWeight: 700,
  },
  errorText: {
    color: "#a32121",
  },
  successText: {
    color: "#23683d",
  },
};
