import axios from "axios";
import { toast } from "sonner";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  timeout: 10_000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message || error.message || "Wystąpił nieoczekiwany błąd.";
    toast.error(message);
    console.error("[API Error]", error.response || error);
    return Promise.reject(new Error(message));
  },
);

export default api;
