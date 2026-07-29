import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getEmailDownloaderDates,
  getEmailDownloaderFolders,
  getEmailDownloaderLastUploadedDate,
  runEmailDownloader,
  type EmailFolderOption,
  type EmailDownloadResult,
} from "../api/email_downloader_api";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from "./adminscreen";

const DEFAULT_SOURCE_FOLDER_NAME = "Christine Tracy - New";
const DEFAULT_DEST_FOLDER_NAME = "Christine Tracy - Archived";
type DownloadStatus = "ready" | "running" | "success" | "error";

function getControlStatusLabel(status: DownloadStatus) {
  switch (status) {
    case "running":
      return "Running";
    case "success":
      return "Completed";
    case "error":
      return "Needs attention";
    case "ready":
    default:
      return "Ready";
  }
}

function getControlStatusStyle(status: DownloadStatus): CSSProperties {
  switch (status) {
    case "running":
      return {
        background: "rgba(255, 241, 209, 0.96)",
        color: "#8b5e00",
        border: "1px solid rgba(224, 189, 93, 0.22)",
      };
    case "success":
      return {
        background: "rgba(224, 246, 230, 0.96)",
        color: "#1f6a3f",
        border: "1px solid rgba(109, 193, 135, 0.24)",
      };
    case "error":
      return {
        background: "rgba(255, 235, 235, 0.96)",
        color: "#a32121",
        border: "1px solid rgba(234, 147, 147, 0.26)",
      };
    case "ready":
    default:
      return {
        background: "rgba(224, 237, 250, 0.95)",
        color: "#35506d",
        border: "1px solid rgba(158, 187, 221, 0.26)",
      };
  }
}

function parseLocalYmd(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function getClosestDateToToday(values: string[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let closest: string | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const value of values) {
    const parsed = parseLocalYmd(value);
    if (!parsed) {
      continue;
    }

    const distance = Math.abs(parsed.getTime() - today.getTime());
    if (distance < closestDistance) {
      closest = value;
      closestDistance = distance;
    }
  }

  return closest;
}

function formatMonthDay(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = parseLocalYmd(value);
  if (!parsed) {
    return value;
  }

  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

export default function EmailDownloaderScreen() {
  const navigate = useNavigate();
  const [folders, setFolders] = useState<EmailFolderOption[]>([]);
  const [folderIndex, setFolderIndex] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [dateValue, setDateValue] = useState("all");
  const [moveAfter, setMoveAfter] = useState(true);
  const [destFolderIndex, setDestFolderIndex] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDates, setLoadingDates] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<EmailDownloadResult | null>(null);
  const [lastUploadedDate, setLastUploadedDate] = useState<string | null>(null);
  const [controlStatus, setControlStatus] = useState<DownloadStatus>("ready");

  useEffect(() => {
    async function loadFolders() {
      try {
        const items = await getEmailDownloaderFolders();
        setFolders(items);

        const preferredSource = items.find((folder) => folder.name === DEFAULT_SOURCE_FOLDER_NAME) || null;
        const preferredDestination = items.find((folder) => folder.name === DEFAULT_DEST_FOLDER_NAME) || null;
        const folderPriority = preferredSource
          ? [preferredSource, ...items.filter((folder) => folder.index !== preferredSource.index)]
          : items;

        let initialFolder = folderPriority[0] || null;
        let initialDates: string[] = [];
        let lastDateError: string | null = null;

        for (const folder of folderPriority) {
          try {
            const folderDates = await getEmailDownloaderDates(folder.index);
            initialFolder = folder;
            initialDates = folderDates;
            if (folderDates.length > 0) {
              break;
            }
          } catch (error) {
            lastDateError = error instanceof Error ? error.message : "Failed to load dates";
          }
        }

        if (initialFolder) {
          setFolderIndex(String(initialFolder.index));
          setDates(initialDates);
        }

        if (preferredDestination) {
          setDestFolderIndex(String(preferredDestination.index));
        }

        try {
          const uploadedDate = await getEmailDownloaderLastUploadedDate();
          setLastUploadedDate(uploadedDate);
        } catch {
          setLastUploadedDate(null);
        }

        setError(initialDates.length > 0 ? null : lastDateError);
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
    if (destFolderIndex && destFolderIndex !== folderIndex && folders.some((folder) => String(folder.index) === destFolderIndex)) {
      return;
    }

    const preferredFolder = folders.find((folder) => folder.name === DEFAULT_DEST_FOLDER_NAME);
    const nextFolder = folders.find((folder) => String(folder.index) !== folderIndex);
    setDestFolderIndex(String((preferredFolder || nextFolder)?.index || ""));
  }, [moveAfter, folderIndex, destFolderIndex, folders]);

  const selectedFolderName = useMemo(() => {
    return folders.find((folder) => String(folder.index) === folderIndex)?.name || "Select a folder";
  }, [folders, folderIndex]);

  const closestDateToToday = useMemo(() => formatMonthDay(getClosestDateToToday(dates)), [dates]);

  const sidebarCardMeta = useMemo(() => {
    const availableDates = loadingDates ? "Loading..." : `${dates.length} available date${dates.length === 1 ? "" : "s"}`;
    const uploadedDate = lastUploadedDate || "No email uploads yet";
    return `Available dates: ${availableDates}\nLast uploaded: ${uploadedDate}`;
  }, [dates.length, lastUploadedDate, loadingDates]);

  const controlStatusLabel = getControlStatusLabel(controlStatus);
  const controlStatusStyle = getControlStatusStyle(controlStatus);

  async function handleRun() {
    if (!folderIndex) {
      setError("Please choose a folder first.");
      setControlStatus("error");
      return;
    }

    if (moveAfter && !destFolderIndex) {
      setError("Please choose a destination folder or turn off move after download.");
      setControlStatus("error");
      return;
    }

    setRunning(true);
    setError(null);
    setMessage("Running email downloader...");
    setResult(null);
    setControlStatus("running");

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
      setControlStatus("success");
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Failed to run email downloader");
      setControlStatus("error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <AdminShell
      onBack={() => navigate("/")}
      backButtonFirst
      sidebarCopy="A focused workspace for choosing the download folder, the day bundle, and the move target through the project."
      sidebarTopCard={
        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Date closest to today</div>
          <div style={adminStyles.sidebarCardValue}>{loadingDates ? "Loading..." : closestDateToToday || "No dates found"}</div>
          <div style={adminStyles.sidebarCardMeta}>Nearest received date in the selected inbox folder.</div>
        </div>
      }
      sidebarCardLabel="Selected folder"
      sidebarCardValue={selectedFolderName}
      sidebarCardMeta={sidebarCardMeta}
      ribbonTitle="Email Downloader"
      useGlobalMenuFallback={false}
    >
      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Email downloader</div>
            <p style={adminStyles.subtitle}>
              The Christine Tracy folders are prefilled, but you can switch them if you need a different mailbox path.
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
            <div style={emailStyles.sectionHeaderAside}>
              <span style={{ ...emailStyles.statusPill, ...controlStatusStyle }} aria-live="polite">
                {controlStatusLabel}
              </span>
              <div style={adminStyles.sectionMeta}>
                The downloader keeps its original vetting behavior, but now it runs through the project.
              </div>
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
                onChange={(event) => {
                  setFolderIndex(event.target.value);
                  setControlStatus("ready");
                }}
                disabled={loading || folders.length === 0}
              >
                {folders.map((folder) => (
                  <option key={folder.index} value={folder.index}>
                    {folder.name}{folder.name === DEFAULT_SOURCE_FOLDER_NAME ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label style={emailStyles.field}>
              <span style={emailStyles.label}>Day Bundle</span>
              <select
                style={emailStyles.select}
                value={dateValue}
                onChange={(event) => {
                  setDateValue(event.target.value);
                  setControlStatus("ready");
                }}
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
                onChange={(event) => {
                  setMoveAfter(event.target.checked);
                  setControlStatus("ready");
                }}
              />
              <span>Move processed emails after download</span>
            </label>

            <label style={emailStyles.field}>
              <span style={emailStyles.label}>Destination Folder</span>
              <select
                style={emailStyles.select}
                value={destFolderIndex}
                onChange={(event) => {
                  setDestFolderIndex(event.target.value);
                  setControlStatus("ready");
                }}
                disabled={!moveAfter || folders.length === 0}
              >
                <option value="">Select destination</option>
                {folders
                  .filter((folder) => String(folder.index) !== folderIndex)
                  .map((folder) => (
                    <option key={folder.index} value={folder.index}>
                      {folder.name}{folder.name === DEFAULT_DEST_FOLDER_NAME ? " (default)" : ""}
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
    </AdminShell>
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
  sectionHeaderAside: {
    display: "grid",
    justifyItems: "end",
    gap: "8px",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "28px",
    padding: "0 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
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
