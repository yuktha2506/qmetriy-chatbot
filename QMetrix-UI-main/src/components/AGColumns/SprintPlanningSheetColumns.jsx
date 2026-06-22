
const SprintPlanningSheetColumns = (editMode = true) => [
    {
      headerName: 'TEAM MEMBER',
      field: 'teamMember',
      minWidth: 150,
      editable: false,
    },
    {
      headerName: 'AVAILABLE DAYS',
      field: 'availableDays',
      minWidth: 120,
      editable: false,
    },
    {
      headerName: 'SPRINT LENGTH',
      field: 'sprint length',
      minWidth: 130,
      editable: false,
    },
    {
      headerName: 'STORY POINTS ALLOCATED',
      field: 'story points',
      minWidth: 130,
      editable: editMode,
      cellEditor: 'agTextCellEditor',
      valueParser: (params) => Number(params.newValue) || 0,
    },
    {
      headerName: 'LEAVES',
      field: 'leaves',
      minWidth: 100,
      editable: editMode,
      cellEditor: 'agTextCellEditor',
      valueParser: (params) => Number(params.newValue) || 0,
    },
    {
      headerName: 'HOLIDAYS',
      field: 'holidays',
      minWidth: 100,
      editable: editMode,
      cellEditor: 'agTextCellEditor',
      valueParser: (params) => Number(params.newValue) || 0,
    },
    {
      headerName: 'BUFFER',
      field: 'buffer',
      minWidth: 100,
      editable: editMode,
      cellEditor: 'agTextCellEditor',
      valueParser: (params) => Number(params.newValue) || 0,
    },
  ];
  
  export default SprintPlanningSheetColumns;
