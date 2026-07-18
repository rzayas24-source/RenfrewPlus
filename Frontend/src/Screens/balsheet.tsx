import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  addBalsheetEntries,
  addBalsheetEntry,
  deleteBalsheetEntry,
  getBalsheet,
  getBalsheetWorkday,
  updateBalsheetEntry,
  type BalsheetEntry,
} from "../api/balsheet_api";

type ItemizationItem = Record<string, string | number>;
type BalsheetMode = "view" | "entry" | "bulk";

interface BalsheetProps {
  mode?: BalsheetMode;
}

const blankEntry: BalsheetEntry = {
  posting_date: "",
  type: "",
  amount: 0,
  payer: "",
  check_number: "",
  edi: "N",
  poster: "N",
  eob: "",
  unposted: 0,
  misc: 0,
  misc_type: "",
  notes: "",
  nick: 0,
  raul: 0,
  needs: "",
  from_date: "",
  to_date: "",
};

const columns: Array<{ key: keyof BalsheetEntry; label: string; numeric?: boolean }> = [
  { key: "posting_date", label: "Posting Date" },
  { key: "type", label: "Type" },
  { key: "amount", label: "Amount", numeric: true },
  { key: "payer", label: "Payer" },
  { key: "check_number", label: "Check/CC Number" },
  { key: "edi", label: "EDI" },
  { key: "poster", label: "Poster" },
  { key: "eob", label: "EOB" },
  { key: "unposted", label: "UnPosted", numeric: true },
  { key: "misc", label: "Misc", numeric: true },
  { key: "misc_type", label: "Misc-Type" },
  { key: "notes", label: "Notes" },
  { key: "nick", label: "Nick", numeric: true },
  { key: "raul", label: "Raul", numeric: true },
  { key: "needs", label: "Needs" },
  { key: "from_date", label: "From" },
  { key: "to_date", label: "To" },
];

function parseAmount(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: unknown) {
  return parseAmount(value).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function normalizePoster(value: unknown) {
  const poster = String(value || "").toLowerCase();
  if (poster === "raul" || poster === "r") return "R";
  return "N";
}

function normalizeYesNo(value: unknown) {
  const cleaned = String(value || "").toLowerCase();
  if (cleaned === "yes" || cleaned === "y") return "Y";
  if (cleaned === "no" || cleaned === "n") return "N";
  return String(value || "");
}

function normalizeDisplayDate(value: string | null) {
  if (!value) return "";

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[2]}/${isoMatch[3]}/${isoMatch[1]}`;
  }

  return value;
}

function calculateSplit(entry: BalsheetEntry) {
  const amount = parseAmount(entry.amount);
  const unposted = parseAmount(entry.unposted);
  const misc = parseAmount(entry.misc);
  const base = amount - unposted - misc;

  if (entry.poster === "R") {
    return { ...entry, nick: 0, raul: base };
  }

  return { ...entry, nick: base, raul: 0 };
}

function mapItemizationToBalsheet(item: ItemizationItem, postingDate: string): BalsheetEntry {
  const poster = normalizePoster(item.poster);
  return calculateSplit({
    ...blankEntry,
    posting_date: postingDate,
    type: String(item.type || ""),
    amount: parseAmount(item.amount),
    payer: String(item.payer || ""),
    check_number: String(item.check_number || ""),
    edi: normalizeYesNo(item.edi),
    poster,
    eob: String(item.eob || ""),
    unposted: parseAmount(item.unposted),
    misc: parseAmount(item.misc),
    misc_type: String(item.misc_type || ""),
    notes: String(item.notes || ""),
    needs: String(item.needs || ""),
    from_date: String(item.from || ""),
    to_date: String(item.to || ""),
  });
}

function modeTitle(mode: BalsheetMode) {
  if (mode === "entry") return "Balsheet Entry";
  if (mode === "bulk") return "Balsheet Bulk";
  return "Balsheet View";
}

export default function Balsheet({ mode = "view" }: BalsheetProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const attachmentId = searchParams.get("attachmentId");
  const day = searchParams.get("day");
  const [postingDate, setPostingDate] = useState(normalizeDisplayDate(day));
  const [rows, setRows] = useState<BalsheetEntry[]>([]);
  const [draft, setDraft] = useState<BalsheetEntry>(blankEntry);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<BalsheetEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const itemizationRows = useMemo(() => {
    if (!attachmentId) return [];
    const saved = window.localStorage.getItem(`itemization:${attachmentId}`);
    if (!saved) return [];

    try {
      return JSON.parse(saved) as ItemizationItem[];
    } catch {
      return [];
    }
  }, [attachmentId]);

  const incomingRows = useMemo(
    () => itemizationRows.map((item) => mapItemizationToBalsheet(item, postingDate)),
    [itemizationRows, postingDate]
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          amount: acc.amount + parseAmount(row.amount),
          nick: acc.nick + parseAmount(row.nick),
          raul: acc.raul + parseAmount(row.raul),
          unposted: acc.unposted + parseAmount(row.unposted),
          misc: acc.misc + parseAmount(row.misc),
        }),
        { amount: 0, nick: 0, raul: 0, unposted: 0, misc: 0 }
      ),
    [rows]
  );

  useEffect(() => {
    getBalsheetWorkday()
      .then((response) => {
        const currentDay = normalizeDisplayDate(day) || response.data.posting_date;
        setPostingDate(currentDay);
        setDraft({ ...blankEntry, posting_date: currentDay });
        return getBalsheet(currentDay);
      })
      .then((response) => {
        setRows(response.data);
        setError(null);
      })
      .catch((err) => {
        setRows([]);
        setError(err instanceof Error ? err.message : "Failed to load Balsheet");
      })
      .finally(() => setLoading(false));
  }, [day]);

  async function reload(date = postingDate) {
    const response = await getBalsheet(date);
    setRows(response.data);
  }

  function updateDraft(field: keyof BalsheetEntry, value: string) {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === "amount" || field === "unposted" || field === "misc" || field === "poster") {
        return calculateSplit({ ...next, poster: normalizePoster(next.poster) });
      }
      return next;
    });
  }

  function updateEditDraft(field: keyof BalsheetEntry, value: string) {
    setEditDraft((current) => {
      if (!current) return current;
      const next = { ...current, [field]: value };
      if (field === "amount" || field === "unposted" || field === "misc" || field === "poster") {
        return calculateSplit({ ...next, poster: normalizePoster(next.poster) });
      }
      return next;
    });
  }

  async function saveManualEntry() {
    const entry = calculateSplit({ ...draft, posting_date: postingDate });
    await addBalsheetEntry(entry);
    setDraft({ ...blankEntry, posting_date: postingDate });
    await reload();
    setMessage("Balsheet entry posted.");
  }

  async function importItemization() {
    if (incomingRows.length === 0) {
      setError("No itemization rows found for this attachment.");
      return;
    }

    await addBalsheetEntries(incomingRows, attachmentId ? Number(attachmentId) : undefined);
    await reload();
    setMessage(`${incomingRows.length} itemization row${incomingRows.length === 1 ? "" : "s"} posted to Balsheet.`);
    setError(null);
  }

  async function saveEdit() {
    if (!editingId || !editDraft) return;
    await updateBalsheetEntry(editingId, calculateSplit(editDraft));
    setEditingId(null);
    setEditDraft(null);
    await reload();
    setMessage("Balsheet entry updated.");
  }

  async function removeEntry(entryId?: string) {
    if (!entryId) return;
    await deleteBalsheetEntry(entryId);
    await reload();
    setMessage("Balsheet entry deleted.");
  }

  if (loading) {
    return <main style={styles.page}>Loading Balsheet...</main>;
  }

  return (
    <main style={styles.shell}>
      <div style={styles.glowBlue} />
      <div style={styles.glowPink} />

      <aside style={styles.sidebar}>
        <div style={styles.brandWrap}>
          <div style={styles.brandMark} aria-hidden="true">
            <img src="/favicon.svg" alt="" style={styles.brandMarkImage} />
          </div>
          <div style={styles.brandTitleBlock}>
            <div style={styles.brandKicker}>Balance Sheet</div>
            <div style={styles.brandTitle}>Balsheet Workspace</div>
          </div>
        </div>

        <p style={styles.sidebarCopy}>
          A calm workspace for manual entry, bulk posting, and direct review.
        </p>

        <nav style={styles.navStack} aria-label="Balance sheet navigation">
          <button className="sidebar-nav-button" style={styles.navButton} type="button" onClick={() => navigate("/balance-sheet")}>
            <span style={styles.navButtonLabel}>Menu</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>â†—</span>
          </button>
          <button className="sidebar-nav-button" style={styles.navButton} type="button" onClick={() => navigate("/balsheet/view")}>
            <span style={styles.navButtonLabel}>Balsheet View</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>â†—</span>
          </button>
          <button className="sidebar-nav-button" style={styles.navButton} type="button" onClick={() => navigate("/balsheet/entry")}>
            <span style={styles.navButtonLabel}>Balsheet Entry</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>â†—</span>
          </button>
          <button className="sidebar-nav-button" style={styles.navButton} type="button" onClick={() => navigate("/balsheet/bulk")}>
            <span style={styles.navButtonLabel}>Balsheet Bulk</span>
            <span className="sidebar-nav-button__glyph" style={styles.navButtonGlyph}>â†—</span>
          </button>
        </nav>

        <div style={styles.sidebarCard}>
          <div style={styles.sidebarCardLabel}>Posting Date</div>
          <div style={styles.sidebarCardValue}>{postingDate || "Not set"}</div>
          <div style={styles.sidebarCardMeta}>
            Keep the Balsheet anchored to the current workday while moving between view, entry, and bulk.
          </div>
        </div>
      </aside>

      <section style={styles.content}>
        <section style={styles.heroShell}>
          <div style={styles.heroCopy}>
            <div style={styles.kicker}>{modeTitle(mode)}</div>
            <h1 style={styles.title}>{postingDate ? `Posting Date ${postingDate}` : "Balsheet"}</h1>
            <p style={styles.subtitle}>
              Manual entry, bulk posting, and split totals in the same softer shell as the main screen.
            </p>
            <div style={styles.heroActions}>
              <button style={styles.primaryButton} type="button" onClick={() => reload()}>
                Refresh
              </button>
              <button style={styles.secondaryButton} type="button" onClick={() => navigate("/balance-sheet")}>
                Back
              </button>
            </div>
          </div>

          <div style={styles.heroArt}>
            <div style={styles.heroStatusCard}>
              <div style={styles.heroStatusTop}>
                <span style={styles.statusPill}>Live sheet</span>
                <span style={styles.statusDot} />
              </div>
              <div style={styles.heroStatusTitle}>{modeTitle(mode)}</div>
              <div style={styles.heroStatusText}>
                Use the posting date, then review totals and line items in a calmer layout.
              </div>
            </div>
          </div>
        </section>

        {error && <div style={styles.error}>{error}</div>}
        {message && <div style={styles.message}>{message}</div>}

        <section style={styles.statsGrid}>
          <article style={styles.statCard}>
            <div style={styles.statLabel}>Amount</div>
            <div style={styles.statValue}>{formatCurrency(totals.amount)}</div>
          </article>
          <article style={styles.statCard}>
            <div style={styles.statLabel}>Nick</div>
            <div style={styles.statValue}>{formatCurrency(totals.nick)}</div>
          </article>
          <article style={styles.statCard}>
            <div style={styles.statLabel}>Raul</div>
            <div style={styles.statValue}>{formatCurrency(totals.raul)}</div>
          </article>
          <article style={styles.statCard}>
            <div style={styles.statLabel}>UnPosted</div>
            <div style={styles.statValue}>{formatCurrency(totals.unposted)}</div>
          </article>
          <article style={styles.statCard}>
            <div style={styles.statLabel}>Misc</div>
            <div style={styles.statValue}>{formatCurrency(totals.misc)}</div>
          </article>
        </section>

        <section style={styles.panelShell}>
          <div style={styles.panelHeader}>
            <div>
              <div style={styles.sectionKicker}>Workday</div>
              <h2 style={styles.sectionTitle}>Balsheet controls</h2>
            </div>
            <label style={styles.compactLabel}>
              Posting Date
              <input
                type="text"
                placeholder="MM/DD/YYYY"
                value={postingDate}
                style={styles.input}
                onChange={(event) => {
                  setPostingDate(event.target.value);
                  setDraft((current) => ({ ...current, posting_date: event.target.value }));
                  reload(event.target.value);
                }}
              />
            </label>
          </div>

          {mode === "bulk" && (
            <section style={styles.importPanel}>
              <div>
                <strong>Incoming itemization</strong>
                <div style={styles.muted}>
                  {attachmentId
                    ? `Attachment #${attachmentId}: ${incomingRows.length} row${incomingRows.length === 1 ? "" : "s"} ready`
                    : "Open this from Itemization to post those rows into Balsheet."}
                </div>
              </div>
              <button
                style={styles.primaryButton}
                type="button"
                onClick={importItemization}
                disabled={!attachmentId}
              >
                Post Itemization to Balsheet
              </button>
            </section>
          )}

          {mode === "entry" && (
            <section style={styles.formGrid}>
              {columns
                .filter((column) => column.key !== "posting_date")
                .map((column) => (
                  <label key={column.key} style={styles.label}>
                    {column.label}
                    <input
                      type={column.numeric ? "number" : "text"}
                      step={column.numeric ? "0.01" : undefined}
                      value={String(draft[column.key] ?? "")}
                      style={styles.input}
                      onChange={(event) => updateDraft(column.key, event.target.value)}
                    />
                  </label>
                ))}
              <button style={styles.primaryButton} type="button" onClick={saveManualEntry}>
                Add Manual Entry
              </button>
            </section>
          )}
        </section>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>EntryID</th>
                {columns.map((column) => (
                  <th key={column.key} style={styles.th}>{column.label}</th>
                ))}
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isEditing = editingId === row.entry_id;
                const source = isEditing && editDraft ? editDraft : row;

                return (
                  <tr key={row.entry_id}>
                    <td style={styles.td}>{row.entry_id}</td>
                    {columns.map((column) => (
                      <td key={column.key} style={column.numeric ? styles.numericTd : styles.td}>
                        {isEditing ? (
                          <input
                            type={column.numeric ? "number" : "text"}
                            placeholder={column.key === "posting_date" ? "MM/DD/YYYY" : undefined}
                            step={column.numeric ? "0.01" : undefined}
                            value={String(source[column.key] ?? "")}
                            style={styles.tableInput}
                            onChange={(event) => updateEditDraft(column.key, event.target.value)}
                          />
                        ) : column.numeric ? (
                          formatCurrency(source[column.key])
                        ) : (
                          String(source[column.key] ?? "")
                        )}
                      </td>
                    ))}
                    <td style={styles.actionTd}>
                      {isEditing ? (
                        <>
                          <button style={styles.smallButton} type="button" onClick={saveEdit}>
                            Save
                          </button>
                          <button
                            style={styles.smallSecondary}
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditDraft(null);
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            style={styles.smallButton}
                            type="button"
                            onClick={() => {
                              setEditingId(row.entry_id || null);
                              setEditDraft(row);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            style={styles.smallDanger}
                            type="button"
                            onClick={() => removeEntry(row.entry_id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    boxSizing: "border-box",
    padding: "18px",
    background: "#f6f7f9",
    color: "#16304d",
    textAlign: "left",
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
    display: "grid",
    gridTemplateColumns: "250px minmax(0, 1fr)",
    gap: "18px",
    position: "relative",
    overflow: "hidden",
  },
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
    background: "radial-gradient(circle, rgba(146, 198, 255, 0.35) 0%, rgba(146, 198, 255, 0) 70%)",
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
    background: "radial-gradient(circle, rgba(255, 186, 213, 0.30) 0%, rgba(255, 186, 213, 0) 72%)",
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
  brandTitleBlock: {
    minWidth: 0,
  },
  brandKicker: {
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontSize: "11px",
    color: "#74879c",
    fontWeight: 800,
    marginBottom: "4px",
  },
  brandTitle: {
    fontSize: "16px",
    lineHeight: 1.2,
    fontWeight: 800,
    color: "#16304d",
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
    background: "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(236,245,255,0.95) 54%, rgba(255,236,244,0.92) 100%)",
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
    display: "grid",
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
  heroActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "20px",
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
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
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
  },
  panelShell: {
    padding: "20px",
    borderRadius: "30px",
    background: "rgba(255,255,255,0.74)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 20px 42px rgba(52, 84, 120, 0.06)",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    marginBottom: "14px",
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
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "18px",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
  },
  subtitle: {
    marginTop: "4px",
    color: "#5f6b7a",
    fontSize: "14px",
  },
  headerActions: {
    display: "flex",
    gap: "8px",
  },
  toolbar: {
    display: "flex",
    alignItems: "end",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "14px",
  },
  totalStrip: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    fontSize: "13px",
    fontWeight: 700,
  },
  importPanel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px",
    border: "1px solid #d9dee7",
    borderRadius: "8px",
    background: "#ffffff",
    marginBottom: "14px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "10px",
    padding: "12px",
    border: "1px solid #d9dee7",
    borderRadius: "8px",
    background: "#ffffff",
    marginBottom: "14px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#4b5563",
  },
  compactLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    fontSize: "12px",
    fontWeight: 700,
  },
  input: {
    height: "32px",
    boxSizing: "border-box",
    border: "1px solid #c8d0dc",
    borderRadius: "6px",
    padding: "0 8px",
    background: "#ffffff",
    color: "#1f2933",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #d9dee7",
    borderRadius: "8px",
    background: "#ffffff",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1600px",
    fontSize: "13px",
  },
  th: {
    padding: "9px 8px",
    borderBottom: "1px solid #d9dee7",
    background: "#fbfcfe",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "8px",
    borderBottom: "1px solid #edf0f4",
    verticalAlign: "top",
  },
  numericTd: {
    padding: "8px",
    borderBottom: "1px solid #edf0f4",
    textAlign: "right",
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },
  actionTd: {
    padding: "8px",
    borderBottom: "1px solid #edf0f4",
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },
  tableInput: {
    width: "120px",
    height: "28px",
    boxSizing: "border-box",
    border: "1px solid #c8d0dc",
    borderRadius: "5px",
    padding: "0 6px",
  },
  primaryButton: {
    height: "44px",
    padding: "0 18px",
    border: "1px solid rgba(106, 137, 180, 0.24)",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #dbeeff 0%, #c6ddfb 100%)",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 14px 24px rgba(119, 151, 198, 0.16)",
  },
  secondaryButton: {
    height: "44px",
    padding: "0 18px",
    border: "1px solid rgba(188, 193, 203, 0.55)",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.9)",
    color: "#35506d",
    fontWeight: 700,
    cursor: "pointer",
  },
  smallButton: {
    height: "28px",
    padding: "0 8px",
    marginRight: "6px",
    border: "1px solid #1f6feb",
    borderRadius: "5px",
    background: "#1f6feb",
    color: "#ffffff",
    cursor: "pointer",
  },
  smallSecondary: {
    height: "28px",
    padding: "0 8px",
    border: "1px solid #c8d0dc",
    borderRadius: "5px",
    background: "#ffffff",
    color: "#1f2933",
    cursor: "pointer",
  },
  smallDanger: {
    height: "28px",
    padding: "0 8px",
    border: "1px solid #b42318",
    borderRadius: "5px",
    background: "#b42318",
    color: "#ffffff",
    cursor: "pointer",
  },
  message: {
    marginBottom: "12px",
    padding: "10px 12px",
    border: "1px solid #a7d7b4",
    borderRadius: "6px",
    background: "#f1fbf4",
    color: "#17612d",
  },
  error: {
    marginBottom: "12px",
    padding: "10px 12px",
    border: "1px solid #f0b4b4",
    borderRadius: "6px",
    background: "#fff5f5",
    color: "#a32121",
  },
  muted: {
    color: "#5f6b7a",
    fontSize: "13px",
  },
};
