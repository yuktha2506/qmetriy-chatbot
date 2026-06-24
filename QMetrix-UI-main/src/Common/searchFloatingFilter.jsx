import { forwardRef, useImperativeHandle, useState } from "react";
import PropTypes from "prop-types";
import { Form } from "react-bootstrap";

const SearchFloatingFilter = forwardRef((props, ref) => {
  const [value, setValue] = useState("");

  const getFilterType = () => {
    try {
      return typeof props.column?.getColDef === 'function'
        ? props.column.getColDef()?.filter
        : props.column?.colDef?.filter;
    } catch {
      return undefined;
    }
  };

  const changeListener = (e) => {
    const newValue = e.target.value;
    setValue(newValue);

    if (!props.parentFilterInstance) return;

    const filterType = getFilterType();

    if (filterType === 'agDateColumnFilter') {
      props.parentFilterInstance((instance) => {
        if (!newValue) {
          instance.onFloatingFilterChanged(null);
          return;
        }
        const m = /^\d{4}-\d{2}-\d{2}$/.exec(newValue);
        if (!m) {
          return;
        }
        const [y, mth, d] = newValue.split('-').map(Number);
        const date = new Date(y, mth - 1, d);
        if (isNaN(date.getTime())) {
          return;
        }
        instance.onFloatingFilterChanged({ type: 'equals', dateFrom: date });
      });
      return;
    }
    props.parentFilterInstance((instance) => {
      instance.onFloatingFilterChanged("contains", newValue);
    });
  };

  useImperativeHandle(ref, () => ({
    onParentModelChanged(parentModel) {
      setValue(parentModel?.filter || "");
    },
  }));
const clearFilter = () => {
if (!props.parentFilterInstance) return;
  props.parentFilterInstance((instance) => {
    instance.onFloatingFilterChanged(null, null);
  });
  setValue("");
};
  return (
    <div id="search-floating-filter"
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "stretch",
        padding: 0,
        margin: 0,
        overflow: "hidden",
        boxSizing: "border-box",
      }}>
      <Form.Control
        value={value}
        id="search-floating-filter-input"
        type="text"
        onChange={changeListener}
        className="form-control-sm w-full shadow-none"
        autoComplete="off"
        placeholder="Search"
        style={{
          backgroundColor: "inherit",
          border: "none",
          boxShadow: "none",
          fontSize: "0.875rem",
          paddingTop: "2px",
          paddingBottom: "2px",
          paddingLeft: "0px",
          paddingRight: "5px",
          lineHeight: "1.8",
        }}
      />
      {value && (
        <span
          onClick={clearFilter}
          style={{
            position: "absolute",
            right: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            cursor: "pointer",
            fontSize: "12px", 
            color: "#1d60d1", 
            zIndex: 1001,
            pointerEvents: "auto",
          }}
        >
          <i className="fas fa-times"></i> 
        </span>
      )}
    </div>
  );
});

SearchFloatingFilter.displayName = "SearchFloatingFilter";

SearchFloatingFilter.propTypes = {
  parentFilterInstance: PropTypes.func.isRequired,
  column: PropTypes.shape({
    colId: PropTypes.string.isRequired,
    getColDef: PropTypes.func,
    colDef: PropTypes.shape({
      headerName: PropTypes.string.isRequired,
      filter: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.func,
        PropTypes.bool,
      ]),
    }).isRequired,
  }).isRequired,
  gridApi: PropTypes.object, 
};

export default SearchFloatingFilter;
