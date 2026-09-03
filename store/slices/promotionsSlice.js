import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import adminApi from '../../lib/services/adminApi';

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const initialState = {
  list: [],
  pagination: { page: 1, limit: 20, totalPages: 1, total: 0 },
  loading: false,
  error: null,

  createLoading: false,
  createError: null,

  actionLoading: {}, // keyed by promotion id
  actionError: {},
};

// GET /admin/promotions?status=&page=&limit=
export const fetchPromotions = createAsyncThunk(
  'promotions/fetchPromotions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get('/promotions', { params });
      return {
        items: data?.items || data?.promotions || [],
        pagination: data?.pagination || null,
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch promotions'));
    }
  }
);

// POST /admin/promotions  { title, placement, vendorId, startsAt, endsAt, budget, ... }
export const createPromotion = createAsyncThunk(
  'promotions/createPromotion',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.post('/promotions', payload);
      return { promotion: data?.promotion || null, message: data?.message || 'Promotion created' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to create promotion'));
    }
  }
);

// PATCH /admin/promotions/promotion/:promotionId  { status: 'active' | 'scheduled' | 'ended' }
export const updatePromotionStatus = createAsyncThunk(
  'promotions/updatePromotionStatus',
  async ({ promotionId, status }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/promotions/promotion/${promotionId}`, { status });
      return { promotionId, promotion: data?.promotion || null, message: data?.message || 'Promotion updated' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to update promotion'));
    }
  }
);

// DELETE /admin/promotions/promotion/:promotionId
export const deletePromotion = createAsyncThunk(
  'promotions/deletePromotion',
  async (promotionId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.delete(`/promotions/promotion/${promotionId}`);
      return { promotionId, message: data?.message || 'Promotion deleted' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to delete promotion'));
    }
  }
);

function getPromotionId(promo) {
  return promo?._id || promo?.id || null;
}

const promotionsSlice = createSlice({
  name: 'promotions',
  initialState,
  reducers: {
    clearPromotionsMessages: (state) => {
      state.error = null;
      state.createError = null;
      state.actionError = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPromotions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPromotions.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.items;
        if (action.payload.pagination) {
          state.pagination = { ...state.pagination, ...action.payload.pagination };
        }
      })
      .addCase(fetchPromotions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch promotions';
      })

      .addCase(createPromotion.pending, (state) => {
        state.createLoading = true;
        state.createError = null;
      })
      .addCase(createPromotion.fulfilled, (state, action) => {
        state.createLoading = false;
        if (action.payload.promotion) {
          state.list.unshift(action.payload.promotion);
        }
      })
      .addCase(createPromotion.rejected, (state, action) => {
        state.createLoading = false;
        state.createError = action.payload || 'Failed to create promotion';
      })

      .addCase(updatePromotionStatus.pending, (state, action) => {
        const id = action.meta.arg?.promotionId;
        if (id) {
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        }
      })
      .addCase(updatePromotionStatus.fulfilled, (state, action) => {
        const { promotionId, promotion } = action.payload;
        delete state.actionLoading[promotionId];
        if (promotion) {
          const idx = state.list.findIndex((p) => getPromotionId(p) === promotionId);
          if (idx !== -1) state.list[idx] = promotion;
        }
      })
      .addCase(updatePromotionStatus.rejected, (state, action) => {
        const id = action.meta.arg?.promotionId;
        if (id) {
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Failed to update promotion';
        }
      })

      .addCase(deletePromotion.pending, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        }
      })
      .addCase(deletePromotion.fulfilled, (state, action) => {
        const { promotionId } = action.payload;
        delete state.actionLoading[promotionId];
        state.list = state.list.filter((p) => getPromotionId(p) !== promotionId);
      })
      .addCase(deletePromotion.rejected, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Failed to delete promotion';
        }
      });
  },
});

export const { clearPromotionsMessages } = promotionsSlice.actions;

export const selectPromotionsList = (state) => state.promotions.list;
export const selectPromotionsPagination = (state) => state.promotions.pagination;
export const selectPromotionsLoading = (state) => state.promotions.loading;
export const selectPromotionsError = (state) => state.promotions.error;
export const selectPromotionCreateLoading = (state) => state.promotions.createLoading;
export const selectPromotionCreateError = (state) => state.promotions.createError;
export const selectPromotionActionLoading = (state) => state.promotions.actionLoading;
export const selectPromotionActionError = (state) => state.promotions.actionError;

export { getPromotionId };

export default promotionsSlice.reducer;