import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { styles as adminStyles } from "./adminscreen";
import { WorklistBrandButton } from "../worklist/worklist";

const API_BASE = "http://127.0.0.1:8000";

type SiteRow = {
  id: number;
  name: string;
  description: string | null;
  active: number;
};

export default function SitesScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editActive, setEditActive] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadSites();
  }, []);

  const loadSites = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<SiteRow[]>(`${API_BASE}/sites`);
      setSites(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sites");
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const active = sites.filter((site) => site.active === 1).length;
    return {
      total: sites.length,
      active,
      inactive: Math.max(sites.length - active, 0),
    };
  }, [sites]);

  const addSite = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await axios.post(`${API_BASE}/sites`, {
        name: newName.trim(),
        description: newDesc.trim(),
      });
      setNewName("");
      setNewDesc("");
      await loadSites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add site");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (site: SiteRow) => {
    setEditingId(site.id);
    setEditName(site.name);
    setEditDesc(site.description || "");
    setEditActive(site.active);
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    setSaving(true);
    setError(null);
    try {
      await axios.put(`${API_BASE}/sites/${editingId}`, {
        name: editName.trim(),
        description: editDesc.trim(),
        active: editActive,
      });
      setEditingId(null);
      await loadSites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update site");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const toggleActive = async (site: SiteRow) => {
    setSaving(true);
    setError(null);
    try {
      await axios.put(`${API_BASE}/sites/${site.id}`, {
        name: site.name,
        description: site.description,
        active: site.active === 1 ? 0 : 1,
      });
      await loadSites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle active state");
    } finally {
      setSaving(false);
    }
  };

  const deleteSite = async (siteId: number) => {
    setSaving(true);
    setError(null);
    try {
      await axios.delete(`${API_BASE}/sites/${siteId}`);
      await loadSites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete site");
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    const attachmentId = searchParams.get("attachmentId");
    const day = searchParams.get("day");

    if (attachmentId) {
      const params = new URLSearchParams({ attachmentId });

      if (day) {
        params.set("day", day);
      }

      navigate(`/keyproof?${params.toString()}`);
      return;
    }

    navigate(-1);
  };

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
          Maintain the site list used by review dropdowns and carry those names into the review flow.
        </p>

        <nav style={adminStyles.navStack} aria-label="Sites navigation">
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/admin")}>
            <span style={adminStyles.navButtonLabel}>Admin</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>?</span>
          </button>
          <button className="sidebar-nav-button" style={adminStyles.navButton} type="button" onClick={() => navigate("/site-review")}>
            <span style={adminStyles.navButtonLabel}>Site Review</span>
            <span className="sidebar-nav-button__glyph" style={adminStyles.navButtonGlyph}>?</span>
          </button>
        </nav>

        <div style={adminStyles.sidebarCard}>
          <div style={adminStyles.sidebarCardLabel}>Today</div>
          <div style={adminStyles.sidebarCardValue}>{loading ? "Loading sites..." : `${stats.total} site(s)`}</div>
          <div style={adminStyles.sidebarCardMeta}>
            Active and inactive site names stay in one place so the review screens can pull from a single list.
          </div>
        </div>
      </aside>

      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Sites management</div>
            <p style={adminStyles.subtitle}>
              Add, edit, activate, and remove site names used by the review dropdowns and saved back to each attachment.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.primaryButton} type="button" onClick={goBack}>
                Back
              </button>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => void loadSites()} disabled={saving}>
                Refresh
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Sites table</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>One list, used everywhere</div>
              <div style={adminStyles.heroStatusText}>
                This page feeds the review dropdown on attachments and the keyproof flow.
              </div>
            </div>
          </div>
        </section>

        <section style={adminStyles.statsGrid}>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Total</div>
            <div style={adminStyles.statValue}>{stats.total}</div>
            <div style={adminStyles.statDetail}>All defined sites currently in the database.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Active</div>
            <div style={adminStyles.statValue}>{stats.active}</div>
            <div style={adminStyles.statDetail}>Available to appear in dropdowns and review flow.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Inactive</div>
            <div style={adminStyles.statValue}>{stats.inactive}</div>
            <div style={adminStyles.statDetail}>Kept for history, but easy to toggle back on.</div>
          </article>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Add site</div>
              <h2 style={adminStyles.sectionTitle}>Create a new site name for review dropdowns</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              The name you add here becomes available to attachment review and keyproof selection.
            </div>
          </div>

          {error && <div style={siteStyles.errorBanner}>{error}</div>}

          <div style={siteStyles.formGrid}>
            <label style={siteStyles.field}>
              <span style={siteStyles.label}>Site name</span>
              <input
                type="text"
                placeholder="Example: Baltimore"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                style={siteStyles.input}
              />
            </label>

            <label style={siteStyles.field}>
              <span style={siteStyles.label}>Description</span>
              <input
                type="text"
                placeholder="Optional notes"
                value={newDesc}
                onChange={(event) => setNewDesc(event.target.value)}
                style={siteStyles.input}
              />
            </label>

            <div style={siteStyles.actionsRow}>
              <button style={adminStyles.primaryButton} type="button" onClick={() => void addSite()} disabled={saving}>
                {saving ? "Saving..." : "Add Site"}
              </button>
            </div>
          </div>
        </section>

        {editingId !== null && (
          <section style={adminStyles.widgetSection}>
            <div style={adminStyles.sectionHeader}>
              <div>
                <div style={adminStyles.sectionKicker}>Edit site</div>
                <h2 style={adminStyles.sectionTitle}>Update the selected site</h2>
              </div>
              <div style={adminStyles.sectionMeta}>
                Editing keeps the same name available in all review screens once you save.
              </div>
            </div>

            <div style={siteStyles.formGrid}>
              <label style={siteStyles.field}>
                <span style={siteStyles.label}>Site name</span>
                <input
                  type="text"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  style={siteStyles.input}
                />
              </label>

              <label style={siteStyles.field}>
                <span style={siteStyles.label}>Description</span>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(event) => setEditDesc(event.target.value)}
                  style={siteStyles.input}
                />
              </label>

              <label style={siteStyles.toggleField}>
                <input
                  type="checkbox"
                  checked={editActive === 1}
                  onChange={(event) => setEditActive(event.target.checked ? 1 : 0)}
                />
                <span>Active</span>
              </label>

              <div style={siteStyles.actionsRow}>
                <button style={adminStyles.primaryButton} type="button" onClick={() => void saveEdit()} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button style={adminStyles.secondaryButton} type="button" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </div>
          </section>
        )}

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Site list</div>
              <h2 style={adminStyles.sectionTitle}>All sites in the database</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              Edit, activate, deactivate, or delete names from the same screen.
            </div>
          </div>

          {loading ? (
            <div style={siteStyles.loadingState}>Loading sites...</div>
          ) : sites.length === 0 ? (
            <div style={siteStyles.loadingState}>No sites defined yet.</div>
          ) : (
            <div style={siteStyles.tableWrap}>
              <table style={siteStyles.table}>
                <thead>
                  <tr>
                    <th style={siteStyles.th}>Name</th>
                    <th style={siteStyles.th}>Description</th>
                    <th style={siteStyles.th}>Active</th>
                    <th style={siteStyles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((site) => (
                    <tr key={site.id} style={site.active === 1 ? siteStyles.activeRow : siteStyles.inactiveRow}>
                      <td style={siteStyles.tdName}>{site.name}</td>
                      <td style={siteStyles.td}>{site.description || "—"}</td>
                      <td style={siteStyles.td}>
                        <span style={site.active === 1 ? siteStyles.activeBadge : siteStyles.inactiveBadge}>
                          {site.active === 1 ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={siteStyles.tdActions}>
                        <button style={siteStyles.actionButton} type="button" onClick={() => startEdit(site)}>
                          Edit
                        </button>
                        <button style={siteStyles.actionButton} type="button" onClick={() => void toggleActive(site)}>
                          {site.active === 1 ? "Deactivate" : "Activate"}
                        </button>
                        <button style={siteStyles.deleteButton} type="button" onClick={() => void deleteSite(site.id)}>
                          Delete
                        </button>
                      </td>
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

const siteStyles: Record<string, CSSProperties> = {
  errorBanner: {
    marginBottom: "14px",
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid #f0b4b4",
    background: "#fff5f5",
    color: "#a32121",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
    alignItems: "start",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#27405e",
  },
  input: {
    height: "44px",
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.30)",
    background: "#ffffff",
    color: "#1f2933",
    padding: "0 12px",
    fontSize: "15px",
    outline: "none",
  },
  toggleField: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    paddingTop: "18px",
    color: "#1f2933",
    fontWeight: 600,
  },
  actionsRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
    gridColumn: "1 / -1",
  },
  loadingState: {
    padding: "18px 16px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.82)",
    border: "1px dashed rgba(140, 160, 184, 0.30)",
    color: "#5f6b7a",
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.82)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "760px",
  },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#6d7f93",
    borderBottom: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(247, 250, 253, 0.92)",
  },
  td: {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.12)",
    verticalAlign: "top",
    color: "#35506d",
  },
  tdName: {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.12)",
    verticalAlign: "top",
    color: "#16304d",
    fontWeight: 700,
  },
  tdActions: {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.12)",
    verticalAlign: "top",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  activeRow: {
    background: "rgba(255,255,255,0.88)",
  },
  inactiveRow: {
    background: "rgba(248, 250, 252, 0.95)",
  },
  activeBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(214, 243, 223, 0.9)",
    color: "#17623d",
    fontWeight: 700,
    fontSize: "12px",
  },
  inactiveBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(235, 239, 245, 0.95)",
    color: "#5e6d7f",
    fontWeight: 700,
    fontSize: "12px",
  },
  actionButton: {
    height: "36px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.28)",
    background: "#ffffff",
    color: "#35506d",
    fontWeight: 700,
    cursor: "pointer",
  },
  deleteButton: {
    height: "36px",
    padding: "0 12px",
    borderRadius: "12px",
    border: "1px solid rgba(200, 90, 90, 0.28)",
    background: "#fff5f5",
    color: "#a32121",
    fontWeight: 700,
    cursor: "pointer",
  },
};
