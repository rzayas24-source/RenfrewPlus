import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

export const AUTH_SESSION_STORAGE_KEY = "renfrew:auth-session";

const installedInstances = new WeakSet<AxiosInstance>();

type StoredAuthSession = {
  sessionToken?: string;
  lastActivityAt?: number;
  lastFreshAuthAt?: number;
  sessionNotice?: string | null;
};

function readStoredSessionToken() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredAuthSession;
    const token = typeof parsed.sessionToken === "string" ? parsed.sessionToken.trim() : "";
    return token || null;
  } catch {
    return null;
  }
}

function applySessionToken(config: InternalAxiosRequestConfig) {
  const token = readStoredSessionToken();
  if (!token) {
    return config;
  }

  const headers = config.headers as Record<string, string>;
  headers.Authorization = `Bearer ${token}`;
  headers["X-Session-Token"] = token;
  return config;
}

export function installSessionAuth(instance: AxiosInstance = axios) {
  if (installedInstances.has(instance)) {
    return;
  }

  instance.interceptors.request.use(applySessionToken);
  installedInstances.add(instance);
}

installSessionAuth(axios);
