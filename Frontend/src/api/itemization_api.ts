import axios from "axios";
import { API_BASE } from "../config/apiBase";

export const getItemization = () => axios.get(`${API_BASE}/itemization`);
export const addItem = (data: unknown) => axios.post(`${API_BASE}/itemization`, data);
export const updateItem = (id: string | number, data: unknown) =>
  axios.put(`${API_BASE}/itemization/${id}`, data);
export const deleteItem = (id: string | number) => axios.delete(`${API_BASE}/itemization/${id}`);

