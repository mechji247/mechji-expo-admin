import { createAsyncThunk, createSelector, createSlice } from "@reduxjs/toolkit";
import { supportApi, supportErrorMessage } from "../../lib/support/supportApi";

// Support desk state shared across the Support Management pages: the
// agent's own profile + desk metadata (labels, outcomes, policies — all from
// the server), inbox counts for badges, the current inbox page, and live
// in-app notifications pushed over the /support-agents socket.
// Ticket workspaces keep their own local state (see app/support/[id].js).
// Same slice as mechji-admin-web's supportDeskSlice.

const EMPTY = Object.freeze([]);

export const fetchSupportMeta = createAsyncThunk("supportDesk/meta", async (_, { rejectWithValue }) => {
  try { return await supportApi.meta(); } catch (error) { return rejectWithValue(supportErrorMessage(error, "Could not load the support desk.")); }
}, { condition: (_, { getState }) => !["loading", "succeeded"].includes(getState().supportDesk.metaStatus) });

export const refreshSupportMeta = createAsyncThunk("supportDesk/metaRefresh", async (_, { rejectWithValue }) => {
  try { return await supportApi.meta(); } catch (error) { return rejectWithValue(supportErrorMessage(error)); }
});

export const fetchInboxCounts = createAsyncThunk("supportDesk/counts", async (_, { rejectWithValue }) => {
  try { return await supportApi.inboxCounts(); } catch (error) { return rejectWithValue(supportErrorMessage(error)); }
});

export const fetchInbox = createAsyncThunk("supportDesk/inbox", async ({ params, more = false }, { getState, rejectWithValue }) => {
  try {
    const state = getState().supportDesk.inbox;
    const query = { ...params };
    if (more && state.nextCursor) {
      if (String(state.nextCursor).startsWith("page:")) query.page = state.nextCursor.slice(5);
      else query.cursor = state.nextCursor;
    }
    const result = await supportApi.listTickets(query);
    return { ...result, key: JSON.stringify(params), more };
  } catch (error) {
    return rejectWithValue(supportErrorMessage(error, "Could not load tickets."));
  }
});

const initialState = {
  meta: null,
  metaStatus: "idle",
  metaError: null,
  counts: {},
  unreadTickets: 0,
  inbox: { key: null, tickets: EMPTY, nextCursor: null, hasMore: false, status: "idle", error: null },
  notifications: EMPTY,
};

const supportDeskSlice = createSlice({
  name: "supportDesk",
  initialState,
  reducers: {
    // Live summary from the socket: update the row if it is on the page.
    ticketSummaryReceived(state, { payload }) {
      const t = payload?.ticket;
      if (!t?._id) return;
      const i = state.inbox.tickets.findIndex((x) => x._id === t._id);
      if (i >= 0) state.inbox.tickets[i] = { ...state.inbox.tickets[i], ...t };
    },
    ticketCreatedReceived(state, { payload }) {
      const t = payload?.ticket;
      if (!t?._id || state.inbox.tickets.some((x) => x._id === t._id)) return;
      // New tickets appear at the top of activity-sorted inboxes.
      if (state.inbox.key && JSON.parse(state.inbox.key).sort && JSON.parse(state.inbox.key).sort !== "last_activity") return;
      state.inbox.tickets = [t, ...state.inbox.tickets];
    },
    notificationReceived(state, { payload }) {
      const n = { ...payload, id: `${payload.ticketId}-${payload.eventType}-${payload.at}` };
      if (state.notifications.some((x) => x.id === n.id)) return;
      state.notifications = [n, ...state.notifications].slice(0, 30);
    },
    notificationDismissed(state, { payload }) {
      state.notifications = state.notifications.filter((n) => n.id !== payload);
    },
    notificationsCleared(state) { state.notifications = EMPTY; },
    supportDeskReset() { return initialState; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSupportMeta.pending, (s) => { s.metaStatus = "loading"; s.metaError = null; })
      .addCase(fetchSupportMeta.fulfilled, (s, a) => { s.metaStatus = "succeeded"; s.meta = a.payload; })
      .addCase(fetchSupportMeta.rejected, (s, a) => { s.metaStatus = "failed"; s.metaError = a.payload || "Could not load the support desk."; })
      .addCase(refreshSupportMeta.fulfilled, (s, a) => { s.meta = a.payload; s.metaStatus = "succeeded"; })
      .addCase(fetchInboxCounts.fulfilled, (s, a) => { s.counts = a.payload?.counts || {}; s.unreadTickets = a.payload?.unreadTickets || 0; })
      .addCase(fetchInbox.pending, (s, a) => {
        const key = JSON.stringify(a.meta.arg.params);
        if (a.meta.arg.more) s.inbox.status = "loadingMore";
        else s.inbox = { key, tickets: s.inbox.key === key ? s.inbox.tickets : EMPTY, nextCursor: null, hasMore: false, status: "loading", error: null };
      })
      .addCase(fetchInbox.fulfilled, (s, a) => {
        if (a.payload.key !== s.inbox.key) return; // a newer query replaced this one
        const rows = a.payload.tickets || [];
        if (a.payload.more) {
          const seen = new Set(s.inbox.tickets.map((t) => t._id));
          s.inbox.tickets = [...s.inbox.tickets, ...rows.filter((t) => !seen.has(t._id))];
        } else s.inbox.tickets = rows;
        s.inbox.nextCursor = a.payload.nextCursor;
        s.inbox.hasMore = Boolean(a.payload.hasMore);
        s.inbox.status = "succeeded";
      })
      .addCase(fetchInbox.rejected, (s, a) => {
        if (JSON.stringify(a.meta.arg.params) !== s.inbox.key) return;
        s.inbox.status = "failed";
        s.inbox.error = a.payload || "Could not load tickets.";
      });
  },
});

export const {
  ticketSummaryReceived, ticketCreatedReceived, notificationReceived, notificationDismissed, notificationsCleared, supportDeskReset,
} = supportDeskSlice.actions;
export default supportDeskSlice.reducer;

const root = (s) => s.supportDesk;
export const selectSupportMeta = (s) => root(s).meta;
export const selectSupportMetaStatus = (s) => root(s).metaStatus;
export const selectSupportMetaError = (s) => root(s).metaError;
export const selectSupportMe = (s) => root(s).meta?.me || null;
export const selectInbox = (s) => root(s).inbox;
export const selectInboxCounts = (s) => root(s).counts;
export const selectSupportUnreadTickets = (s) => root(s).unreadTickets;
export const selectSupportNotifications = (s) => root(s).notifications;
const selectCaps = (s) => root(s).meta?.me?.capabilities || EMPTY;
export const selectSupportCaps = createSelector([selectCaps], (caps) => new Set(caps));
