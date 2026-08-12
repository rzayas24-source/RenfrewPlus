import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import {
  advanceCalendarWorkDay,
  getCalendarStatus,
  getCashSidebarDates,
  type CalendarStatus,
  type CashSidebarDates,
} from "../api/calendar_api";

export default function CashScreen() {
  const navigate = useNavigate();
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [sidebarDates, setSidebarDates] = useState<CashSidebarDates | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingDates, setLoadingDates] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    void refreshCalendarStatus();
  }, []);

  function formatShortDate(value: string | null | undefined) {
    if (!value) return "-";

    const parts = value.split("/");
    if (parts.length === 3) {
      const [month, day, year] = parts;
      return `${month}/${day}/${year.slice(-2)}`;
    }

    return value;
  }

  async function refreshCalendarStatus() {
    setLoadingStatus(true);
    setLoadingDates(true);
    try {
      const [statusResult, datesResult] = await Promise.allSettled([getCalendarStatus(), getCashSidebarDates()]);

      if (statusResult.status === "fulfilled") {
        setCalendarStatus(statusResult.value.data);
        setStatusError(null);
      } else {
        setStatusError(statusResult.reason instanceof Error ? statusResult.reason.message : "Failed to load calendar status");
      }

      if (datesResult.status === "fulfilled") {
        setSidebarDates(datesResult.value.data);
      }
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to load calendar status");
    } finally {
      setLoadingStatus(false);
      setLoadingDates(false);
    }
  }

  async function runAdvancePostingDay() {
    setAdvancing(true);
    try {
      const response = await advanceCalendarWorkDay();
      setCalendarStatus(response.data);
      setStatusError(null);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to advance posting day");
    } finally {
      setAdvancing(false);
      setLoadingStatus(false);
    }
  }

  return (
    <AdminShell
      ribbonTitle="Cash Menu"
      sidebarCopy="Cash workspace with a live posting-day control in the left bar."
      sidebarMiddleCard={
        <div style={styles.sidebarDayCard}>
          <div style={styles.sidebarDayHeader}>
            <div style={styles.sidebarDayKicker}>Posting</div>
            <div style={styles.sidebarDayPill}>{loadingStatus ? "Loading..." : "Live"}</div>
          </div>

          <div style={styles.sidebarDateStack}>
            <div style={styles.sidebarDateLine}>
              <span style={styles.sidebarDateLabel}>Post</span>
              <span style={styles.sidebarDateValue}>{formatShortDate(calendarStatus?.currentWorkDay)}</span>
            </div>
            <div style={styles.sidebarDateLine}>
              <span style={styles.sidebarDateLabel}>Bank</span>
              <span style={styles.sidebarDateValue}>{formatShortDate(calendarStatus?.currentBankDay)}</span>
            </div>
          </div>

          <div style={styles.sidebarDateSection}>
            <div style={styles.sidebarDateSectionLabel}>{loadingDates ? "Latest" : "Latest"}</div>
            <div style={styles.sidebarDateStack}>
              <div style={styles.sidebarDateLine}>
                <span style={styles.sidebarDateLabel}>EDI</span>
                <span style={styles.sidebarDateValue}>{formatShortDate(sidebarDates?.lastEdiDate)}</span>
              </div>
              <div style={styles.sidebarDateLine}>
                <span style={styles.sidebarDateLabel}>EFT</span>
                <span style={styles.sidebarDateValue}>{formatShortDate(sidebarDates?.lastEftDate)}</span>
              </div>
              <div style={styles.sidebarDateLine}>
                <span style={styles.sidebarDateLabel}>Lockbox</span>
                <span style={styles.sidebarDateValue}>{formatShortDate(sidebarDates?.lastLockboxDate)}</span>
              </div>
            </div>
          </div>

          {statusError && <div style={styles.sidebarDayError}>{statusError}</div>}

          <button
            type="button"
            style={styles.sidebarDayButton}
            onClick={() => void runAdvancePostingDay()}
            disabled={advancing}
          >
            {advancing ? "Advancing..." : "Advance Day"}
          </button>
        </div>
      }
      onBack={() => navigate("/")}
      hideBackButton
      useGlobalMenuFallback={false}
    >
      <section style={styles.heroShell}>
        <div style={styles.heroCopy}>
          <div style={styles.kicker}>Cash workspace</div>
          <p style={styles.subtitle}>Cash Screen</p>
        </div>

        <div style={styles.heroArt}>
          <div style={styles.heroStatusCard}>
            <div style={styles.heroStatusTop}>
              <span style={styles.statusPill}>Cash window</span>
              <span style={styles.statusDot} />
            </div>
            <div style={styles.heroStatusTitle}>Cash flow board</div>
            <div style={styles.heroStatusText}>
              A quiet space for cash review, approvals, and bank follow-up.
            </div>
          </div>
        </div>
      </section>

      <section style={styles.buttonGrid}>
        <button type="button" style={styles.menuButton} onClick={() => navigate("/835-match")}>
          <span style={styles.menuButtonTitle}>Phase 1 Match</span>
          <span style={styles.menuButtonGlyph}>&gt;</span>
        </button>
        <button type="button" style={styles.menuButton} onClick={() => navigate("/balsheet")}>
          <span style={styles.menuButtonTitle}>Balance Sheet</span>
          <span style={styles.menuButtonGlyph}>&gt;</span>
        </button>
        <button type="button" style={styles.menuButton} onClick={() => navigate("/banking")}>
          <span style={styles.menuButtonTitle}>Banking</span>
          <span style={styles.menuButtonGlyph}>&gt;</span>
        </button>
        <button type="button" style={styles.menuButton} onClick={() => navigate("/calendar")}>
          <span style={styles.menuButtonTitle}>Calendar</span>
          <span style={styles.menuButtonGlyph}>&gt;</span>
        </button>
        <button type="button" style={styles.menuButton} onClick={() => navigate("/import")}>
          <span style={styles.menuButtonTitle}>Import</span>
          <span style={styles.menuButtonGlyph}>&gt;</span>
        </button>
        <button type="button" style={styles.menuButton} onClick={() => navigate("/site-review")}>
          <span style={styles.menuButtonTitle}>Site Review</span>
          <span style={styles.menuButtonGlyph}>&gt;</span>
        </button>
        <button type="button" style={styles.menuButton} onClick={() => navigate("/tools")}>
          <span style={styles.menuButtonTitle}>Tools</span>
          <span style={styles.menuButtonGlyph}>&gt;</span>
        </button>
      </section>

      <div style={styles.contentWatermark} aria-hidden="true">
        <img src="/renfrewplus-banner.png" alt="" style={styles.contentWatermarkImage} />
      </div>
    </AdminShell>
  );
}

export const styles: Record<string, CSSProperties> = {
  // Watermark rule: keep it below the hero as a separate centered block, never as an overlay.
  // Hero rule: keep the cash hero compact, two-column, and screen-identifying without extra body sections.
  contentWatermark: {
    display: "grid",
    placeItems: "center",
    pointerEvents: "none",
    marginTop: "8px",
    padding: "12px 0 2px",
  },
  contentWatermarkImage: {
    width: "min(560px, 72vw)",
    height: "auto",
    opacity: 0.12,
    filter: "grayscale(100%) contrast(0.94)",
    objectFit: "contain",
    mixBlendMode: "multiply",
  },
  heroShell: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.9fr)",
    gap: "12px",
    padding: "14px 16px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(243,247,252,0.96) 42%, rgba(247,250,255,0.92) 100%)",
    boxShadow: "0 24px 48px rgba(52, 84, 120, 0.08)",
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
    maxWidth: "none",
    fontSize: "20px",
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
    color: "#536579",
    fontWeight: 800,
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
  sidebarDayCard: {
    display: "grid",
    gap: "6px",
    padding: "12px",
    borderRadius: "20px",
    border: "1px solid rgba(176, 194, 218, 0.22)",
    background: "linear-gradient(135deg, rgba(235, 245, 255, 0.95) 0%, rgba(255, 234, 243, 0.90) 100%)",
    boxShadow: "0 12px 24px rgba(52, 84, 120, 0.06)",
  },
  sidebarDayHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  sidebarDayKicker: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  sidebarDayPill: {
    display: "inline-flex",
    alignItems: "center",
    height: "26px",
    padding: "0 10px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.86)",
    border: "1px solid rgba(158, 176, 204, 0.22)",
    color: "#4a6179",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  sidebarDayRow: {
    display: "grid",
    gap: "4px",
  },
  sidebarDayLabel: {
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  sidebarDayValue: {
    fontSize: "14px",
    fontWeight: 900,
    color: "#17324f",
  },
  sidebarDateStack: {
    display: "grid",
    gap: "3px",
  },
  sidebarDateSection: {
    display: "grid",
    gap: "4px",
  },
  sidebarDateSectionLabel: {
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  sidebarDateLine: {
    display: "grid",
    gridTemplateColumns: "54px minmax(0, 1fr)",
    alignItems: "baseline",
    gap: "10px",
  },
  sidebarDateLabel: {
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.10em",
    color: "#7b8ea3",
    fontWeight: 800,
  },
  sidebarDateValue: {
    fontSize: "13px",
    lineHeight: 1.15,
    fontWeight: 900,
    color: "#17324f",
  },
  sidebarDayError: {
    padding: "6px 8px",
    borderRadius: "12px",
    background: "rgba(255, 237, 237, 0.92)",
    border: "1px solid rgba(224, 107, 107, 0.24)",
    color: "#8f1f1f",
    fontSize: "11px",
    lineHeight: 1.35,
  },
  sidebarDayButton: {
    minHeight: "38px",
    borderRadius: "14px",
    border: "1px solid rgba(106, 137, 180, 0.24)",
    background: "linear-gradient(135deg, #dbeeff 0%, #c6ddfb 100%)",
    color: "#15304f",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 14px 24px rgba(119, 151, 198, 0.16)",
  },
  buttonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  menuButton: {
    minHeight: "88px",
    padding: "14px 16px",
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(243,248,255,0.96) 48%, rgba(255,239,246,0.94) 100%)",
    boxShadow: "0 18px 34px rgba(52, 84, 120, 0.08)",
    cursor: "pointer",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  menuButtonTitle: {
    fontSize: "15px",
    fontWeight: 900,
    color: "#17324f",
  },
  menuButtonGlyph: {
    width: "26px",
    height: "26px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.76)",
    color: "#8aa5c6",
    fontSize: "13px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
    flexShrink: 0,
  },
};
