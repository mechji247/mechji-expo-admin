import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import adminApi from '../../lib/services/adminApi';

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const initialState = {
  // Keyed by audience so switching tabs doesn't refetch/clobber the
  // other tabs' already-loaded lists.
  lists: { users: [], vendors: [], admins: [] },
  loading: { users: false, vendors: false, admins: false },
  errors: { users: null, vendors: null, admins: null },

  sendLoading: false,
  sendError: null,
};

// GET /admin/notifications?audience=users|vendors|admins&page=&limit=
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async ({ audience, ...params } = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get('/notifications', { params: { audience, ...params } });
      return { audience, items: data?.items || data?.notifications || [] };
    } catch (error) {
      return rejectWithValue({
        audience,
        message: getErrorMessage(error, 'Failed to fetch notifications'),
      });
    }
  }
);

// POST /admin/notifications  { audience, title, body, targetId? }
export const sendNotification = createAsyncThunk(
  'notifications/sendNotification',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.post('/notifications', payload);
      return {
        audience: payload?.audience,
        notification: data?.notification || null,
        message: data?.message || 'Notification sent',
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to send notification'));
    }
  }
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearNotificationsMessages: (state) => {
      state.errors = { users: null, vendors: null, admins: null };
      state.sendError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state, action) => {
        const audience = action.meta.arg?.audience;
        if (audience) {
          state.loading[audience] = true;
          state.errors[audience] = null;
        }
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        const { audience, items } = action.payload;
        if (audience) {
          state.loading[audience] = false;
          state.lists[audience] = items;
        }
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        const { audience, message } = action.payload || {};
        if (audience) {
          state.loading[audience] = false;
          state.errors[audience] = message || 'Failed to fetch notifications';
        }
      })

      .addCase(sendNotification.pending, (state) => {
        state.sendLoading = true;
        state.sendError = null;
      })
      .addCase(sendNotification.fulfilled, (state, action) => {
        state.sendLoading = false;
        const { audience, notification } = action.payload;
        if (audience && notification && state.lists[audience]) {
          state.lists[audience].unshift(notification);
        }
      })
      .addCase(sendNotification.rejected, (state, action) => {
        state.sendLoading = false;
        state.sendError = action.payload || 'Failed to send notification';
      });
  },
});

export const { clearNotificationsMessages } = notificationsSlice.actions;

export const selectNotificationsLists = (state) => state.notifications.lists;
export const selectNotificationsLoading = (state) => state.notifications.loading;
export const selectNotificationsErrors = (state) => state.notifications.errors;
export const selectNotificationSendLoading = (state) => state.notifications.sendLoading;
export const selectNotificationSendError = (state) => state.notifications.sendError;

export default notificationsSlice.reducer;