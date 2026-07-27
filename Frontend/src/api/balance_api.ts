import axios from "axios";
import { API_BASE } from "../config/apiBase";

export const getBalanceCheck = () => axios.get(`${API_BASE}/balancecheck`);
export const updateBalanceCheck = (id: string | number, data: unknown) =>
  axios.put(`${API_BASE}/balancecheck/${id}`, data);

