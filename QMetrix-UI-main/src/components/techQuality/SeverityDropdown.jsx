import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

const SeverityDropdown = ({ value, onChange, options, theme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  return (
    <div ref={ref} className="relative" onMouseDown={(e) => e.stopPropagation()}>
      <div
        className={`h-9 inline-flex items-center rounded-md border overflow-hidden ${
          theme === 'light' ? 'border-[#A6C3DC] bg-[#EFF8FE]' : 'border-[#25384F] bg-transparent'
        }`}
      >
        <div
          className={`h-full px-4 text-xs flex items-center ${
            theme === 'light' ? 'text-[#0A2342] bg-[#EFF8FE]' : 'text-[#A3B1C9] bg-[#1E2F44]'
          }`}
        >
          Severity
        </div>
        <div className={`h-full w-[0.5px] ${theme === 'light' ? 'bg-[#A6C3DC]' : 'bg-[#25384F]'}`} />
        <button
          type="button"
          onClick={() => setIsOpen((p) => !p)}
          className={`h-full px-4 inline-flex items-center justify-between min-w-[110px] focus:outline-none ${
            theme === 'light' ? 'text-[#24527A]' : 'text-white'
          }`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="text-xs font-semibold">{value}</span>
          <svg
            className={`w-3 h-3 ${theme === 'light' ? 'text-[#24527A]' : ''}`}
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 10 6"
          >
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div
          className={`absolute z-[50] mt-1 p-[2px] rounded-lg w-full ${
            theme === 'light'
              ? 'bg-[#EFF8FE] border border-[#A6C3DC] shadow-[0_4px_12px_rgba(0,0,0,0.2)]'
              : 'bg-[#182433] shadow-[0_4px_16px_rgba(0,0,0,0.8)]'
          }`}
          role="listbox"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ul
            className={`text-xs max-h-60 overflow-y-auto m-[2px] ${
              theme === 'light' ? 'text-[#24527A]' : 'text-[#D9E4F1]'
            }`}
          >
            {options.map((opt) => (
              <li
                key={opt.value}
                className={`px-4 py-2 cursor-pointer rounded-lg ${
                  value === opt.label
                    ? theme === 'light'
                      ? 'bg-[#F0F5FF] text-[#202020]'
                      : 'bg-[#11518C] text-white'
                    : theme === 'light'
                      ? 'hover:bg-[#F7F9FF]'
                      : 'hover:bg-[#1E2B3A]'
                }`}
                role="option"
                aria-selected={value === opt.label}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <span className={value === opt.label ? (theme === 'light' ? 'text-[#202020]' : 'text-white') : ''}>
                  {opt.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

SeverityDropdown.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
    }),
  ).isRequired,
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
};

export default SeverityDropdown;
