import axios from "axios";
import { toast } from "sonner";

declare module "axios" {
  export interface AxiosRequestConfig {
    skipErrorHandling?: boolean;
  }
}

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
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const config = error.config;
    const response = error.response;
    const status = response?.status;

    if (config?.skipErrorHandling) {
      return Promise.reject(error);
    }

    if (!response || status! >= 500) {
      toast.error("Wystąpił problem z połączeniem z serwerem.");
    }

    console.error("[API Error]", response || error);
    return Promise.reject(error);
  },
);

export default api;
