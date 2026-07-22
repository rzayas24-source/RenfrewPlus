import axios from "axios";

const API = "http://127.0.0.1:8000";

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
  axios.get<OtherDaySpreadsheetResponse>(`${API}/otherday/spreadsheet`);
