/* eslint-disable */
import { AnimatePresence, motion } from 'framer-motion';
import { History, Maximize2, Minimize2, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ChatInput from './ChatInput';
import ChatMessageList from './ChatMessageList';
import ChatSessionHistoryPanel from './ChatSessionHistoryPanel';
import LoadingIndicator from './LoadingIndicator';
import ErrorState from './ErrorState';
import {
  createScreenshotPreviewUrl,
  validateScreenshotFile,
} from '../../utils/ai/uploadValidation';
import {
  resetUploadState,
  setUploadError,
  setUploadedFile,
  submitScreenshotForAnalysis,
} from '../../store/ai/aiUploadSlice';

const MIN_WIDTH = 320;
const MIN_HEIGHT = 450;
const MAX_WIDTH_RATIO = 0.9;
const MAX_HEIGHT_RATIO = 0.9;
const VIEWPORT_MARGIN = 96;
const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 520;
const EXPANDED_WIDTH = 620;
const EXPANDED_HEIGHT = 640;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getViewportBounds = () => ({
  maxWidth: typeof window !== 'undefined' ? Math.floor(window.innerWidth * MAX_WIDTH_RATIO) : 1200,
  maxHeight:
    typeof window !== 'undefined'
      ? Math.floor(Math.min(window.innerHeight * MAX_HEIGHT_RATIO, window.innerHeight - VIEWPORT_MARGIN))
      : 900,
});

const ChatWindow = (props) => {
  const {
    messages = [],
    loading = false,
    error = null,
    theme = 'dark',
    isExpanded = false,
    isHistoryOpen = false,
    sessions = [],
    activeSessionId = '',
    onClose,
    onToggleExpand,
    onToggleHistory,
    onSelectSession,
    onStartNewSession,
    onSend,
    onRetry,
  } = props;

  const dispatch = useDispatch();
  const [composerValue, setComposerValue] = useState('');
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const resizeStateRef = useRef(null);
  const rafRef = useRef(null);
  const panelRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const [hoverAxis, setHoverAxis] = useState(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState('');
  const uploadStatus = useSelector((state) => state.aiUpload.uploadStatus);
  const uploadedFile = useSelector((state) => state.aiUpload.uploadedFile);

  useEffect(() => {
    if (loading) {
      setComposerValue('');
    }
  }, [loading]);

  useEffect(() => {
    const preset = isExpanded
      ? { width: EXPANDED_WIDTH, height: EXPANDED_HEIGHT }
      : { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
    setSize(preset);
  }, [isExpanded]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      const { maxWidth, maxHeight } = getViewportBounds();
      const deltaX = event.clientX - resizeState.startX;
      const deltaY = event.clientY - resizeState.startY;
      let nextWidth = resizeState.startWidth;
      let nextHeight = resizeState.startHeight;

      if (resizeState.axis.includes('e')) {
        nextWidth = resizeState.startWidth + deltaX;
      }

      if (resizeState.axis.includes('w')) {
        nextWidth = resizeState.startWidth - deltaX;
      }

      if (resizeState.axis.includes('s')) {
        nextHeight = resizeState.startHeight + deltaY;
      }

      if (resizeState.axis.includes('n')) {
        nextHeight = resizeState.startHeight - deltaY;
      }

      const nextSize = {
        width: clamp(nextWidth, MIN_WIDTH, maxWidth),
        height: clamp(nextHeight, MIN_HEIGHT, maxHeight),
      };

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        setSize(nextSize);
      });
    };

    const handleMouseUp = () => {
      resizeStateRef.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const { maxWidth, maxHeight } = getViewportBounds();
      setSize((current) => ({
        width: clamp(current.width, MIN_WIDTH, maxWidth),
        height: clamp(current.height, MIN_HEIGHT, maxHeight),
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!uploadedFile) {
      setAttachmentPreviewUrl('');
      return undefined;
    }

    const nextPreviewUrl = createScreenshotPreviewUrl(uploadedFile);
    setAttachmentPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [uploadedFile]);

  const getCursorForAxis = (axis) => {
    if (!axis) {
      return 'default';
    }

    if (axis.length === 1) {
      return axis === 'n' || axis === 's' ? 'ns-resize' : 'ew-resize';
    }

    return axis === 'nw' || axis === 'se' ? 'nwse-resize' : 'nesw-resize';
  };

  const getAxisFromPoint = (rect, clientX, clientY) => {
    const edge = 12;
    const corner = 18;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const nearLeft = x <= edge;
    const nearRight = x >= rect.width - edge;
    const nearTop = y <= edge;
    const nearBottom = y >= rect.height - edge;

    if (nearTop && nearLeft) return 'nw';
    if (nearTop && nearRight) return 'ne';
    if (nearBottom && nearLeft) return 'sw';
    if (nearBottom && nearRight) return 'se';

    if (y <= corner) return 'n';
    if (y >= rect.height - corner) return 's';
    if (x <= corner) return 'w';
    if (x >= rect.width - corner) return 'e';

    return null;
  };

  const startResize = (axis, event) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      axis,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: size.width,
      startHeight: size.height,
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = getCursorForAxis(axis);
  };

  const handlePanelMouseMove = (event) => {
    if (resizeStateRef.current) {
      return;
    }

    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const nextAxis = getAxisFromPoint(rect, event.clientX, event.clientY);
    setHoverAxis((current) => (current === nextAxis ? current : nextAxis));
  };

  const handlePanelMouseLeave = () => {
    if (!resizeStateRef.current) {
      setHoverAxis(null);
    }
  };

  const handlePanelMouseDown = (event) => {
    if (event.target?.closest('button, input, textarea, select, a')) {
      return;
    }

    if (!hoverAxis) {
      return;
    }

    startResize(hoverAxis, event);
  };

  const viewportBounds = getViewportBounds();
  const width = clamp(size.width, MIN_WIDTH, viewportBounds.maxWidth);
  const height = clamp(size.height, MIN_HEIGHT, viewportBounds.maxHeight);
  const attachmentStatusLabel =
    uploadStatus === 'uploading'
      ? 'Uploading screenshot...'
      : uploadStatus === 'processing'
        ? 'Processing analysis...'
        : uploadStatus === 'completed'
          ? 'Analysis completed'
          : uploadStatus === 'failed'
            ? 'Upload failed'
            : 'Screenshot attached';

  const handleUploadScreenshot = () => attachmentInputRef.current?.click();

  const handleAttachmentFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    const validation = validateScreenshotFile(selectedFile);
    if (!validation.valid) {
      dispatch(resetUploadState());
      dispatch(setUploadError(validation.message));
      return;
    }

    dispatch(setUploadedFile(selectedFile));
    dispatch(submitScreenshotForAnalysis({ file: selectedFile }));
  };

  return (
    <div
      ref={panelRef}
      onMouseMove={handlePanelMouseMove}
      onMouseLeave={handlePanelMouseLeave}
      onMouseDown={handlePanelMouseDown}
      className={`relative flex flex-col overflow-hidden rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-[background-color,border-color,box-shadow,color,transform] duration-200 ${
        theme === 'dark' ? 'border border-[#224F78] bg-[#08111B]/95 text-white' : 'border border-[#D1E2F0] bg-[#F8FBFE]/95 text-[#0A2342]'
      }`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        minWidth: `${MIN_WIDTH}px`,
        minHeight: `${MIN_HEIGHT}px`,
        maxWidth: '90vw',
        maxHeight: `calc(100vh - ${VIEWPORT_MARGIN}px)`,
        willChange: 'width, height',
        cursor: resizeStateRef.current ? getCursorForAxis(resizeStateRef.current.axis) : getCursorForAxis(hoverAxis),
      }}
    >
      <div
        className={`relative z-50 flex items-center justify-between border-b px-4 py-3 ${
          theme === 'dark' ? 'border-[#224F78] bg-[#0D1621]/90' : 'border-[#D1E2F0] bg-white/90'
        }`}
      >
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.5em] text-[#6FA8FF]">QMetry</p>
          <h2 className="mt-1 text-lg font-semibold text-white">AI Assistant</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {onToggleHistory ? (
            <button
              type="button"
              onClick={onToggleHistory}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition ${
                isHistoryOpen
                  ? theme === 'dark'
                    ? 'bg-[#173A5A] text-white'
                    : 'bg-[#EFF8FE] text-[#0A2342]'
                  : theme === 'dark'
                    ? 'text-[#A3B1C9] hover:bg-[#173A5A] hover:text-white'
                    : 'text-[#6C7A91] hover:bg-[#EFF8FE] hover:text-[#0A2342]'
              }`}
              aria-label={isHistoryOpen ? 'Close session history' : 'Open session history'}
              aria-pressed={isHistoryOpen}
            >
              <History className="h-5 w-5" />
            </button>
          ) : null}
          {onToggleExpand ? (
            <button
              type="button"
              onClick={onToggleExpand}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition ${
                theme === 'dark'
                  ? 'text-[#A3B1C9] hover:bg-[#173A5A] hover:text-white'
                  : 'text-[#6C7A91] hover:bg-[#EFF8FE] hover:text-[#0A2342]'
              }`}
              aria-label={isExpanded ? 'Shrink chatbot' : 'Expand chatbot'}
            >
              {isExpanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition ${
              theme === 'dark'
                ? 'text-[#A3B1C9] hover:bg-[#173A5A] hover:text-white'
                : 'text-[#6C7A91] hover:bg-[#EFF8FE] hover:text-[#0A2342]'
            }`}
            aria-label="Close chatbot"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isHistoryOpen ? (
          <motion.div
            key="chat-session-history"
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute bottom-0 left-0 top-[73px] z-40"
          >
            <ChatSessionHistoryPanel
              sessions={sessions}
              activeSessionId={activeSessionId}
              theme={theme}
              onSelectSession={onSelectSession}
              onStartNewSession={onStartNewSession}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatMessageList messages={messages} loading={loading} theme={theme} />
      </div>

      <div className="space-y-3 border-t px-4 py-4">
        {loading ? <LoadingIndicator theme={theme} /> : null}
        {error ? <ErrorState theme={theme} message={error} onRetry={onRetry} /> : null}
        <input
          ref={attachmentInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
          className="hidden"
          onChange={handleAttachmentFileChange}
        />
        {uploadedFile ? (
          <div
            className={`flex items-center gap-3 rounded-[18px] border px-3 py-2 ${
              theme === 'dark' ? 'border-[#224F78] bg-[#0D1621]' : 'border-[#D1E2F0] bg-[#F8FBFE]'
            }`}
          >
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border ${
                theme === 'dark' ? 'border-[#224F78] bg-[#08111B]' : 'border-[#D1E2F0] bg-white'
              }`}
            >
              {attachmentPreviewUrl ? (
                <img src={attachmentPreviewUrl} alt="Selected screenshot preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#48A7FF]">AI</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-[#0A2342]'}`}>
                {uploadedFile.name}
              </p>
              <p className={`text-xs ${theme === 'dark' ? 'text-[#A3B1C9]' : 'text-[#6C7A91]'}`}>{attachmentStatusLabel}</p>
            </div>
          </div>
        ) : null}
        <ChatInput
          onSend={onSend}
          disabled={loading}
          placeholder="Ask QMetry AI anything..."
          theme={theme}
          value={composerValue}
          onChange={setComposerValue}
          onUploadClick={handleUploadScreenshot}
        />
      </div>
    </div>
  );
};

ChatWindow.propTypes = {
  messages: PropTypes.array,
  loading: PropTypes.bool,
  error: PropTypes.string,
  theme: PropTypes.oneOf(['light', 'dark']),
  isExpanded: PropTypes.bool,
  isHistoryOpen: PropTypes.bool,
  sessions: PropTypes.array,
  activeSessionId: PropTypes.string,
  onClose: PropTypes.func,
  onToggleExpand: PropTypes.func,
  onToggleHistory: PropTypes.func,
  onSelectSession: PropTypes.func,
  onStartNewSession: PropTypes.func,
  onSend: PropTypes.func,
  onRetry: PropTypes.func,
};

export default ChatWindow;
