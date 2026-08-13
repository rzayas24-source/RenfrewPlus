import axios from "axios";

import { API_BASE } from "../config/apiBase";

export interface DevNoteRow {
  id: number;
  created_at: string;
  updated_at: string;
  category: string;
  title: string;
  notes: string;
  is_done: boolean;
}

export interface DevNoteListResponse {
  table: string;
  rowCount: number;
  rows: DevNoteRow[];
}

export interface DevNotePayload {
  category?: string;
  title: string;
  notes: string;
  is_done?: boolean;
}

export const getDevNotes = (limit = 50, offset = 0) =>
  axios.get<DevNoteListResponse>(`${API_BASE}/admin/dev-notes`, {
    params: { limit, offset },
  });

export const createDevNote = (payload: DevNotePayload) =>
  axios.post<{ status: string; row: DevNoteRow | null }>(`${API_BASE}/admin/dev-notes`, payload);

export const updateDevNote = (noteId: number, payload: DevNotePayload) =>
  axios.put<{ status: string; row: DevNoteRow | null }>(`${API_BASE}/admin/dev-notes/${noteId}`, payload);

export const deleteDevNote = (noteId: number) =>
  axios.delete<{ status: string; id: number }>(`${API_BASE}/admin/dev-notes/${noteId}`);
