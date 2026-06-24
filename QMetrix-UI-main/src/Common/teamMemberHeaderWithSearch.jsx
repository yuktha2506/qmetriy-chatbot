import { useCallback } from "react";
import PropTypes from "prop-types";
import { Search } from "lucide-react";

const TeamMemberHeaderWithSearch = ({ displayName, toggleSearch, showSearch, progressSort }) => {
  const handleHeaderClick = () => {
    if (progressSort) progressSort();
  };

  const handleSearchClick = useCallback((e) => {
    e.stopPropagation(); 
    toggleSearch();
  }, [toggleSearch]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        paddingLeft: 8,
        cursor: "pointer",
      }}
      onClick={handleHeaderClick}
    >
      <span>{displayName}</span>
      <Search
        size={16}
        style={{ cursor: "pointer", color: showSearch ? "#066FD1" : "inherit" }}
        onClick={handleSearchClick}
        title={showSearch ? "Hide search" : "Show search"}
      />
    </div>
  );
};

TeamMemberHeaderWithSearch.propTypes = {
  displayName: PropTypes.string.isRequired,
  toggleSearch: PropTypes.func.isRequired,
  showSearch: PropTypes.bool.isRequired,
  progressSort: PropTypes.func,
};

export default TeamMemberHeaderWithSearch;
