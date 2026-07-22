import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { styles as adminStyles } from "./adminscreen";
import { WorklistBrandButton } from "../worklist/worklist";
import {
  approve835EdiStage,
  load835TrnFiles,
  stage835EdiLoad,
  vet835EdiStage,
  upload835ZipFile,
  type Approve835EdiResponse,
  type Load835TrnResponse,
  type Stage835EdiResponse,
  type Vet835EdiResponse,
  type Upload835ZipResponse,
} from "../api/835_upload_api";
import { getBankingSpreadsheet } from "../api/banking_api";

const phaseSteps = [
  "Sign into https://portal.rpa.optum.com/ws_portal/login.jsp",
  "Reporting and Metrics / Remittance Files",
  "Set Processed date to start 1 month before the populated date",
  "Set File Workflow Status to No Status",
  "Set Results per page to 100",
  "Click Select All, set File type to ANSI 835 (ERA), then click Download Selected files",
  "Click Select All, change File type to Check listing (TRN), then click Download Selected files",
  "Click Select All, change File type to EZ-EOB, then click Download Selected files",
  "Change screen results to show next 100, then repeat steps 6, 7, 8, and 9",
  "Click Select All, click Show bulk update options, change status to Archived, then click Submit",
];

export default function Upload835Screen() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [last835Date, setLast835Date] = useState("Loading...");
  const [loadingZip, setLoadingZip] = useState(false);
  const [selectedZipNames, setSelectedZipNames] = useState<string[]>([]);
  const [zipStatus, setZipStatus] = useState<{
    kind: "idle" | "success" | "error";
    text: string;
  }>({
    kind: "idle",
    text: "Choose the associated zip files to load into 1.TRN, 2.ERA, and 3.HTML.",
  });
  const [zipSummary, setZipSummary] = useState<Upload835ZipResponse | null>(null);
  const [loadingTrn, setLoadingTrn] = useState(false);
  const [trnStatus, setTrnStatus] = useState<{
    kind: "idle" | "success" | "error";
    text: string;
  }>({
    kind: "idle",
    text: "Load the TRN files from the 1.TRN folder into EDILoad.",
  });
  const [trnSummary, setTrnSummary] = useState<Load835TrnResponse | null>(null);
  const [loadingStage, setLoadingStage] = useState(false);
  const [stageStatus, setStageStatus] = useState<{
    kind: "idle" | "success" | "error";
    text: string;
  }>({
    kind: "idle",
    text: "Copy EDILoad into EDIStage after TRN load is ready.",
  });
  const [stageSummary, setStageSummary] = useState<Stage835EdiResponse | null>(null);
  const [loadingVet, setLoadingVet] = useState(false);
  const [vetStatus, setVetStatus] = useState<{
    kind: "idle" | "success" | "error";
    text: string;
  }>({
    kind: "idle",
    text: "Check EDIStage against EDI before moving rows forward.",
  });
  const [vetSummary, setVetSummary] = useState<Vet835EdiResponse | null>(null);
  const [loadingApproval, setLoadingApproval] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<{
    kind: "idle" | "success" | "error";
    text: string;
  }>({
    kind: "idle",
    text: "Approve or deny the vetted EDI rows before they are written into EDI.",
  });
  const [approvalSummary, setApprovalSummary] = useState<Approve835EdiResponse | null>(null);

  const refreshLast835Date = async () => {
    try {
      const response = await getBankingSpreadsheet();
      const ediSummary = response.data.summary?.find((item) => item.source === "EDI");
      setLast835Date(ediSummary?.lastDate || "No date");
    } catch {
      setLast835Date("No date");
    }
  };

  useEffect(() => {
    void refreshLast835Date();
  }, []);

  const resetWorkingPhases = () => {
    setTrnSummary(null);
    setStageSummary(null);
    setVetSummary(null);
    setTrnStatus({
      kind: "idle",
      text: "Load the TRN files from the 1.TRN folder into EDILoad.",
    });
    setStageStatus({
      kind: "idle",
      text: "Copy EDILoad into EDIStage after TRN load is ready.",
    });
    setVetStatus({
      kind: "idle",
      text: "Check EDIStage against EDI before moving rows forward.",
    });
  };

  const processZipFiles = async (files: File[]) => {
    const zipFiles = files.filter((file) => file.name.toLowerCase().endsWith(".zip"));
    if (zipFiles.length === 0) {
      setZipStatus({
        kind: "error",
        text: "Please choose one or more zip files.",
      });
      return;
    }

    setLoadingZip(true);
    setSelectedZipNames(zipFiles.map((file) => file.name));
    setZipSummary(null);

    try {
      const results = await Promise.all(zipFiles.map((file) => upload835ZipFile(file)));
      const totals = results.reduce(
        (acc, result) => {
          acc.trn += result.extractedCounts.trn;
          acc.era += result.extractedCounts.era;
          acc.html += result.extractedCounts.html;
          acc.files += 1;
          return acc;
        },
        { trn: 0, era: 0, html: 0, files: 0 }
      );

      setZipSummary(results[results.length - 1] ?? null);
      const totalBlocked = results.reduce((sum, result) => sum + (result.blockedCount || 0), 0);
      setZipStatus({
        kind: totalBlocked > 0 ? "error" : "success",
        text:
          totalBlocked > 0
            ? `Loaded ${totals.files} zip file(s): ${totals.trn} TRN, ${totals.era} ERA, ${totals.html} HTML file(s). ${totalBlocked} duplicate member(s) were blocked.`
            : `Loaded ${totals.files} zip file(s): ${totals.trn} TRN, ${totals.era} ERA, ${totals.html} HTML file(s).`,
      });
    } catch (error) {
      setZipStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to load the selected zip file(s).",
      });
    } finally {
      setLoadingZip(false);
    }
  };

  const loadTrnFolder = async () => {
    setLoadingTrn(true);
    setTrnSummary(null);
    setTrnStatus({
      kind: "idle",
      text: "Loading TRN files from 1.TRN...",
    });

    try {
      const response = await load835TrnFiles();
      setTrnSummary(response);
      setTrnStatus({
        kind: response.filesBlocked > 0 ? "error" : "success",
        text:
          response.filesBlocked > 0
            ? `Loaded ${response.filesLoaded} TRN file(s) into EDILoad. ${response.filesBlocked} file(s) were blocked.`
            : `Loaded ${response.filesLoaded} TRN file(s) into EDILoad.`,
      });
    } catch (error) {
      setTrnStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to load TRN files.",
      });
    } finally {
      setLoadingTrn(false);
    }
  };

  const stageEdiLoad = async () => {
    setLoadingStage(true);
    setStageSummary(null);
    setStageStatus({
      kind: "idle",
      text: "Staging EDILoad into EDIStage...",
    });

    try {
      const response = await stage835EdiLoad();
      setStageSummary(response);
      setStageStatus({
        kind: "success",
        text: `${response.statusTag}: ${response.rowsStaged} row(s) staged into ${response.table}.`,
      });
    } catch (error) {
      setStageStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to stage EDI data.",
      });
    } finally {
      setLoadingStage(false);
    }
  };

  const runVetEdiStage = async () => {
    setLoadingVet(true);
    setVetSummary(null);
    setVetStatus({
      kind: "idle",
      text: "Checking EDIStage against EDI for duplicate check numbers...",
    });

    try {
      const response = await vet835EdiStage();
      setVetSummary(response);
      setVetStatus({
        kind: response.duplicateCount > 0 ? "error" : "success",
        text:
          response.duplicateCount > 0
            ? `${response.statusTag}: ${response.duplicateCount} duplicate row(s) blocked, ${response.rowsLoaded} row(s) loaded into ${response.table}.`
            : `${response.statusTag}: ${response.rowsLoaded} row(s) loaded into ${response.table}.`,
      });
    } catch (error) {
      setVetStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to vet EDI data.",
      });
    } finally {
      setLoadingVet(false);
    }
  };

  const approve835Import = async (decision: "approve" | "deny") => {
    setLoadingApproval(true);
    setApprovalSummary(null);
    setApprovalStatus({
      kind: "idle",
      text: decision === "approve" ? "Approving vetted EDI rows..." : "Denying approval and resetting the working tables...",
    });

    try {
      const response = await approve835EdiStage(decision);
      setApprovalSummary(response);
      if (decision === "deny") {
        resetWorkingPhases();
      } else {
        resetWorkingPhases();
      }
      setApprovalStatus({
        kind: decision === "deny" ? "error" : "success",
        text:
          decision === "deny"
            ? `${response.statusTag}: working tables were reset.`
            : `${response.statusTag}: ${response.rowsApproved || 0} row(s) appended to EDI.${response.matchRefresh ? ` Incremental match refresh updated ${response.matchRefresh.ediMatched} EDI, ${response.matchRefresh.eftMatched} EFT, and ${response.matchRefresh.lockboxMatched} Lockbox row(s).` : ""}${response.matchRefreshWarning ? ` Match refresh warning: ${response.matchRefreshWarning}` : ""}`,
      });
    } catch (error) {
      setApprovalStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to process 835 approval.",
      });
    } finally {
      setLoadingApproval(false);
    }
  };

  const openZipPicker = async () => {
    setZipStatus({
      kind: "idle",
      text: "Choose the associated zip files to load into 1.TRN, 2.ERA, and 3.HTML.",
    });

    const pickerWindow = window as Window & {
      showOpenFilePicker?: (options?: {
        multiple?: boolean;
        startIn?: "downloads";
        types?: Array<{
          description: string;
          accept: Record<string, string[]>;
        }>;
        excludeAcceptAllOption?: boolean;
      }) => Promise<Array<{ getFile: () => Promise<File> }>>;
    };

    if (pickerWindow.showOpenFilePicker) {
      try {
        const handles = await pickerWindow.showOpenFilePicker({
          multiple: true,
          startIn: "downloads",
          excludeAcceptAllOption: true,
          types: [
            {
              description: "Zip archives",
              accept: {
                "application/zip": [".zip"],
              },
            },
          ],
        });
        const files = await Promise.all(handles.map((handle) => handle.getFile()));
        await processZipFiles(files);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    fileInputRef.current?.click();
  };

  const handleZipInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    await processZipFiles(files);
  };

  return (
    <main style={adminStyles.shell}>
      <div style={adminStyles.glowBlue} />
      <div style={adminStyles.glowPink} />
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        multiple
        hidden
        onChange={handleZipInputChange}
      />

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
          835 upload workspace in the same shell family as the EFT upload screen.
        </p>

        <nav style={adminStyles.navStack} aria-label="835 upload navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/import")}>
            <span style={adminStyles.navButtonLabel}>Back</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Last 835</div>
          <div style={adminStyles.sidebarCardValue}>{last835Date}</div>
          <div style={adminStyles.sidebarCardMeta}>
            Pulled from the current banking source summary.
          </div>
        </div>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Today</div>
          <div style={adminStyles.sidebarCardValue}>835 upload ready</div>
          <div style={adminStyles.sidebarCardMeta}>
            This screen mirrors the EFT upload shell and is ready for 835-specific logic later.
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>835 Upload</div>
            <p style={adminStyles.subtitle}>
              A calm upload workspace for 835 remittance files, styled to match the EFT upload screen.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.primaryButton} type="button" onClick={() => navigate("/835-match")}>
                Open 835 Match
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/eft-upload")}>
                Back to EFT Upload
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>835 upload window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Upload shell only</div>
              <div style={adminStyles.heroStatusText}>
                The styling matches the EFT upload screen so the new 835 area feels native to the same family.
              </div>
            </div>
          </div>
        </section>

        <section style={adminStyles.statsGrid}>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Mode</div>
            <div style={adminStyles.statValue}>835 upload</div>
            <div style={adminStyles.statDetail}>Same visual structure as the EFT upload workspace.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Focus</div>
            <div style={adminStyles.statValue}>Shell first</div>
            <div style={adminStyles.statDetail}>The logic can be added after the page shape is settled.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Scope</div>
            <div style={adminStyles.statValue}>Layout ready</div>
            <div style={adminStyles.statDetail}>This page is a clean starting point for 835 upload flow work.</div>
          </article>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Phase one</div>
              <h2 style={adminStyles.sectionTitle}>Obtain</h2>
            </div>
            <div style={adminStyles.sectionMeta}>Use the same visual cadence as the EFT upload page.</div>
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
                <div style={adminStyles.widgetTitle}>Obtain Zip Files</div>
                <div style={adminStyles.widgetMeta}>
                  {phaseSteps.map((step, index) => (
                    <div key={step} style={{ marginBottom: index === phaseSteps.length - 1 ? 0 : "10px" }}>
                      {index + 1}. {step}
                    </div>
                  ))}
                </div>
              </div>
              <div style={adminStyles.widgetAction}>No 835 upload logic has been connected yet.</div>
            </article>
          </div>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Phase two</div>
              <h2 style={adminStyles.sectionTitle}>Load</h2>
            </div>
            <div style={adminStyles.sectionMeta}>Select the associated zip files and let the server sort them into the workflow folders.</div>
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
                <span
                  style={{
                    ...adminStyles.statusPill,
                    background:
                      zipStatus.kind === "success"
                        ? "rgba(24, 128, 92, 0.14)"
                        : zipStatus.kind === "error"
                          ? "rgba(192, 34, 34, 0.14)"
                          : "rgba(87, 96, 108, 0.14)",
                    color: zipStatus.kind === "error" ? "#9c1b1b" : "#314055",
                  }}
                >
                  {zipStatus.kind === "success" ? "Loaded" : zipStatus.kind === "error" ? "Blocked" : "Ready"}
                </span>
              </div>
              <div style={adminStyles.widgetBody}>
                <div style={adminStyles.widgetTitle}>Please select the associated zip files.</div>
                <div style={adminStyles.widgetMeta}>
                  Use the picker to choose the zip archives. When supported, it will start in Downloads.
                </div>
                {selectedZipNames.length > 0 && (
                  <div style={{ marginTop: "12px", display: "grid", gap: "6px" }}>
                    {selectedZipNames.map((name) => (
                      <div key={name} style={{ fontSize: "0.95rem", color: "#314055" }}>
                        {name}
                      </div>
                    ))}
                  </div>
                )}
                {zipSummary && (
                  <>
                    <div style={{ marginTop: "12px", fontSize: "0.92rem", color: "#5d6a7a" }}>
                      Routed to: 1.TRN, 2.ERA, 3.HTML
                    </div>
                    <div style={{ marginTop: "6px", fontSize: "0.92rem", color: "#5d6a7a" }}>
                      Duplicate files are blocked before overwrite.
                    </div>
                  </>
                )}
              </div>
              <div style={adminStyles.widgetAction}>
                <div style={{ display: "grid", gap: "14px" }}>
                  <div
                    style={{
                      display: "grid",
                      gap: "8px",
                      padding: "14px",
                      border: "1px solid rgba(193, 204, 217, 0.75)",
                      borderRadius: "14px",
                      background: "rgba(255, 255, 255, 0.7)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                      <button style={adminStyles.primaryButton} type="button" onClick={openZipPicker} disabled={loadingZip}>
                        {loadingZip ? "Loading..." : "Select Zip Files"}
                      </button>
                      <span
                        style={{
                          ...adminStyles.statusPill,
                          background:
                            zipStatus.kind === "success"
                              ? "rgba(24, 128, 92, 0.14)"
                              : zipStatus.kind === "error"
                                ? "rgba(192, 34, 34, 0.14)"
                                : "rgba(87, 96, 108, 0.14)",
                          color: zipStatus.kind === "error" ? "#9c1b1b" : "#314055",
                        }}
                      >
                        {zipStatus.kind === "success" ? "Loaded" : zipStatus.kind === "error" ? "Blocked" : "Ready"}
                      </span>
                    </div>
                    <div style={{ color: zipStatus.kind === "error" ? "#9c1b1b" : "#5d6a7a" }}>{zipStatus.text}</div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: "8px",
                      padding: "14px",
                      border: "1px solid rgba(193, 204, 217, 0.75)",
                      borderRadius: "14px",
                      background: "rgba(255, 255, 255, 0.7)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                      <button style={adminStyles.primaryButton} type="button" onClick={loadTrnFolder} disabled={loadingTrn}>
                        {loadingTrn ? "Loading..." : "Load TRN Files"}
                      </button>
                      <span
                        style={{
                          ...adminStyles.statusPill,
                          background:
                            trnStatus.kind === "success"
                              ? "rgba(24, 128, 92, 0.14)"
                              : trnStatus.kind === "error"
                                ? "rgba(192, 34, 34, 0.14)"
                                : "rgba(87, 96, 108, 0.14)",
                          color: trnStatus.kind === "error" ? "#9c1b1b" : "#314055",
                        }}
                      >
                        {trnStatus.kind === "success" ? "Loaded" : trnStatus.kind === "error" ? "Blocked" : "Ready"}
                      </span>
                    </div>
                    <div style={{ color: trnStatus.kind === "error" ? "#9c1b1b" : "#5d6a7a" }}>{trnStatus.text}</div>
                    {trnSummary && (
                      <div style={{ fontSize: "0.92rem", color: "#5d6a7a" }}>
                        {trnSummary.rowsLoaded} row(s) loaded from {trnSummary.filesLoaded} file(s). {trnSummary.blockedRows} duplicate row(s) blocked.
                      </div>
                    )}
                  </div>
                </div>
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
            <div style={adminStyles.sectionMeta}>Copy the loaded EDI rows into EDIStage and stamp batch, transaction, and time metadata.</div>
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
                <span
                  style={{
                    ...adminStyles.statusPill,
                    background:
                      stageStatus.kind === "success"
                        ? "rgba(24, 128, 92, 0.14)"
                        : stageStatus.kind === "error"
                          ? "rgba(192, 34, 34, 0.14)"
                          : "rgba(87, 96, 108, 0.14)",
                    color: stageStatus.kind === "error" ? "#9c1b1b" : "#314055",
                  }}
                >
                  {stageStatus.kind === "success" ? "Loaded" : stageStatus.kind === "error" ? "Blocked" : "Ready"}
                </span>
              </div>
              <div style={adminStyles.widgetBody}>
                <div style={adminStyles.widgetTitle}>Copy EDILoad into EDIStage</div>
                <div style={adminStyles.widgetMeta}>
                  This step copies all loaded rows forward and refreshes batchnum, transnum, and timestamp.
                </div>
                {stageSummary && (
                  <div style={{ marginTop: "12px", fontSize: "0.92rem", color: "#5d6a7a" }}>
                    Batch {stageSummary.batchnum}, trans {stageSummary.startTransnum} - {stageSummary.endTransnum}.
                  </div>
                )}
              </div>
              <div style={adminStyles.widgetAction}>
                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    padding: "14px",
                    border: "1px solid rgba(193, 204, 217, 0.75)",
                    borderRadius: "14px",
                    background: "rgba(255, 255, 255, 0.7)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <button style={adminStyles.primaryButton} type="button" onClick={stageEdiLoad} disabled={loadingStage}>
                      {loadingStage ? "Staging..." : "Stage EDI Load"}
                    </button>
                    <span
                      style={{
                        ...adminStyles.statusPill,
                        background:
                          stageStatus.kind === "success"
                            ? "rgba(24, 128, 92, 0.14)"
                            : stageStatus.kind === "error"
                              ? "rgba(192, 34, 34, 0.14)"
                              : "rgba(87, 96, 108, 0.14)",
                        color: stageStatus.kind === "error" ? "#9c1b1b" : "#314055",
                      }}
                    >
                      {stageStatus.kind === "success" ? "Loaded" : stageStatus.kind === "error" ? "Blocked" : "Ready"}
                    </span>
                  </div>
                  <div style={{ color: stageStatus.kind === "error" ? "#9c1b1b" : "#5d6a7a" }}>{stageStatus.text}</div>
                </div>
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
            <div style={adminStyles.sectionMeta}>Compare the staged rows against EDI check numbers and keep only the clean rows in EDIVett.</div>
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
                <span
                  style={{
                    ...adminStyles.statusPill,
                    background:
                      vetStatus.kind === "success"
                        ? "rgba(24, 128, 92, 0.14)"
                        : vetStatus.kind === "error"
                          ? "rgba(192, 34, 34, 0.14)"
                          : "rgba(87, 96, 108, 0.14)",
                    color: vetStatus.kind === "error" ? "#9c1b1b" : "#314055",
                  }}
                >
                  {vetStatus.kind === "success" ? "Loaded" : vetStatus.kind === "error" ? "Blocked" : "Ready"}
                </span>
              </div>
              <div style={adminStyles.widgetBody}>
                <div style={adminStyles.widgetTitle}>Move clean rows from EDIStage to EDIVett</div>
                <div style={adminStyles.widgetMeta}>
                  Duplicate check numbers are blocked against the source EDI table, and only clean rows are moved forward.
                </div>
                {vetSummary && (
                  <details style={{ marginTop: "12px" }}>
                    <summary style={{ cursor: "pointer", color: "#314055", fontWeight: 700 }}>
                      Duplicate summary: {vetSummary.duplicateCount} blocked
                    </summary>
                    <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
                      <div style={{ fontSize: "0.92rem", color: "#5d6a7a" }}>
                        {vetSummary.totalRows} staged row(s), {vetSummary.rowsLoaded} loaded into EDIVett.
                      </div>
                      {vetSummary.duplicateRows.length > 0 && (
                        <div
                          style={{
                            maxHeight: "180px",
                            overflow: "auto",
                            border: "1px solid rgba(193, 204, 217, 0.75)",
                            borderRadius: "10px",
                            padding: "10px",
                            background: "rgba(255, 255, 255, 0.75)",
                            display: "grid",
                            gap: "8px",
                          }}
                        >
                          {vetSummary.duplicateRows.map((row) => (
                            <div key={`${row.row}-${row.checkNumber}`} style={{ fontSize: "0.92rem", color: "#314055" }}>
                              Row {row.row}: check {row.checkNumber || "-"} on {row.date || "-"} amount {row.amount || "-"}.
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
              <div style={adminStyles.widgetAction}>
                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    padding: "14px",
                    border: "1px solid rgba(193, 204, 217, 0.75)",
                    borderRadius: "14px",
                    background: "rgba(255, 255, 255, 0.7)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <button style={adminStyles.primaryButton} type="button" onClick={runVetEdiStage} disabled={loadingVet}>
                      {loadingVet ? "Vetting..." : "Vett EDI Stage"}
                    </button>
                    <span
                      style={{
                        ...adminStyles.statusPill,
                        background:
                          vetStatus.kind === "success"
                            ? "rgba(24, 128, 92, 0.14)"
                            : vetStatus.kind === "error"
                              ? "rgba(192, 34, 34, 0.14)"
                              : "rgba(87, 96, 108, 0.14)",
                        color: vetStatus.kind === "error" ? "#9c1b1b" : "#314055",
                      }}
                    >
                      {vetStatus.kind === "success" ? "Loaded" : vetStatus.kind === "error" ? "Blocked" : "Ready"}
                    </span>
                  </div>
                  <div style={{ color: vetStatus.kind === "error" ? "#9c1b1b" : "#5d6a7a" }}>{vetStatus.text}</div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Phase five</div>
              <h2 style={adminStyles.sectionTitle}>Approval</h2>
            </div>
            <div style={adminStyles.sectionMeta}>Approve to append vetted rows into EDI, or deny to clear the working EDI tables and reset the phase chips.</div>
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
                <span
                  style={{
                    ...adminStyles.statusPill,
                    background:
                      approvalStatus.kind === "success"
                        ? "rgba(24, 128, 92, 0.14)"
                        : approvalStatus.kind === "error"
                          ? "rgba(192, 34, 34, 0.14)"
                          : "rgba(87, 96, 108, 0.14)",
                    color: approvalStatus.kind === "error" ? "#9c1b1b" : "#314055",
                  }}
                >
                  {approvalStatus.kind === "success" ? "Approved" : approvalStatus.kind === "error" ? "Denied" : "Ready"}
                </span>
              </div>
              <div style={adminStyles.widgetBody}>
                <div style={adminStyles.widgetTitle}>Approve or deny the vetted EDI rows</div>
                <div style={adminStyles.widgetMeta}>
                  Approve appends the vetted rows into EDI with duplicate protection, then runs the 835 incremental match refresh.
                </div>
                {approvalSummary && (
                  <div style={{ marginTop: "12px", display: "grid", gap: "6px", fontSize: "0.92rem", color: "#5d6a7a" }}>
                    <div>{approvalSummary.rowsApproved || 0} row(s) processed for approval.</div>
                    {approvalSummary.matchRefresh && (
                      <div>
                        Match refresh: {approvalSummary.matchRefresh.ediMatched} EDI, {approvalSummary.matchRefresh.eftMatched} EFT, {approvalSummary.matchRefresh.lockboxMatched} Lockbox row(s) updated.
                      </div>
                    )}
                    {approvalSummary.matchRefreshWarning && <div>Refresh warning: {approvalSummary.matchRefreshWarning}</div>}
                    {approvalSummary.tablesReset && <div>Reset tables: {approvalSummary.tablesReset.join(", ")}</div>}
                  </div>
                )}
              </div>
              <div style={adminStyles.widgetAction}>
                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    padding: "14px",
                    border: "1px solid rgba(193, 204, 217, 0.75)",
                    borderRadius: "14px",
                    background: "rgba(255, 255, 255, 0.7)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <button style={adminStyles.primaryButton} type="button" onClick={() => approve835Import("approve")} disabled={loadingApproval}>
                        {loadingApproval ? "Approving..." : "Approve"}
                      </button>
                      <button style={adminStyles.secondaryButton} type="button" onClick={() => approve835Import("deny")} disabled={loadingApproval}>
                        {loadingApproval ? "Working..." : "Deny"}
                      </button>
                    </div>
                    <span
                      style={{
                        ...adminStyles.statusPill,
                        background:
                          approvalStatus.kind === "success"
                            ? "rgba(24, 128, 92, 0.14)"
                            : approvalStatus.kind === "error"
                              ? "rgba(192, 34, 34, 0.14)"
                              : "rgba(87, 96, 108, 0.14)",
                        color: approvalStatus.kind === "error" ? "#9c1b1b" : "#314055",
                      }}
                    >
                      {approvalStatus.kind === "success" ? "Approved" : approvalStatus.kind === "error" ? "Denied" : "Ready"}
                    </span>
                  </div>
                  <div style={{ color: approvalStatus.kind === "error" ? "#9c1b1b" : "#5d6a7a" }}>{approvalStatus.text}</div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}



