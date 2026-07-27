// src/api/introscreen_api.ts
import { API_BASE } from "../config/apiBase";

export async function fetchPendingByDay() {
  const response = await fetch(`${API_BASE}/pending/by-day`);

  if (!response.ok) {
    throw new Error("Failed to load pending items");
  }

  return await response.json();
}

