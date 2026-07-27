import axios from "axios";

import { API_BASE } from "../config/apiBase";

export interface OtherDayRow {
  filename: string;
  checkNumber: string;
  ediAmount: string;
  bankDay: string;
  matchstatus: string;
  counts: string;
}

export interface OtherDaySpreadsheetResponse {
  currentWorkDay: string;
  bankDay: string | null;
  rows: OtherDayRow[];
  missingRows: OtherDayRow[];
  rowCount: number;
  missingCount: number;
  filenamesWithMissing: number;
}

export const getOtherDaySpreadsheet = () =>
  axios.get<OtherDaySpreadsheetResponse>(`${API_BASE}/otherday/spreadsheet`);

