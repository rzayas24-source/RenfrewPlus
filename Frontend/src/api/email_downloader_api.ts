const API = "http://127.0.0.1:8000";

export interface EmailFolderOption {
  index: number;
  name: string;
}

export interface EmailDownloadResult {
  downloaded_count: number;
  downloaded_files: string[];
  processed_count: number;
  moved_count: number;
  batch_labels: string[];
}

function jsonHeaders() {
  return {
    "Content-Type": "application/json",
  };
}

export async function getEmailDownloaderFolders() {
  const response = await fetch(`${API}/email-downloader/folders`);
  if (!response.ok) {
    throw new Error("Failed to load email folders");
  }
  return (await response.json()) as EmailFolderOption[];
}

export async function getEmailDownloaderDates(folderIndex: number) {
  const response = await fetch(`${API}/email-downloader/dates?folder_index=${encodeURIComponent(folderIndex)}`);
  if (!response.ok) {
    throw new Error("Failed to load email dates");
  }
  return (await response.json()) as string[];
}

export async function runEmailDownloader(payload: {
  folder_index: number;
  date_value?: string | null;
  move_messages_after?: boolean;
  dest_folder_index?: number | null;
}) {
  const response = await fetch(`${API}/email-downloader/run`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to run email downloader");
  }

  return (await response.json()) as EmailDownloadResult;
}
