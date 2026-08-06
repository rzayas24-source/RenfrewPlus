import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth";

export default function SignInScreen() {
  const navigate = useNavigate();
  const { currentUser, signIn, sessionNotice } = useAuth();
  const [signin, setSignin] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await signIn({
        signin,
        password,
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={signInStyles.page}>
      <div style={signInStyles.glowOne} />
      <div style={signInStyles.glowTwo} />

      <section style={signInStyles.shell}>
        <header style={signInStyles.brandBlock}>
          <img src="/renfrewplus-banner-tight.png" alt="RenfrewPlus wordmark" style={signInStyles.wordmark} />
          <p style={signInStyles.tagline}>Sign in to continue into the workflow admin shell.</p>
        </header>

        {sessionNotice && <div style={signInStyles.noticeBanner}>{sessionNotice}</div>}

        <section style={signInStyles.card} aria-label="Login credentials">
          <div style={signInStyles.cardHeader}>
            <div style={signInStyles.cardTitle}>Login credentials</div>
            <div style={signInStyles.cardMeta}>Use your signin and password to enter the app.</div>
          </div>

          <form style={signInStyles.form} onSubmit={(event) => void handleSubmit(event)}>
            <label style={signInStyles.field}>
              <span style={signInStyles.label}>Signin</span>
              <input
                type="text"
                autoComplete="username"
                placeholder="Enter your signin"
                style={signInStyles.input}
                value={signin}
                onChange={(event) => setSignin(event.target.value)}
              />
            </label>

            <label style={signInStyles.field}>
              <span style={signInStyles.label}>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                style={signInStyles.input}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {error && <div style={signInStyles.errorBanner}>{error}</div>}

            <button type="submit" style={signInStyles.button} disabled={saving}>
              {saving ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

const signInStyles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
    padding: "28px",
    background:
      "radial-gradient(circle at top left, rgba(143, 200, 255, 0.20), transparent 28%), radial-gradient(circle at bottom right, rgba(255, 184, 214, 0.20), transparent 24%), linear-gradient(180deg, #f7f9fc 0%, #eef3f9 100%)",
    color: "#16304d",
  },
  shell: {
    position: "relative",
    zIndex: 1,
    width: "min(560px, 100%)",
    display: "grid",
    gap: "22px",
  },
  glowOne: {
    position: "absolute",
    inset: "auto auto 10% 8%",
    width: "280px",
    height: "280px",
    borderRadius: "50%",
    background: "rgba(145, 197, 255, 0.20)",
    filter: "blur(8px)",
  },
  glowTwo: {
    position: "absolute",
    inset: "8% 8% auto auto",
    width: "220px",
    height: "220px",
    borderRadius: "50%",
    background: "rgba(255, 184, 214, 0.18)",
    filter: "blur(10px)",
  },
  brandBlock: {
    display: "grid",
    gap: "14px",
    justifyItems: "center",
    textAlign: "center",
  },
  wordmark: {
    width: "min(420px, 100%)",
    height: "auto",
    display: "block",
  },
  tagline: {
    margin: 0,
    maxWidth: "42ch",
    fontSize: "16px",
    lineHeight: 1.6,
    color: "#506274",
  },
  card: {
    borderRadius: "28px",
    border: "1px solid rgba(140, 160, 184, 0.20)",
    background: "rgba(255,255,255,0.88)",
    boxShadow: "0 28px 70px rgba(52, 84, 120, 0.12)",
    backdropFilter: "blur(18px)",
    padding: "24px",
    display: "grid",
    gap: "18px",
  },
  noticeBanner: {
    padding: "12px 14px",
    borderRadius: "16px",
    border: "1px solid rgba(216, 182, 92, 0.24)",
    background: "rgba(255, 248, 227, 0.96)",
    color: "#8b6a1a",
    fontSize: "13px",
    lineHeight: 1.45,
    fontWeight: 700,
  },
  cardHeader: {
    display: "grid",
    gap: "4px",
  },
  cardTitle: {
    fontSize: "22px",
    fontWeight: 900,
    letterSpacing: "-0.03em",
    color: "#16304d",
  },
  cardMeta: {
    fontSize: "13px",
    color: "#617488",
  },
  form: {
    display: "grid",
    gap: "14px",
  },
  field: {
    display: "grid",
    gap: "8px",
  },
  label: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    fontWeight: 800,
    color: "#6a7c90",
  },
  input: {
    height: "48px",
    borderRadius: "16px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(247, 250, 253, 0.95)",
    padding: "0 16px",
    color: "#16304d",
    outline: "none",
  },
  errorBanner: {
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid rgba(224, 107, 107, 0.30)",
    background: "rgba(255, 237, 237, 0.94)",
    color: "#a32121",
    fontSize: "13px",
    fontWeight: 700,
  },
  button: {
    marginTop: "6px",
    height: "48px",
    borderRadius: "16px",
    border: "1px solid rgba(106, 137, 180, 0.24)",
    background: "linear-gradient(135deg, #dbeeff 0%, #c6ddfb 100%)",
    color: "#15304f",
    fontWeight: 900,
    cursor: "pointer",
    opacity: 0.98,
  },
};
