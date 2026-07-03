const CHAT_SESSIONS_STORAGE_KEY = 'qmetryAiChatSessions';
const ACTIVE_CHAT_SESSION_STORAGE_KEY = 'qmetryAiActiveChatSessionId';

const canUseLocalStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

export const loadChatSessions = () => {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const rawSessions = window.localStorage.getItem(CHAT_SESSIONS_STORAGE_KEY);
    const parsedSessions = JSON.parse(rawSessions || '[]');
    return Array.isArray(parsedSessions) ? parsedSessions : [];
  } catch (error) {
    return [];
  }
};

export const saveChatSessions = (sessions = []) => {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    // Keep chat usable even when browser storage is unavailable or full.
  }
};

export const loadActiveChatSessionId = () => {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    return window.localStorage.getItem(ACTIVE_CHAT_SESSION_STORAGE_KEY);
  } catch (error) {
    return null;
  }
};

export const saveActiveChatSessionId = (sessionId) => {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    if (sessionId) {
      window.localStorage.setItem(ACTIVE_CHAT_SESSION_STORAGE_KEY, sessionId);
    } else {
      window.localStorage.removeItem(ACTIVE_CHAT_SESSION_STORAGE_KEY);
    }
  } catch (error) {
    // Storage persistence is best-effort; the live chat state remains intact.
  }
};
