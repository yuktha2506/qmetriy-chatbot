import axiosInstance from './axiosInstance';
import store from './store/store';

// Platform name constants
export const PLATFORM_NAMES = {
  GITLAB: 'GitLab',
  AZURE: 'Azure',
  JIRA: 'Jira',
};

// Helper function to get platform display name
export const getPlatformName = (isGitLab, isAzure) => {
  if (isGitLab) return PLATFORM_NAMES.GITLAB;
  if (isAzure) return PLATFORM_NAMES.AZURE;
  return PLATFORM_NAMES.JIRA;
};

// Shared UI / workspace strings (import across pages, utils, components)
export const APP_STRINGS = {
  SELECT_AN_OPTION: 'Select an option',
  STORY_POINTS: 'Story Points',
  HOURS: 'Hours',
  TICKETS: 'Tickets',
  VALUE_SPRINT: 'Sprint',
  VALUE_RELEASE: 'Release',
  API_SPRINT: 'sprint',
  API_RELEASE: 'release',
  API_HOURS: 'hours',
  API_STORY_POINTS: 'storyPoints',
  VIEW_GRID: 'grid',
  VIEW_LIST: 'list',
  VALUE_DATE_RANGE: 'Date Range',
  THEME_LIGHT: 'light',
  SUBSTRING_STORY_POINT: 'story point',
  SESSION_TYPE_VALUE: 'typeValue',
  SESSION_TYPE_VALUE_LABEL: 'typeValueLabel',
  SESSION_BOARD_TYPE: 'boardType',
  SESSION_BOARD_ID: 'boardId',
  SESSION_BOARD_NAME: 'boardName',
  SESSION_SELECTED_BOARD: 'selectedBoard',
  LABEL_ITERATION: 'Iteration',
  LABEL_MILESTONE: 'Milestone',
  LABEL_EPIC: 'Epic',
  LABEL_SELECT_PREFIX: 'Select ',
  LABEL_SELECT: 'Select',
  LABEL_SELECT_PROJECT: 'Select Project',
  AZURE_BOARD: 'azure board',
  AZURE_BOARD_KEBAB: 'azure-board',
  AZURE: 'azure',
  DEV_AZURE_COM: 'dev.azure.com',
  GITLAB_BOARD_KEBAB: 'gitlab-board',
  GITLAB_BOARD: 'gitlab board',
  GITLAB: 'gitlab',
  ATTR_DATA_PROJECT_ID: 'data-project-id',
  QUERY_DATA_PROJECT_ID: '[data-project-id]',
  CLASS_BOARD_SUBMENU: '.board-submenu',
  LABEL_SELECT_REPOSITORY: 'Select repository',
  LABEL_SELECT_REPOSITORIES: 'Select repositories',
  LABEL_SELECT_RELEASE: 'Select Release',
  LABEL_RAG_STATUS: 'RAG Status',
  DROPDOWN_TYPE_REPO: 'Repo',
  DROPDOWN_TYPE_ORGANIZATION: 'organization',
  DROPDOWN_TYPE_PROJECT: 'project',
  LABEL_GRID_VIEW: 'Grid View',
  LABEL_LIST_VIEW: 'List View',
};

// Jira dashboard page + re-exports all shared strings
export const JIRA_DASHBOARD = {
  ...APP_STRINGS,
  SECTION_VELOCITY: 'velocity',
  LOCALE_EN_IN: 'en-IN',
  SESSION_VELOCITY_TOGGLE_TYPE: 'velocityToggleType',
  SESSION_SPRINT_ID: 'sprintId',
  SESSION_SPRINT_END_DATE: 'sprintEndDate',
  SESSION_RELEASE_NAME: 'releaseName',
  SESSION_RELEASE_DATE: 'releaseDate',
  TOOLTIP_POSITION_TOP: 'top',
  TEXT_VS: 'vs',
  METRIC_COMMITTED: 'committed',
  METRIC_COMPLETED: 'completed',
  TYPE_OBJECT: 'object',
  PLACEHOLDER_DETAILED_SOON: 'Detailed view coming soon...',
  PLACEHOLDER_CHARTS_HERE: 'Detailed charts and analysis will be implemented here',
  PLACEHOLDER_TREND_CHARTS:
    'This will include trend charts, detailed metrics, and interactive components',
  SUFFIX_ANALYSIS: ' Analysis',
  STORY_POINT_METRIC_FIELDS: [
    'initialStoryPoints',
    'spilloverStoryPoints',
    'committedStoryPoints',
    'storyPointsAddedInBeginning',
    'storyPointsAddedAfterStart',
    'removedStoryPoints',
    'completedStoryPoints',
    'remainingStoryPoints',
  ],
  HOUR_METRIC_FIELDS: [
    'initialHours',
    'spilloverHours',
    'committedHours',
    'hoursAddedInBeginning',
    'hoursAddedAfterStart',
    'removedHours',
    'completedHours',
    'remainingHours',
  ],
  SP_VELOCITY_FIELDS: ['planned', 'completed', 'completedLate', 'incomplete'],
  HR_VELOCITY_FIELDS: [
    'hoursPlanned',
    'hoursCompleted',
    'hoursCompletedLate',
    'hoursIncomplete',
  ],
  WIDGET_COMMITTED_VS_COMPLETED: 'Committed vs Completed',
  WIDGET_CYCLE_TIME: 'Cycle Time',
  WIDGET_ISSUE_TYPE: 'Issue Type',
  WIDGET_DEFECT_DENSITY: 'Defect Density',
  WIDGET_DEFECT_REMOVAL_EFFICIENCY: 'Defect Removal Efficiency',
  WIDGET_DEFECT_LEAKAGE_ANALYSIS: 'Defect Leakage Analysis',
  WIDGET_DEFECT_REJECTION_RATIO: 'Defect Rejection Ratio',
  WIDGET_BUG_CLASSIFICATION: 'Bug Classification',
  WIDGET_COST_OF_FIXING_DEFECTS: 'Cost Of Fixing Defects',
  WIDGET_TIME_TO_FIX_BUG: 'Time To Fix Bug',
  WIDGET_VELOCITY: 'Velocity',
  WIDGET_BURNDOWN: 'Burndown',
};

// PR Table Column Field Names Constants
export const PR_COLUMN_FIELDS = {
  BLOCKER: 'blocker',
  DAYS_OPEN: 'daysOpen',
  REVIEWER: 'reviewer',
  CODE_CHANGES: 'codeChanges',
};

// PR Table Filter Options Constants
export const PR_FILTER_OPTIONS = {
  DAYS_OPEN: ['Today', 'Last 3 days', 'Last 7 days', 'Last 14 days', 'Last 30 days', 'More than 30 days'],
  REVIEWER: ['No reviewers', '1 reviewer', '2-3 reviewers', '4+ reviewers'],
  FILES_CHANGED: ['1-5 files', '6-10 files', '11-20 files', '21-50 files', '50+ files'],
};

// PR Table Filter Range Values
export const PR_FILTER_RANGES = {
  DAYS_OPEN: {
    TODAY: 'Today',
    LAST_3_DAYS: 'Last 3 days',
    LAST_7_DAYS: 'Last 7 days',
    LAST_14_DAYS: 'Last 14 days',
    LAST_30_DAYS: 'Last 30 days',
    MORE_THAN_30_DAYS: 'More than 30 days',
  },
  REVIEWER: {
    NO_REVIEWERS: 'No reviewers',
    ONE_REVIEWER: '1 reviewer',
    TWO_TO_THREE_REVIEWERS: '2-3 reviewers',
    FOUR_PLUS_REVIEWERS: '4+ reviewers',
  },
  FILES_CHANGED: {
    ONE_TO_FIVE: '1-5 files',
    SIX_TO_TEN: '6-10 files',
    ELEVEN_TO_TWENTY: '11-20 files',
    TWENTY_ONE_TO_FIFTY: '21-50 files',
    FIFTY_PLUS: '50+ files',
  },
};

export const getId = () => ({
  companyId: sessionStorage.getItem('companyId'),
  projectId: sessionStorage.getItem('projectId'),
  developerName: sessionStorage.getItem('developer'),
  sprintId: sessionStorage.getItem('sprintId'),
  releaseId: sessionStorage.getItem('releaseId'),
  boardId: sessionStorage.getItem('boardId'),
  qmetrixToken: sessionStorage.getItem('qmetrix-token'),
  projectKeyId: sessionStorage.getItem('projectKeyId'),
  companyName: sessionStorage.getItem('companyName'),
  repo: sessionStorage.getItem('repo'),
  cardsData: sessionStorage.getItem('cardsData'),
  titlesToDisplay: sessionStorage.getItem('titlesToDisplay'),
  cardsDataEng: sessionStorage.getItem('cardsDataEng'),
  titlesToDisplayEng: sessionStorage.getItem('titlesToDisplayEng'),
  cardsDataDev: sessionStorage.getItem('cardsDataDev'),
  titlesToDisplayDev: sessionStorage.getItem('titlesToDisplayDev'),
  cardsDataTest: sessionStorage.getItem('cardsDataTest'),
  titlesToDisplayTest: sessionStorage.getItem('titlesToDisplayTest'),
  syncStatus: sessionStorage.getItem('syncStatus'),
  emptyString: sessionStorage.getItem(''),
  titlesToDisplayOperation: sessionStorage.getItem('titlesToDisplayOperation'),
  velocityToggleType: sessionStorage.getItem('velocityToggleType'),
});
const validateParams = ({ companyId, projectId, repo, value }) => {
  if (!companyId || !projectId || !repo) {
    throw new Error('Missing required parameters: companyId, projectId, or repo.');
  }

  if (!value || (value !== 'sprint' && value !== 'release')) {
    throw new Error('Invalid value parameter. Expected "sprint" or "release".');
  }
};
const buildApiEndpoint = ({ scmProvider, companyId, projectId, queryParam, type, boardId }) => {
  const basePath = scmProvider === 'GitLab' ? '/api/gitlab' : '/api/github';

  const endpoints = {
    closedPRs: `${basePath}/getClosed${scmProvider === 'GitLab' ? 'MergeRequest' : 'PRs'
      }/${companyId}/${projectId}/${boardId}?${queryParam}`,
    openPRs: `${basePath}/getOpen${scmProvider === 'GitLab' ? 'MergeRequest' : 'PRs'
      }/${companyId}/${projectId}/${boardId}?${queryParam}`,
    totalPRs: `${basePath}/getTotal${scmProvider === 'GitLab' ? 'MRs' : 'PRs'
      }/${companyId}/${projectId}/${boardId}?${queryParam}`,
    mergedPRsWithoutReview: `${basePath}/getMerged${scmProvider === 'GitLab' ? 'MRs' : 'PRs'
      }WithoutReview/${companyId}/${projectId}/${boardId}?${queryParam}`,
    prSize: `${basePath}/get${scmProvider === 'GitLab' ? 'MRs' : 'PRs'
      }Size/${companyId}/${projectId}/${boardId}?${queryParam}`,
    gitCycleTime: `${basePath}/getGit${scmProvider === 'GitLab' ? 'Lab' : ''
      }CycleTime/${companyId}/${projectId}/${boardId}?${queryParam}`,
    approvalRate: `${basePath}/get${scmProvider === 'GitLab' ? 'MRsApprovalRate' : 'ApprovalRate'
      }/${companyId}/${projectId}/${boardId}?${queryParam}`,
    iterationTime: `${basePath}/get${scmProvider === 'GitLab' ? 'MRsIterationTime' : 'PRsIterationTime'
      }/${companyId}/${projectId}/${boardId}?${queryParam}`,
  };

  return endpoints[type];
};
const fetchPRData = async ({ projectId, value, type }) => {
  const state = store.getState();
  const scmProvider = state?.jira?.repositoryProvider?.repositoryProvider;

  if (!scmProvider) {
    throw new Error('SCM provider is missing.');
  }

  const { companyId, sprintId, releaseId, repo, boardId } = getId();
  validateParams({ companyId, projectId, repo, value });

  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const apiEndpoint = buildApiEndpoint({
    scmProvider,
    companyId,
    projectId,
    queryParam,
    type,
    boardId,
  });

  return axiosInstance.post(apiEndpoint, { repo });
};

export const fetchGetClosedPRs = (params) => fetchPRData({ ...params, type: 'closedPRs' });
export const getFetchOpenPullRequests = (params) => fetchPRData({ ...params, type: 'openPRs' });
export const fetchGetTotalPRs = (params) => fetchPRData({ ...params, type: 'totalPRs' });
export const getMergedPRsWithoutReview = (params) =>
  fetchPRData({ ...params, type: 'mergedPRsWithoutReview' });
export const getPRsSize = (params) => fetchPRData({ ...params, type: 'prSize' });
export const getGitCycleTime = (params) => fetchPRData({ ...params, type: 'gitCycleTime' });
export const getApprovalRate = (params) => fetchPRData({ ...params, type: 'approvalRate' });
export const getIterationTime = (params) => fetchPRData({ ...params, type: 'iterationTime' });

export const login = async (values) => {
  const response = await axiosInstance.post('/api/user/login', values);
  return response.data;
};

export const addCompanyOrg = async (values) => {
  const response = await axiosInstance.post('/api/company/add', values);
  return response.data;
};
export const updateWeightage = async (values, title) => {
  try {
    const { companyId, projectId, boardId, repo, sprintId, releaseId } = getId();

    // Validate required parameters
    if (!companyId || !projectId || !boardId || !title) {
      throw new Error(
        `Missing required parameters: companyId=${companyId}, projectId=${projectId}, boardId=${boardId}, title=${title}`,
      );
    }

    const updatedValues = { values, repo, sprintId, releaseId };

    const response = await axiosInstance.post(
      `/api/cxo/editWeightage/${companyId}/${projectId}/${boardId}/${title}`,
      updatedValues,
    );
    return response.data;
  } catch (error) {
    console.error('Error in updateWeightage:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
    });
    throw error;
  }
};

export const userRegister = async (values) => {
  const response = await axiosInstance.post('/api/user/register', values);
  return response;
};

export const userForgotPassword = async (values) => {
  const response = await axiosInstance.post('/api/user/forgotpassword', values);
  return response;
};

export const userResetPassword = async (token, password) => {
  const response = await axiosInstance.post(`/api/user/resetpassword/${token}`, {
    password: password,
  });
  return response;
};

export const integration = async (values) => {
  const companyId = getId().companyId;
  const response = await axiosInstance.post(`/api/connection/add/${companyId}`, values);
  return response.data;
};

export const getProjectList = async () => {
  const companyId = getId().companyId;
  if (companyId === null) {
    return [];
  }
  const response = await axiosInstance.get(`/api/jira/getProjectList/${companyId}`);
  return response;
};

export const updateSelectedProject = async (selectedProjectIds) => {
  const { companyId } = getId();
  const response = await axiosInstance.post(`/api/jira/updateSelectedProject/${companyId}`, {
    selectedProjectIds,
  });
  return response.data;
};

export const updateHideProject = async (hideProjectIds) => {
  const { companyId } = getId();
  const response = await axiosInstance.post(`/api/jira/updateHideProject/${companyId}`, {
    hideProjectIds,
  });
  return response.data;
};

export const getAllOrgsListAPI = async () => {
  const { companyId } = getId();
  const response = await axiosInstance.get(`/api/company/getAllOrgs/${companyId}`);
  return response.data;
};

export const getSprintList = async () => {
  const { companyId, projectId } = getId();
  const boardId = sessionStorage.getItem('boardId');
  const sprintListData = await axiosInstance.get(
    `/api/jira/getSprintList/${companyId}/${projectId}/${boardId}`,
  );
  const response = sprintListData.data.sort(
    (a, b) => new Date(a.startDate) - new Date(b.startDate),
  );
  return { data: response };
};
export const getRepoList = async () => {
  const { companyId, projectId, boardId } = getId();
  const response = await axiosInstance.get(
    `/api/github/getAllRepo/${companyId}/${projectId}/${boardId}`,
  );
  return response;
};

export const getReleaseDetails = async () => {
  const { companyId, projectId } = getId();
  const boardId = sessionStorage.getItem('boardId');
  const releaseListData = await axiosInstance.get(
    `/api/jira/getReleases/${companyId}/${projectId}/${boardId}`,
  );
  const response = releaseListData.data.sort(
    (a, b) => new Date(a.startDate) - new Date(b.startDate),
  );
  return { data: response };
};

export const getReleaseReadinessDetails = async ({ value }) => {
  const { sprintId, releaseId, companyId, projectId, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/cxo/getCXO/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const fetchStatusCount = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/jira/getStatusCount/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const fetchIssueCount = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/jira/getIssueCount/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const fetchGetReleaseReadinessTrends = async ({ projectId, value, pageValue }) => {
  const { sprintId, releaseId, companyId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/cxo/getCXOtrends/${companyId}/${projectId}/${pageValue}?${queryParam}`,
  );
  return response;
};

export const getAllStoryPointsCommittedAndCompleted = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/jira/getSPCommittedVsCompleted/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getTaskCount = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/jira/getIssueType/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getVelocity = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, velocityToggleType, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/jira/getVelocity/${companyId}/${projectId}/${boardId}?${queryParam}&estimationType=${encodeURIComponent(
      velocityToggleType,
    )}`,
  );
  return response;
};

export const getBugClassification = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/jira/getBugClassification/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return { data: response.data, value };
};

export const getTimeToFix = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/jira/getTimeToFix/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return { data: response.data, value };
};

export const getDefectDensity = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/jira/getDefectDensity/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return { data: response.data, value };
};

export const getCostOfFixingDefects = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/jira/costOfFixingDefects/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getDefectLekageAnalysis = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/jira/getDefectLeakageAnalysis/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return { data: response.data, value };
};

export const fetchLeadTimeForChanges = async ({ projectId, value }) => {
  const { companyId, sprintId, releaseId, repo, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const state = store.getState();
  const scmProvider = state?.jira?.repositoryProvider?.repositoryProvider;
  const basePath = scmProvider === 'GitLab' ? '/api/gitlab' : '/api/github';
  const response = await axiosInstance.post(
    `${basePath}/getLeadTime/${companyId}/${projectId}/${boardId}?${queryParam}`,
    { repo },
  );
  return response;
};

export const getDefectRejection = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/jira/getDefectRejection/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return { data: response.data, value };
};

export const getStoryPoints = async () => {
  const { companyId } = getId();
  const response = await axiosInstance.get(`/api/jira/getStoryPoints/${companyId}`);
  return response.data?.storyPoint || 6;
};

export const getJiraUsers = async () => {
  const { companyId } = getId();
  const response = await axiosInstance.get(`/api/jira/getJiraUsers/${companyId}`);
  return response.data;
};

export const getUserData = async (projectId) => {
  const { companyId } = getId();
  const response = await axiosInstance.get(`/api/jira/getUserData/${companyId}/${projectId}`);
  return response.data;
};

export const getRoleRatesAndStoryPoints = async () => {
  const { companyId } = getId();
  const response = await axiosInstance.get(`/api/jira/getRoleRatesAndStoryPoints/${companyId}`);
  return response.data;
};

export const addStoryPoints = async (data) => {
  const { companyId } = getId();
  const response = await axiosInstance.post(`/api/jira/addStoryPoints/${companyId}`, { data });
  return response.data;
};

export const addCapacity = async (data) => {
  const { companyId } = getId();
  const response = await axiosInstance.post(`/api/jira/addCapacity/${companyId}`, data);
  return response.data;
};

export const addRoleRates = async (formattedData) => {
  const { companyId } = getId();
  const response = await axiosInstance.post(`/api/jira/addRoleRates/${companyId}`, formattedData);
  return response.data;
};

export const getActualStoryPoints = async ({ value }) => {
  const { sprintId, releaseId, companyId, projectId, developerName, boardId } = getId();
  let queryParam = '';
  if (value === 'sprint') {
    queryParam = `sprintId=${sprintId}`;
    if (developerName) {
      queryParam += `&developer=${developerName}`;
    }
  } else if (value === 'release') {
    queryParam = `releaseId=${releaseId}`;
    if (developerName) {
      queryParam += `&developer=${developerName}`;
    }
  }
  const response = await axiosInstance.get(
    `/api/jira/getSprintStoryPoints/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getBurndownData = async ({ value }) => {
  const { sprintId, releaseId, companyId, projectId, developerName, boardId } = getId();
  let queryParam = '';
  if (value === 'sprint') {
    queryParam = `sprintId=${sprintId}`;
    if (developerName) {
      queryParam += `&developer=${developerName}`;
    }
  } else if (value === 'release') {
    queryParam = `releaseId=${releaseId}`;
    if (developerName) {
      queryParam += `&developer=${developerName}`;
    }
  }
  const response = await axiosInstance.get(
    `/api/jira/getBurndownData/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getReleaseBurndownData = async () => {
  const { releaseId, companyId, projectId, developerName, boardId } = getId();
  let queryParam = `releaseId=${releaseId}`;
  if (developerName) {
    queryParam += `&developer=${developerName}`;
  }
  const response = await axiosInstance.get(
    `/api/jira/getReleaseBurndownData/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getSyncStatus = async () => {
  const { companyId } = getId();
  const response = await axiosInstance.get(`/api/jira/getSyncStatus/${companyId}`);
  return response.data;
};

export const getDefectRemovalEfficiency = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/jira/getDefectRemovalEfficiency/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return { data: response.data, value };
};

export const getDoraMetrics = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, repo, boardId } = getId();

  const queryParam =
    value === 'sprint'
      ? `sprintId=${sprintId}&repoName=${repo}`
      : `releaseId=${releaseId}&repoName=${repo}`;

  const state = store.getState();
  const scmProvider = state?.jira?.repositoryProvider?.repositoryProvider;
  const basePath = scmProvider === 'GitLab' ? '/api/gitlab' : '/api/github';
  const response = await axiosInstance.get(
    `${basePath}/getDoraMetrics/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return { data: response.data, value };
};

export const getStoryPointData = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/jira/getStoryPointData/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getSprintLength = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/jira/getSprintLength/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getStoryChurnData = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, developerName, boardId } = getId();
  let queryParam = '';

  if (value === 'sprint') {
    queryParam = `sprintId=${sprintId}`;
    if (developerName) {
      queryParam += `&developer=${developerName || ''}`;
    }
  } else if (value === 'release') {
    queryParam = `releaseId=${releaseId}`;
    if (developerName) {
      queryParam += `&developer=${developerName || ''}`;
    }
  }
  const response = await axiosInstance.get(
    `/api/standup/getStoryChurn/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getStoryChurnExcludingBugs = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, developerName, boardId } = getId();
  let queryParam = '';

  if (value === 'sprint') {
    queryParam = `sprintId=${sprintId}`;
    if (developerName) {
      queryParam += `&developer=${developerName || ''}`;
    }
  } else if (value === 'release') {
    queryParam = `releaseId=${releaseId}`;
    if (developerName) {
      queryParam += `&developer=${developerName || ''}`;
    }
  }
  const response = await axiosInstance.get(
    `/api/standup/getStoryChurnExcludingBugs/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};
export const fetchJiraStatusByDeveloper = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, developerName, boardId } = getId();
  const queryParam =
    value === 'sprint'
      ? `sprintId=${sprintId}&developer=${developerName}`
      : `releaseId=${releaseId}&developer=${developerName}`;
  const response = await axiosInstance.get(
    `/api/standup/jira-status-by-dev/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getjiraTableData = async ({ projectId, boardId, value }) => {
  const { sprintId, releaseId, companyId, developerName } = getId();

  let queryParam = '';

  if (value === 'sprint') {
    queryParam = `sprintId=${sprintId}`;
    if (developerName) {
      queryParam += `&developer=${developerName}`;
    }
  } else if (value === 'release') {
    queryParam = `releaseId=${releaseId}`;
    if (developerName) {
      queryParam += `&developer=${developerName}`;
    }
  }

  const response = await axiosInstance.get(
    `/api/standup/jiraData/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getQAInsightsBugs = async ({ projectId, boardId, value }) => {

  const { sprintId, releaseId, companyId, developerName } = getId();

  let queryParam = '';

  if (value === 'sprint') {
    queryParam = `sprintId=${sprintId}`;
    if (developerName) {
      queryParam += `&developer=${developerName}`;
    }
  } else if (value === 'release') {
    queryParam = `releaseId=${releaseId}`;
    if (developerName) {
      queryParam += `&developer=${developerName}`;
    }
  }

  const response = await axiosInstance.get(
    `/api/standup/qa-insights/bugs/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );

  return response;
};

export const getQAInsightsTests = async ({ projectId, boardId, value }) => {
  const { sprintId, releaseId, companyId, developerName } = getId();

  let queryParam = '';

  if (value === 'sprint') {
    queryParam = `sprintId=${sprintId}`;
    if (developerName) {
      queryParam += `&developer=${developerName}`;
    }
  } else if (value === 'release') {
    queryParam = `releaseId=${releaseId}`;
    if (developerName) {
      queryParam += `&developer=${developerName}`;
    }
  }

  const response = await axiosInstance.get(
    `/api/standup/qa-insights/tests/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getOpenPRsData = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, developerName, repo, boardId } = getId();
  let queryParam = '';
  if (value === 'sprint') {
    queryParam = `sprintId=${sprintId}`;
    if (developerName) {
      queryParam += `&developer=${developerName}`;
    }
  } else if (value === 'release') {
    queryParam = `releaseId=${releaseId}`;
    if (developerName) {
      queryParam += `&developer=${developerName}`;
    }
  }
  const state = store.getState();
  const scmProvider = state?.jira?.repositoryProvider?.repositoryProvider;
  const basePath = scmProvider === 'GitLab' ? '/api/gitlab' : '/api/github';
  const response = await axiosInstance.post(
    `${basePath}/getOpen${scmProvider === 'GitLab' ? 'MergeRequest' : 'PRs'
    }/${companyId}/${projectId}/${boardId}?${queryParam}`,
    { repo },
  );
  return response;
};

export const getMergedPRsWithoutReviewData = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, developerName, repo, boardId } = getId();

  let queryParam = '';

  if (value === 'sprint') {
    queryParam = `sprintId=${sprintId}`;
    if (developerName) {
      queryParam += `&developer=${developerName}`;
    }
  } else if (value === 'release') {
    queryParam = `releaseId=${releaseId}`;
    if (developerName) {
      queryParam += `&developer=${developerName}`;
    }
  }
  const state = store.getState();
  const scmProvider = state?.jira?.repositoryProvider?.repositoryProvider;
  const basePath = scmProvider === 'GitLab' ? '/api/gitlab' : '/api/github';
  const response = await axiosInstance.post(
    `${basePath}/getMerged${scmProvider === 'GitLab' ? 'MRs' : 'PRs'
    }WithoutReview/${companyId}/${projectId}/${boardId}?${queryParam}`,
    { repo },
  );
  return response;
};

export const getStandupBurndown = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, developerName, boardId } = getId();
  const queryParam =
    value === 'sprint'
      ? `sprintId=${sprintId}&developer=${developerName}`
      : `releaseId=${releaseId}&developer=${developerName}`;
  const response = await axiosInstance.get(
    `/api/standup/getStandupBurndown/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

// Burnup is sprint-only; returns both story points and hours per day.
export const getDailyBurnup = async ({ value }) => {
  if (value !== 'sprint') return { data: [] };
  const { sprintId, companyId, projectId, developerName, boardId } = getId();
  if (!sprintId) return { data: [] };
  const queryParam = `sprintId=${sprintId}` + (developerName ? `&developer=${developerName}` : '');
  const response = await axiosInstance.get(
    `/api/jira/getDailyBurnup/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getCycleTime = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, boardId } = getId();
  const queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  const response = await axiosInstance.get(
    `/api/jira/getCycleTime/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};
export const getSprintCompleteDate = async ({ projectId }) => {
  const { sprintId, companyId, boardId } = getId();
  const response = await axiosInstance.get(
    `/api/jira/getSprintCompleteDate/${companyId}/${projectId}/${boardId}/${sprintId}`,
  );

  return response.data;
};
export const targetPoints = 12;
export const workingHours = 8;
export const getAvailableHours = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, developerName } = getId();
  let queryParam = '';
  if (value === 'sprint') {
    queryParam = `sprintId=${sprintId}`;
    if (developerName) {
      queryParam += `&developer=${developerName || ''}`;
    }
  } else if (value === 'release') {
    queryParam = `releaseId=${releaseId}`;
    if (developerName) {
      queryParam += `&developer=${developerName || ''}`;
    }
  }
  const response = await axiosInstance.get(
    `/api/jira/getDevAvailableHours/${companyId}/${projectId}?${queryParam}`,
  );
  return response;
};

export const getBurndownVelocity = async ({ projectId, boardId, value, type = 'hours' }) => {
  const { sprintId, releaseId, companyId } = getId();

  let queryParam = '';

  if (value === 'sprint') {
    queryParam = `sprintId=${sprintId}&type=${type}`;
  } else if (value === 'release') {
    queryParam = `releaseId=${releaseId}&type=${type}`;
  }

  const response = await axiosInstance.get(
    `/api/jira/getBurndownVelocity/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const addHolidayList = async (formattedData) => {
  const { companyId } = getId();
  const response = await axiosInstance.post(`/api/jira/addHolidayList/${companyId}`, formattedData);
  return response.data;
};

export const getHolidayList = async () => {
  const { companyId } = getId();
  const response = await axiosInstance.get(`/api/jira/getHolidayList/${companyId}`);
  return response.data;
};

export const getUserList = async () => {
  const { companyId, projectId } = getId();
  const userListData = await axiosInstance.get(`/api/jira/getUserList/${companyId}/${projectId}`);
  const response = userListData.data;
  return { data: response };
};


const boardListCache = new Map();
const CACHE_EXPIRATION_MS = 30 * 60 * 1000;

export const getBoardList = async (companyId, projectId) => {
  const cacheKey = `${companyId}_${projectId}`;
  const cached = boardListCache.get(cacheKey);
  if (cached) {
    const now = Date.now();
    if (now - cached.timestamp < CACHE_EXPIRATION_MS) {
      return cached.response;
    } else {
      refreshBoardListCache(companyId, projectId, cacheKey);
      return cached.response;
    }
  }

  try {
    const response = await axiosInstance.get(`/api/jira/getBoardList/${companyId}/${projectId}`);
    boardListCache.set(cacheKey, {
      response: response,
      timestamp: Date.now()
    });

    return response;
  } catch (error) {
    console.error(`[getBoardList] Error fetching board list for ${cacheKey}:`, error);
    throw error;
  }
};

const refreshBoardListCache = async (companyId, projectId, cacheKey) => {
  try {
    const response = await axiosInstance.get(`/api/jira/getBoardList/${companyId}/${projectId}`);
    boardListCache.set(cacheKey, {
      response: response,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error(`[getBoardList]  Background refresh failed for ${cacheKey}:`, error);
    boardListCache.delete(cacheKey);
  }
};

export const clearBoardListCache = () => {
  boardListCache.clear();
};
export const getQARefrence = async ({ projectId, value }) => {
  const { sprintId, releaseId, companyId, boardId } = getId();
  let queryParam = '';
  if (value === 'sprint') {
    queryParam = `sprintId=${sprintId}`;
  } else if (value === 'release') {
    queryParam = `releaseId=${releaseId}`;
  }
  const response = await axiosInstance.get(
    `/api/standup/getQARefrence/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getTechQualityMetrics = async (companyId, projectId, boardId) => {
  const response = await axiosInstance.get(
    `/api/techQuality/getTechQualityMetrics/${companyId}/${projectId}/${boardId}`,
  );
  return response.data;
};

export const getProjectManagementData = async ({ sections, value, estimationType }) => {
  const { companyId, projectId, boardId, sprintId, releaseId, developerName } = getId();
  let queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  if (developerName) { queryParam += `&developer=${encodeURIComponent(developerName)}`; }
  if (sections) { queryParam += `&sections=${sections}`; }
  if (estimationType) { queryParam += `&estimationType=${encodeURIComponent(estimationType)}`; }
  const response = await axiosInstance.get(
    `/api/analytics/getProjectManagementData/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getStandupDashboardData = async ({ sections, value }) => {
  const { companyId, projectId, boardId, sprintId, releaseId, developerName } = getId();
  let queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  if (developerName) { queryParam += `&developer=${encodeURIComponent(developerName)}`; }
  if (sections) { queryParam += `&sections=${sections}`; }
  const response = await axiosInstance.get(
    `/api/analytics/getStandupData/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getGitDashboardData = async ({ sections, value }) => {
  const { companyId, projectId, boardId, sprintId, releaseId, developerName, repo } = getId();
  let queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  if (developerName) { queryParam += `&developer=${encodeURIComponent(developerName)}`; }
  if (repo) { queryParam += `&repo=${encodeURIComponent(repo)}`; }
  if (sections) { queryParam += `&sections=${sections}`; }
  const response = await axiosInstance.get(
    `/api/analytics/getGitData/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getCXODashboardData = async ({ sections, value, pageValue }) => {
  const { companyId, projectId, boardId, sprintId, releaseId } = getId();
  let queryParam = value === 'sprint' ? `sprintId=${sprintId}` : `releaseId=${releaseId}`;
  if (pageValue) { queryParam += `&pageValue=${pageValue}`; }
  if (sections) { queryParam += `&sections=${sections}`; }
  const response = await axiosInstance.get(
    `/api/analytics/getCXOData/${companyId}/${projectId}/${boardId}?${queryParam}`,
  );
  return response;
};

export const getReleaseDashboardData = async (companyId, projectId, boardId, releaseId) => {
  const response = await axiosInstance.get(
    `/api/releaseDashboard/releaseData/${companyId}/${projectId}/${boardId}?releaseId=${releaseId}`,
  );
  return response.data;
};

