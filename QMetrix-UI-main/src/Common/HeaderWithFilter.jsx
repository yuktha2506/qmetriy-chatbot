import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { Filter } from 'lucide-react';
import { ArrowUp, ArrowDown } from 'lucide-react';

const HeaderWithFilter = (props) => {
  const {
    displayName,
    field,
    onFilterClick,
    enableSorting,
    setSort,
    isFilterOpen,
    hasActiveFilter,
    progressSort,
    column,
  } = props;

  const [localSort, setLocalSort] = useState(null);

  const updateSortState = () => {
    if (column && typeof column.getSort === 'function') {
      setLocalSort(column.getSort()); 
    }
  };

  useEffect(() => {
    updateSortState();
    if (!column) return;
    const onSortChanged = () => updateSortState();
    column.addEventListener('sortChanged', onSortChanged);
    return () => column.removeEventListener('sortChanged', onSortChanged);
  }, [column]);

  const handleSort = (e) => {
    if (!enableSorting) return;
    e.stopPropagation();

    if (progressSort) {
      progressSort(e.shiftKey);
    } else if (setSort) {
      const current = column?.getSort?.();
      if (current === 'asc') {
        setSort('desc', e.shiftKey);
      } else {
        setSort('asc', e.shiftKey);
      }
    }
    setTimeout(updateSortState, 50);
  };

  const getSortIcon = () => {
    if (!enableSorting) return null;

    if (localSort === 'asc') {
      return <ArrowUp size={14} className="text-[#DCE1E2]" />;
    } else if (localSort === 'desc') {
      return <ArrowDown size={14} className="text-[#DCE1E2]" />;
    } else {
      return <ArrowUp size={14} className="text-[#DCE1E2] opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center' }} className="group">
      <span
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1px',
        }}
        onClick={enableSorting ? handleSort : undefined}
      >
        {displayName} {getSortIcon()}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onFilterClick(field, e);
        }}
        style={{
          marginLeft: '6px',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
        aria-label={`Filter ${displayName}`}
      >
        <Filter
          size={16}
          className={`transition-colors duration-200 ${
            isFilterOpen || hasActiveFilter ? 'text-[#066FD1]' : 'text-[#6C7A91] hover:text-[#066FD199]'
          }`}
        />
      </button>
    </div>
  );
};

HeaderWithFilter.propTypes = {
  displayName: PropTypes.string.isRequired,
  field: PropTypes.string.isRequired,
  onFilterClick: PropTypes.func.isRequired,
  enableSorting: PropTypes.bool,
  setSort: PropTypes.func,
  hasActiveFilter: PropTypes.any,
  isFilterOpen: PropTypes.bool,
  progressSort: PropTypes.func,
  column: PropTypes.object,
};

export default HeaderWithFilter;
