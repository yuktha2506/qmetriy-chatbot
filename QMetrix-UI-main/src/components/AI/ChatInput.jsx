/* eslint-disable react/prop-types */
import { Paperclip, Send } from 'lucide-react';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';

const ChatInput = (props) => {
  const {
    onSend,
    disabled = false,
    placeholder = 'Type a message...',
    buttonLabel = 'Send',
    theme = 'dark',
    value: controlledValue,
    onChange,
    autoFocus = false,
    onUploadClick,
  } = props;

  const [internalValue, setInternalValue] = useState(controlledValue || '');
  const isControlled = typeof controlledValue === 'string';
  const value = isControlled ? controlledValue : internalValue;

  useEffect(() => {
    if (isControlled) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue, isControlled]);

  const updateValue = (nextValue) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    if (onChange) {
      onChange(nextValue);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = String(value || '').trim();

    if (!trimmed || disabled) {
      return;
    }

    onSend?.(trimmed);

    if (!isControlled) {
      setInternalValue('');
    }

    if (onChange) {
      onChange('');
    }
  };

  const inputStyles =
    theme === 'dark'
      ? {
          color: '#F8FBFE',
          caretColor: '#FFFFFF',
          WebkitTextFillColor: '#F8FBFE',
          backgroundColor: '#0D1621',
        }
      : {
          color: '#0A2342',
          caretColor: '#0A2342',
          WebkitTextFillColor: '#0A2342',
          backgroundColor: '#FFFFFF',
        };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUploadClick}
          className={`inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            theme === 'dark'
              ? 'border-[#224F78] bg-[#0D1621] text-[#D9E4F1] hover:bg-[#173A5A] focus-visible:ring-[#48A7FF]/30 focus-visible:ring-offset-[#0D1621]'
              : 'border-[#D1E2F0] bg-white text-[#0A2342] hover:bg-[#EFF8FE] focus-visible:ring-[#066FD1]/25 focus-visible:ring-offset-white'
          }`}
          aria-label="Attach screenshot"
        >
          <Paperclip className="h-4 w-4" />
        </button>

        <input
          autoFocus={autoFocus}
          type="text"
          value={value}
          onChange={(event) => updateValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSubmit(event);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          spellCheck={false}
          className={`min-h-12 w-full rounded-full border px-4 py-3 text-sm outline-none transition placeholder:opacity-100 focus-visible:ring-2 focus-visible:ring-[#48A7FF]/35 ${
            theme === 'dark'
              ? 'border-[#224F78] placeholder:text-[#A3B1C9] focus:border-[#48A7FF]'
              : 'border-[#D1E2F0] placeholder:text-[#6C7A91] focus:border-[#066FD1]'
          } ${disabled ? 'cursor-not-allowed opacity-90' : ''}`}
          style={inputStyles}
        />

        <button
          type="submit"
          disabled={disabled || !String(value || '').trim()}
          className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            disabled || !String(value || '').trim()
              ? 'cursor-not-allowed bg-[#A3B1C9] text-white opacity-60 focus-visible:ring-transparent'
              : theme === 'dark'
                ? 'bg-[#48A7FF] text-[#0A2342] hover:bg-[#7CC1FF] focus-visible:ring-[#48A7FF]/40 focus-visible:ring-offset-[#0D1621]'
                : 'bg-[#066FD1] text-white hover:bg-[#054B8F] focus-visible:ring-[#066FD1]/40 focus-visible:ring-offset-white'
          }`}
          aria-label={buttonLabel}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
};

ChatInput.propTypes = {
  onSend: PropTypes.func,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  buttonLabel: PropTypes.string,
  theme: PropTypes.oneOf(['light', 'dark']),
  value: PropTypes.string,
  onChange: PropTypes.func,
  autoFocus: PropTypes.bool,
  onUploadClick: PropTypes.func,
};

export default ChatInput;
