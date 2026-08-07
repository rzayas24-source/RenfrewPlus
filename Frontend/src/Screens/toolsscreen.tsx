import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { convertHtmlFiles } from "../api/html_convert_api";
import { convertEraFiles } from "../api/era_convert_api";
import { getDuplicateCheckSpreadsheet, type DuplicateCheckSpreadsheetResponse } from "../api/duplicatecheck_api";
import { getCalendarStatus, type CalendarStatus } from "../api/calendar_api";
import { getOtherDaySpreadsheet, type OtherDaySpreadsheetResponse } from "../api/otherday_api";

export default function ToolsScreen() {
  const navigate = useNavigate();
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [bulkDayIso, setBulkDayIso] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [htmlMessage, setHtmlMessage] = useState<string | null>(null);
  const [htmlError, setHtmlError] = useState<string | null>(null);
  const [otherDayData, setOtherDayData] = useState<OtherDaySpreadsheetResponse | null>(null);
  const [otherDayLoading, setOtherDayLoading] = useState(false);
  const [otherDayError, setOtherDayError] = useState<string | null>(null);
  const [duplicateData, setDuplicateData] = useState<DuplicateCheckSpreadsheetResponse | null>(null);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await getCalendarStatus();
        if (!active) return;

        setCalendarStatus(response.data);
        setBulkDayIso((current) => current || mmddyyyyToIso(response.data.currentWorkDay || response.data.today));
      } catch {
        if (active) {
          setCalendarStatus(null);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setDuplicateLoading(true);
      try {
        const response = await getDuplicateCheckSpreadsheet();
        if (!active) return;
        setDuplicateData(response.data);
        setDuplicateError(null);
      } catch (error) {
        if (!active) return;
        setDuplicateError(error instanceof Error ? error.message : "Failed to load duplicate results.");
        setDuplicateData(null);
      } finally {
        if (active) {
          setDuplicateLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setOtherDayLoading(true);
      try {
        const response = await getOtherDaySpreadsheet();
        if (!active) return;
        setOtherDayData(response.data);
        setOtherDayError(null);
      } catch (error) {
        if (!active) return;
        setOtherDayError(error instanceof Error ? error.message : "Failed to load other-day results.");
        setOtherDayData(null);
      } finally {
        if (active) {
          setOtherDayLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const runBulkConvert = async () => {
    const workDay = isoToMmddyyyy(bulkDayIso);
    if (!workDay) {
      setBulkError("Pick a valid posting day before running bulk ERA convert.");
      return;
    }

    setBulkLoading(true);
    setBulkError(null);
    setBulkMessage(null);

    try {
      const response = await convertEraFiles(workDay);
      setBulkMessage(`${response.data.renamedCount} file(s) renamed for ${response.data.bankDay}.`);
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Bulk ERA convert failed.");
    } finally {
      setBulkLoading(false);
    }
  };

  const runHtmlConvert = async () => {
    const workDay = isoToMmddyyyy(bulkDayIso);
    if (!workDay) {
      setHtmlError("Pick a valid posting day before running HTML convert.");
      return;
    }

    setHtmlLoading(true);
    setHtmlError(null);
    setHtmlMessage(null);

    try {
      const response = await convertHtmlFiles(workDay);
      setHtmlMessage(`${response.data.renamedCount} file(s) renamed for ${response.data.bankDay}.`);
    } catch (error) {
      setHtmlError(error instanceof Error ? error.message : "HTML convert failed.");
    } finally {
      setHtmlLoading(false);
    }
  };

  return (
    <AdminShell
      sidebarCopy="A soft tools console for helpers, utilities, and RenfrewPlus support."
      onBack={() => navigate("/cash")}
      hideBackButton
    >
      <section style={toolsPageStyles.content}>
        <section style={toolsPageStyles.heroShell}>
          <div style={toolsPageStyles.heroCopy}>
            <div style={toolsPageStyles.kicker}>Tools hub</div>
            <p style={toolsPageStyles.subtitle}>Tools Screen</p>
          </div>

          <div style={toolsPageStyles.heroArt}>
            <div style={toolsPageStyles.heroStatusCard}>
              <div style={toolsPageStyles.heroStatusTop}>
                <span style={toolsPageStyles.statusPill}>Tools window</span>
                <span style={toolsPageStyles.statusDot} />
              </div>
              <div style={toolsPageStyles.heroStatusTitle}>Utility launch board</div>
              <div style={toolsPageStyles.heroStatusText}>
                Tools should feel like a command surface, not a plain list of links.
              </div>
            </div>
          </div>
        </section>

        <section style={toolsPageStyles.launchGrid}>
          <div style={toolsPageStyles.stackColumn}>
            <article style={toolsPageStyles.bulkCard}>
              <div style={toolsPageStyles.widgetHeader}>
                <div>
                  <div style={toolsPageStyles.sectionKicker}>Quick launch</div>
                  <h2 style={toolsPageStyles.sectionTitle}>Bulk ERA convert</h2>
                </div>
                <button
                  type="button"
                  style={toolsPageStyles.widgetJumpButton}
                  onClick={() => navigate("/era-convert")}
                  aria-label="Open ERA Convert"
                  title="Open ERA Convert"
                >
                  ↗
                </button>
              </div>
              <div style={toolsPageStyles.sectionMeta}>
                Run the ERA file rename step without leaving Tools. It uses the same backend action as the full ERA screen.
              </div>
              <label style={toolsPageStyles.fieldLabel}>
                Posting day
                <input
                  style={toolsPageStyles.textInput}
                  type="date"
                  value={bulkDayIso}
                  onChange={(event) => setBulkDayIso(event.target.value)}
                />
              </label>
              <div style={toolsPageStyles.rowActions}>
                <button type="button" style={toolsPageStyles.primaryButton} onClick={() => void runBulkConvert()} disabled={bulkLoading}>
                  {bulkLoading ? "Converting..." : "Run bulk convert"}
                </button>
                <span style={toolsPageStyles.helperText}>
                  {calendarStatus?.currentWorkDay ? `Current work day: ${calendarStatus.currentWorkDay}` : "Using calendar status when available."}
                </span>
              </div>
              {bulkMessage && <div style={toolsPageStyles.successText}>{bulkMessage}</div>}
              {bulkError && <div style={toolsPageStyles.errorText}>{bulkError}</div>}
            </article>

            <article style={toolsPageStyles.bulkCard}>
              <div style={toolsPageStyles.widgetHeader}>
                <div>
                  <div style={toolsPageStyles.sectionKicker}>Quick launch</div>
                  <h2 style={toolsPageStyles.sectionTitle}>HTML convert</h2>
                </div>
                <button
                  type="button"
                  style={toolsPageStyles.widgetJumpButton}
                  onClick={() => navigate("/html-convert")}
                  aria-label="Open HTML Convert"
                  title="Open HTML Convert"
                >
                  ↗
                </button>
              </div>
              <div style={toolsPageStyles.sectionMeta}>
                Run the HTML rename step for the same posting day without leaving Tools.
              </div>
              <div style={toolsPageStyles.rowActions}>
                <button type="button" style={toolsPageStyles.primaryButton} onClick={() => void runHtmlConvert()} disabled={htmlLoading}>
                  {htmlLoading ? "Converting..." : "Run HTML convert"}
                </button>
                <span style={toolsPageStyles.helperText}>
                  {calendarStatus?.currentWorkDay ? `Current work day: ${calendarStatus.currentWorkDay}` : "Uses the selected posting day."}
                </span>
              </div>
              {htmlMessage && <div style={toolsPageStyles.successText}>{htmlMessage}</div>}
              {htmlError && <div style={toolsPageStyles.errorText}>{htmlError}</div>}
            </article>

            <article style={toolsPageStyles.resultsCard}>
              <div style={toolsPageStyles.otherDayHeaderRow}>
                <div style={toolsPageStyles.otherDayHeaderCopy}>
                  <div style={toolsPageStyles.sectionKicker}>Other Day</div>
                  <h2 style={toolsPageStyles.sectionTitle}>Files where totals count is greater than today&apos;s count</h2>
                  <div style={toolsPageStyles.sectionMeta}>
                    This widget mirrors the missing-items output from the checker and keeps the file list in focus.
                  </div>
                </div>

                <div style={toolsPageStyles.otherDayHeaderActions}>
                  <button
                    type="button"
                    style={toolsPageStyles.widgetJumpButton}
                    onClick={() => navigate("/otherday")}
                    aria-label="Open Other Day Check"
                    title="Open Other Day Check"
                  >
                    ↗
                  </button>
                  <div style={toolsPageStyles.missingRowsBadge}>
                    <span style={toolsPageStyles.resultStatLabel}>Missing Rows</span>
                    <span style={toolsPageStyles.resultStatValue}>{otherDayData?.missingCount ?? 0}</span>
                  </div>
                </div>
              </div>

              <div style={toolsPageStyles.otherDayLayout}>
                <div style={toolsPageStyles.otherDaySummaryCol}>
                  <div style={toolsPageStyles.resultsSummary}>
                    <div style={toolsPageStyles.resultStat}>
                      <span style={toolsPageStyles.resultStatLabel}>Work Day</span>
                      <span style={toolsPageStyles.resultStatValue}>{otherDayData?.currentWorkDay || "Loading..."}</span>
                    </div>
                    <div style={toolsPageStyles.resultStat}>
                      <span style={toolsPageStyles.resultStatLabel}>Bank Day</span>
                      <span style={toolsPageStyles.resultStatValue}>{otherDayData?.bankDay || "No mapping"}</span>
                    </div>
                  </div>

                  {otherDayError && <div style={toolsPageStyles.errorText}>{otherDayError}</div>}
                  {!otherDayError && otherDayLoading && <div style={toolsPageStyles.helperText}>Loading other-day results...</div>}
                </div>

                <div style={toolsPageStyles.otherDayOutputCol}>
                  {!otherDayLoading && otherDayData && (
                    <div style={toolsPageStyles.resultBlock}>
                      <div style={toolsPageStyles.resultBlockTitle}>Missing rows output</div>
                      <div style={toolsPageStyles.resultList}>
                        {otherDayData.missingRows.slice(0, 3).map((row) => (
                          <div key={`${row.filename}-${row.checkNumber}-${row.matchstatus}`} style={toolsPageStyles.resultListItem}>
                            <span style={toolsPageStyles.resultListMain}>{row.filename}</span>
                            <span style={toolsPageStyles.resultListMeta}>
                              {row.checkNumber} | {row.counts}
                            </span>
                          </div>
                        ))}
                        {!otherDayData.missingRows.length && <div style={toolsPageStyles.helperText}>No missing items found.</div>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          </div>

          <div style={toolsPageStyles.stackColumn}>
            <article style={toolsPageStyles.duplicateCard}>
              <div style={toolsPageStyles.widgetHeader}>
                <div>
                  <div style={toolsPageStyles.sectionKicker}>Duplicate Check</div>
                  <h2 style={toolsPageStyles.sectionTitle}>Do we have duplicates?</h2>
                </div>
                <button
                  type="button"
                  style={toolsPageStyles.widgetJumpButton}
                  onClick={() => navigate("/duplicatecheck")}
                  aria-label="Open Duplicate Check"
                  title="Open Duplicate Check"
                >
                  ↗
                </button>
              </div>
              <div style={toolsPageStyles.sectionMeta}>
                A compact check that tells you whether any duplicate filenames were found for the active bank day.
              </div>

              <div style={toolsPageStyles.resultsSummary}>
                <div style={toolsPageStyles.resultStat}>
                  <span style={toolsPageStyles.resultStatLabel}>Bank Day</span>
                  <span style={toolsPageStyles.resultStatValue}>{duplicateData?.bankDay || "No mapping"}</span>
                </div>
                <div style={toolsPageStyles.resultStat}>
                  <span style={toolsPageStyles.resultStatLabel}>Duplicate Rows</span>
                  <span style={toolsPageStyles.resultStatValue}>{duplicateData?.duplicateCount ?? 0}</span>
                </div>
                <div style={toolsPageStyles.resultStat}>
                  <span style={toolsPageStyles.resultStatLabel}>Duplicate Files</span>
                  <span style={toolsPageStyles.resultStatValue}>{duplicateData?.duplicateFilenames ?? 0}</span>
                </div>
              </div>

              {duplicateError && <div style={toolsPageStyles.errorText}>{duplicateError}</div>}
              {!duplicateError && duplicateLoading && <div style={toolsPageStyles.helperText}>Loading duplicate results...</div>}

              {!duplicateLoading && duplicateData && (
                <div style={toolsPageStyles.duplicateStatusWrap}>
                  <div
                    style={{
                      ...toolsPageStyles.duplicateStatus,
                      ...(duplicateData.duplicateCount > 0 ? toolsPageStyles.duplicateStatusWarn : toolsPageStyles.duplicateStatusOk),
                    }}
                  >
                    {duplicateData.duplicateCount > 0
                      ? `Yes, ${duplicateData.duplicateCount} duplicate row(s) found across ${duplicateData.duplicateFilenames} filename(s).`
                      : "No duplicates found for the current bank day."}
                  </div>

                  {duplicateData.duplicateFilenameList.length > 0 && (
                    <div style={toolsPageStyles.filenamePillRow}>
                      {duplicateData.duplicateFilenameList.slice(0, 4).map((filename) => (
                        <span key={filename} style={toolsPageStyles.filenamePill}>
                          {filename}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          </div>
        </section>

      </section>
    </AdminShell>
  );
}

const toolsPageStyles: Record<string, CSSProperties> = {
  content: {
    display: "grid",
    gap: "10px",
    alignContent: "start",
    paddingTop: "0",
  },
  heroShell: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.9fr)",
    gap: "12px",
    padding: "12px 14px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(243,247,252,0.96) 42%, rgba(247,250,255,0.92) 100%)",
    boxShadow: "0 24px 48px rgba(52, 84, 120, 0.08)",
    position: "relative",
    overflow: "hidden",
  },
  heroCopy: {
    display: "grid",
    gap: "8px",
    alignContent: "start",
  },
  kicker: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    fontSize: "20px",
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
    color: "#17324f",
    fontWeight: 800,
    maxWidth: "none",
  },
  heroActions: {
    position: "fixed",
    top: "18px",
    left: "282px",
    right: "16px",
    zIndex: 4,
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 18px 36px rgba(52, 84, 120, 0.08)",
  },
  primaryButton: {
    border: "none",
    borderRadius: "14px",
    padding: "12px 16px",
    background: "linear-gradient(135deg, #2f5f8f 0%, #1e4064 100%)",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(47, 95, 143, 0.24)",
  },
  secondaryButton: {
    border: "1px solid rgba(99, 124, 151, 0.22)",
    borderRadius: "14px",
    padding: "12px 16px",
    background: "rgba(255,255,255,0.88)",
    color: "#35506d",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
  },
  heroArt: {
    display: "grid",
    alignItems: "stretch",
  },
  heroStatusCard: {
    padding: "12px",
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(236,243,251,0.96) 100%)",
    boxShadow: "0 18px 38px rgba(52, 84, 120, 0.08)",
    display: "grid",
    gap: "6px",
    alignContent: "start",
  },
  heroStatusTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(224, 237, 250, 0.95)",
    color: "#35506d",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  statusDot: {
    width: "11px",
    height: "11px",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #4caf7d 0%, #79d8a9 100%)",
    boxShadow: "0 0 0 6px rgba(76, 175, 125, 0.12)",
  },
  heroStatusTitle: {
    fontSize: "16px",
    lineHeight: 1.08,
    fontWeight: 900,
    color: "#17324f",
  },
  heroStatusText: {
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#536579",
  },
  bulkCard: {
    padding: "12px",
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.88)",
    boxShadow: "0 18px 36px rgba(52, 84, 120, 0.06)",
    display: "grid",
    gap: "8px",
    minHeight: "0",
  },
  resultsCard: {
    padding: "12px",
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.84)",
    boxShadow: "0 18px 36px rgba(52, 84, 120, 0.06)",
    display: "grid",
    gap: "8px",
    minHeight: "0",
  },
  duplicateCard: {
    padding: "12px",
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.84)",
    boxShadow: "0 18px 36px rgba(52, 84, 120, 0.06)",
    display: "grid",
    gap: "8px",
    minHeight: "0",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "16px",
  },
  statCard: {
    padding: "18px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(145deg, rgba(255,255,255,0.94) 0%, rgba(245,249,253,0.98) 100%)",
    boxShadow: "0 16px 32px rgba(52, 84, 120, 0.06)",
  },
  statLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
    marginBottom: "8px",
  },
  statValue: {
    fontSize: "20px",
    lineHeight: 1.15,
    color: "#17324f",
    fontWeight: 900,
    marginBottom: "8px",
  },
  statDetail: {
    fontSize: "14px",
    lineHeight: 1.65,
    color: "#536579",
  },
  launchGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.25fr) minmax(360px, 0.9fr)",
    gap: "10px",
    alignItems: "start",
  },
  stackColumn: {
    display: "grid",
    gap: "10px",
  },
  widgetHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "10px",
  },
  otherDayHeaderActions: {
    display: "grid",
    justifyItems: "end",
    gap: "6px",
  },
  widgetJumpButton: {
    width: "30px",
    height: "30px",
    borderRadius: "999px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.92)",
    color: "#35506d",
    display: "grid",
    placeItems: "center",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
    flexShrink: 0,
    boxShadow: "0 10px 18px rgba(52, 84, 120, 0.08)",
  },
  sectionKicker: {
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "#6d7f93",
    fontWeight: 800,
    marginBottom: "2px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.12,
    color: "#17324f",
    fontWeight: 900,
  },
  sectionMeta: {
    fontSize: "11px",
    lineHeight: 1.35,
    color: "#536579",
    maxWidth: "none",
  },
  resultsSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
  },
  otherDayLayout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.05fr)",
    gap: "10px",
    alignItems: "start",
  },
  otherDayHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "8px",
  },
  otherDayHeaderCopy: {
    minWidth: 0,
    display: "grid",
    gap: "4px",
  },
  missingRowsBadge: {
    minWidth: "110px",
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    background: "rgba(255,255,255,0.88)",
    padding: "8px 10px",
    display: "grid",
    justifyItems: "end",
    gap: "2px",
    boxShadow: "0 8px 18px rgba(52, 84, 120, 0.05)",
  },
  otherDaySummaryCol: {
    display: "grid",
    gap: "8px",
    alignContent: "start",
  },
  otherDayOutputCol: {
    display: "grid",
    alignContent: "start",
  },
  resultStat: {
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    background: "rgba(255,255,255,0.84)",
    padding: "8px 10px",
    display: "grid",
    gap: "2px",
  },
  resultStatLabel: {
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  resultStatValue: {
    fontSize: "12px",
    color: "#17324f",
    fontWeight: 800,
  },
  resultsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
  },
  resultBlock: {
    borderRadius: "16px",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    background: "rgba(255,255,255,0.8)",
    padding: "8px",
    display: "grid",
    gap: "6px",
  },
  resultBlockTitle: {
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  resultList: {
    display: "grid",
    gap: "6px",
  },
  resultListItem: {
    display: "grid",
    gap: "1px",
    padding: "6px 8px",
    borderRadius: "12px",
    background: "rgba(245, 248, 252, 0.96)",
    border: "1px solid rgba(140, 160, 184, 0.1)",
  },
  resultListMain: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#17324f",
    whiteSpace: "normal",
  },
  resultListMeta: {
    fontSize: "11px",
    color: "#5a6c80",
    whiteSpace: "normal",
  },
  duplicateStatusWrap: {
    display: "grid",
    gap: "8px",
  },
  duplicateStatus: {
    borderRadius: "14px",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 800,
    lineHeight: 1.35,
    border: "1px solid rgba(140, 160, 184, 0.14)",
  },
  duplicateStatusWarn: {
    background: "rgba(255, 240, 225, 0.96)",
    color: "#8c4a11",
  },
  duplicateStatusOk: {
    background: "rgba(231, 240, 247, 0.96)",
    color: "#17324f",
  },
  filenamePillRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  filenamePill: {
    padding: "6px 8px",
    borderRadius: "999px",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    background: "rgba(255,255,255,0.9)",
    color: "#35506d",
    fontSize: "11px",
    fontWeight: 700,
    wordBreak: "break-word",
  },
  fieldLabel: {
    display: "grid",
    gap: "4px",
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#597085",
  },
  textInput: {
    minHeight: "34px",
    borderRadius: "12px",
    border: "1px solid rgba(171, 186, 207, 0.42)",
    background: "rgba(255,255,255,0.95)",
    color: "#17324f",
    padding: "0 10px",
    fontSize: "12px",
    fontWeight: 700,
    boxShadow: "0 10px 20px rgba(52, 84, 120, 0.05)",
    outline: "none",
  },
  rowActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "center",
  },
  helperText: {
    fontSize: "11px",
    color: "#536579",
    fontWeight: 700,
  },
  successText: {
    padding: "8px 10px",
    borderRadius: "12px",
    background: "rgba(231, 240, 247, 0.96)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    color: "#17324f",
    fontSize: "11px",
    fontWeight: 700,
  },
  errorText: {
    padding: "8px 10px",
    borderRadius: "12px",
    background: "rgba(255, 228, 228, 0.88)",
    border: "1px solid rgba(219, 104, 104, 0.22)",
    color: "#8e2f2f",
    fontSize: "11px",
    fontWeight: 700,
  },
};

function parseMmddyyyy(value: string) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day ||
    parsed.getFullYear() !== year
  ) {
    return null;
  }

  return parsed;
}

function mmddyyyyToIso(value: string) {
  const parsed = parseMmddyyyy(value);
  if (!parsed) return "";

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${year}-${month}-${day}`;
}

function isoToMmddyyyy(value: string) {
  const parsed = value ? new Date(`${value}T00:00:00`) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "";

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${month}/${day}/${year}`;
}
