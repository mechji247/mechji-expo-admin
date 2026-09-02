import axios from "axios";
import { backendUrl } from "../utils/env";
import { clearTokens, getAccessToken } from "../tokens/secureTokens";

let storeModule = null;
function getStoreModule() {
  if (!storeModule) {
    storeModule = require("../../store/store");
  }
  return storeModule;
}

let adminSliceModule = null;
function getAdminSliceModule() {
  if (!adminSliceModule) {
    adminSliceModule = require("../../store/slices/adminSlice");
  }
  return adminSliceModule;
}

const adminApi = axios.create({
  baseURL: `${backendUrl}/api/admin`,
  timeout: 30000,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

const REFRESHABLE_CODES = new Set([
  "MISSING_TOKEN",
  "TOKEN_EXPIRED",
  "INVALID_TOKEN",
  "INVALID_TOKEN_TYPE",
]);

adminApi.interceptors.request.use(
  async (config) => {
    try {
      const token = await getAccessToken();
      config.headers = config.headers || {};
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch {
      return config;
    }
  },
  (error) => Promise.reject(error)
);

let refreshPromise = null;

function refreshSessionOnce() {
  if (!refreshPromise) {
    const { store } = getStoreModule();
    const { refreshAdminSession } = getAdminSliceModule();

    refreshPromise = store
      .dispatch(refreshAdminSession())
      .then((resultAction) => refreshAdminSession.fulfilled.match(resultAction))
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

adminApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.error;
    const isRefreshCall = original?.url?.includes("/api/admin/auth/refresh");

    const shouldRefresh =
      status === 401 &&
      REFRESHABLE_CODES.has(code) &&
      original &&
      !original._retried &&
      !isRefreshCall;

    if (shouldRefresh) {
      original._retried = true;

      const refreshed = await refreshSessionOnce();

      if (refreshed) {
        return adminApi(original);
      }

      await clearTokens();
      const { store } = getStoreModule();
      const { resetAdminAuthState } = getAdminSliceModule();
      store.dispatch(resetAdminAuthState());
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default adminApi;