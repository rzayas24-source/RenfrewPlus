import axios from "axios";

import { API_BASE } from "../config/apiBase";

export interface BalsheetEntry {
  entry_id?: string;
  posting_date: string;
  type: string;
  amount: number;
  payer: string;
  check_number: string;
  edi: string;
  poster: string;
  eob: string;
  unposted: number;
  misc: number;
  misc_type: string;
  notes: string;
  nick: number;
  raul: number;
  needs: string;
  from_date: string;
  to_date: string;
}

export interface BalsheetNote {
  rowid: number;
  post_date: string;
  notes: string;
  message: string;
}

export interface BalsheetNotePayload {
  post_date: string;
  notes: string;
  message: string;
}

export interface BalsheetWorkday {
  posting_date: string;
  current_bank_day?: string;
  current_work_day?: string;
  message?: string;
}

export interface MiscEntry {
  misc_id: string;
  posting_date: string;
  amount: number;
  misc_type: string;
  details: string;
  created_at: string;
}

export interface MiscEntryPayload {
  posting_date: string;
  amount: number;
  misc_type: string;
  details: string;
  created_at?: string;
}

export interface BalsheetKeyproofReviewRow {
  attachmentId: number;
  filename: string;
  site: string;
  batchDate: string;
  reviewStatus: string;
  keyproofTotal: number;
  eftExpectedTotal: number;
  lockboxExpectedTotal: number;
  eftBalsheetTotal: number;
  lockboxBalsheetTotal: number;
  springLaneExpectedTotal: number;
  springLaneBalsheetTotal: number;
  springLaneDifference: number;
  springLaneStatus: "matched" | "partial" | "missing" | "not_applicable";
  itemizationDifference: number;
  itemizationBalsheetTotal: number;
  itemizationStatus: "matched" | "partial" | "no_itemization";
  balsheetActualTotal: number;
  balsheetDifference: number;
  balsheetStatus: "matched" | "partial" | "missing" | "not_applicable";
  balsheetRowCount: number;
  status: "matched" | "partial" | "no_itemization";
}

export interface BalsheetKeyproofReviewResponse {
  postingDate: string;
  balsheetRowCount: number;
  keyproofCount: number;
  needsReviewCount: number;
  itemizationMatchedCount: number;
  itemizationPartialCount: number;
  itemizationMissingCount: number;
  balsheetMatchedCount: number;
  balsheetPartialCount: number;
  balsheetMissingCount: number;
  springLaneMatchedCount: number;
  springLanePartialCount: number;
  springLaneMissingCount: number;
  rows: BalsheetKeyproofReviewRow[];
}

export interface BalsheetKeyproofIssueRow {
  attachmentId: number;
  filename: string;
  site: string;
  batchDate: string;
  reviewStatus: string;
  keyproofTotal: number;
  balsheetActualTotal: number;
  difference: number;
}

export interface BalsheetKeyproofIssueResponse {
  openCount: number;
  postingDateCount: number;
  openBalanceTotal: number;
  rows: BalsheetKeyproofIssueRow[];
}

export interface ImagingDocumentSuggestion {
  filePath: string;
  fileName: string;
  fileExt: string;
  isArchived: boolean;
  sourceFolder: string;
  confidence: number;
  matchMethod: string;
  openUrl: string;
  bookmarkPage?: number;
  bookmarkTitle?: string;
}

export interface ImagingDocumentLink {
  linkId: string;
  filePath: string;
  fileName: string;
  matchMethod: string;
  confidence: number;
  bookmarkPage?: number;
  bookmarkTitle?: string;
  sourceQuery?: string;
  lockboxImageDate?: string;
  confirmed: boolean;
  openUrl: string;
}

export interface ImagingBalsheetAssociationRow {
  entryId: string;
  postingDate: string;
  type: string;
  amount: number;
  payer: string;
  checkNumber: string;
  linkedFiles: ImagingDocumentLink[];
  matches: ImagingDocumentSuggestion[];
  recommendations: ImagingLockboxRecommendation[];
}

export interface ImagingBalsheetAssociationResponse {
  postingDate: string;
  rowCount: number;
  indexCount: number;
  rows: ImagingBalsheetAssociationRow[];
}

export interface ImagingLinkConfirmPayload {
  entryId: string;
  filePath: string;
  linkId?: string;
  checkNumber?: string;
  matchMethod?: string;
  confidence?: number;
  bookmarkPage?: number;
  bookmarkTitle?: string;
  sourceQuery?: string;
  postingDate?: string;
  payer?: string;
  amount?: number;
  lockboxImageDate?: string;
}

export interface ImagingLockboxSearchResult {
  filePath: string;
  fileName: string;
  pageCount: number;
  confidence: number;
  matchMethod: string;
  bookmarkPage: number;
  bookmarkTitle: string;
  snippet: string;
  openUrl: string;
  sourceFolder: string;
}

export interface ImagingLockboxSearchResponse {
  postingDate: string;
  query: string;
  results: ImagingLockboxSearchResult[];
}

export interface ImagingLockboxRecommendation {
  filePath: string;
  fileName: string;
  confidence: number;
  matchMethod: string;
  bookmarkPage: number;
  bookmarkTitle: string;
  snippet: string;
  sourceFolder: string;
  foundCheckNumber: string;
  foundAmount: string;
  openUrl?: string;
}

export interface ImagingBulkCommitExactResponse {
  status: string;
  postingDate: string;
  committedCount: number;
  skippedCount: number;
  data: ImagingBalsheetAssociationResponse;
}

export function getBalsheet(postingDate?: string) {
  const params = postingDate ? { posting_date: postingDate } : undefined;
  return axios.get<BalsheetEntry[]>(`${API_BASE}/balsheet`, { params });
}

export function getBalsheetNotes(postDate?: string) {
  const params = postDate ? { post_date: postDate } : undefined;
  return axios.get<BalsheetNote[]>(`${API_BASE}/balsheet/notes`, { params });
}

export function createBalsheetNote(payload: BalsheetNotePayload) {
  return axios.post<BalsheetNote>(`${API_BASE}/balsheet/notes`, payload);
}

export function updateBalsheetNote(rowid: number, payload: BalsheetNotePayload) {
  return axios.put<BalsheetNote>(`${API_BASE}/balsheet/notes/${rowid}`, payload);
}

export async function upsertBalsheetNoteText(postDate: string, notes: string) {
  const response = await getBalsheetNotes(postDate);
  const existing = response.data[0];
  if (existing) {
    return updateBalsheetNote(existing.rowid, {
      post_date: postDate,
      notes: notes.trim(),
      message: existing.message || "",
    });
  }

  return createBalsheetNote({
    post_date: postDate,
    notes: notes.trim(),
    message: "",
  });
}

export async function upsertBalsheetNoteMessage(postDate: string, message: string) {
  const response = await getBalsheetNotes(postDate);
  const existing = response.data[0];
  if (existing) {
    return updateBalsheetNote(existing.rowid, {
      post_date: postDate,
      notes: existing.notes || "",
      message: message.trim(),
    });
  }

  return createBalsheetNote({
    post_date: postDate,
    notes: "",
    message: message.trim(),
  });
}

export function getBalsheetWorkday() {
  return axios.get<BalsheetWorkday>(`${API_BASE}/balsheet/workday`);
}

export function importBalsheetFromBanking(postingDate: string, bankDay: string) {
  return axios.post<{ status: string; postingDate: string; rowsImported: number; rowsRemoved: number }>(
    `${API_BASE}/balsheet/import-banking`,
    {
      posting_date: postingDate,
      bank_day: bankDay,
    }
  );
}

export function clearBalsheet(postingDate: string) {
  return axios.delete<{ status: string; postingDate: string; rowsDeleted: number }>(`${API_BASE}/balsheet`, {
    params: { posting_date: postingDate },
  });
}

export function saveBalsheetEntries(entries: BalsheetEntry[], postingDate?: string) {
  return axios.post<{ status: string; rowsImported: number; sourceAttachmentId?: string }>(`${API_BASE}/balsheet/bulk`, {
    entries,
    posting_date: postingDate,
  });
}

export function updateBalsheetEntry(entryId: string, entry: BalsheetEntry) {
  return axios.put<BalsheetEntry>(`${API_BASE}/balsheet/${entryId}`, entry);
}

export function createBalsheetEntry(entry: BalsheetEntry) {
  return axios.post<BalsheetEntry>(`${API_BASE}/balsheet`, entry);
}

export function deleteBalsheetEntry(entryId: string) {
  return axios.delete<{ status: string; entry_id: string }>(`${API_BASE}/balsheet/${entryId}`);
}

export function getBalsheetKeyproofReview(postingDate?: string) {
  const params = postingDate ? { posting_date: postingDate } : undefined;
  return axios.get<BalsheetKeyproofReviewResponse>(`${API_BASE}/balsheet/keyproof-review`, { params });
}

export function getBalsheetKeyproofIssues() {
  return axios.get<BalsheetKeyproofIssueResponse>(`${API_BASE}/balsheet/keyproof-review-open`);
}

export function getImagingBalsheetAssociations(postingDate: string) {
  return axios.get<ImagingBalsheetAssociationResponse>(`${API_BASE}/imaging/balsheet-associations`, {
    params: { posting_date: postingDate },
  });
}

export function refreshImagingBalsheetAssociations(postingDate: string) {
  return axios.post<ImagingBalsheetAssociationResponse>(`${API_BASE}/imaging/balsheet-associations/refresh`, {
    posting_date: postingDate,
  });
}

export function commitImagingExactMatches(postingDate: string) {
  return axios.post<ImagingBulkCommitExactResponse>(`${API_BASE}/imaging/balsheet-associations/confirm-exact`, {
    posting_date: postingDate,
  });
}

export function confirmImagingBalsheetLink(payload: ImagingLinkConfirmPayload) {
  return axios.post<{ status: string; linkId: string; entryId: string; filePath: string }>(
    `${API_BASE}/imaging/balsheet-links/confirm`,
    {
      entry_id: payload.entryId,
      file_path: payload.filePath,
      link_id: payload.linkId,
      check_number: payload.checkNumber,
      match_method: payload.matchMethod,
      confidence: payload.confidence,
      bookmark_page: payload.bookmarkPage,
      bookmark_title: payload.bookmarkTitle,
      source_query: payload.sourceQuery,
      posting_date: payload.postingDate,
      payer: payload.payer,
      amount: payload.amount,
      lockbox_image_date: payload.lockboxImageDate,
    }
  );
}

export function deleteImagingBalsheetLink(linkId: string) {
  return axios.delete<{ status: string; linkId: string }>(`${API_BASE}/imaging/balsheet-links/${encodeURIComponent(linkId)}`);
}

export function buildImagingFileOpenUrl(filePath: string, page?: number) {
  const pageFragment = page && page > 0 ? `#page=${page}` : "";
  return `${API_BASE}/imaging/files/open?path=${encodeURIComponent(filePath)}${pageFragment}`;
}

export function buildImagingLinkOpenUrl(linkId: string, page?: number) {
  const pageFragment = page && page > 0 ? `#page=${page}` : "";
  return `${API_BASE}/imaging/balsheet-links/${encodeURIComponent(linkId)}/open${pageFragment}`;
}

export function getImagingLockboxAssociations(postingDate: string, query = "") {
  return axios.get<ImagingLockboxSearchResponse>(`${API_BASE}/imaging/lockbox-associations`, {
    params: {
      posting_date: postingDate,
      query,
    },
  });
}

export function findImagingLockboxMatches(postingDate: string) {
  return axios.post<ImagingBalsheetAssociationResponse>(`${API_BASE}/imaging/lockbox-associations/find-matches`, {
    posting_date: postingDate,
  });
}

export function getMisc(postingDate?: string) {
  const params = postingDate ? { posting_date: postingDate } : undefined;
  return axios.get<MiscEntry[]>(`${API_BASE}/misc`, { params });
}

export function createMiscEntry(payload: MiscEntryPayload) {
  return axios.post<MiscEntry>(`${API_BASE}/misc`, payload);
}

export function updateMiscEntry(miscId: string, payload: MiscEntryPayload) {
  return axios.put<MiscEntry>(`${API_BASE}/misc/${miscId}`, payload);
}

export function deleteMiscEntry(miscId: string) {
  return axios.delete<{ status: string; misc_id: string }>(`${API_BASE}/misc/${miscId}`);
}

