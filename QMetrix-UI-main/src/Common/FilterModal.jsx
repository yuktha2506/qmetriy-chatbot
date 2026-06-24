import { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

const FilterModal = ({ options, selectedValues, onApply, onCancel, position }) => {
  const [checkedValues, setCheckedValues] = useState(
    selectedValues.length === 0 ? ['All', ...options] : selectedValues
  );
  const modalRef = useRef(null);

  const allOptions = ['All', ...options];
  
  const toPascalCase = (text) => {
    if (!text && text !== 0) return text;
    const str = String(text);
    return str
      .toLowerCase()
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatFilterValue = (text) => {
    if (!text && text !== 0) return text;
    const str = String(text);
    return str
      .split(/\s+/)
      .map(part => {
        if (/\d+-\d+/.test(part)) {
          return part; 
        }
        if (/\d+\+/.test(part)) {
          return part; 
        }
        return toPascalCase(part);
      })
      .join(' ');
  };

  useEffect(() => {
    if (selectedValues.length === 0) {
      setCheckedValues(['All', ...options]);
    } else {
      setCheckedValues(selectedValues);
    }
  }, [selectedValues, options]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  const handleCheckboxChange = useCallback(
    (value) => {
      let newValues;
      
      if (value === 'All') {
        const allIndividualSelected = checkedValues.filter(item => item !== 'All').length === options.length;
        
        if (allIndividualSelected) {
          newValues = [];
        } else {
          newValues = ['All', ...options];
        }
      } else {
        newValues = checkedValues.includes(value)
          ? checkedValues.filter((item) => item !== value)
          : [...checkedValues, value];
        
        if (checkedValues.includes('All')) {
          newValues = newValues.filter(item => item !== 'All');
        }
        
        // Only add "All" if all individual options are actually checked (not just count matches)
        const individualValues = newValues.filter(item => item !== 'All');
        if (individualValues.length === options.length && options.every(opt => individualValues.includes(opt))) {
          newValues = ['All', ...options];
        }
      }

      setCheckedValues(newValues);
      const filteredValues = newValues.filter(item => item !== 'All');
      const shouldClearFilter = filteredValues.length === 0 || filteredValues.length === options.length;
      onApply(shouldClearFilter ? [] : filteredValues);
    },
    [checkedValues, onApply, options],
  );

  const handleClear = useCallback(() => {
    setCheckedValues([]);
    onApply([]);
  }, [onApply]);

  return (
    <div
      ref={modalRef}
      className="absolute bg-white dark:bg-[#182433] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.8)] z-50 w-[180px] text-black dark:text-[#DCE1E2] flex flex-col"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="flex-1 overflow-y-auto p-2 max-h-[200px]">
        {allOptions.map((value) => {
          const isChecked = value === 'All' 
            ? checkedValues.filter(item => item !== 'All').length === options.length
            : checkedValues.includes(value);
            
          return (
          <div
            key={value}
            className="mb-2 flex items-center p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#1E2B3A] transition-colors duration-200 cursor-pointer"
            onClick={() => handleCheckboxChange(value)}
          >
            <input
              type="checkbox"
              id={`filter-${value}`}
              checked={isChecked}
              className="mr-2 cursor-pointer appearance-none w-4 h-4 border border-white rounded-sm bg-transparent checked:bg-blue-500 checked:border-blue-500"
            />

            <span
              htmlFor={`filter-${value}`}
              className="cursor-pointer text-sm dark:text-[#DCE1E2]"
            >
              {formatFilterValue(value)}
            </span>
          </div>
          );
        })}
      </div>

      {allOptions.length > 0 && (
        <div className="flex-shrink-0 p-2 pt-3 text-center  dark:border-gray-700">
          <button
            onClick={handleClear}
            className="px-12 py-1 border-2 border-[#076BC8] rounded-md cursor-pointer text-md text-[#076BC8] bg-transparent transition-all duration-200 flex items-center justify-center gap-2 p-5 min-w-[100px]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

FilterModal.propTypes = {
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedValues: PropTypes.arrayOf(PropTypes.string).isRequired,
  onApply: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  position: PropTypes.shape({
    top: PropTypes.number,
    left: PropTypes.number,
  }).isRequired,
};

export default FilterModal;
