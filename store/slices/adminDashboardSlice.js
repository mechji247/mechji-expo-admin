import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import { backendUrl } from '../../lib/utils/env';

const API_BASE_URL = backendUrl
const DASHBOARD_BASE = `${API_BASE_URL}/api/admin/dashboard`;

const axiosConfig = {
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
};

const initialPaginationBlock = {
  page: 1,
  limit: 10,
  totalPages: 1,
  total: 0,
};

const initialState = {
  overview: {
    users: { total: 0, active: 0, blocked: 0 },
    vendors: { total: 0, verified: 0, pending: 0, suspended: 0 },
    admins: { total: 0 },
    products: { total: 0, active: 0 },
    services: { total: 0, active: 0 },
    productOrders: { total: 0, pending: 0 },
    serviceBookings: { total: 0, pending: 0 },
    reports: { total: 0, open: 0 },
    commissionPayments: { total: 0, pending: 0 },
    legalDocuments: { total: 0, published: 0 },
  },

  recent: {
    users: [],
    vendors: [],
    orders: [],
    bookings: [],
    reports: [],
    payments: [],
  },

  lists: {
    users: [],
    vendors: [],
    products: [],
    services: [],
    orders: [],
    bookings: [],
    reports: [],
    payments: [],
    legalDocuments: [],
  },

  activity: [],

  filters: {
    search: '',
    activeTab: 'users',
    userStatus: 'all',
    vendorStatus: 'all',
    productStatus: 'all',
    serviceStatus: 'all',
    reportStatus: 'all',
    paymentStatus: 'all',
    dateRange: '7d',
  },

  pagination: {
    users: { ...initialPaginationBlock },
    vendors: { ...initialPaginationBlock },
    products: { ...initialPaginationBlock },
    services: { ...initialPaginationBlock },
    orders: { ...initialPaginationBlock },
    bookings: { ...initialPaginationBlock },
    reports: { ...initialPaginationBlock },
    payments: { ...initialPaginationBlock },
    legalDocuments: { ...initialPaginationBlock },
  },

  loading: {
    bootstrap: false,
    overview: false,
    users: false,
    vendors: false,
    products: false,
    services: false,
    orders: false,
    bookings: false,
    reports: false,
    payments: false,
    legalDocuments: false,
    activity: false,
  },

  errors: {
    bootstrap: null,
    overview: null,
    users: null,
    vendors: null,
    products: null,
    services: null,
    orders: null,
    bookings: null,
    reports: null,
    payments: null,
    legalDocuments: null,
    activity: null,
  },

  successMessage: null,
  lastFetchedAt: null,
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const normalizePagination = (pagination = {}, fallbackLimit = 10) => ({
  page: pagination?.page || 1,
  limit: pagination?.limit || fallbackLimit,
  totalPages: pagination?.totalPages || 1,
  total: pagination?.total || 0,
});

const getListParams = (state, key, extraParams = {}) => ({
  page: state.pagination[key]?.page || 1,
  limit: state.pagination[key]?.limit || 10,
  search: state.filters.search || '',
  ...extraParams,
});

export const fetchDashboardBootstrap = createAsyncThunk(
  'adminDashboard/fetchDashboardBootstrap',
  async (params = {}, thunkAPI) => {
    try {
      const response = await axios.get(`${DASHBOARD_BASE}/bootstrap`, {
        ...axiosConfig,
        params,
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        getErrorMessage(error, 'Failed to fetch dashboard bootstrap')
      );
    }
  }
);

export const fetchDashboardOverview = createAsyncThunk(
  'adminDashboard/fetchDashboardOverview',
  async (_, thunkAPI) => {
    try {
      const response = await axios.get(`${DASHBOARD_BASE}/overview`, axiosConfig);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        getErrorMessage(error, 'Failed to fetch dashboard overview')
      );
    }
  }
);

export const fetchDashboardActivity = createAsyncThunk(
  'adminDashboard/fetchDashboardActivity',
  async (params = {}, thunkAPI) => {
    try {
      const response = await axios.get(`${DASHBOARD_BASE}/activity`, {
        ...axiosConfig,
        params,
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        getErrorMessage(error, 'Failed to fetch dashboard activity')
      );
    }
  }
);

export const fetchDashboardUsers = createAsyncThunk(
  'adminDashboard/fetchDashboardUsers',
  async (params = {}, thunkAPI) => {
    try {
      const state = thunkAPI.getState().adminDashboard;
      const response = await axios.get(`${DASHBOARD_BASE}/users`, {
        ...axiosConfig,
        params: {
          ...getListParams(state, 'users', {
            status: state.filters.userStatus,
          }),
          ...params,
        },
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        getErrorMessage(error, 'Failed to fetch dashboard users')
      );
    }
  }
);

export const fetchDashboardVendors = createAsyncThunk(
  'adminDashboard/fetchDashboardVendors',
  async (params = {}, thunkAPI) => {
    try {
      const state = thunkAPI.getState().adminDashboard;
      const response = await axios.get(`${DASHBOARD_BASE}/vendors`, {
        ...axiosConfig,
        params: {
          ...getListParams(state, 'vendors', {
            status: state.filters.vendorStatus,
          }),
          ...params,
        },
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        getErrorMessage(error, 'Failed to fetch dashboard vendors')
      );
    }
  }
);

export const fetchDashboardProducts = createAsyncThunk(
  'adminDashboard/fetchDashboardProducts',
  async (params = {}, thunkAPI) => {
    try {
      const state = thunkAPI.getState().adminDashboard;
      const response = await axios.get(`${DASHBOARD_BASE}/products`, {
        ...axiosConfig,
        params: {
          ...getListParams(state, 'products', {
            status: state.filters.productStatus,
          }),
          ...params,
        },
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        getErrorMessage(error, 'Failed to fetch dashboard products')
      );
    }
  }
);

export const fetchDashboardServices = createAsyncThunk(
  'adminDashboard/fetchDashboardServices',
  async (params = {}, thunkAPI) => {
    try {
      const state = thunkAPI.getState().adminDashboard;
      const response = await axios.get(`${DASHBOARD_BASE}/services`, {
        ...axiosConfig,
        params: {
          ...getListParams(state, 'services', {
            status: state.filters.serviceStatus,
          }),
          ...params,
        },
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        getErrorMessage(error, 'Failed to fetch dashboard services')
      );
    }
  }
);

export const fetchDashboardOrders = createAsyncThunk(
  'adminDashboard/fetchDashboardOrders',
  async (params = {}, thunkAPI) => {
    try {
      const state = thunkAPI.getState().adminDashboard;
      const response = await axios.get(`${DASHBOARD_BASE}/orders`, {
        ...axiosConfig,
        params: {
          ...getListParams(state, 'orders'),
          ...params,
        },
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        getErrorMessage(error, 'Failed to fetch dashboard orders')
      );
    }
  }
);

export const fetchDashboardBookings = createAsyncThunk(
  'adminDashboard/fetchDashboardBookings',
  async (params = {}, thunkAPI) => {
    try {
      const state = thunkAPI.getState().adminDashboard;
      const response = await axios.get(`${DASHBOARD_BASE}/bookings`, {
        ...axiosConfig,
        params: {
          ...getListParams(state, 'bookings'),
          ...params,
        },
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        getErrorMessage(error, 'Failed to fetch dashboard bookings')
      );
    }
  }
);

export const fetchDashboardReports = createAsyncThunk(
  'adminDashboard/fetchDashboardReports',
  async (params = {}, thunkAPI) => {
    try {
      const state = thunkAPI.getState().adminDashboard;
      const response = await axios.get(`${DASHBOARD_BASE}/reports`, {
        ...axiosConfig,
        params: {
          ...getListParams(state, 'reports', {
            status: state.filters.reportStatus,
          }),
          ...params,
        },
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        getErrorMessage(error, 'Failed to fetch dashboard reports')
      );
    }
  }
);

export const fetchDashboardPayments = createAsyncThunk(
  'adminDashboard/fetchDashboardPayments',
  async (params = {}, thunkAPI) => {
    try {
      const state = thunkAPI.getState().adminDashboard;
      const response = await axios.get(`${DASHBOARD_BASE}/commission-payments`, {
        ...axiosConfig,
        params: {
          ...getListParams(state, 'payments', {
            status: state.filters.paymentStatus,
          }),
          ...params,
        },
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        getErrorMessage(error, 'Failed to fetch dashboard payments')
      );
    }
  }
);

export const fetchDashboardLegalDocuments = createAsyncThunk(
  'adminDashboard/fetchDashboardLegalDocuments',
  async (params = {}, thunkAPI) => {
    try {
      const state = thunkAPI.getState().adminDashboard;
      const response = await axios.get(`${DASHBOARD_BASE}/legal-documents`, {
        ...axiosConfig,
        params: {
          ...getListParams(state, 'legalDocuments'),
          ...params,
        },
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        getErrorMessage(error, 'Failed to fetch dashboard legal documents')
      );
    }
  }
);

const adminDashboardSlice = createSlice({
  name: 'adminDashboard',
  initialState,
  reducers: {
    setDashboardSearch(state, action) {
      state.filters.search = action.payload || '';
      Object.keys(state.pagination).forEach((key) => {
        state.pagination[key].page = 1;
      });
    },

    setDashboardActiveTab(state, action) {
      state.filters.activeTab = action.payload || 'users';
    },

    setUserStatusFilter(state, action) {
      state.filters.userStatus = action.payload || 'all';
      state.pagination.users.page = 1;
    },

    setVendorStatusFilter(state, action) {
      state.filters.vendorStatus = action.payload || 'all';
      state.pagination.vendors.page = 1;
    },

    setProductStatusFilter(state, action) {
      state.filters.productStatus = action.payload || 'all';
      state.pagination.products.page = 1;
    },

    setServiceStatusFilter(state, action) {
      state.filters.serviceStatus = action.payload || 'all';
      state.pagination.services.page = 1;
    },

    setReportStatusFilter(state, action) {
      state.filters.reportStatus = action.payload || 'all';
      state.pagination.reports.page = 1;
    },

    setPaymentStatusFilter(state, action) {
      state.filters.paymentStatus = action.payload || 'all';
      state.pagination.payments.page = 1;
    },

    setDashboardDateRange(state, action) {
      state.filters.dateRange = action.payload || '7d';
    },

    setPage(state, action) {
      const { key, page } = action.payload || {};
      if (key && state.pagination[key]) {
        state.pagination[key].page = page || 1;
      }
    },

    setLimit(state, action) {
      const { key, limit } = action.payload || {};
      if (key && state.pagination[key]) {
        state.pagination[key].limit = limit || 10;
        state.pagination[key].page = 1;
      }
    },

    clearDashboardMessages(state) {
      Object.keys(state.errors).forEach((key) => {
        state.errors[key] = null;
      });
      state.successMessage = null;
    },

    resetDashboardState() {
      return initialState;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardBootstrap.pending, (state) => {
        state.loading.bootstrap = true;
        state.errors.bootstrap = null;
      })
      .addCase(fetchDashboardBootstrap.fulfilled, (state, action) => {
        state.loading.bootstrap = false;
        state.overview = action.payload?.overview || state.overview;
        state.recent = action.payload?.recent || state.recent;
        state.activity = action.payload?.activities || [];
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchDashboardBootstrap.rejected, (state, action) => {
        state.loading.bootstrap = false;
        state.errors.bootstrap = action.payload;
      })

      .addCase(fetchDashboardOverview.pending, (state) => {
        state.loading.overview = true;
        state.errors.overview = null;
      })
      .addCase(fetchDashboardOverview.fulfilled, (state, action) => {
        state.loading.overview = false;
        state.overview = action.payload?.overview || state.overview;
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchDashboardOverview.rejected, (state, action) => {
        state.loading.overview = false;
        state.errors.overview = action.payload;
      })

      .addCase(fetchDashboardActivity.pending, (state) => {
        state.loading.activity = true;
        state.errors.activity = null;
      })
      .addCase(fetchDashboardActivity.fulfilled, (state, action) => {
        state.loading.activity = false;
        state.activity = action.payload?.activities || [];
      })
      .addCase(fetchDashboardActivity.rejected, (state, action) => {
        state.loading.activity = false;
        state.errors.activity = action.payload;
      })

      .addCase(fetchDashboardUsers.pending, (state) => {
        state.loading.users = true;
        state.errors.users = null;
      })
      .addCase(fetchDashboardUsers.fulfilled, (state, action) => {
        state.loading.users = false;
        state.lists.users = action.payload?.items || [];
        state.pagination.users = normalizePagination(
          action.payload?.pagination,
          state.pagination.users.limit
        );
      })
      .addCase(fetchDashboardUsers.rejected, (state, action) => {
        state.loading.users = false;
        state.errors.users = action.payload;
      })

      .addCase(fetchDashboardVendors.pending, (state) => {
        state.loading.vendors = true;
        state.errors.vendors = null;
      })
      .addCase(fetchDashboardVendors.fulfilled, (state, action) => {
        state.loading.vendors = false;
        state.lists.vendors = action.payload?.items || [];
        state.pagination.vendors = normalizePagination(
          action.payload?.pagination,
          state.pagination.vendors.limit
        );
      })
      .addCase(fetchDashboardVendors.rejected, (state, action) => {
        state.loading.vendors = false;
        state.errors.vendors = action.payload;
      })

      .addCase(fetchDashboardProducts.pending, (state) => {
        state.loading.products = true;
        state.errors.products = null;
      })
      .addCase(fetchDashboardProducts.fulfilled, (state, action) => {
        state.loading.products = false;
        state.lists.products = action.payload?.items || [];
        state.pagination.products = normalizePagination(
          action.payload?.pagination,
          state.pagination.products.limit
        );
      })
      .addCase(fetchDashboardProducts.rejected, (state, action) => {
        state.loading.products = false;
        state.errors.products = action.payload;
      })

      .addCase(fetchDashboardServices.pending, (state) => {
        state.loading.services = true;
        state.errors.services = null;
      })
      .addCase(fetchDashboardServices.fulfilled, (state, action) => {
        state.loading.services = false;
        state.lists.services = action.payload?.items || [];
        state.pagination.services = normalizePagination(
          action.payload?.pagination,
          state.pagination.services.limit
        );
      })
      .addCase(fetchDashboardServices.rejected, (state, action) => {
        state.loading.services = false;
        state.errors.services = action.payload;
      })

      .addCase(fetchDashboardOrders.pending, (state) => {
        state.loading.orders = true;
        state.errors.orders = null;
      })
      .addCase(fetchDashboardOrders.fulfilled, (state, action) => {
        state.loading.orders = false;
        state.lists.orders = action.payload?.items || [];
        state.pagination.orders = normalizePagination(
          action.payload?.pagination,
          state.pagination.orders.limit
        );
      })
      .addCase(fetchDashboardOrders.rejected, (state, action) => {
        state.loading.orders = false;
        state.errors.orders = action.payload;
      })

      .addCase(fetchDashboardBookings.pending, (state) => {
        state.loading.bookings = true;
        state.errors.bookings = null;
      })
      .addCase(fetchDashboardBookings.fulfilled, (state, action) => {
        state.loading.bookings = false;
        state.lists.bookings = action.payload?.items || [];
        state.pagination.bookings = normalizePagination(
          action.payload?.pagination,
          state.pagination.bookings.limit
        );
      })
      .addCase(fetchDashboardBookings.rejected, (state, action) => {
        state.loading.bookings = false;
        state.errors.bookings = action.payload;
      })

      .addCase(fetchDashboardReports.pending, (state) => {
        state.loading.reports = true;
        state.errors.reports = null;
      })
      .addCase(fetchDashboardReports.fulfilled, (state, action) => {
        state.loading.reports = false;
        state.lists.reports = action.payload?.items || [];
        state.pagination.reports = normalizePagination(
          action.payload?.pagination,
          state.pagination.reports.limit
        );
      })
      .addCase(fetchDashboardReports.rejected, (state, action) => {
        state.loading.reports = false;
        state.errors.reports = action.payload;
      })

      .addCase(fetchDashboardPayments.pending, (state) => {
        state.loading.payments = true;
        state.errors.payments = null;
      })
      .addCase(fetchDashboardPayments.fulfilled, (state, action) => {
        state.loading.payments = false;
        state.lists.payments = action.payload?.items || [];
        state.pagination.payments = normalizePagination(
          action.payload?.pagination,
          state.pagination.payments.limit
        );
      })
      .addCase(fetchDashboardPayments.rejected, (state, action) => {
        state.loading.payments = false;
        state.errors.payments = action.payload;
      })

      .addCase(fetchDashboardLegalDocuments.pending, (state) => {
        state.loading.legalDocuments = true;
        state.errors.legalDocuments = null;
      })
      .addCase(fetchDashboardLegalDocuments.fulfilled, (state, action) => {
        state.loading.legalDocuments = false;
        state.lists.legalDocuments = action.payload?.items || [];
        state.pagination.legalDocuments = normalizePagination(
          action.payload?.pagination,
          state.pagination.legalDocuments.limit
        );
      })
      .addCase(fetchDashboardLegalDocuments.rejected, (state, action) => {
        state.loading.legalDocuments = false;
        state.errors.legalDocuments = action.payload;
      });
  },
});

export const {
  setDashboardSearch,
  setDashboardActiveTab,
  setUserStatusFilter,
  setVendorStatusFilter,
  setProductStatusFilter,
  setServiceStatusFilter,
  setReportStatusFilter,
  setPaymentStatusFilter,
  setDashboardDateRange,
  setPage,
  setLimit,
  clearDashboardMessages,
  resetDashboardState,
} = adminDashboardSlice.actions;

export const selectAdminDashboard = (state) => state.adminDashboard;
export const selectDashboardOverview = (state) => state.adminDashboard.overview;
export const selectDashboardRecent = (state) => state.adminDashboard.recent;
export const selectDashboardLists = (state) => state.adminDashboard.lists;
export const selectDashboardActivity = (state) => state.adminDashboard.activity;
export const selectDashboardFilters = (state) => state.adminDashboard.filters;
export const selectDashboardPagination = (state) => state.adminDashboard.pagination;
export const selectDashboardLoading = (state) => state.adminDashboard.loading;
export const selectDashboardErrors = (state) => state.adminDashboard.errors;
export const selectDashboardSuccessMessage = (state) => state.adminDashboard.successMessage;
export const selectDashboardLastFetchedAt = (state) => state.adminDashboard.lastFetchedAt;

export default adminDashboardSlice.reducer;