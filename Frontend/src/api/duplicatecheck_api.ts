import axios from "axios";

import { API_BASE } from "../config/apiBase";

export interface DuplicateCheckRow {
  filename: string;
  ediCheck: string;
  lockboxAmount: string;
  eftAmount: string;
  date: string;
  count: number;
}

export interface DuplicateCheckSpreadsheetResponse {
  currentWorkDay: string;
  bankDay: string | null;
  rows: DuplicateCheckRow[];
  duplicateCount: number;
  duplicateFilenames: number;
  duplicateFilenameList: string[];
}

export const getDuplicateCheckSpreadsheet = () =>
  axios.get<DuplicateCheckSpreadsheetResponse>(`${API_BASE}/duplicatecheck/spreadsheet`);

