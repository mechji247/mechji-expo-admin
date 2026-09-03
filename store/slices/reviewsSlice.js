import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import adminApi from '../../lib/services/adminApi';

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const initialState = {
  list: [],
  pagination: { page: 1, limit: 20, totalPages: 1, total: 0 },
  loading: false,
  error: null,

  actionLoading: {}, // keyed by review id
  actionError: {},
};

// GET /admin/reviews?type=product|service&status=&search=&page=&limit=
export const fetchReviews = createAsyncThunk(
  'reviews/fetchReviews',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get('/reviews', { params });
      return {
        items: data?.items || data?.reviews || [],
        pagination: data?.pagination || null,
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch reviews'));
    }
  }
);

// PATCH /admin/reviews/review/:reviewId/status  { status: 'flagged' | 'underreview' | 'clear' }
export const updateReviewStatus = createAsyncThunk(
  'reviews/updateReviewStatus',
  async ({ reviewId, status }, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.patch(`/reviews/review/${reviewId}/status`, { status });
      return { reviewId, review: data?.review || null, message: data?.message || 'Review status updated' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to update review status'));
    }
  }
);

// DELETE /admin/reviews/review/:reviewId
export const removeReview = createAsyncThunk(
  'reviews/removeReview',
  async (reviewId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.delete(`/reviews/review/${reviewId}`);
      return { reviewId, message: data?.message || 'Review removed' };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to remove review'));
    }
  }
);

function getReviewId(review) {
  return review?._id || review?.id || null;
}

const reviewsSlice = createSlice({
  name: 'reviews',
  initialState,
  reducers: {
    clearReviewsMessages: (state) => {
      state.error = null;
      state.actionError = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReviews.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReviews.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.items;
        if (action.payload.pagination) {
          state.pagination = { ...state.pagination, ...action.payload.pagination };
        }
      })
      .addCase(fetchReviews.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch reviews';
      })

      .addCase(updateReviewStatus.pending, (state, action) => {
        const id = action.meta.arg?.reviewId;
        if (id) {
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        }
      })
      .addCase(updateReviewStatus.fulfilled, (state, action) => {
        const { reviewId, review } = action.payload;
        delete state.actionLoading[reviewId];
        if (review) {
          const idx = state.list.findIndex((r) => getReviewId(r) === reviewId);
          if (idx !== -1) state.list[idx] = review;
        }
      })
      .addCase(updateReviewStatus.rejected, (state, action) => {
        const id = action.meta.arg?.reviewId;
        if (id) {
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Failed to update review status';
        }
      })

      .addCase(removeReview.pending, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          state.actionLoading[id] = true;
          state.actionError[id] = null;
        }
      })
      .addCase(removeReview.fulfilled, (state, action) => {
        const { reviewId } = action.payload;
        delete state.actionLoading[reviewId];
        state.list = state.list.filter((r) => getReviewId(r) !== reviewId);
      })
      .addCase(removeReview.rejected, (state, action) => {
        const id = action.meta.arg;
        if (id) {
          delete state.actionLoading[id];
          state.actionError[id] = action.payload || 'Failed to remove review';
        }
      });
  },
});

export const { clearReviewsMessages } = reviewsSlice.actions;

export const selectReviewsList = (state) => state.reviews.list;
export const selectReviewsPagination = (state) => state.reviews.pagination;
export const selectReviewsLoading = (state) => state.reviews.loading;
export const selectReviewsError = (state) => state.reviews.error;
export const selectReviewActionLoading = (state) => state.reviews.actionLoading;
export const selectReviewActionError = (state) => state.reviews.actionError;

export { getReviewId };

export default reviewsSlice.reducer;