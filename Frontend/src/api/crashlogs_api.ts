import axios from "axios";

import { API_BASE } from "../config/apiBase";

export interface CrashlogRow {
  id: number;
  created_at: string;
  incident_at: string;
  status: string;
  severity: string;
  screen: string;
  summary: string;
  details: string;
  frontend_health: string;
  backend_health: string;
  browser_health: string;
  created_by: string;
  resolved_at: string | null;
}

export interface CrashlogListResponse {
  table: string;
  rowCount: number;
  rows: CrashlogRow[];
}

export interface CrashlogCreatePayload {
  incident_at?: string;
  status?: string;
  severity?: string;
  screen?: string;
  summary: string;
  details: string;
  frontend_health?: string;
  backend_health?: string;
  browser_health?: string;
  created_by?: string;
  resolved_at?: string;
}

export const getCrashlogs = (limit = 100, offset = 0) =>
  axios.get<CrashlogListResponse>(`${API_BASE}/admin/crashlogs`, {
    params: { limit, offset },
  });

export const createCrashlog = (payload: CrashlogCreatePayload) =>
  axios.post<{ status: string; row: CrashlogRow | null }>(`${API_BASE}/admin/crashlogs`, payload);
