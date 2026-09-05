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
 *
 * This is the single place that tears down a dead session: it removes
 * the access/refresh tokens from the device (expo-secure-store), resets
 * the Redux admin auth state, and sends the admin back to the login
 * screen. Every path below that decides the session is really over
 * funnels through here.
 */
async function handleSessionExpired() {
  if (isRedirectingToLogin) {
    return;
  }

  isRedirectingToLogin = true;

  try {
    // Remove access/refresh tokens from the device.
    await clearTokens();

    // Reset Redux authentication state.
    const { store } = getStoreModule();
    const { resetAdminAuthState } = getAdminSliceModule();

    store.dispatch(resetAdminAuthState());

    // Navigate to login screen.
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
 * Endpoints an admin calls BEFORE they hold a valid admin-access token at
 * all — login, MFA verification, and password-reset requests. None of
 * these sit behind `protectAdmin`, so a 401 from one of them can never mean
 * "your access token expired" (there was no access token on the request in
 * the first place). It means something ordinary and expected instead —
 * wrong password, wrong/expired OTP, wrong/expired reset token — and
 * should just flow back to whichever screen/thunk made the call so it can
 * show that message. Treating it as a dead session here was the bug:
 * a wrong MFA code (401) triggered a doomed refresh attempt (there's no
 * session to refresh mid-login), which then ran full session-expiry
 * teardown — clearing the in-progress `challengeToken`/mfa state and
 * bouncing the admin back to the login screen after their very first
 * incorrect OTP attempt, before the mfa screen's own retry logic ever got
 * a chance to run.
 */
const PRE_AUTH_PATHS = [
  "/auth/login",
  "/auth/mfa/verify",
  "/auth/forgot-password",
  "/auth/reset-password",
];

const isPreAuthCall = (url) =>
  Boolean(url) && PRE_AUTH_PATHS.some((path) => url.includes(path));

/**
 * Handle API responses.
 *
 * `protectAdmin` (server/Middleware/adminAuthMiddleware.js) — the
 * middleware guarding every admin route — responds 401 as a plain
 * `{ success: false, message }` for EVERY auth failure it can hit:
 * no token, wrong token type, an expired/invalid/malformed token, an
 * inactive or deleted admin account, or a revoked session
 * (refreshTokenVersion mismatch). It never sends a discriminating
 * `error` code, so session-expiry detection here is keyed on the
 * HTTP status alone (401) rather than on a response-body code the
 * backend never sends — matching that middleware's real contract.
 */
adminApi.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    const status = error.response?.status;

    /**
     * Don't try to refresh the refresh endpoint itself.
     */
    const isRefreshCall =
      originalRequest?.url?.includes("/auth/refresh") ||
      originalRequest?.url?.includes("/api/admin/auth/refresh");

    /**
     * A 401 from login/mfa-verify/forgot-password/reset-password is a
     * normal rejection of that specific attempt, not a sign of a dead
     * session — skip the refresh/logout dance entirely and let it reject
     * straight back to the caller.
     */
    if (status === 401 && isPreAuthCall(originalRequest?.url)) {
      return Promise.reject(error);
    }

    /**
     * Any 401 from an admin-protected endpoint means the access
     * token this request sent is no longer usable — attempt a
     * refresh-and-retry once, as long as this request hasn't
     * already been retried and isn't the refresh call itself.
     */
    const shouldRefresh =
      status === 401 &&
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
       * Refresh failed (or didn't come back with a usable session).
       *
       * Session has expired completely.
       * Clear everything and send the admin to login.
       */
      await handleSessionExpired();

      return Promise.reject(error);
    }

    /**
     * If the refresh endpoint itself returns 401, refresh is no
     * longer possible — the session is fully dead.
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
