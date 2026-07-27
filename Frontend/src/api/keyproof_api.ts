import axios from "axios";
const API = "http://127.0.0.1:8000";

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
  miscDescription: string;
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

export const getKeyproof = () => axios.get(`${API}/keyproof`);
export const addKeyproof = (data: KeyproofDraft) => axios.post(`${API}/keyproof`, data);
export const updateKeyproof = (id: number, data: KeyproofDraft) => axios.put(`${API}/keyproof/${id}`, data);
export const deleteKeyproof = (id: number) => axios.delete(`${API}/keyproof/${id}`);
export const getSites = () => axios.get<SiteOption[]>(`${API}/sites`);
export const loadFlywire = (attachmentId: number) => axios.get<FlywirePayload>(`${API}/keyproof/flywire/${attachmentId}`);
export const autofindFlywire = (attachmentId: number) =>
  axios.post<FlywirePayload>(`${API}/keyproof/flywire/${attachmentId}/autofind`);

export async function uploadFlywire(attachmentId: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axios.post<FlywirePayload>(`${API}/keyproof/flywire/${attachmentId}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
}

export const deleteFlywire = (attachmentId: number) => axios.delete(`${API}/keyproof/flywire/${attachmentId}`);
