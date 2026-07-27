import axios from "axios";
import { API_BASE } from "../config/apiBase";

export type ReviewHistoryView = "approved" | "rejected" | "complete";

export type ReviewHistoryRow = {
  id: number;
  filename: string;
  site: string | null;
  detail: string | null;
  reason: string | null;
  total: number;
  status: string;
  processedAt: string | null;
  batchId: string | null;
  batchDate: string | null;
};

export async function getSiteReviewHistory(view: ReviewHistoryView = "complete") {
  const response = await axios.get<ReviewHistoryRow[]>(
    `${API_BASE}/site-review/history?view=${encodeURIComponent(view)}`
  );
  return response.data;
}
