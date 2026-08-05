import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createAdminUser,
  getAdminRoles,
  getAdminUsers,
  updateAdminUser,
  type AdminRole,
  type AdminUser,
} from "../api/admin_access_api";
import { AdminShell } from "../components/AdminShell";
import { styles as adminStyles } from "./adminscreen";

type UserFormState = {
  signin: string;
  display_name: string;
  password: string;
  role_id: string;
  active: boolean;
};

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
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm());
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultRoleId = useMemo(() => {
    const preferredRole = roles.find((role) => role.active) ?? roles[0];
    return preferredRole ? String(preferredRole.id) : "";
  }, [roles]);

  const userStats = useMemo(() => {
    const active = users.filter((user) => user.active).length;
    return {
      total: users.length,
      active,
      inactive: Math.max(users.length - active, 0),
    };
  }, [users]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [rolesResponse, usersResponse] = await Promise.all([getAdminRoles(), getAdminUsers()]);
      const nextRoles = rolesResponse.data;
      const nextUsers = usersResponse.data;
      const nextDefaultRole = nextRoles.find((role) => role.active) ?? nextRoles[0] ?? null;
      const nextDefaultRoleId = nextDefaultRole ? String(nextDefaultRole.id) : "";

      setRoles(nextRoles);
      setUsers(nextUsers);

      if (editingUserId === null) {
        setUserForm((current) => (current.role_id ? current : { ...current, role_id: nextDefaultRoleId }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!userForm.role_id && defaultRoleId) {
      setUserForm((current) => (current.role_id ? current : { ...current, role_id: defaultRoleId }));
    }
  }, [defaultRoleId, userForm.role_id]);

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

  const clearUserForm = () => {
    setEditingUserId(null);
    setUserForm(emptyUserForm(defaultRoleId));
  };

  const saveUser = async () => {
    if (!userForm.signin.trim()) {
      setError("Signin is required");
      return;
    }

    const roleId = userForm.role_id || defaultRoleId;
    if (!roleId) {
      setError("Create a role first so users have somewhere to land.");
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
        role_id: Number(roleId),
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
      sidebarCopy="Manage signins here. Role permissions now live on the Roles screen."
      sidebarCardLabel="Users"
      sidebarCardValue={loading ? "Loading..." : String(userStats.total)}
      sidebarCardMeta={`${userStats.active} active users, ${userStats.inactive} inactive.`}
      onBack={() => navigate("/admin")}
      hideBackButton
    >
      <section style={adminStyles.content}>
        <section style={adminStyles.heroShell}>
          <div style={adminStyles.heroCopy}>
            <div style={adminStyles.kicker}>Users</div>
            <p style={adminStyles.subtitle}>
              Manage signins and passwords here. Role access is defined separately in Roles.
            </p>

            <div style={adminStyles.heroActions}>
              <button style={adminStyles.secondaryButton} type="button" onClick={() => void loadData()} disabled={saving}>
                Refresh
              </button>
              <button style={adminStyles.primaryButton} type="button" onClick={() => navigate("/admin/roles")}>
                Manage Roles
              </button>
            </div>
          </div>

          <div style={adminStyles.heroArt}>
            <div style={adminStyles.heroStatusCard}>
              <div style={adminStyles.heroStatusTop}>
                <span style={adminStyles.statusPill}>Access</span>
                <span style={adminStyles.statusDot} />
              </div>
              <div style={adminStyles.heroStatusTitle}>Role access lives elsewhere</div>
              <div style={adminStyles.heroStatusText}>
                Users keep their account details here, while screen access is shaped on the Roles screen.
              </div>
            </div>
          </div>
        </section>

        <section style={adminStyles.statsGrid}>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Users</div>
            <div style={adminStyles.statValue}>{userStats.total}</div>
            <div style={adminStyles.statDetail}>All user accounts in the database.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Active</div>
            <div style={adminStyles.statValue}>{userStats.active}</div>
            <div style={adminStyles.statDetail}>Currently enabled for sign in.</div>
          </article>
          <article style={adminStyles.statCard}>
            <div style={adminStyles.statLabel}>Inactive</div>
            <div style={adminStyles.statValue}>{userStats.inactive}</div>
            <div style={adminStyles.statDetail}>Kept on file, but not available.</div>
          </article>
        </section>

        {error && <div style={userStyles.errorBanner}>{error}</div>}

        <section style={adminStyles.widgetSection}>
          <div style={adminStyles.sectionHeader}>
            <div>
              <div style={adminStyles.sectionKicker}>Users</div>
              <h2 style={adminStyles.sectionTitle}>{editingUserId ? "Edit user" : "Create a user"}</h2>
            </div>
            <div style={adminStyles.sectionMeta}>
              Role assignment is handled in Roles. New users will use the default active role until changed there.
            </div>
          </div>

          <div style={userStyles.formGrid}>
            <label style={userStyles.field}>
              <span style={userStyles.label}>Signin</span>
              <input
                type="text"
                value={userForm.signin}
                onChange={(event) => setUserForm((current) => ({ ...current, signin: event.target.value }))}
                style={userStyles.input}
                placeholder="jdoe"
              />
            </label>

            <label style={userStyles.field}>
              <span style={userStyles.label}>Display name</span>
              <input
                type="text"
                value={userForm.display_name}
                onChange={(event) => setUserForm((current) => ({ ...current, display_name: event.target.value }))}
                style={userStyles.input}
                placeholder="Jane Doe"
              />
            </label>

            <label style={userStyles.field}>
              <span style={userStyles.label}>Password {editingUserId ? "(optional)" : ""}</span>
              <input
                type="password"
                value={userForm.password}
                onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                style={userStyles.input}
                placeholder={editingUserId ? "Leave blank to keep current password" : "Create a password"}
              />
            </label>

            <label style={userStyles.toggleField}>
              <input
                type="checkbox"
                checked={userForm.active}
                onChange={(event) => setUserForm((current) => ({ ...current, active: event.target.checked }))}
              />
              <span>Active</span>
            </label>

            <div style={userStyles.actionsRow}>
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
              <div style={adminStyles.sectionKicker}>User list</div>
              <h2 style={adminStyles.sectionTitle}>Defined users</h2>
            </div>
            <div style={adminStyles.sectionMeta}>{users.length} user(s) in the database.</div>
          </div>

          <div style={userStyles.tableWrap}>
            <table style={userStyles.table}>
              <thead>
                <tr>
                  <th style={userStyles.th}>Signin</th>
                  <th style={userStyles.th}>Display name</th>
                  <th style={userStyles.th}>Role</th>
                  <th style={userStyles.th}>Status</th>
                  <th style={userStyles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={user.active ? userStyles.activeRow : userStyles.inactiveRow}>
                    <td style={userStyles.tdName}>{user.signin}</td>
                    <td style={userStyles.td}>{user.display_name || "—"}</td>
                    <td style={userStyles.td}>{user.role_name || "Unassigned"}</td>
                    <td style={userStyles.td}>
                      <span style={user.active ? userStyles.activeBadge : userStyles.inactiveBadge}>
                        {user.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={userStyles.tdActions}>
                      <button type="button" style={userStyles.actionButton} onClick={() => startUserEdit(user)}>
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

const userStyles: Record<string, CSSProperties> = {
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
};
