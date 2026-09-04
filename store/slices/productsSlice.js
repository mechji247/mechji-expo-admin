import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import adminApi from '../../lib/services/adminApi';

// Dedicated slice for the Products screen. Previously it read from
// adminDashboardSlice's shared lists/pagination/filters (fine for a
// read-only catalog view, but there was nowhere to put moderation state
// — approve/reject a listing, delist it — without polluting the
// dashboard slice with per-row action state it has no other use for).
// fetchProducts reuses the dashboard's existing list route (already
// returns the right shape); the two mutations below are new.

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const initialState = {
  list: [],
  pagination: { page: 1, limit: 20, totalPages: 1, total: 0 },
  loading: false,
  error: null,

  filters: { search: '', status: '' },

  actionLoading: {}, // keyed by product id
  actionError: {},
};

function getProductId(product) {
  return product?._id || product?.id || null;
}

// GET /admin/dashboard/products?page=&limit=&search=&status=
export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get('/dashboard/products', { params });
      return {
        items: data?.items || [],
        pagination: data?.pagination || null,
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch products'));
    }
  }
);

// PATCH /admin/products/product/:productId/status  { status: 'live' | 'pending' | 'rejected' }
export const updateProductStatus = createAsyncThunk(
  'products/updateProductStatus',
  async ({ productId, status }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/products/product/${productId}/status`, { status });
      return {
        productId,
        product: data?.product || data?.data || null,
        message: data?.message || 'Product status updated',
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to update product status'));
    }
  }
);

// DELETE /admin/products/product/:productId
export const removeProduct = createAsyncThunk(
  'products/removeProduct',
  async (productId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.delete(`/products/product/${productId}`);
      return { productId, message: data?.message || 'Product removed' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to remove product'));
    }
  }
);

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setProductsSearch(state, action) {
      state.filters.search = action.payload || '';
    },
    setProductsStatusFilter(state, action) {
      state.filters.status = action.payload || '';
    },
    clearProductsMessages(state) {
      state.error = null;
      state.actionError = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.items;
        if (action.payload.pagination) {
          state.pagination = { ...state.pagination, ...action.payload.pagination };
        }
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch products';
      })

      .addCase(updateProductStatus.pending, (state, action) => {
        const id = action.meta.arg?.productId;
        if (id) {
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        }
      })
      .addCase(updateProductStatus.fulfilled, (state, action) => {
        const { productId, product } = action.payload;
        delete state.actionLoading[productId];
        if (product) {
          const idx = state.list.findIndex((p) => getProductId(p) === productId);
          if (idx !== -1) state.list[idx] = product;
        }
      })
      .addCase(updateProductStatus.rejected, (state, action) => {
        const id = action.meta.arg?.productId;
        if (id) {
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Failed to update product status';
        }
      })

      .addCase(removeProduct.pending, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        }
      })
      .addCase(removeProduct.fulfilled, (state, action) => {
        const { productId } = action.payload;
        delete state.actionLoading[productId];
        state.list = state.list.filter((p) => getProductId(p) !== productId);
      })
      .addCase(removeProduct.rejected, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Failed to remove product';
        }
      });
  },
});

export const {
  setProductsSearch,
  setProductsStatusFilter,
  clearProductsMessages,
} = productsSlice.actions;

export const selectProductsList = (state) => state.products.list;
export const selectProductsPagination = (state) => state.products.pagination;
export const selectProductsLoading = (state) => state.products.loading;
export const selectProductsError = (state) => state.products.error;
export const selectProductsFilters = (state) => state.products.filters;
export const selectProductActionLoading = (state) => state.products.actionLoading;
export const selectProductActionError = (state) => state.products.actionError;

export { getProductId };

export default productsSlice.reducer;
