import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addCalendarDays,
  advanceCalendarWorkDay,
  buildCalendarFrom,
  deleteCalendarDays,
  getCalendarRange,
  getCalendarStatus,
  setCalendarWorkDay,
  setupCalendar,
  type CalendarRangeRow,
  type CalendarStatus,
} from "../api/calendar_api";

type WidgetTone = "blue" | "pink" | "mist" | "pearl";

interface WidgetCard {
  title: string;
  meta: string;
  tone: WidgetTone;
  action: string;
  onClick: () => void;
  footnote: string;
}

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

function formatMmddyyyy(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const year = value.getFullYear();
  return `${month}/${day}/${year}`;
}

function parseDateInput(value: string) {
  if (!value) return null;
  const parts = value.split("-").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const [year, month, day] = parts;
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function formatDateInput(value: string) {
  const parsed = parseMmddyyyy(value);
  if (!parsed) return "";
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${year}-${month}-${day}`;
}

function dateInputToMmddyyyy(value: string) {
  const parsed = parseDateInput(value);
  if (!parsed) return "";
  return formatMmddyyyy(parsed);
}

function shiftMmddyyyy(value: string, days: number) {
  const parsed = parseMmddyyyy(value);
  if (!parsed) return value;
  parsed.setDate(parsed.getDate() + days);
  return formatMmddyyyy(parsed);
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function todayMmddyyyy() {
  return formatMmddyyyy(new Date());
}

function isWeekendWeekday(value: string | null | undefined) {
  return value === "Sat" || value === "Sun";
}

export default function CalendarScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [rangeRows, setRangeRows] = useState<CalendarRangeRow[]>([]);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [setupDate, setSetupDate] = useState("");
  const [workDay, setWorkDay] = useState("");
  const [addDaysCount, setAddDaysCount] = useState("7");
  const [buildDaysCount, setBuildDaysCount] = useState("30");
  const [deleteStart, setDeleteStart] = useState("");
  const [deleteEnd, setDeleteEnd] = useState("");
  const [dangerConfirm, setDangerConfirm] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingRange, setLoadingRange] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const widgets: WidgetCard[] = useMemo(
    () => [
      {
        title: "Setup",
        meta: "Reset the calendar and anchor the first open post day.",
        tone: "blue",
        action: "Prepare Setup",
        onClick: () => runSetup(),
        footnote: "Destructive",
      },
      {
        title: "Add Days",
        meta: "Extend the calendar by the chosen number of days.",
        tone: "pink",
        action: "Add Days",
        onClick: () => runAddDays(),
        footnote: "Build",
      },
      {
        title: "Build From",
        meta: "Reset and build a new calendar run from the anchor day.",
        tone: "mist",
        action: "Build Calendar",
        onClick: () => runBuildFrom(),
        footnote: "Destructive",
      },
      {
        title: "Advance Work Day",
        meta: "Move the current work day to the next open post day.",
        tone: "pearl",
        action: "Advance",
        onClick: () => runAdvanceWorkDay(),
        footnote: "Flow",
      },
    ],
    [addDaysCount, buildDaysCount, dangerConfirm, deleteEnd, deleteStart, setupDate, workDay, rangeStart, rangeEnd, status]
  );

  useEffect(() => {
    refreshStatus();
  }, []);

  useEffect(() => {
    if (!status) return;

    const defaultStart = status.currentWorkDay || status.today || todayMmddyyyy();
    const defaultEnd = shiftMmddyyyy(defaultStart, 14);

    setSetupDate((current) => current || defaultStart);
    setWorkDay((current) => current || defaultStart);
    setDeleteStart((current) => current || defaultStart);
    setDeleteEnd((current) => current || defaultEnd);
    setRangeStart((current) => current || defaultStart);
    setRangeEnd((current) => current || defaultEnd);
  }, [status]);

  async function refreshStatus() {
    setLoadingStatus(true);
    try {
      const response = await getCalendarStatus();
      setStatus(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar status");
    } finally {
      setLoadingStatus(false);
    }
  }

  async function refreshRange(start = rangeStart, end = rangeEnd) {
    if (!start || !end) {
      setError("Please enter both range dates");
      return;
    }

    setLoadingRange(true);
    try {
      const response = await getCalendarRange(start, end);
      setRangeRows(response.data.rows);
      setError(null);
      setMessage(`Loaded range ${response.data.start} to ${response.data.end}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar range");
    } finally {
      setLoadingRange(false);
    }
  }

  async function runSetup() {
    if (dangerConfirm !== "confirm") {
      setError('Type "confirm" before resetting the calendar.');
      return;
    }

    if (!setupDate) {
      setError("Enter a setup start date.");
      return;
    }

    try {
      const response = await setupCalendar(setupDate);
      setStatus(response.data);
      setMessage(`Calendar reset at ${setupDate}.`);
      setDangerConfirm("");
      await refreshRange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset calendar");
    }
  }

  async function runAddDays() {
    const count = Number.parseInt(addDaysCount, 10);
    if (!Number.isFinite(count) || count <= 0) {
      setError("Enter a positive number of days to add.");
      return;
    }

    try {
      const response = await addCalendarDays(count);
      setStatus(response.data);
      setMessage(`Added ${count} day(s) to the calendar.`);
      await refreshRange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add days");
    }
  }

  async function runBuildFrom() {
    if (dangerConfirm !== "confirm") {
      setError('Type "confirm" before rebuilding the calendar.');
      return;
    }

    const count = Number.parseInt(buildDaysCount, 10);
    if (!setupDate) {
      setError("Enter a build-from start date.");
      return;
    }
    if (!Number.isFinite(count) || count <= 0) {
      setError("Enter a positive number of days to build.");
      return;
    }

    try {
      const response = await buildCalendarFrom(setupDate, count);
      setStatus(response.data);
      setMessage(`Built calendar from ${setupDate} with ${count} day(s).`);
      setDangerConfirm("");
      await refreshRange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build calendar");
    }
  }

  async function runDeleteDays() {
    if (dangerConfirm !== "confirm") {
      setError('Type "confirm" before deleting calendar days.');
      return;
    }

    if (!deleteStart || !deleteEnd) {
      setError("Enter both start and end dates for deletion.");
      return;
    }

    try {
      const response = await deleteCalendarDays(deleteStart, deleteEnd);
      setStatus(response.data);
      setMessage(`Deleted calendar days from ${deleteStart} to ${deleteEnd}.`);
      setDangerConfirm("");
      await refreshRange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete days");
    }
  }

  async function runSetWorkDay() {
    if (!workDay) {
      setError("Enter a work day to set.");
      return;
    }

    try {
      const response = await setCalendarWorkDay(workDay);
      setStatus(response.data);
      setMessage(`Current work day set to ${workDay}.`);
      await refreshRange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set work day");
    }
  }

  async function runAdvanceWorkDay() {
    try {
      const response = await advanceCalendarWorkDay();
      setStatus(response.data);
      setMessage("Advanced to the next open work day.");
      await refreshRange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to advance work day");
    }
  }

  const statusCards = [
    {
      label: "Today",
      value: status?.today ?? "Loading...",
      detail: "System date used to compare against post days.",
    },
    {
      label: "Current Work Day",
      value: status?.currentWorkDay ?? "Not set",
      detail: status?.currentBankDay ? `Bank day: ${status.currentBankDay}` : "No bank day mapped yet.",
    },
    {
      label: "Next Open Day",
      value: status?.nextOpenWorkDay ?? "None",
      detail: "Next open post day after the current work day.",
    },
    {
      label: "Calendar Count",
      value: status ? `${status.totalDays}` : "Loading...",
      detail: status ? `${status.openDays} open / ${status.closedDays} closed` : "Rows in the calendar table.",
    },
  ];

  return (
    <main style={styles.shell}>
      <div style={styles.glowBlue} />
      <div style={styles.glowPink} />

      <aside style={styles.sidebar}>
        <div style={styles.brandWrap}>
          <div style={styles.brandMark} aria-hidden="true">
            <img src="/favicon.svg" alt="" style={styles.brandMarkImage} />
          </div>
          <div style={styles.brandWomenMark} aria-hidden="true">
            <img src="/renfrew-womenline.png" alt="" style={styles.brandWomenImage} />
          </div>
        </div>

        <p style={styles.sidebarCopy}>
          Calendar manager for bank days, current work day, and live source-table totals.
        </p>

        <nav style={styles.navStack} aria-label="Calendar navigation">
          <button className="sidebar-nav-button" style={styles.navButton} type="button" onClick={() => navigate("/")}>
            <span style={styles.navButtonLabel}>Main</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={styles.sidebarCard}>
          <div style={styles.sidebarCardLabel}>Status</div>
          <div style={styles.sidebarCardValue}>{status?.currentWorkDay ?? "No work day"}</div>
          <div style={styles.sidebarCardMeta}>
            {status?.lastBankDay ? `Last bank day: ${status.lastBankDay}` : "No calendar rows loaded yet."}
          </div>
        </div>
      </aside>

      <section style={styles.content}>
        <section style={styles.heroShell}>
          <div style={styles.heroCopy}>
            <div style={styles.kicker}>Calendar manager</div>
            <p style={styles.subtitle}>
              A live calendar workspace that mirrors the manager commands and uses on-the-fly source totals instead of derivative EDI/PSC tables.
            </p>

            <div style={styles.heroActions}>
              <button style={styles.primaryButton} type="button" onClick={() => refreshStatus()}>
                Refresh Status
              </button>
              <button style={styles.secondaryButton} type="button" onClick={() => refreshRange()}>
                Refresh Range
              </button>
            </div>
          </div>

          <div style={styles.heroArt}>
            <div style={styles.heroStatusCard}>
              <div style={styles.heroStatusTop}>
                <span style={styles.statusPill}>Live calendar</span>
                <span style={styles.statusDot} />
              </div>
              <div style={styles.heroStatusTitle}>Calendar core only</div>
              <div style={styles.heroStatusText}>
                This view keeps the calendar, work state, and live Lockbox/EFT totals. The old derivative fields are intentionally excluded.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          {statusCards.map((stat) => (
            <article key={stat.label} style={styles.statCard}>
              <div style={styles.statLabel}>{stat.label}</div>
              <div style={styles.statValue}>{stat.value}</div>
              <div style={styles.statDetail}>{stat.detail}</div>
            </article>
          ))}
        </section>

        <section style={styles.widgetSection}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionKicker}>Calendar actions</div>
              <h2 style={styles.sectionTitle}>Manager controls</h2>
            </div>
            <div style={styles.sectionMeta}>
              Setup and build actions require the word `confirm`. Add and work-day actions are immediate.
            </div>
          </div>

          <div style={styles.widgetGrid}>
            {widgets.map((widget) => (
              <button
                key={widget.title}
                type="button"
                onClick={widget.onClick}
                style={{
                  ...styles.widgetCard,
                  ...toneStyles[widget.tone],
                }}
              >
                <div style={styles.widgetTop}>
                  <div style={styles.widgetBadge}>{widget.footnote}</div>
                </div>
                <div style={styles.widgetBody}>
                  <div style={styles.widgetTitle}>{widget.title}</div>
                  <div style={styles.widgetMeta}>{widget.meta}</div>
                </div>
                <div style={styles.widgetAction}>{widget.action}</div>
              </button>
            ))}
          </div>
        </section>

        <section style={styles.controlsGrid}>
          <article style={styles.controlCard}>
            <div style={styles.controlTitle}>Setup / Build</div>
            <label style={styles.fieldLabel}>
              Start date
              <input
                style={styles.textInput}
                type="date"
                value={formatDateInput(setupDate)}
                onChange={(event) => setSetupDate(dateInputToMmddyyyy(event.target.value))}
              />
            </label>
            <label style={styles.fieldLabel}>
              Days to add/build
              <input
                style={styles.textInput}
                value={buildDaysCount}
                onChange={(event) => setBuildDaysCount(event.target.value)}
                inputMode="numeric"
              />
            </label>
            <label style={styles.fieldLabel}>
              Type confirm for destructive actions
              <input
                style={styles.textInput}
                value={dangerConfirm}
                onChange={(event) => setDangerConfirm(event.target.value)}
                placeholder="confirm"
              />
            </label>
            <div style={styles.rowActions}>
              <button type="button" style={styles.primaryButton} onClick={runSetup}>
                Setup
              </button>
              <button type="button" style={styles.secondaryButton} onClick={runBuildFrom}>
                Build From
              </button>
            </div>
          </article>

          <article style={styles.controlCard}>
            <div style={styles.controlTitle}>Add / Work Day</div>
            <label style={styles.fieldLabel}>
              Days to add
              <input
                style={styles.textInput}
                value={addDaysCount}
                onChange={(event) => setAddDaysCount(event.target.value)}
                inputMode="numeric"
              />
            </label>
            <label style={styles.fieldLabel}>
              Current work day
              <input
                style={styles.textInput}
                type="date"
                value={formatDateInput(workDay)}
                onChange={(event) => setWorkDay(dateInputToMmddyyyy(event.target.value))}
              />
            </label>
            <div style={styles.rowActions}>
              <button type="button" style={styles.primaryButton} onClick={runAddDays}>
                Add Days
              </button>
              <button type="button" style={styles.secondaryButton} onClick={runSetWorkDay}>
                Set Work Day
              </button>
              <button type="button" style={styles.secondaryButton} onClick={runAdvanceWorkDay}>
                Advance Work Day
              </button>
            </div>
          </article>

          <article style={styles.controlCard}>
            <div style={styles.controlTitle}>Delete Range</div>
            <label style={styles.fieldLabel}>
              From
              <input
                style={styles.textInput}
                type="date"
                value={formatDateInput(deleteStart)}
                onChange={(event) => setDeleteStart(dateInputToMmddyyyy(event.target.value))}
              />
            </label>
            <label style={styles.fieldLabel}>
              To
              <input
                style={styles.textInput}
                type="date"
                value={formatDateInput(deleteEnd)}
                onChange={(event) => setDeleteEnd(dateInputToMmddyyyy(event.target.value))}
              />
            </label>
            <div style={styles.rowActions}>
              <button type="button" style={styles.primaryButton} onClick={runDeleteDays}>
                Delete Days
              </button>
            </div>
          </article>
        </section>

        <section style={styles.rangeShell}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionKicker}>Calendar range</div>
              <h2 style={styles.sectionTitle}>Live range with on-the-fly cashing totals</h2>
            </div>
            <div style={styles.sectionMeta}>
              Lockbox and EFT totals are computed directly from the source tables. No EDI MatchResults or PostingScreenCapture is used here.
            </div>
          </div>

          <div style={styles.rangeControls}>
            <label style={styles.fieldLabel}>
              Start
              <input
                style={styles.textInput}
                type="date"
                value={formatDateInput(rangeStart)}
                onChange={(event) => setRangeStart(dateInputToMmddyyyy(event.target.value))}
              />
            </label>
            <label style={styles.fieldLabel}>
              End
              <input
                style={styles.textInput}
                type="date"
                value={formatDateInput(rangeEnd)}
                onChange={(event) => setRangeEnd(dateInputToMmddyyyy(event.target.value))}
              />
            </label>
            <button type="button" style={styles.primaryButton} onClick={() => refreshRange()}>
              Load Range
            </button>
          </div>

          {message && <div style={styles.successText}>{message}</div>}
          {error && <div style={styles.errorText}>{error}</div>}
          {loadingStatus && <div style={styles.statusText}>Loading calendar status...</div>}
          {loadingRange && <div style={styles.statusText}>Loading range...</div>}

          <div style={styles.tableWrap}>
            <table style={styles.dataTable}>
              <thead>
                <tr>
                  <th style={styles.headerCell}>Bank Day</th>
                  <th style={styles.headerCell}>WKD</th>
                  <th style={styles.headerCell}>Closed</th>
                  <th style={styles.headerCell}>Post Day</th>
                  <th style={styles.headerCell}>Reason</th>
                  <th style={styles.headerCell}>Lockbox</th>
                  <th style={styles.headerCell}>EFT</th>
                  <th style={styles.headerCell}>Combined</th>
                </tr>
              </thead>
              <tbody>
                {rangeRows.map((row) => (
                  <tr
                    key={row.bankDay}
                    style={{
                      ...(isWeekendWeekday(row.weekday) ? styles.weekendRow : {}),
                      ...(row.isCurrentWorkDay ? styles.highlightRow : {}),
                    }}
                  >
                    <td style={styles.bodyCell}>{row.bankDay}</td>
                    <td style={styles.bodyCell}>{row.weekday ?? ""}</td>
                    <td style={styles.bodyCell}>{row.isClosed ? "Yes" : "No"}</td>
                    <td style={styles.bodyCell}>{row.paperworkDay ?? ""}</td>
                    <td style={styles.bodyCell}>{row.closureReason}</td>
                    <td style={styles.bodyCell}>
                      {formatMoney(row.lockboxTotal)} ({row.lockboxCount})
                    </td>
                    <td style={styles.bodyCell}>
                      {formatMoney(row.eftTotal)} ({row.eftCount})
                    </td>
                    <td style={styles.bodyCell}>{formatMoney(row.combinedTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rangeRows.length && !loadingRange && (
            <div style={styles.emptyState}>
              Load a range to see calendar rows and live cashing totals.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: "100vh",
    padding: "18px",
    display: "grid",
    gridTemplateColumns: "250px minmax(0, 1fr)",
    gap: "18px",
    position: "relative",
    overflow: "hidden",
    color: "#16304d",
  },
  glowBlue: {
    position: "absolute",
    top: "-120px",
    left: "-120px",
    width: "360px",
    height: "360px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(146, 198, 255, 0.45) 0%, rgba(146, 198, 255, 0) 70%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  glowPink: {
    position: "absolute",
    right: "-100px",
    top: "110px",
    width: "320px",
    height: "320px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255, 186, 213, 0.42) 0%, rgba(255, 186, 213, 0) 72%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },
  sidebar: {
    position: "relative",
    zIndex: 1,
    padding: "18px 16px",
    borderRadius: "28px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.72)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.10)",
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    justifyContent: "flex-start",
    paddingBottom: "14px",
    marginBottom: "16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.18)",
  },
  brandMark: {
    width: "52px",
    height: "52px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.76)",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    boxShadow: "0 12px 22px rgba(95, 128, 172, 0.08)",
    overflow: "hidden",
    flexShrink: 0,
  },
  brandMarkImage: {
    width: "88%",
    height: "88%",
    objectFit: "contain",
    objectPosition: "center",
  },
  brandWomenMark: {
    width: "104px",
    height: "52px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.64)",
    border: "1px solid rgba(140, 160, 184, 0.10)",
    boxShadow: "0 10px 18px rgba(95, 128, 172, 0.06)",
    overflow: "hidden",
    flexShrink: 0,
  },
  brandWomenImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  sidebarCopy: {
    margin: "0 0 16px",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#516579",
  },
  navStack: {
    display: "grid",
    gap: "10px",
  },
  navButton: {
    height: "46px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    borderRadius: "16px",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(236,245,255,0.95) 54%, rgba(255,236,244,0.92) 100%)",
    color: "#16304d",
    textAlign: "left",
    padding: "0 14px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 12px 26px rgba(52, 84, 120, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    letterSpacing: "0.01em",
  },
  navButtonLabel: {
    fontSize: "14px",
    fontWeight: 800,
  },
  navButtonGlyph: {
    width: "22px",
    height: "22px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.76)",
    color: "#8aa5c6",
    fontSize: "12px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
  },
  sidebarCard: {
    marginTop: "18px",
    padding: "16px",
    borderRadius: "20px",
    background: "linear-gradient(135deg, rgba(235, 245, 255, 0.95) 0%, rgba(255, 234, 243, 0.90) 100%)",
    border: "1px solid rgba(176, 194, 218, 0.22)",
  },
  sidebarCardLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
    marginBottom: "8px",
  },
  sidebarCardValue: {
    fontSize: "18px",
    fontWeight: 800,
    marginBottom: "8px",
  },
  sidebarCardMeta: {
    fontSize: "13px",
    lineHeight: 1.55,
    color: "#5d7187",
  },
  content: {
    position: "relative",
    zIndex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  heroShell: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, 0.9fr)",
    gap: "18px",
    alignItems: "stretch",
    padding: "24px",
    borderRadius: "32px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    background: "linear-gradient(135deg, rgba(255,255,255,0.90) 0%, rgba(248,250,253,0.88) 50%, rgba(255,244,248,0.92) 100%)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.08)",
  },
  heroCopy: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: 0,
  },
  kicker: {
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: "12px",
    fontWeight: 800,
    color: "#74879c",
    marginBottom: "10px",
  },
  subtitle: {
    margin: "8px 0 0",
    maxWidth: "760px",
    fontSize: "16px",
    lineHeight: 1.7,
    color: "#536579",
  },
  heroActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "20px",
  },
  primaryButton: {
    height: "44px",
    padding: "0 18px",
    borderRadius: "14px",
    border: "1px solid rgba(106, 137, 180, 0.24)",
    background: "linear-gradient(135deg, #dbeeff 0%, #c6ddfb 100%)",
    color: "#15304f",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 14px 24px rgba(119, 151, 198, 0.16)",
  },
  secondaryButton: {
    height: "44px",
    padding: "0 18px",
    borderRadius: "14px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    background: "rgba(255,255,255,0.9)",
    color: "#35506d",
    fontWeight: 800,
    cursor: "pointer",
  },
  heroArt: {
    display: "grid",
    gap: "14px",
    alignContent: "center",
  },
  heroStatusCard: {
    borderRadius: "24px",
    padding: "18px",
    background: "linear-gradient(135deg, rgba(243, 248, 255, 0.95) 0%, rgba(255, 239, 245, 0.92) 100%)",
    border: "1px solid rgba(175, 193, 218, 0.22)",
  },
  heroStatusTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    height: "30px",
    padding: "0 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(158, 176, 204, 0.22)",
    fontSize: "12px",
    fontWeight: 800,
    color: "#4a6179",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#8ec4ff",
    boxShadow: "0 0 0 6px rgba(142, 196, 255, 0.18)",
  },
  heroStatusTitle: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#16304d",
    marginBottom: "8px",
  },
  heroStatusText: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#5a6c80",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "16px",
  },
  statCard: {
    padding: "18px",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.84)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
  },
  statLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#72859a",
    marginBottom: "10px",
    fontWeight: 800,
  },
  statValue: {
    fontSize: "20px",
    fontWeight: 800,
    color: "#17324f",
    marginBottom: "8px",
    overflowWrap: "anywhere",
  },
  statDetail: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#597085",
  },
  widgetSection: {
    padding: "20px",
    borderRadius: "30px",
    background: "rgba(255,255,255,0.74)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 20px 42px rgba(52, 84, 120, 0.06)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "16px",
  },
  sectionKicker: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#74879c",
    fontWeight: 800,
    marginBottom: "8px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "24px",
    color: "#17324f",
  },
  sectionMeta: {
    maxWidth: "420px",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#5e7186",
    textAlign: "right",
  },
  widgetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },
  widgetCard: {
    minHeight: "168px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    padding: "18px",
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxShadow: "0 16px 34px rgba(52, 84, 120, 0.06)",
  },
  widgetTop: {
    display: "flex",
    justifyContent: "flex-start",
  },
  widgetBadge: {
    display: "inline-flex",
    alignItems: "center",
    height: "28px",
    padding: "0 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.7)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    color: "#50657a",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  widgetBody: {
    display: "grid",
    gap: "8px",
  },
  widgetTitle: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#17324f",
  },
  widgetMeta: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#566a7f",
  },
  widgetAction: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#35506d",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  controlsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
  },
  controlCard: {
    padding: "18px",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.84)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
    display: "grid",
    gap: "10px",
  },
  controlTitle: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#17324f",
  },
  fieldLabel: {
    display: "grid",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#496177",
  },
  textInput: {
    height: "42px",
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    background: "rgba(255,255,255,0.88)",
    padding: "0 14px",
    fontSize: "14px",
    color: "#17324f",
    outline: "none",
  },
  rowActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "4px",
  },
  rangeShell: {
    padding: "20px",
    borderRadius: "30px",
    background: "rgba(255,255,255,0.74)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 20px 42px rgba(52, 84, 120, 0.06)",
    display: "grid",
    gap: "14px",
  },
  rangeControls: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "end",
  },
  tableWrap: {
    overflow: "auto",
    borderRadius: "22px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.92)",
    minHeight: 0,
  },
  dataTable: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "100%",
  },
  headerCell: {
    position: "sticky",
    top: 0,
    background: "#edf4fb",
    color: "#17324f",
    textAlign: "left",
    padding: "12px 10px",
    fontSize: "13px",
    fontWeight: 800,
    borderBottom: "1px solid rgba(140, 160, 184, 0.2)",
    whiteSpace: "nowrap",
  },
  bodyCell: {
    padding: "10px",
    fontSize: "13px",
    color: "#32485f",
    borderBottom: "1px solid rgba(228, 234, 242, 0.9)",
    verticalAlign: "top",
    whiteSpace: "nowrap",
  },
  highlightRow: {
    background: "rgba(227, 242, 255, 0.68)",
  },
  weekendRow: {
    background: "rgba(243, 245, 248, 0.94)",
    color: "#6a7582",
  },
  emptyState: {
    padding: "16px",
    borderRadius: "18px",
    border: "1px dashed rgba(156, 174, 197, 0.35)",
    background: "rgba(248, 251, 255, 0.9)",
    color: "#5b6f84",
    fontSize: "14px",
  },
  statusText: {
    padding: "12px 14px",
    borderRadius: "16px",
    background: "rgba(243, 248, 255, 0.9)",
    color: "#35506d",
    fontSize: "14px",
  },
  successText: {
    padding: "12px 14px",
    borderRadius: "16px",
    background: "rgba(232, 249, 239, 0.95)",
    color: "#1f6a43",
    fontSize: "14px",
  },
  errorText: {
    padding: "12px 14px",
    borderRadius: "16px",
    background: "rgba(255, 237, 237, 0.9)",
    color: "#8f1f1f",
    fontSize: "14px",
  },
};

const toneStyles: Record<WidgetTone, CSSProperties> = {
  blue: {
    background: "linear-gradient(145deg, rgba(229, 244, 255, 0.96) 0%, rgba(252, 252, 255, 0.92) 100%)",
  },
  pink: {
    background: "linear-gradient(145deg, rgba(255, 235, 245, 0.96) 0%, rgba(255, 252, 254, 0.92) 100%)",
  },
  mist: {
    background: "linear-gradient(145deg, rgba(240, 245, 250, 0.96) 0%, rgba(252, 253, 255, 0.92) 100%)",
  },
  pearl: {
    background: "linear-gradient(145deg, rgba(251, 247, 242, 0.96) 0%, rgba(255, 254, 252, 0.92) 100%)",
  },
};
