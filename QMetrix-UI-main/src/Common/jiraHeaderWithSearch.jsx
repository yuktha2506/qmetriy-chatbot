import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { Search, ArrowUp, ArrowDown } from "lucide-react";

const JiraHeaderWithSearch = ({
  displayName,
  toggleJiraSearch,
  showJiraSearch,
  column,
  enableSorting,
  progressSort, 
  setSort,
}) => {
  const [sort, setLocalSort] = useState(null);

  const updateSortState = () => {
    if (column) {
      const currentSort = column.getSort();
      setLocalSort(currentSort);
    }
  };

  useEffect(() => {
    updateSortState();

    if (column) {
      const onSortChanged = () => updateSortState();
      column.addEventListener("sortChanged", onSortChanged);
      return () => column.removeEventListener("sortChanged", onSortChanged);
    }
  }, [column]);

  const handleSort = (e) => {
    e.stopPropagation();
    if (!enableSorting) return;

    if (progressSort) {
      progressSort(e.shiftKey);
    } else if (setSort && column) {
      const currentSort = column.getSort();
      if (currentSort === "asc") {
        setSort("desc", e.shiftKey);
      } else if (currentSort === "desc") {
        setSort(null, e.shiftKey);
      } else {
        setSort("asc", e.shiftKey);
      }
    }

    setTimeout(() => updateSortState(), 50);
  };

  const handleSearchClick = useCallback(
    (e) => {
      e.stopPropagation();
      toggleJiraSearch();
    },
    [toggleJiraSearch]
  );

  const getSortIcon = () => {
    if (!enableSorting) return null;

    const baseClass =
      "ml-1 inline-block opacity-0 group-hover:opacity-100 transition-opacity duration-150";

    if (sort === "asc") {
      return <ArrowUp size={14} strokeWidth={2} className={baseClass} />;
    } else if (sort === "desc") {
      return <ArrowDown size={14} strokeWidth={2} className={baseClass} />;
    } else {
      return <ArrowDown size={14} strokeWidth={2} className={baseClass + " opacity-0"} />;
    }
  };

  return (
    <div
      className="flex items-center justify-between group cursor-pointer select-none"
      onClick={handleSort}
      style={{ padding: "0 6px" }}
    >
      <div className="flex items-center space-x-1">
        <span>{displayName}</span>
        {getSortIcon()}
      </div>

      <button
        onClick={handleSearchClick}
        className={`ml-2 bg-transparent border-none cursor-pointer transition-opacity 
          ${showJiraSearch ? "text-blue-400 visible" : "text-gray-400 invisible group-hover:visible"}`}
        aria-label={`Search ${displayName}`}
      >
        <Search size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
};

JiraHeaderWithSearch.propTypes = {
  displayName: PropTypes.string.isRequired,
  toggleJiraSearch: PropTypes.func.isRequired,
  showJiraSearch: PropTypes.bool.isRequired,
  enableSorting: PropTypes.bool,
  progressSort: PropTypes.func,
  setSort: PropTypes.func,
  column: PropTypes.object,
};

export default JiraHeaderWithSearch;
