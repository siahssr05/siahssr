import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const client = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,
});

// Attach token from localStorage as a fallback (cookie is the primary mechanism)
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("siahssr_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const fileUrl = (path) => (path ? `${API_BASE}${path}` : null);

export default client;
