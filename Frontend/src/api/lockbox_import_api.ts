const API = "http://127.0.0.1:8000";

export interface LockboxUploadResponse {
  status: string;
  filename: string;
  rowsLoaded: number;
  table: string;
}

export interface LockboxVetDuplicateRow {
  row: number;
  checkNumber: string;
  transactionNumber: string;
  depositDate: string;
  payor: string;
  checkAmount: string;
  status: string;
}

export interface LockboxVetResponse {
  status: string;
  statusTag: string;
  message: string;
  table: string;
  totalRows: number;
  duplicateCount: number;
  qualifiedCount: number;
  allDuplicates: boolean;
  decisionRequired: boolean;
  duplicateRows: LockboxVetDuplicateRow[];
  rowsLoaded?: number;
}

export interface LockboxTransformResponse {
  status: string;
  statusTag: string;
  rowsStaged: number;
  batchnum: string;
  startTransnum: string;
  endTransnum: string;
  timestamp: string;
  table: string;
}

export interface LockboxApprovalResponse {
  status: string;
  statusTag: string;
  message: string;
  rowsApproved?: number;
  table?: string;
  timestamp?: string;
  tablesReset?: string[];
}

export async function uploadLockboxSearchResults(file: File): Promise<LockboxUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API}/lockbox/upload-stage`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to upload lockbox file");
  }

  return await response.json();
}

export async function transformLockboxStage(): Promise<LockboxTransformResponse> {
  const response = await fetch(`${API}/lockbox/transform-stage`, {
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to transform lockbox file");
  }

  return await response.json();
}

export async function vetLockboxStage(decision?: "partial" | "reject"): Promise<LockboxVetResponse> {
  const response = await fetch(`${API}/lockbox/vet-stage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(decision ? { decision } : {}),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to vet lockbox file");
  }

  return await response.json();
}

export async function approveLockboxStage(decision: "approve" | "deny"): Promise<LockboxApprovalResponse> {
  const response = await fetch(`${API}/lockbox/approval-stage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ decision }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to process lockbox approval");
  }

  return await response.json();
}
