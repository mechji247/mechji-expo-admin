import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import adminApi from '../../lib/services/adminApi';

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const initialState = {
  plans: [],
  plansLoading: false,
  plansError: null,

  vendorSubscriptions: [],
  vendorSubscriptionsPagination: { page: 1, limit: 20, totalPages: 1, total: 0 },
  vendorSubscriptionsLoading: false,
  vendorSubscriptionsError: null,

  planActionLoading: {}, // keyed by plan id
  planActionError: {},
};

// GET /admin/subscriptions/plans
export const fetchSubscriptionPlans = createAsyncThunk(
  'subscriptions/fetchSubscriptionPlans',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get('/subscriptions/plans');
      return data?.plans || data?.items || [];
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch subscription plans'));
    }
  }
);

// PATCH /admin/subscriptions/plans/plan/:planId  { price, vendorLimit, ... }
export const updateSubscriptionPlan = createAsyncThunk(
  'subscriptions/updateSubscriptionPlan',
  async ({ planId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/subscriptions/plans/plan/${planId}`, payload);
      return { planId, plan: data?.plan || null, message: data?.message || 'Plan updated' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to update plan'));
    }
  }
);

// GET /admin/subscriptions/vendor-subscriptions?status=&search=&page=&limit=
export const fetchVendorSubscriptions = createAsyncThunk(
  'subscriptions/fetchVendorSubscriptions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get('/subscriptions/vendor-subscriptions', { params });
      return {
        items: data?.items || data?.subscriptions || [],
        pagination: data?.pagination || null,
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch vendor subscriptions'));
    }
  }
);

const subscriptionsSlice = createSlice({
  name: 'subscriptions',
  initialState,
  reducers: {
    clearSubscriptionsMessages: (state) => {
      state.plansError = null;
      state.vendorSubscriptionsError = null;
      state.planActionError = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSubscriptionPlans.pending, (state) => {
        state.plansLoading = true;
        state.plansError = null;
      })
      .addCase(fetchSubscriptionPlans.fulfilled, (state, action) => {
        state.plansLoading = false;
        state.plans = action.payload;
      })
      .addCase(fetchSubscriptionPlans.rejected, (state, action) => {
        state.plansLoading = false;
        state.plansError = action.payload || 'Failed to fetch subscription plans';
      })

      .addCase(updateSubscriptionPlan.pending, (state, action) => {
        const id = action.meta.arg?.planId;
        if (id) {
          state.planActionLoading[id] = true;
          state.planActionError[id] = null;
        }
      })
      .addCase(updateSubscriptionPlan.fulfilled, (state, action) => {
        const { planId, plan } = action.payload;
        delete state.planActionLoading[planId];
        if (plan) {
          const idx = state.plans.findIndex((p) => (p._id || p.id) === planId);
          if (idx !== -1) state.plans[idx] = plan;
        }
      })
      .addCase(updateSubscriptionPlan.rejected, (state, action) => {
        const id = action.meta.arg?.planId;
        if (id) {
          delete state.planActionLoading[id];
          state.planActionError[id] = action.payload || 'Failed to update plan';
        }
      })

      .addCase(fetchVendorSubscriptions.pending, (state) => {
        state.vendorSubscriptionsLoading = true;
        state.vendorSubscriptionsError = null;
      })
      .addCase(fetchVendorSubscriptions.fulfilled, (state, action) => {
        state.vendorSubscriptionsLoading = false;
        state.vendorSubscriptions = action.payload.items;
        if (action.payload.pagination) {
          state.vendorSubscriptionsPagination = {
            ...state.vendorSubscriptionsPagination,
            ...action.payload.pagination,
          };
        }
      })
      .addCase(fetchVendorSubscriptions.rejected, (state, action) => {
        state.vendorSubscriptionsLoading = false;
        state.vendorSubscriptionsError = action.payload || 'Failed to fetch vendor subscriptions';
      });
  },
});

export const { clearSubscriptionsMessages } = subscriptionsSlice.actions;

export const selectSubscriptionPlans = (state) => state.subscriptions.plans;
export const selectSubscriptionPlansLoading = (state) => state.subscriptions.plansLoading;
export const selectSubscriptionPlansError = (state) => state.subscriptions.plansError;
export const selectPlanActionLoading = (state) => state.subscriptions.planActionLoading;
export const selectPlanActionError = (state) => state.subscriptions.planActionError;

export const selectVendorSubscriptions = (state) => state.subscriptions.vendorSubscriptions;
export const selectVendorSubscriptionsPagination = (state) => state.subscriptions.vendorSubscriptionsPagination;
export const selectVendorSubscriptionsLoading = (state) => state.subscriptions.vendorSubscriptionsLoading;
export const selectVendorSubscriptionsError = (state) => state.subscriptions.vendorSubscriptionsError;

export default subscriptionsSlice.reducer;