// One axios instance for the whole app. Adds the JWT token automatically.
import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api" });

// "Remember me" keeps the token in localStorage (survives restarts); otherwise it lives
// in sessionStorage and disappears when the browser closes.
export const tokenStore = {
  get: () => localStorage.getItem("token") || sessionStorage.getItem("token"),
  set: (token, remember) => {
    tokenStore.clear();
    (remember ? localStorage : sessionStorage).setItem("token", token);
  },
  clear: () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
  },
};

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // Auth calls handle their own 401 (e.g. wrong password shows an inline error)
    if (err.response?.status === 401 && !err.config?.url?.startsWith("/auth/")) {
      tokenStore.clear();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

/* Turn any API error into one readable sentence (FastAPI 422s arrive as a list of field errors). */
export function apiErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (!err?.response) return "Cannot reach the server. Is the backend running on port 8000?";
  const detail = err.response.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((d) => {
        const field = d.loc?.[d.loc.length - 1];
        const msg = String(d.msg || "").replace(/^Value error, /, "");
        if (field === "email") return "Please enter a valid email address";
        if (field === "password" && d.type === "string_too_short") return "Password must be at least 8 characters";
        return msg;
      })
      .join(". ");
  }
  return fallback;
}

export default api;
