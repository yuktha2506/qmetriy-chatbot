import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

const AddWidgetTypeahead = ({ options, value, onSelect, theme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setQuery('');
  }, [value?.value]);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const normalized = query.trim();
  const showAll = normalized === '/' || normalized.startsWith('/');
  const q = showAll ? '' : normalized.toLowerCase();

  const filtered = useMemo(() => {
    if (!options?.length) return [];
    if (showAll) return [...options].sort((a, b) => a.label.localeCompare(b.label));
    if (!q) return [];

    const starts = [];
    const contains = [];
    options.forEach((opt) => {
      const label = String(opt.label || '');
      const lower = label.toLowerCase();
      if (!lower.includes(q)) return;
      if (lower.startsWith(q)) starts.push(opt);
      else contains.push(opt);
    });

    const sorter = (a, b) => a.label.localeCompare(b.label);
    starts.sort(sorter);
    contains.sort(sorter);
    return [...starts, ...contains];
  }, [options, q, showAll]);

  const shouldShowPanel = isOpen && (showAll || q.length > 0);

  return (
    <div ref={wrapperRef} className="relative w-full" onMouseDown={(e) => e.stopPropagation()}>
      <div
        className={`inline-flex items-center w-full pr-4 justify-between border ${
          shouldShowPanel ? 'rounded-t-lg rounded-b-none border-b-0' : 'rounded-lg'
        } ${
          theme === 'light'
            ? 'border-[#D1E2F0] bg-[#FFFFFF] text-[#24527A]'
            : 'border-[#25384F] bg-transparent text-white'
        }`}
      >
        <input
          ref={inputRef}
          value={isOpen ? query : value?.label || ''}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onChange={(e) => {
            setIsOpen(true);
            setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
              return;
            }
            if (e.key === '/' && query.length === 0) {
              e.preventDefault();
              setIsOpen(true);
              setQuery('/');
              return;
            }
            if (e.key === 'Enter') {
              if (filtered.length === 1) {
                onSelect(filtered[0]);
                setIsOpen(false);
              }
            }
          }}
          placeholder={value?.label ? '' : 'Select'}
          className={`w-full border-0 outline-none ring-0 focus:ring-0 focus:outline-none text-sm leading-5 ${
            theme === 'light'
              ? 'bg-transparent text-[#24527A] placeholder:text-[#6C7A91]'
              : 'bg-transparent text-white placeholder:text-white/70'
          }`}
          autoComplete="off"
        />

        <svg
          className={`w-2.5 h-2.5 flex-shrink-0 ml-2 ${theme === 'light' ? 'text-[#24527A]' : 'text-white'}`}
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 10 6"
        >
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4" />
        </svg>
      </div>

      {shouldShowPanel ? (
        <div
          className={`absolute z-[60] mt-0 p-[2px] w-full rounded-t-none rounded-b-lg border-t-0 ${
            theme === 'light'
              ? 'bg-[#EFF8FE] border border-[#A6C3DC] shadow-[0_4px_12px_rgba(0,0,0,0.2)]'
              : 'bg-[#182433] border border-[#1F2F41] shadow-[0_4px_16px_rgba(0,0,0,0.8)]'
          }`}
          role="listbox"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ul
            className={`text-sm max-h-24 overflow-y-scroll m-[2px] ${
              theme === 'light' ? 'text-[#24527A]' : 'text-[#D9E4F1]'
            }`}
          >
            {filtered.length ? (
              filtered.map((opt) => (
                <li
                  key={opt.value}
                  className={`px-4 py-2 cursor-pointer rounded-lg ${
                    value?.value === opt.value
                      ? theme === 'light'
                        ? 'bg-[#F0F5FF] text-[#202020]'
                        : 'bg-[#11518C] text-white'
                      : theme === 'light'
                        ? 'hover:bg-[#F7F9FF]'
                        : 'hover:bg-[#1E2B3A]'
                  }`}
                  role="option"
                  aria-selected={value?.value === opt.value}
                  onClick={() => {
                    onSelect(opt);
                    setIsOpen(false);
                  }}
                >
                  {opt.label}
                </li>
              ))
            ) : (
              <li className={`px-4 py-2 ${theme === 'light' ? 'text-[#6C7A91]' : 'text-gray-400'}`}>No results found</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

AddWidgetTypeahead.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.any.isRequired,
    }),
  ).isRequired,
  value: PropTypes.shape({
    label: PropTypes.string,
    value: PropTypes.any,
  }),
  onSelect: PropTypes.func.isRequired,
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
};

AddWidgetTypeahead.defaultProps = {
  value: null,
};

export default AddWidgetTypeahead;
