import adminApi from '../../lib/services/adminApi.js';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const initialState = {
  currentUser: null,
  currentUserId: null,

  loading: false,
  updateLoading: false,
  deleteLoading: false,
  restoreLoading: false,

  error: null,
  successMessage: null,
};

export const getAdminUserById = createAsyncThunk(
  'adminCurrentUser/getAdminUserById',
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get(`/users/user/${userId}`);

      return {
        userId,
        user :  data?.user || null,
        message: data?.message || null,
      };
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to fetch user details'
      );
    }
  }
);

export const updateAdminUser = createAsyncThunk(
  'adminCurrentUser/updateAdminUser',
  async ({ userId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/users/user/${userId}`, payload);

      return {
        userId,
        user: data?.user || null,
        message: data?.message || 'User updated successfully',
      };
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to update user'
      );
    }
  }
);

export const updateAdminUserStatus = createAsyncThunk(
  'adminCurrentUser/updateAdminUserStatus',
  async ({ userId, accountStatus }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/users/user/${userId}/status`, {
        accountStatus,
      });

      return {
        userId,
        user: data?.user || null,
        message: data?.message || 'User status updated successfully',
      };
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to update user status'
      );
    }
  }
);

export const softDeleteAdminUser = createAsyncThunk(
  'adminCurrentUser/softDeleteAdminUser',
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.delete(`/users/user/${userId}/delete`);

      return {
        userId,
        user: data?.user || null,
        message: data?.message || 'User deleted successfully',
      };
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to delete user'
      );
    }
  }
);

export const restoreAdminUser = createAsyncThunk(
  'adminCurrentUser/restoreAdminUser',
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/users/user/${userId}/restore`);

      return {
        userId,
        user: data?.user || null,
        message: data?.message || 'User restored successfully',
      };
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to restore user'
      );
    }
  }
);

const adminCurrentUserSlice = createSlice({
  name: 'adminCurrentUser',
  initialState,
  reducers: {
    clearAdminCurrentUserState: (state) => {
      state.loading = false;
      state.updateLoading = false;
      state.deleteLoading = false;
      state.restoreLoading = false;
      state.error = null;
      state.successMessage = null;
    },
    clearCurrentAdminUser: (state) => {
      state.currentUser = null;
      state.currentUserId = null;
      state.loading = false;
      state.updateLoading = false;
      state.deleteLoading = false;
      state.restoreLoading = false;
      state.error = null;
      state.successMessage = null;
    },
    setCurrentAdminUserLocally: (state, action) => {
      const user = action.payload;
      state.currentUser = user;
      state.currentUserId = user?._id || user?.id || null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getAdminUserById.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(getAdminUserById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload.user;
        state.currentUserId =
          action.payload.user?._id || action.payload.user?.id || action.payload.userId;
        state.successMessage = action.payload.message;
      })
      .addCase(getAdminUserById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch user details';
      })

      .addCase(updateAdminUser.pending, (state) => {
        state.updateLoading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(updateAdminUser.fulfilled, (state, action) => {
        state.updateLoading = false;
        state.currentUser = action.payload.user;
        state.currentUserId =
          action.payload.user?._id || action.payload.user?.id || action.payload.userId;
        state.successMessage = action.payload.message;
      })
      .addCase(updateAdminUser.rejected, (state, action) => {
        state.updateLoading = false;
        state.error = action.payload || 'Failed to update user';
      })

      .addCase(updateAdminUserStatus.pending, (state) => {
        state.updateLoading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(updateAdminUserStatus.fulfilled, (state, action) => {
        state.updateLoading = false;
        state.currentUser = action.payload.user;
        state.currentUserId =
          action.payload.user?._id || action.payload.user?.id || action.payload.userId;
        state.successMessage = action.payload.message;
      })
      .addCase(updateAdminUserStatus.rejected, (state, action) => {
        state.updateLoading = false;
        state.error = action.payload || 'Failed to update user status';
      })

      .addCase(softDeleteAdminUser.pending, (state) => {
        state.deleteLoading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(softDeleteAdminUser.fulfilled, (state, action) => {
        state.deleteLoading = false;
        state.currentUser = action.payload.user;
        state.currentUserId =
          action.payload.user?._id || action.payload.user?.id || action.payload.userId;
        state.successMessage = action.payload.message;
      })
      .addCase(softDeleteAdminUser.rejected, (state, action) => {
        state.deleteLoading = false;
        state.error = action.payload || 'Failed to delete user';
      })

      .addCase(restoreAdminUser.pending, (state) => {
        state.restoreLoading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(restoreAdminUser.fulfilled, (state, action) => {
        state.restoreLoading = false;
        state.currentUser = action.payload.user;
        state.currentUserId =
          action.payload.user?._id || action.payload.user?.id || action.payload.userId;
        state.successMessage = action.payload.message;
      })
      .addCase(restoreAdminUser.rejected, (state, action) => {
        state.restoreLoading = false;
        state.error = action.payload || 'Failed to restore user';
      });
  },
});

export const selectAdminCurrentUserState = (state) => state.adminCurrentUser;
export const selectCurrentAdminUser = (state) => state.adminCurrentUser.currentUser;
export const selectCurrentAdminUserId = (state) => state.adminCurrentUser.currentUserId;
export const selectAdminCurrentUserLoading = (state) => state.adminCurrentUser.loading;
export const selectAdminCurrentUserUpdateLoading = (state) => state.adminCurrentUser.updateLoading;
export const selectAdminCurrentUserDeleteLoading = (state) => state.adminCurrentUser.deleteLoading;
export const selectAdminCurrentUserRestoreLoading = (state) => state.adminCurrentUser.restoreLoading;
export const selectAdminCurrentUserError = (state) => state.adminCurrentUser.error;
export const selectAdminCurrentUserSuccessMessage = (state) => state.adminCurrentUser.successMessage;

export const {
  clearAdminCurrentUserState,
  clearCurrentAdminUser,
  setCurrentAdminUserLocally,
} = adminCurrentUserSlice.actions;

export default adminCurrentUserSlice.reducer;