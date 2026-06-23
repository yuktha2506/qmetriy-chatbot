/* eslint-disable */
import { Clock3, MessageSquare, MessageSquarePlus, Search } from 'lucide-react';
import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';

const hasConversationMessages = (session) =>
  Array.isArray(session?.messages) && session.messages.some((message) => message.role === 'user');

const getSessionDisplayTitle = (session, activeSessionId) => {
  if (session?.title) {
    return session.title;
  }

  return session?.sessionId === activeSessionId ? 'New chat' : 'Untitled conversation';
};

const formatDateTime = (timestamp) => {
  if (!timestamp) {
    return '';
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch (error) {
    return '';
  }
};

const ChatSessionHistoryPanel = (props) => {
  const {
    sessions = [],
    activeSessionId,
    theme = 'dark',
    onSelectSession,
    onStartNewSession,
  } = props;
  const [searchTerm, setSearchTerm] = useState('');

  const visibleSessions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return sessions
      .filter((session) => hasConversationMessages(session) || session.sessionId === activeSessionId)
      .filter((session) => {
        if (!normalizedSearch) {
          return true;
        }

        return `${getSessionDisplayTitle(session, activeSessionId)} ${formatDateTime(session.createdAt)} ${formatDateTime(session.updatedAt)}`
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((first, second) => new Date(second.updatedAt || 0) - new Date(first.updatedAt || 0));
  }, [activeSessionId, sessions, searchTerm]);

  const emptyLabel = sessions.some(hasConversationMessages)
    ? 'No matching sessions found.'
    : 'No previous chat sessions yet.';

  return (
    <aside
      className={`flex h-full w-[300px] max-w-[calc(100vw-32px)] flex-col border-r shadow-[16px_0_36px_rgba(0,0,0,0.24)] ${
        theme === 'dark' ? 'border-[#224F78] bg-[#08111B] text-white' : 'border-[#D1E2F0] bg-[#F8FBFE] text-[#0A2342]'
      }`}
    >
      <div className="border-b border-inherit px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-[#6FA8FF]">History</p>
            <h3 className={`mt-1 truncate text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-[#0A2342]'}`}>
              Chat sessions
            </h3>
          </div>
          <button
            type="button"
            onClick={onStartNewSession}
            className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition ${
              theme === 'dark'
                ? 'text-[#A3B1C9] hover:bg-[#173A5A] hover:text-white'
                : 'text-[#6C7A91] hover:bg-[#EFF8FE] hover:text-[#0A2342]'
            }`}
            aria-label="Start new chat session"
          >
            <MessageSquarePlus className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div
          className={`mt-3 flex items-center gap-2 rounded-full border px-3 py-2 ${
            theme === 'dark' ? 'border-[#224F78] bg-[#0D1621]' : 'border-[#D1E2F0] bg-white'
          }`}
        >
          <Search className={`h-4 w-4 flex-shrink-0 ${theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]'}`} />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search sessions"
            className={`min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-100 ${
              theme === 'dark' ? 'text-white placeholder:text-[#A3B1C9]' : 'text-[#0A2342] placeholder:text-[#6C7A91]'
            }`}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {visibleSessions.length ? (
          <div className="space-y-2">
            {visibleSessions.map((session) => {
              const isActive = session.sessionId === activeSessionId;

              return (
                <button
                  key={session.sessionId}
                  type="button"
                  onClick={() => onSelectSession?.(session.sessionId)}
                  className={`w-full rounded-[18px] border px-3 py-3 text-left transition ${
                    isActive
                      ? theme === 'dark'
                        ? 'border-[#48A7FF] bg-[#173A5A] shadow-[0_10px_24px_rgba(72,167,255,0.12)]'
                        : 'border-[#066FD1] bg-[#EFF8FE]'
                      : theme === 'dark'
                        ? 'border-[#224F78] bg-[#0D1621] hover:bg-[#173A5A]'
                        : 'border-[#D1E2F0] bg-white hover:bg-[#EFF8FE]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                        isActive
                          ? 'bg-[#48A7FF] text-[#0A2342]'
                          : theme === 'dark'
                            ? 'bg-[#08111B] text-[#A3B1C9]'
                            : 'bg-[#F8FBFE] text-[#6C7A91]'
                      }`}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-[#0A2342]'}`}>
                        {getSessionDisplayTitle(session, activeSessionId)}
                      </span>
                      <span className={`mt-1 block text-xs ${theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]'}`}>
                        Created {formatDateTime(session.createdAt)}
                      </span>
                      <span className={`mt-1 flex items-center gap-1 text-xs ${theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]'}`}>
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDateTime(session.updatedAt)}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div
            className={`flex h-full min-h-[220px] flex-col items-center justify-center rounded-[18px] border px-4 text-center ${
              theme === 'dark' ? 'border-[#224F78] bg-[#0D1621] text-[#A3B1C9]' : 'border-[#D1E2F0] bg-white text-[#6C7A91]'
            }`}
          >
            <MessageSquare className="h-8 w-8 text-[#6FA8FF]" />
            <p className="mt-3 text-sm font-semibold">{emptyLabel}</p>
          </div>
        )}
      </div>
    </aside>
  );
};

ChatSessionHistoryPanel.propTypes = {
  sessions: PropTypes.arrayOf(
    PropTypes.shape({
      sessionId: PropTypes.string,
      title: PropTypes.string,
      createdAt: PropTypes.string,
      updatedAt: PropTypes.string,
      messages: PropTypes.array,
    }),
  ),
  activeSessionId: PropTypes.string,
  theme: PropTypes.oneOf(['light', 'dark']),
  onSelectSession: PropTypes.func,
  onStartNewSession: PropTypes.func,
};

export default ChatSessionHistoryPanel;
