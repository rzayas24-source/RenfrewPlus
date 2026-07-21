import axios from "axios";

const API = "http://127.0.0.1:8000";

export interface EraSpreadsheetRow {
  source: "EFT" | "Lockbox";
  bankDay: string;
  checkNumber: string;
  payer: string;
  amount: string;
  eraFile: string;
}

export interface EraSpreadsheetResponse {
  workDay: string;
  bankDay: string | null;
  rows: EraSpreadsheetRow[];
  matchedChecks: number;
  matchedFiles: number;
}

export interface EraConvertResult {
  sourceFile: string;
  renamedFile: string;
  checkNumber: string;
}

export interface EraConvertResponse {
  status: string;
  statusTag: string;
  message: string;
  workDay: string;
  bankDay: string;
  renamedCount: number;
  outputFolder: string;
  renamedFiles: EraConvertResult[];
}

export const getEraSpreadsheet = (work_day: string) =>
  axios.get<EraSpreadsheetResponse>(`${API}/era/spreadsheet`, { params: { work_day } });

export const convertEraFiles = (work_day: string) =>
  axios.post<EraConvertResponse>(`${API}/era/convert`, { work_day });
