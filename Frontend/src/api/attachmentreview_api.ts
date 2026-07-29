// src/api/attachmentreview_api.ts

import { API_BASE } from "../config/apiBase";

export interface PendingAttachment {
  id: number;
  filename: string;
  site: string | null;
  snapshot: string | null;
  status: string;
  done: false;
}

export interface DoneResponse {
  done: true;
}

export type PendingResponse = PendingAttachment | DoneResponse;

export interface RepairSnapshotResult {
  status: string;
  mode: "existing" | "generated" | "copied";
  id: number;
  snapshot_path: string;
  source_path: string;
}

function dayQuery(day?: string | null) {
  return day ? `?day=${encodeURIComponent(day)}` : "";
}

export async function getPendingAttachment(day?: string | null): Promise<PendingResponse> {
  const response = await fetch(`${API_BASE}/attachments/pending${dayQuery(day)}`);

  if (!response.ok) {
    throw new Error("Failed to load review attachment");
  }

  return await response.json();
}

export async function getAttachmentById(id: number): Promise<PendingResponse> {
  const response = await fetch(`${API_BASE}/attachments/${id}`);

  if (!response.ok) {
    throw new Error("Failed to load attachment");
  }

  return await response.json();
}

export async function getNextAttachment(id: number, day?: string | null): Promise<PendingResponse> {
  const response = await fetch(`${API_BASE}/attachments/${id}/next${dayQuery(day)}`);

  if (!response.ok) {
    throw new Error("Failed to load next attachment");
  }

  return await response.json();
}

export async function getPreviousAttachment(id: number, day?: string | null): Promise<PendingResponse> {
  const response = await fetch(`${API_BASE}/attachments/${id}/previous${dayQuery(day)}`);

  if (!response.ok) {
    throw new Error("Failed to load previous attachment");
  }

  return await response.json();
}

export async function updateAttachmentSite(id: number, site: string) {
  const response = await fetch(`${API_BASE}/attachments/${id}/site`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ site }),
  });

  if (!response.ok) {
    throw new Error("Failed to update attachment site");
  }

  return await response.json();
}

export async function approveAttachment(id: number) {
  const response = await fetch(`${API_BASE}/attachments/${id}/approve`, { method: "POST" });

  if (!response.ok) {
    throw new Error("Failed to approve attachment");
  }

  return await response.json();
}

export async function rejectAttachment(id: number) {
  const response = await fetch(`${API_BASE}/attachments/${id}/reject`, { method: "POST" });

  if (!response.ok) {
    throw new Error("Failed to reject attachment");
  }

  return await response.json();
}

export async function restoreAttachmentToPending(id: number) {
  const response = await fetch(`${API_BASE}/attachments/${id}/restore-pending`, { method: "POST" });

  if (!response.ok) {
    throw new Error("Failed to restore attachment to review");
  }

  return await response.json();
}

export async function repairAttachmentSnapshot(id: number) {
  const response = await fetch(`${API_BASE}/attachments/${id}/repair-snapshot`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to repair attachment snapshot");
  }

  return (await response.json()) as RepairSnapshotResult;
}

