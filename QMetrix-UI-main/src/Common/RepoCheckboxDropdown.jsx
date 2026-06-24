import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'react-tooltip';
import { useSelector } from 'react-redux';

const RepoCheckboxDropdown = ({
  options = [],
  onSelect,
  placeholder = 'Select repositories',
  selectedRepos = [],
  isOpen: externalIsOpen,
  setIsOpen: externalSetIsOpen,
  reference,
  width = 'md',
  height = 'md',
  textSize = 'sm',
  title = '',
}) => {
  const [isOpen, setIsOpen] = useState(externalIsOpen || false);
  const [allSelected, setAllSelected] = useState(false);
  const theme = useSelector((state) => state.theme.theme);

  const internalDropdownRef = useRef(null);
  const dropdownRef = reference || internalDropdownRef;

  useEffect(() => {
    setAllSelected(selectedRepos.length === options.length && options.length > 0);
  }, [selectedRepos, options]);

  const toggleDropdown = () => {
    const newOpenState = !isOpen;
    setIsOpen(newOpenState);
    if (externalSetIsOpen) externalSetIsOpen(newOpenState);
  };

  const handleSelect = (option) => {
    let newSelectedRepos;
    
    if (option.value === 'all') {
      if (allSelected) {
        newSelectedRepos = [];
      } else {
        newSelectedRepos = options.map(opt => opt.value);
      }
    } else {
      if (selectedRepos.includes(option.value)) {
        newSelectedRepos = selectedRepos.filter(repo => repo !== option.value);
      } else {
        newSelectedRepos = [...selectedRepos, option.value];
      }
    }
    
    onSelect(newSelectedRepos);
  };

  const handleSelectAll = () => {
    const newSelectedRepos = allSelected ? [] : options.map(opt => opt.value);
    onSelect(newSelectedRepos);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        if (externalSetIsOpen) externalSetIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownRef, externalSetIsOpen]);

  const filteredOptions = Array.isArray(options) ? options : [];

  const getWidthClass = () => {
    switch (width) {
      case 'xs':
        return 'w-20';
      case 'sm':
        return 'w-32';
      case 'md':
        return 'w-48';
      case 'lg':
        return 'w-64';
      case 'xl':
        return 'w-80';
      case '2xl':
        return 'w-96';
      case 'full':
        return 'w-full';
      default:
        return 'w-48';
    }
  };

  const getHeightClass = () => {
    switch (height) {
      case 'xs':
        return 'h-7';
      case 'sm':
        return 'h-8';
      case 'md':
        return 'h-9';
      case 'lg':
        return 'h-10';
      case 'xl':
        return 'h-12';
      default:
        return height.startsWith('h-') ? height : 'h-9';
    }
  };

  const getTextSizeClass = () => {
    switch (textSize) {
      case 'xs':
        return 'text-xs';
      case 'sm':
        return 'text-sm';
      case 'base':
        return 'text-base';
      case 'lg':
        return 'text-lg';
      case 'xl':
        return 'text-xl';
      default:
        return 'text-sm';
    }
  };

  const getButtonText = () => {
    if (options.length === 0) {
      return placeholder;
    } else if (selectedRepos.length === 0) {
      return placeholder;
    } else if (selectedRepos.length === options.length) {
      return 'All repositories';
    } else {
      return `${selectedRepos.length} of ${options.length} repositories`;
    }
  };

  const isTruncated = (text) => {
    if (!text) return false;
    return text.length > 20;
  };

  const handleTruncate = (text) => {
    if (!text) return '';
    return isTruncated(text) ? `${text.substring(0, 20)}...` : text;
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${getWidthClass()}`}>
      <button
        onClick={toggleDropdown}
        type="button"
        className={`inline-flex items-center w-full px-2 py-2 justify-between rounded dark:border-[#1F2F41] border border-[#A6C3DC] dark:bg-[#182433] bg-[#FFFFFF] dark:text-[#D9E4F1] text-[#24527A] dark:hover:bg-[#1E2B3A] hover:bg-[#F5F5F5] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${getHeightClass()}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={title}
      >
        <span
          className={`dark:text-white text-[#24527A] ${getTextSizeClass()}`}
          data-tooltip-id="tooltip-selected-option"
          data-tooltip-content={isTruncated(getButtonText()) ? getButtonText() : ''}
        >
          {handleTruncate(getButtonText())}
        </span>

        <Tooltip
          id="tooltip-selected-option"
          place="bottom"
          effect="solid"
          offset={1}
          float={false}
          allowHTML={true}
          arrowColor={theme === 'dark' ? '#173A5A' : '#1e1e1e'}
          opacity={1}
          style={{
            backgroundColor: theme === 'dark' ? '#173A5A' : '#1e1e1e',
            borderStyle: 'solid',
            borderWidth: '1px',
            borderColor: theme === 'dark' ? '#224F78' : '#224F78',
            color: 'white',
            zIndex: 100000,
            padding: '8px',
            borderRadius: '5px',
            maxWidth: '500px',
          }}
        />
        <svg
          className="w-2.5 h-2.5 ml-2 dark:text-white text-[#24527A]"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 10 6"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="m1 1 4 4 4-4"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`absolute z-20 mt-1 p-[2px] ${theme === 'light' ? 'bg-[#FFFFFF] border border-[#A6C3DC]' : 'bg-[#182433]'} rounded shadow-[0_4px_16px_rgba(0,0,0,0.8)] w-full`}
          role="listbox"
        >
          <div className="py-1">
            <div className={`py-2 text-sm ${theme === 'light' ? 'text-[#24527A]' : 'text-[#D9E4F1]'} max-h-60 overflow-y-auto`}>
              {options.length > 0 ? (
                <>
                  <label
                    className={`flex items-center px-4 py-2 cursor-pointer ${theme === 'light' ? 'hover:bg-[#F5F5F5]' : 'hover:bg-[#1E2B3A]'} whitespace-nowrap`}
                  >
                    <input
                      type="checkbox"
                      className={`mr-3 flex-shrink-0 w-4 h-4 rounded border focus:outline-none focus:ring-transparent appearance-none bg-transparent ${theme === 'light' ? 'border-[#D9D9D9] hover:border-[#326AEB]' : 'border-[#4A5568] hover:border-[#326AEB]'} checked:bg-[#326AEB] checked:border-[#326AEB]`}
                      checked={allSelected}
                      onChange={handleSelectAll}
                    />
                    <span className="flex-1 truncate font-medium" title="All repositories">
                      All repositories
                    </span>
                  </label>

                  {filteredOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center px-4 py-2 cursor-pointer ${theme === 'light' ? 'hover:bg-[#F5F5F5]' : 'hover:bg-[#1E2B3A]'} whitespace-nowrap`}
                    >
                      <input
                        type="checkbox"
                        className={`mr-3 flex-shrink-0 w-4 h-4 rounded border focus:outline-none focus:ring-transparent appearance-none bg-transparent ${theme === 'light' ? 'border-[#D9D9D9] hover:border-[#326AEB]' : 'border-[#4A5568] hover:border-[#326AEB]'} checked:bg-[#326AEB] checked:border-[#326AEB]`}
                        checked={selectedRepos.includes(option.value)}
                        onChange={() => handleSelect(option)}
                      />
                      <span className="flex-1 truncate" title={option.label}>
                        {option.label}
                      </span>
                    </label>
                  ))}
                </>
              ) : (
                <div className={`px-4 py-2 ${theme === 'light' ? 'text-[#24527A]' : 'text-gray-400'}`}>No repositories available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

RepoCheckboxDropdown.propTypes = {
  buttonLabel: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.any.isRequired,
    })
  ),
  onSelect: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  selectedRepos: PropTypes.arrayOf(PropTypes.string),
  isOpen: PropTypes.bool,
  setIsOpen: PropTypes.func,
  reference: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
  width: PropTypes.string,
  height: PropTypes.string,
  textSize: PropTypes.string,
  title: PropTypes.string,
};

export default RepoCheckboxDropdown;
