function resolveDefaultApiBase() {
  if (typeof window === "undefined") {
    return "/api";
  }

  return "/api";
}

export const API_BASE = (import.meta.env.VITE_API_URL || resolveDefaultApiBase()).replace(/\/$/, "");
