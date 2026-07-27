import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { approveAttachment, updateAttachmentSite } from "../api/attachmentreview_api";
import { autofindFlywire, getSites, loadFlywire, uploadFlywire } from "../api/keyproof_api";
import type { FlywirePayload, FlywireRow, KeyproofDraft, SiteOption } from "../api/keyproof_api";
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
  miscDescription: "",
};

const moneyFields: Array<keyof Omit<KeyproofDraft, "attachmentId" | "site" | "miscDescription">> = [
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

function summarizeFlywireRows(rows: FlywireRow[]) {
  return rows.slice(0, 5);
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

  useEffect(() => {
    if (!attachmentId) return;

    const saved = window.localStorage.getItem(keyproofStorageKey(attachmentId));
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Partial<typeof emptyForm> & { batchDate?: string };
      setForm((current) => ({ ...current, ...parsed, site: parsed.site || siteFromParams || current.site }));
      setBatchDate(normalizeDateInput(parsed.batchDate) || normalizeDateInput(day));
    } catch {
      window.localStorage.removeItem(keyproofStorageKey(attachmentId));
    }
  }, [attachmentId, siteFromParams]);

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
    setForm((current) => ({ ...current, [field]: value }));
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

  const itemizationRequiredTotal = useMemo(
    () =>
      itemizationRequiredFields.reduce((total, field) => total + parseAmount(form[field]), 0),
    [form]
  );
  const flywireSummary = flywirePayload?.summary ?? null;
  const flywirePreviewRows = useMemo(() => summarizeFlywireRows(flywirePayload?.rows ?? []), [flywirePayload]);
  const flywireCreditCardTotal = flywireSummary?.total_amount ?? flywirePayload?.document?.total_amount ?? null;

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
      window.localStorage.setItem(keyproofStorageKey(attachmentId), JSON.stringify({ ...form, batchDate }));
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

  function runBalanceCheck() {
    const itemizationTotal = getSavedItemizationTotal();
    const difference = Math.abs(itemizationRequiredTotal - itemizationTotal);

    if (itemizationRequiredTotal > 0 && difference > 0.005) {
      return {
        ok: false,
        message: `Keyproof requiring itemization is $${itemizationRequiredTotal.toFixed(2)}, but itemization totals $${itemizationTotal.toFixed(2)}. EFT and Lockbox are excluded.`,
      };
    }

    return {
      ok: true,
      message: "OK for confirmation.",
    };
  }

  function saveKeyproof() {
    if (!attachmentId) return;

    window.localStorage.setItem(keyproofStorageKey(attachmentId), JSON.stringify({ ...form, batchDate }));
    if (form.site) {
      void updateAttachmentSite(Number(attachmentId), form.site);
    }

    const result = runBalanceCheck();

    if (result.ok) {
      setMatchWarning(null);
      setConfirmReady(true);
    } else {
      setMatchWarning(result.message);
      setConfirmReady(false);
    }

    setSaveMessage("Keyproof saved.");
  }

  async function confirmAndSave() {
    if (!attachmentId) return;

    window.localStorage.setItem(keyproofStorageKey(attachmentId), JSON.stringify({ ...form, batchDate }));
    if (form.site) {
      await updateAttachmentSite(Number(attachmentId), form.site);
    }

    const result = runBalanceCheck();

    if (!result.ok) {
      setMatchWarning(result.message);
      setConfirmReady(false);
      setSaveMessage(null);
      return;
    }

    setMatchWarning(null);
    setConfirmReady(true);
    setSaveMessage(result.message);

    await approveAttachment(Number(attachmentId));
    window.localStorage.removeItem(keyproofStorageKey(attachmentId));
    window.localStorage.removeItem(itemizationStorageKey(attachmentId));
    navigate("/");
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
          <h1 className="keyproof-title">Keyproof</h1>
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

        <details className="keyproof-section" open>
          <summary>Site</summary>
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

        <details className="keyproof-section" open>
          <summary>Batch Date</summary>
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

        <details className="keyproof-section" open>
          <summary>Fly Wire</summary>
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

        <details className="keyproof-section" open>
          <summary>Cash, Check, Credit Card</summary>
          <div className="keyproof-section-body keyproof-grid">
            <MoneyField id="cash" label="Cash" value={form.cash} onChange={updateField} />
            <MoneyField id="check" label="Check" value={form.check} onChange={updateField} />
            <MoneyField id="creditCard" label="Credit Card" value={form.creditCard} onChange={updateField} />
          </div>
        </details>

        <details className="keyproof-section">
          <summary>EFT, Lockbox</summary>
          <div className="keyproof-section-body keyproof-grid">
            <MoneyField id="eft" label="EFT" value={form.eft} onChange={updateField} />
            <MoneyField id="lockbox" label="Lockbox" value={form.lockbox} onChange={updateField} />
          </div>
        </details>

        <details className="keyproof-section">
          <summary>Foreign Check, Wire Transfer</summary>
          <div className="keyproof-section-body keyproof-grid">
            <MoneyField id="foreignCheck" label="Foreign Check" value={form.foreignCheck} onChange={updateField} />
            <MoneyField id="wireTransfer" label="Wire Transfer" value={form.wireTransfer} onChange={updateField} />
          </div>
        </details>

        <details className="keyproof-section">
          <summary>Misc, Misc Description</summary>
          <div className="keyproof-section-body">
            <div className="keyproof-grid">
              <MoneyField id="misc" label="Misc" value={form.misc} onChange={updateField} />
            </div>
            <div className="keyproof-field">
              <label htmlFor="miscDescription">Misc Description</label>
              <textarea
                id="miscDescription"
                name="miscDescription"
                rows={4}
                value={form.miscDescription}
                onChange={(event) => updateField("miscDescription", event.target.value)}
              />
            </div>
          </div>
        </details>

        <div className="keyproof-action-row">
          <button className="keyproof-save" type="button" onClick={saveKeyproof}>
            Save Keyproof
          </button>
          <button className="keyproof-confirm-action" type="button" onClick={confirmAndSave}>
            Confirm and Save
          </button>
          <button className="keyproof-secondary-action" type="button" onClick={goToItemization}>
            Edit Itemization
          </button>
          <button className="keyproof-secondary-action" type="button" onClick={goToPending}>
            Exit
          </button>
        </div>
      </section>
    </main>
  );
}

interface MoneyFieldProps {
  id: keyof Omit<KeyproofDraft, "attachmentId" | "site" | "miscDescription">;
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
        value={value}
        onChange={(event) => onChange(id, event.target.value)}
      />
    </div>
  );
}

