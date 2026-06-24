import  {
  useRef,
  useState,
  useMemo,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import PropTypes from 'prop-types';
import { AgGridReact } from 'ag-grid-react';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import SearchFloatingFilter from './searchFloatingFilter';
import JiraHeaderWithSearch from './jiraHeaderWithSearch';
import TeamMemberHeaderWithSearch from './teamMemberHeaderWithSearch';
import HeaderWithFilter from './HeaderWithFilter';
import FilterModal from './FilterModal';
import CustomEditableCellRenderer from '../AGColumns/CustomEditableCellRenderer';
import { PR_FILTER_OPTIONS, PR_COLUMN_FIELDS } from '../../constants';

import {
  ClientSideRowModelModule,
  PaginationModule,
  TooltipModule,
  ModuleRegistry,
  NumberFilterModule,
  ValidationModule,
  TextFilterModule,
  DateFilterModule,
  CellStyleModule,
  TextEditorModule,
  ExternalFilterModule,
  NumberEditorModule,
  RenderApiModule,
  ColumnAutoSizeModule,
} from 'ag-grid-community';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  PaginationModule,
  TooltipModule,
  NumberFilterModule,
  ValidationModule,
  TextFilterModule,
  DateFilterModule,
  CellStyleModule,
  TextEditorModule,
  ExternalFilterModule,
  NumberEditorModule,
  RenderApiModule,
  ColumnAutoSizeModule,
]);

const AGrid = forwardRef(({
  rowData = [],
  columnDefs = [],
  gridOptions = {},
  height = '500px',
  onApiReady,
  onCellValueChanged,
  context,
  initialPageSize = 5,
  preventColumnDrag = false,
  enableColumnDragRestore = true,
  clearFiltersSignal = 0,
  theme = 'dark',
  disableFirstColumnSearch = false,
  getRowId,
}, ref) => {
  const gridRef = useRef(null);
  const gridApiRef = useRef(null);
  const columnApiRef = useRef(null);

  const [paginationPageSize, setPaginationPageSize] = useState(initialPageSize);
  const [showFloatingFilter, setShowFloatingFilter] = useState(true);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterModalPosition, setFilterModalPosition] = useState({ top: 0, left: 0 });
  const [filterOptions, setFilterOptions] = useState({});
  const [selectedFilterValuesMap, setSelectedFilterValuesMap] = useState({});
  const [selectedFilterValues, setSelectedFilterValues] = useState([]);
  const [currentFilterColumn, setCurrentFilterColumn] = useState(null);
  const [savedColumnState, setSavedColumnState] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const rowHeight = 40;
  const headerHeight = 40;
  const paginationHeight = 60;

  // EXPOSE TO PARENT
 useImperativeHandle(ref, () => ({
  clearExternalFilter: (field) => {
    setSelectedFilterValuesMap((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
    gridApiRef.current?.onFilterChanged();
    gridApiRef.current?.refreshHeader();
  },
  getSelectedFilters: () => selectedFilterValuesMap,
  clearAllExternalFilters: () => {
    setSelectedFilterValuesMap({});
    gridApiRef.current?.setFilterModel(null);
    gridApiRef.current?.onFilterChanged();
    gridApiRef.current?.refreshHeader();
  },
}));

  const calculatePageSize = useCallback(() => {
    if (gridRef.current) {
      const availableHeight = gridRef.current.clientHeight || parseInt(height, 10);
      const usableHeight = availableHeight - (headerHeight + paginationHeight);
      const rowsThatFit = Math.floor(usableHeight / rowHeight);
      setPaginationPageSize(rowsThatFit > 0 ? rowsThatFit : 4);
    }
  }, [height]);

  useEffect(() => {
    calculatePageSize();
    window.addEventListener('resize', calculatePageSize);
    return () => window.removeEventListener('resize', calculatePageSize);
  }, [calculatePageSize]);

  useEffect(() => {
    if (gridRef.current && gridOptions.quickFilterText !== undefined) {
      gridRef.current.api.setQuickFilter(gridOptions.quickFilterText);
    }
  }, [gridOptions.quickFilterText]);

  const toggleFloatingFilter = () => {
    setShowFloatingFilter((prev) => {
      const newState = !prev;
      if (gridApiRef.current) {
        gridApiRef.current.setGridOption('floatingFiltersHeight', newState ? 36 : 0);
        gridApiRef.current.refreshHeader();
        gridApiRef.current.onFilterChanged();
      }
      return newState;
    });
  };

  const handleFilterIconClick = useCallback((field, event) => {
    const modalWidth = 180; 
    const gridRect = gridRef.current.getBoundingClientRect();    
    let columnHeader = gridRef.current.querySelector(`[col-id="${field}"]`);
    if (!columnHeader) {
      columnHeader = gridRef.current.querySelector(`[col-id="static_${field}"]`);
    }
    if (!columnHeader) {
      columnHeader = gridRef.current.querySelector(`[col-id="dynamic_${field}"]`);
    }
    if (!columnHeader) {
      const fieldWithUnderscore = field.replace(/([A-Z])/g, '_$1').toLowerCase();
      columnHeader = gridRef.current.querySelector(`[col-id="static_${fieldWithUnderscore}"]`);
    }
    let left = 0;
    let top = headerHeight + 2; 
    if (columnHeader) {
      const headerRect = columnHeader.getBoundingClientRect();
      const relativeLeft = headerRect.left - gridRect.left;
      const relativeTop = headerRect.bottom - gridRect.top;
      top = relativeTop + 2; 
      left = relativeLeft + headerRect.width - modalWidth;

      if (left < 10) {
        left = 10;
      }
      if (left + modalWidth > gridRect.width) {
        left = Math.max(10, gridRect.width - modalWidth - 10);
      }
    } else if (event) {
      const clickX = event.clientX - gridRect.left;
      left = clickX - (modalWidth / 2);
      
      if (left + modalWidth > gridRect.width) {
        left = gridRect.width - modalWidth - 10;
      }
      if (left < 10) {
        left = 10;
      }
    } else {
      // Fallback: center the modal horizontally when neither columnHeader nor event is available
      left = Math.max(10, (gridRect.width - modalWidth) / 2);
      if (left + modalWidth > gridRect.width) {
        left = Math.max(10, gridRect.width - modalWidth - 10);
      }
    }

    setCurrentFilterColumn(field);
    setSelectedFilterValuesMap((prev) => {
      const selected = prev[field] || [];
      setSelectedFilterValues(selected);
      return prev;
    });

    setFilterModalVisible(true);
    setFilterModalPosition({ top, left });
  }, []);

  const onApplyFilter = useCallback((values) => {
    setSelectedFilterValuesMap((prev) => ({
      ...prev,
      [currentFilterColumn]: values,
    }));

    if (gridApiRef.current) {
      gridApiRef.current.onFilterChanged();
    }
  }, [currentFilterColumn]);

  const onCancelFilter = () => {
    setFilterModalVisible(false);
  };
const customComparator = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  return a
    .toString()
    .trim()
    .toLowerCase()
    .localeCompare(
      b.toString().trim().toLowerCase(),
      undefined,
      { numeric: true }
    );
};
  const columnDefsWithApi = useMemo(() => {
    return columnDefs.map((colDef, index) => {
    const baseColDef = {
      ...colDef,
      comparator: customComparator, // ensures case-insensitive sorting
      filterParams: { comparator: customComparator },
    };
      if (index === 0 && !disableFirstColumnSearch) {
          return {
            ...baseColDef,
            filter: 'agTextColumnFilter',
            sortable: true,
            floatingFilter: true,
            floatingFilterComponent: SearchFloatingFilter,
            headerComponent: JiraHeaderWithSearch,
            headerComponentParams: {
              toggleJiraSearch: toggleFloatingFilter,
              showJiraSearch: showFloatingFilter,
              displayName: colDef.headerName,
            },
          };
        }
      if (colDef.field && colDef.headerfilter === true) {
        return {
          ...baseColDef,
          filter: 'agSetColumnFilter',
          floatingFilter: colDef.floatingFilter !== false,
          headerComponent: HeaderWithFilter,
          headerComponentParams: {
            displayName: colDef.headerName,
            field: colDef.field,
            onFilterClick: handleFilterIconClick,
            hasActiveFilter: (selectedFilterValuesMap[colDef.field] || []).length > 0,
            isFilterOpen: currentFilterColumn === colDef.field && filterModalVisible,
            key: `${colDef.field}-${(selectedFilterValuesMap[colDef.field] || []).length}`,
          },
        };
      }
      if (colDef.headerName === 'TEAM MEMBER') {
        return {
          ...baseColDef,
          filter: 'agTextColumnFilter',
          floatingFilter: true,
          floatingFilterComponent: SearchFloatingFilter,
          headerComponent: TeamMemberHeaderWithSearch,
          headerComponentParams: {
            toggleSearch: toggleFloatingFilter,
            showSearch: showFloatingFilter,
            displayName: colDef.headerName,
          },
        };
      }
      return baseColDef;
    });
  }, [columnDefs, handleFilterIconClick, selectedFilterValuesMap, showFloatingFilter, currentFilterColumn, filterModalVisible]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    sortIcon: true,
    sortingOrder: ['asc', 'desc'],
    resizable: true,
    flex: 1,
    suppressMenu: true,
    floatingFilter: false,
    floatingFilterComponentParams: {
      gridApi: gridApiRef.current,
    },
    floatingFilterComponent: SearchFloatingFilter,
    filter: false,
        suppressHeaderFilterButton: true,
  }), []);

  const gridOptionsConfig = useMemo(() => ({
    ...gridOptions,
    rowHeight,
    headerHeight,
    pagination: disableFirstColumnSearch ? false : true,
    paginationPageSize,
    paginationPageSizeSelector: [...new Set([paginationPageSize, 50, 100])].sort((a, b) => a - b),
    tooltipShowDelay: 1,
    suppressClickEdit: false,
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true,
    suppressDragLeaveHidesColumns: !preventColumnDrag,
    suppressMovableColumns: preventColumnDrag,
    maintainColumnOrder: true,
    // Completely disable all built-in filters globally
    suppressMenu: true,
    suppressHeaderFilterButton: true,
    suppressColumnVirtualisation: false,
    suppressPaginationPanel: disableFirstColumnSearch,
    components: {
      SearchFloatingFilter,
      CustomEditableCellRenderer,
    },
  }), [gridOptions, paginationPageSize, preventColumnDrag]);

  const NoRowsOverlay = () => (
    <div style={{
      padding: '20px',
      fontSize: '16px',
      color: 'white',
      backgroundColor: 'transparent',
      textAlign: 'center',
    }}>
      No records to display
    </div>
  );

  const onGridReady = useCallback((params) => {
    gridApiRef.current = params.api;
    columnApiRef.current = params.columnApi;

    if (onApiReady) onApiReady(params.api);

    params.api.setGridOption('floatingFiltersHeight', showFloatingFilter ? 36 : 0);

    if (enableColumnDragRestore && !preventColumnDrag) {
      params.api.addEventListener('columnVisible', (event) => {
        if (!event.visible && event.source === 'uiColumnDragged') {
          setTimeout(() => {
            params.api.setColumnVisible(event.column.getColId(), true);
          }, 100);
        }
      });
    }

    const saveColumnState = () => {
      if (params.api) {
        const columnState = params.api.getColumnState();
        setSavedColumnState(columnState);
      }
    };

    params.api.addEventListener('columnMoved', saveColumnState);
    params.api.addEventListener('columnResized', saveColumnState);
    params.api.addEventListener('columnVisible', saveColumnState);

    if (savedColumnState && savedColumnState.length > 0) {
      params.api.applyColumnState({
        state: savedColumnState,
        applyOrder: true,
      });
    } else {
      params.api.sizeColumnsToFit();
    }

    if (rowData && rowData.length > 0) {
      const options = {};
      columnDefs.forEach((colDef) => {
        if (colDef.field) {
          let values;
          if (colDef.field === PR_COLUMN_FIELDS.BLOCKER) {
            values = rowData.map((row) => {
              const blockers = row[colDef.field];
              if (!Array.isArray(blockers) || blockers.length === 0) return 'No Blocker';
              return 'Has Blocker';
            }).filter(Boolean);
          } else if (colDef.field === PR_COLUMN_FIELDS.DAYS_OPEN) {
            values = rowData.map((row) => row.daysOpenRange).filter(v => v != null);
            options[colDef.field] = [...new Set(values)].sort((a, b) => a - b);
          }
          else if (colDef.field === PR_COLUMN_FIELDS.CODE_CHANGES) {
            values = rowData.map((row) => row.filesChangedRange).filter(v => v != null);
            options[colDef.field] = [...new Set(values)].sort((a, b) => a - b);
          } else if (colDef.field === PR_COLUMN_FIELDS.REVIEWER) {
            values = rowData.map((row) => row.reviewerRange).filter(Boolean);
            options[colDef.field] = PR_FILTER_OPTIONS.REVIEWER;
          }  else {
            values = rowData.map((row) => row[colDef.field]).filter(Boolean);
          }
          if (!options[colDef.field]) {
            options[colDef.field] = [...new Set(values)].sort();
          }
        }
      });
      setFilterOptions(options);
    }

    setIsInitialized(true);
  }, [rowData, columnDefs, showFloatingFilter, savedColumnState, enableColumnDragRestore, preventColumnDrag, onApiReady]);

  useEffect(() => {
    if (isInitialized && rowData && rowData.length > 0) {
      const options = {};
      columnDefs.forEach((colDef) => {
        if (colDef.field) {
          let values;
          if (colDef.field === PR_COLUMN_FIELDS.BLOCKER) {
            values = rowData.map((row) => {
              const blockers = row[colDef.field];
              if (!Array.isArray(blockers) || blockers.length === 0) return 'No Blocker';
              return 'Has Blocker';
            }).filter(Boolean);
          }else if (colDef.field === PR_COLUMN_FIELDS.DAYS_OPEN) {
            values = rowData.map((row) => row.daysOpenRange).filter(v => v != null);
            options[colDef.field] = [...new Set(values)].sort((a, b) => a - b);
          }
          else if (colDef.field === PR_COLUMN_FIELDS.CODE_CHANGES) {
            values = rowData.map((row) => row.filesChangedRange).filter(v => v != null);
            options[colDef.field] = [...new Set(values)].sort((a, b) => a - b);
          } else if (colDef.field === PR_COLUMN_FIELDS.REVIEWER) {
            values = rowData.map((row) => row.reviewerRange).filter(Boolean);
            options[colDef.field] = PR_FILTER_OPTIONS.REVIEWER;
          }  else {
            values = rowData.map((row) => row[colDef.field]).filter(Boolean);
          }
          if (!options[colDef.field]) {
            options[colDef.field] = [...new Set(values)].sort();
          }
        }
      });
      setFilterOptions(options);
    }
  }, [rowData, columnDefs, isInitialized]);

  const isExternalFilterPresent = useCallback(() => {
    return Object.values(selectedFilterValuesMap).some((values) => values.length > 0);
  }, [selectedFilterValuesMap]);

  const doesExternalFilterPass = useCallback((node) => {
    for (const [column, values] of Object.entries(selectedFilterValuesMap)) {
      if (values.length > 0) {
        let nodeValue;
        if (column === PR_COLUMN_FIELDS.BLOCKER) {
          const blockers = node.data[column];
          if (!Array.isArray(blockers) || blockers.length === 0) {
            nodeValue = 'No Blocker';
          } else {
            nodeValue = 'Has Blocker';
          }
        } else if (column === PR_COLUMN_FIELDS.DAYS_OPEN) {
          nodeValue = node.data.daysOpenRange;
        } else if (column === PR_COLUMN_FIELDS.REVIEWER) {
          nodeValue = node.data.reviewerRange;
        } else if (column === PR_COLUMN_FIELDS.CODE_CHANGES) {
          nodeValue = node.data.filesChangedRange;
        } else {
          nodeValue = node.data[column];
        }
        
        // If nodeValue is null/undefined, it won't match any filter option, so exclude it
        if (nodeValue == null || !values.includes(nodeValue)) {
          return false;
        }
      }
    }
    return true;
  }, [selectedFilterValuesMap]);

  useEffect(() => {
    setSelectedFilterValuesMap({});
    if (gridApiRef.current) {
      gridApiRef.current.setFilterModel(null);
      gridApiRef.current.onFilterChanged();
      gridApiRef.current.refreshHeader();
    }
  }, [clearFiltersSignal]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height, position: 'relative' }}>
      <div
        ref={gridRef}
        className={`ag-theme-alpine ${theme === 'light' ? 'scrollbar-super-thin-lightMode light-mode' : 'scrollbar-super-thin'}`}
        style={{ flexGrow: 1, width: '100%', height, overflowX: 'auto', position: 'relative' }}
      >
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefsWithApi}
          defaultColDef={defaultColDef}
          gridOptions={gridOptionsConfig}
          modules={[
            ClientSideRowModelModule,
            PaginationModule,
            TooltipModule,
            NumberFilterModule,
            ValidationModule,
            TextFilterModule,
            DateFilterModule,
          ]}
          domLayout="normal"
          onGridSizeChanged={calculatePageSize}
          noRowsOverlayComponent={NoRowsOverlay}
          components={{ SearchFloatingFilter }}
          onGridReady={onGridReady}
          isExternalFilterPresent={isExternalFilterPresent}
          doesExternalFilterPass={doesExternalFilterPass}
          onCellValueChanged={onCellValueChanged}
          context={context}
          getRowId={getRowId}
        />
        {filterModalVisible && currentFilterColumn && (
          <FilterModal
            options={filterOptions[currentFilterColumn] || []}
            selectedValues={selectedFilterValues}
            onApply={onApplyFilter}
            onCancel={onCancelFilter}
            position={filterModalPosition}
          />
        )}
      </div>
    </div>
  );
});

AGrid.propTypes = {
  rowData: PropTypes.array,
  columnDefs: PropTypes.array,
  gridOptions: PropTypes.object,
  height: PropTypes.string,
  onApiReady: PropTypes.func,
  onCellValueChanged: PropTypes.func,
  context: PropTypes.object,
  initialPageSize: PropTypes.number,
  preventColumnDrag: PropTypes.bool,
  enableColumnDragRestore: PropTypes.bool,
  clearFiltersSignal: PropTypes.number,
  theme: PropTypes.string,
  disableFirstColumnSearch: PropTypes.bool,
  getRowId: PropTypes.func,
};
AGrid.displayName = 'AGrid';
export default AGrid;
