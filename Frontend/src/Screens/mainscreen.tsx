import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { getBankingSpreadsheet, type BankingSpreadsheetResponse } from "../api/banking_api";
import { getBalsheet, getBalsheetWorkday, type BalsheetEntry, type BalsheetWorkday } from "../api/balsheet_api";
import { getCalendarRange, type CalendarRangeRow } from "../api/calendar_api";

type DayTotals = {
  total: number;
  eft: number;
  lockbox: number;
};

type ProjectionSummary = {
  totalReceived: number;
  averagePerBankDay: number;
  receivedDays: number;
  projectedDays: number;
  projectedEndTotal: number;
  lastActualDay: string;
  missingDays: string[];
};

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const shortDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
});

export default function MainScreen() {
  const navigate = useNavigate();
  const [bankingData, setBankingData] = useState<BankingSpreadsheetResponse | null>(null);
  const [calendarRows, setCalendarRows] = useState<CalendarRangeRow[]>([]);
  const [balsheetRows, setBalsheetRows] = useState<BalsheetEntry[]>([]);
  const [workday, setWorkday] = useState<BalsheetWorkday | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentMonth = useMemo(() => new Date(), []);
  const monthRange = useMemo(() => getMonthRange(currentMonth), [currentMonth]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [bankingResponse, calendarResponse, balsheetResponse, workdayResponse] = await Promise.all([
          getBankingSpreadsheet(),
          getCalendarRange(monthRange.start, monthRange.end),
          getBalsheet(),
          getBalsheetWorkday(),
        ]);

        if (!active) {
          return;
        }

        setBankingData(bankingResponse.data);
        setCalendarRows(calendarResponse.data.rows ?? []);
        setBalsheetRows(balsheetResponse.data ?? []);
        setWorkday(workdayResponse.data);
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load the main screen snapshot.");
        }
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
  }, [monthRange.end, monthRange.start]);

  const projection = useMemo(() => {
    return buildProjectionSummary(calendarRows, bankingData);
  }, [bankingData, calendarRows]);

  const snapshot = useMemo(() => {
    return buildSnapshotSummary(bankingData, balsheetRows, workday);
  }, [bankingData, balsheetRows, workday]);

  const currentMonthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      }).format(currentMonth),
    [currentMonth]
  );

  return (
    <AdminShell
      sidebarCopy="A soft, polished command center for the review flow, balance sheet, and completed batches."
      onBack={() => navigate("/")}
      hideBackButton
      useGlobalMenuFallback={false}
      ribbonTitle="Main Menu"
    >
      <section style={styles.content}>
        <section style={styles.heroShell}>
          <div style={styles.heroCopy}>
            <div style={styles.kicker}>Main screen</div>
            <div style={styles.heroWordmarkWrap}>
              <img
                src="/renfrewplus-banner.png"
                alt="RenfrewPlus wordmark"
                style={styles.heroWordmark}
              />
            </div>
            <p style={styles.subtitle}>
              A calm workspace for review, approvals, and balance-sheet work.
            </p>
          </div>

          <div style={styles.heroArt}>
            <div style={styles.heroLogoCard}>
              <img
                src="/renfrew-womenline.png"
                alt="Renfrew girls holding hands mark"
                style={styles.heroLogoImage}
              />
            </div>

            <div style={styles.heroStatusCard}>
              <div style={styles.heroStatusTop}>
                <span style={styles.statusPill}>Live workspace</span>
                <span style={styles.statusDot} />
              </div>
              <div style={styles.heroStatusTitle}>Soft launch look</div>
              <div style={styles.heroStatusText}>
                Baby blue, pink, and light grey for a calmer first impression.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.financeSection}>
          <div style={styles.financeHeader}>
            <div>
              <div style={styles.sectionKicker}>Financial snapshot</div>
              <h2 style={styles.sectionTitle}>{currentMonthLabel}</h2>
            </div>
            <div style={styles.sectionMeta}>
              Current month projection and file snapshot, presented in the same footprint as the
              previous finance widget.
            </div>
          </div>

          {loading ? (
            <div style={styles.stateCard}>Loading banking, calendar, and balance-sheet data...</div>
          ) : error ? (
            <div style={styles.stateCard}>{error}</div>
          ) : (
            <div style={styles.financeGrid}>
              <article style={styles.financeCard}>
                <div style={styles.cardTopRow}>
                  <span style={styles.cardBadge}>Projection</span>
                  <span style={styles.cardSubtle}>{projection.receivedDays} bank day(s) received</span>
                </div>
                <div style={styles.cardTitle}>Average collected per bank day</div>

                <div style={styles.metricHero}>
                  <div style={styles.metricValue}>{formatCurrency(projection.averagePerBankDay)}</div>
                  <div style={styles.metricLabel}>Average per bank day</div>
                </div>

                <div style={styles.metricRow}>
                  <Metric label="Received" value={formatCurrency(projection.totalReceived)} />
                  <Metric label="Projected days" value={String(projection.projectedDays)} />
                  <Metric label="End number" value={formatCurrency(projection.projectedEndTotal)} accent />
                </div>

                <div style={styles.cardFoot}>
                  <div>
                    <span style={styles.footLabel}>Last actual bank day</span>
                    <div style={styles.footValue}>{formatDate(projection.lastActualDay)}</div>
                  </div>
                  <div>
                    <span style={styles.footLabel}>Projected bank days remaining</span>
                    <div style={styles.footValue}>{projection.projectedDays}</div>
                  </div>
                </div>
                <div style={styles.compactNote}>
                  {projection.missingDays.length > 0
                    ? `Missing days: ${projection.missingDays.slice(0, 4).map((day) => formatDate(day)).join(" · ")}`
                    : "No missing bank days remain in the month."}
                </div>
              </article>

              <article style={styles.financeCard}>
                <div style={styles.cardTopRow}>
                  <span style={styles.cardBadge}>Snapshot</span>
                  <span style={styles.cardSubtle}>Current file state</span>
                </div>
                <div style={styles.cardTitle}>Latest file dates</div>

                <div style={styles.snapshotList}>
                  <SnapshotRow label="Latest balsheet" value={snapshot.latestBalsheetDate} />
                  <SnapshotRow label="Latest EFT" value={snapshot.lastEftDate} />
                  <SnapshotRow label="Latest Lockbox" value={snapshot.lastLockboxDate} />
                  <SnapshotRow label="Latest EDI" value={snapshot.lastEdiDate} />
                </div>

                <div style={styles.snapshotFooter}>
                  <span style={styles.emptyNote}>Snapshot only. It does not change any files.</span>
                </div>
              </article>
            </div>
          )}
        </section>
      </section>
    </AdminShell>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ ...styles.metricBox, ...(accent ? styles.metricBoxAccent : undefined) }}>
      <div style={styles.metricBoxLabel}>{label}</div>
      <div style={styles.metricBoxValue}>{value}</div>
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.snapshotRow}>
      <div style={styles.snapshotLabel}>{label}</div>
      <div style={styles.snapshotValue}>{formatSnapshotValue(value)}</div>
    </div>
  );
}

function buildProjectionSummary(
  calendarRows: CalendarRangeRow[],
  bankingData: BankingSpreadsheetResponse | null
): ProjectionSummary {
  const actualByDay = new Map<string, DayTotals>();
  const currentMonthDays = new Set(
    calendarRows
      .filter((row) => !row.isClosed && row.bankDay)
      .map((row) => row.bankDay)
  );

  for (const group of bankingData?.groups ?? []) {
    for (const row of group.rows) {
      const day = normalizeBankDate(row.date);
      if (!day || !currentMonthDays.has(day)) {
        continue;
      }

      const amount = parseMoney(row.amount);
      const existing = actualByDay.get(day) ?? { total: 0, eft: 0, lockbox: 0 };
      existing.total += amount;
      if (group.source === "EFT") {
        existing.eft += amount;
      } else {
        existing.lockbox += amount;
      }
      actualByDay.set(day, existing);
    }
  }

  const openDays = calendarRows
    .filter((row) => !row.isClosed && row.bankDay)
    .map((row) => row.bankDay)
    .filter((day): day is string => Boolean(day))
    .sort(compareMmddyyyy);

  const receivedDays = openDays.filter((day) => (actualByDay.get(day)?.total ?? 0) > 0);
  const totalReceived = receivedDays.reduce((total, day) => total + (actualByDay.get(day)?.total ?? 0), 0);
  const averagePerBankDay = receivedDays.length > 0 ? totalReceived / receivedDays.length : 0;
  const lastActualDay = receivedDays.at(-1) ?? "";
  const missingDays =
    lastActualDay === ""
      ? []
      : openDays.filter((day) => compareMmddyyyy(day, lastActualDay) > 0 && !actualByDay.has(day));
  const projectedDays = missingDays.length;
  const projectedEndTotal = totalReceived + averagePerBankDay * projectedDays;

  return {
    totalReceived,
    averagePerBankDay,
    receivedDays: receivedDays.length,
    projectedDays,
    projectedEndTotal,
    lastActualDay,
    missingDays,
  };
}

function buildSnapshotSummary(
  bankingData: BankingSpreadsheetResponse | null,
  balsheetRows: BalsheetEntry[],
  workday: BalsheetWorkday | null
) {
  const summary = new Map((bankingData?.summary ?? []).map((item) => [item.source, item]));
  const latestBalsheetDate = balsheetRows.reduce((latest, row) => {
    const current = normalizeBankDate(row.posting_date);
    if (!current) {
      return latest;
    }
    if (!latest) {
      return current;
    }
    return compareMmddyyyy(current, latest) > 0 ? current : latest;
  }, "");

  return {
    postingDate: workday?.posting_date || workday?.current_work_day || workday?.current_bank_day || "",
    lastEftDate: summary.get("EFT")?.lastDate || "",
    lastLockboxDate: summary.get("Lockbox")?.lastDate || "",
    lastEdiDate: summary.get("EDI")?.lastDate || "",
    latestBalsheetDate,
  };
}

function parseMoney(value: string) {
  if (value.trim() === "") {
    return 0;
  }

  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatCurrency(value: number) {
  return moneyFmt.format(value);
}

function formatDate(value: string) {
  const parsed = parseMmddyyyy(value);
  return parsed ? shortDateFmt.format(parsed) : "No date";
}

function formatSnapshotValue(value: string) {
  return value ? formatDate(value) : "No date on file";
}

function normalizeBankDate(value: string) {
  return parseMmddyyyy(value) ? formatMmddyyyy(parseMmddyyyy(value) as Date) : "";
}

function parseMmddyyyy(value: string) {
  const trimmed = value.trim();
  const mmddyyyy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMmddyyyy(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const year = value.getFullYear();
  return `${month}/${day}/${year}`;
}

function compareMmddyyyy(left: string, right: string) {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return -1;
  }
  if (!right) {
    return 1;
  }

  const leftTime = parseMmddyyyy(left)?.getTime() ?? Number.NEGATIVE_INFINITY;
  const rightTime = parseMmddyyyy(right)?.getTime() ?? Number.NEGATIVE_INFINITY;
  return leftTime - rightTime;
}

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: formatMmddyyyy(start),
    end: formatMmddyyyy(end),
  };
}

export const styles: Record<string, CSSProperties> = {
  content: {
    position: "relative",
    zIndex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    gap: "8px",
    height: "calc(100vh - 32px)",
  },
  heroShell: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, 0.9fr)",
    gap: "12px",
    alignItems: "stretch",
    padding: "16px",
    borderRadius: "32px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.90) 0%, rgba(248,250,253,0.88) 50%, rgba(255,244,248,0.92) 100%)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.08)",
  },
  heroCopy: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: 0,
  },
  heroWordmarkWrap: {
    maxWidth: "500px",
    padding: "0 0 4px",
  },
  heroWordmark: {
    display: "block",
    width: "100%",
    height: "auto",
  },
  kicker: {
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: "11px",
    fontWeight: 800,
    color: "#74879c",
    marginBottom: "8px",
  },
  subtitle: {
    margin: "6px 0 0",
    maxWidth: "760px",
    fontSize: "14px",
    lineHeight: 1.55,
    color: "#536579",
  },
  heroArt: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  heroLogoCard: {
    flex: 1,
    minHeight: "160px",
    padding: "14px",
    borderRadius: "28px",
    background: "rgba(255,255,255,0.94)",
    border: "1px solid rgba(140, 160, 184, 0.12)",
    display: "grid",
    placeItems: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), 0 18px 34px rgba(52, 84, 120, 0.08)",
  },
  heroLogoImage: {
    width: "100%",
    maxWidth: "280px",
    height: "auto",
    display: "block",
  },
  heroStatusCard: {
    padding: "12px 14px",
    borderRadius: "24px",
    background: "linear-gradient(135deg, rgba(226, 243, 255, 0.98) 0%, rgba(255, 235, 244, 0.96) 100%)",
    border: "1px solid rgba(140, 160, 184, 0.18)",
  },
  heroStatusTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "8px",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "6px 10px",
    background: "rgba(255,255,255,0.8)",
    color: "#4f647a",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  statusDot: {
    width: "11px",
    height: "11px",
    borderRadius: "50%",
    background: "#95c6ff",
    boxShadow: "0 0 0 6px rgba(149, 198, 255, 0.20)",
    flexShrink: 0,
  },
  heroStatusTitle: {
    fontSize: "16px",
    fontWeight: 800,
    marginBottom: "6px",
    color: "#16304d",
  },
  heroStatusText: {
    fontSize: "13px",
    lineHeight: 1.45,
    color: "#5d7187",
  },
  financeSection: {
    padding: "8px",
    borderRadius: "30px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.64)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.06)",
    marginTop: 0,
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
  },
  financeHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "end",
    marginBottom: "6px",
    flexWrap: "wrap",
  },
  sectionKicker: {
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    fontSize: "11px",
    color: "#74879c",
    fontWeight: 800,
    marginBottom: "4px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "18px",
    lineHeight: 1.08,
    letterSpacing: "-0.03em",
    color: "#10253d",
  },
  sectionMeta: {
    maxWidth: "460px",
    fontSize: "11px",
    lineHeight: 1.3,
    color: "#5d7187",
  },
  stateCard: {
    padding: "10px",
    borderRadius: "24px",
    background: "linear-gradient(135deg, rgba(255,255,255,0.88) 0%, rgba(245,248,252,0.92) 100%)",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    color: "#526579",
    fontSize: "11px",
  },
  financeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
    flex: 1,
    minHeight: 0,
    alignItems: "stretch",
  },
  financeCard: {
    minHeight: 0,
    borderRadius: "28px",
    padding: "10px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(135deg, rgba(255,255,255,0.93) 0%, rgba(247,250,254,0.92) 55%, rgba(255,242,247,0.90) 100%)",
    boxShadow: "0 22px 40px rgba(52, 84, 120, 0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    flex: 1,
  },
  cardTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  cardBadge: {
    alignSelf: "start",
    borderRadius: "999px",
    padding: "5px 8px",
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    background: "rgba(255,255,255,0.78)",
    color: "#16304d",
  },
  cardSubtle: {
    fontSize: "11px",
    color: "#6a7e93",
    fontWeight: 700,
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
    color: "#10253d",
  },
  cardLead: {
    fontSize: "11px",
    lineHeight: 1.2,
    color: "#526579",
  },
  metricHero: {
    padding: "8px",
    borderRadius: "24px",
    background: "linear-gradient(135deg, rgba(230, 244, 255, 0.94) 0%, rgba(255, 236, 245, 0.92) 100%)",
    border: "1px solid rgba(140, 160, 184, 0.14)",
  },
  metricValue: {
    fontSize: "18px",
    fontWeight: 900,
    letterSpacing: "-0.04em",
    color: "#10253d",
    lineHeight: 1.05,
  },
  metricLabel: {
    marginTop: "1px",
    fontSize: "9px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#6a7e93",
    fontWeight: 800,
  },
  metricRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "6px",
  },
  metricBox: {
    padding: "8px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(140, 160, 184, 0.14)",
  },
  metricBoxAccent: {
    background: "linear-gradient(135deg, rgba(237, 248, 255, 0.98) 0%, rgba(255, 239, 247, 0.96) 100%)",
  },
  metricBoxLabel: {
    fontSize: "9px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#6a7e93",
    fontWeight: 800,
    marginBottom: "3px",
  },
  metricBoxValue: {
    fontSize: "11px",
    lineHeight: 1.15,
    color: "#10253d",
    fontWeight: 800,
    wordBreak: "break-word",
  },
  cardFoot: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "6px",
  },
  footLabel: {
    display: "block",
    fontSize: "9px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#6a7e93",
    fontWeight: 800,
    marginBottom: "2px",
  },
  footValue: {
    fontSize: "11px",
    fontWeight: 800,
    color: "#10253d",
  },
  compactNote: {
    fontSize: "10px",
    lineHeight: 1.2,
    color: "#6a7e93",
    fontStyle: "italic",
    marginTop: "1px",
  },
  snapshotList: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "5px",
  },
  snapshotRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "7px 8px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.76)",
    border: "1px solid rgba(140, 160, 184, 0.14)",
  },
  snapshotLabel: {
    fontSize: "9px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6a7e93",
    fontWeight: 800,
  },
  snapshotValue: {
    fontSize: "11px",
    fontWeight: 800,
    color: "#10253d",
    textAlign: "right",
  },
  snapshotFooter: {
    marginTop: "2px",
  },
};
