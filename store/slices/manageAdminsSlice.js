import adminApi from '../../lib/services/adminApi.js';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const getErrorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback;

// Every admin record from the backend is expected to look roughly like:
//   { _id, adminId, name, email, role, status, createdAt, ... }
// "_id" (or "id") is the stable database identifier every action below is
// keyed on — never "adminId", since resetAdminLoginId's whole job is to
// change that value out from under a record. Keying actions on a value
// that can itself be reset would break the very next action taken on it.
export const getAdminRecordId = (admin) => admin?._id || admin?.id || null;

export const ADMIN_ROLES = ['Super Admin', 'Admin', 'Moderator'];

// ------------------------------------
// LIST
// GET /admin/admins
// query: { page, limit, search, role, status }
// ------------------------------------
export const fetchAdmins = createAsyncThunk(
  'manageAdmins/fetchAdmins',
  async (
    { page = 1, limit = 20, search = '', role = '', status = '' } = {},
    { rejectWithValue }
  ) => {
    try {
      const { data } = await adminApi.get('/admins', {
        params: {
          page,
          limit,
          search: search || undefined,
          role: role || undefined,
          status: status || undefined,
        },
      });
      const admins = data?.admins ?? data?.data ?? [];
      const pagination = data?.pagination ?? {
        page,
        limit,
        total: admins.length,
        totalPages: 1,
      };
      return { admins, pagination, page };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to load admins'));
    }
  }
);

// ------------------------------------
// CREATE
// POST /admin/admins
// payload: { name, email, password, role }
// adminId is intentionally not sent — the backend assigns it, same as a
// password/admin-ID reset assigns a new value rather than accepting one
// from the app.
// ------------------------------------
export const createAdmin = createAsyncThunk(
  'manageAdmins/createAdmin',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.post('/admins', payload);
      return {
        admin: data?.admin ?? data?.data ?? null,
        message: data?.message || 'Admin created successfully',
      };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to create admin'));
    }
  }
);

// ------------------------------------
// UPDATE ROLE (upgrade / downgrade)
// PATCH /admin/admins/:id/role
// payload: { role }
// ------------------------------------
export const updateAdminRole = createAsyncThunk(
  'manageAdmins/updateAdminRole',
  async ({ id, role }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/admins/${id}/role`, { role });
      return {
        id,
        admin: data?.admin ?? data?.data ?? null,
        message: data?.message || 'Role updated',
      };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to update role'));
    }
  }
);

// ------------------------------------
// UPDATE STATUS (activate / deactivate)
// PATCH /admin/admins/:id/status
// payload: { status: 'active' | 'inactive' }
// ------------------------------------
export const updateAdminStatus = createAsyncThunk(
  'manageAdmins/updateAdminStatus',
  async ({ id, status }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/admins/${id}/status`, { status });
      return {
        id,
        admin: data?.admin ?? data?.data ?? null,
        message:
          data?.message || (status === 'inactive' ? 'Admin deactivated' : 'Admin activated'),
      };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to update admin status'));
    }
  }
);

// ------------------------------------
// DELETE
// DELETE /admin/admins/:id
// ------------------------------------
export const deleteAdmin = createAsyncThunk(
  'manageAdmins/deleteAdmin',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.delete(`/admins/${id}`);
      return { id, message: data?.message || 'Admin deleted' };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to delete admin'));
    }
  }
);

// ------------------------------------
// RESET PASSWORD
// PATCH /admin/admins/:id/reset-password
// No body — the backend generates a new temporary password and returns
// it once. Nothing is persisted client-side beyond this one response.
// ------------------------------------
export const resetAdminPassword = createAsyncThunk(
  'manageAdmins/resetAdminPassword',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/admins/${id}/reset-password`);
      return {
        id,
        tempPassword: data?.tempPassword ?? data?.password ?? null,
        message: data?.message || 'Password reset',
      };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to reset password'));
    }
  }
);

// ------------------------------------
// RESET ADMIN LOGIN ID
// PATCH /admin/admins/:id/reset-admin-id
// No body — the backend assigns a new adminId (the login identifier,
// distinct from the :id in the URL, which is the record's stable
// database id and never changes).
// ------------------------------------
export const resetAdminLoginId = createAsyncThunk(
  'manageAdmins/resetAdminLoginId',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/admins/${id}/reset-admin-id`);
      return {
        id,
        newAdminId: data?.adminId ?? data?.newAdminId ?? null,
        message: data?.message || 'Admin ID reset',
      };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to reset admin ID'));
    }
  }
);

const initialState = {
  admins: [],
  listStatus: 'idle', // idle | loading | succeeded | failed
  listError: null,

  pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  filters: { search: '', role: '', status: '' },

  createLoading: false,
  createError: null,

  // One entry per admin record id currently mid-action, e.g.
  // { "<id>": "role" | "status" | "delete" | "resetPassword" | "resetAdminId" }
  // so a single row can show/disable just its own controls instead of
  // locking the whole list while one action is in flight.
  rowActions: {},
  rowErrors: {},

  // Last reset result, surfaced once by the screen (a dismissable modal),
  // then cleared — never left sitting in state longer than it takes the
  // admin to read/copy it.
  lastPasswordReset: null, // { id, tempPassword }
  lastAdminIdReset: null, // { id, newAdminId }

  successMessage: null,
};

const manageAdminsSlice = createSlice({
  name: 'manageAdmins',
  initialState,
  reducers: {
    setAdminsFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearManageAdminsMessages: (state) => {
      state.listError = null;
      state.createError = null;
      state.successMessage = null;
      state.rowErrors = {};
    },
    clearPasswordReset: (state) => {
      state.lastPasswordReset = null;
    },
    clearAdminIdReset: (state) => {
      state.lastAdminIdReset = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // LIST
      .addCase(fetchAdmins.pending, (state) => {
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchAdmins.fulfilled, (state, action) => {
        state.listStatus = 'succeeded';
        const { admins, pagination, page } = action.payload;
        // Page 1 (a fresh load, search, or filter change) replaces the
        // list; anything past page 1 (Load more) appends.
        state.admins = page > 1 ? [...state.admins, ...admins] : admins;
        state.pagination = pagination;
      })
      .addCase(fetchAdmins.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError = action.payload || 'Failed to load admins';
      })

      // CREATE
      .addCase(createAdmin.pending, (state) => {
        state.createLoading = true;
        state.createError = null;
        state.successMessage = null;
      })
      .addCase(createAdmin.fulfilled, (state, action) => {
        state.createLoading = false;
        if (action.payload.admin) {
          state.admins = [action.payload.admin, ...state.admins];
          state.pagination.total += 1;
        }
        state.successMessage = action.payload.message;
      })
      .addCase(createAdmin.rejected, (state, action) => {
        state.createLoading = false;
        state.createError = action.payload || 'Failed to create admin';
      })

      // ROLE
      .addCase(updateAdminRole.pending, (state, action) => {
        state.rowActions[action.meta.arg.id] = 'role';
      })
      .addCase(updateAdminRole.fulfilled, (state, action) => {
        delete state.rowActions[action.payload.id];
        delete state.rowErrors[action.payload.id];
        const idx = state.admins.findIndex((a) => getAdminRecordId(a) === action.payload.id);
        if (idx !== -1 && action.payload.admin) {
          state.admins[idx] = { ...state.admins[idx], ...action.payload.admin };
        }
        state.successMessage = action.payload.message;
      })
      .addCase(updateAdminRole.rejected, (state, action) => {
        delete state.rowActions[action.meta.arg.id];
        state.rowErrors[action.meta.arg.id] = action.payload || 'Failed to update role';
      })

      // STATUS
      .addCase(updateAdminStatus.pending, (state, action) => {
        state.rowActions[action.meta.arg.id] = 'status';
      })
      .addCase(updateAdminStatus.fulfilled, (state, action) => {
        delete state.rowActions[action.payload.id];
        delete state.rowErrors[action.payload.id];
        const idx = state.admins.findIndex((a) => getAdminRecordId(a) === action.payload.id);
        if (idx !== -1 && action.payload.admin) {
          state.admins[idx] = { ...state.admins[idx], ...action.payload.admin };
        }
        state.successMessage = action.payload.message;
      })
      .addCase(updateAdminStatus.rejected, (state, action) => {
        delete state.rowActions[action.meta.arg.id];
        state.rowErrors[action.meta.arg.id] = action.payload || 'Failed to update status';
      })

      // DELETE
      .addCase(deleteAdmin.pending, (state, action) => {
        state.rowActions[action.meta.arg] = 'delete';
      })
      .addCase(deleteAdmin.fulfilled, (state, action) => {
        delete state.rowActions[action.payload.id];
        delete state.rowErrors[action.payload.id];
        state.admins = state.admins.filter((a) => getAdminRecordId(a) !== action.payload.id);
        state.pagination.total = Math.max(0, state.pagination.total - 1);
        state.successMessage = action.payload.message;
      })
      .addCase(deleteAdmin.rejected, (state, action) => {
        delete state.rowActions[action.meta.arg];
        state.rowErrors[action.meta.arg] = action.payload || 'Failed to delete admin';
      })

      // RESET PASSWORD
      .addCase(resetAdminPassword.pending, (state, action) => {
        state.rowActions[action.meta.arg] = 'resetPassword';
      })
      .addCase(resetAdminPassword.fulfilled, (state, action) => {
        delete state.rowActions[action.payload.id];
        delete state.rowErrors[action.payload.id];
        state.lastPasswordReset = {
          id: action.payload.id,
          tempPassword: action.payload.tempPassword,
        };
        state.successMessage = action.payload.message;
      })
      .addCase(resetAdminPassword.rejected, (state, action) => {
        delete state.rowActions[action.meta.arg];
        state.rowErrors[action.meta.arg] = action.payload || 'Failed to reset password';
      })

      // RESET ADMIN ID
      .addCase(resetAdminLoginId.pending, (state, action) => {
        state.rowActions[action.meta.arg] = 'resetAdminId';
      })
      .addCase(resetAdminLoginId.fulfilled, (state, action) => {
        delete state.rowActions[action.payload.id];
        delete state.rowErrors[action.payload.id];
        const idx = state.admins.findIndex((a) => getAdminRecordId(a) === action.payload.id);
        if (idx !== -1 && action.payload.newAdminId) {
          state.admins[idx] = { ...state.admins[idx], adminId: action.payload.newAdminId };
        }
        state.lastAdminIdReset = {
          id: action.payload.id,
          newAdminId: action.payload.newAdminId,
        };
        state.successMessage = action.payload.message;
      })
      .addCase(resetAdminLoginId.rejected, (state, action) => {
        delete state.rowActions[action.meta.arg];
        state.rowErrors[action.meta.arg] = action.payload || 'Failed to reset admin ID';
      });
  },
});

export const {
  setAdminsFilters,
  clearManageAdminsMessages,
  clearPasswordReset,
  clearAdminIdReset,
} = manageAdminsSlice.actions;

export default manageAdminsSlice.reducer;

// ------------------------------------
// SELECTORS
// ------------------------------------
export const selectManageAdminsList = (state) => state.manageAdmins.admins;
export const selectManageAdminsListStatus = (state) => state.manageAdmins.listStatus;
export const selectManageAdminsListError = (state) => state.manageAdmins.listError;
export const selectManageAdminsPagination = (state) => state.manageAdmins.pagination;
export const selectManageAdminsFilters = (state) => state.manageAdmins.filters;
export const selectManageAdminsCreateLoading = (state) => state.manageAdmins.createLoading;
export const selectManageAdminsCreateError = (state) => state.manageAdmins.createError;
export const selectManageAdminsRowActions = (state) => state.manageAdmins.rowActions;
export const selectManageAdminsRowErrors = (state) => state.manageAdmins.rowErrors;
export const selectManageAdminsSuccessMessage = (state) => state.manageAdmins.successMessage;
export const selectManageAdminsLastPasswordReset = (state) => state.manageAdmins.lastPasswordReset;
export const selectManageAdminsLastAdminIdReset = (state) => state.manageAdmins.lastAdminIdReset;