import { useState, useEffect, useRef } from 'react';
import Button from './Button';
import PropTypes from 'prop-types';
import { Tooltip } from 'react-tooltip';
import { useSelector } from 'react-redux';

const DropdownButton = ({
  buttonLabel,
  options = [],
  onSelect,
  placeholder = 'Select',
  selectedOption: externalSelectedOption,
  isOpen: externalIsOpen,
  setIsOpen: externalSetIsOpen,
  reference,
  type = 'default',
  width = 'md',
  height = 'md',
  textSize = 'sm',
  variant = 'default',
  icon = null,
  title = '',
  showSearch = true,
  alwaysShowSearch = false,
  autoFocusSearch = false,
  onClearAll = null,
  showArrow = false,
  onArrowClick = null,
  onOptionHover = null,
  onOptionMouseLeave = null,
  customClassName = null,
}) => {
  const [isOpen, setIsOpen] = useState(externalIsOpen || false);
  const [selectedOption, setSelectedOption] = useState(
    externalSelectedOption || buttonLabel || placeholder,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState('left');
  const theme = useSelector((state) => state.theme.theme);

  const internalDropdownRef = useRef(null);
  const dropdownRef = reference || internalDropdownRef;
  const searchInputRef = useRef(null);
  const tooltipId = useRef(`tooltip-${type}-${Math.random().toString(36).substr(2, 9)}`).current;

  const toggleDropdown = () => {
    const newOpenState = !isOpen;
    setIsOpen(newOpenState);
    if (externalSetIsOpen) externalSetIsOpen(newOpenState);
    if (newOpenState) {
      setSearchTerm('');
      if (variant === 'icon') {
        setTimeout(() => {
          if (dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const dropdownWidth = 200;
            const viewportWidth = window.innerWidth;
            if (rect.right + dropdownWidth > viewportWidth - 20) {
              setDropdownPosition('right');
            } else {
              setDropdownPosition('left');
            }
          }
        }, 0);
      }
    }
  };

  const handleSelect = (option) => {
    if (type === 'columns') {
      onSelect(option.value);
      return;
    }
    setSelectedOption(option.label);
    if (type === 'project') {
      onSelect(option.value);
      setSearchTerm('');
    } else if (type === 'sprint') {
      onSelect(option.value);
      setSearchTerm('');
    } else if (type === 'organization') {
      onSelect(option.value);
      setSearchTerm('');
    } else if (type === 'release') {
      onSelect(option.value);
      setSearchTerm('');
    } else {
      onSelect(option);
      setSearchTerm('');
    }

    if (type !== 'columns') {
      setIsOpen(false);
      if (externalSetIsOpen) externalSetIsOpen(false);
    }
  };

  useEffect(() => {
    setSelectedOption(externalSelectedOption || placeholder);
  }, [externalSelectedOption, placeholder]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
        if (externalSetIsOpen) externalSetIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownRef, externalSetIsOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!showSearch) return;
    if (!autoFocusSearch) return;
    if (!alwaysShowSearch && options.length <= 3) return;

    const t = setTimeout(() => {
      searchInputRef.current?.focus?.();
    }, 0);
    return () => clearTimeout(t);
  }, [isOpen, showSearch, autoFocusSearch, alwaysShowSearch, options.length]);

  const filteredOptions = Array.isArray(options)
    ? options
        .filter((option) => {
          if (!option || !option.label) return false;
          if (type === 'sprint' && option.state === 'future') return false;
          if (type === 'release' && option.status === 'future') return false;
          return option.label.toLowerCase().includes(searchTerm.toLowerCase());
        })
        .reverse()
        .sort((a, b) => {
          if (type === 'sprint') {
            if (a.state === 'active') return -1;
            if (b.state === 'active') return 1;
          } else if (type === 'release') {
            if (a.status === 'Unreleased' && b.status === 'Released') return -1;
            if (a.status === 'Released' && b.status === 'Unreleased') return 1;
          } else {
            const aNum = Number(a.label);
            const bNum = Number(b.label);
            if (!isNaN(aNum) && !isNaN(bNum)) {
              return aNum - bNum;
            }
            return a.label.localeCompare(b.label);
          }
          return 0;
        })
    : [];

  const handleTruncate = (text) => {
    let maxLength;
    if (width === 'md') {
      maxLength = 20; 
    } else if (width === 'lg') {
      maxLength = 22;
    } else if (width === 'lgx') {
      maxLength = 28; 
    } else if (width === 'xl') {
      maxLength = 34; 
    } else {
      maxLength = 20; 
    }
    
    if (text.length > maxLength) {
      return text.slice(0, maxLength - 2) + '...';
    }
    return text;
  };

  const isTruncated = (text) => {
    let maxLength;
    if (width === 'md') {
      maxLength = 20;
    } else if (width === 'lg') {
      maxLength = 22;
    } else if (width === 'lgx') {
      maxLength = 28;
    } else if (width === 'xl') {
      maxLength = 34;
    } else {
      maxLength = 20;
    }
    return text.length > maxLength;
  };

  const getWidthClass = () => {
    if (variant === 'icon') return 'w-auto';

    switch (width) {
      case 'xs':
        return 'w-28';
      case 'sm':
        return 'w-32';
      case 'smd':
        return 'w-44';
      case 'md':
        return 'w-48';
      case 'lg':
        return 'w-64';
      case 'lgx':
        return 'w-72';
      case 'xl':
        return 'w-80';
      default:
        return width.startsWith('w-') ? width : 'w-48';
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
      default:
        return textSize.startsWith('text-') ? textSize : 'text-sm';
    }
  };

  if (variant === 'icon') {
    return (
      <div ref={dropdownRef} className="relative inline-block text-left">
        <button
          onClick={toggleDropdown}
          type="button"
          className={`inline-flex items-center justify-center w-8 h-8 rounded transition-all duration-200 ${
            isOpen
              ? 'border-[1.31px] border-[#066FD1] shadow-[0_0_3px_0_#2869FFCC]'
              : 'border-[1.31px] border-[#066FD1] hover:border-[#066FD199] hover:bg-[#243A4E]'
          }`}
          aria-haspopup="true"
          aria-expanded={isOpen}
          title={title || 'Add Column'}
        >
          {icon || (
            <svg
              className={`w-5 h-5 transition-colors duration-200 ${
                isOpen
                  ? 'text-[#066FD1] stroke-[2px]'
                  : 'text-[#066FD1] stroke-[2px] hover:text-[#066FD199]'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          )}
        </button>

        {isOpen && (
          <div
            className={`absolute z-[50] mt-1 bg-[#182433] rounded ${theme === 'light' ? 'bg-[#FFFFFF] border border-[#C1D5FF] shadow-[0_4px_12px_rgba(0,0,0,0.2)]' : 'bg-[#182433] shadow-[0_4px_16px_rgba(0,0,0,0.4)]'} w-50 flex flex-col`}
            role="listbox"
            style={{
              right: dropdownPosition === 'right' ? 0 : 'auto',
              left: dropdownPosition === 'left' ? 0 : 'auto',
            }}
          >
            {showSearch && (alwaysShowSearch || options.length > 3) && (
              <div
                className={`border-b ${
                  theme === 'light' ? 'border-[#D9D9D9]' : 'border-[#30445A]'
                }`}
              >
                <div className="relative">
                  <div className="absolute top-0 bottom-0 left-0 flex items-center justify-center w-10 pointer-events-none">
                    <svg
                      className={`w-4 h-4 ${
                        theme === 'light' ? 'text-[#24527A]' : 'text-[#CED5E3]'
                      }`}
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 20 20"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
                      />
                    </svg>
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    className={`w-full p-2 ${
                      theme === 'light' ? 'text-[#202020]' : 'text-[#D9E4F199]'
                    } rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm`}
                    style={{
                      textIndent: '2rem',
                      backgroundColor: theme === 'light' ? '#FFFFFF' : '#151F2C',
                    }}
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex-1">
              <div
                className={`py-2 text-sm  rounded-lg ${
                  theme === 'light' ? 'text-[#202020] bg-[#FFFFFF]' : 'text-[#D9E4F1] bg-[#182433]'
                } overflow-y-auto max-h-[200px]`}
              >
                {filteredOptions.length ? (
                  filteredOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center px-4 py-2 cursor-pointer ${
                        theme === 'light' ? 'hover:bg-[#F5F5F5]' : 'hover:bg-[#1E2B3A]'
                      } whitespace-nowrap  ${
                        option.disabled ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        className={`mr-3 flex-shrink-0 w-4 h-4 rounded border  focus:outline-none focus:ring-transparent appearance-none ${
                          option.disabled
                            ? theme === 'light'
                              ? 'bg-[#F5F5F5] border-[#D9D9D9] cursor-not-allowed opacity-50'
                              : 'bg-[#2A3441] border-[#3D4B5C] cursor-not-allowed opacity-50' // Disabled
                            : option.checked
                            ? 'bg-[#326AEB] border-[#326AEB]' // Selected
                            : theme === 'light'
                            ? 'bg-transparent border-[#D9D9D9] hover:border-[#326AEB]'
                            : 'bg-transparent border-[#4A5568] hover:border-[#326AEB]' // Default + Hover
                        }`}
                        checked={option.checked}
                        disabled={option.disabled}
                        onChange={() => handleSelect(option)}
                      />
                      <span className="flex-1 truncate" title={option.label}>
                        {option.label}
                      </span>
                    </label>
                  ))
                ) : (
                  <div
                    className={`px-4 py-2 ${
                      theme === 'light' ? 'text-[#202020]' : 'text-gray-400'
                    }`}
                  >
                    No results found
                  </div>
                )}
              </div>
            </div>

            {filteredOptions.length > 0 && type === 'columns' && (
              <div className="flex-shrink-0 p-2 pt-3 text-center">
                <button
                  onClick={() => {
                    if (onClearAll) {
                      onClearAll();
                    } else {
                      options.forEach((option) => {
                        if (option.checked) {
                          onSelect(option.value);
                        }
                      });
                    }
                  }}
                  className="px-24 py-1 border-2 border-[#076BC8] rounded-md cursor-pointer text-md text-[#076BC8] bg-transparent transition-all duration-200 flex items-center justify-center gap-2  min-w-[100px]"
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
        )}
      </div>
    );
  } else if (width === 'xs') {
    return (
      <div ref={dropdownRef} className="relative inline-block text-left w-32">
        <Button
          onClick={toggleDropdown}
          variant="transparent"
          type="button"
          className={`inline-flex items-center w-full px-2 py-1 justify-between rounded dark:border-[#293e56] border-[#d3d8df] dark:bg-[#182433] bg-[#FFFFFF] dark:text-[#D9E4F1] text-[#333333] dark:hover:bg-[#1E2B3A] hover:bg-[#F5F5F5] ${getHeightClass()}`}
          aria-haspopup="true"
          aria-expanded={isOpen}
          title={title}
        >
          <span
            className={`dark:text-white text-[#333333] ${getTextSizeClass()}`}
            data-tooltip-id={tooltipId}
            data-tooltip-content={isTruncated(selectedOption) ? selectedOption : ''}
          >
            {handleTruncate(selectedOption)}
          </span>

          <Tooltip
            id={tooltipId}
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
          <div className="flex items-center">
            {showArrow && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onArrowClick) onArrowClick();
                }}
                className="mr-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Select Board"
              >
                <svg
                  className="w-4 h-4 dark:text-white text-[#626262]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
            <svg
              className="w-2.5 h-2.5 dark:text-white text-[#24527A]"
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
          </div>
        </Button>

        {isOpen && (
          <div
            className={`absolute z-[50] mt-1 p-[2px] bg-[#182433] rounded-lg ${theme === 'light' ? 'bg-[#FFFFFF] border border-[#C1D5FF] shadow-[0_4px_12px_rgba(0,0,0,0.2)]' : 'bg-[#182433] shadow-[0_4px_16px_rgba(0,0,0,0.4)]'} w-full`}
            role="listbox"
          >
            {showSearch && (alwaysShowSearch || options.length > 3) && (
              <div
                className={`border-b ${
                  theme === 'light' ? 'border-[#D9D9D9]' : 'border-[#30445A]'
                }`}
              >
                <div className="relative">
                  <div className="absolute top-0 bottom-0 left-0 flex items-center justify-center w-10 pointer-events-none">
                    <svg
                      className={`w-4 h-4 ${
                        theme === 'light' ? 'text-[#24527A]' : 'text-[#CED5E3]'
                      }`}
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 20 20"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
                      />
                    </svg>
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    className={`w-full p-2 ${
                      theme === 'light' ? 'text-[#202020]' : 'text-[#D9E4F199]'
                    } rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm`}
                    style={{
                      textIndent: '2rem',
                      backgroundColor: theme === 'light' ? '#FFFFFF' : '#151F2C',
                    }}
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            )}

            {type === 'columns' ? (
              <div
                className={`text-sm ${
                  theme === 'light' ? 'text-[#202020]' : 'text-[#D9E4F1]'
                } max-h-36 overflow-y-auto m-[2px] ${theme === 'light' ? 'shadow-[0_4px_12px_rgba(0,0,0,0.2)]' : 'shadow-[0_4px_16px_rgba(0,0,0,0.4)]'}`}
              >
                {filteredOptions.length ? (
                  filteredOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center px-4 py-2 cursor-pointer ${
                        theme === 'light' ? 'hover:bg-[#F7F9FF]' : 'hover:bg-[#1E2B3A]'
                      } ${option.disabled ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={option.checked}
                        disabled={option.disabled}
                        onChange={() => handleSelect(option)}
                      />
                      {option.label}
                    </label>
                  ))
                ) : (
                  <div
                    className={`px-4 py-2 ${
                      theme === 'light' ? 'text-[#202020]' : 'text-gray-400'
                    }`}
                  >
                    No results found
                  </div>
                )}
              </div>
            ) : (
              <ul
                className={`${getTextSizeClass()} ${
                  theme === 'light' ? 'text-[#202020]' : 'text-[#D9E4F1]'
                } max-h-36 overflow-y-auto m-[2px]`}
              >
                {filteredOptions.length ? (
                  filteredOptions.map((option, index) => (
                    <li
                      key={index}
                      className={`px-4 py-2 cursor-pointer  ${
                        selectedOption === option.label
                          ? theme === 'light'
                            ? 'bg-[#EAF5FF] rounded-lg'
                            : 'bg-[#11518C] rounded-lg'
                          : theme === 'light'
                          ? 'hover:bg-[#F7F9FF] rounded-lg'
                          : 'hover:bg-[#1E2B3A] rounded-lg'
                      }`}
                      onClick={() => handleSelect(option)}
                      role="option"
                      aria-selected={selectedOption === option.label}
                    >
                      <span
                        className={
                          selectedOption === option.label
                            ? theme === 'light'
                              ? 'text-[#202020]'
                              : 'text-white'
                            : ''
                        }
                      >
                        {option.label}
                      </span>
                      {type === 'sprint' && (
                        <span
                          className={`ml-2 text-xs ${
                            option.state === 'active' ? 'text-green-500' : 'text-red-500'
                          }`}
                        >
                          {option.state === 'active' ? 'Active' : 'Closed'}
                        </span>
                      )}
                      {type === 'release' && (
                        <span
                          className={`ml-2 text-xs ${
                            option.status === 'Released' ? 'text-green-500' : 'text-blue-400'
                          }`}
                        >
                          {option.status === 'Released' ? 'Released' : 'Unreleased'}
                        </span>
                      )}
                    </li>
                  ))
                ) : (
                  <li
                    className={`px-4 py-2 ${
                      theme === 'light' ? 'text-[#202020]' : 'text-gray-400'
                    }`}
                  >
                    No results found
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${getWidthClass()}`}>
      <Button
        onClick={toggleDropdown}
        variant="transparent"
        type="button"
        className={customClassName || `inline-flex items-center w-full px-4 py-2 justify-between rounded dark:border-[#263951] border-[#d3d8df] dark:bg-[#182433] bg-[#FFFFFF] dark:text-[#D9E4F1] text-[#333333] dark:hover:bg-[#1E2B3A] hover:bg-[#F5F5F5] ${getHeightClass()}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={title}
      >
        <span
          className={`dark:text-white text-[#24527A] ${getTextSizeClass()}`}
          data-tooltip-id={tooltipId}
          data-tooltip-content={isTruncated(selectedOption) ? selectedOption : ''}
        >
          {handleTruncate(selectedOption)}
        </span>

        <Tooltip
          id={tooltipId}
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
        <div className="flex items-center">
          {showArrow && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onArrowClick) onArrowClick();
              }}
              className="mr-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Select Board"
            >
              <svg
                className="w-4 h-4 dark:text-white text-[#626262]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}
          <svg
            className="w-2.5 h-2.5 dark:text-white text-[#626262]"
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
        </div>
      </Button>

      {isOpen && (
        <div
          className={`absolute z-[50] mt-1 p-[2px] ${theme === 'light' ? 'bg-[#FFFFFF] border border-[#A6C3DC] shadow-[0_4px_12px_rgba(0,0,0,0.2)]' : 'bg-[#182433] shadow-[0_4px_16px_rgba(0,0,0,0.8)]'} rounded-lg w-full`}
          role="listbox"
        >
          {showSearch && (alwaysShowSearch || options.length > 3) && (
            <div
              className={`border-b ${theme === 'light' ? 'border-[#D9D9D9]' : 'border-[#30445A]'}`}
            >
              <div className="relative">
                <div className="absolute top-0 bottom-0 left-0 flex items-center justify-center w-10 pointer-events-none">
                  <svg
                    className={`w-4 h-4 ${theme === 'light' ? 'text-[#202020]' : 'text-[#CED5E3]'}`}
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 20 20"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
                    />
                  </svg>
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  className={`w-full p-2 ${
                    theme === 'light' ? 'text-[#202020]' : 'text-[#D9E4F199]'
                  } rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm`}
                  style={{
                    textIndent: '2rem',
                    backgroundColor: theme === 'light' ? '#FFFFFF' : '#151F2C',
                  }}
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          )}

          {type === 'columns' ? (
            <div
              className={`text-sm ${
                theme === 'light' ? 'text-[#202020]' : 'text-[#D9E4F1]'
              } max-h-60 overflow-y-auto m-[2px] ${theme === 'light' ? 'shadow-[0_4px_12px_rgba(0,0,0,0.2)]' : 'shadow-[0_4px_16px_rgba(0,0,0,0.4)]'}`}
            >
              {filteredOptions.length ? (
                filteredOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center px-4 py-2 cursor-pointer ${
                      theme === 'light' ? 'hover:bg-[#F5F5F5]' : 'hover:bg-[#1E2B3A]'
                    } ${option.disabled ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={option.checked}
                      disabled={option.disabled}
                      onChange={() => handleSelect(option)}
                    />
                    {option.label}
                  </label>
                ))
              ) : (
                <div
                  className={`px-4 py-2 ${theme === 'light' ? 'text-[#202020]' : 'text-gray-400'}`}
                >
                  No results found
                </div>
              )}
            </div>
          ) : (
            <ul
              className={`${getTextSizeClass()} ${
                theme === 'light' ? 'text-[#24527A]' : 'text-[#D9E4F1]'
              } max-h-60 overflow-y-auto m-[2px]`}
            >
              {filteredOptions.length ? (
                filteredOptions.map((option, index) => (
                  <li
                    key={index}
                    data-project-id={option.value}
                    className={`px-4 py-2 cursor-pointer relative ${
                      selectedOption === option.label
                        ? theme === 'light'
                          ? 'bg-[#F0F5FF] rounded-lg'
                          : 'bg-[#11518C] rounded-lg'
                        : theme === 'light'
                        ? 'hover:bg-[#F7F9FF] rounded-lg'
                        : 'hover:bg-[#1E2B3A] rounded-lg'
                    }`}
                    onClick={() => {
                      handleSelect(option);
                    }}
                    onMouseEnter={() => {
                      if (onOptionHover) {
                        onOptionHover(option.value);
                      }
                    }}
                    onMouseLeave={() => {
                      if (onOptionMouseLeave) {
                        onOptionMouseLeave(option.value);
                      }
                    }}
                    role="option"
                    aria-selected={selectedOption === option.label}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={
                          selectedOption === option.label
                            ? theme === 'light'
                              ? 'text-[#202020]'
                              : 'text-white'
                            : ''
                        }
                      >
                        {option.label}
                      </span>
                      <div className="flex items-center">
                        {type === 'sprint' && (() => {
                          const isAzure = String(sessionStorage.getItem('boardType') || '').toLowerCase().includes('azure');
                          const raw = String(
                            option?.state ??
                            option?.timeFrame ??
                            option?.attributes?.timeFrame ??
                            ''
                          ).toLowerCase();
                          const isActiveLike = isAzure ? raw === 'current' : raw === 'active';
                          const isClosedLike = isAzure ? raw === 'past'    : raw === 'closed';
                          const label = isAzure
                            ? (isActiveLike ? 'Current' : isClosedLike ? 'Past' : 'Upcoming')
                            : (isActiveLike ? 'Active'  : isClosedLike ? 'Closed' : 'Upcoming');

                          const colorClass = isActiveLike
                            ? 'text-green-500'
                            : isClosedLike
                              ? 'text-red-500'
                              : 'text-yellow-500';

                          return (
                            <span className={`ml-2 text-xs ${colorClass}`}>
                              {label}
                            </span>
                          );
                        })()}
                        {type === 'release' && (
                          <span
                            className={`ml-2 text-xs ${
                              option.status === 'Released' ? 'text-green-500' : 'text-blue-400'
                            }`}
                          >
                            {option.status === 'Released' ? 'Released' : 'Unreleased'}
                          </span>
                        )}
                        {option.hasMultipleBoards && (
                          <div className="ml-2 p-1">
                            <svg
                              className="w-4 h-4 dark:text-white text-[#626262]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))
              ) : (
                <li
                  className={`px-4 py-2 ${theme === 'light' ? 'text-[#202020]' : 'text-gray-400'}`}
                >
                  No results found
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

DropdownButton.propTypes = {
  buttonLabel: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.any.isRequired,
      state: PropTypes.string,
      checked: PropTypes.bool,
      disabled: PropTypes.bool,
    }),
  ),
  onSelect: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  selectedOption: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.any.isRequired,
    }),
  ]),
  isOpen: PropTypes.bool,
  setIsOpen: PropTypes.func,
  reference: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
  type: PropTypes.string,
  width: PropTypes.string,
  height: PropTypes.string,
  textSize: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'icon']),
  icon: PropTypes.node,
  title: PropTypes.string,
  showSearch: PropTypes.bool,
  alwaysShowSearch: PropTypes.bool,
  autoFocusSearch: PropTypes.bool,
  onClearAll: PropTypes.func,
  showArrow: PropTypes.bool,
  onArrowClick: PropTypes.func,
  onOptionHover: PropTypes.func,
  onOptionMouseLeave: PropTypes.func,
  customClassName: PropTypes.string,
};

export default DropdownButton;
