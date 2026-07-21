import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { styles as adminStyles } from "./adminscreen";
import { getBankingSpreadsheet, type BankingSpreadsheetGroup, type BankingSpreadsheetResponse } from "../api/banking_api";

type BankingMetric = {
  label: string;
  value: string;
  detail: string;
};

type BankingSortField = "date" | "amount" | "payer" | "checkNumber";
type BankingSortDirection = "asc" | "desc";

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const formatAmount = (value: string) => {
  if (value === "") return "";
  const parsed = Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(parsed)) return value;
  return moneyFmt.format(parsed);
};

const formatCurrency = (value: number | undefined) => moneyFmt.format(value ?? 0);

const parseAmountValue = (value: string) => {
  if (value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
};

const parseDay = (value: string) => {
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
};

const compareDays = (left: string, right: string) => {
  const leftDate = parseDay(left);
  const rightDate = parseDay(right);

  if (leftDate && rightDate) {
    return rightDate.getTime() - leftDate.getTime();
  }

  if (leftDate) return -1;
  if (rightDate) return 1;
  return right.localeCompare(left);
};

const mmddyyyyToIso = (value: string) => {
  const parsed = parseDay(value);
  if (!parsed) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatIsoToMmddyyyy = (value: string) => {
  const parsed = parseDay(value);
  if (!parsed) return value;

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${month}/${day}/${year}`;
};

const compareAmounts = (left: string, right: string) => {
  const leftValue = Number(String(left).replace(/,/g, ""));
  const rightValue = Number(String(right).replace(/,/g, ""));

  if (Number.isNaN(leftValue) && Number.isNaN(rightValue)) return 0;
  if (Number.isNaN(leftValue)) return 1;
  if (Number.isNaN(rightValue)) return -1;
  return leftValue - rightValue;
};

const compareText = (left: string, right: string) => left.localeCompare(right, undefined, { sensitivity: "base" });

const formatDisplayDate = (value: string) => value || "No date";

export default function BankingScreen() {
  const navigate = useNavigate();
  const [data, setData] = useState<BankingSpreadsheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayIso, setSelectedDayIso] = useState("");
  const [sortField, setSortField] = useState<BankingSortField>("date");
  const [sortDirection, setSortDirection] = useState<BankingSortDirection>("desc");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<"EFT" | "Lockbox", boolean>>({
    EFT: false,
    Lockbox: false,
  });
  const initialDayApplied = useRef(false);

  const loadSpreadsheet = async () => {
    setError(null);
    setRefreshing(true);

    try {
      const response = await getBankingSpreadsheet();
      setData(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load banking spreadsheet");
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadSpreadsheet();
  }, []);

  const allRows = useMemo(() => (data?.groups ?? []).flatMap((group) => group.rows), [data]);
  const availableDays = useMemo(
    () => Array.from(new Set(allRows.map((row) => row.date).filter((day) => day.trim() !== ""))).sort(compareDays),
    [allRows],
  );

  useEffect(() => {
    if (!initialDayApplied.current && selectedDayIso === "" && availableDays.length > 0) {
      initialDayApplied.current = true;
      setSelectedDayIso(mmddyyyyToIso(availableDays[0]));
    }
  }, [availableDays, selectedDayIso]);

  const visibleGroups = useMemo(() => {
    const groups = data?.groups ?? [];
    const filteredGroups =
      selectedDayIso === ""
        ? groups
        : groups
            .map((group) => ({
              ...group,
              rows: group.rows.filter((row) => mmddyyyyToIso(row.date) === selectedDayIso),
            }))
            .filter((group) => group.rows.length > 0);

    const sortMultiplier = sortDirection === "asc" ? 1 : -1;
    return filteredGroups.map((group) => {
      const rows = [...group.rows].sort((left, right) => {
        let comparison = 0;
        switch (sortField) {
          case "date":
            comparison = compareDays(left.date, right.date);
            break;
          case "amount":
            comparison = compareAmounts(left.amount, right.amount);
            break;
          case "payer":
            comparison = compareText(left.payer, right.payer);
            break;
          case "checkNumber":
            comparison = compareText(left.checkNumber, right.checkNumber);
            break;
        }

        if (comparison === 0) {
          comparison = left.id - right.id;
        }

        return comparison * sortMultiplier;
      });

      return {
        ...group,
        rows,
      };
    });
  }, [data, selectedDayIso, sortDirection, sortField]);

  const selectedDayRows = useMemo(() => {
    if (selectedDayIso === "") {
      return allRows;
    }

    return allRows.filter((row) => mmddyyyyToIso(row.date) === selectedDayIso);
  }, [allRows, selectedDayIso]);
  const visibleRowsOnScreen = useMemo(() => {
    return visibleGroups
      .filter((group) => !collapsedGroups[group.source as "EFT" | "Lockbox"])
      .flatMap((group) => group.rows);
  }, [collapsedGroups, visibleGroups]);
  const summaryBySource = useMemo(() => {
    const next = new Map<string, { count: number; lastDate: string; totalAmount?: number }>();

    for (const item of data?.summary ?? []) {
      next.set(item.source, { count: item.count, lastDate: item.lastDate, totalAmount: item.totalAmount });
    }

    return next;
  }, [data]);
  const dayTotalsBySource = useMemo(() => {
    const next = new Map<"EFT" | "Lockbox", { count: number; totalAmount: number }>();

    next.set("EFT", { count: 0, totalAmount: 0 });
    next.set("Lockbox", { count: 0, totalAmount: 0 });

    for (const row of selectedDayRows) {
      const bucket = next.get(row.source);
      if (!bucket) {
        continue;
      }

      bucket.count += 1;
      bucket.totalAmount += parseAmountValue(row.amount);
    }

    return next;
  }, [selectedDayRows]);
  const selectedDayLabel = selectedDayIso ? formatIsoToMmddyyyy(selectedDayIso) : "All days";

  const handleSort = (field: BankingSortField) => {
    setSortField((currentField) => {
      if (currentField === field) {
        setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
        return currentField;
      }

      setSortDirection(field === "amount" ? "desc" : "asc");
      return field;
    });
  };

  const metrics: BankingMetric[] = [
    {
      label: "Last EDI",
      value: formatDisplayDate(summaryBySource.get("EDI")?.lastDate ?? ""),
      detail: `${summaryBySource.get("EDI")?.count ?? 0} EDI row(s) loaded.`,
    },
    {
      label: "Last EFT",
      value: formatDisplayDate(summaryBySource.get("EFT")?.lastDate ?? ""),
      detail: `${summaryBySource.get("EFT")?.count ?? 0} EFT row(s) loaded.`,
    },
    {
      label: "Last Lockbox",
      value: formatDisplayDate(summaryBySource.get("Lockbox")?.lastDate ?? ""),
      detail: `${summaryBySource.get("Lockbox")?.count ?? 0} Lockbox row(s) loaded.`,
    },
    {
      label: "Day EFT Total",
      value: formatCurrency(dayTotalsBySource.get("EFT")?.totalAmount),
      detail: `${dayTotalsBySource.get("EFT")?.count ?? 0} EFT row(s) on the selected day.`,
    },
    {
      label: "Day Lockbox Total",
      value: formatCurrency(dayTotalsBySource.get("Lockbox")?.totalAmount),
      detail: `${dayTotalsBySource.get("Lockbox")?.count ?? 0} Lockbox row(s) on the selected day.`,
    },
    {
      label: "Day Combined",
      value: formatCurrency(
        (dayTotalsBySource.get("EFT")?.totalAmount ?? 0) + (dayTotalsBySource.get("Lockbox")?.totalAmount ?? 0)
      ),
      detail: `${selectedDayRows.length} row(s) on the selected day.`,
    },
  ];

  const sections = visibleGroups;

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
          A soft banking console for bank-side review, reconciliation, and match follow-up.
        </p>

        <nav style={adminStyles.navStack} aria-label="Banking navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/")}>
            <span style={adminStyles.navButtonLabel}>Home</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/cash")}>
            <span style={adminStyles.navButtonLabel}>Cash</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/835-match")}>
            <span style={adminStyles.navButtonLabel}>835 Match</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/banking")}>
            <span style={adminStyles.navButtonLabel}>Banking</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>↗</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Today</div>
          <div style={adminStyles.sidebarCardValue}>{loading ? "Loading spreadsheet" : "Banking spreadsheet ready"}</div>
          <div style={adminStyles.sidebarCardMeta}>
            EFT and Lockbox are shown as separate groups, with an EDI flag when a source EDI exists.
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Banking screen</div>
            <p style={adminStyles.subtitle}>
              A spreadsheet view for bank-side review. EFT and Lockbox are grouped separately, and rows show whether an
              EDI exists.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.primaryButton} type="button" onClick={() => void loadSpreadsheet()}>
                {refreshing ? "Refreshing..." : "Refresh Spreadsheet"}
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/835-match")}>
                Open 835 Match
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => navigate("/cash")}>
                Open Cash
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Banking window</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Spreadsheet review</div>
              <div style={adminStyles.heroStatusText}>
                The same shell is now carrying a grouped spreadsheet so you can review EFT and Lockbox rows in one place.
              </div>
            </div>
          </div>
        </section>

        <section style={bankingStyles.summaryGrid}>
          <article style={bankingStyles.controlCard}>
            <div style={bankingStyles.controlCardHeader}>
              <div>
                <div style={adminStyles.statLabel}>Banking day</div>
                <div style={bankingStyles.controlCardTitle}>{selectedDayLabel}</div>
              </div>
              <button
                style={bankingStyles.clearButton}
                type="button"
                onClick={() => setSelectedDayIso("")}
                disabled={selectedDayIso === ""}
              >
                Show all
              </button>
            </div>

            <label style={bankingStyles.controlField}>
              <span style={bankingStyles.controlLabel}>Date picker</span>
              <input
                style={bankingStyles.dateInput}
                type="date"
                value={selectedDayIso}
                onChange={(event) => setSelectedDayIso(event.target.value)}
              />
            </label>

            <div style={bankingStyles.controlCardFoot}>
              <span>{visibleRowsOnScreen.length} rows visible</span>
              <span>{availableDays.length} available days</span>
            </div>
          </article>

          {metrics.map((metric) => (
            <article key={metric.label} style={bankingStyles.metricCard}>
              <div style={adminStyles.statLabel}>{metric.label}</div>
              <div style={adminStyles.statValue}>{metric.value}</div>
              <div style={adminStyles.statDetail}>{metric.detail}</div>
            </article>
          ))}
        </section>

        {error && <div style={bankingStyles.errorBanner}>{error}</div>}

        <section style={bankingStyles.spreadsheetArea}>
          {sections.map((section) => (
            <BankingGroupTable
              key={section.source}
              group={section}
              collapsed={collapsedGroups[section.source]}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              onToggle={() =>
                setCollapsedGroups((current) => ({
                  ...current,
                  [section.source]: !current[section.source],
                }))
              }
            />
          ))}

          {!loading && !sections.length && !error && (
            <div style={bankingStyles.emptyState}>
              No banking rows were returned for {selectedDayLabel}. Refresh after EFT and Lockbox have source data.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function BankingGroupTable({
  group,
  collapsed,
  onToggle,
  sortField,
  sortDirection,
  onSort,
}: {
  group: BankingSpreadsheetGroup;
  collapsed: boolean;
  onToggle: () => void;
  sortField: BankingSortField;
  sortDirection: BankingSortDirection;
  onSort: (field: BankingSortField) => void;
}) {
  const renderHeaderButton = (field: BankingSortField, label: string) => {
    const active = sortField === field;
    const icon = active ? (sortDirection === "asc" ? "▲" : "▼") : "↕";

    return (
      <button
        type="button"
        style={bankingStyles.headerButton}
        onClick={() => onSort(field)}
        aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
      >
        <span>{label}</span>
        <span style={bankingStyles.headerIcon}>{icon}</span>
      </button>
    );
  };

  return (
    <section style={bankingStyles.groupCard}>
      <div style={bankingStyles.groupHeader}>
        <div>
          <div style={adminStyles.sectionKicker}>{group.source}</div>
          <h2 style={adminStyles.sectionTitle}>{group.source} spreadsheet</h2>
        </div>
        <div style={bankingStyles.groupMetaWrap}>
          <div style={bankingStyles.groupMeta}>{group.rows.length} rows</div>
          <button style={bankingStyles.collapseButton} type="button" onClick={onToggle}>
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={bankingStyles.tableWrap}>
          <table style={bankingStyles.table}>
            <thead>
              <tr>
                <th style={bankingStyles.th}>{renderHeaderButton("date", "Date")}</th>
                <th style={bankingStyles.th}>{renderHeaderButton("amount", "Amount")}</th>
                <th style={bankingStyles.th}>{renderHeaderButton("payer", "Payer")}</th>
                <th style={bankingStyles.th}>{renderHeaderButton("checkNumber", "Check Number")}</th>
                <th style={bankingStyles.thCenter}>
                  <span style={bankingStyles.headerStaticLabel}>EDI</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr key={`${group.source}-${row.id}`}>
                  <td style={bankingStyles.td}>{row.date}</td>
                  <td style={bankingStyles.td}>{formatAmount(row.amount)}</td>
                  <td style={bankingStyles.td}>{row.payer || ""}</td>
                  <td style={bankingStyles.td}>{row.checkNumber || ""}</td>
                  <td style={bankingStyles.tdCenter}>{row.edi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const bankingStyles: Record<string, CSSProperties> = {
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "14px",
  },
  spreadsheetArea: {
    display: "grid",
    gap: "18px",
  },
  controlCard: {
    minWidth: 0,
    borderRadius: "24px",
    padding: "14px",
    background: "rgba(255,255,255,0.84)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
    display: "grid",
    gap: "14px",
    alignContent: "start",
  },
  metricCard: {
    minWidth: 0,
    borderRadius: "24px",
    padding: "14px",
  },
  controlCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  controlCardTitle: {
    marginTop: "4px",
    fontSize: "16px",
    fontWeight: 800,
    color: "#17324f",
  },
  controlLabel: {
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#597085",
  },
  controlField: {
    display: "grid",
    gap: "6px",
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
  clearButton: {
    minHeight: "34px",
    borderRadius: "999px",
    border: "1px solid rgba(171, 186, 207, 0.38)",
    background: "rgba(245, 249, 255, 0.95)",
    color: "#385065",
    padding: "0 12px",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  controlCardFoot: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#5a6c80",
  },
  groupCard: {
    borderRadius: "28px",
    padding: "18px",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.06)",
  },
  groupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "14px",
  },
  groupMetaWrap: {
    display: "grid",
    justifyItems: "end",
    gap: "8px",
  },
  groupMeta: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#597085",
  },
  collapseButton: {
    minHeight: "34px",
    borderRadius: "999px",
    border: "1px solid rgba(171, 186, 207, 0.38)",
    background: "rgba(245, 249, 255, 0.95)",
    color: "#385065",
    padding: "0 14px",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: "20px",
    border: "1px solid rgba(171, 186, 207, 0.28)",
    background: "rgba(255,255,255,0.94)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "680px",
  },
  th: {
    position: "sticky",
    top: 0,
    background: "rgba(245, 249, 255, 0.98)",
    color: "#3d5368",
    padding: "14px 16px",
    borderBottom: "1px solid rgba(171, 186, 207, 0.28)",
  },
  thCenter: {
    position: "sticky",
    top: 0,
    background: "rgba(245, 249, 255, 0.98)",
    color: "#3d5368",
    padding: "14px 16px",
    borderBottom: "1px solid rgba(171, 186, 207, 0.28)",
  },
  headerButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    border: "none",
    background: "transparent",
    padding: "0",
    color: "#3d5368",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontWeight: 800,
    cursor: "pointer",
  },
  headerIcon: {
    fontSize: "11px",
    letterSpacing: "0",
    color: "#7b8da0",
  },
  headerStaticLabel: {
    display: "inline-flex",
    width: "100%",
    justifyContent: "center",
    fontSize: "12px",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontWeight: 800,
    color: "#3d5368",
  },
  td: {
    padding: "12px 16px",
    borderBottom: "1px solid rgba(218, 225, 234, 0.7)",
    fontSize: "14px",
    color: "#17324f",
    whiteSpace: "nowrap",
  },
  tdCenter: {
    padding: "12px 16px",
    borderBottom: "1px solid rgba(218, 225, 234, 0.7)",
    fontSize: "14px",
    color: "#17324f",
    textAlign: "center",
    fontWeight: 800,
  },
  emptyState: {
    borderRadius: "18px",
    padding: "18px",
    textAlign: "center",
    color: "#5a6c80",
    background: "rgba(255,255,255,0.9)",
    border: "1px dashed rgba(171, 186, 207, 0.45)",
    lineHeight: 1.6,
  },
  errorBanner: {
    marginBottom: "14px",
    borderRadius: "16px",
    padding: "12px 14px",
    background: "rgba(255, 232, 232, 0.92)",
    border: "1px solid rgba(214, 128, 128, 0.35)",
    color: "#7a1d1d",
    fontWeight: 700,
  },
  daySelect: {
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
};
