import { APP_STRINGS } from '../../constants';
import HyperLink from '../Common/hyperLink';
import { TriangleAlert } from 'lucide-react';
import { customComparator } from '../Common/custumComparator';
import HeaderWithFilter from '../Common/HeaderWithFilter';

export const generateDynamicJiraColumns = (customFieldsByName, staticColumnNames = new Set()) => {
  if (!customFieldsByName || typeof customFieldsByName !== 'object') {
    return [];
  }

  const excludedFields = new Set([
    'development',
    'rank',
    '[chart] date of first response',
    '[CHART] Date of First Response',
    '[CHART] Time in Status',
    '[chart] time in status',
  ]);

  const filteredFields = Object.entries(customFieldsByName).filter(([fieldName]) => {
    const displayName = fieldName.toUpperCase().replace(/_/g, ' ');
    const normalizedFieldName = fieldName.toLowerCase();

    const isStaticColumn = staticColumnNames.has(displayName);
    const isExcludedField =
      excludedFields.has(normalizedFieldName) ||
      excludedFields.has(fieldName.toLowerCase()) ||
      excludedFields.has(fieldName);

    const isCustomField = normalizedFieldName.startsWith('customfield');

    const isDeveloperField =
      staticColumnNames.has('DEVELOPER') &&
      (displayName.includes('DEVELOPER') ||
        displayName.includes('DEVELOPED BY') ||
        normalizedFieldName.includes('developer') ||
        normalizedFieldName.includes('developed_by'));

    const shouldInclude =
      !isStaticColumn && !isExcludedField && !isCustomField && !isDeveloperField;

    return shouldInclude;
  });

  return filteredFields.map(([fieldName, fieldValue], index) => {
    const safeFieldName = fieldName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

    const uniqueFieldName = `custom_${safeFieldName}_${index}`;

    const column = {
      headerName: fieldName.toUpperCase().replace(/_/g, ' '),
      field: uniqueFieldName,
      sortable: true,
      minWidth: 160,
      allowToggle: true,
      optional: true,
      colId: `custom_${safeFieldName}_${index}`,
      valueGetter: (params) => {
        const customFields = params.data?.customFieldsByName || {};
        return customFields[fieldName] || 'N/A';
      },
    };

    const fieldType = determineFieldType(fieldValue);

    switch (fieldType) {
      case 'text':
      case 'string':
        column.filter = 'agTextColumnFilter';
        column.floatingFilter = true;
        column.filterParams = {
          caseSensitive: false,
          trimInput: true,
        };
        column.minWidth = 160;
        break;

      case 'number':
        column.filter = 'agNumberColumnFilter';
        column.floatingFilter = true;
        column.valueFormatter = (params) => {
          return params.value ? Number(params.value).toLocaleString() : '0';
        };
        column.minWidth = 160;
        break;

      case 'date':
        column.filter = 'agDateColumnFilter';
        // Disable floating search for date fields (custom date columns)
        column.floatingFilter = false;
        column.cellRenderer = (params) => {
          if (!params.value || params.value === 'N/A') {
            return <span style={{ color: '#6c757d' }}>No Date</span>;
          }
          try {
            const date = new Date(params.value);
            return <span>{date.toLocaleDateString()}</span>;
          } catch {
            return <span>{params.value}</span>;
          }
        };
        column.minWidth = 160;
        break;

      case 'boolean':
        column.filter = 'agSetColumnFilter';
        column.floatingFilter = false;
        column.cellRenderer = (params) => {
          const value = params.value;
          if (value === true || value === 'true' || value === 1 || value === '1') {
            return <span style={{ color: '#28a745' }}>✓ Yes</span>;
          } else if (value === false || value === 'false' || value === 0 || value === '0') {
            return <span style={{ color: '#dc3545' }}>✗ No</span>;
          }
          return <span style={{ color: '#6c757d' }}>N/A</span>;
        };
        column.minWidth = 160;
        break;

      case 'url':
        column.filter = 'agTextColumnFilter';
        column.floatingFilter = true;
        column.cellRenderer = (params) => {
          if (!params.value || params.value === 'N/A') return 'N/A';
          try {
            new URL(params.value);
            return (
              <HyperLink url={params.value} style={{ color: '#48A7FF' }}>
                {params.value}
              </HyperLink>
            );
          } catch {
            return <span>{params.value}</span>;
          }
        };
        column.minWidth = 200;
        break;

      case 'array':
        column.filter = 'agTextColumnFilter';
        column.floatingFilter = true;
        column.cellRenderer = (params) => {
          if (!params.value || params.value === 'N/A') return 'N/A';
          try {
            const array = Array.isArray(params.value) ? params.value : JSON.parse(params.value);
            return (
              <div>
                {array.map((item, index) => (
                  <span key={index}>
                    {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                    {index !== array.length - 1 && ', '}
                  </span>
                ))}
              </div>
            );
          } catch {
            return <span>{String(params.value)}</span>;
          }
        };
        column.minWidth = 160;
        break;

      case 'object':
        // Special case: ClosedBy -> show only displayName
        if (fieldName.toLowerCase() === 'closedby') {
          column.filter = 'agSetColumnFilter';
          column.floatingFilter = true;
          column.valueGetter = (params) => {
            const v = (params.data?.customFieldsByName || {})[fieldName];
            if (!v) return 'N/A';
            if (typeof v === 'object') return v?.displayName || 'N/A';
            try {
              const obj = typeof v === 'string' ? JSON.parse(v) : v;
              return obj?.displayName || 'N/A';
            } catch {
              return 'N/A';
            }
          };
          column.cellRenderer = (params) => <span>{params.value}</span>;
          column.minWidth = 160;
          break;
        }
        column.filter = 'agTextColumnFilter';
        column.floatingFilter = true;
        column.cellRenderer = (params) => {
          if (!params.value || params.value === 'N/A') return 'N/A';
          try {
            const obj = typeof params.value === 'string' ? JSON.parse(params.value) : params.value;
            return <span>{JSON.stringify(obj, null, 2)}</span>;
          } catch {
            return <span>{String(params.value)}</span>;
          }
        };
        column.minWidth = 200;
        break;

      default:
        column.filter = 'agTextColumnFilter';
        column.floatingFilter = true;
        column.minWidth = 160;
    }

    return column;
  });
};

const determineFieldType = (value) => {
  if (value === null || value === undefined) {
    return 'text';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (typeof value === 'number') {
    return 'number';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'object') {
    return 'object';
  }
  if (typeof value === 'string') {
    if (value.match(/^https?:\/\/.+/)) {
      return 'url';
    }

    if (!isNaN(Date.parse(value)) && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return 'date';
    }

    if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
      return 'boolean';
    }
    return 'text';
  }
  return 'text';
};

export const jiraColumnDefs = (handleFilterIconClick, customFieldsByName = {},sourceManagement) => {
  const staticColumns = [
    {
      headerName: 'ID',
      field: 'jiraTicket',
      minWidth: 120,
      sortable: true,
      filter: false,
      comparator: customComparator,
      valueGetter: (params) => params.data?.jiraTicket || '',
      cellRenderer: (params) => {
        if (!params.data.jiraUrl) return params.value;
        return (
          <HyperLink url={params.data.jiraUrl} style={{ color: '#48A7FF' }}>
            {params.value}
          </HyperLink>
        );
      },
      floatingFilter: true,
      suppressHeaderFilterButton: true,
      allowToggle: false,
      optional: false,
      colId: 'static_id',
    },
    {
      headerName: 'TYPE',
      field: 'type',
      sortable: true,
      filter: 'agSetColumnFilter',
      floatingFilter: true,
      headerComponent: HeaderWithFilter,
      headerfilter: true,
      headerComponentParams: {
        displayName: 'Type',
        field: 'type',
        onFilterClick: handleFilterIconClick,
      },
      minWidth: 100,
      valueGetter: (params) => params.data?.type || 'NA',
      allowToggle: false,
      optional: false,
      colId: 'static_type',
    },
    {
      headerName: sourceManagement === 'GitLab' ? 'MR ID' : 'PR ID',
      field: 'prId',
      sortable: true,
      supressMenu: false,
      suppressHeaderMenuButton: false,
      minWidth: 90,
      filter: 'agSetColumnFilter',
      floatingFilter: true,
      allowToggle: false,
      optional: false,
      colId: 'static_pr_id',
    },
    {
      headerName: 'DUE DATE',
      field: 'dueDate',
      sortable: true,
      filter: 'agDateColumnFilter',
      floatingFilter: false,
      floatingFilterComponent: 'agDateColumnFloatingFilter',
      floatingFilterComponentParams: { suppressFilterButton: true },
      headerfilter: true,
      headerComponent: HeaderWithFilter,
      headerComponentParams: {
        displayName: 'Due Date',
        field: 'dueDate',
        onFilterClick: handleFilterIconClick,
      },
      suppressHeaderMenuButton: false,
      allowToggle: false,
      optional: false,
      colId: 'static_due_date',
      filterParams: {
        comparator: (filterLocalDateAtMidnight, cellValue) => {
          if (!cellValue || cellValue === 'No Due Date') return -1;

          const dueDate = new Date(cellValue);
          const filterTime = filterLocalDateAtMidnight.getTime();
          const cellTime = new Date(
            dueDate.getFullYear(),
            dueDate.getMonth(),
            dueDate.getDate(),
          ).getTime();

          if (cellTime === filterTime) return 0;
          return cellTime < filterTime ? -1 : 1;
        },
      },
      minWidth: 140,
      cellRenderer: (params) => {
        const value = params.value;
        const status = params.data?.status;
        if (!value || value === 'No Due Date') {
          return <span style={{ color: '#6c757d' }}>No Due Date</span>;
        }

        const dueDate = new Date(value);
        const today = new Date();
        const dateStr = dueDate.toISOString().split('T')[0];

        const isPast = dueDate < new Date(today.setHours(0, 0, 0, 0));
        const isToday = dueDate.toDateString() === new Date().toDateString();

        let color = '#28a745';
        if ((isPast && status === 'Done') || status === 'Closed') {
          color = '#28a745';
        } else if (isPast && status !== 'Done') {
          color = '#dc3545';
        } else if (isToday) {
          color = '#ffc107';
        }

        const isDoneOrClosed = status === 'Done' || status === 'Closed';

        return (
          <span
            style={{
              color,
              fontWeight: 'normal',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {isPast && !isDoneOrClosed && (
              <TriangleAlert
                title="Past Due"
                style={{ color: '#dc3545', width: '16px', height: '16px' }}
              />
            )}
            {dateStr}
          </span>
        );
      },
    },
    {
      headerName: 'SPRINT OUTCOMES',
      field: 'sprintOutcome',
      sortable: true,
      minWidth: 120,
      colId: 'static_sprint_outcome',
      allowToggle: true,
      optional: false,
      cellStyle: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
      tooltipValueGetter: (params) => {
        const names = params.data?.sprintOutcome?.sprintNames || [];
        return names.length ? names.join(', ') : 'N/A';
      },
      comparator: (a, b, nodeA, nodeB) => {
        const aVal = nodeA?.data?.sprintOutcome?.spilledOver === false ? 1 : 0;
        const bVal = nodeB?.data?.sprintOutcome?.spilledOver === false ? 1 : 0;
        return aVal - bVal;
      },
      cellRenderer: (params) => {
        const spilled = params.data?.sprintOutcome?.spilledOver;
        const labelChecked = spilled === false;
        const size = 15;
        const circleStyle = {
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'inline-block',
          background: labelChecked
            ? 'linear-gradient(to bottom right, #DCC0FF, #9950F1)'
            : 'transparent',
          border: '3px solid #924fe4'
        };
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="radio"
              checked={labelChecked}
              readOnly
              aria-label="Sprint Outcome"
              style={circleStyle}
            />
          </div>
        );
      },
    },
    {
      headerName: 'STATUS',
      field: 'status',
      sortable: true,
      filter: 'agSetColumnFilter',
      floatingFilter: true,
      headerfilter: true,
      headerComponent: HeaderWithFilter,
      headerComponentParams: {
        displayName: 'Status',
        field: 'status',
        onFilterClick: handleFilterIconClick,
      },
      suppressHeaderFilterButton: true,
      minWidth: 120,
      allowToggle: false,
      optional: false,
      colId: 'static_status',
    },
    {
      headerName: 'SUMMARY',
      field: 'summary',
      sortable: true,
      minWidth: 300,
      filter: 'agTextColumnFilter',
      floatingFilter: true,
      tooltipField: 'summary',
      tooltipValueGetter: (params) => {
        return params.value ? params.value : 'No summary available';
      },
      tooltipComponentParams: {
        color: '#fff',
        backgroundColor: '#333',
      },
      filterParams: {
        caseSensitive: false,
        trimInput: true,
      },
      allowToggle: false,
      optional: false,
      colId: 'static_summary',
    },
    {
      headerName: 'ASSIGNED TO',
      field: 'assignedTo',
      sortable: true,
      filter: 'agSetColumnFilter',
      floatingFilter: true,
      headerfilter: true,
      headerComponent: HeaderWithFilter,
      headerComponentParams: {
        displayName: 'Assigned To',
        field: 'assignedTo',
        onFilterClick: handleFilterIconClick,
      },
      suppressHeaderFilterButton: true,
      minWidth: 150,
      allowToggle: false,
      optional: false,
      colId: 'static_assigned_to',
    },
    {
      headerName: 'BLOCKER',
      field: 'blocker',
      minWidth: 120,
      sortable: true,
      filter: 'agSetColumnFilter',
      floatingFilter: true,
      headerfilter: true,
      headerComponent: HeaderWithFilter,
      headerComponentParams: {
        displayName: 'Blocker',
        field: 'blocker',
        onFilterClick: handleFilterIconClick,
      },
      suppressHeaderFilterButton: true,
      allowToggle: false,
      optional: false,
      colId: 'static_blocker',
      valueGetter: (params) => {
        const blockers = params.data.blocker;
        if (!Array.isArray(blockers) || blockers.length === 0) return 'No Blocker';
        return 'Has Blocker';
      },
      cellRenderer: (params) => {
        const blockers = params.data.blocker;
        if (!Array.isArray(blockers) || blockers.length === 0) return 'No blocker';

        return (
          <>
            {blockers.map((blocker, index) => (
              <span key={blocker.key}>
                <HyperLink url={blocker.url} style={{ color: '#48A7FF', marginRight: 8 }}>
                  {blocker.key}
                </HyperLink>
                {index !== blockers.length - 1 && ','}
              </span>
            ))}
          </>
        );
      },
    },
    {
      headerName: 'PRIORITY',
      field: 'priority',
      minWidth: 120,
      sortable: true,
      filter: 'agSetColumnFilter',
      floatingFilter: true,
      headerfilter: true,
      headerComponent: HeaderWithFilter,
      headerComponentParams: {
        displayName: 'Priority',
        field: 'priority',
        onFilterClick: handleFilterIconClick,
      },
      suppressHeaderFilterButton: true,
      allowToggle: false,
      optional: false,
      colId: 'static_priority',
    },
    {
      headerName: 'SEVERITY',
      field: 'severity',
      minWidth: 120,
      sortable: true,
      filter: 'agSetColumnFilter',
      floatingFilter: true,
      headerfilter: true,
      headerComponent: HeaderWithFilter,
      headerComponentParams: {
        displayName: 'Severity',
        field: 'severity',
        onFilterClick: handleFilterIconClick,
      },
      suppressHeaderFilterButton: true,
      allowToggle: true,
      optional: true,
      colId: 'static_severity',
    },
    {
      headerName: 'DEVELOPER',
      field: 'developer',
      sortable: true,
      filter: 'agSetColumnFilter',
      floatingFilter: true,
      headerfilter: true,
      headerComponent: HeaderWithFilter,
      headerComponentParams: {
        displayName: 'Developer',
        field: 'developer',
        onFilterClick: handleFilterIconClick,
      },
      suppressHeaderFilterButton: true,
      minWidth: 140,
      allowToggle: true,
      optional: true,
      colId: 'static_developer',
    },
    {
      headerName: 'EPIC',
      field: 'epic',
      sortable: true,
      headerfilter: true,
      filter: 'agSetColumnFilter',
      floatingFilter: true,
      headerComponent: HeaderWithFilter,
      headerComponentParams: {
        displayName: 'Epic',
        field: 'epic',
        onFilterClick: handleFilterIconClick,
      },
      suppressHeaderFilterButton: true,
      minWidth: 120,
      allowToggle: true, // <- this column can be toggled
      optional: true, // Hidden by default, user can toggle to show
      colId: 'static_epic',
      tooltipValueGetter: (params) => {
        const epicValue = params.value;
        return epicValue ? epicValue : 'No Epic assigned';
      },
      tooltipComponentParams: {
        color: '#fff',
        backgroundColor: '#333',
      },
    },
    {
      headerName: 'STORY POINTS',
      field: 'storyPoints',
      sortable: true,
      filter: 'agSetColumnFilter',
      floatingFilter: true,
      headerfilter: true,
      headerComponent: HeaderWithFilter,
      headerComponentParams: {
        displayName: APP_STRINGS.STORY_POINTS,
        field: 'storyPoints',
        onFilterClick: handleFilterIconClick,
      },
      suppressHeaderFilterButton: true,
      minWidth: 160,
      allowToggle: true, // <- this column can be toggled
      optional: true, // Hidden by default, user can toggle to show
      colId: 'static_story_points',
    },
    {
      headerName: 'ORIGINAL ESTIMATE',
      field: 'originalEstimate',
      sortable: true,
      filter: 'agSetColumnFilter',
      floatingFilter: true,
      headerfilter: true,
      headerComponent: HeaderWithFilter,
      headerComponentParams: {
        displayName: 'Original Estimate',
        field: 'originalEstimate',
        onFilterClick: handleFilterIconClick,
      },
      suppressHeaderFilterButton: true,
      minWidth: 200,
      allowToggle: true, // <- this column can be toggled
      optional: true, // Hidden by default, user can toggle to show
      colId: 'static_original_estimate',
    },
    {
      headerName: 'LABELS',
      field: 'labels',
      sortable: true,
      filter: 'agSetColumnFilter',
      floatingFilter: true,
      headerfilter: true,
      headerComponent: HeaderWithFilter,
      headerComponentParams: {
        displayName: 'Labels',
        field: 'labels',
        onFilterClick: handleFilterIconClick,
      },
      suppressHeaderFilterButton: true,
      minWidth: 120,
      allowToggle: true, // <- this column can be toggled
      optional: true, // Hidden by default, user can toggle to show
      colId: 'static_labels',
    },
    {
      headerName: 'TIME SPENT',
      field: 'timeSpent',
      sortable: true,
      filter: 'agSetColumnFilter',
      floatingFilter: true,
      headerfilter: true,
      headerComponent: HeaderWithFilter,
      headerComponentParams: {
        displayName: 'Time Spent',
        field: 'timeSpent',
        onFilterClick: handleFilterIconClick,
      },
      suppressHeaderFilterButton: true,
      minWidth: 140,
      allowToggle: true,
      optional: true,
      colId: 'static_time_spent',
      valueFormatter: (params) => {
        return params.value ? `${params.value} h` : '0 h';
      },
    },
    {
      headerName: 'CYCLE TIME',
      field: 'cycleTime',
      sortable: true,
      filter: 'agSetColumnFilter',
      floatingFilter: true,
      headerfilter: true,
      headerComponent: HeaderWithFilter,
      headerComponentParams: {
        displayName: 'Cycle Time',
        field: 'cycleTime',
        onFilterClick: handleFilterIconClick,
      },
      suppressHeaderFilterButton: true,
      minWidth: 140,
      allowToggle: true,
      optional: true,
      colId: 'static_cycle_time',
    },
    {
      headerName: 'BACKFLOW RATE',
      field: 'backflowRate',
      sortable: true,
      filter: 'agSetColumnFilter',
      floatingFilter: true,
      headerfilter: true,
      headerComponent: HeaderWithFilter,
      headerComponentParams: {
        displayName: 'Backflow Rate',
        field: 'backflowRate',
        onFilterClick: handleFilterIconClick,
      },
      suppressHeaderFilterButton: true,
      minWidth: 160,
      allowToggle: true,
      optional: true,
      colId: 'static_backflow_rate',
      valueFormatter: (params) => {
        const v = params.value;
        if (v === null || v === undefined || v === '') return '0%';
        const s = String(v).trim();
        if (s.endsWith('%')) return s;
        const n = Number(s);
        return isNaN(n) ? `${s}%` : `${n}%`;
      },
    },
  ];

  const staticColumnNames = new Set(staticColumns.map((col) => col.headerName));

  const dynamicColumns = generateDynamicJiraColumns(customFieldsByName, staticColumnNames);

  const orderedColumns = [];

  staticColumns.forEach((col, index) => {
    orderedColumns.push({
      ...col,
      columnGroup: 'static',
      columnIndex: index,
      suppressColumnsToolPanel: false,
      suppressMenu: false,
      columnOrder: `static_${index.toString().padStart(3, '0')}`,
    });
  });

  dynamicColumns.forEach((col, index) => {
    orderedColumns.push({
      ...col,
      columnGroup: 'dynamic',
      columnIndex: index,
      suppressColumnsToolPanel: false,
      suppressMenu: false,
      columnOrder: `dynamic_${index.toString().padStart(3, '0')}`,
    });
  });

  const allColumns = orderedColumns;
  return allColumns;
};
