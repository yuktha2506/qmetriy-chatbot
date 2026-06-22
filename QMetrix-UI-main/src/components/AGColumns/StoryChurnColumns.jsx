export const StoryChurnColumns = [
  {
    headerName: 'Sprint',
    field: 'sprint',
    sortable: true,
    filter: false,
    floatingFilter: false, 
  },
  {
    headerName: 'STORIES PLANNED',
    field: 'storiesPlanned',
    sortable: true,
    filter: false,
    floatingFilter: false, 
  },
  {
    headerName: 'ADDED',
    field: 'added',
    sortable: true,
    filter: false,
    floatingFilter: false, 
  },
  {
    headerName: 'REMOVED',
    field: 'removed',
    sortable: true,
    filter: false,
    floatingFilter: false, 
  },
  {
    headerName: 'STORY CHURN (%)',
    field: 'storyChurn',
    valueFormatter: (params) => (params.value != null ? `${params.value} %` : '0%'),
    cellStyle: { textAlign: 'right' },
    sortable: true,
    filter: false,
    floatingFilter: false, 
  },
];
