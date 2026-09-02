import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import adminApi from '../../lib/services/adminApi';
import { saveTokens } from '../../lib/tokens/secureTokens';
import log from '../../lib/utils/logger';

const initialState = {
  adminInfo: null,
  isAuthenticated: false,
  accountType: 'admin',
  mfaRequired: false,
  mfaSetupRequired: false,
  challengeToken: null,
  loading: false,
  refreshLoading: false,
  initialized: false,
  error: null,
  statusMessage: null,
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const clearTransientAuthState = (state) => {
  state.error = null;
  state.statusMessage = null;
};

const clearMfaFlags = (state) => {
  state.mfaRequired = false;
  state.mfaSetupRequired = false;
  state.challengeToken = null;
};

const clearAdminSessionState = (state) => {
  state.adminInfo = null;
  state.isAuthenticated = false;
  clearMfaFlags(state);
};

export const adminLogin = createAsyncThunk(
  'mechjiAdmin/login',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.post(`/auth/login`, payload);
      await saveTokens({ accessToken : data?.accessToken , refreshToken : data?.refreshToken })
      return data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Admin login failed'));
    }
  }
);

export const verifyAdminMfa = createAsyncThunk(
  'mechjiAdmin/verifyMfa',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await adminApi.post(`/auth/mfa/verify`, payload);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'MFA verification failed'));
    }
  }
);

export const refreshAdminSession = createAsyncThunk(
  'mechjiAdmin/refreshSession',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.post(`/auth/refresh`, { clientType : "expo" });
      await saveTokens({ accessToken : data?.accessToken , refreshToken : data?.refreshToken })
      return data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Unable to refresh admin session'));
    }
  }
);

export const fetchAdminProfile = createAsyncThunk(
  'mechjiAdmin/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await adminApi.get(`/auth/me`);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch admin profile'));
    }
  }
);

export const adminLogout = createAsyncThunk(
  'mechjiAdmin/logout',
  async (_, { rejectWithValue }) => {
    try {
      const response = await adminApi.post(`/auth/logout`);
      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Admin logout failed'));
    }
  }
);

const adminSlice = createSlice({
  name: 'mechjiAdmin',
  initialState,
  reducers: {
    clearAdminError: (state) => {
      state.error = null;
    },
    clearAdminStatusMessage: (state) => {
      state.statusMessage = null;
    },
    clearMfaState: (state) => {
      clearMfaFlags(state);
    },
    setAdminFromServer: (state, action) => {
      state.adminInfo = action.payload || null;
      state.isAuthenticated = Boolean(action.payload);
      state.accountType = 'admin';
      state.initialized = true;

      if (action.payload) {
        clearMfaFlags(state);
      }
    },
    resetAdminAuthState: () => ({
      ...initialState,
      initialized: true,
    }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(adminLogin.pending, (state) => {
        state.loading = true;
        clearTransientAuthState(state);
        clearMfaFlags(state);
        state.isAuthenticated = false;
      })
      .addCase(adminLogin.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.error = null;
        state.statusMessage = action.payload?.message || null;
        state.mfaRequired = Boolean(action.payload?.mfaRequired);
        state.mfaSetupRequired = Boolean(action.payload?.mfaSetupRequired);
        state.challengeToken = action.payload?.challengeToken || null;
        state.adminInfo = action.payload?.admin || null;
        state.isAuthenticated = Boolean(
          action.payload?.admin &&
          !action.payload?.mfaRequired &&
          !action.payload?.mfaSetupRequired
        );
      })
      .addCase(adminLogin.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        clearAdminSessionState(state);
        state.error = action.payload || 'Admin login failed';
      })

      .addCase(verifyAdminMfa.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.statusMessage = null;
      })
      .addCase(verifyAdminMfa.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        clearMfaFlags(state);
        state.error = null;
        state.adminInfo = action.payload?.admin || null;
        state.isAuthenticated = Boolean(action.payload?.admin);
        state.statusMessage = action.payload?.message || 'MFA verified successfully';
      })
      .addCase(verifyAdminMfa.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.error = action.payload || 'MFA verification failed';
      })

      .addCase(refreshAdminSession.pending, (state) => {
        state.refreshLoading = true;
        state.error = null;
      })
      .addCase(refreshAdminSession.fulfilled, (state, action) => {
        state.refreshLoading = false;
        state.initialized = true;
        state.statusMessage = action.payload?.message || null;
      })
      .addCase(refreshAdminSession.rejected, (state, action) => {
        state.refreshLoading = false;
        state.initialized = true;
        clearAdminSessionState(state);
        state.error = action.payload || 'Unable to refresh admin session';
      })

      .addCase(fetchAdminProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.error = null;
        state.adminInfo = action.payload?.admin || null;
        state.isAuthenticated = Boolean(action.payload?.admin);
        if (action.payload?.admin) {
          clearMfaFlags(state);
        }
      })
      .addCase(fetchAdminProfile.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        clearAdminSessionState(state);
        state.error = action.payload || 'Failed to fetch admin profile';
      })

      .addCase(adminLogout.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(adminLogout.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        clearAdminSessionState(state);
        state.statusMessage = action.payload?.message || 'Logged out successfully';
      })
      .addCase(adminLogout.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.error = action.payload || 'Admin logout failed';
      });
  },
});

export const {
  clearAdminError,
  clearAdminStatusMessage,
  clearMfaState,
  setAdminFromServer,
  resetAdminAuthState,
} = adminSlice.actions;

export const selectAdminState = (state) => state.mechjiAdmin;
export const selectAdminInfo = (state) => state.mechjiAdmin.adminInfo;
export const selectAdminId = (state) => state.mechjiAdmin.adminInfo?.adminId || null;
export const selectAdminRole = (state) => state.mechjiAdmin.adminInfo?.role || null;
export const selectAdminPermissions = (state) => state.mechjiAdmin.adminInfo?.permissions || [];
export const selectIsAdminAuthenticated = (state) => state.mechjiAdmin.isAuthenticated;
export const selectAdminLoading = (state) => state.mechjiAdmin.loading;
export const selectAdminRefreshLoading = (state) => state.mechjiAdmin.refreshLoading;
export const selectAdminInitialized = (state) => state.mechjiAdmin.initialized;
export const selectAdminError = (state) => state.mechjiAdmin.error;
export const selectAdminStatusMessage = (state) => state.mechjiAdmin.statusMessage;
export const selectAdminMfaRequired = (state) => state.mechjiAdmin.mfaRequired;
export const selectAdminMfaSetupRequired = (state) => state.mechjiAdmin.mfaSetupRequired;
export const selectAdminChallengeToken = (state) => state.mechjiAdmin.challengeToken;
export const selectAdminMustChangePassword = (state) => Boolean(state.mechjiAdmin.adminInfo?.mustChangePassword);
export const selectAdminStatus = (state) => {
  const { initialized, isAuthenticated, mfaRequired, mfaSetupRequired } = state?.mechjiAdmin;
  if (!initialized) return 'bootstrapping';
  if (mfaRequired || mfaSetupRequired) return 'mfaRequired';
  if (isAuthenticated) return 'authenticated';
  return 'unauthenticated';
};

export default adminSlice.reducer;