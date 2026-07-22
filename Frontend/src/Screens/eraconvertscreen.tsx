import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { styles as adminStyles } from "./adminscreen";
import { WorklistBrandButton } from "../worklist/worklist";
import { getBankingSpreadsheet, type BankingSpreadsheetResponse } from "../api/banking_api";
import { getCalendarStatus, type CalendarStatus } from "../api/calendar_api";
import { convertEraFiles, getEraSpreadsheet, type EraConvertResponse, type EraSpreadsheetResponse } from "../api/era_convert_api";

type EraMetric = {
  label: string;
  value: string;
  detail: string;
};

type FilteredBankRow = {
  source: "EFT" | "Lockbox";
  date: string;
  amount: string;
  payer: string;
  checkNumber: string;
  edi: string;
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

function isoToMmddyyyy(value: string) {
  const parsed = value ? new Date(`${value}T00:00:00`) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return "";

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${month}/${day}/${year}`;
}

function mmddyyyyToIso(value: string) {
  const parsed = parseMmddyyyy(value);
  if (!parsed) return "";

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${year}-${month}-${day}`;
}

function formatAmount(value: string) {
  if (!value) return "";
  const parsed = Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(parsed)) return value;
  return parsed.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function compareChecks(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

export default function ERAConvertScreen() {
  const navigate = useNavigate();
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [bankingData, setBankingData] = useState<BankingSpreadsheetResponse | null>(null);
  const [eraData, setEraData] = useState<EraSpreadsheetResponse | null>(null);
  const [selectedDayIso, setSelectedDayIso] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingEra, setLoadingEra] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convertResult, setConvertResult] = useState<EraConvertResponse | null>(null);
  const [bankTableCollapsed, setBankTableCollapsed] = useState(false);
  const [eraTableCollapsed, setEraTableCollapsed] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [calendarResponse, bankingResponse] = await Promise.all([
          getCalendarStatus(),
          getBankingSpreadsheet(),
        ]);

        if (!active) return;

        setCalendarStatus(calendarResponse.data);
        setBankingData(bankingResponse.data);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load ERA converter data");
        setBankingData(null);
        setCalendarStatus(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedDayIso || !calendarStatus) return;

    const defaultWorkDay = calendarStatus.currentWorkDay || calendarStatus.today;
    setSelectedDayIso(mmddyyyyToIso(defaultWorkDay));
  }, [calendarStatus, selectedDayIso]);

  useEffect(() => {
    let active = true;

    const loadEraMatches = async () => {
      if (!selectedDayIso) {
        setEraData(null);
        return;
      }

      const workDay = isoToMmddyyyy(selectedDayIso);
      if (!workDay) {
        setEraData(null);
        return;
      }

      setLoadingEra(true);
      try {
        const response = await getEraSpreadsheet(workDay);
        if (!active) return;
        setEraData(response.data);
        setError(null);
      } catch (err) {
        if (!active) return;
        setEraData(null);
        setError(err instanceof Error ? err.message : "Failed to load ERA file matches");
      } finally {
        if (active) {
          setLoadingEra(false);
        }
      }
    };

    void loadEraMatches();

    return () => {
      active = false;
    };
  }, [selectedDayIso]);

  const activePostingDay = selectedDayIso ? isoToMmddyyyy(selectedDayIso) : calendarStatus?.currentWorkDay ?? "";
  const activeBankDay = eraData?.bankDay || (calendarStatus?.currentWorkDay === activePostingDay ? calendarStatus.currentBankDay : null);

  const filteredRows = useMemo(() => {
    if (!bankingData || !activeBankDay) return [];

    const rows: FilteredBankRow[] = [];

    for (const group of bankingData.groups) {
      for (const row of group.rows) {
        if (row.edi !== "Y") continue;
        if (row.date !== activeBankDay) continue;

        rows.push({
          source: group.source,
          date: row.date,
          amount: row.amount,
          payer: row.payer,
          checkNumber: row.checkNumber,
          edi: row.edi,
        });
      }
    }

    return rows.sort((left, right) => {
      const sourceCompare = left.source.localeCompare(right.source);
      if (sourceCompare !== 0) return sourceCompare;
      return compareChecks(left.checkNumber, right.checkNumber);
    });
  }, [activeBankDay, bankingData]);

  const bankSubtotal = useMemo(() => {
    return filteredRows.reduce((total, row) => {
      const parsed = Number(String(row.amount).replace(/,/g, ""));
      return total + (Number.isNaN(parsed) ? 0 : parsed);
    }, 0);
  }, [filteredRows]);

  const eraSubtotal = useMemo(() => {
    const rows = eraData?.rows ?? [];
    const uniqueChecks = new Set<string>();
    const amount = rows.reduce((total, row) => {
      uniqueChecks.add(row.checkNumber);
      const parsed = Number(String(row.amount).replace(/,/g, ""));
      return total + (Number.isNaN(parsed) ? 0 : parsed);
    }, 0);

    return {
      amount,
      rows: rows.length,
      checks: uniqueChecks.size,
    };
  }, [eraData]);

  const convertStatusTag = converting
    ? "CONVERTING"
    : convertResult?.statusTag || (convertResult ? "READY" : "READY");

  const convertStatusMessage = converting
    ? "Renaming ERA files and moving them to 2.ERA/Renamed..."
    : convertResult?.message || "Ready to rename the current day’s ERA files.";

  const handleConvert = async () => {
    if (!selectedDayIso) {
      setError("Pick a posting day before converting ERA files.");
      return;
    }

    const workDay = isoToMmddyyyy(selectedDayIso);
    if (!workDay) {
      setError("Pick a valid posting day before converting ERA files.");
      return;
    }

    setConverting(true);
    setLoadingEra(true);
    setError(null);
    try {
      const response = await convertEraFiles(workDay);
      setConvertResult(response.data);
      const refreshed = await getEraSpreadsheet(workDay);
      setEraData(refreshed.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert ERA files");
      setConvertResult(null);
    } finally {
      setConverting(false);
      setLoadingEra(false);
    }
  };

  const metrics: EraMetric[] = [
    {
      label: "Posting Day",
      value: activePostingDay || "Not set",
      detail: "Defaults to the current posting day from the calendar workspace.",
    },
    {
      label: "Bank Day",
      value: activeBankDay || "No mapping",
      detail: "The banking day associated with the selected posting day.",
    },
    {
      label: "EDI Rows",
      value: String(filteredRows.length),
      detail: "Only rows with EDI available for that bank day are shown below.",
    },
    {
      label: "ERA Hits",
      value: String(eraData?.matchedFiles ?? 0),
      detail: "ERA files found in the 2.ERA folder for the selected bank day.",
    },
  ];

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
          A soft ERA conversion console for 835 review, handoff, and follow-up work.
        </p>

        <nav style={adminStyles.navStack} aria-label="ERA converter navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/tools")}>
            <span style={adminStyles.navButtonLabel}>Back</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Source</div>
          <div
            style={{
              ...adminStyles.sidebarCardValue,
              fontSize: "11px",
              lineHeight: 1.2,
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              maxWidth: "100%",
            }}
          >
            C:\Renfrew\Workflow\2.ERA
          </div>
          <div style={adminStyles.sidebarCardMeta}>
            ERA files are read from the 2.ERA folder, then renamed and moved into the completed folder for the selected posting day.
          </div>
        </div>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Posting Day</div>
          <label style={eraStyles.dateField}>
            <span style={eraStyles.dateFieldLabel}>Select date</span>
            <input
              style={eraStyles.dateInput}
              type="date"
              value={selectedDayIso}
              onChange={(event) => setSelectedDayIso(event.target.value)}
            />
          </label>
          <div style={adminStyles.sidebarCardMeta}>
            {activeBankDay ? `Bank day: ${activeBankDay}` : "No bank day mapped yet."}
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>ERAConvert screen</div>
            <p style={adminStyles.subtitle}>
              A calm workspace for ERA conversion, review, and follow-up.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.primaryButton} type="button" onClick={() => navigate("/835-upload")}>
                Open 835 Upload
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/banking")}>
                Open Banking
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>ERA window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>EDI by bank day</div>
              <div style={adminStyles.heroStatusText}>
                This page filters the banking spreadsheet down to rows that have EDI available for the selected posting day,
                then shows matching files from the 2.ERA folder below.
              </div>
            </div>
          </div>
        </section>

        <section style={eraStyles.convertCard}>
          <div style={eraStyles.convertCardTop}>
            <div>
              <div style={adminStyles.sectionKicker}>Convert</div>
              <h2 style={adminStyles.sectionTitle}>Rename the ERA files in 2.ERA</h2>
            </div>
            <div style={eraStyles.statusChip}>{convertStatusTag}</div>
          </div>
          <div style={adminStyles.sectionMeta}>
            Rename every matched ERA file using the selected posting day, then move the results to
            <span style={eraStyles.inlineCode}>2.ERA/Renamed</span>.
          </div>
          <div style={eraStyles.convertActions}>
            <button style={adminStyles.primaryButton} type="button" onClick={() => void handleConvert()} disabled={converting}>
              {converting ? "Converting..." : "Convert Files"}
            </button>
            <div style={eraStyles.convertMessage}>{convertStatusMessage}</div>
          </div>
          {convertResult && !converting && (
            <div style={eraStyles.convertSummary}>
              <span>{convertResult.renamedCount} file(s) renamed</span>
              <span>{convertResult.bankDay}</span>
            </div>
          )}
        </section>

        <section style={eraStyles.metricRow}>
          {metrics.map((metric) => (
            <article key={metric.label} style={{ ...adminStyles.statCard, ...eraStyles.metricCard }}>
              <div style={eraStyles.metricLabel}>{metric.label}</div>
              <div style={eraStyles.metricValue}>{metric.value}</div>
              <div style={eraStyles.metricDetail}>{metric.detail}</div>
            </article>
          ))}
        </section>

        <section style={eraStyles.tableSection}>
          <div style={eraStyles.tableHeader}>
            <button type="button" style={eraStyles.sectionHeaderButton} onClick={() => setBankTableCollapsed((current) => !current)}>
              <div style={eraStyles.sectionHeaderCopy}>
                <div style={adminStyles.sectionKicker}>EDI spreadsheet</div>
                <h2 style={{ ...adminStyles.sectionTitle, ...eraStyles.singleLineTitle }}>
                  Items with EDI available for the selected bank day
                </h2>
              </div>
              <div style={eraStyles.collapseChip}>{bankTableCollapsed ? "Expand" : "Collapse"}</div>
            </button>
            <div style={eraStyles.sectionMetaWrap}>
              <div style={adminStyles.sectionMeta}>
                {loading
                  ? "Loading banking and calendar data..."
                  : activeBankDay
                    ? `Showing check numbers for bank day ${activeBankDay}.`
                    : "Pick a posting day to load matching rows."}
              </div>
              <div style={eraStyles.subtotalStrip}>
                <div style={eraStyles.subtotalItem}>
                  <span style={eraStyles.subtotalLabel}>Rows</span>
                  <span style={eraStyles.subtotalValue}>{filteredRows.length}</span>
                </div>
                <div style={eraStyles.subtotalItem}>
                  <span style={eraStyles.subtotalLabel}>Subtotal</span>
                  <span style={eraStyles.subtotalValue}>{formatAmount(String(bankSubtotal))}</span>
                </div>
              </div>
            </div>
          </div>

          {error && <div style={eraStyles.errorBanner}>{error}</div>}

          {!error && !bankTableCollapsed && filteredRows.length === 0 && !loading && (
            <div style={eraStyles.emptyState}>
              No EDI rows were found for the selected posting day.
            </div>
          )}

          {!bankTableCollapsed && filteredRows.length > 0 && (
            <div style={eraStyles.tableWrap}>
              <table style={eraStyles.table}>
                <thead>
                  <tr>
                    <th style={eraStyles.th}>Source</th>
                    <th style={eraStyles.th}>Bank Day</th>
                    <th style={eraStyles.th}>Check Number</th>
                    <th style={eraStyles.th}>Payer</th>
                    <th style={eraStyles.th}>Amount</th>
                    <th style={eraStyles.thCenter}>EDI</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={`${row.source}-${row.checkNumber}-${row.payer}-${row.amount}`}>
                      <td style={eraStyles.td}>{row.source}</td>
                      <td style={eraStyles.td}>{row.date}</td>
                      <td style={eraStyles.td}>{row.checkNumber}</td>
                      <td style={eraStyles.td}>{row.payer || ""}</td>
                      <td style={eraStyles.td}>{formatAmount(row.amount)}</td>
                      <td style={eraStyles.tdCenter}>{row.edi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={eraStyles.tableSection}>
          <div style={eraStyles.tableHeader}>
            <button type="button" style={eraStyles.sectionHeaderButton} onClick={() => setEraTableCollapsed((current) => !current)}>
              <div style={eraStyles.sectionHeaderCopy}>
                <div style={adminStyles.sectionKicker}>2.ERA spreadsheet</div>
                <h2 style={{ ...adminStyles.sectionTitle, ...eraStyles.singleLineTitle }}>
                  Matched ERA files for the selected bank day
                </h2>
              </div>
              <div style={eraStyles.collapseChip}>{eraTableCollapsed ? "Expand" : "Collapse"}</div>
            </button>
            <div style={eraStyles.sectionMetaWrap}>
              <div style={adminStyles.sectionMeta}>
                {loadingEra
                  ? "Searching files in 2.ERA..."
                  : eraData?.bankDay
                    ? `${eraData.matchedFiles} file hit(s) across ${eraData.matchedChecks} check number(s).`
                    : "No ERA file matches yet."}
              </div>
              <div style={eraStyles.subtotalStrip}>
                <div style={eraStyles.subtotalItem}>
                  <span style={eraStyles.subtotalLabel}>Rows</span>
                  <span style={eraStyles.subtotalValue}>{eraSubtotal.rows}</span>
                </div>
                <div style={eraStyles.subtotalItem}>
                  <span style={eraStyles.subtotalLabel}>Checks</span>
                  <span style={eraStyles.subtotalValue}>{eraSubtotal.checks}</span>
                </div>
                <div style={eraStyles.subtotalItem}>
                  <span style={eraStyles.subtotalLabel}>Subtotal</span>
                  <span style={eraStyles.subtotalValue}>{formatAmount(String(eraSubtotal.amount))}</span>
                </div>
              </div>
            </div>
          </div>

          {!error && !loadingEra && !eraTableCollapsed && eraData && eraData.rows.length === 0 && (
            <div style={eraStyles.emptyState}>
              No files in 2.ERA matched the selected bank day.
            </div>
          )}

          {!eraTableCollapsed && eraData && eraData.rows.length > 0 && (
            <div style={eraStyles.tableWrap}>
              <table style={eraStyles.table}>
                <thead>
                  <tr>
                    <th style={eraStyles.th}>Source</th>
                    <th style={eraStyles.th}>Bank Day</th>
                    <th style={eraStyles.th}>Check Number</th>
                    <th style={eraStyles.th}>Payer</th>
                    <th style={eraStyles.th}>Amount</th>
                    <th style={eraStyles.th}>ERA File</th>
                  </tr>
                </thead>
                <tbody>
                  {eraData.rows.map((row) => (
                    <tr key={`${row.source}-${row.checkNumber}-${row.eraFile}`}>
                      <td style={eraStyles.td}>{row.source}</td>
                      <td style={eraStyles.td}>{row.bankDay}</td>
                      <td style={eraStyles.td}>{row.checkNumber}</td>
                      <td style={eraStyles.td}>{row.payer || ""}</td>
                      <td style={eraStyles.td}>{formatAmount(row.amount)}</td>
                      <td style={eraStyles.td}>{row.eraFile}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

const eraStyles: Record<string, CSSProperties> = {
  dateField: {
    display: "grid",
    gap: "6px",
    marginTop: "10px",
  },
  dateFieldLabel: {
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#597085",
  },
  dateInput: {
    minHeight: "42px",
    borderRadius: "14px",
    border: "1px solid rgba(171, 186, 207, 0.42)",
    background: "rgba(255,255,255,0.95)",
    color: "#17324f",
    padding: "0 12px",
    fontSize: "13px",
    fontWeight: 700,
    boxShadow: "0 10px 20px rgba(52, 84, 120, 0.05)",
    outline: "none",
  },
  tableSection: {
    display: "grid",
    gap: "16px",
    marginTop: "2px",
  },
  metricRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
    alignItems: "stretch",
    marginTop: "18px",
  },
  metricCard: {
    minWidth: 0,
    padding: "12px 14px",
  },
  metricLabel: {
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#597085",
    whiteSpace: "nowrap",
  },
  metricValue: {
    marginTop: "4px",
    fontSize: "14px",
    lineHeight: 1.15,
    fontWeight: 800,
    color: "#17324f",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  metricDetail: {
    marginTop: "4px",
    fontSize: "12px",
    lineHeight: 1.25,
    color: "#5a6c80",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  convertCard: {
    marginTop: "18px",
    borderRadius: "28px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.84)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
    padding: "18px",
    display: "grid",
    gap: "12px",
  },
  convertCardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  statusChip: {
    minHeight: "32px",
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid rgba(171, 186, 207, 0.42)",
    background: "rgba(245, 249, 255, 0.95)",
    color: "#385065",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.06em",
    display: "inline-flex",
    alignItems: "center",
  },
  convertActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "14px",
    alignItems: "center",
  },
  convertMessage: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#53687c",
  },
  convertSummary: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    fontSize: "12px",
    fontWeight: 800,
    color: "#17324f",
  },
  inlineCode: {
    marginLeft: "6px",
    padding: "2px 8px",
    borderRadius: "999px",
    background: "rgba(231, 240, 247, 0.96)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    fontFamily: "Consolas, monospace",
    fontSize: "12px",
    fontWeight: 800,
    color: "#17324f",
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  sectionHeaderButton: {
    appearance: "none",
    border: "0",
    background: "transparent",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "14px",
    flex: "1 1 420px",
    minWidth: 0,
    textAlign: "left",
  },
  sectionHeaderCopy: {
    minWidth: 0,
    display: "grid",
    gap: "2px",
  },
  singleLineTitle: {
    whiteSpace: "nowrap",
    fontSize: "18px",
    lineHeight: 1.1,
  },
  sectionMetaWrap: {
    display: "grid",
    gap: "10px",
    justifyItems: "end",
    flex: "1 1 320px",
  },
  collapseChip: {
    flexShrink: 0,
    minHeight: "32px",
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid rgba(171, 186, 207, 0.42)",
    background: "rgba(255,255,255,0.9)",
    color: "#385065",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.04em",
    display: "inline-flex",
    alignItems: "center",
  },
  subtotalStrip: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    justifyContent: "flex-end",
  },
  subtotalItem: {
    minWidth: "120px",
    borderRadius: "16px",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    background: "rgba(255,255,255,0.8)",
    padding: "10px 12px",
    display: "grid",
    gap: "2px",
  },
  subtotalLabel: {
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#6a7f95",
  },
  subtotalValue: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#17324f",
  },
  errorBanner: {
    borderRadius: "18px",
    border: "1px solid rgba(186, 92, 92, 0.2)",
    background: "rgba(255, 241, 241, 0.94)",
    color: "#8d2f2f",
    padding: "14px 16px",
    fontWeight: 700,
  },
  emptyState: {
    borderRadius: "22px",
    border: "1px dashed rgba(171, 186, 207, 0.55)",
    background: "rgba(255,255,255,0.72)",
    color: "#597085",
    padding: "18px 20px",
    fontWeight: 700,
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.84)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    minWidth: "860px",
  },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#597085",
    borderBottom: "1px solid rgba(140, 160, 184, 0.12)",
    background: "rgba(245, 248, 252, 0.9)",
  },
  thCenter: {
    textAlign: "center",
    padding: "14px 16px",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#597085",
    borderBottom: "1px solid rgba(140, 160, 184, 0.12)",
    background: "rgba(245, 248, 252, 0.9)",
  },
  td: {
    padding: "14px 16px",
    fontSize: "14px",
    color: "#17324f",
    borderBottom: "1px solid rgba(140, 160, 184, 0.08)",
  },
  tdCenter: {
    padding: "14px 16px",
    fontSize: "14px",
    color: "#17324f",
    borderBottom: "1px solid rgba(140, 160, 184, 0.08)",
    textAlign: "center",
    fontWeight: 800,
  },
};



