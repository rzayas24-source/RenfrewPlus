import axios from "axios";
import { API_BASE } from "../config/apiBase";
import type { AppConfig } from "../config/appConfig";

export async function getAppConfig() {
  const response = await axios.get<AppConfig>(`${API_BASE}/config`);
  return response.data;
}

export async function saveAppConfig(config: AppConfig) {
  const response = await axios.put<AppConfig>(`${API_BASE}/config`, config);
  return response.data;
}
