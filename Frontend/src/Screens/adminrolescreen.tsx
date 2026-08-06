import { isAxiosError } from "axios";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAdminRole, deleteAdminRole, getAdminRoles, updateAdminRole, type AdminRole } from "../api/admin_access_api";
import { useAuth } from "../auth/auth";
import { AdminShell } from "../components/AdminShell";
import { getMenuOptions, type MenuOption } from "../navigation/menuConfig";
import { styles as adminStyles } from "./adminscreen";

type RoleFormState = {
  name: string;
  description: string;
  active: boolean;
  permissions: string[];
};

type ScreenGroup = {
  title: string;
  description: string;
  options: MenuOption[];
};

const emptyRoleForm = (): RoleFormState => ({
  name: "",
  description: "",
  active: true,
  permissions: [],
});

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
  }

  return error instanceof Error ? error.message : fallback;
}

export default function AdminRolesScreen() {
  const navigate = useNavigate();
  const { requireFreshAuth } = useAuth();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [form, setForm] = useState<RoleFormState>(emptyRoleForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const screenOptions = useMemo(
    () => getMenuOptions().filter((option): option is MenuOption & { kind: "screen" } => option.kind === "screen"),
    []
  );
  const screenLabelById = useMemo(
    () => new Map(screenOptions.map((option) => [option.id, option.label] as const)),
    [screenOptions]
  );
  const screenGroups = useMemo<ScreenGroup[]>(() => {
    const groupDefinitions: Array<{ title: string; description: string; matches: (option: MenuOption) => boolean }> = [
      {
        title: "Admin controls",
        description: "Administration, access control, and system setup.",
        matches: (option) => option.id.startsWith("/admin"),
      },
      {
        title: "Core workspaces",
        description: "The main screens people use every day.",
        matches: (option) =>
          ["/", "/cash", "/collections", "/business", "/finance", "/misc", "/sites"].includes(option.id),
      },
      {
        title: "Operations",
        description: "Posting, import, conversion, and queue work.",
        matches: (option) =>
          [
            "/calendar",
            "/import",
            "/eft-upload",
            "/835-upload",
            "/lockbox-import",
            "/era-convert",
            "/html-convert",
            "/banking",
          ].includes(option.id),
      },
      {
        title: "Reviews",
        description: "Daily checks, matching, and exception handling.",
        matches: (option) =>
          [
            "/835-match",
            "/site-review",
            "/email-downloader",
            "/snapshot-generator",
            "/worklist-editor",
            "/attachments",
            "/balancecheck",
            "/balsheet",
            "/keyproof",
            "/itemization",
            "/misc-editor",
            "/itemstoreview",
            "/statements",
            "/request",
            "/research",
            "/discrepancy",
            "/otherday",
            "/duplicatecheck",
            "/jane-doe",
          ].includes(option.id),
      },
      {
        title: "Utilities",
        description: "Support tools and shared helpers.",
        matches: (option) => option.id === "/tools",
      },
    ];

    const grouped = groupDefinitions.map((group) => ({
      title: group.title,
      description: group.description,
      options: screenOptions.filter((option) => group.matches(option)),
    }));
    const groupedIds = new Set(grouped.flatMap((group) => group.options.map((option) => option.id)));
    const remaining = screenOptions.filter((option) => !groupedIds.has(option.id));

    if (remaining.length) {
      grouped.push({
        title: "Other screens",
        description: "Any screens not grouped above.",
        options: remaining,
      });
    }

    return grouped.filter((group) => group.options.length > 0);
  }, [screenOptions]);
  const sanitizePermissions = (permissions: string[]) =>
    permissions.filter((permission) => permission === "*" || permission.startsWith("/"));

  const roleStats = useMemo(() => {
    const active = roles.filter((role) => role.active).length;
    const system = roles.filter((role) => role.is_system).length;
    const permissionCount = new Set(roles.flatMap((role) => role.permissions)).size;

    return {
      total: roles.length,
      active,
      system,
      permissionCount,
    };
  }, [roles]);

  const loadRoles = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getAdminRoles();
      const nextRoles = response.data;
      setRoles(nextRoles);

      if (selectedRoleId !== null) {
        const current = nextRoles.find((role) => role.id === selectedRoleId);
        if (current) {
          setForm({
            name: current.name,
            description: current.description || "",
            active: current.active,
            permissions: sanitizePermissions(current.permissions),
          });
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load roles"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRoles();
  }, []);

  const startRoleEdit = (role: AdminRole) => {
    setSelectedRoleId(role.id);
    setForm({
      name: role.name,
      description: role.description || "",
      active: role.active,
      permissions: sanitizePermissions(role.permissions),
    });
  };

  const startNewRole = () => {
    setSelectedRoleId(null);
    setForm(emptyRoleForm());
  };

  const togglePermission = (screenId: string) => {
    setForm((current) => {
      const exists = current.permissions.includes(screenId);
      return {
        ...current,
        permissions: exists ? current.permissions.filter((permission) => permission !== screenId) : [...current.permissions, screenId],
      };
    });
  };

  const saveRole = async () => {
    if (!form.name.trim()) {
      setError("Role name is required");
      return;
    }

    const allowed = await requireFreshAuth();
    if (!allowed) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        permissions: sanitizePermissions(form.permissions),
        active: form.active,
      };

      if (selectedRoleId === null) {
        await createAdminRole(payload);
      } else {
        await updateAdminRole(selectedRoleId, payload);
      }

      startNewRole();
      await loadRoles();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save role"));
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (role: AdminRole) => {
    const confirmed = window.confirm(`Delete the role "${role.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    const allowed = await requireFreshAuth();
    if (!allowed) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deleteAdminRole(role.id);
      if (selectedRoleId === role.id) {
        startNewRole();
      }
      await loadRoles();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete role"));
    } finally {
      setSaving(false);
    }
  };

  const currentRole = selectedRoleId === null ? null : roles.find((role) => role.id === selectedRoleId) ?? null;

  return (
    <AdminShell
      sidebarCopy="Define roles here, then decide which screens each role can open."
      sidebarCardLabel="Roles"
      sidebarCardValue={loading ? "Loading..." : String(roleStats.total)}
      sidebarCardMeta={`${roleStats.active} active roles, ${roleStats.permissionCount} screen targets.`}
      onBack={() => navigate("/admin")}
      hideBackButton
    >
      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Roles</div>
            <p style={adminStyles.subtitle}>
              Build role groups and choose the screens each role can access.
            </p>
            <div style={adminStyles.heroActions}>
              <button type="button" style={adminStyles.secondaryButton} onClick={() => void loadRoles()} disabled={saving}>
                Refresh
              </button>
              <button type="button" style={adminStyles.primaryButton} onClick={startNewRole} disabled={saving}>
                New Role
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Screen access</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Access by screen</div>
              <div style={adminStyles.heroStatusText}>
                Each role can carry the exact screens it is allowed to open in the admin shell.
              </div>
            </div>
          </div>
        </section>

        <section style={adminStyles.statsGrid}>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Roles</div>
            <div style={adminStyles.statValue}>{roleStats.total}</div>
            <div style={adminStyles.statDetail}>{roleStats.active} active, {roleStats.system} system roles.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Screens</div>
            <div style={adminStyles.statValue}>{screenOptions.length}</div>
            <div style={adminStyles.statDetail}>Available as role permissions.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Status</div>
            <div style={adminStyles.statValue}>{currentRole ? "Editing" : "New role"}</div>
            <div style={adminStyles.statDetail}>
              {currentRole ? `Selected role: ${currentRole.name}` : "Create a new role or choose one from the list."}
            </div>
          </article>
        </section>

        {error && <div style={rolesStyles.errorBanner}>{error}</div>}

        <section style={adminStyles.widgetSection}>
            <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Role editor</div>
              <h2 style={adminStyles.sectionTitle}>{currentRole ? "Edit role" : "Create role"}</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              Select the screens this role can access. Screen access is stored as routes.
            </div>
          </div>

          <div style={rolesStyles.formGrid}>
            <label style={rolesStyles.field}>
              <span style={rolesStyles.label}>Role name</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                style={rolesStyles.input}
                placeholder="Admin"
              />
            </label>

            <label style={rolesStyles.field}>
              <span style={rolesStyles.label}>Description</span>
              <input
                type="text"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                style={rolesStyles.input}
                placeholder="Full access across the app"
              />
            </label>

            <label style={rolesStyles.toggleField}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
              />
              <span>Active</span>
            </label>

            <div style={rolesStyles.actionsRow}>
              <button type="button" style={adminStyles.primaryButton} onClick={() => void saveRole()} disabled={saving}>
                {currentRole ? "Save Role" : "Add Role"}
              </button>
              {selectedRoleId !== null && (
                <button type="button" style={adminStyles.secondaryButton} onClick={startNewRole}>
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div style={rolesStyles.permissionSection}>
            <div style={adminStyles.sectionKicker}>Screen access</div>
            <h3 style={rolesStyles.permissionTitle}>Choose the screens this role can open</h3>
            {screenGroups.map((group) => (
              <section key={group.title} style={rolesStyles.groupSection}>
                <div style={rolesStyles.groupHeader}>
                  <div style={rolesStyles.groupTitleWrap}>
                    <h4 style={rolesStyles.groupTitle}>{group.title}</h4>
                    <p style={rolesStyles.groupDescription}>{group.description}</p>
                  </div>
                  <div style={rolesStyles.groupCount}>{group.options.length} screens</div>
                </div>
                <div style={rolesStyles.permissionGrid}>
                  {group.options.map((option) => {
                    const active = form.permissions.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => togglePermission(option.id)}
                        style={{
                          ...rolesStyles.permissionCard,
                          ...(active ? rolesStyles.permissionCardActive : null),
                        }}
                      >
                        <div style={rolesStyles.permissionCardTop}>
                          <span style={rolesStyles.permissionCardLabel}>{option.label}</span>
                          <span style={active ? rolesStyles.permissionBadgeActive : rolesStyles.permissionBadge}>
                            {active ? "Allowed" : "Blocked"}
                          </span>
                        </div>
                        <div style={rolesStyles.permissionCardMeta}>{option.meta}</div>
                        <div style={rolesStyles.permissionCardPath}>{option.path ?? option.id}</div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Role list</div>
              <h2 style={adminStyles.sectionTitle}>Defined roles</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              {roles.length} role(s) ready for use. Select a row to edit, or use the action buttons on the right.
            </div>
          </div>

          <div style={rolesStyles.tableWrap}>
            <table style={rolesStyles.table}>
              <thead>
                <tr>
                  <th style={rolesStyles.th}>Role</th>
                  <th style={rolesStyles.th}>Description</th>
                  <th style={rolesStyles.th}>Status</th>
                  <th style={rolesStyles.th}>Access</th>
                  <th style={rolesStyles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const selected = selectedRoleId === role.id;

                  return (
                    <tr
                      key={role.id}
                      style={selected ? rolesStyles.rowSelected : role.active ? rolesStyles.rowActive : rolesStyles.rowInactive}
                    >
                      <td style={rolesStyles.tdName}>
                        <button type="button" style={rolesStyles.rowButton} onClick={() => startRoleEdit(role)}>
                          <span style={rolesStyles.roleTitle}>{role.name}</span>
                          <span style={rolesStyles.roleSubtitle}>ID {role.id}</span>
                        </button>
                      </td>
                      <td style={rolesStyles.td}>{role.description || "No description yet"}</td>
                      <td style={rolesStyles.td}>
                        <span style={role.active ? rolesStyles.activeBadge : rolesStyles.inactiveBadge}>
                          {role.active ? "Active" : "Inactive"}
                        </span>
                        {role.is_system && <div style={rolesStyles.systemNote}>System role</div>}
                      </td>
                      <td style={rolesStyles.td}>
                        <div style={rolesStyles.permissionChipWrap}>
                          {role.permissions.length ? (
                            role.permissions.map((permission) => (
                              <span key={permission} style={rolesStyles.permissionChip}>
                                {screenLabelById.get(permission) ?? permission}
                              </span>
                            ))
                          ) : (
                            <span style={rolesStyles.mutedText}>No screen access defined</span>
                          )}
                        </div>
                      </td>
                      <td style={rolesStyles.tdActions}>
                        <button type="button" style={adminStyles.secondaryButton} onClick={() => startRoleEdit(role)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          style={rolesStyles.deleteButton}
                          onClick={() => void deleteRole(role)}
                          disabled={saving || role.is_system}
                          title={role.is_system ? "System roles cannot be deleted" : "Delete role"}
                        >
                          {role.is_system ? "Protected" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </AdminShell>
  );
}

const rolesStyles: Record<string, CSSProperties> = {
  errorBanner: {
    padding: "12px 14px",
    borderRadius: "16px",
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
  permissionSection: {
    marginTop: "18px",
    display: "grid",
    gap: "10px",
  },
  groupSection: {
    display: "grid",
    gap: "10px",
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.12)",
    background: "rgba(247, 250, 253, 0.78)",
  },
  groupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
  },
  groupTitleWrap: {
    display: "grid",
    gap: "4px",
  },
  groupTitle: {
    margin: 0,
    fontSize: "16px",
    color: "#17324f",
  },
  groupDescription: {
    margin: 0,
    fontSize: "13px",
    color: "#5b6f84",
    lineHeight: 1.4,
  },
  groupCount: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(236, 244, 252, 0.95)",
    border: "1px solid rgba(169, 188, 210, 0.22)",
    color: "#4c6076",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  permissionTitle: {
    margin: 0,
    fontSize: "20px",
    color: "#17324f",
  },
  permissionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "10px",
  },
  permissionCard: {
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.9)",
    padding: "14px",
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gap: "8px",
  },
  permissionCardActive: {
    borderColor: "rgba(112, 163, 217, 0.45)",
    background: "linear-gradient(145deg, rgba(237, 246, 255, 0.98) 0%, rgba(255, 246, 250, 0.96) 100%)",
    boxShadow: "0 12px 24px rgba(126, 154, 190, 0.14)",
  },
  permissionCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
  },
  permissionCardLabel: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#17324f",
  },
  permissionBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 8px",
    borderRadius: "999px",
    background: "rgba(237, 244, 251, 0.98)",
    border: "1px solid rgba(161, 185, 214, 0.32)",
    color: "#4c6076",
    fontSize: "11px",
    fontWeight: 800,
  },
  permissionBadgeActive: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 8px",
    borderRadius: "999px",
    background: "rgba(214, 243, 223, 0.9)",
    border: "1px solid rgba(118, 194, 145, 0.35)",
    color: "#17623d",
    fontSize: "11px",
    fontWeight: 800,
  },
  permissionCardMeta: {
    fontSize: "12px",
    color: "#5b6f84",
    lineHeight: 1.45,
  },
  permissionCardPath: {
    fontSize: "11px",
    color: "#7a8c9e",
    fontFamily: "Consolas, monospace",
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: "20px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.84)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "980px",
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
    verticalAlign: "bottom",
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
    color: "#17324f",
  },
  tdActions: {
    padding: "14px 16px",
    borderBottom: "1px solid rgba(140, 160, 184, 0.12)",
    verticalAlign: "top",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    minWidth: "220px",
  },
  rowActive: {
    background: "rgba(255,255,255,0.88)",
  },
  rowInactive: {
    background: "rgba(248, 250, 252, 0.95)",
  },
  rowSelected: {
    background: "linear-gradient(145deg, rgba(237, 246, 255, 0.98) 0%, rgba(255, 246, 250, 0.96) 100%)",
    boxShadow: "inset 0 0 0 1px rgba(112, 163, 217, 0.20)",
  },
  rowButton: {
    border: "0",
    background: "transparent",
    padding: 0,
    textAlign: "left",
    display: "grid",
    gap: "4px",
    cursor: "pointer",
    color: "inherit",
  },
  roleTitle: {
    fontSize: "15px",
    fontWeight: 800,
    color: "#17324f",
  },
  roleSubtitle: {
    fontSize: "12px",
    color: "#6d7f93",
  },
  systemNote: {
    marginTop: "8px",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#8d6a00",
    fontWeight: 800,
  },
  permissionChipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  permissionChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 8px",
    borderRadius: "999px",
    background: "rgba(236, 244, 252, 0.95)",
    border: "1px solid rgba(169, 188, 210, 0.22)",
    color: "#4c6076",
    fontSize: "11px",
    fontWeight: 700,
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
  mutedText: {
    fontSize: "13px",
    color: "#65788d",
  },
  deleteButton: {
    height: "44px",
    padding: "0 14px",
    borderRadius: "14px",
    border: "1px solid rgba(212, 136, 136, 0.38)",
    background: "linear-gradient(135deg, #fff1f1 0%, #ffe1e1 100%)",
    color: "#9d2f2f",
    fontWeight: 800,
    cursor: "pointer",
  },
};
