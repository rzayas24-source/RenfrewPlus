import type { CSSProperties } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { runSnapshotGenerator, type SnapshotGeneratorResult } from "../api/snapshot_generator_api";
import { styles as adminStyles } from "./adminscreen";
import { WorklistBrandButton } from "../worklist/worklist";

export default function SnapshotGeneratorScreen() {
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SnapshotGeneratorResult | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    setMessage("Running snapshot generator...");
    setResult(null);

    try {
      const response = await runSnapshotGenerator();
      setResult(response);
      setMessage(
        `Processed ${response.processed_count} file(s), generated ${response.generated_count} snapshot(s), skipped ${response.skipped_count}.`
      );
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Failed to run snapshot generator");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main style={adminStyles.shell}>
      <div style={adminStyles.glowBlue} />
      <div style={adminStyles.glowPink} />

      <aside style={adminStyles.sidebar}>
        <div style={adminStyles.brandWrap}>
          <WorklistBrandButton style={adminStyles.brandMark} ariaLabel="Open work list from the branding button">
            <img src="/favicon.svg" alt="" style={adminStyles.brandMarkImage} />
          </WorklistBrandButton>
          <div style={adminStyles.brandWomenMark} aria-hidden="true">
            <img src="/renfrew-gazebo.png" alt="" style={adminStyles.brandWomenImage} />
          </div>
        </div>

        <p style={adminStyles.sidebarCopy}>
          A snapshot generator workspace that turns the day bundle into review images for the queue.
        </p>

        <nav style={adminStyles.navStack} aria-label="Snapshot generator navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/site-review")}>
            <span style={adminStyles.navButtonLabel}>Site Review</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>?</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/email-downloader")}>
            <span style={adminStyles.navButtonLabel}>Email Downloader</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>?</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/")}>
            <span style={adminStyles.navButtonLabel}>Home</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>?</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Today</div>
          <div style={adminStyles.sidebarCardValue}>Snapshot generator ready</div>
          <div style={adminStyles.sidebarCardMeta}>
            It reads the email download folder and keeps each attachment linked to the imported file row.
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>site_snapshotgenerator</div>
            <p style={adminStyles.subtitle}>
              Build the review snapshots for everything that landed in the email download batch.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.primaryButton} type="button" onClick={handleRun} disabled={running}>
                {running ? "Running..." : "Run Snapshot Generator"}
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/site-review")}>
                Back to Site Review
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Snapshot window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Attachment previews stay with the batch</div>
              <div style={adminStyles.heroStatusText}>
                The generator reads the downloaded files and writes review images back to the imported file row.
              </div>
            </div>
          </div>
        </section>

        <section style={adminStyles.statsGrid}>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Source</div>
            <div style={adminStyles.statValue}>C:\Renfrew\Workflow\4.Emails</div>
            <div style={adminStyles.statDetail}>The same folder the downloader writes to.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Target</div>
            <div style={adminStyles.statValue}>C:\Renfrew\Workflow\snapshots</div>
            <div style={adminStyles.statDetail}>Snapshot images are written here by file id.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Linking</div>
            <div style={adminStyles.statValue}>Imported files table</div>
            <div style={adminStyles.statDetail}>Each file keeps its snapshot path in the review row.</div>
          </article>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Snapshot controls</div>
              <h2 style={adminStyles.sectionTitle}>Generate the review snapshots for the current email bundle</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              This keeps the email downloader flow intact while giving the project a dedicated snapshot step.
            </div>
          </div>

          {error && <div style={snapshotStyles.errorBanner}>{error}</div>}
          {message && <div style={snapshotStyles.messageBanner}>{message}</div>}

          <div style={snapshotStyles.resultGrid}>
            <div style={snapshotStyles.resultCard}>
              <div style={snapshotStyles.resultLabel}>Files processed</div>
              <div style={snapshotStyles.resultValue}>{result ? result.processed_count : "—"}</div>
            </div>
            <div style={snapshotStyles.resultCard}>
              <div style={snapshotStyles.resultLabel}>Snapshots generated</div>
              <div style={snapshotStyles.resultValue}>{result ? result.generated_count : "—"}</div>
            </div>
            <div style={snapshotStyles.resultCard}>
              <div style={snapshotStyles.resultLabel}>Already existed</div>
              <div style={snapshotStyles.resultValue}>{result ? result.skipped_count : "—"}</div>
            </div>
          </div>

          {result && (
            <div style={snapshotStyles.filePanel}>
              <div style={snapshotStyles.filePanelTitle}>Snapshot files</div>
              <ul style={snapshotStyles.fileList}>
                {result.files.map((filePath) => (
                  <li key={filePath} style={snapshotStyles.fileItem}>
                    {filePath}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

const snapshotStyles: Record<string, CSSProperties> = {
  resultGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
  },
  resultCard: {
    padding: "16px",
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.86)",
  },
  resultLabel: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#5d7289",
    marginBottom: "8px",
  },
  resultValue: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#1f2933",
  },
  errorBanner: {
    marginBottom: "14px",
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid #f0b4b4",
    background: "#fff5f5",
    color: "#a32121",
  },
  messageBanner: {
    marginBottom: "14px",
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "#fbfcfe",
    color: "#27405e",
  },
  filePanel: {
    marginTop: "18px",
    padding: "16px",
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.84)",
  },
  filePanelTitle: {
    fontSize: "14px",
    fontWeight: 700,
    marginBottom: "8px",
  },
  fileList: {
    margin: 0,
    paddingLeft: "18px",
    display: "grid",
    gap: "6px",
    maxHeight: "220px",
    overflow: "auto",
  },
  fileItem: {
    overflowWrap: "anywhere",
    fontSize: "13px",
    color: "#1f2933",
  },
};
