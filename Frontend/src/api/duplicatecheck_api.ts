import axios from "axios";

const API = "http://127.0.0.1:8000";

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
  axios.get<DuplicateCheckSpreadsheetResponse>(`${API}/duplicatecheck/spreadsheet`);
