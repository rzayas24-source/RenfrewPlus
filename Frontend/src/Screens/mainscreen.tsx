import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { getBankingSpreadsheet, type BankingSpreadsheetResponse } from "../api/banking_api";

type MonthlyBankPoint = {
  day: string;
  iso: string;
  amount: number;
  count: number;
  eftAmount: number;
  lockboxAmount: number;
};

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function MainScreen() {
  const navigate = useNavigate();
  const [bankingData, setBankingData] = useState<BankingSpreadsheetResponse | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadBanking = async () => {
      setChartLoading(true);
      setChartError(null);

      try {
        const response = await getBankingSpreadsheet();
        if (active) {
          setBankingData(response.data);
        }
      } catch {
        if (active) {
          setBankingData(null);
          setChartError("Banking chart unavailable right now.");
        }
      } finally {
        if (active) {
          setChartLoading(false);
        }
      }
    };

    void loadBanking();

    return () => {
      active = false;
    };
  }, []);

  const chartData = useMemo(() => {
    const now = new Date();
    const monthIndex = now.getMonth();
    const year = now.getFullYear();
    const points = new Map<string, MonthlyBankPoint>();

    for (const group of bankingData?.groups ?? []) {
      for (const row of group.rows) {
        const parsed = parseBankDate(row.date);
        if (!parsed) continue;
        if (parsed.getMonth() !== monthIndex || parsed.getFullYear() !== year) continue;

        const iso = toIsoDate(parsed);
        const existing = points.get(iso) ?? {
          day: String(parsed.getDate()).padStart(2, "0"),
          iso,
          amount: 0,
          count: 0,
          eftAmount: 0,
          lockboxAmount: 0,
        };

        const amount = parseMoney(row.amount);
        existing.amount += amount;
        existing.count += 1;
        if (row.source === "EFT") {
          existing.eftAmount += amount;
        } else {
          existing.lockboxAmount += amount;
        }
        points.set(iso, existing);
      }
    }

    return Array.from(points.values()).sort((left, right) => left.iso.localeCompare(right.iso));
  }, [bankingData]);

  const chartMax = useMemo(() => {
    const max = Math.max(0, ...chartData.map((point) => point.amount));
    return max > 0 ? max : 1;
  }, [chartData]);

  const currentMonthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  const chartTotals = useMemo(() => {
    return chartData.reduce(
      (acc, point) => {
        acc.amount += point.amount;
        acc.count += point.count;
        return acc;
      },
      { amount: 0, count: 0 }
    );
  }, [chartData]);

  const chartLayout = useMemo(() => {
    const leftPad = 18;
    const usableWidth = 940 - leftPad * 2;
    const step = chartData.length > 0 ? usableWidth / chartData.length : usableWidth;
    const barWidth = Math.max(12, Math.min(26, step * 0.7));
    return { leftPad, step, barWidth };
  }, [chartData.length]);

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
              <img src="/renfrew-womenline.png" alt="Renfrew girls holding hands mark" style={styles.heroLogoImage} />
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

        <section style={styles.chartCard}>
          <div style={styles.chartHeader}>
            <div>
              <div style={styles.chartKicker}>Current month</div>
              <h2 style={styles.chartTitle}>{currentMonthLabel} banking trend</h2>
            </div>
            <div style={styles.chartHeaderMeta}>
              <div style={styles.chartHeaderValue}>{formatCurrency(chartTotals.amount)}</div>
              <div style={styles.chartHeaderLabel}>{chartTotals.count} rows this month</div>
            </div>
          </div>

          <div style={styles.chartLegend}>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendSwatch, background: "linear-gradient(135deg, #8ec5ff 0%, #cfe7ff 100%)" }} />
              EFT
            </span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendSwatch, background: "linear-gradient(135deg, #ffb4d2 0%, #ffe0ec 100%)" }} />
              Lockbox
            </span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendSwatch, background: "linear-gradient(135deg, #d7dee8 0%, #eef2f7 100%)" }} />
              Total
            </span>
          </div>

          <div style={styles.chartFrame}>
            {chartLoading ? (
              <div style={styles.chartState}>Loading monthly banking data...</div>
            ) : chartError ? (
              <div style={styles.chartState}>{chartError}</div>
            ) : chartData.length === 0 ? (
              <div style={styles.chartState}>No banking rows were found for the current month.</div>
            ) : (
                <svg viewBox="0 0 940 270" preserveAspectRatio="none" style={styles.chartSvg} aria-label={`${currentMonthLabel} banking chart`}>
                  <defs>
                  <linearGradient id="banking-total-gradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#8ec5ff" />
                    <stop offset="100%" stopColor="#d7ebff" />
                  </linearGradient>
                  <linearGradient id="banking-eft-gradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#69aef8" />
                    <stop offset="100%" stopColor="#bfe0ff" />
                  </linearGradient>
                  <linearGradient id="banking-lockbox-gradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#ff9ec5" />
                    <stop offset="100%" stopColor="#ffd8e7" />
                  </linearGradient>
                </defs>

                <line x1="0" y1="220" x2="940" y2="220" stroke="rgba(120, 140, 164, 0.18)" strokeWidth="2" />

                {chartData.map((point, index) => {
                  const left = chartLayout.leftPad + index * chartLayout.step + (chartLayout.step - chartLayout.barWidth) / 2;
                  const barHeight = Math.max(10, (point.amount / chartMax) * 156);
                  const eftHeight = Math.max(4, (point.eftAmount / chartMax) * 156);
                  const lockboxHeight = Math.max(4, (point.lockboxAmount / chartMax) * 156);
                  const isCurrent = index === chartData.length - 1;
                  const splitWidth = Math.max(4, (chartLayout.barWidth - 4) / 2);

                  return (
                    <g key={point.iso}>
                      <rect
                        x={left}
                        y={210 - barHeight}
                        width={chartLayout.barWidth}
                        height={barHeight}
                        rx="12"
                        fill="url(#banking-total-gradient)"
                        opacity={isCurrent ? 1 : 0.72}
                      />
                      <rect
                        x={left}
                        y={210 - eftHeight}
                        width={splitWidth}
                        height={eftHeight}
                        rx="10"
                        fill="url(#banking-eft-gradient)"
                        opacity={point.eftAmount > 0 ? 1 : 0.22}
                      />
                      <rect
                        x={left + splitWidth + 4}
                        y={210 - lockboxHeight}
                        width={splitWidth}
                        height={lockboxHeight}
                        rx="10"
                        fill="url(#banking-lockbox-gradient)"
                        opacity={point.lockboxAmount > 0 ? 1 : 0.22}
                      />
                      <circle cx={left + chartLayout.barWidth / 2} cy={210 - barHeight - 10} r={4} fill="#7a93ad" opacity={0.45} />
                      <text x={left + chartLayout.barWidth / 2} y="236" textAnchor="middle" style={styles.chartDayLabel}>
                        {point.day}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          <div style={styles.chartFootnote}>
            <span>Month to date total</span>
            <strong>{formatCurrency(chartTotals.amount)}</strong>
            <span>{chartTotals.count} rows across EFT and Lockbox</span>
          </div>
        </section>

      </section>
    </AdminShell>
  );
}

function parseMoney(value: string) {
  if (value.trim() === "") return 0;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatCurrency(value: number) {
  return moneyFmt.format(value);
}

function parseBankDate(value: string) {
  const trimmed = value.trim();
  const mmddyyyy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const styles: Record<string, CSSProperties> = {
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
    width: "116px",
    height: "60px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.64)",
    border: "1px solid rgba(140, 160, 184, 0.10)",
    boxShadow: "0 10px 18px rgba(95, 128, 172, 0.06)",
    overflow: "hidden",
    padding: "4px",
    flexShrink: 0,
    position: "sticky",
    top: "18px",
    alignSelf: "flex-start",
    zIndex: 2,
  },
  brandWomenImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "center",
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
    gap: "12px",
    minHeight: "calc(100vh - 32px)",
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
    background: "linear-gradient(135deg, rgba(255,255,255,0.90) 0%, rgba(248,250,253,0.88) 50%, rgba(255,244,248,0.92) 100%)",
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
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
  },
  statCard: {
    padding: "18px",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.78)",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    boxShadow: "0 18px 36px rgba(52, 84, 120, 0.06)",
    minHeight: "142px",
  },
  statLabel: {
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    fontSize: "11px",
    color: "#74879c",
    fontWeight: 800,
    marginBottom: "10px",
  },
  statValue: {
    fontSize: "20px",
    fontWeight: 800,
    color: "#10253d",
    marginBottom: "8px",
  },
  statDetail: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#5d7187",
  },
  widgetSection: {
    padding: "22px",
    borderRadius: "30px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.64)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.06)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "end",
    marginBottom: "16px",
  },
  sectionKicker: {
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    fontSize: "11px",
    color: "#74879c",
    fontWeight: 800,
    marginBottom: "8px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "28px",
    lineHeight: 1.08,
    letterSpacing: "-0.03em",
    color: "#10253d",
  },
  sectionMeta: {
    maxWidth: "460px",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#5d7187",
  },
  widgetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },
  widgetCard: {
    minHeight: "190px",
    border: "0",
    borderRadius: "28px",
    padding: "18px",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 22px 40px rgba(52, 84, 120, 0.08)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    transition: "transform 160ms ease, box-shadow 160ms ease",
  },
  widgetTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
  },
  widgetBadge: {
    alignSelf: "start",
    borderRadius: "999px",
    padding: "7px 12px",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    background: "rgba(255,255,255,0.70)",
    color: "#16304d",
  },
  widgetBody: {
    paddingTop: "18px",
  },
  widgetTitle: {
    fontSize: "24px",
    fontWeight: 800,
    marginBottom: "8px",
    color: "#10253d",
  },
  widgetMeta: {
    fontSize: "15px",
    lineHeight: 1.6,
    color: "#526579",
    maxWidth: "360px",
  },
  widgetAction: {
    alignSelf: "start",
    marginTop: "18px",
    fontSize: "14px",
    fontWeight: 800,
    color: "#10253d",
  },
  chartCard: {
    padding: "14px 16px 12px",
    borderRadius: "28px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "linear-gradient(135deg, rgba(255,255,255,0.90) 0%, rgba(247,250,254,0.92) 52%, rgba(255,242,247,0.92) 100%)",
    boxShadow: "0 22px 44px rgba(52, 84, 120, 0.08)",
    display: "grid",
    gap: "10px",
    width: "100%",
    minWidth: 0,
    marginTop: "auto",
  },
  chartHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  chartKicker: {
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    fontSize: "10px",
    color: "#74879c",
    fontWeight: 800,
    marginBottom: "6px",
  },
  chartTitle: {
    margin: 0,
    fontSize: "19px",
    lineHeight: 1.08,
    letterSpacing: "-0.03em",
    color: "#10253d",
  },
  chartHeaderMeta: {
    display: "grid",
    justifyItems: "end",
    gap: "2px",
  },
  chartHeaderValue: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#10253d",
  },
  chartHeaderLabel: {
    fontSize: "11px",
    color: "#5d7187",
    fontWeight: 700,
  },
  chartLegend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 12px",
    alignItems: "center",
  },
  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "11px",
    fontWeight: 800,
    color: "#4f647a",
  },
  legendSwatch: {
    width: "12px",
    height: "12px",
    borderRadius: "999px",
    boxShadow: "0 0 0 4px rgba(255,255,255,0.7)",
    flexShrink: 0,
  },
  chartFrame: {
    width: "100%",
    minWidth: 0,
    height: "180px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.12)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(245,248,252,0.86) 100%)",
    overflow: "hidden",
  },
  chartSvg: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  chartDayLabel: {
    fontSize: "10px",
    fill: "#6b7f94",
    fontWeight: 700,
  },
  chartState: {
    height: "100%",
    display: "grid",
    placeItems: "center",
    color: "#5d7187",
    fontSize: "12px",
    padding: "12px",
    textAlign: "center",
  },
  chartFootnote: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 10px",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: "0",
    fontSize: "11px",
    color: "#5d7187",
  },
};


