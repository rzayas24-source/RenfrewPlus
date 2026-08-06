import axios from "axios";

import { API_BASE } from "../config/apiBase";
import "./session_auth";

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
  phone_number: string;
  role_id: number;
  role_name: string | null;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthRole {
  id: number;
  name: string;
  description: string;
  permissions: string[];
}

export interface AuthUser {
  id: number;
  signin: string;
  display_name: string;
  phone_number: string;
  role: AuthRole;
  permissions: string[];
}

export interface AuthLoginResponse extends AuthUser {
  session_token: string;
  session_last_activity_at: string;
  session_last_fresh_auth_at: string;
  session_expires_at: string;
}

export interface LoginPayload {
  signin: string;
  password: string;
}

export interface ReauthenticatePayload {
  password: string;
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
  phone_number?: string;
  password?: string;
  role_id: number;
  active?: boolean;
}

export interface UpdateProfilePayload {
  display_name?: string;
  phone_number?: string;
  password?: string;
}

export interface UpdateProfileResponse {
  id: number;
  signin: string;
  display_name: string;
  phone_number: string;
  role: AuthRole;
  permissions: string[];
}

export const loginUser = (payload: LoginPayload) => axios.post<AuthLoginResponse>(`${API_BASE}/auth/login`, payload);

export const reauthenticateSession = (payload: ReauthenticatePayload) =>
  axios.post<{ ok: true; session_token: string; session_last_activity_at: string; session_last_fresh_auth_at: string; session_expires_at: string }>(
    `${API_BASE}/auth/reauthenticate`,
    payload
  );

export const getAdminRoles = () => axios.get<AdminRole[]>(`${API_BASE}/auth/roles`);

export const createAdminRole = (payload: AdminRolePayload) => axios.post<AdminRole>(`${API_BASE}/auth/roles`, payload);

export const updateAdminRole = (roleId: number, payload: AdminRolePayload) =>
  axios.put<AdminRole>(`${API_BASE}/auth/roles/${roleId}`, payload);

export const deleteAdminRole = (roleId: number) => axios.delete(`${API_BASE}/auth/roles/${roleId}`);

export const getAdminUsers = () => axios.get<AdminUser[]>(`${API_BASE}/auth/users`);

export const createAdminUser = (payload: AdminUserPayload) => axios.post<AdminUser>(`${API_BASE}/auth/users`, payload);

export const updateAdminUser = (userId: number, payload: AdminUserPayload) =>
  axios.put<AdminUser>(`${API_BASE}/auth/users/${userId}`, payload);

export const updateCurrentProfile = (payload: UpdateProfilePayload) =>
  axios.put<UpdateProfileResponse>(`${API_BASE}/auth/profile`, payload);

