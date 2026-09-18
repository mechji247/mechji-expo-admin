import { createAsyncThunk, createSlice, createSelector } from '@reduxjs/toolkit';
import adminApi from '../../lib/services/adminApi';

// The admin's OWN notification inbox — GET/PATCH/DELETE against
// /admin/notifications/inbox/* (server/controllers/admin/notifications/
// adminInbox.controller.js), scoped server-side to req.admin._id
// (protectAdmin), never a client-supplied id. Deliberately separate from
// notificationsSlice.js, which backs the audience-tabbed broadcast/outbox
// screen at app/notifications.js — see that slice's own comment. This is
// "what did I, this admin, receive", not "what did I send".
//
// Cursor-based (createdAt cursor, newest-first, hasMore/nextCursor) to
// match the backend's actual response shape — mirrors
// mechji-admin-web's adminNotificationInboxSlice.js (same backend
// contract, same shape) and the vendor/customer apps' equivalent slices'
// conventions (optimistic count updates, condition-guarded thunks).

const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

const PAGE_SIZE = 20;

const initialState = {
  notifications: [],
  unreadCount: 0,
  filter: 'all', // 'all' | 'unread'
  loading: false,
  loadingMore: false,
  refreshing: false,
  hasMore: false,
  cursor: null,
  error: null,
  markingAllAsRead: false,
};

// GET /admin/notifications/inbox?limit=&isRead=  (fresh load / filter change / pull-to-refresh)
export const fetchNotifications = createAsyncThunk(
  'adminNotificationInbox/fetch',
  async ({ unreadOnly = false, refresh = false } = {}, { rejectWithValue }) => {
    try {
      const params = { limit: PAGE_SIZE };
      if (unreadOnly) params.isRead = 'false';
      const { data } = await adminApi.get('/notifications/inbox', { params });
      return { ...data.data, unreadOnly, refresh };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to load notifications'));
    }
  },
  {
    // Never stack a second full reload (initial load, filter switch, or
    // pull-to-refresh) on top of one already in flight.
    condition: (_, { getState }) => {
      const s = getState().adminNotificationInbox;
      return !s.loading && !s.refreshing;
    },
  }
);

// GET /admin/notifications/inbox?limit=&cursor=&isRead=  (next page — FlatList onEndReached)
export const fetchMoreNotifications = createAsyncThunk(
  'adminNotificationInbox/fetchMore',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { cursor, filter } = getState().adminNotificationInbox;
      const params = { limit: PAGE_SIZE };
      if (cursor) params.cursor = cursor;
      if (filter === 'unread') params.isRead = 'false';
      const { data } = await adminApi.get('/notifications/inbox', { params });
      return data.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to load more notifications'));
    }
  },
  {
    // Never issue a second page request while one is in flight, and never
    // fetch past the point the server already said there's no more —
    // guards against FlatList firing onEndReached repeatedly.
    condition: (_, { getState }) => {
      const s = getState().adminNotificationInbox;
      return !s.loadingMore && !s.loading && !s.refreshing && s.hasMore;
    },
  }
);

// GET /admin/notifications/inbox/unread-count — cheap, used for the Home
// tab bell and pushed to on every foreground push arrival, without ever
// pulling the full list.
export const fetchUnreadCount = createAsyncThunk(
  'adminNotificationInbox/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get('/notifications/inbox/unread-count');
      return data.data.total;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to load unread count'));
    }
  }
);

// PATCH /admin/notifications/inbox/:id/read
export const markNotificationAsRead = createAsyncThunk(
  'adminNotificationInbox/markAsRead',
  async (notificationId, { getState, rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/notifications/inbox/${notificationId}/read`, {});
      if (!data.success) return rejectWithValue('Failed to mark as read');
      // No updated count is echoed back — derive it locally instead of a
      // second round trip (same convention as the other role apps).
      const current = getState().adminNotificationInbox;
      const target = current.notifications.find((n) => n._id === notificationId);
      const unreadCount = target && !target.isRead ? Math.max(0, current.unreadCount - 1) : current.unreadCount;
      return { notificationId, unreadCount };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to mark as read'));
    }
  }
);

// PATCH /admin/notifications/inbox/read-all
export const markAllNotificationsAsRead = createAsyncThunk(
  'adminNotificationInbox/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch('/notifications/inbox/read-all', {});
      if (!data.success) return rejectWithValue('Failed to mark all as read');
      return null;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to mark all as read'));
    }
  }
);

// DELETE /admin/notifications/inbox/:id
export const deleteNotification = createAsyncThunk(
  'adminNotificationInbox/delete',
  async (notificationId, { getState, rejectWithValue }) => {
    try {
      const { data } = await adminApi.delete(`/notifications/inbox/${notificationId}`);
      if (!data.success) return rejectWithValue('Failed to delete notification');
      const current = getState().adminNotificationInbox;
      const target = current.notifications.find((n) => n._id === notificationId);
      const unreadCount = target && !target.isRead ? Math.max(0, current.unreadCount - 1) : current.unreadCount;
      return { notificationId, unreadCount };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to delete notification'));
    }
  }
);

const adminNotificationInboxSlice = createSlice({
  name: 'adminNotificationInbox',
  initialState,
  reducers: {
    clearAdminNotificationInboxError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state, action) => {
        if (action.meta.arg?.refresh) state.refreshing = true;
        else state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.refreshing = false;
        state.notifications = action.payload.notifications;
        state.hasMore = action.payload.hasMore;
        state.cursor = action.payload.nextCursor;
        state.filter = action.payload.unreadOnly ? 'unread' : 'all';
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.refreshing = false;
        if (action.payload) state.error = action.payload;
      })

      .addCase(fetchMoreNotifications.pending, (state) => { state.loadingMore = true; state.error = null; })
      .addCase(fetchMoreNotifications.fulfilled, (state, action) => {
        state.loadingMore = false;
        const existingIds = new Set(state.notifications.map((n) => n._id));
        state.notifications.push(...action.payload.notifications.filter((n) => !existingIds.has(n._id)));
        state.hasMore = action.payload.hasMore;
        state.cursor = action.payload.nextCursor;
      })
      .addCase(fetchMoreNotifications.rejected, (state, action) => {
        state.loadingMore = false;
        if (action.payload) state.error = action.payload;
      })

      .addCase(fetchUnreadCount.fulfilled, (state, action) => { state.unreadCount = action.payload; })

      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        const n = state.notifications.find((n) => n._id === action.payload.notificationId);
        if (n && !n.isRead) { n.isRead = true; n.readAt = new Date().toISOString(); }
        state.unreadCount = action.payload.unreadCount;
      })

      .addCase(markAllNotificationsAsRead.pending, (state) => { state.markingAllAsRead = true; state.error = null; })
      .addCase(markAllNotificationsAsRead.fulfilled, (state) => {
        state.markingAllAsRead = false;
        const now = new Date().toISOString();
        state.notifications.forEach((n) => { if (!n.isRead) { n.isRead = true; n.readAt = now; } });
        state.unreadCount = 0;
      })
      .addCase(markAllNotificationsAsRead.rejected, (state, action) => {
        state.markingAllAsRead = false;
        if (action.payload) state.error = action.payload;
      })

      .addCase(deleteNotification.fulfilled, (state, action) => {
        state.notifications = state.notifications.filter((n) => n._id !== action.payload.notificationId);
        state.unreadCount = action.payload.unreadCount;
      });
  },
});

export const { clearAdminNotificationInboxError } = adminNotificationInboxSlice.actions;

const selectSlice = (state) => state.adminNotificationInbox;
export const selectAdminNotifications = createSelector([selectSlice], (s) => s.notifications);
export const selectAdminNotificationUnreadCount = createSelector([selectSlice], (s) => s.unreadCount);
export const selectAdminNotificationFilter = createSelector([selectSlice], (s) => s.filter);
export const selectAdminNotificationLoading = createSelector([selectSlice], (s) => s.loading);
export const selectAdminNotificationRefreshing = createSelector([selectSlice], (s) => s.refreshing);
export const selectAdminNotificationLoadingMore = createSelector([selectSlice], (s) => s.loadingMore);
export const selectAdminNotificationHasMore = createSelector([selectSlice], (s) => s.hasMore);
export const selectAdminNotificationError = createSelector([selectSlice], (s) => s.error);
export const selectAdminNotificationMarkingAllAsRead = createSelector([selectSlice], (s) => s.markingAllAsRead);

export default adminNotificationInboxSlice.reducer;
