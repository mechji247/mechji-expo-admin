import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import adminApi from '../../lib/services/adminApi';

// Backs app/staff.js (currently rendering MOCK_STAFF as static
// placeholder data since no endpoint existed). Endpoint paths below are
// a best guess following this project's existing `/plural/singular/:id`
// convention (e.g. adminVendorSlice's `/vendors/vendor/:id`) — confirm
// against the real backend and adjust the URLs (not the thunk shapes)
// once it exists.

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const initialState = {
  list: [],
  pagination: { page: 1, limit: 20, totalPages: 1, total: 0 },

  loading: false,
  actionLoading: {}, // keyed by staff id, e.g. { [id]: 'dutyStatus' }
  actionError: {}, // keyed by staff id

  error: null,
};

// GET /admin/vendor-staff?search=&duty=&page=&limit=
export const fetchVendorStaff = createAsyncThunk(
  'vendorStaff/fetchVendorStaff',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get('/vendor-staff', { params });
      return {
        items: data?.items || data?.staff || [],
        pagination: data?.pagination || null,
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch vendor staff'));
    }
  }
);

// PATCH /admin/vendor-staff/staff/:staffId/duty-status  { dutyStatus: 'on' | 'off' }
export const updateStaffDutyStatus = createAsyncThunk(
  'vendorStaff/updateStaffDutyStatus',
  async ({ staffId, dutyStatus }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/vendor-staff/staff/${staffId}/duty-status`, { dutyStatus });
      return { staffId, staff: data?.staff || null, message: data?.message || 'Duty status updated' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to update duty status'));
    }
  }
);

// PATCH /admin/vendor-staff/staff/:staffId/kyc  { decision: 'approve' | 'reject' }
export const reviewStaffKyc = createAsyncThunk(
  'vendorStaff/reviewStaffKyc',
  async ({ staffId, decision }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/vendor-staff/staff/${staffId}/kyc`, { decision });
      return { staffId, staff: data?.staff || null, message: data?.message || 'KYC decision recorded' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to record KYC decision'));
    }
  }
);

function getStaffId(staff) {
  return staff?._id || staff?.id || null;
}

const vendorStaffSlice = createSlice({
  name: 'vendorStaff',
  initialState,
  reducers: {
    clearVendorStaffMessages: (state) => {
      state.error = null;
      state.actionError = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVendorStaff.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVendorStaff.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.items;
        if (action.payload.pagination) {
          state.pagination = { ...state.pagination, ...action.payload.pagination };
        }
      })
      .addCase(fetchVendorStaff.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch vendor staff';
      });

    [updateStaffDutyStatus, reviewStaffKyc].forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state, action) => {
          const id = action.meta.arg?.staffId;
          if (!id) return;
          state.actionLoading[id] = thunk.typePrefix.split('/')[1];
          state.actionError[id] = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          const { staffId, staff } = action.payload;
          delete state.actionLoading[staffId];
          if (staff) {
            const idx = state.list.findIndex((s) => getStaffId(s) === staffId);
            if (idx !== -1) state.list[idx] = staff;
          }
        })
        .addCase(thunk.rejected, (state, action) => {
          const id = action.meta.arg?.staffId;
          if (!id) return;
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Action failed';
        });
    });
  },
});

export const { clearVendorStaffMessages } = vendorStaffSlice.actions;

export const selectVendorStaffList = (state) => state.vendorStaff.list;
export const selectVendorStaffPagination = (state) => state.vendorStaff.pagination;
export const selectVendorStaffLoading = (state) => state.vendorStaff.loading;
export const selectVendorStaffError = (state) => state.vendorStaff.error;
export const selectVendorStaffActionLoading = (state) => state.vendorStaff.actionLoading;
export const selectVendorStaffActionError = (state) => state.vendorStaff.actionError;

export { getStaffId };

export default vendorStaffSlice.reducer;