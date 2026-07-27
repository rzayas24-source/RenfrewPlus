import axios from "axios";

import { API_BASE } from "../config/apiBase";

export type TaskRecord = {
  id: string;
  task_list: string;
  title: string;
  details: string;
  category: string;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  action_type: "none" | "url" | "copy" | "copy_details";
  action_label: string;
  action_value: string;
  done: boolean;
  sort_order: number;
  next_due_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskDraft = {
  id?: string;
  task_list?: string;
  title: string;
  details: string;
  category: string;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  action_type: "none" | "url" | "copy" | "copy_details";
  action_label: string;
  action_value: string;
  done?: boolean;
  sort_order?: number;
  next_due_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function getTasks(taskList = "live") {
  const response = await axios.get<TaskRecord[]>(`${API_BASE}/tasks`, { params: { task_list: taskList } });
  return response.data;
}

export async function getTemplateTasks() {
  const response = await axios.get<TaskRecord[]>(`${API_BASE}/tasks/template`);
  return response.data;
}

export async function createTask(task: TaskDraft) {
  const response = await axios.post<TaskRecord>(`${API_BASE}/tasks`, task);
  return response.data;
}

export async function replaceTasks(taskList: string, tasks: TaskDraft[]) {
  const response = await axios.post<{ status: string; task_list: string; rows: number }>(`${API_BASE}/tasks/bulk-replace`, {
    task_list: taskList,
    tasks,
  });
  return response.data;
}

export async function importTemplateToLive(sourceList = "template", targetList = "live") {
  const response = await axios.post<{ status: string; source_list: string; target_list: string; rows: number }>(
    `${API_BASE}/tasks/import-template`,
    {
      source_list: sourceList,
      target_list: targetList,
    }
  );
  return response.data;
}

export async function updateTask(taskId: string, task: TaskDraft) {
  const response = await axios.put<TaskRecord>(`${API_BASE}/tasks/${encodeURIComponent(taskId)}`, task);
  return response.data;
}

export async function deleteTask(taskId: string) {
  const response = await axios.delete<{ status: string; task_id: string }>(`${API_BASE}/tasks/${encodeURIComponent(taskId)}`);
  return response.data;
}

