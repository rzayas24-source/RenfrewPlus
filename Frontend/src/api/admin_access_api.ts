import axios from "axios";

const API = "http://127.0.0.1:8000";

export interface AdminRole {
  id: number;
  name: string;
  description: string;
  permissions: string[];
  is_system: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: number;
  signin: string;
  display_name: string;
  role_id: number;
  role_name: string | null;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminRolePayload {
  name: string;
  description?: string;
  permissions?: string[] | string;
  active?: boolean;
}

export interface AdminUserPayload {
  signin: string;
  display_name?: string;
  password?: string;
  role_id: number;
  active?: boolean;
}

export const getAdminRoles = () => axios.get<AdminRole[]>(`${API}/auth/roles`);

export const createAdminRole = (payload: AdminRolePayload) => axios.post<AdminRole>(`${API}/auth/roles`, payload);

export const updateAdminRole = (roleId: number, payload: AdminRolePayload) =>
  axios.put<AdminRole>(`${API}/auth/roles/${roleId}`, payload);

export const getAdminUsers = () => axios.get<AdminUser[]>(`${API}/auth/users`);

export const createAdminUser = (payload: AdminUserPayload) => axios.post<AdminUser>(`${API}/auth/users`, payload);

export const updateAdminUser = (userId: number, payload: AdminUserPayload) =>
  axios.put<AdminUser>(`${API}/auth/users/${userId}`, payload);
