import { AppState } from "react-native";
import { io } from "socket.io-client";
import { backendUrl } from "../utils/env";
import { getAccessToken, saveTokens } from "../tokens/secureTokens";

// One Socket.IO connection to the server's /support-agents namespace — the
// same agent channel mechji-admin-web uses. The app authenticates with its
// admin access token (handshake `auth.token`); the SERVER decides which
// queue rooms the agent joins and re-checks access on every ticket join.
//
// Components subscribe with onSupportEvent(event, fn) and get an unsubscribe
// function back; open tickets are re-joined automatically after a reconnect.
const EVENTS = [
  "support:message:new", "support:status_updated", "support:ticket:new", "support:ticket:updated",
  "support:assigned", "support:escalated", "support:resolved", "support:presence", "support:typing",
  "support:sla", "support:notification", "support:read",
];

let socket = null;
let refreshing = false;
let appStateSub = null;
const listeners = new Map();
const joined = new Set();
const status = { connected: false };
const statusListeners = new Set();

const setConnected = (value) => {
  status.connected = value;
  for (const fn of statusListeners) fn(value);
};

function dispatchEvent(event, payload) {
  for (const fn of listeners.get(event) || []) {
    try { fn(payload); } catch (error) { console.warn("[support socket]", event, error?.message); }
  }
}

// Lazy require avoids a store → slice → socket import cycle.
async function refreshAccessToken() {
  const { store } = require("../../store/store");
  const { refreshAdminSession } = require("../../store/slices/adminSlice");
  const result = await store.dispatch(refreshAdminSession());
  if (!refreshAdminSession.fulfilled.match(result)) return null;
  const { accessToken, refreshToken } = result.payload || {};
  if (accessToken) await saveTokens({ accessToken, refreshToken });
  return accessToken || (await getAccessToken());
}

export async function connectSupportSocket() {
  if (socket || !backendUrl) return socket;
  const token = await getAccessToken();
  if (!token || socket) return socket;
  socket = io(`${backendUrl}/support-agents`, {
    auth: (cb) => { getAccessToken().then((t) => cb({ token: t })).catch(() => cb({})); },
    transports: ["websocket"],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  socket.on("connect", () => {
    setConnected(true);
    socket.emit("app:state", { active: AppState.currentState === "active" });
    for (const ticketId of joined) socket.emit("support:join", { ticketId }, () => {});
  });
  socket.on("disconnect", () => setConnected(false));
  socket.on("connect_error", async (error) => {
    setConnected(false);
    // An expired access token: refresh the session once, then reconnect.
    if (!/Authentication error/i.test(error?.message || "") || refreshing) return;
    refreshing = true;
    try {
      const fresh = await refreshAccessToken();
      if (fresh) socket?.connect();
    } catch {
      /* the app's session handling sends the admin to login */
    } finally {
      refreshing = false;
    }
  });
  for (const event of EVENTS) socket.on(event, (payload) => dispatchEvent(event, payload));
  // Presence: "viewing" only counts while the app is in the foreground.
  appStateSub = AppState.addEventListener("change", (state) => {
    if (socket?.connected) socket.emit("app:state", { active: state === "active" });
    else if (state === "active") socket?.connect();
  });
  return socket;
}

export function disconnectSupportSocket() {
  appStateSub?.remove();
  appStateSub = null;
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  joined.clear();
  setConnected(false);
}

export function onSupportEvent(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

export function onConnectionChange(fn) {
  statusListeners.add(fn);
  fn(status.connected);
  return () => statusListeners.delete(fn);
}

const ack = (event, payload, timeoutMs = 8000) => new Promise((resolve) => {
  if (!socket?.connected) return resolve(null);
  socket.timeout(timeoutMs).emit(event, payload, (err, res) => resolve(err ? null : res));
});

/** Join a ticket room (presence, live updates). Resolves with the ack or null. */
export function joinTicket(ticketId) {
  joined.add(ticketId);
  return ack("support:join", { ticketId });
}

export function leaveTicket(ticketId) {
  joined.delete(ticketId);
  socket?.emit("support:leave", { ticketId });
}

export function sendTyping(ticketId, typing, channel) {
  if (socket?.connected) socket.emit("support:typing", { ticketId, typing, channel });
}

/**
 * Sends over the socket when connected; resolves null (caller falls back to
 * REST with the SAME clientMessageId, which the server de-duplicates).
 * A server-side rejection is thrown so the UI can show the reason.
 */
export async function socketSendMessage(payload) {
  const res = await ack("support:message", payload, 10000);
  if (!res) return null;
  if (res.success) return res.data;
  if (["RATE_LIMITED", "INVALID_REQUEST", "SUPPORT_ERROR"].includes(res.error)) return null;
  const error = new Error(res.message || "Message was not sent");
  error.response = { data: { message: res.message, error: res.error } };
  throw error;
}
