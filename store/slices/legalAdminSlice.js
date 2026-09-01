import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import { backendUrl } from '../../lib/utils/env';

const API_BASE = `${backendUrl}/api/legal/admin`;

export const LEGAL_DOC_TYPES = [
  'privacy-policy',
  'terms-and-conditions',
  'acceptable-use-policy',
  'cookie-policy',
  'grievance-redressal-policy',
  'disclaimer',
  'return-refund-cancellation-policy',
  'shipping-delivery-policy',
  'account-deletion-policy',
  'data-retention-policy',
  'vendor-agreement',
  'vendor-guidelines',
  'vendor-commission-policy',
  'prohibited-items-policy',
];

export const LEGAL_AUDIENCES = ['user', 'vendor', 'both'];
export const LEGAL_STATUSES = ['draft', 'review', 'published', 'archived'];

const APP_DEFAULT = {
  appId: 'mechji-web',
  appName: 'Mechji Web',
  platform: 'web',
};

const buildAuthConfig = (params = {}) => ({
  withCredentials: true,
  params,
});

const getErrorPayload = (error) => ({
  message:
    error?.response?.data?.message ||
    error?.message ||
    'Something went wrong',
  errors: error?.response?.data?.errors || [],
  status: error?.response?.status || 500,
});

const upsertDocInList = (documents, updatedDoc) => {
  const exists = documents.some((doc) => doc._id === updatedDoc._id);
  if (!exists) return [updatedDoc, ...documents];
  return documents.map((doc) => (doc._id === updatedDoc._id ? updatedDoc : doc));
};

const removeDocFromList = (documents, id) =>
  documents.filter((doc) => doc._id !== id);

// =========================
// THUNKS
// =========================

export const fetchLegalDocuments = createAsyncThunk(
  'legalAdmin/fetchLegalDocuments',
  async ({ filters = {} } = {}, thunkAPI) => {
    try {
      const { data } = await axios.get(`${API_BASE}/all`, buildAuthConfig(filters));
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(getErrorPayload(error));
    }
  }
);

export const fetchLegalDocumentById = createAsyncThunk(
  'legalAdmin/fetchLegalDocumentById',
  async ({ id }, thunkAPI) => {
    try {
      const { data } = await axios.get(`${API_BASE}/${id}`, buildAuthConfig());
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(getErrorPayload(error));
    }
  }
);

export const createLegalDocument = createAsyncThunk(
  'legalAdmin/createLegalDocument',
  async ({ payload }, thunkAPI) => {
    try {
      const { data } = await axios.post(`${API_BASE}`, payload, {
        withCredentials: true,
      });
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(getErrorPayload(error));
    }
  }
);

export const updateLegalDocument = createAsyncThunk(
  'legalAdmin/updateLegalDocument',
  async ({ id, payload }, thunkAPI) => {
    try {
      const { data } = await axios.patch(`${API_BASE}/${id}`, payload, {
        withCredentials: true,
      });
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(getErrorPayload(error));
    }
  }
);

export const publishLegalDocument = createAsyncThunk(
  'legalAdmin/publishLegalDocument',
  async ({ id }, thunkAPI) => {
    try {
      const { data } = await axios.patch(
        `${API_BASE}/${id}/publish`,
        {},
        { withCredentials: true }
      );
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(getErrorPayload(error));
    }
  }
);

export const archiveLegalDocument = createAsyncThunk(
  'legalAdmin/archiveLegalDocument',
  async ({ id }, thunkAPI) => {
    try {
      const { data } = await axios.patch(
        `${API_BASE}/${id}/archive`,
        {},
        { withCredentials: true }
      );
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(getErrorPayload(error));
    }
  }
);

export const deleteLegalDocument = createAsyncThunk(
  'legalAdmin/deleteLegalDocument',
  async ({ id }, thunkAPI) => {
    try {
      const { data } = await axios.delete(`${API_BASE}/${id}`, {
        withCredentials: true,
      });
      return { ...data, id };
    } catch (error) {
      return thunkAPI.rejectWithValue(getErrorPayload(error));
    }
  }
);

export const cloneLegalDocumentDraft = createAsyncThunk(
  'legalAdmin/cloneLegalDocumentDraft',
  async ({ id }, thunkAPI) => {
    try {
      const { data } = await axios.post(
        `${API_BASE}/${id}/clone-draft`,
        {},
        { withCredentials: true }
      );
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(getErrorPayload(error));
    }
  }
);

// =========================
// HELPERS
// =========================

export const getDefaultLegalDocumentPayload = ({
  docType = 'privacy-policy',
  audience = 'user',
  locale = 'en',
} = {}) => ({
  docType,
  audience,
  locale,
  slug: `${docType}-${audience}-${locale}`,
  version: '1.0',
  effectiveDate: new Date().toISOString(),
  status: 'draft',
  isActive: false,
  title: '',
  subtitle: '',
  heroIcon: 'document-text-outline',
  legalTags: [],
  highlights: [],
  summary: '',
  sections: [
    {
      id: 'overview',
      title: 'Overview',
      icon: 'document-text-outline',
      color: '#01696f',
      content: [
        {
          type: 'paragraph',
          title: '',
          text: '',
          items: [],
        },
      ],
    },
  ],
  previousVersionId: null,
  applicableApps: [APP_DEFAULT],
});

// =========================
// INITIAL STATE
// =========================

const initialState = {
  documents: [],
  selectedDocument: null,
  count: 0,

  filters: {
    docType: '',
    audience: '',
    locale: 'en',
    status: '',
    isActive: '',
    appId: 'mechji-web',
  },

  loadingList: false,
  loadingDocument: false,
  submitting: false,

  success: false,
  error: null,
  errors: [],
  message: null,
};

// =========================
// SLICE
// =========================

const legalAdminSlice = createSlice({
  name: 'legalAdmin',
  initialState,
  reducers: {
    setLegalFilters: (state, action) => {
      state.filters = {
        ...state.filters,
        ...action.payload,
      };
    },

    resetLegalFilters: (state) => {
      state.filters = initialState.filters;
    },

    clearLegalAdminFeedback: (state) => {
      state.success = false;
      state.error = null;
      state.errors = [];
      state.message = null;
    },

    clearSelectedLegalDocument: (state) => {
      state.selectedDocument = null;
    },

    resetLegalAdminState: () => initialState,
  },

  extraReducers: (builder) => {
    builder

      // FETCH ALL
      .addCase(fetchLegalDocuments.pending, (state) => {
        state.loadingList = true;
        state.error = null;
        state.errors = [];
      })
      .addCase(fetchLegalDocuments.fulfilled, (state, action) => {
        state.loadingList = false;
        state.documents = action.payload.data || [];
        state.count = action.payload.count || 0;
      })
      .addCase(fetchLegalDocuments.rejected, (state, action) => {
        state.loadingList = false;
        state.error = action.payload?.message || 'Failed to fetch legal documents.';
        state.errors = action.payload?.errors || [];
      })

      // FETCH ONE
      .addCase(fetchLegalDocumentById.pending, (state) => {
        state.loadingDocument = true;
        state.error = null;
        state.errors = [];
      })
      .addCase(fetchLegalDocumentById.fulfilled, (state, action) => {
        state.loadingDocument = false;
        state.selectedDocument = action.payload.data || null;
      })
      .addCase(fetchLegalDocumentById.rejected, (state, action) => {
        state.loadingDocument = false;
        state.error = action.payload?.message || 'Failed to fetch legal document.';
        state.errors = action.payload?.errors || [];
      })

      // CREATE
      .addCase(createLegalDocument.pending, (state) => {
        state.submitting = true;
        state.success = false;
        state.error = null;
        state.errors = [];
        state.message = null;
      })
      .addCase(createLegalDocument.fulfilled, (state, action) => {
        const doc = action.payload.data;
        state.submitting = false;
        state.success = true;
        state.message = action.payload.message || 'Legal document created successfully.';
        if (doc) {
          state.documents = upsertDocInList(state.documents, doc);
          state.selectedDocument = doc;
          state.count = state.documents.length;
        }
      })
      .addCase(createLegalDocument.rejected, (state, action) => {
        state.submitting = false;
        state.success = false;
        state.error = action.payload?.message || 'Failed to create legal document.';
        state.errors = action.payload?.errors || [];
      })

      // UPDATE
      .addCase(updateLegalDocument.pending, (state) => {
        state.submitting = true;
        state.success = false;
        state.error = null;
        state.errors = [];
        state.message = null;
      })
      .addCase(updateLegalDocument.fulfilled, (state, action) => {
        const doc = action.payload.data;
        state.submitting = false;
        state.success = true;
        state.message = action.payload.message || 'Legal document updated successfully.';
        if (doc) {
          state.selectedDocument = doc;
          state.documents = upsertDocInList(state.documents, doc);
        }
      })
      .addCase(updateLegalDocument.rejected, (state, action) => {
        state.submitting = false;
        state.success = false;
        state.error = action.payload?.message || 'Failed to update legal document.';
        state.errors = action.payload?.errors || [];
      })

      // PUBLISH
      .addCase(publishLegalDocument.pending, (state) => {
        state.submitting = true;
        state.success = false;
        state.error = null;
        state.errors = [];
        state.message = null;
      })
      .addCase(publishLegalDocument.fulfilled, (state, action) => {
        const doc = action.payload.data;
        state.submitting = false;
        state.success = true;
        state.message = action.payload.message || 'Legal document published successfully.';
        if (doc) {
          state.selectedDocument = doc;
          state.documents = upsertDocInList(state.documents, doc);
        }
      })
      .addCase(publishLegalDocument.rejected, (state, action) => {
        state.submitting = false;
        state.success = false;
        state.error = action.payload?.message || 'Failed to publish legal document.';
        state.errors = action.payload?.errors || [];
      })

      // ARCHIVE
      .addCase(archiveLegalDocument.pending, (state) => {
        state.submitting = true;
        state.success = false;
        state.error = null;
        state.errors = [];
        state.message = null;
      })
      .addCase(archiveLegalDocument.fulfilled, (state, action) => {
        const doc = action.payload.data;
        state.submitting = false;
        state.success = true;
        state.message = action.payload.message || 'Legal document archived successfully.';
        if (doc) {
          state.selectedDocument = doc;
          state.documents = upsertDocInList(state.documents, doc);
        }
      })
      .addCase(archiveLegalDocument.rejected, (state, action) => {
        state.submitting = false;
        state.success = false;
        state.error = action.payload?.message || 'Failed to archive legal document.';
        state.errors = action.payload?.errors || [];
      })

      // DELETE
      .addCase(deleteLegalDocument.pending, (state) => {
        state.submitting = true;
        state.success = false;
        state.error = null;
        state.errors = [];
        state.message = null;
      })
      .addCase(deleteLegalDocument.fulfilled, (state, action) => {
        state.submitting = false;
        state.success = true;
        state.message = action.payload.message || 'Legal document deleted successfully.';
        state.documents = removeDocFromList(state.documents, action.payload.id);
        state.count = state.documents.length;

        if (state.selectedDocument?._id === action.payload.id) {
          state.selectedDocument = null;
        }
      })
      .addCase(deleteLegalDocument.rejected, (state, action) => {
        state.submitting = false;
        state.success = false;
        state.error = action.payload?.message || 'Failed to delete legal document.';
        state.errors = action.payload?.errors || [];
      })

      // CLONE DRAFT
      .addCase(cloneLegalDocumentDraft.pending, (state) => {
        state.submitting = true;
        state.success = false;
        state.error = null;
        state.errors = [];
        state.message = null;
      })
      .addCase(cloneLegalDocumentDraft.fulfilled, (state, action) => {
        const doc = action.payload.data;
        state.submitting = false;
        state.success = true;
        state.message = action.payload.message || 'Draft cloned successfully.';
        if (doc) {
          state.documents = upsertDocInList(state.documents, doc);
          state.selectedDocument = doc;
          state.count = state.documents.length;
        }
      })
      .addCase(cloneLegalDocumentDraft.rejected, (state, action) => {
        state.submitting = false;
        state.success = false;
        state.error = action.payload?.message || 'Failed to clone draft.';
        state.errors = action.payload?.errors || [];
      });
  },
});

export const {
  setLegalFilters,
  resetLegalFilters,
  clearLegalAdminFeedback,
  clearSelectedLegalDocument,
  resetLegalAdminState,
} = legalAdminSlice.actions;

// =========================
// SELECTORS
// =========================

export const selectLegalAdmin = (state) => state.legalAdmin;
export const selectLegalDocuments = (state) => state.legalAdmin.documents;
export const selectSelectedLegalDocument = (state) => state.legalAdmin.selectedDocument;
export const selectLegalDocumentCount = (state) => state.legalAdmin.count;
export const selectLegalFilters = (state) => state.legalAdmin.filters;
export const selectLegalLoadingList = (state) => state.legalAdmin.loadingList;
export const selectLegalLoadingDocument = (state) => state.legalAdmin.loadingDocument;
export const selectLegalSubmitting = (state) => state.legalAdmin.submitting;
export const selectLegalSuccess = (state) => state.legalAdmin.success;
export const selectLegalError = (state) => state.legalAdmin.error;
export const selectLegalErrors = (state) => state.legalAdmin.errors;
export const selectLegalMessage = (state) => state.legalAdmin.message;

export const selectWebAppLegalDocuments = (state) =>
  state.legalAdmin.documents.filter((doc) =>
    (doc.applicableApps || []).some((app) => app.appId === 'mechji-web')
  );

export const selectUserLegalDocuments = (state) =>
  state.legalAdmin.documents.filter((doc) => doc.audience === 'user');

export const selectVendorLegalDocuments = (state) =>
  state.legalAdmin.documents.filter((doc) => doc.audience === 'vendor');

export const selectBothAudienceLegalDocuments = (state) =>
  state.legalAdmin.documents.filter((doc) => doc.audience === 'both');

export const selectPublishedLegalDocuments = (state) =>
  state.legalAdmin.documents.filter((doc) => doc.status === 'published');

export default legalAdminSlice.reducer;