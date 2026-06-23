/* eslint-disable */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, PencilLine, X } from 'lucide-react';
import { useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { updateChatMessage } from '../../store/ai/aiChatSlice';

const formatTimestamp = (timestamp) => {
  if (!timestamp) {
    return '';
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch (error) {
    return '';
  }
};

const ChatMessageList = (props) => {
  const { messages = [], theme = 'dark', loading = false } = props;
  const dispatch = useDispatch();
  const endRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [draftContent, setDraftContent] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  useEffect(() => {
    if (!editingId) {
      return;
    }

    const currentMessage = messages.find((message) => message.id === editingId);
    if (!currentMessage) {
      setEditingId(null);
      setDraftContent('');
    }
  }, [editingId, messages]);

  const canEditMessage = useMemo(() => true, []);

  const handleCopy = async (message) => {
    try {
      await navigator.clipboard.writeText(message.content || '');
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch (error) {
      setCopiedId(null);
    }
  };

  const beginEdit = (message) => {
    setEditingId(message.id);
    setDraftContent(message.content || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftContent('');
  };

  const saveEdit = (message) => {
    const nextContent = String(draftContent || '').trim();
    if (!nextContent) {
      return;
    }

    dispatch(updateChatMessage({ id: message.id, content: nextContent }));
    cancelEdit();
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="flex flex-col gap-3">
        {messages.map((message) => {
          const isUser = message.role === 'user';
          const isEditing = editingId === message.id;

          return (
            <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm shadow-sm ${
                  isUser
                    ? theme === 'dark'
                      ? 'bg-[#48A7FF] text-[#0A2342]'
                      : 'bg-[#066FD1] text-white'
                    : theme === 'dark'
                      ? 'bg-[#173A5A] text-white border border-[#224F78]'
                      : 'bg-white text-[#0A2342] border border-[#D1E2F0]'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={draftContent}
                      onChange={(event) => setDraftContent(event.target.value)}
                      rows={3}
                      className={`w-full resize-none rounded-2xl border px-3 py-2 text-sm outline-none ${
                        theme === 'dark'
                          ? 'border-[#224F78] bg-[#0D1621] text-white placeholder:text-[#8CA0B8]'
                          : 'border-[#D1E2F0] bg-white text-[#0A2342] placeholder:text-[#7EA6CA]'
                      }`}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(message)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          theme === 'dark'
                            ? 'bg-[#48A7FF] text-[#0A2342] hover:bg-[#7CC1FF]'
                            : 'bg-[#066FD1] text-white hover:bg-[#054B8F]'
                        }`}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          theme === 'dark'
                            ? 'bg-[#173A5A] text-white hover:bg-[#224F78]'
                            : 'bg-[#EFF8FE] text-[#0A2342] hover:bg-[#D9EDF8]'
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      {message.timestamp ? (
                        <p className={`text-[11px] ${isUser ? 'text-[#0A2342]/70' : theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]'}`}>
                          {formatTimestamp(message.timestamp)}
                        </p>
                      ) : (
                        <span />
                      )}
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => beginEdit(message)}
                          disabled={!canEditMessage}
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition ${
                            isUser
                              ? 'text-[#0A2342]/70 hover:bg-white/20 hover:text-[#0A2342]'
                              : theme === 'dark'
                                ? 'text-[#A3B1C9] hover:bg-[#0D1621]/70 hover:text-white'
                                : 'text-[#6C7A91] hover:bg-[#EFF8FE] hover:text-[#0A2342]'
                          } ${!canEditMessage ? 'cursor-not-allowed opacity-50' : ''}`}
                          aria-label={`Edit ${isUser ? 'user' : 'assistant'} message`}
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(message)}
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition ${
                            isUser
                              ? 'text-[#0A2342]/70 hover:bg-white/20 hover:text-[#0A2342]'
                              : theme === 'dark'
                                ? 'text-[#A3B1C9] hover:bg-[#0D1621]/70 hover:text-white'
                                : 'text-[#6C7A91] hover:bg-[#EFF8FE] hover:text-[#0A2342]'
                          }`}
                          aria-label={`Copy ${isUser ? 'user' : 'assistant'} message`}
                        >
                          {copiedId === message.id ? <Check className="h-3.5 w-3.5 text-[#1C8C4A]" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
};

ChatMessageList.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      role: PropTypes.oneOf(['user', 'assistant']),
      content: PropTypes.string,
      timestamp: PropTypes.string,
    }),
  ),
  theme: PropTypes.oneOf(['light', 'dark']),
  loading: PropTypes.bool,
};

export default ChatMessageList;
