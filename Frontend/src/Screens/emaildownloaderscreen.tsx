import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getEmailDownloaderDates,
  getEmailDownloaderFolders,
  runEmailDownloader,
  type EmailFolderOption,
  type EmailDownloadResult,
} from "../api/email_downloader_api";
import { styles as adminStyles } from "./adminscreen";
import { WorklistBrandButton } from "../worklist/worklist";

export default function EmailDownloaderScreen() {
  const navigate = useNavigate();
  const [folders, setFolders] = useState<EmailFolderOption[]>([]);
  const [folderIndex, setFolderIndex] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [dateValue, setDateValue] = useState("all");
  const [moveAfter, setMoveAfter] = useState(false);
  const [destFolderIndex, setDestFolderIndex] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDates, setLoadingDates] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<EmailDownloadResult | null>(null);

  useEffect(() => {
    async function loadFolders() {
      try {
        const items = await getEmailDownloaderFolders();
        setFolders(items);

        let initialFolder = items[0] || null;
        let initialDates: string[] = [];

        for (const folder of items) {
          const folderDates = await getEmailDownloaderDates(folder.index);
          if (folderDates.length > 0) {
            initialFolder = folder;
            initialDates = folderDates;
            break;
          }
        }

        if (initialFolder) {
          setFolderIndex(String(initialFolder.index));
          setDates(initialDates);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load folders");
        setFolders([]);
      } finally {
        setLoading(false);
      }
    }

    void loadFolders();
  }, []);

  useEffect(() => {
    if (folderIndex === "") {
      return;
    }

    setLoadingDates(true);
    getEmailDownloaderDates(Number(folderIndex))
      .then((items) => {
        setDates(items);
        setDateValue("all");
        setError(null);
      })
      .catch((err) => {
        setDates([]);
        setError(err instanceof Error ? err.message : "Failed to load dates");
      })
      .finally(() => {
        setLoadingDates(false);
      });
  }, [folderIndex]);

  useEffect(() => {
    if (!moveAfter) {
      return;
    }
    if (destFolderIndex && destFolderIndex !== folderIndex) {
      return;
    }

    const nextFolder = folders.find((folder) => String(folder.index) !== folderIndex);
    setDestFolderIndex(nextFolder ? String(nextFolder.index) : "");
  }, [moveAfter, folderIndex, destFolderIndex, folders]);

  const selectedFolderName = useMemo(() => {
    return folders.find((folder) => String(folder.index) === folderIndex)?.name || "Select a folder";
  }, [folders, folderIndex]);

  async function handleRun() {
    if (!folderIndex) {
      setError("Please choose a folder first.");
      return;
    }

    if (moveAfter && !destFolderIndex) {
      setError("Please choose a destination folder or turn off move after download.");
      return;
    }

    setRunning(true);
    setError(null);
    setMessage("Running email downloader...");
    setResult(null);

    try {
      const response = await runEmailDownloader({
        folder_index: Number(folderIndex),
        date_value: dateValue === "all" ? null : dateValue,
        move_messages_after: moveAfter,
        dest_folder_index: moveAfter ? Number(destFolderIndex) : null,
      });
      setResult(response);
      setMessage(
        `Downloaded ${response.downloaded_count} item(s) from ${selectedFolderName}.` +
          (response.moved_count ? ` Moved ${response.moved_count} email(s) after download.` : "")
      );
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Failed to run email downloader");
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
          A focused workspace for picking the Outlook folder, choosing the day bundle, and running the downloader through the project.
        </p>

        <nav style={adminStyles.navStack} aria-label="Email downloader navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/site-review")}>
            <span style={adminStyles.navButtonLabel}>Site Review</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>?</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/attachments")}>
            <span style={adminStyles.navButtonLabel}>Pending</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>?</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/")}>
            <span style={adminStyles.navButtonLabel}>Home</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>?</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Today</div>
          <div style={adminStyles.sidebarCardValue}>Email downloader ready</div>
          <div style={adminStyles.sidebarCardMeta}>
            The batch stays tied to the selected day, and files land in the review pipeline automatically.
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Email downloader</div>
            <p style={adminStyles.subtitle}>
              Choose a folder, choose a day bundle, and let the downloader save files with the day prefix for review.
            </p>

            <div style={adminStyles.heroActions}>
              <button
                style={adminStyles.primaryButton}
                type="button"
                onClick={handleRun}
                disabled={running || loading || folders.length === 0}
              >
                {running ? "Running..." : "Run Download"}
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/site-review")}>
                Back to Site Review
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Downloader window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Day bundle stays together</div>
              <div style={adminStyles.heroStatusText}>
                The files keep their mm.dd.yy prefix, and the review queue sees the same day grouping.
              </div>
            </div>
          </div>
        </section>

        <section style={adminStyles.statsGrid}>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Folder</div>
            <div style={adminStyles.statValue}>{selectedFolderName}</div>
            <div style={adminStyles.statDetail}>Picked from the Inbox folder list.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Dates</div>
            <div style={adminStyles.statValue}>{loadingDates ? "Loading..." : `${dates.length} available`}</div>
            <div style={adminStyles.statDetail}>These are the days currently in the selected folder.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Move after</div>
            <div style={adminStyles.statValue}>{moveAfter ? "Enabled" : "Disabled"}</div>
            <div style={adminStyles.statDetail}>Optional move step after download completes.</div>
          </article>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Download controls</div>
              <h2 style={adminStyles.sectionTitle}>Select the folder and day bundle to process</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              The downloader keeps its original vetting behavior, but now it runs through the project.
            </div>
          </div>

          {error && <div style={emailStyles.errorBanner}>{error}</div>}
          {message && <div style={emailStyles.messageBanner}>{message}</div>}

          <div style={emailStyles.formGrid}>
            <label style={emailStyles.field}>
              <span style={emailStyles.label}>Inbox Folder</span>
              <select
                style={emailStyles.select}
                value={folderIndex}
                onChange={(event) => setFolderIndex(event.target.value)}
                disabled={loading || folders.length === 0}
              >
                {folders.map((folder) => (
                  <option key={folder.index} value={folder.index}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={emailStyles.field}>
              <span style={emailStyles.label}>Day Bundle</span>
              <select
                style={emailStyles.select}
                value={dateValue}
                onChange={(event) => setDateValue(event.target.value)}
                disabled={loading}
              >
                <option value="all">All dates</option>
                {dates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            </label>

            <label style={emailStyles.checkboxRow}>
              <input
                type="checkbox"
                checked={moveAfter}
                onChange={(event) => setMoveAfter(event.target.checked)}
              />
              <span>Move processed emails after download</span>
            </label>

            <label style={emailStyles.field}>
              <span style={emailStyles.label}>Destination Folder</span>
              <select
                style={emailStyles.select}
                value={destFolderIndex}
                onChange={(event) => setDestFolderIndex(event.target.value)}
                disabled={!moveAfter || folders.length === 0}
              >
                <option value="">Select destination</option>
                {folders
                  .filter((folder) => String(folder.index) !== folderIndex)
                  .map((folder) => (
                    <option key={folder.index} value={folder.index}>
                      {folder.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          {result && (
            <div style={emailStyles.resultPanel}>
              <div style={emailStyles.resultTitle}>Run summary</div>
              <div style={emailStyles.resultGrid}>
                <div>Downloaded: {result.downloaded_count}</div>
                <div>Processed: {result.processed_count}</div>
                <div>Moved: {result.moved_count}</div>
                <div>Batch: {result.batch_labels.join(", ") || "None"}</div>
              </div>
              <div style={emailStyles.fileListTitle}>Saved files</div>
              <ul style={emailStyles.fileList}>
                {result.downloaded_files.map((filePath) => (
                  <li key={filePath} style={emailStyles.fileListItem}>
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

const emailStyles: Record<string, CSSProperties> = {
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
    alignItems: "start",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#27405e",
  },
  select: {
    height: "44px",
    borderRadius: "10px",
    border: "1px solid rgba(140, 160, 184, 0.35)",
    background: "#ffffff",
    color: "#1f2933",
    padding: "0 12px",
    fontSize: "15px",
    outline: "none",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    alignSelf: "center",
    paddingTop: "18px",
    fontSize: "15px",
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
  resultPanel: {
    marginTop: "18px",
    padding: "16px",
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.84)",
  },
  resultTitle: {
    fontSize: "18px",
    fontWeight: 700,
    marginBottom: "12px",
  },
  resultGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px 14px",
    fontSize: "14px",
    color: "#27405e",
    marginBottom: "14px",
  },
  fileListTitle: {
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
  fileListItem: {
    overflowWrap: "anywhere",
    fontSize: "13px",
    color: "#1f2933",
  },
};
