import axios from "axios";

const SESSION_KEY = "nms-bookx-session";
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const TOKEN_EXPIRY_GRACE_SECONDS = 15;

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decodedPayload = atob(normalizedPayload);
    return JSON.parse(decodedPayload);
  } catch {
    return null;
  }
}

export function isTokenExpired(token) {
  if (!token) return false;

  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;

  const currentSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= currentSeconds + TOKEN_EXPIRY_GRACE_SECONDS;
}

export function getStoredSession() {
  try {
    const storedSession = localStorage.getItem(SESSION_KEY);
    return storedSession ? JSON.parse(storedSession) : null;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function storeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
}

const API = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

API.interceptors.request.use((config) => {
  const token = getStoredSession()?.token;

  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  if (token) {
    if (isTokenExpired(token)) {
      clearStoredSession();
      window.dispatchEvent(new Event("auth:unauthorized"));
      return Promise.reject(new axios.CanceledError("Session expired."));
    }

    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && getStoredSession()) {
      clearStoredSession();
      window.dispatchEvent(new Event("auth:unauthorized"));
    }

    return Promise.reject(error);
  },
);

export default API;
