const API = "http://127.0.0.1:8000";

export interface EftUploadResponse {
  status: string;
  statusTag: string;
  filename: string;
  rowsLoaded: number;
  table: string;
  appendMode: boolean;
}

export interface EftTransformResponse {
  status: string;
  statusTag: string;
  rowsStaged: number;
  batchnum: string;
  startTransnum: string;
  endTransnum: string;
  timestamp: string;
  table: string;
  fieldMap: Record<string, string>;
}

export interface EftVetRow {
  row: number;
  date: string;
  payer: string;
  checkNumber: string;
  amount: string;
  status: string;
}

export interface EftVetResponse {
  status: string;
  statusTag: string;
  message: string;
  table: string;
  rowsLoaded: number;
  totalRows: number;
  duplicateCount: number;
  blankPayerCount: number;
  blankDateCount: number;
  blockedCount: number;
  allBlocked: boolean;
  duplicateRows: EftVetRow[];
  blankPayerRows: EftVetRow[];
  blankDateRows: EftVetRow[];
}

export interface EftApprovalResponse {
  status: string;
  statusTag: string;
  message: string;
  table: string;
  rowsApproved: number;
  timestamp: string;
  tablesReset: string[];
}

export async function uploadEftWorkbook(file: File): Promise<EftUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API}/eft/upload-stage`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to upload EFT workbook");
  }

  return await response.json();
}

export async function transformEftStage(): Promise<EftTransformResponse> {
  const response = await fetch(`${API}/eft/transform-stage`, {
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to stage EFT data");
  }

  return await response.json();
}

export async function vetEftStage(): Promise<EftVetResponse> {
  const response = await fetch(`${API}/eft/vet-stage`, {
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to vet EFT data");
  }

  return await response.json();
}

export async function approveEftStage(decision: "approve" | "approve_partial" | "deny"): Promise<EftApprovalResponse> {
  const response = await fetch(`${API}/eft/approval-stage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ decision }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to approve EFT data");
  }

  return await response.json();
}
