import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  withCredentials: true,
});

let isRefreshing = false;

let failedQueue: {
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}[] = [];

const processQueue = (error: any) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(true);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest =
      error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

    const status = error.response?.status;
    const requestUrl = originalRequest?.url || "";

    const isAuthEndpoint =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/refresh") ||
      requestUrl.includes("/auth/logout");

    if (
      status === 401 &&
      !originalRequest?._retry &&
      !isAuthEndpoint
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post("/auth/refresh");
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        return Promise.reject(refreshError); // ❌ NO REDIRECT HERE
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/* ========= API HELPERS ========= */

export const supplierAPI = {
  create: (payload: any) =>
    api.post("/suppliers", payload),

  listWithStatus: () =>
    api.get("/suppliers/with-status"),

  assessment: (id: string) =>
    api.get(`/suppliers/${id}/assessment`),

  resolveIdentity: (name: string) =>
    api.post("/suppliers/resolve", { name }),
};

export const intelligenceAPI = {
  aggregatePublicData: (id: string) =>
    api.get(`/suppliers/${id}/public-data`),

  extractEntities: (id: string, text: string) =>
    api.post(`/suppliers/${id}/extract`, { text }),

  trustGraph: (id: string) =>
    api.get(`/suppliers/${id}/graph`),
};

export default api;
