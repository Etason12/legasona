import axios from 'axios';

// Detect if running inside Capacitor (Android app) vs browser
const isCapacitor = typeof window !== 'undefined' && window.Capacitor?.isNative;

// In Capacitor, use the RENDER_BACKEND_URL env var or fallback
// In browser, dynamically use the current hostname
const API_BASE_URL = isCapacitor
  ? (import.meta.env.VITE_RENDER_URL || 'http://10.0.2.2:5000') + '/api'
  : (import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000/api`);

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
export { API_BASE_URL };
