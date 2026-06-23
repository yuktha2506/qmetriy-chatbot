/* eslint-disable */
import { RotateCcw, TriangleAlert } from 'lucide-react';
import PropTypes from 'prop-types';

const ErrorState = (props) => {
  const {
    title = 'Something went wrong',
    message = 'Please try again in a moment.',
    onRetry,
    retryLabel = 'Retry',
    theme = 'dark',
  } = props;

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        theme === 'dark' ? 'border-[#5A2E38] bg-[#2A1720] text-[#FDECEF]' : 'border-[#F1C7CF] bg-[#FFF6F8] text-[#7A1E33]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-full p-2 ${theme === 'dark' ? 'bg-[#4A1D2A]' : 'bg-[#FFE4EA]'}`}>
          <TriangleAlert className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm opacity-90">{message}</p>
        </div>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${
            theme === 'dark'
              ? 'bg-white text-[#0A2342] hover:bg-[#EAF2FF]'
              : 'bg-[#0A2342] text-white hover:bg-[#173A5A]'
          }`}
        >
          <RotateCcw className="h-4 w-4" />
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
};

ErrorState.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
  onRetry: PropTypes.func,
  retryLabel: PropTypes.string,
  theme: PropTypes.oneOf(['light', 'dark']),
};

export default ErrorState;
