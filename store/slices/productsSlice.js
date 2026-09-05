import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import adminApi from '../../lib/services/adminApi';

// Dedicated slice for the Products screen. Previously it read from
// adminDashboardSlice's shared lists/pagination/filters (fine for a
// read-only catalog view, but there was nowhere to put moderation state
// — approve/reject a listing, delist it — without polluting the
// dashboard slice with per-row action state it has no other use for).
// fetchProducts reuses the dashboard's existing list route (already
// returns the right shape); the mutations below are dedicated to
// /admin/products/*.
//
// Real status enum (server/newSchemaModels/schemas/product/productSchema.js):
// status: 'draft' | 'pending' | 'active' | 'inactive' | 'outOfStock' | 'rejected'
// — NOT 'live', which was never a value on the schema. "Verify" on the
// product detail screen means status -> 'active'; "Reject" means
// status -> 'rejected' (with an optional reason, stored on the schema's
// own rejectionReason field). There's a second, separate
// verificationStatus.status field on the schema (pending/verified/
// rejected/none) that nothing in this admin app writes to yet — every
// action here only touches the top-level `status`, matching what the
// backend controller currently implements.

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const initialState = {
  list: [],
  pagination: { page: 1, limit: 20, totalPages: 1, total: 0 },
  loading: false,
  error: null,

  filters: { search: '', status: '' },

  actionLoading: {}, // keyed by product id — shared across status/remove/update/restore
  actionError: {}, // keyed by product id

  // Single-product admin detail view (product info screen).
  current: null,
  currentStatus: 'idle',
  currentError: null,
  currentSuccessMessage: null,
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

// GET /admin/products/product/:productId — full admin detail view.
export const fetchProductAdminView = createAsyncThunk(
  'products/fetchProductAdminView',
  async (productId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get(`/products/product/${productId}`);
      return data?.product ?? data?.data ?? data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to load product details'));
    }
  }
);

// PATCH /admin/products/product/:productId  — core catalog-detail edit
// (title/description/category/brand/pricing/inventory/tags/flags/notes).
export const updateProductDetails = createAsyncThunk(
  'products/updateProductDetails',
  async ({ productId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/products/product/${productId}`, payload);
      return {
        productId,
        product: data?.product ?? data?.data ?? null,
        message: data?.message || 'Product updated',
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to update product'));
    }
  }
);

// PATCH /admin/products/product/:productId/status  { status, reason? }
// status: 'active' (verify/go live) | 'rejected' (reject, reason optional)
// | 'draft' | 'pending' | 'inactive' | 'outOfStock'
export const updateProductStatus = createAsyncThunk(
  'products/updateProductStatus',
  async ({ productId, status, reason }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/products/product/${productId}/status`, { status, reason });
      return {
        productId,
        product: data?.product || data?.data || null,
        fullProduct: data?.fullProduct || null,
        message: data?.message || 'Product status updated',
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to update product status'));
    }
  }
);

// DELETE /admin/products/product/:productId  (soft delete)
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

// PATCH /admin/products/product/:productId/restore  — undo removeProduct.
export const restoreProduct = createAsyncThunk(
  'products/restoreProduct',
  async (productId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/products/product/${productId}/restore`);
      return {
        productId,
        product: data?.product ?? data?.data ?? null,
        message: data?.message || 'Product restored',
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to restore product'));
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
    clearCurrentProduct(state) {
      state.current = null;
      state.currentStatus = 'idle';
      state.currentError = null;
      state.currentSuccessMessage = null;
    },
    clearCurrentProductMessage(state) {
      state.currentSuccessMessage = null;
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

      // FETCH SINGLE PRODUCT
      .addCase(fetchProductAdminView.pending, (state) => {
        state.currentStatus = 'loading';
        state.currentError = null;
      })
      .addCase(fetchProductAdminView.fulfilled, (state, action) => {
        state.currentStatus = 'succeeded';
        state.current = action.payload;
      })
      .addCase(fetchProductAdminView.rejected, (state, action) => {
        state.currentStatus = 'failed';
        state.currentError = action.payload || 'Failed to load product details';
      })

      // UPDATE PRODUCT DETAILS
      .addCase(updateProductDetails.pending, (state, action) => {
        const id = action.meta.arg?.productId;
        if (id) {
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        }
      })
      .addCase(updateProductDetails.fulfilled, (state, action) => {
        const { productId, product, message } = action.payload;
        delete state.actionLoading[productId];
        if (product) {
          if (state.current && getProductId(state.current) === productId) {
            state.current = product;
          }
          const idx = state.list.findIndex((p) => getProductId(p) === productId);
          if (idx !== -1) state.list[idx] = { ...state.list[idx], ...product };
        }
        state.currentSuccessMessage = message;
      })
      .addCase(updateProductDetails.rejected, (state, action) => {
        const id = action.meta.arg?.productId;
        if (id) {
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Failed to update product';
        }
      })

      // UPDATE STATUS (verify / reject / etc.)
      .addCase(updateProductStatus.pending, (state, action) => {
        const id = action.meta.arg?.productId;
        if (id) {
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        }
      })
      .addCase(updateProductStatus.fulfilled, (state, action) => {
        const { productId, product, fullProduct, message } = action.payload;
        delete state.actionLoading[productId];
        if (product) {
          const idx = state.list.findIndex((p) => getProductId(p) === productId);
          if (idx !== -1) state.list[idx] = product;
        }
        if (state.current && getProductId(state.current) === productId) {
          state.current = fullProduct || { ...state.current, ...(product || {}) };
        }
        state.currentSuccessMessage = message;
      })
      .addCase(updateProductStatus.rejected, (state, action) => {
        const id = action.meta.arg?.productId;
        if (id) {
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Failed to update product status';
        }
      })

      // SOFT DELETE
      .addCase(removeProduct.pending, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        }
      })
      .addCase(removeProduct.fulfilled, (state, action) => {
        const { productId, message } = action.payload;
        delete state.actionLoading[productId];
        state.list = state.list.filter((p) => getProductId(p) !== productId);
        if (state.current && getProductId(state.current) === productId) {
          state.current.isDeleted = true;
          state.current.status = 'inactive';
        }
        state.currentSuccessMessage = message;
      })
      .addCase(removeProduct.rejected, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Failed to remove product';
        }
      })

      // RESTORE
      .addCase(restoreProduct.pending, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        }
      })
      .addCase(restoreProduct.fulfilled, (state, action) => {
        const { productId, product, message } = action.payload;
        delete state.actionLoading[productId];
        if (state.current && getProductId(state.current) === productId) {
          state.current = product || { ...state.current, isDeleted: false, status: 'inactive' };
        }
        state.currentSuccessMessage = message;
      })
      .addCase(restoreProduct.rejected, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Failed to restore product';
        }
      });
  },
});

export const {
  setProductsSearch,
  setProductsStatusFilter,
  clearProductsMessages,
  clearCurrentProduct,
  clearCurrentProductMessage,
} = productsSlice.actions;

export const selectProductsList = (state) => state.products.list;
export const selectProductsPagination = (state) => state.products.pagination;
export const selectProductsLoading = (state) => state.products.loading;
export const selectProductsError = (state) => state.products.error;
export const selectProductsFilters = (state) => state.products.filters;
export const selectProductActionLoading = (state) => state.products.actionLoading;
export const selectProductActionError = (state) => state.products.actionError;

export const selectCurrentProduct = (state) => state.products.current;
export const selectCurrentProductStatus = (state) => state.products.currentStatus;
export const selectCurrentProductError = (state) => state.products.currentError;
export const selectCurrentProductSuccessMessage = (state) => state.products.currentSuccessMessage;

export { getProductId };

export default productsSlice.reducer;
