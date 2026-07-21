const API = "http://127.0.0.1:8000";

export interface Upload835ZipResponse {
  status: string;
  statusTag: string;
  filename: string;
  rowsLoaded: number;
  blockedCount: number;
  extractedCounts: {
    trn: number;
    era: number;
    html: number;
  };
  destinations: {
    trn: string;
    era: string;
    html: string;
  };
}

export interface Load835TrnResponse {
  status: string;
  statusTag: string;
  message: string;
  table: string;
  rowsLoaded: number;
  filesLoaded: number;
  filesBlocked: number;
  blockedRows: number;
  timestamp: string;
  movedTo: string;
}

export interface Stage835EdiResponse {
  status: string;
  statusTag: string;
  message: string;
  table: string;
  rowsStaged: number;
  batchnum: string;
  startTransnum: string;
  endTransnum: string;
  timestamp: string;
}

export interface Vet835EdiResponse {
  status: string;
  statusTag: string;
  message: string;
  table: string;
  rowsLoaded: number;
  totalRows: number;
  duplicateCount: number;
  allDuplicates: boolean;
  duplicateRows: Array<{
    row: number;
    checkNumber: string;
    date: string;
    amount: string;
    status: string;
  }>;
  timestamp: string;
}

export interface Approve835EdiResponse {
  status: string;
  statusTag: string;
  message: string;
  table: string;
  rowsApproved?: number;
  timestamp: string;
  tablesReset?: string[];
  matchRefresh?: {
    status: string;
    ediMatched: number;
    eftMatched: number;
    lockboxMatched: number;
    strongMatched: number;
  };
  matchRefreshWarning?: string;
}

export async function upload835ZipFile(file: File): Promise<Upload835ZipResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API}/835/upload-stage`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to process 835 zip file");
  }

  return await response.json();
}

export async function load835TrnFiles(): Promise<Load835TrnResponse> {
  const response = await fetch(`${API}/835/load-trn-folder`, {
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to load TRN files");
  }

  return await response.json();
}

export async function stage835EdiLoad(): Promise<Stage835EdiResponse> {
  const response = await fetch(`${API}/835/stage-edi`, {
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to stage EDI data");
  }

  return await response.json();
}

export async function vet835EdiStage(): Promise<Vet835EdiResponse> {
  const response = await fetch(`${API}/835/vet-edi`, {
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to vet EDI data");
  }

  return await response.json();
}

export async function approve835EdiStage(decision: "approve" | "deny"): Promise<Approve835EdiResponse> {
  const response = await fetch(`${API}/835/approval-stage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ decision }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to process 835 approval");
  }

  return await response.json();
}
