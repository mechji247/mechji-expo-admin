import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import adminApi from '../../lib/services/adminApi';

// Dedicated slice for the Services screen — mirrors productsSlice.js.
// fetchServices reuses the dashboard's existing list route (GET
// /admin/dashboard/services, already returns the right shape); the
// mutations below are dedicated to /admin/services/*.
//
// Real status enum (server/newSchemaModels/schemas/service/serviceSchema.js):
// status: 'draft' | 'pending' | 'active' | 'inactive' | 'in_progress' | 'rejected'
// "Verify" on the service detail screen means status -> 'active'; "Reject"
// means status -> 'rejected' (with an optional reason). Unlike products,
// the backend also keeps the schema's own verificationStatus sub-document
// (status/verifiedAt/rejetedAt/rejectionReason) in sync on every status
// change — see adminServicesControllers.js's updateServiceStatus.
//
// Pagination here is "load more", not infinite scroll: fetchServices takes
// an `append` flag so the reducer knows whether to replace `list` (new
// search/filter, or pull-to-refresh) or concat onto it (Load more button).

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const initialState = {
  list: [],
  pagination: { page: 1, limit: 20, totalPages: 1, total: 0 },
  loading: false, // initial/replace fetch (first page, refresh, filter change)
  loadingMore: false, // fetching the next page to append
  error: null,

  filters: { search: '', status: '' },

  actionLoading: {}, // keyed by service id — shared across status/remove/update/restore
  actionError: {}, // keyed by service id

  // Single-service admin detail view (service info screen).
  current: null,
  currentStatus: 'idle',
  currentError: null,
  currentSuccessMessage: null,
};

function getServiceId(service) {
  return service?._id || service?.id || null;
}

// GET /admin/dashboard/services?page=&limit=&search=&status=
// Pass `append: true` when this call is a "Load more" continuation rather
// than a fresh list (new filter/search, or pull-to-refresh).
export const fetchServices = createAsyncThunk(
  'services/fetchServices',
  async ({ append, ...params } = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get('/dashboard/services', { params });
      return {
        items: data?.items || [],
        pagination: data?.pagination || null,
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch services'));
    }
  }
);

// GET /admin/services/service/:serviceId — full admin detail view.
export const fetchServiceAdminView = createAsyncThunk(
  'services/fetchServiceAdminView',
  async (serviceId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get(`/services/service/${serviceId}`);
      return data?.service ?? data?.data ?? data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to load service details'));
    }
  }
);

// PATCH /admin/services/service/:serviceId — core detail edit.
export const updateServiceDetails = createAsyncThunk(
  'services/updateServiceDetails',
  async ({ serviceId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/services/service/${serviceId}`, payload);
      return {
        serviceId,
        service: data?.service ?? data?.data ?? null,
        message: data?.message || 'Service updated',
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to update service'));
    }
  }
);

// PATCH /admin/services/service/:serviceId/status  { status, reason? }
// status: 'active' (verify/go live) | 'rejected' (reject, reason optional)
// | 'draft' | 'pending' | 'inactive' | 'in_progress'
export const updateServiceStatus = createAsyncThunk(
  'services/updateServiceStatus',
  async ({ serviceId, status, reason }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/services/service/${serviceId}/status`, { status, reason });
      return {
        serviceId,
        service: data?.service || data?.data || null,
        fullService: data?.fullService || null,
        message: data?.message || 'Service status updated',
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to update service status'));
    }
  }
);

// DELETE /admin/services/service/:serviceId  (soft delete)
export const removeService = createAsyncThunk(
  'services/removeService',
  async (serviceId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.delete(`/services/service/${serviceId}`);
      return { serviceId, message: data?.message || 'Service removed' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to remove service'));
    }
  }
);

// PATCH /admin/services/service/:serviceId/restore  — undo removeService.
export const restoreService = createAsyncThunk(
  'services/restoreService',
  async (serviceId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/services/service/${serviceId}/restore`);
      return {
        serviceId,
        service: data?.service ?? data?.data ?? null,
        message: data?.message || 'Service restored',
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to restore service'));
    }
  }
);

const servicesSlice = createSlice({
  name: 'services',
  initialState,
  reducers: {
    setServicesSearch(state, action) {
      state.filters.search = action.payload || '';
    },
    setServicesStatusFilter(state, action) {
      state.filters.status = action.payload || '';
    },
    clearServicesMessages(state) {
      state.error = null;
      state.actionError = {};
    },
    clearCurrentService(state) {
      state.current = null;
      state.currentStatus = 'idle';
      state.currentError = null;
      state.currentSuccessMessage = null;
    },
    clearCurrentServiceMessage(state) {
      state.currentSuccessMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchServices.pending, (state, action) => {
        if (action.meta.arg?.append) {
          state.loadingMore = true;
        } else {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchServices.fulfilled, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.list = action.meta.arg?.append ? [...state.list, ...action.payload.items] : action.payload.items;
        if (action.payload.pagination) {
          state.pagination = { ...state.pagination, ...action.payload.pagination };
        }
      })
      .addCase(fetchServices.rejected, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.error = action.payload || 'Failed to fetch services';
      })

      // FETCH SINGLE SERVICE
      .addCase(fetchServiceAdminView.pending, (state) => {
        state.currentStatus = 'loading';
        state.currentError = null;
      })
      .addCase(fetchServiceAdminView.fulfilled, (state, action) => {
        state.currentStatus = 'succeeded';
        state.current = action.payload;
      })
      .addCase(fetchServiceAdminView.rejected, (state, action) => {
        state.currentStatus = 'failed';
        state.currentError = action.payload || 'Failed to load service details';
      })

      // UPDATE SERVICE DETAILS
      .addCase(updateServiceDetails.pending, (state, action) => {
        const id = action.meta.arg?.serviceId;
        if (id) {
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        }
      })
      .addCase(updateServiceDetails.fulfilled, (state, action) => {
        const { serviceId, service, message } = action.payload;
        delete state.actionLoading[serviceId];
        if (service) {
          if (state.current && getServiceId(state.current) === serviceId) {
            state.current = service;
          }
          const idx = state.list.findIndex((s) => getServiceId(s) === serviceId);
          if (idx !== -1) state.list[idx] = { ...state.list[idx], ...service };
        }
        state.currentSuccessMessage = message;
      })
      .addCase(updateServiceDetails.rejected, (state, action) => {
        const id = action.meta.arg?.serviceId;
        if (id) {
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Failed to update service';
        }
      })

      // UPDATE STATUS (verify / reject / etc.)
      .addCase(updateServiceStatus.pending, (state, action) => {
        const id = action.meta.arg?.serviceId;
        if (id) {
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        }
      })
      .addCase(updateServiceStatus.fulfilled, (state, action) => {
        const { serviceId, service, fullService, message } = action.payload;
        delete state.actionLoading[serviceId];
        if (service) {
          const idx = state.list.findIndex((s) => getServiceId(s) === serviceId);
          if (idx !== -1) state.list[idx] = service;
        }
        if (state.current && getServiceId(state.current) === serviceId) {
          state.current = fullService || { ...state.current, ...(service || {}) };
        }
        state.currentSuccessMessage = message;
      })
      .addCase(updateServiceStatus.rejected, (state, action) => {
        const id = action.meta.arg?.serviceId;
        if (id) {
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Failed to update service status';
        }
      })

      // SOFT DELETE
      .addCase(removeService.pending, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        }
      })
      .addCase(removeService.fulfilled, (state, action) => {
        const { serviceId, message } = action.payload;
        delete state.actionLoading[serviceId];
        state.list = state.list.filter((s) => getServiceId(s) !== serviceId);
        if (state.current && getServiceId(state.current) === serviceId) {
          state.current.isDeleted = true;
          state.current.status = 'inactive';
        }
        state.currentSuccessMessage = message;
      })
      .addCase(removeService.rejected, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Failed to remove service';
        }
      })

      // RESTORE
      .addCase(restoreService.pending, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        }
      })
      .addCase(restoreService.fulfilled, (state, action) => {
        const { serviceId, service, message } = action.payload;
        delete state.actionLoading[serviceId];
        if (state.current && getServiceId(state.current) === serviceId) {
          state.current = service || { ...state.current, isDeleted: false, status: 'inactive' };
        }
        state.currentSuccessMessage = message;
      })
      .addCase(restoreService.rejected, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Failed to restore service';
        }
      });
  },
});

export const {
  setServicesSearch,
  setServicesStatusFilter,
  clearServicesMessages,
  clearCurrentService,
  clearCurrentServiceMessage,
} = servicesSlice.actions;

export const selectServicesList = (state) => state.services.list;
export const selectServicesPagination = (state) => state.services.pagination;
export const selectServicesHasMore = (state) =>
  state.services.pagination.page < state.services.pagination.totalPages;
export const selectServicesLoading = (state) => state.services.loading;
export const selectServicesLoadingMore = (state) => state.services.loadingMore;
export const selectServicesError = (state) => state.services.error;
export const selectServicesFilters = (state) => state.services.filters;
export const selectServiceActionLoading = (state) => state.services.actionLoading;
export const selectServiceActionError = (state) => state.services.actionError;

export const selectCurrentService = (state) => state.services.current;
export const selectCurrentServiceStatus = (state) => state.services.currentStatus;
export const selectCurrentServiceError = (state) => state.services.currentError;
export const selectCurrentServiceSuccessMessage = (state) => state.services.currentSuccessMessage;

export { getServiceId };

export default servicesSlice.reducer;
