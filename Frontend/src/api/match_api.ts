import axios from "axios";

const API = "http://127.0.0.1:8000";

export interface SourceMatchSummary {
  ediUnmatched: number;
  eftUnmatched: number;
  lockboxUnmatched: number;
  strongCandidates: number;
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
}

export interface SourceMatchWorklistResponse {
  summary: SourceMatchSummary;
  rows: SourceMatchWorklistRow[];
  changed: boolean;
  revision: string;
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

export const getSourceMatchWorklist = (limit = 50, revision?: string | null) =>
  axios.get<SourceMatchWorklistResponse>(`${API}/match/worklist`, {
    params: {
      limit,
      ...(revision ? { revision } : {}),
    },
  });

export const getSourceMatchDetail = (ediId: number) =>
  axios.get<SourceMatchDetail>(`${API}/match/${ediId}`);

export const getSourceMatchHistory = (limit = 100) =>
  axios.get<SourceMatchHistoryResponse>(`${API}/match/matches`, { params: { limit } });

export const commitSourceMatch = (payload: SourceMatchCommitRequest) =>
  axios.post<SourceMatchCommitResponse>(`${API}/match/commit`, payload);
