import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { approveAttachment, updateAttachmentSite } from "../api/attachmentreview_api";
import {
  autofindFlywire,
  getItemization,
  getKeyproof,
  getSites,
  loadFlywire,
  updateItemization,
  updateKeyproof,
  uploadFlywire,
} from "../api/keyproof_api";
import { getBalsheet, saveBalsheetEntries, type BalsheetEntry } from "../api/balsheet_api";
import type { FlywirePayload, FlywireRow, KeyproofDraft, KeyproofSavedPayload, SiteOption } from "../api/keyproof_api";
import { API_BASE } from "../config/apiBase";
import "./keyproof.css";

const snapshotUrl = (id: string) => `${API_BASE}/attachments/${id}/snapshot`;

const emptyForm: Omit<KeyproofDraft, "attachmentId"> = {
  site: "",
  cash: "",
  check: "",
  creditCard: "",
  eft: "",
  lockbox: "",
  foreignCheck: "",
  wireTransfer: "",
  misc: "",
};

const moneyFields: Array<keyof Omit<KeyproofDraft, "attachmentId" | "site">> = [
  "cash",
  "check",
  "creditCard",
  "eft",
  "lockbox",
  "foreignCheck",
  "wireTransfer",
  "misc",
];

const itemizationRequiredFields = [
  "cash",
  "check",
  "creditCard",
  "foreignCheck",
  "wireTransfer",
  "misc",
] as const;

function parseAmount(value: string) {
  const parsed = Number.parseFloat(String(value || "").replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function normalizeCurrencyInput(value: string) {
  return String(value || "").replace(/[$,]/g, "").trim();
}

function formatCurrencyInput(value: string) {
  const normalized = normalizeCurrencyInput(value);
  if (!normalized) {
    return "";
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? formatCurrency(parsed) : normalized;
}

function normalizeKeyproofForm(form: Partial<Omit<KeyproofDraft, "attachmentId">>) {
  const normalized = { ...form } as Omit<KeyproofDraft, "attachmentId">;

  moneyFields.forEach((field) => {
    normalized[field] = formatCurrencyInput(normalized[field]);
  });

  return normalized;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function formatFlywireAmount(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return formatCurrency(value);
}

function keyproofStorageKey(id: string) {
  return `keyproof:${id}`;
}

function itemizationStorageKey(id: string) {
  return `itemization:${id}`;
}

function normalizeDateInput(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const dayPart = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayPart}`;
}

type StatusKind = "idle" | "success" | "error";
type SaveStatusKind = "saved" | "dirty" | "saving" | "not_saved";

function summarizeFlywireRows(rows: FlywireRow[]) {
  return rows.slice(0, 5);
}

function isNearZero(value: number) {
  return Math.abs(value) <= 0.005;
}

function formatDifference(value: number) {
  return formatCurrency(isNearZero(value) ? 0 : value);
}

function requiresItemization(form: Partial<Omit<KeyproofDraft, "attachmentId">>) {
  return itemizationRequiredFields.some((field) => !isNearZero(parseAmount(String(form[field] ?? ""))));
}

export default function Keyproof() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flywireFileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentId = searchParams.get("attachmentId");
  const day = searchParams.get("day");
  const siteFromParams = searchParams.get("site") || "";
  const [form, setForm] = useState({ ...emptyForm, site: siteFromParams });
  const [batchDate, setBatchDate] = useState(() => normalizeDateInput(day));
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [siteLoadError, setSiteLoadError] = useState<string | null>(null);
  const [flywirePayload, setFlywirePayload] = useState<FlywirePayload | null>(null);
  const [flywireStatus, setFlywireStatus] = useState<{ kind: StatusKind; text: string }>({
    kind: "idle",
    text: "Upload the Fly Wire report for this batch to view it here.",
  });
  const [flywireLoading, setFlywireLoading] = useState(false);
  const [flywireAutofindMatched, setFlywireAutofindMatched] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [matchWarning, setMatchWarning] = useState<string | null>(null);
  const [confirmReady, setConfirmReady] = useState(false);
  const [paperworkTotalInput, setPaperworkTotalInput] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatusKind>("not_saved");
  const [balsheetBalance, setBalsheetBalance] = useState<number | null>(null);
  const [balsheetBalanceCount, setBalsheetBalanceCount] = useState(0);
  const [balsheetBalanceLoading, setBalsheetBalanceLoading] = useState(false);
  const [balsheetBalanceError, setBalsheetBalanceError] = useState<string | null>(null);
  const [itemizationCopyLoading, setItemizationCopyLoading] = useState(false);

  useEffect(() => {
    getSites()
      .then((response) => {
        setSites(response.data);
        setSiteLoadError(null);
      })
      .catch((err) => {
        setSites([]);
        setSiteLoadError(err instanceof Error ? err.message : "Failed to load sites");
      });
  }, []);

  const loadBalsheetBalance = useCallback(async () => {
    if (!batchDate || !form.site) {
      setBalsheetBalance(null);
      setBalsheetBalanceCount(0);
      setBalsheetBalanceError(null);
      setBalsheetBalanceLoading(false);
      return;
    }

    setBalsheetBalanceLoading(true);
    setBalsheetBalanceError(null);

    try {
      const response = await getBalsheet(batchDate);
      const normalizedSite = String(form.site ?? "").trim().toLowerCase();
      const matchingRows = response.data.filter((row) => String(row.type ?? "").trim().toLowerCase() === normalizedSite);
      const total = matchingRows.reduce((acc, row) => acc + Number(row.amount || 0), 0);

      setBalsheetBalance(total);
      setBalsheetBalanceCount(matchingRows.length);
    } catch (error) {
      setBalsheetBalance(null);
      setBalsheetBalanceCount(0);
      setBalsheetBalanceError(error instanceof Error ? error.message : "Failed to load Balsheet balance.");
    } finally {
      setBalsheetBalanceLoading(false);
    }
  }, [batchDate, form.site]);

  useEffect(() => {
    void loadBalsheetBalance();
  }, [loadBalsheetBalance]);

  useEffect(() => {
    if (!attachmentId) return;

    const saved = window.localStorage.getItem(keyproofStorageKey(attachmentId));
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Partial<typeof emptyForm> & {
        batchDate?: string;
        paperworkTotal?: string;
      };
      setForm((current) => ({
        ...current,
        ...normalizeKeyproofForm(parsed),
        site: parsed.site || siteFromParams || current.site,
      }));
      setBatchDate(normalizeDateInput(parsed.batchDate) || normalizeDateInput(day));
      setPaperworkTotalInput(formatCurrencyInput(String(parsed.paperworkTotal ?? "")));
    } catch {
      window.localStorage.removeItem(keyproofStorageKey(attachmentId));
    }
  }, [attachmentId, siteFromParams]);

  useEffect(() => {
    if (!attachmentId) {
      setSavedSnapshot(null);
      setSaveStatus("not_saved");
      return;
    }

    let active = true;

    const loadSavedKeyproof = async () => {
      try {
        const response = await getKeyproof(Number(attachmentId));
        if (!active) {
          return;
        }

        const saved = response.data.payload;
        const normalizedSaved = saved
          ? {
              ...saved,
              form: normalizeKeyproofForm(saved.form),
              paperworkTotal: formatCurrencyInput(String(saved.paperworkTotal ?? "")),
            }
          : null;
        setSavedSnapshot(normalizedSaved ? JSON.stringify(normalizedSaved) : null);

        const hasLocalDraft = Boolean(window.localStorage.getItem(keyproofStorageKey(attachmentId)));
        if (normalizedSaved && !hasLocalDraft) {
          setForm((current) => ({
            ...current,
            ...normalizedSaved.form,
            site: normalizedSaved.form.site || siteFromParams || current.site,
          }));
          setBatchDate(normalizeDateInput(normalizedSaved.batchDate) || normalizeDateInput(day));
          setPaperworkTotalInput(normalizedSaved.paperworkTotal);
        }
      } catch {
        if (active) {
          setSavedSnapshot(null);
        }
      }
    };

    void loadSavedKeyproof();

    return () => {
      active = false;
    };
  }, [attachmentId, day, siteFromParams]);

  useEffect(() => {
    setBatchDate((current) => current || normalizeDateInput(day));
  }, [attachmentId, day]);

  useEffect(() => {
    let active = true;

    const loadFlywireDocument = async () => {
      if (!attachmentId) {
        setFlywirePayload(null);
        setFlywireStatus({
          kind: "idle",
          text: "Open a batch to load its Fly Wire report.",
        });
        return;
      }

      setFlywireLoading(true);
      setFlywirePayload(null);
      setFlywireAutofindMatched(false);
      setFlywireStatus({
        kind: "idle",
        text: "Loading Fly Wire...",
      });
      try {
        const response = await loadFlywire(Number(attachmentId));
        if (!active) {
          return;
        }

        setFlywirePayload(response.data);
        if (response.data.document) {
          setBatchDate(
            (current) =>
              current ||
              normalizeDateInput(response.data.summary?.batch_date || response.data.document?.batch_date)
          );
          setFlywireStatus({
            kind: "success",
            text: `Fly Wire loaded for batch ${response.data.summary?.batch_id || response.data.document?.batch_id || attachmentId}.`,
          });
        } else {
          setFlywireStatus({
            kind: "idle",
            text: "No Fly Wire has been uploaded for this batch yet.",
          });
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setFlywirePayload(null);
        setFlywireStatus({
          kind: "error",
          text: error instanceof Error ? error.message : "Failed to load Fly Wire.",
        });
      } finally {
        if (active) {
          setFlywireLoading(false);
        }
      }
    };

    void loadFlywireDocument();

    return () => {
      active = false;
    };
  }, [attachmentId]);

  const activeSites = useMemo(
    () => sites.filter((site) => site.active === 1),
    [sites]
  );

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function zoomIn() {
    setZoom((current) => Math.min(current + 0.25, 3));
  }

  function zoomOut() {
    setZoom((current) => Math.max(current - 0.25, 0.5));
  }

  function resetZoom() {
    setZoom(1);
  }

  function toggleMagnify() {
    setZoom((current) => (current === 1 ? 2 : 1));
  }

  const totalAmount = useMemo(
    () =>
      moneyFields.reduce((total, field) => {
        return total + parseAmount(form[field]);
      }, 0),
    [form]
  );

  const paperworkTotal = useMemo(() => parseAmount(paperworkTotalInput), [paperworkTotalInput]);
  const reconciliationDifference = useMemo(
    () => totalAmount - paperworkTotal,
    [paperworkTotal, totalAmount]
  );

  const itemizationRequiredTotal = useMemo(
    () =>
      itemizationRequiredFields.reduce((total, field) => total + parseAmount(form[field]), 0),
    [form]
  );
  const itemizationTotal = useMemo(() => getSavedItemizationTotal(), [attachmentId]);
  const balsheetDifference = useMemo(
    () => (balsheetBalance ?? 0) - itemizationTotal,
    [balsheetBalance, itemizationTotal]
  );
  const flywireSummary = flywirePayload?.summary ?? null;
  const flywirePreviewRows = useMemo(() => summarizeFlywireRows(flywirePayload?.rows ?? []), [flywirePayload]);
  const flywireCreditCardTotal = flywireSummary?.total_amount ?? flywirePayload?.document?.total_amount ?? null;
  const savedKeyproofSnapshot = useMemo(
    () => JSON.stringify({ form, batchDate, paperworkTotal: paperworkTotalInput }),
    [batchDate, form, paperworkTotalInput]
  );
  const saveStatusLabel = useMemo(() => {
    if (saveStatus === "saving") {
      return "Saving...";
    }

    if (confirmReady && savedSnapshot && savedKeyproofSnapshot === savedSnapshot) {
      return "Confirmed";
    }

    if (!savedSnapshot) {
      return "Not saved";
    }

    return savedKeyproofSnapshot === savedSnapshot ? "Saved" : "Unsaved changes";
  }, [saveStatus, savedKeyproofSnapshot, savedSnapshot]);
  const saveStatusKind = useMemo<SaveStatusKind>(() => {
    if (saveStatus === "saving") {
      return "saving";
    }

    if (!savedSnapshot) {
      return "not_saved";
    }

    return savedKeyproofSnapshot === savedSnapshot ? "saved" : "dirty";
  }, [saveStatus, savedKeyproofSnapshot, savedSnapshot]);
  const siteComplete = Boolean(String(form.site ?? "").trim());
  const batchDateComplete = Boolean(batchDate.trim());
  const flywireComplete = Boolean(flywirePayload?.document);
  const cashCheckCreditComplete = ["cash", "check", "creditCard"].every(
    (field) => String(form[field as keyof typeof form] ?? "").trim() !== ""
  );
  const eftLockboxComplete = ["eft", "lockbox"].every(
    (field) => String(form[field as keyof typeof form] ?? "").trim() !== ""
  );
  const foreignWireComplete = ["foreignCheck", "wireTransfer"].every(
    (field) => String(form[field as keyof typeof form] ?? "").trim() !== ""
  );
  const miscComplete = String(form.misc ?? "").trim() !== "";

  function goToDefineSites() {
    const params = new URLSearchParams();

    if (attachmentId) {
      params.set("attachmentId", attachmentId);
    }

    if (day) {
      params.set("day", day);
    }

    setMenuOpen(false);
    navigate(`/sites${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function openFlywirePicker() {
    if (!attachmentId) {
      return;
    }

    setMenuOpen(false);
    flywireFileInputRef.current?.click();
  }

  const handleFlywireFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !attachmentId) {
      return;
    }

    setFlywireLoading(true);
    setFlywirePayload(null);
    setFlywireAutofindMatched(false);
    setFlywireStatus({
      kind: "idle",
      text: "Uploading Fly Wire workbook...",
    });

    try {
      const response = await uploadFlywire(Number(attachmentId), file);
      setFlywirePayload(response);
      setFlywireStatus({
        kind: "success",
        text: `Fly Wire loaded for batch ${response.summary?.batch_id || response.document?.batch_id || attachmentId}.`,
      });
    } catch (error) {
      setFlywireStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Fly Wire upload failed.",
      });
    } finally {
      setFlywireLoading(false);
    }
  };

  const handleAutofindFlywire = async () => {
    if (!attachmentId) {
      return;
    }

    setFlywireLoading(true);
    setFlywirePayload(null);
    setFlywireAutofindMatched(false);
    setFlywireStatus({
      kind: "idle",
      text: "Searching the email download folder for the matching Fly Wire workbook...",
    });

    try {
      const response = await autofindFlywire(Number(attachmentId));
      setFlywirePayload(response.data);
      setFlywireAutofindMatched(true);
      setFlywireStatus({
        kind: "success",
        text: `Auto-find matched Fly Wire for batch ${response.data.summary?.batch_id || response.data.document?.batch_id || attachmentId}.`,
      });
    } catch (error) {
      setFlywireStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Auto-find could not locate a matching Fly Wire file.",
      });
    } finally {
      setFlywireLoading(false);
    }
  };

  function autopopulateCreditCard() {
    if (flywireCreditCardTotal == null) {
      return;
    }

    setForm((current) => ({
      ...current,
      creditCard: formatCurrency(flywireCreditCardTotal),
    }));
    setSaveMessage(`Credit Card populated from Fly Wire total ${formatCurrency(flywireCreditCardTotal)}.`);
  }

  function goToItemization() {
    const params = new URLSearchParams();

    if (attachmentId) {
      params.set("attachmentId", attachmentId);
      window.localStorage.setItem(
        keyproofStorageKey(attachmentId),
        JSON.stringify({
          ...normalizeKeyproofForm(form),
          batchDate,
          paperworkTotal: formatCurrencyInput(paperworkTotalInput),
        })
      );
    }

    if (day) {
      params.set("day", day);
    }

    if (form.site) {
      params.set("site", form.site);
    }

    params.set("requiredTotal", itemizationRequiredTotal.toFixed(2));

    navigate(`/itemization?${params.toString()}`);
  }

  function goToPending() {
    const params = new URLSearchParams();

    if (day) {
      params.set("day", day);
    }

    navigate(`/attachments${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function getSavedItemizationTotal() {
    if (!attachmentId) return 0;

    const saved = window.localStorage.getItem(itemizationStorageKey(attachmentId));
    if (!saved) return 0;

    try {
      const items = JSON.parse(saved) as Array<{ amount?: number | string }>;
      return items.reduce((total, item) => total + Number(item.amount || 0), 0);
    } catch {
      return 0;
    }
  }

  async function loadCurrentItemizationRows() {
    if (!attachmentId) {
      return [] as Array<Record<string, unknown>>;
    }

    const storageKey = itemizationStorageKey(attachmentId);
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Array<Record<string, unknown>>;
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }

    const response = await getItemization(Number(attachmentId));
    const payloadItems = response.data.payload?.items;
    return Array.isArray(payloadItems) ? (payloadItems as Array<Record<string, unknown>>) : [];
  }

  async function persistItemization() {
    if (!attachmentId) {
      return true;
    }

    const attachmentNumber = Number(attachmentId);
    try {
      const items = await loadCurrentItemizationRows();
      if (!items.length) {
        return true;
      }

      await updateItemization(attachmentNumber, { items });
      window.localStorage.setItem(itemizationStorageKey(attachmentId), JSON.stringify(items));
      return true;
    } catch (error) {
      setMatchWarning(error instanceof Error ? error.message : "Failed to save Itemization.");
      return true;
    }
  }

  async function hasItemizationRows() {
    if (!attachmentId) {
      return false;
    }

    const rows = await loadCurrentItemizationRows();
    return rows.length > 0;
  }

  function runBalanceCheck() {
    const issues: string[] = [];

    if (!isNearZero(reconciliationDifference)) {
      issues.push(
        `Reconciliation must be $0.00 before confirming. Current difference: ${formatDifference(reconciliationDifference)}.`
      );
    }

    if (!isNearZero(balsheetDifference)) {
      issues.push(
        `Balsheet balance must be $0.00 before confirming. Current difference: ${formatDifference(balsheetDifference)}.`
      );
    }

    return {
      ok: issues.length === 0,
      message: issues.length === 0 ? "OK for confirmation." : issues.join(" "),
      issues,
    };
  }

  async function persistKeyproof() {
    if (!attachmentId) return false;

    const normalizedForm = normalizeKeyproofForm(form);
    const normalizedPaperworkTotal = formatCurrencyInput(paperworkTotalInput);
    const payload: KeyproofSavedPayload = {
      form: normalizedForm,
      batchDate,
      paperworkTotal: normalizedPaperworkTotal,
    };
    const attachmentNumber = Number(attachmentId);

    setSaveStatus("saving");
    window.localStorage.setItem(
      keyproofStorageKey(attachmentId),
      JSON.stringify({
        ...normalizedForm,
        batchDate,
        paperworkTotal: normalizedPaperworkTotal,
      })
    );

    try {
      await updateKeyproof(attachmentNumber, payload);
      setSavedSnapshot(JSON.stringify(payload));
      if (form.site) {
        try {
          await updateAttachmentSite(attachmentNumber, form.site);
        } catch (error) {
          setMatchWarning(error instanceof Error ? error.message : "Keyproof saved, but the site update failed.");
        }
      }
      return true;
    } catch (error) {
      setMatchWarning(error instanceof Error ? error.message : "Failed to save Keyproof.");
      setSaveStatus(savedSnapshot ? "dirty" : "not_saved");
      return false;
    } finally {
      setSaveStatus((current) => (current === "saving" ? "saved" : current));
    }
  }

  async function confirmAndSave() {
    const result = runBalanceCheck();

    if (!result.ok) {
      setMatchWarning(result.message);
      setConfirmReady(false);
      setSaveMessage(null);
      return;
    }

    const itemizationRequired = requiresItemization(form);
    if (itemizationRequired) {
      const itemizationExists = await hasItemizationRows();
      if (!itemizationExists) {
        setMatchWarning(
          "Itemization is required because Keyproof has entries outside EFT and Lockbox, but no itemization rows were found."
        );
        setConfirmReady(false);
        setSaveMessage(null);
        return;
      }
    }

    const saved = await persistKeyproof();
    if (!saved) {
      setSaveMessage(null);
      setConfirmReady(false);
      return;
    }

    await persistItemization();

    const attachmentNumber = Number(attachmentId);
    setMatchWarning(null);
    setConfirmReady(true);
    const redirectDay = normalizeDateInput(day) || batchDate;
    setSaveMessage(
      redirectDay
        ? `Confirmed and saved. Returning to attachments for ${redirectDay}.`
        : "Confirmed and saved. Returning to attachments."
    );

    await approveAttachment(attachmentNumber);
    window.localStorage.removeItem(keyproofStorageKey(String(attachmentNumber)));
    window.localStorage.removeItem(itemizationStorageKey(String(attachmentNumber)));
    navigate(`/attachments${redirectDay ? `?day=${encodeURIComponent(redirectDay)}` : ""}`);
  }

  async function copyItemizationToBalsheet() {
    if (!attachmentId) {
      setMatchWarning("No attachment is selected.");
      return;
    }

    const postingDate = batchDate || normalizeDateInput(day);
    if (!postingDate) {
      setMatchWarning("Set the batch date before copying itemization to Balsheet.");
      return;
    }

    setItemizationCopyLoading(true);
    setMatchWarning(null);
    setSaveMessage(null);

    try {
      const itemizationRows = await loadCurrentItemizationRows();

      if (!itemizationRows.length) {
        setMatchWarning("No itemization rows were found to copy.");
        return;
      }

      const balsheetRows: BalsheetEntry[] = itemizationRows.map((item) => ({
        posting_date: postingDate,
        type: normalizeText(item.type),
        amount: parseAmount(String(item.amount ?? "")),
        payer: normalizeText(item.payer),
        check_number: normalizeText(item.check_number),
        edi: normalizeText(item.edi),
        poster: normalizeText(item.poster),
        eob: normalizeText(item.eob),
        unposted: parseAmount(String(item.unposted ?? "")),
        misc: parseAmount(String(item.misc ?? "")),
        misc_type: normalizeText(item.misc_type),
        notes: normalizeText(item.notes),
        nick: parseAmount(String(item.nick ?? "")),
        raul: parseAmount(String(item.raul ?? "")),
        needs: normalizeText(item.needs),
        from_date: normalizeText(item.from),
        to_date: normalizeText(item.to),
      }));

      const response = await saveBalsheetEntries(balsheetRows);
      setSaveMessage(
        `Copied ${response.data.rowsImported} itemization row${response.data.rowsImported === 1 ? "" : "s"} to Balsheet.`
      );
    } catch (error) {
      setMatchWarning(error instanceof Error ? error.message : "Failed to copy itemization to Balsheet.");
    } finally {
      setItemizationCopyLoading(false);
    }
  }

  if (!attachmentId) {
    return (
      <main className="keyproof-container">
        <section className="keyproof-empty">
          <h1 className="keyproof-title">Keyproof</h1>
          <p>No attachment selected.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="keyproof-container">
      <section className="keyproof-left">
        <div className="keyproof-viewer-toolbar">
          <button className="keyproof-icon-btn" type="button" onClick={zoomOut} title="Zoom out">
            -
          </button>
          <button className="keyproof-icon-btn" type="button" onClick={resetZoom} title="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button className="keyproof-icon-btn" type="button" onClick={zoomIn} title="Zoom in">
            +
          </button>
          <button className="keyproof-icon-btn" type="button" onClick={toggleMagnify} title="Toggle magnify">
            Magnify
          </button>
        </div>

        <div className="keyproof-image-viewer">
          <img
            className="keyproof-image"
            src={snapshotUrl(attachmentId)}
            alt={`Attachment ${attachmentId}`}
            style={{ transform: `scale(${zoom})` }}
            onClick={toggleMagnify}
          />
        </div>

      </section>

      <section className="keyproof-right">
        <div className="keyproof-header">
          <div className="keyproof-header-titleWrap">
            <h1 className="keyproof-title">Keyproof</h1>
            <span
              className={`keyproof-save-badge keyproof-save-badge-${saveStatusKind}`}
              aria-label={`Keyproof ${saveStatusLabel.toLowerCase()}`}
            >
              {saveStatusLabel}
            </span>
          </div>
          <div className="keyproof-menu">
            <button
              className="keyproof-menu-button"
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              title="More options"
              aria-label="More options"
              aria-expanded={menuOpen}
            >
              ...
            </button>
            {menuOpen && (
              <div className="keyproof-menu-dropdown">
                <button type="button" onClick={goToDefineSites}>
                  Define Sites
                </button>
                <button type="button" onClick={openFlywirePicker} disabled={!attachmentId || flywireLoading}>
                  {flywirePayload?.document ? "Replace Fly Wire" : "Upload Fly Wire"}
                </button>
              </div>
            )}
          </div>
        </div>
        {siteLoadError && <div className="keyproof-error">{siteLoadError}</div>}

        <input
          ref={flywireFileInputRef}
          className="keyproof-hidden-file"
          type="file"
          accept=".xlsx,.xls,.xlsm"
          onChange={handleFlywireFileChange}
        />

        <div className="keyproof-total">
          Total: {formatCurrency(totalAmount)}
        </div>
        {confirmReady && <div className="keyproof-success">OK for confirmation.</div>}
        {matchWarning && <div className="keyproof-warning">{matchWarning}</div>}
        {saveMessage && <div className="keyproof-success">{saveMessage}</div>}

        <details className="keyproof-section">
          <summary>
            <span className="keyproof-section-summaryText">Site</span>
            {siteComplete && <span className="keyproof-section-check" aria-label="Site complete">✓</span>}
          </summary>
          <div className="keyproof-section-body">
            <div className="keyproof-field">
              <label htmlFor="site">Site</label>
              <select
                id="site"
                name="site"
                value={form.site}
                onChange={(event) => updateField("site", event.target.value)}
              >
                <option value="">Select site</option>
                {activeSites.map((site) => (
                  <option key={site.id} value={site.name}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </details>

        <details className="keyproof-section">
          <summary>
            <span className="keyproof-section-summaryText">Batch Date</span>
            {batchDateComplete && <span className="keyproof-section-check" aria-label="Batch Date complete">✓</span>}
          </summary>
          <div className="keyproof-section-body">
            <div className="keyproof-field">
              <label htmlFor="batchDate">Date</label>
              <input
                id="batchDate"
                name="batchDate"
                type="date"
                value={batchDate}
                onChange={(event) => setBatchDate(event.target.value)}
              />
            </div>
            <div className="keyproof-flywire-status">
              Defaults to the batch date, but you can change it here if needed.
            </div>
          </div>
        </details>

        <details className="keyproof-section">
          <summary>
            <span className="keyproof-section-summaryText">Fly Wire</span>
            {flywireComplete && <span className="keyproof-section-check" aria-label="Fly Wire complete">✓</span>}
          </summary>
          <div className="keyproof-section-body">
            <div className="keyproof-flywire-actions">
              <button
                className={
                  flywireAutofindMatched
                    ? "keyproof-flywire-button keyproof-flywire-button-success"
                    : "keyproof-flywire-button"
                }
                type="button"
                onClick={handleAutofindFlywire}
                disabled={!attachmentId || flywireLoading}
              >
                Autofind Fly Wire
              </button>
              <button
                className="keyproof-flywire-button"
                type="button"
                onClick={openFlywirePicker}
                disabled={!attachmentId || flywireLoading}
              >
                {flywirePayload?.document ? "Replace Fly Wire" : "Upload Fly Wire"}
              </button>
              <button
                className="keyproof-flywire-button"
                type="button"
                onClick={autopopulateCreditCard}
                disabled={flywireCreditCardTotal == null || flywireLoading}
              >
                Autofill CC
              </button>
              {flywireSummary?.sheet_name && <span className="keyproof-flywire-pill">{flywireSummary.sheet_name}</span>}
            </div>

            {flywireLoading && <div className="keyproof-flywire-status">Loading Fly Wire...</div>}
            {flywireStatus.text && (
              <div
                className={
                  flywireStatus.kind === "success"
                    ? "keyproof-success"
                    : flywireStatus.kind === "error"
                      ? "keyproof-error"
                      : "keyproof-flywire-status"
                }
              >
                {flywireStatus.text}
              </div>
            )}

            {flywirePayload?.document ? (
              <>
                <div className="keyproof-flywire-summary">
                  <div className="keyproof-flywire-stat">
                    <div className="keyproof-flywire-statLabel">Rows</div>
                    <div className="keyproof-flywire-statValue">{flywireSummary?.row_count ?? flywirePayload.document.row_count}</div>
                  </div>
                  <div className="keyproof-flywire-stat">
                    <div className="keyproof-flywire-statLabel">Total</div>
                    <div className="keyproof-flywire-statValue">
                      {formatFlywireAmount(flywireSummary?.total_amount ?? flywirePayload.document.total_amount)}
                    </div>
                  </div>
                  <div className="keyproof-flywire-stat">
                    <div className="keyproof-flywire-statLabel">Batch</div>
                    <div className="keyproof-flywire-statValue">
                      {flywireSummary?.batch_id || flywirePayload.document.batch_id || "Unknown"}
                    </div>
                  </div>
                  <div className="keyproof-flywire-stat">
                    <div className="keyproof-flywire-statLabel">Dates</div>
                    <div className="keyproof-flywire-statValue">
                      {flywireSummary?.first_time && flywireSummary?.last_time
                        ? `${flywireSummary.first_time} - ${flywireSummary.last_time}`
                        : flywireSummary?.first_time || flywireSummary?.last_time || "Unknown"}
                    </div>
                  </div>
                </div>

                <div className="keyproof-flywire-preview">
                  {flywirePreviewRows.map((row) => (
                    <article key={row.id} className="keyproof-flywire-row">
                      <div className="keyproof-flywire-rowTop">
                        <div className="keyproof-flywire-rowTitle">
                          {row.patient_name || row.billing_name || row.location || `Row ${row.position}`}
                        </div>
                        <div className="keyproof-flywire-rowAmount">{formatFlywireAmount(row.amount)}</div>
                      </div>
                      <div className="keyproof-flywire-rowMeta">
                        {row.payment_method || "Payment method unavailable"}
                      </div>
                      <div className="keyproof-flywire-rowMeta">
                        {row.account_number ? `Account ${row.account_number}` : "Account unavailable"}
                        {row.time_text ? ` | ${row.time_text}` : ""}
                      </div>
                      {row.billing_name && <div className="keyproof-flywire-rowMeta">Billing: {row.billing_name}</div>}
                      {row.application && <div className="keyproof-flywire-rowMeta">Application: {row.application}</div>}
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="keyproof-flywire-empty">
                Upload the Fly Wire workbook for this batch to see a summary card and row preview here.
              </div>
            )}
          </div>
        </details>

        <details className="keyproof-section">
          <summary>
            <span className="keyproof-section-summaryText">Cash, Check, Credit Card</span>
            {cashCheckCreditComplete && (
              <span className="keyproof-section-check" aria-label="Cash, Check, Credit Card complete">
                ✓
              </span>
            )}
          </summary>
          <div className="keyproof-section-body keyproof-grid">
            <MoneyField id="check" label="Check" value={form.check} onChange={updateField} />
            <MoneyField id="cash" label="Cash" value={form.cash} onChange={updateField} />
            <MoneyField id="creditCard" label="Credit Card" value={form.creditCard} onChange={updateField} />
          </div>
        </details>

        <details className="keyproof-section">
          <summary>
            <span className="keyproof-section-summaryText">EFT, Lockbox</span>
            {eftLockboxComplete && <span className="keyproof-section-check" aria-label="EFT, Lockbox complete">✓</span>}
          </summary>
          <div className="keyproof-section-body keyproof-grid">
            <MoneyField id="eft" label="EFT" value={form.eft} onChange={updateField} />
            <MoneyField id="lockbox" label="Lockbox" value={form.lockbox} onChange={updateField} />
          </div>
        </details>

        <details className="keyproof-section">
          <summary>
            <span className="keyproof-section-summaryText">Foreign Check, Wire Transfer</span>
            {foreignWireComplete && (
              <span className="keyproof-section-check" aria-label="Foreign Check, Wire Transfer complete">
                ✓
              </span>
            )}
          </summary>
          <div className="keyproof-section-body keyproof-grid">
            <MoneyField id="foreignCheck" label="Foreign Check" value={form.foreignCheck} onChange={updateField} />
            <MoneyField id="wireTransfer" label="Wire Transfer" value={form.wireTransfer} onChange={updateField} />
          </div>
        </details>

        <details className="keyproof-section">
          <summary>
            <span className="keyproof-section-summaryText">Misc</span>
            {miscComplete && <span className="keyproof-section-check" aria-label="Misc complete">✓</span>}
          </summary>
          <div className="keyproof-section-body">
            <div className="keyproof-grid">
              <MoneyField id="misc" label="Misc" value={form.misc} onChange={updateField} />
            </div>
          </div>
        </details>

        <div className="keyproof-summary-grid">
          <section className="keyproof-reconcile-card" aria-label="Reconciliation">
            <div className="keyproof-reconcile-header">
              <div className="keyproof-reconcile-titleWrap">
                <div className="keyproof-reconcile-kicker">Reconciliation</div>
                <h2 className="keyproof-reconcile-title">Compare keyproof totals to scan totals</h2>
              </div>
            </div>
            <div className="keyproof-reconcile-grid">
              <div className="keyproof-reconcile-row">
                <span className="keyproof-reconcile-label">Keyproof total</span>
                <strong className="keyproof-reconcile-value">{formatCurrency(totalAmount)}</strong>
              </div>
              <div className="keyproof-reconcile-row">
                <label className="keyproof-reconcile-label" htmlFor="paperworkTotal">
                  Paperwork total
                </label>
                <input
                  id="paperworkTotal"
                  name="paperworkTotal"
                  className="keyproof-reconcile-input"
                  inputMode="decimal"
                  placeholder="$0.00"
                  value={paperworkTotalInput}
                  onFocus={(event) => {
                    const normalized = normalizeCurrencyInput(event.currentTarget.value);
                    if (normalized !== event.currentTarget.value) {
                      setPaperworkTotalInput(normalized);
                    }
                  }}
                  onBlur={(event) => {
                    const formatted = formatCurrencyInput(event.currentTarget.value);
                    if (formatted !== event.currentTarget.value) {
                      setPaperworkTotalInput(formatted);
                    }
                  }}
                  onChange={(event) => setPaperworkTotalInput(event.target.value)}
                />
              </div>
              <div className="keyproof-reconcile-row keyproof-reconcile-row-wide">
                <span className="keyproof-reconcile-label">Difference</span>
                <strong
                  className={`keyproof-reconcile-value ${
                    Math.abs(reconciliationDifference) > 0.005 ? "keyproof-reconcile-value-alert" : ""
                  }`}
                >
                  {formatDifference(reconciliationDifference)}
                </strong>
              </div>
            </div>
          </section>

          <aside className="keyproof-balsheet-card">
            <div className="keyproof-balsheet-cardHeader">
              <div>
                <div className="keyproof-balsheet-kicker">Balsheet balance</div>
                <div className="keyproof-balsheet-title">Date and site considered</div>
              </div>
              <div className="keyproof-balsheet-headerActions">
                <button
                  type="button"
                  className="keyproof-balsheet-refreshButton"
                  onClick={() => void loadBalsheetBalance()}
                  disabled={balsheetBalanceLoading}
                >
                  {balsheetBalanceLoading ? "Refreshing..." : "Refresh"}
                </button>
                <span className="keyproof-balsheet-dot" aria-hidden="true" />
              </div>
            </div>
            <div className="keyproof-balsheet-context">
              <div>
                <div className="keyproof-balsheet-label">Date</div>
                <div className="keyproof-balsheet-value">{batchDate || "Not set"}</div>
              </div>
              <div>
                <div className="keyproof-balsheet-label">Site</div>
                <div className="keyproof-balsheet-value">{form.site || "Not set"}</div>
              </div>
            </div>
            <div className="keyproof-balsheet-amount">
              {balsheetBalanceLoading ? "Loading..." : formatCurrency(balsheetBalance ?? 0)}
            </div>
            <div className="keyproof-balsheet-reconcile">
              <div className="keyproof-balsheet-reconcileRow">
                <span className="keyproof-balsheet-label">Itemization total</span>
                <span className="keyproof-balsheet-value">{formatCurrency(itemizationTotal)}</span>
              </div>
              <div className="keyproof-balsheet-reconcileRow">
                <span className="keyproof-balsheet-label">Difference</span>
                <span
                  className="keyproof-balsheet-value"
                  style={{ color: Math.abs(balsheetDifference) > 0.005 ? "#a15c00" : "#1f6b2a" }}
                >
                  {formatDifference(balsheetDifference)}
                </span>
              </div>
            </div>
            <div className="keyproof-balsheet-meta">
              {balsheetBalanceError
                ? balsheetBalanceError
                : batchDate && form.site
                  ? `${balsheetBalanceCount} matching Balsheet row${balsheetBalanceCount === 1 ? "" : "s"}`
                  : "Set the date and site to compare against Balsheet."}
            </div>
          </aside>
        </div>

        <div className="keyproof-action-row">
          <button className="keyproof-confirm-action" type="button" onClick={confirmAndSave}>
            Confirm and Save
          </button>
          <button
            className="keyproof-secondary-action"
            type="button"
            onClick={copyItemizationToBalsheet}
            disabled={itemizationCopyLoading || !attachmentId}
          >
            {itemizationCopyLoading ? "Copying to Balsheet..." : "Copy Itemization to Balsheet"}
          </button>
          <button className="keyproof-secondary-action" type="button" onClick={goToItemization}>
            Itemization
          </button>
          <button className="keyproof-secondary-action" type="button" onClick={goToPending}>
            Exit
          </button>
        </div>

        <div className="keyproof-bottom-status" aria-live="polite">
          <div className="keyproof-bottom-statusHeader">
            <span className={`keyproof-save-badge keyproof-save-badge-${saveStatusKind}`}>
              {saveStatusLabel}
            </span>
          </div>
          {confirmReady && <div className="keyproof-success">OK for confirmation.</div>}
          {matchWarning && <div className="keyproof-warning">{matchWarning}</div>}
          {saveMessage && <div className="keyproof-success">{saveMessage}</div>}
        </div>
      </section>
    </main>
  );
}

interface MoneyFieldProps {
  id: keyof Omit<KeyproofDraft, "attachmentId" | "site">;
  label: string;
  value: string;
  onChange: (field: keyof Omit<KeyproofDraft, "attachmentId">, value: string) => void;
}

function MoneyField({ id, label, value, onChange }: MoneyFieldProps) {
  return (
    <div className="keyproof-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        inputMode="decimal"
        placeholder="$0.00"
        value={value}
        onFocus={(event) => {
          const normalized = normalizeCurrencyInput(event.currentTarget.value);
          if (normalized !== event.currentTarget.value) {
            onChange(id, normalized);
          }
        }}
        onBlur={(event) => {
          const formatted = formatCurrencyInput(event.currentTarget.value);
          if (formatted !== event.currentTarget.value) {
            onChange(id, formatted);
          }
        }}
        onChange={(event) => onChange(id, event.target.value)}
      />
    </div>
  );
}

