import axios from "axios";

const API = "http://127.0.0.1:8000";

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

export const getAdminTables = () => axios.get<AdminTableSummary[]>(`${API}/admin/tables`);

export const getAdminTable = (
  tableName: string,
  limit = 250,
  offset = 0,
  sortBy = "rowid",
  sortDirection: "asc" | "desc" = "asc"
) =>
  axios.get<AdminTableDetail>(
    `${API}/admin/tables/${encodeURIComponent(tableName)}?limit=${limit}&offset=${offset}&sort_by=${encodeURIComponent(sortBy)}&sort_direction=${sortDirection}`
  );
