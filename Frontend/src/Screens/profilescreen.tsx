import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateCurrentProfile } from "../api/admin_access_api";
import { useAuth } from "../auth/auth";
import { AdminShell, styles as adminStyles } from "../components/AdminShell";

type ProfileFormState = {
  display_name: string;
  phone_number: string;
  password: string;
  confirm_password: string;
};

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { currentUser, updateCurrentUser } = useAuth();
  const [form, setForm] = useState<ProfileFormState>({
    display_name: "",
    phone_number: "",
    password: "",
    confirm_password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setForm({
      display_name: currentUser.display_name ?? "",
      phone_number: currentUser.phone_number ?? "",
      password: "",
      confirm_password: "",
    });
  }, [currentUser]);

  const saveProfile = async () => {
    if (!currentUser) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const password = form.password;
      const confirmPassword = form.confirm_password;
      if ((password || confirmPassword) && password !== confirmPassword) {
        setError("Password confirmation does not match.");
        return;
      }

      const payload = {
        display_name: form.display_name.trim(),
        phone_number: form.phone_number.trim(),
        ...(password ? { password } : {}),
      };

      const response = await updateCurrentProfile(payload);

      updateCurrentUser({
        ...currentUser,
        display_name: response.data.display_name,
        phone_number: response.data.phone_number,
        role: response.data.role,
        permissions: response.data.permissions,
      });
      setForm((current) => ({ ...current, password: "", confirm_password: "" }));
      setNotice("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      onBack={() => navigate("/")}
      hideBackButton
      useGlobalMenuFallback={false}
      ribbonTitle="Profile"
      sidebarCardLabel="Role"
      sidebarCardValue={currentUser?.role.name ?? ""}
      sidebarCardMeta={currentUser?.role.description ?? ""}
    >
      <section style={profileStyles.content}>
        <section style={profileStyles.heroShell}>
          <div style={profileStyles.heroCopy}>
            <div style={profileStyles.heroLabel}>User profile</div>
            <div style={profileStyles.heroSubTitle}>Keep your account details current.</div>
            <div style={profileStyles.heroMeta}>
              Update your display name, phone number, or password without leaving the profile screen.
            </div>
          </div>

          <div style={profileStyles.heroArt}>
            <div style={profileStyles.heroStatusCard}>
              <div style={profileStyles.heroStatusTop}>
                <span style={profileStyles.statusDot} />
              </div>
              <div style={profileStyles.heroIdentityStack}>
                <div style={profileStyles.heroIdentityLine}>
                  <span style={profileStyles.heroIdentityLabel}>Display:</span>
                  <span style={profileStyles.heroIdentityValue}>{currentUser?.display_name || "-"}</span>
                </div>
                <div style={profileStyles.heroIdentityLine}>
                  <span style={profileStyles.heroIdentityLabel}>Login:</span>
                  <span style={profileStyles.heroIdentityValue}>{currentUser?.signin || "-"}</span>
                </div>
                <div style={profileStyles.heroIdentityLine}>
                  <span style={profileStyles.heroIdentityLabel}>Role:</span>
                  <span style={profileStyles.heroIdentityValue}>{currentUser?.role.name || "-"}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && <div style={profileStyles.errorBanner}>{error}</div>}
        <div style={profileStyles.passwordNotice}>
          Password on file. Passwords are stored as salted hashes and are never shown.
          To change the password, enter it twice below so the change is intentional.
        </div>
        {notice && <div style={profileStyles.noticeBanner}>{notice}</div>}

        <section style={profileStyles.card}>
          <div style={profileStyles.formGrid}>
            <label style={profileStyles.field}>
              <span style={profileStyles.label}>Login 🔒</span>
              <input type="text" value={currentUser?.signin ?? ""} style={profileStyles.input} readOnly />
            </label>

            <label style={profileStyles.field}>
              <span style={profileStyles.label}>Role 🔒</span>
              <input type="text" value={currentUser?.role.name ?? ""} style={profileStyles.input} readOnly />
            </label>

            <label style={profileStyles.field}>
              <span style={profileStyles.label}>Display name</span>
              <input
                type="text"
                value={form.display_name}
                onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))}
                style={profileStyles.input}
                placeholder="Display name"
              />
            </label>

            <label style={profileStyles.field}>
              <span style={profileStyles.label}>Phone number</span>
              <input
                type="tel"
                value={form.phone_number}
                onChange={(event) => setForm((current) => ({ ...current, phone_number: event.target.value }))}
                style={profileStyles.input}
                placeholder="Phone number"
              />
            </label>

            <label style={profileStyles.field}>
              <span style={profileStyles.label}>New password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                style={profileStyles.input}
                placeholder="Enter a new password"
              />
            </label>

            <label style={profileStyles.field}>
              <span style={profileStyles.label}>Confirm new password</span>
              <input
                type="password"
                value={form.confirm_password}
                onChange={(event) => setForm((current) => ({ ...current, confirm_password: event.target.value }))}
                style={profileStyles.input}
                placeholder="Confirm the new password"
              />
            </label>
          </div>

          <div style={profileStyles.actionsRow}>
            <button type="button" style={adminStyles.primaryButton} onClick={() => void saveProfile()} disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </button>
            <button type="button" style={adminStyles.secondaryButton} onClick={() => setForm((current) => ({ ...current, password: "" }))}>
              Clear Password
            </button>
          </div>
        </section>
      </section>
    </AdminShell>
  );
}

const profileStyles: Record<string, CSSProperties> = {
  content: {
    ...adminStyles.content,
    paddingTop: "8px",
  },
  heroShell: {
    ...adminStyles.heroShell,
    padding: "22px",
    borderRadius: "32px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(243,248,255,0.94) 48%, rgba(255,239,246,0.92) 100%)",
    boxShadow: "0 26px 58px rgba(52, 84, 120, 0.10)",
    alignItems: "stretch",
    gap: "16px",
    minHeight: "190px",
  },
  heroCopy: {
    ...adminStyles.heroCopy,
    justifyContent: "center",
    gap: "10px",
  },
  heroLabel: {
    margin: 0,
    fontSize: "20px",
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
    color: "#16304d",
    fontWeight: 900,
    maxWidth: "22ch",
  },
  heroSubTitle: {
    margin: 0,
    fontSize: "17px",
    lineHeight: 1.35,
    letterSpacing: "-0.01em",
    color: "#5d7187",
    fontWeight: 400,
    maxWidth: "30ch",
  },
  heroMeta: {
    marginTop: "10px",
    fontSize: "14px",
    lineHeight: 1.55,
    color: "#5d7187",
    maxWidth: "56ch",
  },
  heroArt: {
    ...adminStyles.heroArt,
    justifyContent: "stretch",
  },
  heroStatusCard: {
    ...adminStyles.heroStatusCard,
    minHeight: "100%",
  },
  heroStatusTop: {
    ...adminStyles.heroStatusTop,
  },
  statusDot: {
    ...adminStyles.statusDot,
  },
  heroStatusTitle: {
    ...adminStyles.heroStatusTitle,
  },
  heroStatusText: {
    ...adminStyles.heroStatusText,
  },
  heroIdentityStack: {
    display: "grid",
    gap: "8px",
  },
  heroIdentityLabel: {
    fontSize: "13px",
    color: "#6d7f93",
    fontWeight: 900,
  },
  heroIdentityValue: {
    fontSize: "14px",
    fontWeight: 900,
    color: "#16304d",
  },
  heroIdentityLine: {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    padding: "10px 12px",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.76)",
    border: "1px solid rgba(140, 160, 184, 0.14)",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  errorBanner: {
    padding: "12px 14px",
    borderRadius: "16px",
    border: "1px solid #f0b4b4",
    background: "#fff5f5",
    color: "#a32121",
  },
  passwordNotice: {
    padding: "12px 14px",
    borderRadius: "16px",
    border: "1px solid rgba(153, 196, 231, 0.30)",
    background: "rgba(238, 247, 255, 0.96)",
    color: "#27405e",
    fontSize: "13px",
    lineHeight: 1.5,
    fontWeight: 700,
  },
  noticeBanner: {
    padding: "12px 14px",
    borderRadius: "16px",
    border: "1px solid rgba(140, 160, 184, 0.18)",
    background: "rgba(235, 245, 255, 0.92)",
    color: "#27405e",
    fontWeight: 700,
  },
  card: {
    padding: "20px",
    borderRadius: "30px",
    background: "rgba(255,255,255,0.76)",
    border: "1px solid rgba(140, 160, 184, 0.16)",
    boxShadow: "0 20px 42px rgba(52, 84, 120, 0.06)",
    display: "grid",
    gap: "18px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
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
  actionsRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },
};
