import SearchFloatingFilter from '../Common/searchFloatingFilter';
import '../../assets/css/global.scss';
import CustomEditableCellRenderer from './CustomEditableCellRenderer';
import { getBoardLabels } from '../../utils/boardUtils';
import { APP_STRINGS } from '../../constants';

/** Dark-mode cell background #1F2C3D (see global.scss .capacity-planning-readonly-cell) */
const RO = { cellClass: 'capacity-planning-readonly-cell' };

export const capacityPlanningColumns = (
  useStoryPoints,
  theme = 'light',
  selectedValue = APP_STRINGS.VALUE_SPRINT,
) => {
  const { sprintLabel, releaseLabel } = getBoardLabels();
  const lengthLabel =
    selectedValue === APP_STRINGS.VALUE_RELEASE ? releaseLabel : sprintLabel;
  const baseColumns = [
    {
      headerName: 'TEAM MEMBER',
      field: 'name',
      minWidth: 170,
      filter: false,
      sortable: true,
      floatingFilter: true,
      floatingFilterComponent: SearchFloatingFilter,
      floatingFilterComponentParams: { suppressFilterButton: true },
      filterParams: { caseSensitive: false, trimInput: true },
      cellRenderer: CustomEditableCellRenderer,
      ...RO,
    },
    {
      headerName: 'ROLE',
      field: 'role',
      minWidth: 120,
      filter: false,
      sortable: true,
      floatingFilter: false,
      editable: false,
      cellRenderer: CustomEditableCellRenderer,
    },
    {
      headerName: 'ALLOCATION TYPE',
      field: 'allocationType',
      minWidth: 160,
      filter: false,
      sortable: true,
      floatingFilter: false,
      editable: false,
      valueGetter: (params) => params.data.allocationType || 'Select Option',
      cellRenderer: CustomEditableCellRenderer,
    },
    {
      headerName: 'AVAILABLE CAPACITY',
      field: 'availableHours',
      minWidth: 180,
      filter: false,
      sortable: true,
      floatingFilter: false,
      cellRenderer: CustomEditableCellRenderer,
    },
    {
      headerName: 'NET AVAILABLE CAPACITY',
      field: 'netAvailableCapacity',
      minWidth: 180,
      filter: false,
      sortable: true,
      floatingFilter: false,
      cellRenderer: CustomEditableCellRenderer,
      ...RO,
    },
    {
      headerName: 'ALLOCATED CAPACITY',
      field: 'allocatedStoryPoints',
      minWidth: 120,
      filter: false,
      sortable: true,
      floatingFilter: false,
      editable: false,
      hide: !useStoryPoints,
      ...RO,
    },
    {
      headerName: 'ALLOCATED CAPACITY',
      field: 'allocatedHours',
      minWidth: 120,
      filter: false,
      sortable: true,
      floatingFilter: false,
      editable: false,
      hide: useStoryPoints,
      ...RO,
    },
    {
      headerName: 'REMAINING CAPACITY',
      field: 'remainingCapacity',
      minWidth: 120,
      filter: false,
      sortable: true,
      floatingFilter: false,
      editable: false,
      ...RO,
    },
    {
      headerName: 'BILLING RATE ($)',
      field: 'billingRate',
      minWidth: 120,
      filter: false,
      sortable: true,
      floatingFilter: false,
      editable: false,
      cellDataType: 'number',
      cellRenderer: CustomEditableCellRenderer,
      ...RO,
    },
    {
      headerName: 'TOTAL BILLING RATE ($)',
      field: 'totalBilling',
      minWidth: 140,
      filter: false,
      sortable: true,
      floatingFilter: false,
      editable: false,
      ...RO,
      valueFormatter: params => {
        const value = Number(params.value);
        return isNaN(value) ? '$0' : `$${value.toFixed(2)}`;
      },
    },
    {
      headerName: 'OVERAGE / UNDERAGE',
      field: 'overage',
      minWidth: 120,
      filter: false,
      sortable: true,
      floatingFilter: false,
      editable: false,
      ...RO,
    },
    {
      headerName: `${lengthLabel} Length`,
      field: 'sprintLength',
      minWidth: 120,
      filter: false,
      sortable: true,
      floatingFilter: false,
      editable: false,
      ...RO,
    },
    {
      headerName: 'HOLIDAY',
      field: 'holiday',
      minWidth: 120,
      filter: false,
      sortable: true,
      floatingFilter: false,
      cellDataType: 'number',
      ...RO,
    },
    {
      headerName: 'LEAVES',
      field: 'leaves',
      minWidth: 120,
      filter: false,
      sortable: true,
      floatingFilter: false,
      cellDataType: 'number',
      cellRenderer: CustomEditableCellRenderer,
    },
    {
      headerName: 'AVAILABLE DAYS',
      field: 'availableDays',
      minWidth: 120,
      filter: false,
      sortable: true,
      floatingFilter: false,
      editable: false,
      ...RO,
    },
    {
      headerName: 'WORKLOAD %',
      field: 'workload',
      minWidth: 160,
      filter: false,
      sortable: true,
      ...RO,
      cellRenderer: params => {
        const value = params.value || 0;
        let barColor = 'bg-orange-500';
        if (value > 100) barColor = 'bg-red-500';
        else if (value > 75) barColor = 'bg-green-500';
        const backgroundBarColor = theme === 'light' ? 'bg-[#A6C3DC]' : 'bg-[#25384F]';
        return (
          <div className="w-full">
            <div className="text-xs font-medium mb-[2px]">{value}%</div>
            <div className={`w-full ${backgroundBarColor} rounded-full h-1.5`}>
              <div
                className={`h-1.5 rounded-full ${barColor}`}
                style={{ width: `${Math.min(value, 100)}%` }}
              ></div>
            </div>
          </div>
        );
      },
    },
  ];

  return baseColumns;
};
