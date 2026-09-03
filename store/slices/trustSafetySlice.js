import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import adminApi from '../../lib/services/adminApi';

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const initialState = {
  actionLoading: {}, // keyed by report id
  actionError: {},
  lastAction: null, // { reportId, type, message } — for a one-shot success toast/banner
};

// PATCH /admin/reports/report/:reportId/resolve  { note? }
export const resolveReport = createAsyncThunk(
  'trustSafety/resolveReport',
  async ({ reportId, note }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/reports/report/${reportId}/resolve`, note ? { note } : {});
      return { reportId, message: data?.message || 'Report resolved' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to resolve report'));
    }
  }
);

// PATCH /admin/reports/report/:reportId/status  { status: 'open' | 'reviewing' | 'resolved' }
export const updateReportStatus = createAsyncThunk(
  'trustSafety/updateReportStatus',
  async ({ reportId, status }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/reports/report/${reportId}/status`, { status });
      return { reportId, message: data?.message || 'Report status updated' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to update report status'));
    }
  }
);

const trustSafetySlice = createSlice({
  name: 'trustSafety',
  initialState,
  reducers: {
    clearTrustSafetyMessages: (state) => {
      state.actionError = {};
      state.lastAction = null;
    },
  },
  extraReducers: (builder) => {
    [resolveReport, updateReportStatus].forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state, action) => {
          const id = action.meta.arg?.reportId;
          if (!id) return;
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          const { reportId, message } = action.payload;
          delete state.actionLoading[reportId];
          state.lastAction = { reportId, type: thunk.typePrefix.split('/')[1], message };
        })
        .addCase(thunk.rejected, (state, action) => {
          const id = action.meta.arg?.reportId;
          if (!id) return;
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Action failed';
        });
    });
  },
});

export const { clearTrustSafetyMessages } = trustSafetySlice.actions;

export const selectTrustSafetyActionLoading = (state) => state.trustSafety.actionLoading;
export const selectTrustSafetyActionError = (state) => state.trustSafety.actionError;
export const selectTrustSafetyLastAction = (state) => state.trustSafety.lastAction;

export default trustSafetySlice.reducer;