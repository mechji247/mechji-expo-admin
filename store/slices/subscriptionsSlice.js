import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import adminApi from '../../lib/services/adminApi';

// Mounted at /admin/subscription-plans (subscriptionRoutes.js). This
// replaces the earlier version that pointed at /subscriptions/plans/* — a
// route the backend never actually mounted.

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

// GET /admin/subscription-plans
export const fetchSubscriptionPlans = createAsyncThunk(
  'subscriptions/fetchSubscriptionPlans',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get('/subscription-plans');
      return data?.data || [];
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch subscription plans'));
    }
  }
);

// POST /admin/subscription-plans  { tier, displayName, limits, pricing, commission, features, isActive, sortOrder }
export const createSubscriptionPlan = createAsyncThunk(
  'subscriptions/createSubscriptionPlan',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.post('/subscription-plans', payload);
      return { plan: data?.data || null, message: data?.message || 'Plan created' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to create plan'));
    }
  }
);

// PATCH /admin/subscription-plans/:planId  { ...partial plan fields }
export const updateSubscriptionPlan = createAsyncThunk(
  'subscriptions/updateSubscriptionPlan',
  async ({ planId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/subscription-plans/${planId}`, payload);
      return { planId, plan: data?.data || null, message: data?.message || 'Plan updated' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to update plan'));
    }
  }
);

// DELETE /admin/subscription-plans/:planId
export const deleteSubscriptionPlan = createAsyncThunk(
  'subscriptions/deleteSubscriptionPlan',
  async (planId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.delete(`/subscription-plans/${planId}`);
      return { planId, message: data?.message || 'Plan deleted' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to delete plan'));
    }
  }
);

// GET /admin/subscription-plans/vendor-subscriptions?status=&page=&limit=
export const fetchVendorSubscriptions = createAsyncThunk(
  'subscriptions/fetchVendorSubscriptions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get('/subscription-plans/vendor-subscriptions', { params });
      return {
        items: data?.items || [],
        pagination: data?.pagination || null,
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch vendor subscriptions'));
    }
  }
);

function getPlanId(plan) {
  return plan?._id || plan?.id || null;
}

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

      .addCase(createSubscriptionPlan.pending, (state) => {
        state.plansError = null;
      })
      .addCase(createSubscriptionPlan.fulfilled, (state, action) => {
        if (action.payload.plan) state.plans.push(action.payload.plan);
      })
      .addCase(createSubscriptionPlan.rejected, (state, action) => {
        state.plansError = action.payload || 'Failed to create plan';
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
          const idx = state.plans.findIndex((p) => getPlanId(p) === planId);
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

      .addCase(deleteSubscriptionPlan.pending, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          state.planActionLoading[id] = true;
          state.planActionError[id] = null;
        }
      })
      .addCase(deleteSubscriptionPlan.fulfilled, (state, action) => {
        const { planId } = action.payload;
        delete state.planActionLoading[planId];
        state.plans = state.plans.filter((p) => getPlanId(p) !== planId);
      })
      .addCase(deleteSubscriptionPlan.rejected, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          delete state.planActionLoading[id];
          state.planActionError[id] = action.payload || 'Failed to delete plan';
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
