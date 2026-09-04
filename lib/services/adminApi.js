import axios from "axios";
import { backendUrl } from "../utils/env";
import { clearTokens, getAccessToken } from "../tokens/secureTokens";
import { router } from "expo-router";

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

/**
 * Errors that mean the access token is no longer usable.
 */
const REFRESHABLE_CODES = new Set([
  "MISSING_TOKEN",
  "TOKEN_EXPIRED",
  "INVALID_TOKEN",
  "INVALID_TOKEN_TYPE",
]);

/**
 * Prevent multiple refresh requests at the same time.
 */
let refreshPromise = null;

/**
 * Prevent multiple redirects to login.
 */
let isRedirectingToLogin = false;

/**
 * Attach access token to every request.
 */
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

/**
 * Refresh admin session only once.
 *
 * If 5 requests fail at the same time, only ONE refresh
 * request will be sent. The other requests wait for it.
 */
function refreshSessionOnce() {
  if (!refreshPromise) {
    const { store } = getStoreModule();
    const { refreshAdminSession } = getAdminSliceModule();

    refreshPromise = store
      .dispatch(refreshAdminSession())
      .then((resultAction) => {
        return refreshAdminSession.fulfilled.match(resultAction);
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

/**
 * Logout admin and navigate to login screen.
 */
async function handleSessionExpired() {
  if (isRedirectingToLogin) {
    return;
  }

  isRedirectingToLogin = true;

  try {
    // Remove access/refresh tokens
    await clearTokens();

    // Reset Redux authentication state
    const { store } = getStoreModule();
    const { resetAdminAuthState } = getAdminSliceModule();

    store.dispatch(resetAdminAuthState());

    // Navigate to login screen
    router.replace("/login");
  } catch (error) {
    console.error("Session expiry handling failed:", error);
  } finally {
    // Small delay allows navigation state to settle.
    setTimeout(() => {
      isRedirectingToLogin = false;
    }, 500);
  }
}

/**
 * Handle API responses.
 */
adminApi.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    const status = error.response?.status;
    const code = error.response?.data?.error;

    /**
     * Don't try to refresh the refresh endpoint itself.
     */
    const isRefreshCall =
      originalRequest?.url?.includes("/auth/refresh") ||
      originalRequest?.url?.includes("/api/admin/auth/refresh");

    /**
     * Determine whether this request should attempt token refresh.
     */
    const shouldRefresh =
      status === 401 &&
      REFRESHABLE_CODES.has(code) &&
      originalRequest &&
      !originalRequest._retried &&
      !isRefreshCall;

    /**
     * Try refreshing the session.
     */
    if (shouldRefresh) {
      originalRequest._retried = true;

      try {
        const refreshed = await refreshSessionOnce();

        if (refreshed) {
          /**
           * Token was refreshed successfully.
           * Retry the original request.
           *
           * The request interceptor will automatically
           * attach the new access token.
           */
          return adminApi(originalRequest);
        }
      } catch (refreshError) {
        console.error("Session refresh failed:", refreshError);
      }

      /**
       * Refresh failed.
       *
       * Session has expired completely.
       * Clear everything and send user to login.
       */
      await handleSessionExpired();

      return Promise.reject(error);
    }

    /**
     * If refresh endpoint itself returns 401,
     * refresh is no longer possible.
     *
     * Immediately logout and redirect.
     */
    if (status === 401 && isRefreshCall) {
      await handleSessionExpired();

      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default adminApi;
