import axios from "axios";

import { API_BASE } from "../config/apiBase";

export interface AdminTableColumn {
  name: string;
  type: string | null;
  notNull: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
}

export interface AdminTableSummary {
  name: string;
  rowCount: number;
  columnCount: number;
  columns: AdminTableColumn[];
}

export interface AdminTableDetail {
  name: string;
  rowCount: number;
  columns: AdminTableColumn[];
  rows: Array<Record<string, unknown>>;
}

export const getAdminTables = () => axios.get<AdminTableSummary[]>(`${API_BASE}/admin/tables`);

export const getAdminTable = (
  tableName: string,
  limit = 250,
  offset = 0,
  sortBy = "rowid",
  sortDirection: "asc" | "desc" = "asc"
) =>
  axios.get<AdminTableDetail>(
    `${API_BASE}/admin/tables/${encodeURIComponent(tableName)}?limit=${limit}&offset=${offset}&sort_by=${encodeURIComponent(sortBy)}&sort_direction=${sortDirection}`
  );

