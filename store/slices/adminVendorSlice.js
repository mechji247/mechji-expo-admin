import adminApi from '../../lib/services/adminApi.js';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const getErrorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback;

// ------------------------------------
// GET SINGLE VENDOR
// ------------------------------------
export const fetchVendorAdminView = createAsyncThunk(
  'adminVendor/fetchVendorAdminView',
  async (vendorId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get(`/vendors/vendor/${vendorId}`);
      return data?.vendor ?? data?.data ?? data;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to load vendor details'));
    }
  }
);

// ------------------------------------
// UPDATE PROFILE

export const updateVendorProfile = createAsyncThunk(
  'adminVendor/updateVendorProfile',
  async ({ vendorId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/vendors/vendor/${vendorId}/profile`, payload);
      return {
        vendor: data?.data ?? data?.vendor ?? data,
        message: data?.message || 'Vendor profile updated',
      };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to update vendor profile'));
    }
  }
);

// ------------------------------------
// APPROVE
// PATCH /admin/vendors/:vendorId/approve
// ------------------------------------
export const approveVendor = createAsyncThunk(
  'adminVendor/approveVendor',
  async (vendorId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/vendors/vendor/${vendorId}/approve`);
      return {
        vendor: data?.data ?? data?.vendor ?? data,
        message: data?.message || 'Vendor approved',
      };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to approve vendor'));
    }
  }
);

// ------------------------------------
// REJECT
// PATCH /admin/vendors/:vendorId/reject
// payload: { reason }
// ------------------------------------
export const rejectVendor = createAsyncThunk(
  'adminVendor/rejectVendor',
  async ({ vendorId, reason }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/vendors/vendor/${vendorId}/reject`, { reason });
      return {
        vendor: data?.data ?? data?.vendor ?? data,
        message: data?.message || 'Vendor rejected',
      };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to reject vendor'));
    }
  }
);

// ------------------------------------
// SUSPEND
// PATCH /admin/vendors/:vendorId/suspend
// payload: { reasons: string[], otherReason?: string }
// Writes to storeStatus.suspension.{reason,suspendedAt} and flips
// storeStatus.status to "suspended" on the backend. Note the schema's
// storeStatus.status enum also allows paused/closed/blacklisted now —
// no thunk exists for those yet.
// ------------------------------------
export const suspendVendor = createAsyncThunk(
  'adminVendor/suspendVendor',
  async ({ vendorId, reasons = [], otherReason = null }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/vendors/vendor/${vendorId}/suspend`, {
        reasons,
        otherReason,
      });
      return {
        vendor: data?.data ?? data?.vendor ?? data,
        message: data?.message || 'Vendor suspended',
      };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to suspend vendor'));
    }
  }
);

// ------------------------------------
// REINSTATE
// PATCH /admin/vendors/:vendorId/reinstate
// ------------------------------------
export const reinstateVendor = createAsyncThunk(
  'adminVendor/reinstateVendor',
  async (vendorId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/vendors/vendor/${vendorId}/reinstate`);
      return {
        vendor: data?.data ?? data?.vendor ?? data,
        message: data?.message || 'Vendor reinstated',
      };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to reinstate vendor'));
    }
  }
);

// ------------------------------------
// UPDATE COMMISSION
// PATCH /admin/vendors/:vendorId/commission
// payload: { flatRate?, percentageRate?, serviceRate?, productThreshold?, appliesTo? }
// Matches commission.* on the schema — unchanged by the recent restructuring.
// ------------------------------------
export const updateVendorCommission = createAsyncThunk(
  'adminVendor/updateVendorCommission',
  async ({ vendorId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/vendors/vendor/${vendorId}/commission`, payload);
      return {
        commission: data?.data ?? data?.commission ?? null,
        message: data?.message || 'Commission updated',
      };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to update commission'));
    }
  }
);

// ------------------------------------
// WAIVE COMMISSION
// PATCH /admin/vendors/:vendorId/commission/waive
// payload: { amount }
// ------------------------------------
export const waiveVendorCommission = createAsyncThunk(
  'adminVendor/waiveVendorCommission',
  async ({ vendorId, amount }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/vendors/vendor/${vendorId}/commission/waive`, {
        amount,
      });
      return {
        commission: data?.data ?? data?.commission ?? null,
        message: data?.message || 'Commission waived',
      };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to waive commission'));
    }
  }
);

// ------------------------------------
// CANCEL SUBSCRIPTION
// PATCH /admin/vendors/:vendorId/subscription/cancel
// payload: { reason? }
// ------------------------------------
export const cancelVendorSubscription = createAsyncThunk(
  'adminVendor/cancelVendorSubscription',
  async ({ vendorId, reason }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/vendors/vendor/${vendorId}/subscription/cancel`, {
        reason,
      });
      return {
        subscription: data?.data ?? data?.subscription ?? null,
        message: data?.message || 'Subscription cancelled',
      };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to cancel subscription'));
    }
  }
);

// ------------------------------------
// SOFT DELETE
// DELETE /admin/vendors/:vendorId
// ------------------------------------
export const softDeleteVendor = createAsyncThunk(
  'adminVendor/softDeleteVendor',
  async (vendorId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.delete(`/vendors/vendor/${vendorId}`);
      return {
        vendorId,
        message: data?.message || 'Vendor deleted',
      };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to delete vendor'));
    }
  }
);

// ------------------------------------
// RESTORE
// PATCH /admin/vendors/:vendorId/restore
// ------------------------------------
export const restoreVendor = createAsyncThunk(
  'adminVendor/restoreVendor',
  async (vendorId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/vendors/vendor/${vendorId}/restore`);
      return {
        vendor: data?.data ?? data?.vendor ?? data,
        message: data?.message || 'Vendor restored',
      };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Failed to restore vendor'));
    }
  }
);

// ------------------------------------
// SUBMIT VERIFICATION BATCH
// PATCH /admin/vendors/:vendorId/verification/batch
// payload: { documents: [...], coverImages: [...], coverVideos: [...] }
// `coverImages` was `businessImages` (renamed to match media.coverImages);
// `coverVideos` is new (media.coverVideos exists on the schema but had no
// verification workflow before); there is no `bankDetails` entry anymore —
// the schema does not define a bankDetails field, so there is nothing to
// stage or submit for it.
// ------------------------------------
export const submitVendorVerificationBatch = createAsyncThunk(
  'adminVendor/submitVendorVerificationBatch',
  async ({ vendorId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(
        `/vendors/vendor/${vendorId}/verification/batch`,
        payload
      );
      return {
        vendor: data?.data ?? data?.vendor ?? data,
        message: data?.message || 'Verification changes submitted',
      };
    } catch (err) {
      return rejectWithValue(
        getErrorMessage(err, 'Failed to submit verification changes')
      );
    }
  }
);

const emptyStagedVerification = () => ({
  documents: {},
  coverImages: {},
  coverVideos: {},
});

const initialState = {
  vendor: null,
  status: 'idle',
  error: null,

  // Locally-staged verify/reject decisions for documents, cover images, and
  // cover videos. Nothing here has reached the backend yet — it's only sent
  // once via submitVendorVerificationBatch.
  stagedVerification: emptyStagedVerification(),

  actionLoading: {
    profile: false,
    approve: false,
    reject: false,
    suspend: false,
    reinstate: false,
    // verifyDocument/rejectDocument/verifyCoverImage/rejectCoverImage/
    // verifyCoverVideo/rejectCoverVideo are placeholders only — staging a
    // decision is a synchronous reducer (stageDocumentDecision etc.), not
    // an async thunk, so nothing in extraReducers ever toggles these. Left
    // in for whoever eventually makes per-item staging hit the network;
    // not something this pass changed the behavior of.
    verifyDocument: false,
    rejectDocument: false,
    verifyCoverImage: false,
    rejectCoverImage: false,
    verifyCoverVideo: false,
    rejectCoverVideo: false,
    updateCommission: false,
    waiveCommission: false,
    cancelSubscription: false,
    softDelete: false,
    restore: false,
    submitVerificationBatch: false,
  },

  actionError: {
    profile: null,
    approve: null,
    reject: null,
    suspend: null,
    reinstate: null,
    verifyDocument: null,
    rejectDocument: null,
    verifyCoverImage: null,
    rejectCoverImage: null,
    verifyCoverVideo: null,
    rejectCoverVideo: null,
    updateCommission: null,
    waiveCommission: null,
    cancelSubscription: null,
    softDelete: null,
    restore: null,
    submitVerificationBatch: null,
  },

  successMessage: null,
};

const adminVendorSlice = createSlice({
  name: 'adminVendor',
  initialState,
  reducers: {
    clearAdminVendor(state) {
      state.vendor = null;
      state.status = 'idle';
      state.error = null;
      state.successMessage = null;
      state.stagedVerification = emptyStagedVerification();
    },
    clearAdminVendorMessages(state) {
      state.error = null;
      state.successMessage = null;

      Object.keys(state.actionError).forEach((key) => {
        state.actionError[key] = null;
      });
    },

    // Stage a verify/reject decision for one document. Purely local —
    // no request is made until submitVendorVerificationBatch runs.
    stageDocumentDecision(state, action) {
      const { documentKey, decision, note, label } = action.payload;
      state.stagedVerification.documents[documentKey] = {
        decision,
        note: note || null,
        label: label || null,
      };
    },

    // Stage a verify/reject decision for one media.coverImages entry.
    // Renamed from stageBusinessImageDecision — the schema field is
    // media.coverImages, not a top-level businessImages array.
    stageCoverImageDecision(state, action) {
      const { imageKey, decision, note, label } = action.payload;
      state.stagedVerification.coverImages[imageKey] = {
        decision,
        note: note || null,
        label: label || null,
      };
    },

    // Stage a verify/reject decision for one media.coverVideos entry.
    // New — media.coverVideos existed on the schema but had no staging
    // action before.
    stageCoverVideoDecision(state, action) {
      const { videoKey, decision, note, label } = action.payload;
      state.stagedVerification.coverVideos[videoKey] = {
        decision,
        note: note || null,
        label: label || null,
      };
    },

    // Remove one staged decision before it's submitted.
    // payload: { group: 'documents' | 'coverImages' | 'coverVideos', key }
    // No more special-cased 'bankDetails' branch — the schema doesn't
    // define that field, so every remaining group is a plain keyed object
    // and can go through the same delete.
    unstageDecision(state, action) {
      const { group, key } = action.payload;
      if (state.stagedVerification[group] && key) {
        delete state.stagedVerification[group][key];
      }
    },

    // Discard every staged decision without submitting.
    clearStagedDecisions(state) {
      state.stagedVerification = emptyStagedVerification();
      state.actionError.submitVerificationBatch = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // FETCH
      .addCase(fetchVendorAdminView.pending, (state) => {
        state.status = 'loading';
        state.error = null;
        // Never carry staged decisions from one vendor into another.
        state.stagedVerification = emptyStagedVerification();
      })
      .addCase(fetchVendorAdminView.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.vendor = action.payload;
      })
      .addCase(fetchVendorAdminView.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message;
      })

      // UPDATE PROFILE
      .addCase(updateVendorProfile.pending, (state) => {
        state.actionLoading.profile = true;
        state.actionError.profile = null;
        state.successMessage = null;
      })
      .addCase(updateVendorProfile.fulfilled, (state, action) => {
        state.actionLoading.profile = false;
        state.vendor = action.payload.vendor;
        state.successMessage = action.payload.message;
      })
      .addCase(updateVendorProfile.rejected, (state, action) => {
        state.actionLoading.profile = false;
        state.actionError.profile = action.payload || action.error.message;
      })

      // APPROVE
      .addCase(approveVendor.pending, (state) => {
        state.actionLoading.approve = true;
        state.actionError.approve = null;
        state.successMessage = null;
      })
      .addCase(approveVendor.fulfilled, (state, action) => {
        state.actionLoading.approve = false;
        state.vendor = action.payload.vendor;
        state.successMessage = action.payload.message;
      })
      .addCase(approveVendor.rejected, (state, action) => {
        state.actionLoading.approve = false;
        state.actionError.approve = action.payload || action.error.message;
      })

      // REJECT
      .addCase(rejectVendor.pending, (state) => {
        state.actionLoading.reject = true;
        state.actionError.reject = null;
        state.successMessage = null;
      })
      .addCase(rejectVendor.fulfilled, (state, action) => {
        state.actionLoading.reject = false;
        state.vendor = action.payload.vendor;
        state.successMessage = action.payload.message;
      })
      .addCase(rejectVendor.rejected, (state, action) => {
        state.actionLoading.reject = false;
        state.actionError.reject = action.payload || action.error.message;
      })

      // SUSPEND
      .addCase(suspendVendor.pending, (state) => {
        state.actionLoading.suspend = true;
        state.actionError.suspend = null;
        state.successMessage = null;
      })
      .addCase(suspendVendor.fulfilled, (state, action) => {
        state.actionLoading.suspend = false;
        state.vendor = action.payload.vendor;
        state.successMessage = action.payload.message;
      })
      .addCase(suspendVendor.rejected, (state, action) => {
        state.actionLoading.suspend = false;
        state.actionError.suspend = action.payload || action.error.message;
      })

      // REINSTATE
      .addCase(reinstateVendor.pending, (state) => {
        state.actionLoading.reinstate = true;
        state.actionError.reinstate = null;
        state.successMessage = null;
      })
      .addCase(reinstateVendor.fulfilled, (state, action) => {
        state.actionLoading.reinstate = false;
        state.vendor = action.payload.vendor;
        state.successMessage = action.payload.message;
      })
      .addCase(reinstateVendor.rejected, (state, action) => {
        state.actionLoading.reinstate = false;
        state.actionError.reinstate = action.payload || action.error.message;
      })

      // UPDATE COMMISSION
      .addCase(updateVendorCommission.pending, (state) => {
        state.actionLoading.updateCommission = true;
        state.actionError.updateCommission = null;
        state.successMessage = null;
      })
      .addCase(updateVendorCommission.fulfilled, (state, action) => {
        state.actionLoading.updateCommission = false;
        if (state.vendor) {
          state.vendor.commission = action.payload.commission;
        }
        state.successMessage = action.payload.message;
      })
      .addCase(updateVendorCommission.rejected, (state, action) => {
        state.actionLoading.updateCommission = false;
        state.actionError.updateCommission = action.payload || action.error.message;
      })

      // WAIVE COMMISSION
      .addCase(waiveVendorCommission.pending, (state) => {
        state.actionLoading.waiveCommission = true;
        state.actionError.waiveCommission = null;
        state.successMessage = null;
      })
      .addCase(waiveVendorCommission.fulfilled, (state, action) => {
        state.actionLoading.waiveCommission = false;
        if (state.vendor) {
          state.vendor.commission = action.payload.commission;
        }
        state.successMessage = action.payload.message;
      })
      .addCase(waiveVendorCommission.rejected, (state, action) => {
        state.actionLoading.waiveCommission = false;
        state.actionError.waiveCommission = action.payload || action.error.message;
      })

      // CANCEL SUBSCRIPTION
      .addCase(cancelVendorSubscription.pending, (state) => {
        state.actionLoading.cancelSubscription = true;
        state.actionError.cancelSubscription = null;
        state.successMessage = null;
      })
      .addCase(cancelVendorSubscription.fulfilled, (state, action) => {
        state.actionLoading.cancelSubscription = false;
        if (state.vendor) {
          state.vendor.subscription = action.payload.subscription;
        }
        state.successMessage = action.payload.message;
      })
      .addCase(cancelVendorSubscription.rejected, (state, action) => {
        state.actionLoading.cancelSubscription = false;
        state.actionError.cancelSubscription = action.payload || action.error.message;
      })

      // SOFT DELETE
      .addCase(softDeleteVendor.pending, (state) => {
        state.actionLoading.softDelete = true;
        state.actionError.softDelete = null;
        state.successMessage = null;
      })
      .addCase(softDeleteVendor.fulfilled, (state, action) => {
        state.actionLoading.softDelete = false;
        if (state.vendor) {
          state.vendor.isDeleted = true;
          state.vendor.deletedAt = new Date().toISOString();
        }
        state.successMessage = action.payload.message;
      })
      .addCase(softDeleteVendor.rejected, (state, action) => {
        state.actionLoading.softDelete = false;
        state.actionError.softDelete = action.payload || action.error.message;
      })

      // RESTORE
      .addCase(restoreVendor.pending, (state) => {
        state.actionLoading.restore = true;
        state.actionError.restore = null;
        state.successMessage = null;
      })
      .addCase(restoreVendor.fulfilled, (state, action) => {
        state.actionLoading.restore = false;
        state.vendor = action.payload.vendor;
        state.successMessage = action.payload.message;
      })
      .addCase(restoreVendor.rejected, (state, action) => {
        state.actionLoading.restore = false;
        state.actionError.restore = action.payload || action.error.message;
      })

      // SUBMIT VERIFICATION BATCH
      .addCase(submitVendorVerificationBatch.pending, (state) => {
        state.actionLoading.submitVerificationBatch = true;
        state.actionError.submitVerificationBatch = null;
        state.successMessage = null;
      })
      .addCase(submitVendorVerificationBatch.fulfilled, (state, action) => {
        state.actionLoading.submitVerificationBatch = false;
        if (action.payload.vendor) {
          state.vendor = action.payload.vendor;
        }
        state.stagedVerification = emptyStagedVerification();
        state.successMessage = action.payload.message;
      })
      .addCase(submitVendorVerificationBatch.rejected, (state, action) => {
        state.actionLoading.submitVerificationBatch = false;
        state.actionError.submitVerificationBatch =
          action.payload || action.error.message;
      });
  },
});

export const {
  clearAdminVendor,
  clearAdminVendorMessages,
  stageDocumentDecision,
  stageCoverImageDecision,
  stageCoverVideoDecision,
  unstageDecision,
  clearStagedDecisions,
} = adminVendorSlice.actions;

export default adminVendorSlice.reducer;

// ------------------------------------
// SELECTORS
// ------------------------------------
export const selectAdminVendor = (state) => state.adminVendor.vendor;
export const selectAdminVendorStatus = (state) => state.adminVendor.status;
export const selectAdminVendorError = (state) => state.adminVendor.error;
export const selectAdminVendorSuccessMessage = (state) => state.adminVendor.successMessage;
export const selectAdminVendorActionLoading = (state) => state.adminVendor.actionLoading;
export const selectAdminVendorActionError = (state) => state.adminVendor.actionError;
export const selectAdminVendorStagedVerification = (state) => state.adminVendor.stagedVerification;
export const selectAdminVendorBatchSubmitLoading = (state) => state.adminVendor.actionLoading.submitVerificationBatch;
export const selectAdminVendorBatchSubmitError = (state) => state.adminVendor.actionError.submitVerificationBatch;