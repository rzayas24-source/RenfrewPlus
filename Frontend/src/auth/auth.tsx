import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";
import { loginUser, type AuthUser, type LoginPayload } from "../api/admin_access_api";

const AUTH_STORAGE_KEY = "renfrew:auth-user";

type AuthContextValue = {
  currentUser: AuthUser | null;
  signIn: (payload: LoginPayload) => Promise<AuthUser>;
  signOut: () => void;
  updateCurrentUser: (nextUser: AuthUser) => void;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => readStoredUser());

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      signIn: async (payload: LoginPayload) => {
        const response = await loginUser(payload);
        const nextUser = response.data;
        setCurrentUser(nextUser);
        writeStoredUser(nextUser);
        return nextUser;
      },
      signOut: () => {
        setCurrentUser(null);
        writeStoredUser(null);
      },
      updateCurrentUser: (nextUser: AuthUser) => {
        setCurrentUser(nextUser);
        writeStoredUser(nextUser);
      },
    }),
    [currentUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
