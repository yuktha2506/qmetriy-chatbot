import axios from 'axios';

const AI_BASE_URL = process.env.REACT_APP_QMETRIX_AI_URL || 'http://127.0.0.1:8000';
const CHAT_ENDPOINT = `${AI_BASE_URL}/api/v1/ai/chat`;
const CHAT_TIMEOUT_MS = 15000;

const createResponse = (content, extras = {}) => ({
  id: `assistant-${Date.now()}`,
  role: 'assistant',
  content,
  timestamp: new Date().toISOString(),
  ...extras,
});

const getSessionValue = (key) => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.sessionStorage.getItem(key);
};

const buildRequestHeaders = () => {
  const token = getSessionValue('qmetrix-token');
  return token ? { 'qmetrix-token': token } : {};
};

const compactValue = (value, depth = 0) => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (depth > 4) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => compactValue(item, depth + 1)).filter(Boolean);
  }

  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, childValue]) => {
      const compacted = compactValue(childValue, depth + 1);
      if (compacted !== undefined && !(Array.isArray(compacted) && compacted.length === 0)) {
        acc[key] = compacted;
      }
      return acc;
    }, {});
  }

  return value;
};

const buildDashboardContext = (appState = {}) => {
  const jira = appState?.jira || {};
  const cxo = appState?.cxo || {};
  const velocityData = appState?.velocityData?.data;
  const releaseDashboard = appState?.releaseDashboard || {};
  const selectedValue = jira.selectedValue || getSessionValue('typeValue') || 'sprint';

  return compactValue({
    selectedValue,
    estimationType: getSessionValue('velocityToggleType'),
    selectedProjectName: jira.selectedProjectName,
    selectedSprintName: jira.selectedSprintName,
    selectedReleaseName: jira.selectedReleaseName,
    velocityData: jira.velocityData || velocityData,
    sprint: jira.Sprint,
    release: jira.Release,
    burndownVelocity: jira.burndownVelocity,
    burndownData: jira.burndownData,
    storyChurnData: jira.storyChurnData,
    standupBurndown: jira.standupBurndown,
    qaInsightsBugsData: jira.qaInsightsBugsData,
    qaInsightsTestsData: jira.qaInsightsTestsData,
    releaseReadinessData: cxo.releaseReadinessData,
    releaseReadinessTrendsData: cxo.releaseReadinessTrendsData,
    releaseDashboard,
  });
};

const normalizeBackendResponse = (data, history) => createResponse(data?.answer || data?.message || '', {
  sessionId: data?.session_id,
  success: Boolean(data?.success),
  contextLength: Array.isArray(history) ? history.length : 0,
  source: 'qmetrix-ai',
});

export const fetchChatResponse = async ({ message = '', history = [], appState = {} } = {}) => {
  const trimmedMessage = String(message || '').trim();

  if (!trimmedMessage) {
    throw new Error('Please enter a message.');
  }

  try {
    const response = await axios.post(
      CHAT_ENDPOINT,
      {
        message: trimmedMessage,
        session_id: 'qmetrix-ui-session',
        companyId: getSessionValue('companyId'),
        projectId: getSessionValue('projectId'),
        boardId: getSessionValue('boardId'),
        sprintId: getSessionValue('sprintId'),
        releaseId: getSessionValue('releaseId'),
        repo: getSessionValue('repo'),
        dashboard_context: buildDashboardContext(appState),
      },
      {
        timeout: CHAT_TIMEOUT_MS,
        headers: buildRequestHeaders(),
      },
    );

    return normalizeBackendResponse(response.data, history);
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.detail;
    const timeoutMessage = error?.code === 'ECONNABORTED'
      ? 'QMetrix AI is taking longer than expected. Please restart the AI backend and try again.'
      : null;
    throw new Error(
      backendMessage || timeoutMessage || 'QMetrix AI service is not responding. Please make sure the AI backend is running on port 8000.',
    );
  }
};
