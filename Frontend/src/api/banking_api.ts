import axios from "axios";

import { API_BASE } from "../config/apiBase";

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

export const getBankingSpreadsheet = () => axios.get<BankingSpreadsheetResponse>(`${API_BASE}/banking/spreadsheet`);

