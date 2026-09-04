import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import adminApi from '../../lib/services/adminApi';

// Dedicated slice for the Orders screens (product orders + service
// bookings). Previously these screens read from adminDashboardSlice's
// shared lists/pagination/filters, which meant order-specific state
// (status update in flight, per-row action errors) had nowhere to live
// without polluting the dashboard slice. This slice owns product-order
// and service-booking state exclusively; adminDashboardSlice keeps its
// own copies for the dashboard's "recent activity" widgets.
//
// Endpoints reuse the dashboard's existing list routes (they already
// return the right shape) and add the two status-update routes the
// dashboard slice never needed.

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const initialListState = {
  items: [],
  pagination: { page: 1, limit: 20, totalPages: 1, total: 0 },
  loading: false,
  error: null,
};

const initialState = {
  product: { ...initialListState },
  service: { ...initialListState },

  current: null, // last-opened order/booking, from fetchOrderById/fetchBookingById
  currentLoading: false,
  currentError: null,

  filters: { search: '', status: '' },

  actionLoading: {}, // keyed by order/booking id
  actionError: {},
};

function getOrderId(order) {
  return order?._id || order?.id || null;
}

// GET /admin/dashboard/orders?page=&limit=&search=&status=
export const fetchProductOrders = createAsyncThunk(
  'orders/fetchProductOrders',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get('/dashboard/orders', { params });
      return {
        items: data?.items || [],
        pagination: data?.pagination || null,
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch orders'));
    }
  }
);

// GET /admin/dashboard/bookings?page=&limit=&search=&status=
export const fetchServiceBookings = createAsyncThunk(
  'orders/fetchServiceBookings',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get('/dashboard/bookings', { params });
      return {
        items: data?.items || [],
        pagination: data?.pagination || null,
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch service bookings'));
    }
  }
);

// GET /admin/orders/order/:orderId
export const fetchOrderById = createAsyncThunk(
  'orders/fetchOrderById',
  async (orderId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get(`/orders/order/${orderId}`);
      return data?.order || data?.data || null;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch order'));
    }
  }
);

// GET /admin/orders/booking/:bookingId
export const fetchBookingById = createAsyncThunk(
  'orders/fetchBookingById',
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get(`/orders/booking/${bookingId}`);
      return data?.booking || data?.data || null;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch booking'));
    }
  }
);

// PATCH /admin/orders/order/:orderId/status  { status }
export const updateOrderStatus = createAsyncThunk(
  'orders/updateOrderStatus',
  async ({ orderId, status }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/orders/order/${orderId}/status`, { status });
      return {
        orderId,
        order: data?.order || data?.data || null,
        message: data?.message || 'Order status updated',
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to update order status'));
    }
  }
);

// PATCH /admin/orders/booking/:bookingId/status  { status }
export const updateBookingStatus = createAsyncThunk(
  'orders/updateBookingStatus',
  async ({ bookingId, status }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/orders/booking/${bookingId}/status`, { status });
      return {
        bookingId,
        booking: data?.booking || data?.data || null,
        message: data?.message || 'Booking status updated',
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to update booking status'));
    }
  }
);

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setOrdersSearch(state, action) {
      state.filters.search = action.payload || '';
    },
    setOrdersStatusFilter(state, action) {
      state.filters.status = action.payload || '';
    },
    clearOrdersMessages(state) {
      state.product.error = null;
      state.service.error = null;
      state.currentError = null;
      state.actionError = {};
    },
    clearCurrentOrder(state) {
      state.current = null;
      state.currentError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProductOrders.pending, (state) => {
        state.product.loading = true;
        state.product.error = null;
      })
      .addCase(fetchProductOrders.fulfilled, (state, action) => {
        state.product.loading = false;
        state.product.items = action.payload.items;
        if (action.payload.pagination) {
          state.product.pagination = { ...state.product.pagination, ...action.payload.pagination };
        }
      })
      .addCase(fetchProductOrders.rejected, (state, action) => {
        state.product.loading = false;
        state.product.error = action.payload || 'Failed to fetch orders';
      })

      .addCase(fetchServiceBookings.pending, (state) => {
        state.service.loading = true;
        state.service.error = null;
      })
      .addCase(fetchServiceBookings.fulfilled, (state, action) => {
        state.service.loading = false;
        state.service.items = action.payload.items;
        if (action.payload.pagination) {
          state.service.pagination = { ...state.service.pagination, ...action.payload.pagination };
        }
      })
      .addCase(fetchServiceBookings.rejected, (state, action) => {
        state.service.loading = false;
        state.service.error = action.payload || 'Failed to fetch service bookings';
      })

      .addCase(fetchOrderById.pending, (state) => {
        state.currentLoading = true;
        state.currentError = null;
      })
      .addCase(fetchOrderById.fulfilled, (state, action) => {
        state.currentLoading = false;
        state.current = action.payload;
      })
      .addCase(fetchOrderById.rejected, (state, action) => {
        state.currentLoading = false;
        state.currentError = action.payload || 'Failed to fetch order';
      })

      .addCase(fetchBookingById.pending, (state) => {
        state.currentLoading = true;
        state.currentError = null;
      })
      .addCase(fetchBookingById.fulfilled, (state, action) => {
        state.currentLoading = false;
        state.current = action.payload;
      })
      .addCase(fetchBookingById.rejected, (state, action) => {
        state.currentLoading = false;
        state.currentError = action.payload || 'Failed to fetch booking';
      });

    [updateOrderStatus, updateBookingStatus].forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state, action) => {
          const id = action.meta.arg?.orderId || action.meta.arg?.bookingId;
          if (!id) return;
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          const id = action.payload.orderId || action.payload.bookingId;
          const updated = action.payload.order || action.payload.booking;
          delete state.actionLoading[id];

          if (updated) {
            const productIdx = state.product.items.findIndex((o) => getOrderId(o) === id);
            if (productIdx !== -1) state.product.items[productIdx] = updated;

            const serviceIdx = state.service.items.findIndex((o) => getOrderId(o) === id);
            if (serviceIdx !== -1) state.service.items[serviceIdx] = updated;

            if (state.current && getOrderId(state.current) === id) {
              state.current = updated;
            }
          }
        })
        .addCase(thunk.rejected, (state, action) => {
          const id = action.meta.arg?.orderId || action.meta.arg?.bookingId;
          if (!id) return;
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Action failed';
        });
    });
  },
});

export const {
  setOrdersSearch,
  setOrdersStatusFilter,
  clearOrdersMessages,
  clearCurrentOrder,
} = ordersSlice.actions;

export const selectProductOrders = (state) => state.orders.product.items;
export const selectProductOrdersPagination = (state) => state.orders.product.pagination;
export const selectProductOrdersLoading = (state) => state.orders.product.loading;
export const selectProductOrdersError = (state) => state.orders.product.error;

export const selectServiceBookings = (state) => state.orders.service.items;
export const selectServiceBookingsPagination = (state) => state.orders.service.pagination;
export const selectServiceBookingsLoading = (state) => state.orders.service.loading;
export const selectServiceBookingsError = (state) => state.orders.service.error;

export const selectCurrentOrder = (state) => state.orders.current;
export const selectCurrentOrderLoading = (state) => state.orders.currentLoading;
export const selectCurrentOrderError = (state) => state.orders.currentError;

export const selectOrdersFilters = (state) => state.orders.filters;
export const selectOrderActionLoading = (state) => state.orders.actionLoading;
export const selectOrderActionError = (state) => state.orders.actionError;

export { getOrderId };

export default ordersSlice.reducer;
