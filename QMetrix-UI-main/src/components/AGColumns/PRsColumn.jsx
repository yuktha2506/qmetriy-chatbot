import HyperLink from '../Common/hyperLink';

export const PRColumns = (sourceManagement) => [
  {
    headerName:  sourceManagement === 'GitLab' ? 'MR ID' : 'PR ID',
    field: 'prId',
    sortable: true,
    minWidth: 110,
    filter: 'agTextColumnFilter',
    floatingFilter: true,
    cellRenderer: (params) => {
      if (!params.data.prUrl) return params.value;
      return (
        <HyperLink url={params.data.prUrl} style={{ color: '#48A7FF' }}>
          {params.value}
        </HyperLink>
      );
    },
  },
  {
    headerName: 'TITLE',
    field: 'title',
    minWidth: 250,
    sortable: true,
    filter: false,
    floatingFilter: false,
    tooltipField: 'title',
    tooltipValueGetter: (params) => {
      return params.value ? params.value : 'No title available';
    },
    tooltipComponentParams: {
      color: '#fff',
      backgroundColor: '#333',
    },
  },
  {
    headerName: 'AUTHOR',
    field: 'author',
    minWidth: 100,
    sortable: true,
    filter: 'agSetColumnFilter',
    floatingFilter: true,
    headerfilter: true,
    suppressHeaderFilterButton: true,
  },
  {
    headerName: 'STATUS',
    field: 'status',
    minWidth: 100,
    sortable: true,
    filter: 'agSetColumnFilter',
    floatingFilter: true,
    headerfilter: true,
    suppressHeaderFilterButton: true,
  },
  {
    headerName: 'MERGED',
    field: 'merged',
    minWidth: 100,
    sortable: true,
    filter: 'agSetColumnFilter',
    floatingFilter: true,
    headerfilter: true,
    suppressHeaderFilterButton: true,
  },
  {
    headerName: 'DAYS OPEN',
    field: 'daysOpen',
    minWidth: 130,
    sortable: true,
    filter: 'agSetColumnFilter',
    floatingFilter: true,
    headerfilter: true,
    suppressHeaderFilterButton: true,
  },
  {
    headerName: 'REVIEWER',
    field: 'reviewer',
    minWidth: 150,
    sortable: true,
    filter: 'agSetColumnFilter',
    floatingFilter: true,
    headerfilter: true,
    suppressHeaderFilterButton: true,
  },
  {
    headerName: 'FILES CHANGED',
    field: 'codeChanges',
    sortable: true,
    filter: 'agSetColumnFilter',
    floatingFilter: true,
    headerfilter: true,
    suppressHeaderFilterButton: true,
    minWidth: 160,
  },
  {
    headerName: 'BRANCH',
    field: 'branch',
    minWidth: 100,
    sortable: true,
    filter: 'agSetColumnFilter',
    floatingFilter: true,
    headerfilter: true,
    suppressHeaderFilterButton: true,
  },
  {
    headerName: 'REPO',
    field: 'repo',
    minWidth: 100,
    sortable: true,
    filter: 'agSetColumnFilter',
    floatingFilter: true,
    headerfilter: true,
    suppressHeaderFilterButton: true,
  },
].filter((col) => !(sourceManagement === 'GitLab' && col.field === 'merged'));
