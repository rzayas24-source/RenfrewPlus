import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { getBalsheet, getMisc } from "../api/balsheet_api";
import { styles as adminStyles } from "./adminscreen";
import ItemizationGrid, { type ItemizationField } from "./itemizationgrid";
import {
  getItemization,
  loadFlywire,
  updateItemization,
  type FlywirePayload,
  type FlywireRow,
  type ItemizationSavedPayload,
} from "../api/keyproof_api";
import { API_BASE } from "../config/apiBase";

type ItemizationForm = Record<ItemizationField, string | number>;

type ItemizationItem = ItemizationForm & {
  id: number;
  importId: number;
  type: string;
  amount: number;
  misc: number;
};

type SaveStatusKind = "saved" | "dirty" | "saving" | "not_saved";

const posterOptions = ["Raul", "Nick"];

function splitMultiValue(value: string) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(/\s*\|\s*/)
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );
}

function joinMultiValue(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).join(" | ");
}

function normalizeMultiSelectOptions(values: string[], currentValue?: string) {
  const merged = new Set(values.map((value) => value.trim()).filter(Boolean));
  for (const value of splitMultiValue(currentValue ?? "")) {
    merged.add(value);
  }
  return Array.from(merged).sort((left, right) => left.localeCompare(right));
}

function parseAmount(value: unknown) {
  const parsed = Number.parseFloat(String(value || "").replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: unknown) {
  return parseAmount(value).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function keyproofStorageKey(id: string) {
  return `keyproof:${id}`;
}

function getRequiredTotal(attachmentId: string | null, fallback: string | null) {
  if (attachmentId) {
    const saved = window.localStorage.getItem(keyproofStorageKey(attachmentId));

    if (saved) {
      try {
        const keyproof = JSON.parse(saved) as Record<string, string>;
        return ["cash", "check", "creditCard", "foreignCheck", "wireTransfer", "misc"].reduce(
          (total, field) => total + parseAmount(keyproof[field]),
          0
        );
      } catch {
        window.localStorage.removeItem(keyproofStorageKey(attachmentId));
      }
    }
  }

  return parseAmount(fallback);
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function isExcludedFromRequiredTotal(item: ItemizationItem) {
  const fields = [item.type, item.from, item.to, item.misc_type].map((value) => normalizeText(value).toLowerCase());
  return fields.some((value) => value === "eft" || value === "lockbox");
}

function extractLastFour(value: unknown) {
  const match = normalizeText(value).match(/(\d{4})(?!.*\d)/);
  return match?.[1] || "";
}

function buildFlywirePayer(row: FlywireRow) {
  const parts = [row.account_number, row.patient_name, row.billing_name].map(normalizeText).filter(Boolean);
  return parts.join(" - ");
}

function buildFlywireEob(row: FlywireRow) {
  return normalizeText(row.department).toLowerCase() === "payment plan" ? "P" : "S";
}

function buildFlywireCheckNumber(row: FlywireRow) {
  const paymentMethod = normalizeText(row.payment_method || row.payment_type);
  const lastFour = extractLastFour(row.account_number) || extractLastFour(row.flywire_id) || extractLastFour(paymentMethod);

  if (/credit\s*visa/i.test(paymentMethod)) {
    return `VS-${lastFour}`;
  }

  if (/credit\s*master\s*card/i.test(paymentMethod) || /master\s*card/i.test(paymentMethod)) {
    return `MC-${lastFour}`;
  }

  if (/american\s*express/i.test(paymentMethod) || /amex/i.test(paymentMethod)) {
    return `Amex-${lastFour}`;
  }

  return paymentMethod || "";
}

function buildFlywireNotes(payload: FlywirePayload, row: FlywireRow) {
  const summary = payload.summary;
  const pieces = [
    summary?.batch_id ? `Batch ${summary.batch_id}` : "",
    row.time_text ? `Time ${row.time_text}` : "",
    row.department ? `Dept ${row.department}` : "",
    row.application ? `App ${row.application}` : "",
  ].filter(Boolean);

  return pieces.join(" | ");
}

function mapFlywireRowsToItems(payload: FlywirePayload, siteName: string, attachmentId: number): ItemizationItem[] {
  return payload.rows
    .filter((row) => parseAmount(row.amount) !== 0)
    .map((row, index) => ({
      ...makeInitialForm(siteName),
      id: Date.now() + index,
      importId: attachmentId,
      type: siteName,
      amount: row.amount ?? 0,
      payer: buildFlywirePayer(row),
      check_number: buildFlywireCheckNumber(row),
      edi: "",
      poster: "Nick",
      eob: buildFlywireEob(row),
      unposted: 0,
      misc: 0,
      notes: buildFlywireNotes(payload, row),
      nick: 0,
      raul: 0,
    })) as ItemizationItem[];
}

function makeInitialForm(type: string): ItemizationForm {
  return {
    type,
    amount: 0,
    payer: "",
    check_number: "",
    edi: "",
    poster: "",
    eob: "",
    unposted: 0,
    misc: 0,
    misc_type: "",
    notes: "",
    nick: 0,
    raul: 0,
    needs: "",
    from: "",
    to: "",
  };
}

function applyPosterBalance(form: ItemizationForm) {
  const amount = parseAmount(form.amount);
  const unposted = parseAmount(form.unposted);
  const misc = parseAmount(form.misc);
  const posterAmount = Math.max(0, amount - unposted - misc);
  const poster = String(form.poster || "");

  if (poster === "Nick") {
    return { ...form, nick: formatCurrency(posterAmount), raul: formatCurrency(0) };
  }

  if (poster === "Raul") {
    return { ...form, nick: formatCurrency(0), raul: formatCurrency(posterAmount) };
  }

  return { ...form, nick: formatCurrency(0), raul: formatCurrency(0) };
}

function normalizePosterBalance(item: ItemizationItem) {
  return applyPosterBalance(item as ItemizationForm) as ItemizationItem;
}

function normalizeItemizationItems(nextItems: ItemizationItem[]) {
  return nextItems.map((item) => normalizePosterBalance(item));
}

const buttonStyle: CSSProperties = {
  height: "44px",
  padding: "0 18px",
  borderRadius: "14px",
  border: "1px solid rgba(188, 193, 203, 0.68)",
  background: "rgba(255, 255, 255, 0.96)",
  color: "#15304f",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 14px 24px rgba(119, 151, 198, 0.10)",
};

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: "100vh",
    padding: "18px",
    position: "relative",
    overflowX: "hidden",
    overflowY: "auto",
    color: "#16304d",
    background:
      "radial-gradient(circle at top left, rgba(146, 198, 255, 0.22) 0%, rgba(146, 198, 255, 0) 34%), radial-gradient(circle at top right, rgba(255, 186, 213, 0.18) 0%, rgba(255, 186, 213, 0) 30%), linear-gradient(180deg, #f6f9fc 0%, #eef4fb 100%)",
  },
  content: {
    position: "relative",
    zIndex: 1,
    width: "calc(100vw - 36px)",
    margin: "0",
    display: "grid",
    gap: "18px",
    minWidth: 0,
    paddingTop: "92px",
  },
  heroBar: {
    position: "fixed",
    top: "18px",
    left: "18px",
    right: "18px",
    zIndex: 5,
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 18px 36px rgba(52, 84, 120, 0.08)",
  },
  heroBarCopy: {
    display: "flex",
    gap: "6px",
    minWidth: "220px",
    flex: "1 1 260px",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  heroBarTop: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  heroBarDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#8ec4ff",
    boxShadow: "0 0 0 6px rgba(142, 196, 255, 0.18)",
    flexShrink: 0,
  },
  heroBarActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    alignItems: "center",
    flex: "0 1 auto",
  },
  heroBarMeta: {
    display: "grid",
    gap: "8px",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    minWidth: "520px",
  },
  heroBarMetaCard: {
    padding: "10px 12px",
    borderRadius: "14px",
    border: "1px solid rgba(176, 194, 218, 0.22)",
    background: "linear-gradient(135deg, rgba(243, 248, 255, 0.95) 0%, rgba(255, 239, 245, 0.92) 100%)",
    boxShadow: "0 12px 22px rgba(52, 84, 120, 0.06)",
  },
  heroBarMetaLabel: {
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
    marginBottom: "4px",
  },
  heroBarMetaValue: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#17314f",
    wordBreak: "break-word",
  },
  heroBarBalance: {
    fontSize: "18px",
    fontWeight: 900,
    color: "#17314f",
  },
  heroBarAction: {
    minWidth: "136px",
    height: "44px",
    padding: "0 18px",
    borderRadius: "14px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    background: "rgba(255,255,255,0.9)",
    color: "#35506d",
    textAlign: "center",
    cursor: "pointer",
    fontWeight: 800,
    boxShadow: "0 14px 24px rgba(119, 151, 198, 0.08)",
  },
  heroBarActionActive: {
    background: "linear-gradient(135deg, #dbeeff 0%, #c6ddfb 100%)",
    border: "1px solid rgba(106, 137, 180, 0.24)",
    color: "#15304f",
    boxShadow: "0 14px 24px rgba(119, 151, 198, 0.16)",
  },
  topRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 340px)",
    gap: "4px",
    alignItems: "stretch",
  },
  headerCard: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    padding: "4px 10px",
    borderRadius: "28px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.74)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.10)",
    minWidth: 0,
  },
  heroCopy: {
    display: "grid",
    gap: "1px",
    alignContent: "start",
    flex: "1 1 auto",
    minWidth: 0,
  },
  heroStatusTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "6px",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    height: "18px",
    padding: "0 7px",
    borderRadius: "999px",
    background: "rgba(224, 237, 250, 0.95)",
    border: "1px solid rgba(158, 176, 204, 0.22)",
    fontSize: "9px",
    fontWeight: 800,
    color: "#35506d",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#8ec4ff",
    boxShadow: "0 0 0 6px rgba(142, 196, 255, 0.18)",
    flexShrink: 0,
  },
  heroArt: {
    display: "grid",
    alignItems: "stretch",
  },
  heroStatusCard: {
    borderRadius: "24px",
    padding: "5px 8px",
    background: "linear-gradient(135deg, rgba(243, 248, 255, 0.95) 0%, rgba(255, 239, 245, 0.92) 100%)",
    border: "1px solid rgba(175, 193, 218, 0.22)",
    boxShadow: "0 18px 38px rgba(52, 84, 120, 0.08)",
    display: "grid",
    gap: "5px",
    alignContent: "start",
  },
  heroStatusTitle: {
    fontSize: "13px",
    lineHeight: 1.08,
    fontWeight: 900,
    color: "#17324f",
  },
  heroStatusText: {
    fontSize: "9px",
    lineHeight: 1.1,
    color: "#536579",
  },
  balanceCard: {
    minWidth: "300px",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(236,243,251,0.96) 100%)",
    boxShadow: "0 18px 38px rgba(52, 84, 120, 0.08)",
    padding: "5px 8px",
    display: "grid",
    gap: "3px",
    alignContent: "start",
  },
  balanceKicker: {
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: "12px",
    fontWeight: 800,
    color: "#74879c",
  },
  balanceTitle: {
    fontSize: "11px",
    fontWeight: 800,
    color: "#17324f",
  },
  balanceContextGrid: {
    display: "grid",
    gap: "3px",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  balanceLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
    marginBottom: "1px",
  },
  balanceContextValue: {
    fontSize: "11px",
    fontWeight: 800,
    color: "#17314f",
    wordBreak: "break-word",
  },
  balanceAmount: {
    padding: "5px 8px",
    borderRadius: "22px",
    background: "rgba(255, 255, 255, 0.92)",
    border: "1px solid rgba(176, 194, 218, 0.24)",
    boxShadow: "0 14px 24px rgba(119, 151, 198, 0.08)",
    fontSize: "16px",
    fontWeight: 900,
    color: "#17314f",
    letterSpacing: "-0.02em",
  },
  balanceMeta: {
    fontSize: "9px",
    lineHeight: 1.1,
    color: "#5d7187",
  },
  title: {
    margin: 0,
    fontSize: "24px",
    lineHeight: 1,
    fontWeight: 900,
    color: "#17314f",
  },
  subtitle: {
    margin: 0,
    maxWidth: "760px",
    fontSize: "11px",
    lineHeight: 1.15,
    color: "#536579",
    fontWeight: 700,
  },
  kicker: {
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: "12px",
    fontWeight: 800,
    color: "#74879c",
    marginBottom: "8px",
  },
  headerActions: {
    display: "flex",
    gap: "5px",
    flexWrap: "wrap",
    marginTop: "auto",
    paddingTop: "8px",
  },
  sheetCard: {
    borderRadius: "28px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.74)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 24px 60px rgba(52, 84, 120, 0.10)",
    padding: "8px 16px 10px",
    minWidth: 0,
  },
  sheetSectionHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "12px",
    alignItems: "center",
    marginBottom: "16px",
  },
  sectionKicker: {
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    fontSize: "12px",
    fontWeight: 800,
    color: "#74879c",
    marginBottom: "8px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 900,
    color: "#17314f",
  },
  sectionMeta: {
    fontSize: "14px",
    lineHeight: 1.55,
    color: "#5d7187",
    maxWidth: "100%",
    textAlign: "left",
  },
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
    marginTop: "2px",
  },
  toolbarGroup: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
    minWidth: 0,
  },
  controlButton: {
    ...buttonStyle,
    minWidth: "44px",
    padding: "0 14px",
    flex: "0 0 auto",
  },
  controlButtonDanger: {
    ...buttonStyle,
    borderColor: "rgba(224, 180, 180, 0.8)",
    flex: "0 0 auto",
  },
  previewWrap: {
    display: "grid",
    gap: "4px",
    flex: "1 1 280px",
    minWidth: "220px",
    alignSelf: "center",
  },
  previewLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
  },
  previewInput: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(188, 193, 203, 0.86)",
    background: "rgba(255, 255, 255, 0.98)",
    color: "#17314f",
    fontSize: "15px",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.7)",
  },
  previewInputReadonly: {
    background: "#f2f5f9",
    color: "#556173",
  },
  previewSelect: {
    width: "100%",
    minHeight: "52px",
    padding: "8px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(188, 193, 203, 0.86)",
    background: "rgba(255, 255, 255, 0.96)",
    color: "#15304f",
    fontWeight: 700,
    boxSizing: "border-box",
    font: "inherit",
    outline: "none",
    boxShadow: "0 14px 24px rgba(119, 151, 198, 0.10)",
  },
  summaryBar: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "12px",
    marginTop: "16px",
  },
  summaryChip: {
    borderRadius: "16px",
    padding: "12px 14px",
    border: "1px solid rgba(188, 193, 203, 0.68)",
    background: "rgba(255, 255, 255, 0.96)",
    boxShadow: "0 12px 22px rgba(119, 151, 198, 0.08)",
  },
  summaryLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    fontWeight: 800,
    marginBottom: "6px",
  },
  summaryValue: {
    fontSize: "18px",
    fontWeight: 900,
    color: "#17314f",
  },
  summaryValueGood: {
    color: "#1f6b2a",
  },
  summaryValueWarn: {
    color: "#a15c00",
  },
  footerBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: "16px",
  },
  footerMeta: {
    fontSize: "14px",
    color: "#5d7187",
  },
  selectionTip: {
    borderRadius: "16px",
    padding: "12px 14px",
    background: "rgba(255, 255, 255, 0.86)",
    border: "1px solid rgba(176, 194, 218, 0.22)",
    color: "#5d7187",
    fontSize: "14px",
  },
  lockedBadge: {
    borderRadius: "999px",
    padding: "8px 12px",
    background: "transparent",
    border: 0,
    fontWeight: 800,
  },
  lockedBadgeLocked: {
    color: "#b42318",
  },
  lockedBadgeUnlocked: {
    color: "#067647",
  },
  pdfOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(19, 31, 46, 0.26)",
    backdropFilter: "blur(6px)",
    display: "block",
    padding: "0",
  },
  pdfWindow: {
    position: "absolute",
    width: "min(1180px, calc(100vw - 36px))",
    height: "min(84vh, 900px)",
    borderRadius: "24px",
    border: "1px solid rgba(140, 160, 184, 0.24)",
    background: "rgba(255,255,255,0.98)",
    boxShadow: "0 28px 70px rgba(11, 24, 40, 0.26)",
    overflow: "hidden",
    resize: "both",
    minWidth: "720px",
    minHeight: "520px",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },
  pdfHeader: {
    flex: "0 0 auto",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    padding: "14px 16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.18)",
    background: "linear-gradient(180deg, rgba(248, 250, 253, 0.98) 0%, rgba(241, 245, 250, 0.98) 100%)",
  },
  pdfTitle: {
    fontSize: "16px",
    fontWeight: 900,
    color: "#17314f",
  },
  pdfMeta: {
    marginTop: "4px",
    fontSize: "13px",
    color: "#5f6b7a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "44vw",
  },
  pdfControls: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  pdfControlButton: {
    height: "38px",
    minWidth: "38px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.24)",
    background: "#ffffff",
    color: "#35506d",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(52, 84, 120, 0.08)",
  },
  pdfCloseButton: {
    height: "38px",
    minWidth: "38px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(200, 90, 90, 0.28)",
    background: "#fff5f5",
    color: "#a32121",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(52, 84, 120, 0.08)",
  },
  pdfBody: {
    flex: "1 1 auto",
    minHeight: 0,
    overflow: "hidden",
    background: "#eef3f8",
  },
  pdfStageWrap: {
    width: "100%",
    height: "100%",
    overflow: "auto",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "16px",
    boxSizing: "border-box",
  },
  pdfStage: {
    width: "100%",
    height: "100%",
    transformOrigin: "top center",
  },
  pdfFrame: {
    width: "100%",
    height: "100%",
    border: 0,
    borderRadius: "18px",
    background: "#ffffff",
  },
  pdfDock: {
    position: "fixed",
    right: "18px",
    bottom: "18px",
    zIndex: 1001,
    height: "44px",
    padding: "0 16px",
    borderRadius: "999px",
    border: "1px solid rgba(140, 160, 184, 0.24)",
    background: "rgba(255,255,255,0.96)",
    color: "#17314f",
    fontWeight: 900,
    boxShadow: "0 18px 34px rgba(11, 24, 40, 0.20)",
    cursor: "pointer",
  },
};

export default function Itemization() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const attachmentId = searchParams.get("attachmentId");
  const day = searchParams.get("day");
  const site = searchParams.get("site") || "";
  const importId = Number(attachmentId || 0);
  const storageKey = attachmentId ? `itemization:${attachmentId}` : "";

  const [items, setItems] = useState<ItemizationItem[]>(() => {
    if (!storageKey) return [];
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return [];
    try {
      return normalizeItemizationItems(JSON.parse(saved) as ItemizationItem[]);
    } catch {
      window.localStorage.removeItem(storageKey);
      return [];
    }
  });

  const [sortField, setSortField] = useState<ItemizationField>("poster");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [selectedField, setSelectedField] = useState<ItemizationField>("type");
  const [selectionDraft, setSelectionDraft] = useState("");
  const [isEditingSelection, setIsEditingSelection] = useState(false);
  const [flywireImportLoading, setFlywireImportLoading] = useState(false);
  const [miscTypeOptions, setMiscTypeOptions] = useState<string[]>([]);
  const [sheetLocked, setSheetLocked] = useState(true);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatusKind>("not_saved");
  const [balsheetBalance, setBalsheetBalance] = useState<number | null>(null);
  const [balsheetBalanceCount, setBalsheetBalanceCount] = useState(0);
  const [balsheetBalanceLoading, setBalsheetBalanceLoading] = useState(false);
  const [balsheetBalanceError, setBalsheetBalanceError] = useState<string | null>(null);
  const [originalPdfOpen, setOriginalPdfOpen] = useState(false);
  const [originalPdfMinimized, setOriginalPdfMinimized] = useState(false);
  const [originalPdfZoom, setOriginalPdfZoom] = useState(1);
  const [originalPdfPosition, setOriginalPdfPosition] = useState({ x: 0, y: 0 });
  const [originalPdfSize, setOriginalPdfSize] = useState({ width: 0, height: 0 });
  const [originalPdfScroll, setOriginalPdfScroll] = useState({ left: 0, top: 0 });
  const [originalPdfDragging, setOriginalPdfDragging] = useState(false);
  const originalPdfDragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const originalPdfWindowRef = useRef<HTMLDivElement | null>(null);
  const originalPdfScrollRef = useRef<HTMLDivElement | null>(null);
  const requiredTotal = getRequiredTotal(attachmentId, searchParams.get("requiredTotal"));

  useEffect(() => {
    let active = true;

    const loadBalsheetBalance = async () => {
      if (!day || !site) {
        setBalsheetBalance(null);
        setBalsheetBalanceCount(0);
        setBalsheetBalanceError(null);
        setBalsheetBalanceLoading(false);
        return;
      }

      setBalsheetBalanceLoading(true);
      setBalsheetBalanceError(null);

      try {
        const response = await getBalsheet(day);
        if (!active) {
          return;
        }

        const normalizedSite = normalizeText(site).toLowerCase();
        const matchingRows = response.data.filter((row) => normalizeText(row.type).toLowerCase() === normalizedSite);
        const total = matchingRows.reduce((acc, row) => acc + parseAmount(row.amount), 0);

        setBalsheetBalance(total);
        setBalsheetBalanceCount(matchingRows.length);
      } catch (err) {
        if (!active) {
          return;
        }

        setBalsheetBalance(null);
        setBalsheetBalanceCount(0);
        setBalsheetBalanceError(err instanceof Error ? err.message : "Failed to load Balsheet balance.");
      } finally {
        if (active) {
          setBalsheetBalanceLoading(false);
        }
      }
    };

    void loadBalsheetBalance();

    return () => {
      active = false;
    };
  }, [day, site]);

  useEffect(() => {
    let active = true;

    const loadMiscTypes = async () => {
      try {
        const response = await getMisc();
        if (!active) {
          return;
        }

        const nextOptions = Array.from(
          new Set(
            response.data.flatMap((row) =>
              splitMultiValue(String(row.misc_type ?? ""))
            )
          )
        ).sort((left, right) => left.localeCompare(right));

        setMiscTypeOptions(nextOptions);
      } catch {
        if (active) {
          setMiscTypeOptions([]);
        }
      }
    };

    void loadMiscTypes();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedRowId != null || items.length === 0) {
      return;
    }

    const firstRow = items[0];
    if (firstRow) {
      setSelectedRowId(firstRow.id);
      setSelectedField("type");
      setSelectionDraft(String(firstRow.type ?? ""));
    }
  }, [items, selectedRowId]);

  useEffect(() => {
    if (!attachmentId) {
      setSavedSnapshot(null);
      setSaveStatus("not_saved");
      return;
    }

    let active = true;

    const loadSavedItemization = async () => {
      try {
        const response = await getItemization(Number(attachmentId));
        if (!active) {
          return;
        }

        const saved = response.data.payload as ItemizationSavedPayload | null;
        setSavedSnapshot(saved ? JSON.stringify(saved) : null);

        const hasLocalDraft = Boolean(window.localStorage.getItem(storageKey));
        if (saved && !hasLocalDraft) {
          const nextItems = normalizeItemizationItems((saved.items || []) as ItemizationItem[]);
          setItems(nextItems);
          window.localStorage.setItem(storageKey, JSON.stringify(nextItems));
        }
      } catch {
        if (active) {
          setSavedSnapshot(null);
        }
      }
    };

    void loadSavedItemization();

    return () => {
      active = false;
    };
  }, [attachmentId, storageKey]);

  const saveItems = (nextItems: ItemizationItem[]) => {
    const normalizedItems = normalizeItemizationItems(nextItems);
    setItems(normalizedItems);
    if (storageKey) {
      window.localStorage.setItem(storageKey, JSON.stringify(normalizedItems));
    }
  };

  const refreshDerivedTotals = () => {
    if (items.length === 0) {
      return;
    }

    saveItems(items);
  };

  async function saveItemization() {
    if (!attachmentId) {
      return;
    }

    const attachmentNumber = Number(attachmentId);
    const payload: ItemizationSavedPayload = {
      items,
    };

    setSaveStatus("saving");

    try {
      await updateItemization(attachmentNumber, payload);
      setSavedSnapshot(JSON.stringify(payload));
      if (storageKey) {
        window.localStorage.setItem(storageKey, JSON.stringify(items));
      }
    } catch {
      setSaveStatus(savedSnapshot ? "dirty" : "not_saved");
      return;
    } finally {
      setSaveStatus((current) => (current === "saving" ? "saved" : current));
    }
  }

  const saveSnapshot = useMemo(
    () => JSON.stringify({ items }),
    [items]
  );
  const saveStatusLabel = useMemo(() => {
    if (saveStatus === "saving") {
      return "Saving...";
    }

    if (!savedSnapshot) {
      return "Not saved";
    }

    return saveSnapshot === savedSnapshot ? "Saved" : "Unsaved changes";
  }, [saveSnapshot, saveStatus, savedSnapshot]);
  const saveStatusKind = useMemo<SaveStatusKind>(() => {
    if (saveStatus === "saving") {
      return "saving";
    }

    if (!savedSnapshot) {
      return "not_saved";
    }

    return saveSnapshot === savedSnapshot ? "saved" : "dirty";
  }, [saveSnapshot, saveStatus, savedSnapshot]);

  const updateField = (field: ItemizationField, value: string) => {
    setSelectionDraft(value);
    if (selectedRowId == null || !isEditingSelection || sheetLocked) {
      return;
    }

    commitCellValue(selectedRowId, field, value);
  };

  const commitCellValue = (rowId: number, field: ItemizationField, value: string) => {
    if (field === "nick" || field === "raul") {
      return;
    }

    const nextDraft = field === "amount" || field === "unposted" || field === "misc" ? formatCurrency(value) : value;

    saveItems(
      items.map((item) => {
        if (item.id !== rowId) return item;

        const nextItem = { ...item, [field]: value } as ItemizationItem;
        if (field === "amount" || field === "poster" || field === "unposted" || field === "misc") {
          return applyPosterBalance(nextItem) as ItemizationItem;
        }
        return nextItem;
      })
    );

    if (selectedRowId === rowId && selectedField === field) {
      setSelectionDraft(nextDraft);
    }
  };

  const selectedRow = useMemo(() => items.find((item) => item.id === selectedRowId) || null, [items, selectedRowId]);

  const sortedItems = useMemo(() => {
    const nextItems = [...items];
    const numericSortFields = new Set<ItemizationField>(["amount", "unposted", "misc", "nick", "raul"]);

    nextItems.sort((left, right) => {
      const leftValue = left[sortField];
      const rightValue = right[sortField];
      let comparison = 0;

      if (numericSortFields.has(sortField)) {
        comparison = parseAmount(leftValue) - parseAmount(rightValue);
      } else {
        comparison = String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, {
          sensitivity: "base",
        });
      }

      if (comparison === 0) {
        comparison = Number(left.id) - Number(right.id);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return nextItems;
  }, [items, sortDirection, sortField]);

  const sortedSelectedIndex = useMemo(
    () => sortedItems.findIndex((item) => item.id === selectedRowId),
    [selectedRowId, sortedItems]
  );

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, item) =>
          isExcludedFromRequiredTotal(item)
            ? acc
            : {
                total: acc.total + Number(item.amount || 0),
                nick: acc.nick + parseAmount(item.nick),
                raul: acc.raul + parseAmount(item.raul),
              },
        { total: 0, nick: 0, raul: 0 }
      ),
    [items]
  );

  const remaining = requiredTotal - totals.total;

  const titleText = attachmentId ? `Attachment #${attachmentId}` : "Itemization sheet";

  const syncSelectionDraftFromSelection = (rowId: number, field: ItemizationField) => {
    const row = items.find((item) => item.id === rowId);
    if (!row) return;

    const value = row[field];
    setSelectionDraft(field === "amount" || field === "unposted" || field === "misc" || field === "nick" || field === "raul" ? formatCurrency(value) : String(value ?? ""));
  };

  const selectCell = (rowId: number, field: ItemizationField) => {
    setSelectedRowId(rowId);
    setSelectedField(field);
    setIsEditingSelection(false);
    syncSelectionDraftFromSelection(rowId, field);
  };

  const createRow = () => {
    const nextItem: ItemizationItem = {
      ...makeInitialForm(site),
      id: Date.now(),
      importId,
      type: site,
      amount: 0,
      misc: 0,
    } as ItemizationItem;

    saveItems([...items, nextItem]);
    setSelectedRowId(nextItem.id);
    setSelectedField("type");
    setSelectionDraft(String(nextItem.type || ""));
    setIsEditingSelection(true);
    setSheetLocked(false);
  };

  const importLoadedFlywire = async () => {
    if (!attachmentId) {
      return;
    }

    if (!site.trim()) {
      return;
    }

    setFlywireImportLoading(true);

    try {
      const response = await loadFlywire(Number(attachmentId));
      const payload = response.data;
      if (!payload.rows.length) {
        return;
      }

      const nextItems = [...items, ...mapFlywireRowsToItems(payload, site.trim(), importId)];
      saveItems(nextItems);

      const firstImported = nextItems[nextItems.length - payload.rows.length];
      if (firstImported) {
        setSelectedRowId(firstImported.id);
        setSelectedField("type");
        setSelectionDraft(String(firstImported.type ?? ""));
        setIsEditingSelection(true);
      }

      setSheetLocked(false);
    } catch (error) {
    } finally {
      setFlywireImportLoading(false);
    }
  };

  const openOriginalPdf = () => {
    if (!attachmentId) return;
    setOriginalPdfPosition({
      x: Math.max(16, Math.round(window.innerWidth * 0.08)),
      y: Math.max(16, Math.round(window.innerHeight * 0.08)),
    });
    setOriginalPdfSize({
      width: Math.min(1180, Math.max(720, Math.round(window.innerWidth * 0.84))),
      height: Math.min(900, Math.max(520, Math.round(window.innerHeight * 0.84))),
    });
    setOriginalPdfOpen(true);
    setOriginalPdfMinimized(false);
    setOriginalPdfZoom(1);
    setOriginalPdfScroll({ left: 0, top: 0 });
  };

  const minimizeOriginalPdf = () => {
    if (originalPdfWindowRef.current) {
      const rect = originalPdfWindowRef.current.getBoundingClientRect();
      setOriginalPdfSize({
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      });
    }
    if (originalPdfScrollRef.current) {
      setOriginalPdfScroll({
        left: originalPdfScrollRef.current.scrollLeft,
        top: originalPdfScrollRef.current.scrollTop,
      });
    }
    setOriginalPdfMinimized(true);
  };

  const restoreOriginalPdf = () => {
    setOriginalPdfMinimized(false);
  };

  const closeOriginalPdf = () => {
    setOriginalPdfOpen(false);
    setOriginalPdfMinimized(false);
    setOriginalPdfZoom(1);
    setOriginalPdfDragging(false);
    originalPdfDragRef.current = null;
  };

  const zoomOriginalPdfIn = () => {
    setOriginalPdfZoom((current) => Math.min(current + 0.25, 3));
  };

  const zoomOriginalPdfOut = () => {
    setOriginalPdfZoom((current) => Math.max(current - 0.25, 0.5));
  };

  const resetOriginalPdfZoom = () => {
    setOriginalPdfZoom(1);
  };

  const onOriginalPdfHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement | null)?.closest("button")) {
      return;
    }

    event.preventDefault();
    originalPdfDragRef.current = {
      offsetX: event.clientX - originalPdfPosition.x,
      offsetY: event.clientY - originalPdfPosition.y,
    };
    setOriginalPdfDragging(true);
  };

  useEffect(() => {
    if (!originalPdfDragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!originalPdfDragRef.current) return;

      setOriginalPdfPosition({
        x: Math.max(12, event.clientX - originalPdfDragRef.current.offsetX),
        y: Math.max(12, event.clientY - originalPdfDragRef.current.offsetY),
      });
    };

    const handlePointerUp = () => {
      setOriginalPdfDragging(false);
      originalPdfDragRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [originalPdfDragging]);

  useEffect(() => {
    if (!originalPdfOpen || originalPdfMinimized || !originalPdfWindowRef.current) {
      return;
    }

    const windowElement = originalPdfWindowRef.current;
    const observer = new ResizeObserver(() => {
      const rect = windowElement.getBoundingClientRect();
      setOriginalPdfSize({
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      });
    });

    observer.observe(windowElement);

    const rect = windowElement.getBoundingClientRect();
    setOriginalPdfSize({
      width: Math.max(0, Math.round(rect.width)),
      height: Math.max(0, Math.round(rect.height)),
    });

    return () => observer.disconnect();
  }, [originalPdfOpen, originalPdfMinimized]);

  useEffect(() => {
    if (!originalPdfOpen || originalPdfMinimized || !originalPdfScrollRef.current) {
      return;
    }

    originalPdfScrollRef.current.scrollLeft = originalPdfScroll.left;
    originalPdfScrollRef.current.scrollTop = originalPdfScroll.top;
  }, [originalPdfOpen, originalPdfMinimized, originalPdfScroll.left, originalPdfScroll.top]);

  const handleClearSelectedCell = () => {
    if (selectedRowId == null || sheetLocked) return;
    commitCellValue(selectedRowId, selectedField, "");
    setSelectionDraft("");
    setIsEditingSelection(true);
  };

  const handleDeleteSelectedRow = () => {
    if (selectedRowId == null || sheetLocked) return;

    const nextItems = items.filter((item) => item.id !== selectedRowId);
    saveItems(nextItems);

    if (nextItems.length === 0) {
      setSelectedRowId(null);
      setSelectionDraft("");
      setIsEditingSelection(false);
      return;
    }

    const nextSelected = nextItems[Math.min(nextItems.length - 1, Math.max(0, sortedSelectedIndex))];
    setSelectedRowId(nextSelected.id);
    setSelectedField("type");
    setSelectionDraft(String(nextSelected.type ?? ""));
  };

  const handleSort = (field: ItemizationField, direction: "asc" | "desc") => {
    setSortField(field);
    setSortDirection(direction);
  };

  const selectedPreviewLabel = selectedRow ? `${selectedField} - row ${selectedRow.id}` : "";
  const selectedPreviewValue = selectedRow ? selectionDraft : "Select a cell in the grid";
  const miscTypePreviewOptions = useMemo(
    () => normalizeMultiSelectOptions(miscTypeOptions, selectedRow?.misc_type ? String(selectedRow.misc_type) : ""),
    [miscTypeOptions, selectedRow]
  );
  const keyproofReturnUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (attachmentId) params.set("attachmentId", attachmentId);
    if (day) params.set("day", day);
    if (site) params.set("site", site);
    return `/keyproof${params.toString() ? `?${params.toString()}` : ""}`;
  }, [attachmentId, day, site]);

  return (
    <AdminShell
      sidebarCopy=""
      onBack={() => {
        navigate(keyproofReturnUrl);
      }}
      hideSidebar
      backButtonFirst
      useGlobalMenuFallback={false}
      hideSidebarBackMenu
      hideSidebarBackStyles
      ribbonTitle="Itemization Menu"
      sidebarMiddleCard={
        <>
          <div style={adminStyles.sidebarCardLabel}>Attachment</div>
          <div style={adminStyles.sidebarCardValue}>
            <strong>{attachmentId ? `#${attachmentId}` : "Not set"}</strong>
          </div>
          <div style={adminStyles.sidebarCardMeta}>
            {attachmentId ? `${items.length} itemization row(s) loaded.` : "Open from Keyproof to keep the batch context."}
          </div>
        </>
      }
    >
      <div style={styles.content}>
        <section style={styles.heroBar}>
          <div style={styles.heroBarActions}>
            <button
              style={{
                ...styles.heroBarAction,
                ...(originalPdfOpen ? styles.heroBarActionActive : null),
              }}
              type="button"
              onClick={openOriginalPdf}
              disabled={!attachmentId}
            >
              Original PDF
            </button>
            <button
              style={styles.heroBarAction}
              type="button"
              onClick={() => void importLoadedFlywire()}
              disabled={!attachmentId || flywireImportLoading}
            >
              {flywireImportLoading ? "Importing Fly Wire..." : "Import Fly Wire"}
            </button>
            {originalPdfOpen && originalPdfMinimized && (
              <button type="button" style={styles.heroBarAction} onClick={restoreOriginalPdf}>
                Restore PDF
              </button>
            )}
            <button
              style={styles.heroBarAction}
              type="button"
              onClick={() => {
                const params = new URLSearchParams();
                if (day) {
                  params.set("day", day);
                }
                navigate(`/balsheet/view${params.toString() ? `?${params.toString()}` : ""}`);
              }}
            >
              Balsheet
            </button>
            <button style={styles.heroBarAction} type="button" onClick={() => navigate(keyproofReturnUrl)} disabled={!attachmentId}>
              Keyproof
            </button>
          </div>

          <div style={styles.heroBarCopy}>
            <span
              style={{
                ...styles.statusPill,
                ...(saveStatusKind === "saved"
                  ? { background: "rgba(243, 255, 245, 0.98)", border: "1px solid rgba(151, 207, 158, 0.75)", color: "#1f6b2a" }
                  : saveStatusKind === "dirty"
                    ? { background: "rgba(255, 250, 240, 0.98)", border: "1px solid rgba(232, 194, 110, 0.72)", color: "#8a5b00" }
                    : saveStatusKind === "saving"
                      ? { background: "rgba(245, 250, 255, 0.98)", border: "1px solid rgba(176, 214, 255, 0.82)", color: "#1f4e91" }
                      : { background: "rgba(255, 247, 247, 0.98)", border: "1px solid rgba(240, 180, 180, 0.82)", color: "#a32121" }),
              }}
            >
              {saveStatusLabel}
            </span>
          </div>
        </section>

        <div style={styles.topRow}>
          <section style={styles.headerCard}>
            <div style={styles.heroCopy}>
              <div style={styles.heroStatusTop}>
                <span style={styles.statusPill}>Batch context</span>
                <span style={styles.statusDot} />
              </div>
              <h2 style={styles.title}>Keep the batch context in view</h2>
              <p style={styles.subtitle}>
                Use the grid below to itemize the batch while the sticky bar keeps the main handoff actions available.
              </p>
            </div>
          </section>

          <aside style={styles.balanceCard}>
            <div style={styles.heroStatusTop}>
              <div style={styles.balanceKicker}>Balsheet balance</div>
              <span style={styles.statusDot} />
            </div>
            <div style={styles.balanceTitle}>Date and site considered</div>
            <div style={styles.balanceContextGrid}>
              <div>
                <div style={styles.balanceLabel}>Date</div>
                <div style={styles.balanceContextValue}>{day || "Not set"}</div>
              </div>
              <div>
                <div style={styles.balanceLabel}>Site</div>
                <div style={styles.balanceContextValue}>{site || "Not set"}</div>
              </div>
            </div>
            <div style={styles.balanceAmount}>
              {balsheetBalanceLoading ? "Loading..." : formatCurrency(balsheetBalance ?? 0)}
            </div>
            <div style={styles.balanceMeta}>
              {balsheetBalanceError
                ? balsheetBalanceError
                : day && site
                  ? `${balsheetBalanceCount} matching Balsheet row${balsheetBalanceCount === 1 ? "" : "s"}`
                  : "Open from Keyproof to compare against this batch."}
            </div>
          </aside>
        </div>

        <section style={styles.sheetCard}>
          <div style={styles.toolbar}>
            <div style={styles.toolbarGroup}>
              <button type="button" style={buttonStyle} onClick={createRow}>
                Create New Row
              </button>
            </div>

            <button
              type="button"
              style={buttonStyle}
              onClick={() => setSheetLocked((current) => !current)}
              aria-pressed={sheetLocked}
            >
              {sheetLocked ? "Unlock" : "Lock"}
            </button>

            <button type="button" style={buttonStyle} onClick={() => void saveItemization()} disabled={!attachmentId}>
              Save Itemization
            </button>

            <button type="button" style={buttonStyle} onClick={refreshDerivedTotals} disabled={items.length === 0}>
              Refresh Totals
            </button>

            <div style={styles.previewWrap}>
              {selectedPreviewLabel ? <div style={styles.previewLabel}>{selectedPreviewLabel}</div> : null}
              {selectedField === "poster" && !sheetLocked && isEditingSelection && selectedRowId != null ? (
                <select
                  value={selectionDraft}
                  onChange={(event) => updateField(selectedField, event.target.value)}
                  style={styles.previewSelect}
                  aria-label="Poster preview"
                >
                  <option value="">Select poster</option>
                  {posterOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : selectedField === "misc_type" && !sheetLocked && isEditingSelection && selectedRowId != null ? (
                <select
                  multiple
                  value={splitMultiValue(selectionDraft)}
                  onChange={(event) =>
                    updateField(
                      selectedField,
                      joinMultiValue(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))
                    )
                  }
                  style={styles.previewSelect}
                  aria-label="Misc type preview"
                >
                  {miscTypePreviewOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={selectedPreviewValue}
                  readOnly={sheetLocked || !isEditingSelection || selectedRowId == null}
                  onChange={(event) => updateField(selectedField, event.target.value)}
                  style={{
                    ...styles.previewInput,
                    ...(sheetLocked || !isEditingSelection || selectedRowId == null ? styles.previewInputReadonly : {}),
                  }}
                  aria-label="Cell preview"
                />
              )}
            </div>

            <button type="button" style={buttonStyle} onClick={handleClearSelectedCell} disabled={selectedRowId == null}>
              Clear
            </button>
            <button
              type="button"
              style={styles.controlButtonDanger}
              onClick={handleDeleteSelectedRow}
              disabled={selectedRowId == null}
            >
              Delete Row
            </button>
            <div style={{ ...styles.lockedBadge, ...(sheetLocked ? styles.lockedBadgeLocked : styles.lockedBadgeUnlocked) }}>
              {sheetLocked ? "Sheet Locked" : "Sheet Unlocked"}
            </div>
          </div>
        </section>

        <section style={styles.sheetCard}>
          <div style={styles.sheetSectionHeader}>
          </div>

          <ItemizationGrid
            items={sortedItems}
            selectedRowId={selectedRowId}
            selectedField={selectedField}
            sheetLocked={sheetLocked}
            miscTypeOptions={miscTypeOptions}
            onSelectCell={selectCell}
            onCommitCell={commitCellValue}
            onSort={handleSort}
            sortField={sortField}
            sortDirection={sortDirection}
          />

          <div style={styles.summaryBar}>
            <div style={styles.summaryChip}>
              <div style={styles.summaryLabel}>Requires Itemization</div>
              <div style={styles.summaryValue}>${requiredTotal.toFixed(2)}</div>
            </div>
            <div style={styles.summaryChip}>
              <div style={styles.summaryLabel}>Itemized</div>
              <div style={styles.summaryValue}>${totals.total.toFixed(2)}</div>
            </div>
            <div style={styles.summaryChip}>
              <div style={styles.summaryLabel}>Difference</div>
              <div style={{ ...styles.summaryValue, ...(Math.abs(remaining) < 0.005 ? styles.summaryValueGood : styles.summaryValueWarn) }}>
                ${remaining.toFixed(2)}
              </div>
            </div>
            <div style={styles.summaryChip}>
              <div style={styles.summaryLabel}>Nick Total</div>
              <div style={styles.summaryValue}>${totals.nick.toFixed(2)}</div>
            </div>
            <div style={styles.summaryChip}>
              <div style={styles.summaryLabel}>Raul Total</div>
              <div style={styles.summaryValue}>${totals.raul.toFixed(2)}</div>
            </div>
          </div>

          <div style={styles.footerBar}>
            <div style={styles.footerMeta}>{attachmentId ? `Attachment #${attachmentId}` : "No attachment selected."}</div>
          </div>

        </section>

        {originalPdfOpen && attachmentId && !originalPdfMinimized && (
          <div style={styles.pdfOverlay}>
            <div
              ref={originalPdfWindowRef}
              style={{
                ...styles.pdfWindow,
                left: `${originalPdfPosition.x}px`,
                top: `${originalPdfPosition.y}px`,
                width: `${originalPdfSize.width || 0}px`,
                height: `${originalPdfSize.height || 0}px`,
              }}
            >
              <div
                style={{
                  ...styles.pdfHeader,
                  cursor: originalPdfDragging ? "grabbing" : "grab",
                  touchAction: "none",
                }}
                onPointerDown={onOriginalPdfHeaderPointerDown}
              >
                <div>
                  <div style={styles.pdfTitle}>Original PDF</div>
                  <div style={styles.pdfMeta}>{titleText}</div>
                </div>
                <div style={styles.pdfControls}>
                  <button type="button" style={styles.pdfControlButton} onClick={zoomOriginalPdfOut}>
                    -
                  </button>
                  <button type="button" style={styles.pdfControlButton} onClick={resetOriginalPdfZoom}>
                    {Math.round(originalPdfZoom * 100)}%
                  </button>
                  <button type="button" style={styles.pdfControlButton} onClick={zoomOriginalPdfIn}>
                    +
                  </button>
                  <button type="button" style={styles.pdfControlButton} onClick={minimizeOriginalPdf} title="Minimize">
                    _
                  </button>
                  <button type="button" style={styles.pdfCloseButton} onClick={closeOriginalPdf} title="Close">
                    ×
                  </button>
                </div>
              </div>
              <div style={styles.pdfBody}>
                <div
                  ref={originalPdfScrollRef}
                  style={styles.pdfStageWrap}
                  onScroll={() => {
                    if (!originalPdfScrollRef.current) return;
                    setOriginalPdfScroll({
                      left: originalPdfScrollRef.current.scrollLeft,
                      top: originalPdfScrollRef.current.scrollTop,
                    });
                  }}
                >
                  <div
                    style={{
                      ...styles.pdfStage,
                      transform: `scale(${originalPdfZoom})`,
                    }}
                  >
                    <iframe
                      src={`${API_BASE}/attachments/${attachmentId}/original`}
                      title={`Original PDF ${attachmentId}`}
                      style={styles.pdfFrame}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminShell>
  );
}

