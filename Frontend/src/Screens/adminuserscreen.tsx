import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createAdminRole,
  createAdminUser,
  getAdminRoles,
  getAdminUsers,
  updateAdminRole,
  updateAdminUser,
} from "../api/admin_access_api";
import type { AdminRole, AdminUser } from "../api/admin_access_api";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from './adminscreen';

type RoleFormState = {
  name: string;
  description: string;
  permissionsText: string;
  active: boolean;
};

type UserFormState = {
  signin: string;
  display_name: string;
  password: string;
  role_id: string;
  active: boolean;
};

const emptyRoleForm = (): RoleFormState => ({
  name: "",
  description: "",
  permissionsText: "menu.view, feature.view",
  active: true,
});

const emptyUserForm = (roleId = ""): UserFormState => ({
  signin: "",
  display_name: "",
  password: "",
  role_id: roleId,
  active: true,
});

export default function AdminUserScreen() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleForm, setRoleForm] = useState<RoleFormState>(emptyRoleForm());
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm());
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesResponse, usersResponse] = await Promise.all([getAdminRoles(), getAdminUsers()]);
      const nextRoles = rolesResponse.data;
      const nextUsers = usersResponse.data;
      setRoles(nextRoles);
      setUsers(nextUsers);
      setRoleForm((current) => (editingRoleId === null ? current : current));
      setUserForm((current) =>
        current.role_id || !nextRoles.length ? current : { ...current, role_id: String(nextRoles[0].id) }
      );
      if (!editingRoleId) {
        setRoleForm(emptyRoleForm());
      }
      if (!editingUserId) {
        setUserForm((current) =>
          current.role_id ? current : emptyUserForm(nextRoles[0] ? String(nextRoles[0].id) : "")
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users and roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userForm.role_id && roles.length) {
      setUserForm((current) => ({ ...current, role_id: String(roles[0].id) }));
    }
  }, [roles, userForm.role_id]);

  const roleStats = useMemo(() => {
    const active = roles.filter((role) => role.active).length;
    const system = roles.filter((role) => role.is_system).length;
    return {
      total: roles.length,
      active,
      system,
    };
  }, [roles]);

  const userStats = useMemo(() => {
    const active = users.filter((user) => user.active).length;
    return {
      total: users.length,
      active,
      inactive: Math.max(users.length - active, 0),
    };
  }, [users]);

  const startRoleEdit = (role: AdminRole) => {
    setEditingRoleId(role.id);
    setRoleForm({
      name: role.name,
      description: role.description || "",
      permissionsText: role.permissions.join(", "),
      active: role.active,
    });
  };

  const startUserEdit = (user: AdminUser) => {
    setEditingUserId(user.id);
    setUserForm({
      signin: user.signin,
      display_name: user.display_name || "",
      password: "",
      role_id: String(user.role_id),
      active: user.active,
    });
  };

  const clearRoleForm = () => {
    setEditingRoleId(null);
    setRoleForm(emptyRoleForm());
  };

  const clearUserForm = () => {
    setEditingUserId(null);
    setUserForm(emptyUserForm(roles[0] ? String(roles[0].id) : ""));
  };

  const saveRole = async () => {
    if (!roleForm.name.trim()) {
      setError("Role name is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const permissions = roleForm.permissionsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const payload = {
        name: roleForm.name.trim(),
        description: roleForm.description.trim(),
        permissions,
        active: roleForm.active,
      };

      if (editingRoleId === null) {
        await createAdminRole(payload);
      } else {
        await updateAdminRole(editingRoleId, payload);
      }

      clearRoleForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const saveUser = async () => {
    if (!userForm.signin.trim()) {
      setError("Signin is required");
      return;
    }

    if (!userForm.role_id) {
      setError("Select a role first");
      return;
    }

    if (editingUserId === null && !userForm.password.trim()) {
      setError("Password is required for a new user");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        signin: userForm.signin.trim(),
        display_name: userForm.display_name.trim(),
        role_id: Number(userForm.role_id),
        active: userForm.active,
        ...(userForm.password.trim() ? { password: userForm.password } : {}),
      };

      if (editingUserId === null) {
        await createAdminUser(payload);
      } else {
        await updateAdminUser(editingUserId, payload);
      }

      clearUserForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      sidebarCopy="Define the people who can sign in, and shape roles into permission groups for the rest of the app."
      sidebarCardLabel="Roles"
      sidebarCardValue={loading ? "Loading..." : String(roleStats.total)}
      sidebarCardMeta={`${roleStats.active} active roles, ${userStats.total} users total.`}
      onBack={() => navigate("/admin")}
      hideBackButton
    >      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Users and roles</div>
            <p style={adminStyles.subtitle}>
              Manage signins, passwords, and role-based permissions from the admin area.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => void loadData()} disabled={saving}>
                Refresh
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Security</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Access lives here</div>
              <div style={adminStyles.heroStatusText}>
                Roles drive permissions, and users inherit those permissions from the role they belong to.
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
            <div style={adminStyles.statLabel}>Users</div>
            <div style={adminStyles.statValue}>{userStats.total}</div>
            <div style={adminStyles.statDetail}>{userStats.active} active, {userStats.inactive} inactive.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Menu link</div>
            <div style={adminStyles.statValue}>Ready</div>
            <div style={adminStyles.statDetail}>These permissions can later drive the gazebo and menu visibility.</div>
          </article>
        </section>

        {error && <div style={accessStyles.errorBanner}>{error}</div>}

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Roles</div>
              <h2 style={adminStyles.sectionTitle}>{editingRoleId ? "Edit role" : "Create a role"}</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              Use permission keys like `menu.view` or `feature.manage`. Separate them with commas.
            </div>
          </div>

          <div style={accessStyles.formGrid}>
            <label style={accessStyles.field}>
              <span style={accessStyles.label}>Role name</span>
              <input
                type="text"
                value={roleForm.name}
                onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))}
                style={accessStyles.input}
                placeholder="Admin"
              />
            </label>

            <label style={accessStyles.field}>
              <span style={accessStyles.label}>Description</span>
              <input
                type="text"
                value={roleForm.description}
                onChange={(event) => setRoleForm((current) => ({ ...current, description: event.target.value }))}
                style={accessStyles.input}
                placeholder="Full access across the app"
              />
            </label>

            <label style={accessStyles.fieldFull}>
              <span style={accessStyles.label}>Permissions</span>
              <textarea
                value={roleForm.permissionsText}
                onChange={(event) => setRoleForm((current) => ({ ...current, permissionsText: event.target.value }))}
                style={accessStyles.textarea}
                rows={3}
                placeholder="menu.view, menu.manage, feature.view"
              />
            </label>

            <label style={accessStyles.toggleField}>
              <input
                type="checkbox"
                checked={roleForm.active}
                onChange={(event) => setRoleForm((current) => ({ ...current, active: event.target.checked }))}
              />
              <span>Active</span>
            </label>

            <div style={accessStyles.actionsRow}>
              <button type="button" style={adminStyles.primaryButton} onClick={() => void saveRole()} disabled={saving}>
                {editingRoleId ? "Save Role" : "Add Role"}
              </button>
              {editingRoleId !== null && (
                <button type="button" style={adminStyles.secondaryButton} onClick={clearRoleForm}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Users</div>
              <h2 style={adminStyles.sectionTitle}>{editingUserId ? "Edit user" : "Create a user"}</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              Signin and password belong to the user record. The role decides what they can access.
            </div>
          </div>

          <div style={accessStyles.formGrid}>
            <label style={accessStyles.field}>
              <span style={accessStyles.label}>Signin</span>
              <input
                type="text"
                value={userForm.signin}
                onChange={(event) => setUserForm((current) => ({ ...current, signin: event.target.value }))}
                style={accessStyles.input}
                placeholder="jdoe"
              />
            </label>

            <label style={accessStyles.field}>
              <span style={accessStyles.label}>Display name</span>
              <input
                type="text"
                value={userForm.display_name}
                onChange={(event) => setUserForm((current) => ({ ...current, display_name: event.target.value }))}
                style={accessStyles.input}
                placeholder="Jane Doe"
              />
            </label>

            <label style={accessStyles.field}>
              <span style={accessStyles.label}>Password {editingUserId ? "(optional)" : ""}</span>
              <input
                type="password"
                value={userForm.password}
                onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                style={accessStyles.input}
                placeholder={editingUserId ? "Leave blank to keep current password" : "Create a password"}
              />
            </label>

            <label style={accessStyles.field}>
              <span style={accessStyles.label}>Role</span>
              <select
                value={userForm.role_id}
                onChange={(event) => setUserForm((current) => ({ ...current, role_id: event.target.value }))}
                style={accessStyles.input}
              >
                <option value="">Choose a role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={accessStyles.toggleField}>
              <input
                type="checkbox"
                checked={userForm.active}
                onChange={(event) => setUserForm((current) => ({ ...current, active: event.target.checked }))}
              />
              <span>Active</span>
            </label>

            <div style={accessStyles.actionsRow}>
              <button type="button" style={adminStyles.primaryButton} onClick={() => void saveUser()} disabled={saving}>
                {editingUserId ? "Save User" : "Add User"}
              </button>
              {editingUserId !== null && (
                <button type="button" style={adminStyles.secondaryButton} onClick={clearUserForm}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Role list</div>
              <h2 style={adminStyles.sectionTitle}>Defined roles</h2>
            </div>
            <div style={adminStyles.sectionMeta}>{roles.length} role(s) ready for use.</div>
          </div>

          <div style={accessStyles.tableWrap}>
            <table style={accessStyles.table}>
              <thead>
                <tr>
                  <th style={accessStyles.th}>Name</th>
                  <th style={accessStyles.th}>Permissions</th>
                  <th style={accessStyles.th}>Status</th>
                  <th style={accessStyles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} style={role.active ? accessStyles.activeRow : accessStyles.inactiveRow}>
                    <td style={accessStyles.tdName}>{role.name}</td>
                    <td style={accessStyles.td}>
                      <div style={accessStyles.permissionWrap}>
                        {role.permissions.length ? (
                          role.permissions.map((permission) => (
                            <span key={permission} style={accessStyles.permissionChip}>
                              {permission}
                            </span>
                          ))
                        ) : (
                          <span style={accessStyles.mutedText}>No permissions defined</span>
                        )}
                      </div>
                    </td>
                    <td style={accessStyles.td}>
                      <span style={role.active ? accessStyles.activeBadge : accessStyles.inactiveBadge}>
                        {role.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={accessStyles.tdActions}>
                      <button type="button" style={accessStyles.actionButton} onClick={() => startRoleEdit(role)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>User list</div>
              <h2 style={adminStyles.sectionTitle}>Defined users</h2>
            </div>
            <div style={adminStyles.sectionMeta}>{users.length} user(s) in the database.</div>
          </div>

          <div style={accessStyles.tableWrap}>
            <table style={accessStyles.table}>
              <thead>
                <tr>
                  <th style={accessStyles.th}>Signin</th>
                  <th style={accessStyles.th}>Display name</th>
                  <th style={accessStyles.th}>Role</th>
                  <th style={accessStyles.th}>Status</th>
                  <th style={accessStyles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={user.active ? accessStyles.activeRow : accessStyles.inactiveRow}>
                    <td style={accessStyles.tdName}>{user.signin}</td>
                    <td style={accessStyles.td}>{user.display_name || "â€”"}</td>
                    <td style={accessStyles.td}>{user.role_name || "Unassigned"}</td>
                    <td style={accessStyles.td}>
                      <span style={user.active ? accessStyles.activeBadge : accessStyles.inactiveBadge}>
                        {user.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={accessStyles.tdActions}>
                      <button type="button" style={accessStyles.actionButton} onClick={() => startUserEdit(user)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </AdminShell>
  );
}

const accessStyles: Record<string, CSSProperties> = {
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
  fieldFull: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    gridColumn: "1 / -1",
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
  textarea: {
    minHeight: "92px",
    borderRadius: "12px",
    border: "1px solid rgba(140, 160, 184, 0.30)",
    background: "#ffffff",
    color: "#1f2933",
    padding: "12px",
    fontSize: "15px",
    outline: "none",
    resize: "vertical",
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
  tableWrap: {
    overflowX: "auto",
    borderRadius: "18px",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    background: "rgba(255,255,255,0.82)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "860px",
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
  permissionWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  permissionChip: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "28px",
    padding: "0 10px",
    borderRadius: "999px",
    background: "rgba(236, 244, 252, 0.95)",
    border: "1px solid rgba(169, 188, 210, 0.22)",
    color: "#4c6076",
    fontSize: "12px",
    fontWeight: 700,
  },
  mutedText: {
    fontSize: "13px",
    color: "#65788d",
  },
};


