const API = "http://127.0.0.1:8000";

export interface SnapshotGeneratorResult {
  processed_count: number;
  generated_count: number;
  skipped_count: number;
  files: string[];
}

export async function runSnapshotGenerator() {
  const response = await fetch(`${API}/snapshot-generator/run`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to run snapshot generator");
  }

  return (await response.json()) as SnapshotGeneratorResult;
}
