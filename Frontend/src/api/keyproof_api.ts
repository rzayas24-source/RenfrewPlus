import axios from "axios";
import { API_BASE } from "../config/apiBase";

export interface KeyproofDraft {
  attachmentId: number;
  site: string;
  cash: string;
  check: string;
  creditCard: string;
  eft: string;
  lockbox: string;
  foreignCheck: string;
  wireTransfer: string;
  misc: string;
}

export interface SiteOption {
  id: number;
  name: string;
  description: string | null;
  active: number;
}

export interface FlywireDocument {
  id: number;
  attachment_id: number;
  attachment_filename: string | null;
  batch_id: string | null;
  batch_date: string | null;
  source_filename: string | null;
  stored_filename: string | null;
  stored_path: string | null;
  sheet_name: string | null;
  row_count: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface FlywireSummary {
  attachment_id: number;
  attachment_filename: string | null;
  batch_id: string | null;
  batch_date: string | null;
  source_filename: string | null;
  sheet_name: string | null;
  row_count: number;
  total_amount: number;
  first_time: string | null;
  last_time: string | null;
  unique_locations: number;
  payment_methods: string[];
}

export interface FlywireRow {
  id: number;
  document_id: number;
  position: number;
  location: string | null;
  department: string | null;
  payment_method: string | null;
  payment_type: string | null;
  time_text: string | null;
  amount: number | null;
  flywire_id: string | null;
  account_number: string | null;
  patient_name: string | null;
  billing_name: string | null;
  application: string | null;
  raw_json: string | null;
}

export interface FlywirePayload {
  document: FlywireDocument | null;
  summary: FlywireSummary | null;
  rows: FlywireRow[];
}

export interface PersistedStateResponse<TPayload = unknown> {
  attachment_id: number;
  payload: TPayload | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface KeyproofSavedPayload {
  form: Omit<KeyproofDraft, "attachmentId">;
  batchDate: string;
  paperworkTotal: string;
}

export interface ItemizationSavedPayload {
  items: Array<Record<string, unknown>>;
}

export const getKeyproof = (attachmentId: number) =>
  axios.get<PersistedStateResponse<KeyproofSavedPayload>>(`${API_BASE}/keyproof/${attachmentId}`);
export const addKeyproof = (attachmentId: number, data: KeyproofSavedPayload) =>
  axios.put<PersistedStateResponse<KeyproofSavedPayload>>(`${API_BASE}/keyproof/${attachmentId}`, data);
export const updateKeyproof = (attachmentId: number, data: KeyproofSavedPayload) =>
  axios.put<PersistedStateResponse<KeyproofSavedPayload>>(`${API_BASE}/keyproof/${attachmentId}`, data);
export const deleteKeyproof = (attachmentId: number) => axios.delete(`${API_BASE}/keyproof/${attachmentId}`);

export const getItemization = (attachmentId: number) =>
  axios.get<PersistedStateResponse<ItemizationSavedPayload>>(`${API_BASE}/itemization/${attachmentId}`);
export const addItemization = (attachmentId: number, data: ItemizationSavedPayload) =>
  axios.put<PersistedStateResponse<ItemizationSavedPayload>>(`${API_BASE}/itemization/${attachmentId}`, data);
export const updateItemization = (attachmentId: number, data: ItemizationSavedPayload) =>
  axios.put<PersistedStateResponse<ItemizationSavedPayload>>(`${API_BASE}/itemization/${attachmentId}`, data);
export const deleteItemization = (attachmentId: number) =>
  axios.delete(`${API_BASE}/itemization/${attachmentId}`);
export const getSites = () => axios.get<SiteOption[]>(`${API_BASE}/sites`);
export const loadFlywire = (attachmentId: number) => axios.get<FlywirePayload>(`${API_BASE}/keyproof/flywire/${attachmentId}`);
export const autofindFlywire = (attachmentId: number) =>
  axios.post<FlywirePayload>(`${API_BASE}/keyproof/flywire/${attachmentId}/autofind`);

export async function uploadFlywire(attachmentId: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axios.post<FlywirePayload>(`${API_BASE}/keyproof/flywire/${attachmentId}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
}

export const deleteFlywire = (attachmentId: number) => axios.delete(`${API_BASE}/keyproof/flywire/${attachmentId}`);

