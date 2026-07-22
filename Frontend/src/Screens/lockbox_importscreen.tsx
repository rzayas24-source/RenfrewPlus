import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { styles as adminStyles } from "./adminscreen";
import { WorklistBrandButton } from "../worklist/worklist";
import {
  approveLockboxStage,
  transformLockboxStage,
  uploadLockboxSearchResults,
  vetLockboxStage,
  type LockboxApprovalResponse,
  type LockboxTransformResponse,
  type LockboxVetResponse,
} from "../api/lockbox_import_api";
import { getBankingSpreadsheet } from "../api/banking_api";

type LockboxImportMetric = {
  label: string;
  value: string;
  detail: string;
};

export default function LockboxImportScreen() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    kind: "success" | "error" | null;
    text: string;
  }>({ kind: null, text: "" });
  const [selectedFileName, setSelectedFileName] = useState("");
  const [transforming, setTransforming] = useState(false);
  const [transformStatus, setTransformStatus] = useState<{
    kind: "success" | "error" | null;
    text: string;
  }>({ kind: null, text: "" });
  const [transformResult, setTransformResult] = useState<LockboxTransformResponse | null>(null);
  const [vetting, setVetting] = useState(false);
  const [vetStatus, setVetStatus] = useState<{
    kind: "success" | "warning" | "error" | "info" | null;
    text: string;
  }>({ kind: null, text: "" });
  const [vetPreview, setVetPreview] = useState<LockboxVetResponse | null>(null);
  const [approving, setApproving] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<{
    kind: "success" | "error" | "warning" | null;
    text: string;
  }>({ kind: null, text: "" });
  const [approvalResult, setApprovalResult] = useState<LockboxApprovalResponse | null>(null);
  const [denyConfirmText, setDenyConfirmText] = useState("");
  const [lastLockboxDate, setLastLockboxDate] = useState("Loading...");

  const metrics: LockboxImportMetric[] = [
    {
      label: "Mode",
      value: "Lockbox import",
      detail: "A calm place for bringing lockbox rows into the workflow.",
    },
    {
      label: "Focus",
      value: "Staging + review",
      detail: "Keep lockbox import visible without changing the shell language.",
    },
    {
      label: "Style",
      value: "Matches import",
      detail: "Same cards, same spacing, same soft shell treatment.",
    },
  ];

  const openFilePicker = () => {
    setUploadStatus({ kind: null, text: "" });
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setSelectedFileName(file.name);
    setUploading(true);
    setUploadStatus({ kind: null, text: "" });

    try {
      const response = await uploadLockboxSearchResults(file);
      setUploadStatus({
        kind: "success",
        text: `Lockbox import successful. ${response.rowsLoaded} row(s) loaded from ${response.filename}.`,
      });
    } catch (error) {
      setUploadStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Lockbox import failed",
      });
    } finally {
      setUploading(false);
    }
  };

  const runTransform = async () => {
    setTransforming(true);
    setTransformStatus({ kind: null, text: "" });

    try {
      const response = await transformLockboxStage();
      setTransformResult(response);
      setTransformStatus({
        kind: "success",
        text: `${response.statusTag}: ${response.rowsStaged} row(s) staged into ${response.table}.`,
      });
    } catch (error) {
      setTransformStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Lockbox transform failed",
      });
    } finally {
      setTransforming(false);
    }
  };

  const runVetPreview = async (decision?: "partial" | "reject") => {
    setVetting(true);
    setVetStatus({ kind: null, text: "" });

    try {
      const response = await vetLockboxStage(decision);
      setVetPreview(response);

      if (response.status === "review") {
        setVetStatus({
          kind: "warning",
          text: response.message,
        });
      } else if (response.status === "rejected") {
        setVetStatus({
          kind: "error",
          text: response.message,
        });
      } else {
        setVetStatus({
          kind: "success",
          text: `${response.message} ${response.rowsLoaded ?? response.qualifiedCount} row(s) moved into ${response.table}.`,
        });
      }
    } catch (error) {
      setVetStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Lockbox vetting failed",
      });
    } finally {
      setVetting(false);
    }
  };

  const runApproval = async (decision: "approve" | "deny") => {
    if (decision === "deny" && denyConfirmText.trim().toUpperCase() !== "DENY") {
      setApprovalStatus({
        kind: "warning",
        text: "Type DENY before using the destructive reset.",
      });
      return;
    }

    setApproving(true);
    setApprovalStatus({ kind: null, text: "" });

    try {
      const response = await approveLockboxStage(decision);
      setApprovalResult(response);
      setApprovalStatus({
        kind: response.status === "approved" ? "success" : "warning",
        text: response.message,
      });

      if (response.status === "denied") {
        setUploadStatus({ kind: null, text: "" });
        setTransformStatus({ kind: null, text: "" });
        setVetStatus({ kind: null, text: "" });
        setVetPreview(null);
        setTransformResult(null);
      }
    } catch (error) {
      setApprovalStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Lockbox approval failed",
      });
    } finally {
      setApproving(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadLastLockboxDate = async () => {
      try {
        const response = await getBankingSpreadsheet();
        const lockboxSummary = response.data.summary?.find((item) => item.source === "Lockbox");
        if (active) {
          setLastLockboxDate(lockboxSummary?.lastDate || "No date");
        }
      } catch {
        if (active) {
          setLastLockboxDate("No date");
        }
      }
    };

    void loadLastLockboxDate();

    return () => {
      active = false;
    };
  }, []);

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
          A soft lockbox import console for bringing rows into the workflow with the same calm shell as Import.
        </p>

        <nav style={adminStyles.navStack} aria-label="Lockbox import navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/import")}>
            <span style={adminStyles.navButtonLabel}>Back</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Last Lockbox</div>
          <div style={adminStyles.sidebarCardValue}>{lastLockboxDate}</div>
          <div style={adminStyles.sidebarCardMeta}>
            Pulled from the current banking source summary.
          </div>
        </div>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Today</div>
          <div style={adminStyles.sidebarCardValue}>Lockbox import ready</div>
          <div style={adminStyles.sidebarCardMeta}>
            The same calm shell keeps lockbox work in the same visual family as the import window.
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Lockbox import screen</div>
            <p style={adminStyles.subtitle}>
              A calm workspace for staging lockbox rows, checking progress, and following import work through the system.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.primaryButton} type="button" onClick={() => navigate("/import")}>
                Open Import
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={openFilePicker} disabled={uploading}>
                {uploading ? "Uploading..." : "Upload SearchResults.xls"}
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/attachments")}>
                Open Pending
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/banking")}>
                Open Banking
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx"
              onChange={(event) => void handleFileChange(event)}
              style={lockboxImportStyles.hiddenInput}
            />
            <div style={lockboxImportStyles.uploadHint}>
              Choose <strong>SearchResults.xls</strong> from your Downloads folder.
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Lockbox window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Same shell, lockbox focus</div>
              <div style={adminStyles.heroStatusText}>
                This page uses the import styling so the new lockbox area feels native to the workspace.
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
              <div style={adminStyles.sectionKicker}>Import steps</div>
              <h2 style={adminStyles.sectionTitle}>Phase 1 - Obtain</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              Follow these steps to pull the Excel export from Wells Fargo.
            </div>
          </div>

          <article style={lockboxImportStyles.instructionsCard}>
            <ol style={lockboxImportStyles.instructionsList}>
              <li>Sign into <strong>www.wellsfargo.com</strong>, Commercial Banking.</li>
              <li>Select Deposits then Lockbox.</li>
              <li>Enter Range, never use current day, then click Search.</li>
              <li>Under Search Results, in the first column, click Select all transactions, then click Download.</li>
              <li>For Download History, set Content to All results and Format to Excel, then click Continue.</li>
              <li><strong>SearchResults.xls</strong> will be in your Downloads folder.</li>
            </ol>
          </article>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Phase 2</div>
              <h2 style={adminStyles.sectionTitle}>Load</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              Select the downloaded file and let the app stage it into the lockbox load table.
            </div>
          </div>

          <article style={lockboxImportStyles.uploadCard}>
            <div style={lockboxImportStyles.uploadRow}>
              <button style={adminStyles.primaryButton} type="button" onClick={openFilePicker} disabled={uploading}>
                {uploading ? "Uploading..." : "Select SearchResults.xls"}
              </button>
              <div style={lockboxImportStyles.uploadMeta}>
                {selectedFileName ? `Selected: ${selectedFileName}` : "No file selected yet."}
              </div>
            </div>

            {uploadStatus.kind && (
              <div
                style={{
                  ...lockboxImportStyles.statusChip,
                  ...(uploadStatus.kind === "success" ? lockboxImportStyles.statusSuccess : lockboxImportStyles.statusError),
                }}
              >
                {uploadStatus.text}
              </div>
            )}

            <div style={lockboxImportStyles.uploadNote}>
              The uploaded file is staged into <strong>LockboxLoad</strong> so it is ready for the next import step.
            </div>
          </article>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Phase 3</div>
              <h2 style={adminStyles.sectionTitle}>Stage</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              This step stamps batch number, transaction number, and date-time before the duplicate vetting pass.
            </div>
          </div>

          <article style={lockboxImportStyles.vetCard}>
            <div style={lockboxImportStyles.uploadRow}>
              <button
                style={adminStyles.primaryButton}
                type="button"
                onClick={() => void runTransform()}
                disabled={transforming}
              >
                {transforming ? "Transforming..." : "Run Staging"}
              </button>
              <div style={lockboxImportStyles.uploadMeta}>
                {transformResult
                  ? `Batch ${transformResult.batchnum}, trans ${transformResult.startTransnum} - ${transformResult.endTransnum}.`
                  : "Run this after upload so the staged rows get their metadata."}
              </div>
            </div>

            {transformStatus.kind && (
              <div
                style={{
                  ...lockboxImportStyles.statusChip,
                  ...(transformStatus.kind === "success"
                    ? lockboxImportStyles.statusSuccess
                    : lockboxImportStyles.statusError),
                }}
              >
                {transformStatus.text}
              </div>
            )}

            <div style={lockboxImportStyles.uploadNote}>
              The transform step writes each row into <strong>LockboxStage</strong> and stamps the current date and time.
            </div>
          </article>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Phase 4</div>
              <h2 style={adminStyles.sectionTitle}>Vett</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              This step checks for duplicates, collapses the duplicate output, and lets you choose partial upload or full rejection.
            </div>
          </div>

          <article style={lockboxImportStyles.vetCard}>
            <div style={lockboxImportStyles.uploadRow}>
              <button
                style={adminStyles.primaryButton}
                type="button"
                onClick={() => void runVetPreview()}
                disabled={vetting}
              >
                {vetting ? "Vetting..." : "Run Vetting"}
              </button>
              <div style={lockboxImportStyles.uploadMeta}>
                {vetPreview ? `Last run: ${vetPreview.totalRows} row(s) checked.` : "Run vetting after the transform step."}
              </div>
            </div>

            {vetStatus.kind && (
              <div
                style={{
                  ...lockboxImportStyles.statusChip,
                  ...(vetStatus.kind === "success"
                    ? lockboxImportStyles.statusSuccess
                    : vetStatus.kind === "warning"
                      ? lockboxImportStyles.statusWarning
                      : vetStatus.kind === "error"
                        ? lockboxImportStyles.statusError
                        : lockboxImportStyles.statusInfo),
                }}
              >
                {vetStatus.text}
              </div>
            )}

            {vetPreview && vetPreview.duplicateCount > 0 && (
              <details style={lockboxImportStyles.duplicateDetails}>
                <summary style={lockboxImportStyles.duplicateSummary}>
                  Duplicate matches found: {vetPreview.duplicateCount}
                  {vetPreview.allDuplicates ? " - file will be rejected" : ` - ${vetPreview.qualifiedCount} row(s) can still qualify`}
                </summary>
                <div style={lockboxImportStyles.duplicatePanel}>
                  <div style={lockboxImportStyles.duplicateMeta}>
                    The rows below matched existing lockbox data. They stay hidden until you expand the section again.
                  </div>
                  <div style={lockboxImportStyles.duplicateList}>
                    {vetPreview.duplicateRows.map((row) => (
                      <article key={`${row.row}-${row.checkNumber}-${row.transactionNumber}`} style={lockboxImportStyles.duplicateRow}>
                        <div style={lockboxImportStyles.duplicateRowTitle}>
                          Row {row.row}
                        </div>
                        <div style={lockboxImportStyles.duplicateRowGrid}>
                          <div><strong>Check:</strong> {row.checkNumber || "Blank"}</div>
                          <div><strong>Trans:</strong> {row.transactionNumber || "Blank"}</div>
                          <div><strong>Date:</strong> {row.depositDate || "Blank"}</div>
                          <div><strong>Payor:</strong> {row.payor || "Blank"}</div>
                          <div><strong>Amount:</strong> {row.checkAmount || "Blank"}</div>
                          <div><strong>Status:</strong> {row.status || "Blank"}</div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </details>
            )}

            {vetPreview?.decisionRequired && (
              <div style={lockboxImportStyles.decisionRow}>
                <button
                  style={adminStyles.primaryButton}
                  type="button"
                  onClick={() => void runVetPreview("partial")}
                  disabled={vetting}
                >
                  Allow Partial Upload
                </button>
                <button
                  style={adminStyles.secondaryButton}
                  type="button"
                  onClick={() => void runVetPreview("reject")}
                  disabled={vetting}
                >
                  Reject File
                </button>
              </div>
            )}

            <div style={lockboxImportStyles.uploadNote}>
              Clean rows move into <strong>LockboxVett</strong>. When every row is a duplicate, the file is rejected automatically.
            </div>
          </article>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Phase 5</div>
              <h2 style={adminStyles.sectionTitle}>Approval</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              Approve to write vetted rows into Lockbox, or deny to clear the working tables and reset the status notes.
            </div>
          </div>

          <article style={lockboxImportStyles.vetCard}>
            <div style={lockboxImportStyles.uploadRow}>
              <button
                style={adminStyles.primaryButton}
                type="button"
                onClick={() => void runApproval("approve")}
                disabled={approving}
              >
                {approving ? "Processing..." : "Approve"}
              </button>
              <button
                style={adminStyles.secondaryButton}
                type="button"
                onClick={() => void runApproval("deny")}
                disabled={approving}
              >
                Deny
              </button>
              <div style={lockboxImportStyles.uploadMeta}>
                {approvalResult?.status === "approved"
                  ? `${approvalResult.rowsApproved ?? 0} row(s) written to Lockbox.`
                  : "Approval is the final handoff step."}
              </div>
            </div>

            <div style={lockboxImportStyles.denyGate}>
              <label style={lockboxImportStyles.denyLabel} htmlFor="deny-confirm">
                Type DENY to clear LockboxLoad, LockboxStage, and LockboxVett
              </label>
              <input
                id="deny-confirm"
                type="text"
                value={denyConfirmText}
                onChange={(event) => setDenyConfirmText(event.target.value)}
                placeholder="DENY"
                style={lockboxImportStyles.denyInput}
              />
            </div>

            {approvalStatus.kind && (
              <div
                style={{
                  ...lockboxImportStyles.statusChip,
                  ...(approvalStatus.kind === "success"
                    ? lockboxImportStyles.statusSuccess
                    : approvalStatus.kind === "warning"
                      ? lockboxImportStyles.statusWarning
                      : lockboxImportStyles.statusError),
                }}
              >
                {approvalStatus.text}
              </div>
            )}

            <div style={lockboxImportStyles.uploadNote}>
              Approved rows are written into <strong>Lockbox</strong>, and the status chip updates to show the final decision.
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

const lockboxImportStyles: Record<string, CSSProperties> = {
  hiddenInput: {
    display: "none",
  },
  uploadHint: {
    marginTop: "12px",
    fontSize: "13px",
    color: "#5b6f84",
    fontWeight: 600,
  },
  instructionsCard: {
    borderRadius: "24px",
    padding: "20px 22px",
    background: "linear-gradient(145deg, rgba(248, 252, 255, 0.98), rgba(255, 247, 250, 0.96))",
    border: "1px solid rgba(175, 193, 218, 0.22)",
    boxShadow: "0 14px 28px rgba(111, 146, 196, 0.08)",
  },
  instructionsList: {
    margin: 0,
    paddingLeft: "22px",
    display: "grid",
    gap: "12px",
    color: "#23415f",
    fontSize: "14px",
    lineHeight: 1.65,
    fontWeight: 600,
  },
  uploadCard: {
    borderRadius: "24px",
    padding: "20px 22px",
    background: "linear-gradient(145deg, rgba(248, 252, 255, 0.98), rgba(255, 247, 250, 0.96))",
    border: "1px solid rgba(175, 193, 218, 0.22)",
    boxShadow: "0 14px 28px rgba(111, 146, 196, 0.08)",
    display: "grid",
    gap: "14px",
  },
  vetCard: {
    borderRadius: "24px",
    padding: "20px 22px",
    background: "linear-gradient(145deg, rgba(248, 252, 255, 0.98), rgba(255, 247, 250, 0.96))",
    border: "1px solid rgba(175, 193, 218, 0.22)",
    boxShadow: "0 14px 28px rgba(111, 146, 196, 0.08)",
    display: "grid",
    gap: "14px",
  },
  uploadRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "14px",
  },
  uploadMeta: {
    fontSize: "13px",
    color: "#597085",
    fontWeight: 700,
  },
  statusChip: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "34px",
    width: "fit-content",
    padding: "0 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.06em",
  },
  statusSuccess: {
    background: "rgba(224, 244, 230, 0.96)",
    color: "#245234",
    border: "1px solid rgba(122, 184, 143, 0.35)",
  },
  statusWarning: {
    background: "rgba(255, 245, 210, 0.96)",
    color: "#735d16",
    border: "1px solid rgba(214, 186, 94, 0.35)",
  },
  statusInfo: {
    background: "rgba(232, 242, 255, 0.96)",
    color: "#23415f",
    border: "1px solid rgba(140, 173, 216, 0.35)",
  },
  statusError: {
    background: "rgba(255, 235, 235, 0.96)",
    color: "#7d2f2f",
    border: "1px solid rgba(214, 140, 140, 0.35)",
  },
  uploadNote: {
    fontSize: "13px",
    color: "#5b6f84",
    lineHeight: 1.6,
  },
  duplicateDetails: {
    borderRadius: "20px",
    border: "1px solid rgba(175, 193, 218, 0.22)",
    background: "rgba(255, 255, 255, 0.8)",
    padding: "12px 14px",
  },
  duplicateSummary: {
    cursor: "pointer",
    listStyle: "none",
    fontSize: "13px",
    fontWeight: 800,
    color: "#23415f",
  },
  duplicatePanel: {
    marginTop: "12px",
    display: "grid",
    gap: "12px",
  },
  duplicateMeta: {
    fontSize: "13px",
    color: "#5b6f84",
    fontWeight: 600,
    lineHeight: 1.5,
  },
  duplicateList: {
    display: "grid",
    gap: "10px",
    maxHeight: "280px",
    overflowY: "auto",
    paddingRight: "4px",
  },
  duplicateRow: {
    borderRadius: "16px",
    border: "1px solid rgba(175, 193, 218, 0.18)",
    background: "rgba(248, 252, 255, 0.92)",
    padding: "12px 14px",
    display: "grid",
    gap: "8px",
  },
  duplicateRowTitle: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#23415f",
  },
  duplicateRowGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "8px 12px",
    fontSize: "12px",
    color: "#37516a",
    lineHeight: 1.5,
  },
  decisionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    alignItems: "center",
  },
  denyGate: {
    display: "grid",
    gap: "8px",
    maxWidth: "360px",
  },
  denyLabel: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#37516a",
    letterSpacing: "0.02em",
  },
  denyInput: {
    width: "100%",
    borderRadius: "16px",
    border: "1px solid rgba(175, 193, 218, 0.4)",
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: 700,
    color: "#23415f",
    background: "rgba(255, 255, 255, 0.96)",
    outline: "none",
  },
};



