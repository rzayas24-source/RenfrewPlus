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

export function saveBalsheetEntries(entries: BalsheetEntry[]) {
  return axios.post<{ status: string; rowsImported: number; sourceAttachmentId?: string }>(`${API_BASE}/balsheet/bulk`, {
    entries,
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

