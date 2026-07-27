import { API_BASE } from "../config/apiBase";

export interface SnapshotGeneratorResult {
  processed_count: number;
  generated_count: number;
  skipped_count: number;
  files: string[];
}

export async function runSnapshotGenerator() {
  const response = await fetch(`${API_BASE}/snapshot-generator/run`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to run snapshot generator");
  }

  return (await response.json()) as SnapshotGeneratorResult;
}

