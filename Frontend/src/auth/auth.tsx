import type { CSSProperties, FormEvent, ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loginUser, reauthenticateSession, type AuthLoginResponse, type AuthUser, type LoginPayload } from "../api/admin_access_api";
import { AUTH_SESSION_STORAGE_KEY } from "../api/session_auth";

const AUTH_STORAGE_KEY = "renfrew:auth-user";
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const FRESH_AUTH_WINDOW_MS = 5 * 60 * 1000;

type AuthSessionState = {
  sessionToken: string;
  lastActivityAt: number;
  lastFreshAuthAt: number;
  sessionNotice: string | null;
};

type FreshAuthRequest = {
  promise: Promise<boolean>;
  resolve: (value: boolean) => void;
};

type AuthContextValue = {
  currentUser: AuthUser | null;
  signIn: (payload: LoginPayload) => Promise<AuthUser>;
  signOut: () => void;
  updateCurrentUser: (nextUser: AuthUser) => void;
  requireFreshAuth: () => Promise<boolean>;
  sessionNotice: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AuthSessionState>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      sessionToken: typeof parsed.sessionToken === "string" ? parsed.sessionToken : "",
      lastActivityAt: Number(parsed.lastActivityAt) || Date.now(),
      lastFreshAuthAt: Number(parsed.lastFreshAuthAt) || Date.now(),
      sessionNotice: typeof parsed.sessionNotice === "string" ? parsed.sessionNotice : null,
    } satisfies AuthSessionState;
  } catch {
    return null;
  }
}

function writeStoredUser(user: AuthUser | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (user) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

function writeStoredSession(session: AuthSessionState | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (session) {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => readStoredUser());
  const [sessionState, setSessionState] = useState<AuthSessionState | null>(() => readStoredSession());
  const [freshAuthPromptOpen, setFreshAuthPromptOpen] = useState(false);
  const [freshAuthPassword, setFreshAuthPassword] = useState("");
  const [freshAuthError, setFreshAuthError] = useState<string | null>(null);
  const pendingFreshAuthRef = useRef<FreshAuthRequest | null>(null);
  const lastActivityRef = useRef(sessionState?.lastActivityAt ?? Date.now());
  const lastFreshAuthRef = useRef(sessionState?.lastFreshAuthAt ?? Date.now());

  useEffect(() => {
    lastActivityRef.current = sessionState?.lastActivityAt ?? Date.now();
    lastFreshAuthRef.current = sessionState?.lastFreshAuthAt ?? Date.now();
  }, [sessionState]);

  const persistSession = (nextSession: AuthSessionState | null) => {
    setSessionState(nextSession);
    writeStoredSession(nextSession);
  };

  const clearPendingFreshAuth = (result: boolean) => {
    const pending = pendingFreshAuthRef.current;
    pendingFreshAuthRef.current = null;
    setFreshAuthPromptOpen(false);
    setFreshAuthPassword("");
    setFreshAuthError(null);
    pending?.resolve(result);
  };

  const finalizeLogout = (sessionNotice: string | null) => {
    setCurrentUser(null);
    writeStoredUser(null);
    persistSession(
      sessionNotice
        ? {
            sessionToken: "",
            lastActivityAt: Date.now(),
            lastFreshAuthAt: Date.now(),
            sessionNotice,
          }
        : null
    );
    clearPendingFreshAuth(false);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      signIn: async (payload: LoginPayload) => {
        const response = await loginUser(payload);
        const nextUserResponse = response.data as AuthLoginResponse;
        const nextUser: AuthUser = {
          id: nextUserResponse.id,
          signin: nextUserResponse.signin,
          display_name: nextUserResponse.display_name,
          phone_number: nextUserResponse.phone_number,
          role: nextUserResponse.role,
          permissions: nextUserResponse.permissions,
        };
        const now = Date.now();
        persistSession({
          sessionToken: nextUserResponse.session_token,
          lastActivityAt: now,
          lastFreshAuthAt: now,
          sessionNotice: null,
        });
        setCurrentUser(nextUser);
        writeStoredUser(nextUser);
        return nextUser;
      },
      signOut: () => {
        finalizeLogout(null);
      },
      updateCurrentUser: (nextUser: AuthUser) => {
        setCurrentUser(nextUser);
        writeStoredUser(nextUser);
      },
      requireFreshAuth: async () => {
        if (!currentUser) {
          return false;
        }

        const now = Date.now();
        if (now - lastFreshAuthRef.current <= FRESH_AUTH_WINDOW_MS) {
          lastActivityRef.current = now;
          persistSession({
            sessionToken: sessionState?.sessionToken ?? "",
            lastActivityAt: now,
            lastFreshAuthAt: lastFreshAuthRef.current,
            sessionNotice: null,
          });
          return true;
        }

        if (pendingFreshAuthRef.current) {
          return pendingFreshAuthRef.current.promise;
        }

        const pending = {} as FreshAuthRequest;
        const promise = new Promise<boolean>((resolve) => {
          pending.resolve = resolve;
          setFreshAuthPassword("");
          setFreshAuthError(null);
          setFreshAuthPromptOpen(true);
        });
        pending.promise = promise;
        pendingFreshAuthRef.current = pending;
        return promise;
      },
      sessionNotice: sessionState?.sessionNotice ?? null,
    }),
    [currentUser, sessionState]
  );

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const recordActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      writeStoredSession({
        sessionToken: sessionState?.sessionToken ?? "",
        lastActivityAt: now,
        lastFreshAuthAt: lastFreshAuthRef.current,
        sessionNotice: null,
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        recordActivity();
      }
    };

    const checkIdle = () => {
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        finalizeLogout("Your session locked after 30 minutes of inactivity. Please sign in again.");
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "click",
      "keydown",
      "mousedown",
      "mousemove",
      "scroll",
      "touchstart",
      "pointerdown",
      "focus",
    ];

    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibility);
    const timer = window.setInterval(checkIdle, 30_000);

    recordActivity();

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(timer);
    };
  }, [currentUser]);

  const handleFreshAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) {
      clearPendingFreshAuth(false);
      return;
    }

    setFreshAuthError(null);
    try {
      const response = await reauthenticateSession({
        password: freshAuthPassword,
      });
      const nextSession = response.data;

      const now = Date.now();
      lastActivityRef.current = now;
      lastFreshAuthRef.current = now;
      writeStoredSession({
        sessionToken: nextSession.session_token,
        lastActivityAt: now,
        lastFreshAuthAt: now,
        sessionNotice: null,
      });
      clearPendingFreshAuth(true);
    } catch (error) {
      setFreshAuthError(error instanceof Error ? error.message : "Fresh authentication failed");
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}

      {freshAuthPromptOpen && currentUser && (
        <div style={authStyles.overlay} role="presentation">
          <form style={authStyles.dialog} onSubmit={(event) => void handleFreshAuthSubmit(event)}>
            <div style={authStyles.title}>Fresh authentication required</div>
            <div style={authStyles.meta}>
              Re-enter the password for <strong>{currentUser.signin}</strong> to continue.
            </div>
            <label style={authStyles.field}>
              <span style={authStyles.label}>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                style={authStyles.input}
                value={freshAuthPassword}
                onChange={(event) => setFreshAuthPassword(event.target.value)}
              />
            </label>
            {freshAuthError && <div style={authStyles.errorBanner}>{freshAuthError}</div>}
            <div style={authStyles.actions}>
              <button type="button" style={authStyles.secondaryButton} onClick={() => clearPendingFreshAuth(false)}>
                Cancel
              </button>
              <button type="submit" style={authStyles.primaryButton}>
                Verify
              </button>
            </div>
          </form>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

const authStyles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "grid",
    placeItems: "center",
    background: "rgba(13, 24, 39, 0.42)",
    backdropFilter: "blur(4px)",
    padding: "24px",
  },
  dialog: {
    width: "min(460px, 100%)",
    display: "grid",
    gap: "14px",
    padding: "22px",
    borderRadius: "22px",
    border: "1px solid rgba(140, 160, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.98)",
    boxShadow: "0 28px 64px rgba(18, 34, 55, 0.26)",
  },
  title: {
    fontSize: "20px",
    fontWeight: 900,
    color: "#16304d",
  },
  meta: {
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#516274",
  },
  field: {
    display: "grid",
    gap: "8px",
  },
  label: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontWeight: 800,
    color: "#6a7c90",
  },
  input: {
    height: "46px",
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.24)",
    background: "#f8fbfe",
    padding: "0 14px",
    color: "#16304d",
    outline: "none",
  },
  errorBanner: {
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(224, 107, 107, 0.28)",
    background: "rgba(255, 238, 238, 0.98)",
    color: "#a32121",
    fontSize: "13px",
    fontWeight: 700,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },
  primaryButton: {
    height: "42px",
    borderRadius: "14px",
    border: "1px solid rgba(106, 137, 180, 0.24)",
    background: "linear-gradient(135deg, #dbeeff 0%, #c6ddfb 100%)",
    color: "#15304f",
    fontWeight: 900,
    padding: "0 16px",
    cursor: "pointer",
  },
  secondaryButton: {
    height: "42px",
    borderRadius: "14px",
    border: "1px solid rgba(140, 160, 184, 0.24)",
    background: "rgba(245, 248, 251, 0.96)",
    color: "#27405e",
    fontWeight: 800,
    padding: "0 16px",
    cursor: "pointer",
  },
};
