import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import adminApi from '../../lib/services/adminApi';

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const initialState = {
  conversations: [],
  conversationsLoading: false,
  conversationsError: null,

  currentConversationId: null,
  messages: [],
  messagesLoading: false,
  messagesError: null,
};

// GET /admin/chats?search=&page=&limit=
export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get('/chats', { params });
      return data?.items || data?.conversations || [];
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch conversations'));
    }
  }
);

// GET /admin/chats/conversation/:conversationId/messages
export const fetchConversationMessages = createAsyncThunk(
  'chat/fetchConversationMessages',
  async (conversationId, { rejectWithValue }) => {
    try {
      const { data } = await adminApi.get(`/chats/conversation/${conversationId}/messages`);
      return { conversationId, messages: data?.items || data?.messages || [] };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Failed to fetch messages'));
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    clearCurrentConversation: (state) => {
      state.currentConversationId = null;
      state.messages = [];
      state.messagesError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.conversationsLoading = true;
        state.conversationsError = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversationsLoading = false;
        state.conversations = action.payload;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.conversationsLoading = false;
        state.conversationsError = action.payload || 'Failed to fetch conversations';
      })

      .addCase(fetchConversationMessages.pending, (state, action) => {
        state.messagesLoading = true;
        state.messagesError = null;
        state.currentConversationId = action.meta.arg;
      })
      .addCase(fetchConversationMessages.fulfilled, (state, action) => {
        state.messagesLoading = false;
        state.messages = action.payload.messages;
      })
      .addCase(fetchConversationMessages.rejected, (state, action) => {
        state.messagesLoading = false;
        state.messagesError = action.payload || 'Failed to fetch messages';
      });
  },
});

export const { clearCurrentConversation } = chatSlice.actions;

export const selectChatConversations = (state) => state.chat.conversations;
export const selectChatConversationsLoading = (state) => state.chat.conversationsLoading;
export const selectChatConversationsError = (state) => state.chat.conversationsError;

export const selectChatMessages = (state) => state.chat.messages;
export const selectChatMessagesLoading = (state) => state.chat.messagesLoading;
export const selectChatMessagesError = (state) => state.chat.messagesError;
export const selectCurrentConversationId = (state) => state.chat.currentConversationId;

export default chatSlice.reducer;