import axios from "axios";

const API = "http://127.0.0.1:8000";

export interface SourceMatchSummary {
  ediRows: number;
  ediMatched: number;
  ediPossible: number;
  ediReview: number;
  eftUnmatched: number;
  lockboxUnmatched: number;
}

export type SourceMatchWorklistSummary = SourceMatchSummary;

export interface SourceMatchRow {
  id: number;
  source: "EDI" | "EFT" | "Lockbox";
  checkNumber: string;
  checkNumberNorm: string;
  amount: string | number | null;
  amountNorm: string | null;
  date: string | null;
  dateNorm: string | null;
  batchnum: string | null;
  transnum: string | null;
  timestamp: string | null;
  matchstatus: string | null;
  score?: number;
  reason?: string;
  exactMatch?: boolean;
  strongMatch?: boolean;
  closeMatch?: boolean;
}

export type SourceMatchCandidate = SourceMatchRow;

export interface SourceMatchWorklistRow {
  edi: SourceMatchRow;
  eftCandidateCount: number;
  lockboxCandidateCount: number;
  strongCandidateCount: number;
  closeCandidateCount: number;
  hasCheckMatch: boolean;
  matchCode: "Y" | "N" | "P";
  eftMatchCode: "Y" | "";
  lockboxMatchCode: "Y" | "";
  possibleMatchLabel: string;
  possibleMatchScore?: number | null;
}

export interface SourceMatchWorklistResponse {
  summary: SourceMatchSummary;
  rows: SourceMatchWorklistRow[];
  changed: boolean;
  revision: string;
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  sortBy: string;
  sortDir: "asc" | "desc";
  latestYear?: number | null;
  showMatched?: boolean;
  showUnmatched?: boolean;
  latestYearOnly?: boolean;
}

export interface SourceMatchDetail {
  edi: SourceMatchRow;
  eftCandidates: SourceMatchRow[];
  lockboxCandidates: SourceMatchRow[];
  matchedEft: SourceMatchRow[];
  matchedLockbox: SourceMatchRow[];
}

export interface SourceMatchHistoryRow {
  edi: SourceMatchRow;
  matchedEft: SourceMatchRow[];
  matchedLockbox: SourceMatchRow[];
}

export interface SourceMatchHistoryResponse {
  count: number;
  rows: SourceMatchHistoryRow[];
}

export interface SourceMatchCommitRequest {
  edi_id: number;
  eft_ids: number[];
  lockbox_ids: number[];
}

export interface SourceMatchCommitResponse {
  status: string;
  edi_id: number;
  eftMatched: number;
  lockboxMatched: number;
}

export interface SourceMatchBulkCommitResponse {
  status: string;
  ediMatched: number;
  eftMatched: number;
  lockboxMatched: number;
  exactMatched?: number;
  strongMatched?: number;
}

export const getSourceMatchWorklist = (
  limit = 250,
  revision?: string | null,
  page = 1,
  sortBy = "edi",
  sortDir: "asc" | "desc" = "asc",
  showMatched = true,
  showUnmatched = true,
  latestYearOnly = false,
) =>
  axios.get<SourceMatchWorklistResponse>(`${API}/match/worklist`, {
    params: {
      limit,
      ...(revision ? { revision } : {}),
      page,
      sort_by: sortBy,
      sort_dir: sortDir,
      show_matched: showMatched,
      show_unmatched: showUnmatched,
      latest_year_only: latestYearOnly,
    },
  });

export const getSourceMatchDetail = (ediId: number) =>
  axios.get<SourceMatchDetail>(`${API}/match/${ediId}`);

export const getSourceMatchHistory = (limit = 100) =>
  axios.get<SourceMatchHistoryResponse>(`${API}/match/matches`, { params: { limit } });

export const commitSourceMatch = (payload: SourceMatchCommitRequest) =>
  axios.post<SourceMatchCommitResponse>(`${API}/match/commit`, payload);

export const commitAllExactMatches = () =>
  axios.post<SourceMatchBulkCommitResponse>(`${API}/match/commit-exact-hits`);
