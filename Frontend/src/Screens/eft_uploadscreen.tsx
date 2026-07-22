import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { styles as adminStyles } from "./adminscreen";
import {
  approveEftStage,
  transformEftStage,
  uploadEftWorkbook,
  vetEftStage,
  type EftApprovalResponse,
  type EftVetResponse,
} from "../api/eft_upload_api";
import { getBankingSpreadsheet } from "../api/banking_api";

const phaseOneSteps = [
  "Sign into www.wellsfargo.com, Commercial Banking.",
  "Select Reports & Insight.",
  "Select Previous Day Composite, then change Action to Edit Creteria.",
  "Enter your range, never use your current day, then click Run.",
];

type StatusKind = "idle" | "success" | "error";

export default function EFTUploadScreen() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [lastEftDate, setLastEftDate] = useState("Loading...");
  const [loading, setLoading] = useState(false);
  const [rowsLoaded, setRowsLoaded] = useState<number | null>(null);
  const [status, setStatus] = useState<{ kind: StatusKind; text: string }>({
    kind: "idle",
    text: "Choose a DEP_1101_TRAN workbook to load EFTLoad.",
  });
  const [staging, setStaging] = useState(false);
  const [stageRows, setStageRows] = useState<number | null>(null);
  const [stageStatus, setStageStatus] = useState<{ kind: StatusKind; text: string }>({
    kind: "idle",
    text: "Run staging after EFTLoad is ready.",
  });
  const [vetting, setVetting] = useState(false);
  const [vetStatus, setVetStatus] = useState<{ kind: StatusKind; text: string }>({
    kind: "idle",
    text: "Run vetting after staging is complete.",
  });
  const [vetPreview, setVetPreview] = useState<EftVetResponse | null>(null);
  const [approvaling, setApprovaling] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<{ kind: StatusKind; text: string }>({
    kind: "idle",
    text: "Approve the vetted EFT rows or reject the upload.",
  });
  const [approvalPreview, setApprovalPreview] = useState<EftApprovalResponse | null>(null);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const refreshLastEftDate = async () => {
    try {
      const response = await getBankingSpreadsheet();
      const eftSummary = response.data.summary?.find((item) => item.source === "EFT");
      setLastEftDate(eftSummary?.lastDate || "No date");
    } catch {
      setLastEftDate("No date");
    }
  };

  useEffect(() => {
    void refreshLastEftDate();
  }, []);

  const resetEftWorkflow = () => {
    setSelectedFileName("");
    setRowsLoaded(null);
    setStageRows(null);
    setVetPreview(null);
    setStatus({
      kind: "idle",
      text: "Choose a DEP_1101_TRAN workbook to load EFTLoad.",
    });
    setStageStatus({
      kind: "idle",
      text: "Run staging after EFTLoad is ready.",
    });
    setVetStatus({
      kind: "idle",
      text: "Run vetting after staging is complete.",
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.name.startsWith("DEP_1101_TRAN")) {
      setSelectedFileName(file.name);
      setRowsLoaded(null);
      setStatus({
        kind: "error",
        text: "Please select DEP_1101_TRAN.xlsx or DEP_1101_TRAN.xls.",
      });
      return;
    }

    setSelectedFileName(file.name);
    setApprovalPreview(null);
    setApprovalStatus({
      kind: "idle",
      text: "Approve the vetted EFT rows or reject the upload.",
    });
    setRowsLoaded(null);
    setLoading(true);
    setStatus({
      kind: "idle",
      text: "Loading workbook into EFTLoad...",
    });

    try {
      const response = await uploadEftWorkbook(file);
      setRowsLoaded(response.rowsLoaded);
      setStatus({
        kind: "success",
        text: `${response.statusTag}: ${response.rowsLoaded} rows loaded into EFTLoad.`,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "EFT load failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  const runStage = async () => {
    setStaging(true);
    setStageRows(null);
    setStageStatus({
      kind: "idle",
      text: "Bringing EFTLoad fields into EFTStage...",
    });

    try {
      const response = await transformEftStage();
      setStageRows(response.rowsStaged);
      setStageStatus({
        kind: "success",
        text: `${response.statusTag}: ${response.rowsStaged} rows staged into ${response.table}.`,
      });
    } catch (error) {
      setStageStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "EFT staging failed.",
      });
    } finally {
      setStaging(false);
    }
  };

  const runVet = async () => {
    setVetting(true);
    setVetStatus({
      kind: "idle",
      text: "Checking EFTStage rows against existing EFT dates...",
    });
    setVetPreview(null);

    try {
      const response = await vetEftStage();
      setVetPreview(response);
      setVetStatus({
        kind: response.blockedCount > 0 ? "error" : "success",
        text: response.message,
      });
    } catch (error) {
      setVetStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "EFT vetting failed.",
      });
    } finally {
      setVetting(false);
    }
  };

  const runApproval = async (decision: "approve" | "approve_partial" | "deny") => {
    setApprovaling(true);
    setApprovalPreview(null);
    setApprovalStatus({
      kind: "idle",
      text:
        decision === "deny"
          ? "Resetting EFTLoad, EFTStage, and EFTVett..."
          : decision === "approve_partial"
            ? "Approving the clean EFT rows only..."
            : "Approving the vetted EFT rows...",
    });

    try {
      const response = await approveEftStage(decision);
      setApprovalPreview(response);
      setApprovalStatus({
        kind: response.status === "approved" ? "success" : decision === "deny" ? "error" : "success",
        text: response.message,
      });

      resetEftWorkflow();

      if (response.status === "approved") {
        await refreshLastEftDate();
      }
    } catch (error) {
      setApprovalStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "EFT approval failed.",
      });
    } finally {
      setApprovaling(false);
    }
  };

  return (
    <main style={adminStyles.shell}>
      <div style={adminStyles.glowBlue} />
      <div style={adminStyles.glowPink} />

      <aside style={adminStyles.sidebar}>
        <div style={adminStyles.brandWrap}>
          <div style={adminStyles.brandMark} aria-hidden="true">
            <img src="/favicon.svg" alt="" style={adminStyles.brandMarkImage} />
          </div>
          <div style={adminStyles.brandWomenMark} aria-hidden="true">
            <img src="/renfrew-gazebo.png" alt="" style={adminStyles.brandWomenImage} />
          </div>
        </div>

        <p style={adminStyles.sidebarCopy}>
          EFT upload workspace in the same shell family as Import.
        </p>

        <nav style={adminStyles.navStack} aria-label="EFT upload navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/import")}>
            <span style={adminStyles.navButtonLabel}>Back</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Last EFT</div>
          <div style={adminStyles.sidebarCardValue}>{lastEftDate}</div>
          <div style={adminStyles.sidebarCardMeta}>
            Pulled from the current EFT table summary.
          </div>
        </div>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Today</div>
          <div style={adminStyles.sidebarCardValue}>EFT upload ready</div>
          <div style={adminStyles.sidebarCardMeta}>
            This screen is ready for upload logic, but for now it stays focused on layout and navigation.
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>EFT upload workspace</div>
            <p style={adminStyles.subtitle}>
              Load DEP_1101_TRAN.xlsx into EFTLoad, review the imported workbook, and keep the staging controls below for the
              next step.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.primaryButton} type="button" onClick={runStage} disabled={staging}>
                {staging ? "Staging..." : "Load to Staging"}
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/import")}>
                Back to Import
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>{stageStatus.kind === "idle" ? "Upload ready" : stageStatus.kind.toUpperCase()}</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Upload workbook to EFTLoad</div>
              <div style={adminStyles.heroStatusText}>
                Choose the DEP_1101_TRAN workbook, load it into EFTLoad, and use the staging section below when you are ready
                to move those rows forward.
              </div>
            </div>
          </div>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Phase one</div>
              <h2 style={adminStyles.sectionTitle}>Obtain</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              Follow these steps to pull the Excel export from Wells Fargo.
            </div>
          </div>

          <div style={adminStyles.widgetGrid}>
            <article
              style={{
                ...adminStyles.widgetCard,
                gridColumn: "1 / -1",
                cursor: "default",
              }}
            >
              <div style={adminStyles.widgetTop}>
                <div style={adminStyles.widgetBadge}>Phase 1 - Obtain</div>
              </div>
              <div style={adminStyles.widgetBody}>
                <div style={adminStyles.widgetTitle}>Steps to download DEP_1101_TRAN.xlsx</div>
                <div style={adminStyles.widgetMeta}>
                  {phaseOneSteps.map((step, index) => (
                    <div key={step} style={{ marginBottom: index === phaseOneSteps.length - 1 ? 0 : "10px" }}>
                      {index + 1}. {step}
                    </div>
                  ))}
                </div>
              </div>
              <div style={adminStyles.widgetAction}>
                <strong>DEP_1101_TRAN.xlsx</strong> will be in your Downloads folder.
              </div>
            </article>
          </div>

          <div style={adminStyles.widgetGrid}>
            <article
              style={{
                ...adminStyles.widgetCard,
                gridColumn: "1 / -1",
                cursor: "default",
              }}
            >
              <div style={adminStyles.widgetTop}>
                <div style={adminStyles.widgetBadge}>Phase 2 - Load</div>
              </div>
              <div style={adminStyles.widgetBody}>
                <div style={adminStyles.widgetTitle}>Load</div>
                <div style={adminStyles.widgetMeta}>
                  Choose DEP_1101_TRAN. The browser file picker opens from this button. After you choose the workbook, the
                  data is loaded into EFTLoad and the status chip updates below.
                </div>
                <div style={styles.loadMetaRow}>
                  <button style={adminStyles.primaryButton} type="button" onClick={openFilePicker} disabled={loading}>
                    {loading ? "Loading..." : "Open File Picker"}
                  </button>
                  <div style={styles.fileMeta}>
                    <div style={styles.fileLabel}>Selected file</div>
                    <div style={styles.fileValue}>{selectedFileName || "None selected"}</div>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xls,.xlsx"
                  multiple={false}
                  onChange={(event) => void handleFileChange(event)}
                  style={styles.hiddenInput}
                />
              </div>
              <div style={adminStyles.widgetAction}>
                <span style={getStatusChipStyle(status.kind)}>{status.kind.toUpperCase()}</span>
                <span style={styles.statusText}>{status.text}</span>
                <span style={styles.rowsText}>
                  {rowsLoaded === null ? "Rows: waiting" : `Rows loaded: ${rowsLoaded}`}
                </span>
              </div>
            </article>
          </div>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Phase three</div>
              <h2 style={adminStyles.sectionTitle}>Stage</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              Map the EFT load fields into the staging table, then parse the remittance text before the next review step.
            </div>
          </div>

          <div style={adminStyles.widgetGrid}>
            <article
              style={{
                ...adminStyles.widgetCard,
                gridColumn: "1 / -1",
                cursor: "default",
              }}
            >
              <div style={adminStyles.widgetTop}>
                <div style={adminStyles.widgetBadge}>Phase 3 - Stage</div>
              </div>
              <div style={adminStyles.widgetBody}>
                <div style={adminStyles.widgetTitle}>Field mapping to EFTStage</div>
                <div style={adminStyles.widgetMeta}>
                  <div style={styles.mappingRow}>
                    <span style={styles.mappingLabel}>As-Of Date</span>
                    <span style={styles.mappingArrow}>=</span>
                    <span style={styles.mappingValue}>Date</span>
                  </div>
                  <div style={styles.mappingRow}>
                    <span style={styles.mappingLabel}>Credit Amt</span>
                    <span style={styles.mappingArrow}>=</span>
                    <span style={styles.mappingValue}>Amount</span>
                  </div>
                  <div style={styles.mappingRow}>
                    <span style={styles.mappingLabel}>Descriptive Text 1</span>
                    <span style={styles.mappingArrow}>=</span>
                    <span style={styles.mappingValue}>Descriptive Text 1</span>
                  </div>
                </div>
                <div style={styles.stageButtonRow}>
                  <button style={adminStyles.primaryButton} type="button" onClick={runStage} disabled={staging}>
                    {staging ? "Staging..." : "Load to Staging"}
                  </button>
                </div>
              </div>
              <div style={adminStyles.widgetAction}>
                <span style={getStatusChipStyle(stageStatus.kind)}>{stageStatus.kind.toUpperCase()}</span>
                <span style={styles.statusText}>{stageStatus.text}</span>
                <span style={styles.rowsText}>
                  {stageRows === null ? "Rows staged: waiting" : `Rows staged: ${stageRows}`}
                </span>
              </div>
            </article>
          </div>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Phase four</div>
              <h2 style={adminStyles.sectionTitle}>Vett</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              Duplicates are blocked from EFTVett, blank payer rows are skipped, and the blocked rows are shown below.
            </div>
          </div>

          <div style={adminStyles.widgetGrid}>
            <article
              style={{
                ...adminStyles.widgetCard,
                gridColumn: "1 / -1",
                cursor: "default",
              }}
            >
              <div style={adminStyles.widgetTop}>
                <div style={adminStyles.widgetBadge}>Phase 4 - Vett</div>
              </div>
              <div style={adminStyles.widgetBody}>
                <div style={adminStyles.widgetTitle}>Block duplicate dates and blank payers</div>
                <div style={adminStyles.widgetMeta}>
                  Run this after staging. Rows with duplicate dates already present in EFT are blocked, and rows with blank payer
                  values are not moved into EFTVett.
                </div>
                <div style={styles.stageButtonRow}>
                  <button style={adminStyles.primaryButton} type="button" onClick={runVet} disabled={vetting}>
                    {vetting ? "Vetting..." : "Run Vetting"}
                  </button>
                </div>
              </div>
              <div style={adminStyles.widgetAction}>
                <span style={getMetricChipStyle("loaded")}>
                  Loaded {vetPreview ? vetPreview.rowsLoaded : 0}
                </span>
                <span style={getStatusChipStyle(vetStatus.kind)}>
                  {vetPreview && vetPreview.blockedCount > 0
                    ? `BLOCKED ${vetPreview.blockedCount}`
                    : vetStatus.kind.toUpperCase()}
                </span>
                {vetPreview && vetPreview.duplicateCount > 0 && (
                  <span style={getMetricChipStyle("duplicate")}>
                    Dup {vetPreview.duplicateCount}
                  </span>
                )}
                <div style={styles.stackSummary}>
                  {vetPreview ? (
                    <>
                      <div>{`${vetPreview.duplicateCount} duplicate date row(s) blocked,`}</div>
                      <div>{`${vetPreview.blankPayerCount} blank payer row(s) blocked,`}</div>
                      <div>{`${vetPreview.blankDateCount} blank date row(s) blocked.`}</div>
                      <div>{`${vetPreview.blockedCount} unique row(s) blocked.`}</div>
                      <div>{`${vetPreview.rowsLoaded} row(s) loaded into EFTVett.`}</div>
                    </>
                  ) : (
                    <div>Rows: waiting</div>
                  )}
                </div>
              </div>
            </article>
          </div>

          {vetPreview && vetPreview.duplicateRows.length > 0 && (
            <details style={styles.collapsibleDetails}>
              <summary style={styles.collapsibleSummary}>
                Duplicate dates blocked: {vetPreview.duplicateCount}
              </summary>
              <div style={styles.collapsiblePanel}>
                <div style={styles.collapsibleMeta}>
                  These rows matched dates already present in EFT and were blocked from EFTVett.
                </div>
                <div style={styles.collapsibleGrid}>
                  {vetPreview.duplicateRows.map((row) => (
                    <article key={`dup-${row.row}-${row.date}-${row.checkNumber}`} style={styles.blockedRowCard}>
                      <div style={styles.blockedRowTitle}>Row {row.row}</div>
                      <div style={styles.blockedRowGrid}>
                        <div><strong>Date:</strong> {row.date || "Blank"}</div>
                        <div><strong>Payer:</strong> {row.payer || "Blank"}</div>
                        <div><strong>Check:</strong> {row.checkNumber || "Blank"}</div>
                        <div><strong>Amount:</strong> {row.amount || "Blank"}</div>
                        <div><strong>Status:</strong> {row.status}</div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </details>
          )}

          {vetPreview && vetPreview.blankPayerRows.length > 0 && (
            <details style={styles.collapsibleDetails}>
              <summary style={styles.collapsibleSummary}>
                Blank payer rows blocked: {vetPreview.blankPayerCount}
              </summary>
              <div style={styles.collapsiblePanel}>
                <div style={styles.collapsibleMeta}>
                  These rows had no parsed payer value, so they were not moved into EFTVett.
                </div>
                <div style={styles.collapsibleGrid}>
                  {vetPreview.blankPayerRows.map((row) => (
                    <article key={`payer-${row.row}-${row.date}-${row.checkNumber}`} style={styles.blockedRowCard}>
                      <div style={styles.blockedRowTitle}>Row {row.row}</div>
                      <div style={styles.blockedRowGrid}>
                        <div><strong>Date:</strong> {row.date || "Blank"}</div>
                        <div><strong>Payer:</strong> {row.payer || "Blank"}</div>
                        <div><strong>Check:</strong> {row.checkNumber || "Blank"}</div>
                        <div><strong>Amount:</strong> {row.amount || "Blank"}</div>
                        <div><strong>Status:</strong> {row.status}</div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </details>
          )}
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Phase five</div>
              <h2 style={adminStyles.sectionTitle}>Approval</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              Approve the vetted EFT rows into the EFT source of truth, or reject the batch and clear the working tables.
            </div>
          </div>

          <div style={adminStyles.widgetGrid}>
            <article
              style={{
                ...adminStyles.widgetCard,
                gridColumn: "1 / -1",
                cursor: "default",
              }}
            >
              <div style={adminStyles.widgetTop}>
                <div style={adminStyles.widgetBadge}>Phase 5 - Approval</div>
              </div>
              <div style={adminStyles.widgetBody}>
                <div style={adminStyles.widgetTitle}>Write vetted rows to EFT</div>
                <div style={adminStyles.widgetMeta}>
                  Approve the loaded rows to append them into EFT. If duplicates were blocked, Approve Partial writes only the clean
                  rows. Reject clears EFTLoad, EFTStage, and EFTVett.
                </div>
                <div style={styles.approvalButtonRow}>
                  <button
                    style={adminStyles.primaryButton}
                    type="button"
                    onClick={() => void runApproval("approve")}
                    disabled={approvaling || !vetPreview || vetPreview.rowsLoaded === 0}
                  >
                    {approvaling ? "Working..." : "Approve Loaded"}
                  </button>
                  {vetPreview && vetPreview.duplicateCount > 0 && (
                    <button
                      style={adminStyles.secondaryButton}
                      type="button"
                      onClick={() => void runApproval("approve_partial")}
                      disabled={approvaling || vetPreview.rowsLoaded === 0}
                    >
                      Approve Partial
                    </button>
                  )}
                  <button
                    style={{ ...adminStyles.secondaryButton, ...styles.rejectButton }}
                    type="button"
                    onClick={() => void runApproval("deny")}
                    disabled={approvaling || !vetPreview}
                  >
                    Reject Upload
                  </button>
                </div>
              </div>
              <div style={adminStyles.widgetAction}>
                <span style={getStatusChipStyle(approvalStatus.kind)}>
                  {approvalPreview?.statusTag || approvalStatus.kind.toUpperCase()}
                </span>
                <div style={styles.stackSummary}>
                  {approvalPreview ? (
                    <>
                      <div>{approvalPreview.message}</div>
                      <div>{`${approvalPreview.rowsApproved} row(s) appended to EFT.`}</div>
                      <div>{`Tables reset: ${approvalPreview.tablesReset.join(", ")}.`}</div>
                    </>
                  ) : (
                    <div>{approvalStatus.text}</div>
                  )}
                </div>
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}

function getStatusChipStyle(kind: StatusKind): CSSProperties {
  if (kind === "success") {
    return {
      ...styles.statusChip,
      background: "rgba(28, 121, 77, 0.12)",
      color: "#1c794d",
      borderColor: "rgba(28, 121, 77, 0.24)",
    };
  }

  if (kind === "error") {
    return {
      ...styles.statusChip,
      background: "rgba(183, 52, 52, 0.12)",
      color: "#b73434",
      borderColor: "rgba(183, 52, 52, 0.24)",
    };
  }

  return {
    ...styles.statusChip,
    background: "rgba(110, 128, 152, 0.12)",
    color: "#51657d",
    borderColor: "rgba(110, 128, 152, 0.24)",
  };
}

function getMetricChipStyle(kind: "loaded" | "duplicate"): CSSProperties {
  if (kind === "duplicate") {
    return {
      ...styles.statusChip,
      background: "rgba(183, 52, 52, 0.12)",
      color: "#b73434",
      borderColor: "rgba(183, 52, 52, 0.24)",
    };
  }

  return {
    ...styles.statusChip,
    background: "rgba(28, 121, 77, 0.12)",
    color: "#1c794d",
    borderColor: "rgba(28, 121, 77, 0.24)",
  };
}

const styles: Record<string, CSSProperties> = {
  hiddenInput: {
    display: "none",
  },
  loadMetaRow: {
    marginTop: "16px",
    display: "grid",
    gap: "14px",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    alignItems: "center",
  },
  fileMeta: {
    minWidth: 0,
  },
  fileLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#73879c",
    fontWeight: 800,
    marginBottom: "4px",
  },
  fileValue: {
    fontSize: "15px",
    fontWeight: 800,
    color: "#17324f",
    wordBreak: "break-word",
  },
  statusChip: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "28px",
    padding: "0 10px",
    borderRadius: "999px",
    border: "1px solid transparent",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.1em",
  },
  stackSummary: {
    display: "block",
    marginTop: "10px",
    fontSize: "13px",
    lineHeight: 1.55,
    color: "#31455d",
    fontWeight: 700,
    whiteSpace: "normal",
  },
  mappingRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
    gap: "10px",
    alignItems: "center",
    marginBottom: "8px",
  },
  mappingLabel: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#17324f",
  },
  mappingArrow: {
    fontSize: "13px",
    fontWeight: 900,
    color: "#73879c",
  },
  mappingValue: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#1f4c78",
    textAlign: "right",
  },
  stageButtonRow: {
    marginTop: "16px",
  },
  approvalButtonRow: {
    marginTop: "16px",
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  rejectButton: {
    background: "rgba(183, 52, 52, 0.08)",
    color: "#9f2f2f",
    borderColor: "rgba(183, 52, 52, 0.22)",
  },
  collapsibleDetails: {
    marginTop: "16px",
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.88)",
    boxShadow: "0 20px 50px rgba(52, 84, 120, 0.06)",
    overflow: "hidden",
  },
  collapsibleSummary: {
    listStyle: "none",
    cursor: "pointer",
    padding: "16px 18px",
    fontSize: "14px",
    fontWeight: 900,
    color: "#17324f",
    letterSpacing: "0.01em",
  },
  collapsiblePanel: {
    padding: "0 18px 18px",
  },
  collapsibleMeta: {
    fontSize: "13px",
    lineHeight: 1.5,
    color: "#5f738a",
    marginBottom: "14px",
  },
  collapsibleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
  },
  blockedRowCard: {
    borderRadius: "16px",
    border: "1px solid rgba(176, 194, 218, 0.18)",
    background: "linear-gradient(145deg, rgba(255, 236, 244, 0.92), rgba(255, 255, 255, 0.92))",
    padding: "14px",
  },
  blockedRowTitle: {
    fontSize: "13px",
    fontWeight: 900,
    color: "#17324f",
    marginBottom: "10px",
  },
  blockedRowGrid: {
    display: "grid",
    gap: "8px",
    fontSize: "13px",
    lineHeight: 1.45,
    color: "#31455d",
  },
};

