import axios from "axios";

const API = "http://127.0.0.1:8000";

export interface BankingSpreadsheetRow {
  id: number;
  source: "EFT" | "Lockbox";
  date: string;
  amount: string;
  payer: string;
  checkNumber: string;
  edi: string;
}

export interface BankingSpreadsheetGroup {
  source: "EFT" | "Lockbox";
  rows: BankingSpreadsheetRow[];
}

export interface BankingSpreadsheetSummaryItem {
  source: "EDI" | "EFT" | "Lockbox";
  count: number;
  lastDate: string;
  totalAmount?: number;
}

export interface BankingSpreadsheetResponse {
  summary: BankingSpreadsheetSummaryItem[];
  groups: BankingSpreadsheetGroup[];
}

export const getBankingSpreadsheet = () => axios.get<BankingSpreadsheetResponse>(`${API}/banking/spreadsheet`);
