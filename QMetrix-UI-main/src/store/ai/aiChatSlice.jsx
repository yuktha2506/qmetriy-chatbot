import { createAsyncThunk, createSlice, current, nanoid } from '@reduxjs/toolkit';
import { fetchChatResponse } from '../../services/ai/chatApi';
import {
  loadActiveChatSessionId,
  loadChatSessions,
  saveActiveChatSessionId,
  saveChatSessions,
} from '../../utils/ai/chatSessionStorage';

const createMessage = (role, content, extras = {}) => ({
  id: nanoid(),
  role,
  content,
  timestamp: new Date().toISOString(),
  ...extras,
});

const welcomeMessage = createMessage(
  'assistant',
  'Hi, I am QMetry AI Assistant. Ask me about sprint health, blockers, release readiness, or QA risk.',
);

const GREETING_RESPONSE = 'Hi, how can I help you ?';
const SIMPLE_GREETINGS = new Set(['hi', 'hello', 'hey', 'hi!', 'hello!', 'hey!']);

const cloneWelcomeMessage = () => ({ ...welcomeMessage });

const isSimpleGreeting = (message = '') => SIMPLE_GREETINGS.has(String(message || '').trim().toLowerCase());

const getSessionTitle = (message = '') => {
  const title = String(message || '').trim().replace(/\s+/g, ' ');
  return title.length > 48 ? `${title.slice(0, 45)}...` : title;
};

const createChatSession = (messages = [cloneWelcomeMessage()], title = '') => {
  const now = new Date().toISOString();
  return {
    sessionId: nanoid(),
    title,
    createdAt: now,
    updatedAt: now,
    messages,
  };
};

const persistSessionState = (state) => {
  saveChatSessions(current(state.sessions));
  saveActiveChatSessionId(state.activeSessionId);
};

const persistActiveSession = (state) => {
  if (!state.activeSessionId) {
    return;
  }

  const activeSessionIndex = state.sessions.findIndex((session) => session.sessionId === state.activeSessionId);
  if (activeSessionIndex === -1) {
    return;
  }

  state.sessions[activeSessionIndex].messages = state.messages;
  state.sessions[activeSessionIndex].updatedAt = new Date().toISOString();
  persistSessionState(state);
};

const storedSessions = loadChatSessions();
const storedActiveSessionId = loadActiveChatSessionId();
const activeStoredSession = storedSessions.find((session) => session.sessionId === storedActiveSessionId);
const initialSession = activeStoredSession || createChatSession();

export const sendChatMessage = createAsyncThunk(
  'aiChat/sendChatMessage',
  async ({ message }, { dispatch, getState, rejectWithValue }) => {
    const trimmedMessage = String(message || '').trim();

    if (!trimmedMessage) {
      return rejectWithValue('Please enter a message.');
    }

    dispatch(addUserMessage(trimmedMessage));

    if (isSimpleGreeting(trimmedMessage)) {
      return { content: GREETING_RESPONSE };
    }

    try {
      const appState = getState();
      const history = appState.aiChat.messages;
      const response = await fetchChatResponse({ message: trimmedMessage, history, appState });
      return response;
    } catch (error) {
      return rejectWithValue(error?.message || 'Something went wrong.');
    }
  },
);

const initialState = {
  isOpen: false,
  messages: initialSession.messages?.length ? initialSession.messages : [cloneWelcomeMessage()],
  loading: false,
  error: null,
  lastUserMessage: '',
  sessions: activeStoredSession ? storedSessions : [initialSession, ...storedSessions],
  activeSessionId: initialSession.sessionId,
  isHistoryOpen: false,
};

const aiChatSlice = createSlice({
  name: 'aiChat',
  initialState,
  reducers: {
    openChatbot: (state) => {
      state.isOpen = true;
    },
    closeChatbot: (state) => {
      state.isOpen = false;
    },
    toggleChatbot: (state) => {
      state.isOpen = !state.isOpen;
    },
    toggleSessionHistory: (state) => {
      state.isHistoryOpen = !state.isHistoryOpen;
    },
    closeSessionHistory: (state) => {
      state.isHistoryOpen = false;
    },
    loadChatSession: (state, action) => {
      const nextSession = state.sessions.find((session) => session.sessionId === action.payload);

      if (!nextSession) {
        return;
      }

      state.activeSessionId = nextSession.sessionId;
      state.messages = nextSession.messages?.length ? nextSession.messages : [cloneWelcomeMessage()];
      state.lastUserMessage = [...state.messages].reverse().find((message) => message.role === 'user')?.content || '';
      state.error = null;
      state.isHistoryOpen = false;
      persistSessionState(state);
    },
    startNewChatSession: (state) => {
      const session = createChatSession();
      state.sessions.unshift(session);
      state.activeSessionId = session.sessionId;
      state.messages = session.messages;
      state.loading = false;
      state.error = null;
      state.lastUserMessage = '';
      state.isHistoryOpen = false;
      persistSessionState(state);
    },
    addUserMessage: (state, action) => {
      const message = createMessage('user', action.payload);
      state.messages.push(message);
      state.lastUserMessage = action.payload;

      const activeSessionIndex = state.sessions.findIndex((session) => session.sessionId === state.activeSessionId);
      if (activeSessionIndex !== -1 && !state.sessions[activeSessionIndex].title) {
        state.sessions[activeSessionIndex].title = getSessionTitle(action.payload);
      }
      persistActiveSession(state);
    },
    updateChatMessage: (state, action) => {
      const { id, content } = action.payload || {};
      const messageIndex = state.messages.findIndex((message) => message.id === id);

      if (messageIndex !== -1) {
        state.messages[messageIndex].content = content;
        state.messages[messageIndex].timestamp = new Date().toISOString();
      }

      const lastUserMessage = [...state.messages].reverse().find((message) => message.role === 'user');
      state.lastUserMessage = lastUserMessage?.content || '';
      persistActiveSession(state);
    },
    clearChatMessages: (state) => {
      state.messages = [cloneWelcomeMessage()];
      state.error = null;
      state.lastUserMessage = '';
      persistActiveSession(state);
    },
    clearChatError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendChatMessage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendChatMessage.fulfilled, (state, action) => {
        state.loading = false;
        state.messages.push(
          createMessage('assistant', action.payload?.content || 'I am ready to help with your metrics.'),
        );
        persistActiveSession(state);
      })
      .addCase(sendChatMessage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error?.message || 'Something went wrong.';
        persistActiveSession(state);
      });
  },
});

export const {
  openChatbot,
  closeChatbot,
  toggleChatbot,
  toggleSessionHistory,
  closeSessionHistory,
  loadChatSession,
  startNewChatSession,
  addUserMessage,
  updateChatMessage,
  clearChatMessages,
  clearChatError,
} = aiChatSlice.actions;

export default aiChatSlice.reducer;
