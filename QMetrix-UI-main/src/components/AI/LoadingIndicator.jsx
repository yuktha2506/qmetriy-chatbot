import PropTypes from 'prop-types';

const LoadingIndicator = ({ label = 'AI is typing...', theme = 'dark' }) => (
  <div
    className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm ${
      theme === 'dark' ? 'bg-[#173A5A] text-white border border-[#224F78]' : 'bg-white text-[#0A2342] border border-[#D1E2F0]'
    }`}
  >
    <div className="flex items-center gap-1.5" aria-hidden="true">
      <span className="h-2 w-2 rounded-full bg-current opacity-80 animate-bounce [animation-delay:-0.2s]" />
      <span className="h-2 w-2 rounded-full bg-current opacity-80 animate-bounce [animation-delay:-0.1s]" />
      <span className="h-2 w-2 rounded-full bg-current opacity-80 animate-bounce" />
    </div>
    <span className="text-sm font-medium">{label}</span>
  </div>
);

LoadingIndicator.propTypes = {
  label: PropTypes.string,
  theme: PropTypes.oneOf(['light', 'dark']),
};

export default LoadingIndicator;
