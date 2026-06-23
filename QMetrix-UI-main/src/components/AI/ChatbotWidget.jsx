import { AnimatePresence, motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ChatWindow from './ChatWindow';
import {
  closeChatbot,
  loadChatSession,
  openChatbot,
  sendChatMessage,
  startNewChatSession,
  toggleChatbot,
  toggleSessionHistory,
} from '../../store/ai/aiChatSlice';

const ChatbotWidget = () => {
  const dispatch = useDispatch();
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    isOpen,
    messages,
    loading,
    error,
    sessions,
    activeSessionId,
    isHistoryOpen,
  } = useSelector((state) => state.aiChat);
  const theme = useSelector((state) => state.theme.theme);

  const handleSend = (message) => {
    dispatch(openChatbot());
    dispatch(sendChatMessage({ message }));
  };

  const handleRetry = () => {
    const lastUserMessage = messages.slice().reverse().find((message) => message.role === 'user');

    if (lastUserMessage?.content) {
      dispatch(sendChatMessage({ message: lastUserMessage.content }));
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            key="chat-window"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="mb-3 origin-bottom-right"
          >
            <ChatWindow
              messages={messages}
              loading={loading}
              error={error}
              theme={theme}
              isExpanded={isExpanded}
              isHistoryOpen={isHistoryOpen}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onClose={() => dispatch(closeChatbot())}
              onToggleExpand={() => setIsExpanded((current) => !current)}
              onToggleHistory={() => dispatch(toggleSessionHistory())}
              onSelectSession={(sessionId) => dispatch(loadChatSession(sessionId))}
              onStartNewSession={() => dispatch(startNewChatSession())}
              onSend={handleSend}
              onRetry={handleRetry}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        whileHover={{ scale: 1.04 }}
        onClick={() => dispatch(toggleChatbot())}
        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.28)] transition ${
          theme === 'dark'
            ? 'bg-gradient-to-br from-[#48A7FF] to-[#066FD1] text-white'
            : 'bg-gradient-to-br from-[#066FD1] to-[#0A2342] text-white'
        }`}
        aria-label={isOpen ? 'Close QMetry AI Assistant' : 'Open QMetry AI Assistant'}
      >
        <Bot className="h-6 w-6" />
      </motion.button>
    </div>
  );
};

export default ChatbotWidget;
