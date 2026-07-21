import axios from "axios";

const API = "http://127.0.0.1:8000";

export interface HtmlSpreadsheetRow {
  source: "EFT" | "Lockbox";
  bankDay: string;
  checkNumber: string;
  htmlFile: string;
}

export interface HtmlSpreadsheetResponse {
  workDay: string;
  bankDay: string | null;
  rows: HtmlSpreadsheetRow[];
  matchedChecks: number;
  matchedFiles: number;
}

export interface HtmlConvertResult {
  sourceFile: string;
  renamedFile: string;
  checkNumber: string;
}

export interface HtmlConvertResponse {
  status: string;
  statusTag: string;
  message: string;
  workDay: string;
  bankDay: string;
  renamedCount: number;
  outputFolder: string;
  renamedFiles: HtmlConvertResult[];
}

export const getHtmlSpreadsheet = (work_day: string) =>
  axios.get<HtmlSpreadsheetResponse>(`${API}/html/spreadsheet`, { params: { work_day } });

export const convertHtmlFiles = (work_day: string) =>
  axios.post<HtmlConvertResponse>(`${API}/html/convert`, { work_day });
