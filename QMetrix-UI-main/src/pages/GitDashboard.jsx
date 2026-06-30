import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { addData } from '../store/sonarqube/sonarQubeGitSlice';
// import { useQuery } from '@tanstack/react-query';
import { getId, getBoardList, APP_STRINGS } from '../constants';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { GridViewIcon, ListViewIcon } from '../utils/commonIcons';
import GitDataCard from '../components/Git/GitDataCard';
import MergedPRsCard from '../components/Git/MergedPRsCard';
import GitListView from '../components/Git/GitListView';
import MergedPRsListView from '../components/Git/MergedPRsListView';
import '../assets/css/gitdashboard.scss';
import CommonLayout from '../layout/CommonLayout';
import DropdownButton from '../components/Common/DropDown';
import { CommonFunction } from '../utils/commonFunctions';
import { 
  storeBoardInSession, 
  restoreBoardFromSession, 
  computeProjectDisplayName
} from '../utils/boardUtils'; 
import { setSelectedTypeValue, setBoardListForProject } from '../store/JiraSlices/jiraSlice';
import { setSelectedRepository } from '../store/GitSlices/gitSlices';
import Spinner from '../components/Common/Spinner';
import ReactDOMServer from 'react-dom/server';
import { useLocation, useNavigate } from 'react-router-dom';
import getTooltipContent from '../utils/Tooltip';
import { getBoardLabels } from '../utils/boardUtils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

const GitDashboard = () => {
  const [SelectOption, setSelectOption] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedSprint, setSelectedSprint] = useState({ id: '', name: '' });
  const [selectedRelease, setSelectedRelease] = useState({ id: '', releaseName: '' });
  const [selectedValue, setSelectedValue] = useState({
    label: APP_STRINGS.SELECT_AN_OPTION,
    value: '',
  });
  const [isValueOpen, setIsValueOpen] = useState(false);
  const [getAllProjectsList, setGetAllProjectList] = useState([]);
  const [repoList, setRepoList] = useState([]);
  const [getAllSprintList, setGetAllSprintList] = useState([]);
  const [getAllReleaseList, setGetAllReleaseList] = useState([]);
  const [getAllOrgsList, setGetAllOrgsList] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedProject, setSelectedProject] = useState({ id: '', name: '' });
  const [isRepoOpen, setIsRepoOpen] = useState(false);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isSprintOpen, setIsSprintOpen] = useState(false);
    const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [projectBoardCount, setProjectBoardCount] = useState({});
  const [subMenuBoards, setSubMenuBoards] = useState([]);
  const [subMenuPosition, setSubMenuPosition] = useState({ top: 0, left: 0 });
  const [currentProjectForBoard, setCurrentProjectForBoard] = useState(null);
  const [selectedBoard, setSelectedBoard] = useState({ id: '', name: '', type: '' });
  const {
    handleProject,
    handleSprint,
    handleRelease,
    handleRepo,
    handleValue,
    handleOrganization,
  } = CommonFunction();
  const dispatch = useDispatch();
  const repoRef = useRef(null);
  const valueRef = useRef(null);
  const projectRef = useRef(null);
  const sprintRef = useRef(null);
  const [getClosedPRs, setGetClosedPRs] = useState([]);
  const [getOpenPRs, setGetOpenPRs] = useState([]);
  const [getCycleTimeData, setGetCycleTimeData] = useState([]);
  const [getApprovalRateData, setGetApprovalRateData] = useState([]);
  const [getIterationTimeData, setGetIterationTimeData] = useState([]);
  const [getTotalPRs, setGetTotalPRs] = useState([]);
  const [getAllMergedPRsWithoutReview, setGetAllMergedPRsWithoutReview] = useState([]);
  const [getAveragePullRequestSize, setGetAveragePullRequestSize] = useState([]);
  const [getReleaseReadiness, setReleaseReadiness] = useState({});
  const [repoSource, setRepoSource] = useState('');

  const gitData = useSelector((state) => state.git || {});
  const cxoData = useSelector((state) => state.cxo || {});
  const jiraData = useSelector((state) => state.jira || {});
  const theme = useSelector((state) => state.theme.theme);
  const organizationRef = useRef(null);
  const [selectedOrg, setSelectedOrg] = useState({ id: '', name: '' });
  const [isOrganizationOpen, setIsOrganizationOpen] = useState(false);
  const { sonarQubeGitData } = useSelector((state) => state.sonarQubeGit || {});
  const location = useLocation();
  const navigate = useNavigate();
  const [openAccordion, setOpenAccordion] = useState(null); 
  const scrollContainerRef = useRef(null);
  const [viewMode, setViewMode] = useState(APP_STRINGS.VIEW_GRID); // 'grid' or 'list'
  let staticCodeTrendVal = 0;
  if (Array.isArray(jiraData.repoList) && jiraData.repoList.length > 0) {
    staticCodeTrendVal = ['undefined', 'null', '', '0'].includes(
      `${sonarQubeGitData?.staticCodeAnalysisScore}`,
    )
      ? 0
      : Number(sonarQubeGitData?.staticCodeAnalysisScore) || 0;
  }
  useEffect(() => {
    if (!getAllProjectsList || !jiraData?.selectedProjectId) {
      setRepoSource('No repositories found or project not matched.');
      return;
    }

    const getMatchingProject = getAllProjectsList.find(
      (project) => project?._id === jiraData?.selectedProjectId,
    );

    if (
      getMatchingProject?.repos &&
      Array.isArray(getMatchingProject.repos) &&
      getMatchingProject.repos.length > 0
    ) {
      const isGitLab = getMatchingProject.repos.some(
        (repo) => typeof repo === 'string' && repo.includes('gitlab.com'),
      );
      const isGitHub = getMatchingProject.repos.some(
        (repo) => typeof repo === 'string' && repo.includes('github.com'),
      );

      if (isGitLab) {
        setRepoSource('GitLab');
      } else if (isGitHub) {
        setRepoSource('GitHub');
      } else {
        setRepoSource('unknown');
      }
    } else {
      setRepoSource('No repositories found or project not matched.');
    }
  }, [getAllProjectsList, jiraData?.selectedProjectId]);
  useEffect(() => {
    if (jiraData) {
      setLoading(jiraData.loadingEngMetrics || false);
      const selectedProjects = (jiraData.projectList || []).filter(
        project => project.isSelected && project.hideStatus === false
      );
      setGetAllProjectList(selectedProjects);
      setSelectedSprint({
        id: jiraData.selectedSprintId || '',
        name: jiraData.selectedSprintName || '',
      });
      setSelectedRelease({
        id: jiraData.selectedReleaseId || '',
        releaseName: jiraData.selectedReleaseName || '',
      });
      setSelectedValue({
        label: jiraData.selectedValueLabel || APP_STRINGS.SELECT_AN_OPTION,
        value: jiraData.selectedValue || '',
      });
      setGetAllSprintList(jiraData.sprintList || []);
      setGetAllReleaseList(jiraData.releasesList || []);
      setSelectedProject({
        id: jiraData.selectedProjectId || '',
        name: jiraData.selectedProjectName || '',
      });
      const restoredBoard = restoreBoardFromSession();
      if (restoredBoard) {
        setSelectedBoard(restoredBoard);
      }
      
      setIsProjectOpen(jiraData.isProjectOpen || false);
      setIsSprintOpen(jiraData.isSprintOpen || false);
      setRepoList(jiraData.repoList || []);
      setSelectedOrg({
        id: jiraData.selectedOrgId || '',
        name: jiraData.selectedOrgName || '',
      });
    }

    if (gitData) {
      setGetClosedPRs(gitData.closedPRs || []);
      setGetOpenPRs(gitData.openPRs || []);
      setGetTotalPRs(gitData.totalPRs || []);
      setSelectedRepo(gitData.selectedRepo || '');
      setGetAllMergedPRsWithoutReview(gitData.mergedWithoutReviewPRs || []);
      setGetAveragePullRequestSize(gitData.prSizeData);
      setGetCycleTimeData(gitData.gitCycleTimeData);
      setGetApprovalRateData(gitData.gitApprovalRateData);
      setGetIterationTimeData(gitData.gitIterationTimeData);
    }
    setIsOrganizationOpen(jiraData.isOrganizationOpen || false);
    if (cxoData) {
      setReleaseReadiness(cxoData.releaseReadinessData || {});
    }
  }, [jiraData, gitData, cxoData]);

  const organizationList = useSelector((state) => state.jira?.organizationList);

  useEffect(() => {
    if (organizationList?.length > 0) {
      setGetAllOrgsList(organizationList);
    }
  }, [organizationList]);
  const closedPRs = getClosedPRs?.closedPullRequestsCount ?? getClosedPRs?.data?.closedPullRequestsCount ?? 0;
  const openPRs = getOpenPRs?.openPullRequestsCount ?? getOpenPRs?.data?.openPullRequestsCount ?? 0;
  const TotalPRs = getTotalPRs?.getTotalPullRequests ?? 0;
  const gitCycleTime = getCycleTimeData?.detailedCycleTimeMetrics?.cycleTime ?? 0;
  const gitApprovalRate = getApprovalRateData?.approvalRate ?? 0;
  const gitIterationTime = getIterationTimeData?.AveragePRsIterationTime ?? 0;
  const mergedPRs = getAllMergedPRsWithoutReview?.length
    ? getAllMergedPRsWithoutReview.map(
      (item) => item.getMergedPRsWithoutReviews?.mergedWithoutReview,
    )
    : 0;

  const getPullRequestSizeLabel = (pullRequestSize) =>
    pullRequestSize <= 9
      ? 'XS'
      : pullRequestSize <= 29
      ? 'S'
      : pullRequestSize <= 99
      ? 'M'
      : pullRequestSize <= 499
      ? 'L'
      : pullRequestSize <= 999
      ? 'XL'
      : pullRequestSize >= 1000
      ? 'XXL'
      : 'Unknown';
  // Calculate overall average PR size from available data
  const calculateAveragePRSize = () => {
    if (!getAveragePullRequestSize) return 0;
    
    // Try to get average from sprint data
    const sprintSizes = getAveragePullRequestSize.averagePRSizePerSprint;
    if (sprintSizes && Object.keys(sprintSizes).length > 0) {
      const sizes = Object.values(sprintSizes);
      return Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
    }
    
    // Fallback to developer data
    const devData = getAveragePullRequestSize.averagePRSizeByDeveloper;
    if (devData && devData.length > 0) {
      const sizes = devData.map((dev) => dev.averagePRSize || dev.averageMRSize || 0);
      return Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
    }

    // Last fallback: check if old structure exists
    return getAveragePullRequestSize.pullRequestSize || 0;
  };

  const label = calculateAveragePRSize();
  const pullRequestSize = getPullRequestSizeLabel(label);
  const prLabel = repoSource?.toLowerCase() === 'gitlab' ? 'Merge Requests' : 'Pull Requests';
  const prShortLabel = repoSource?.toLowerCase() === 'gitlab' ? 'MR' : 'PR';
  const prPluralShortLabel = `${prShortLabel}s`;

  const tableDataConfig = useMemo(
    () => ({
      'Total Pull Requests': [
        { label: 'Red', color: 'var(--trisoled-color-primary)', description: '0 PRs' },
        { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '>0 PRs' },
      ],
      'Total Open Pull Requests': [
        { label: 'Red', color: 'var(--trisoled-color-primary)', description: '100% PRs' },
        { label: 'Orange', color: 'var(--trisoled-color-secondary)', description: '50-99% PRs' },
        { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '0-49% PRs' },
      ],
      'Total Open Merge Requests': [
        { label: 'Red', color: 'var(--trisoled-color-primary)', description: '100% MRs' },
        { label: 'Orange', color: 'var(--trisoled-color-secondary)', description: '50-99% MRs' },
        { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '0-49% MRs' },
      ],
      'Total Closed Pull Requests': [
        { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '100% PRs closed' },
        {
          label: 'Orange',
          color: 'var(--trisoled-color-secondary)',
          description: '50-99% PRs closed',
        },
        { label: 'Red', color: 'var(--trisoled-color-primary)', description: '0-49% PRs closed' },
      ],
      'Total Closed Merge Requests': [
        { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '100% MRs closed' },
        {
          label: 'Orange',
          color: 'var(--trisoled-color-secondary)',
          description: '50-99% MRs closed',
        },
        { label: 'Red', color: 'var(--trisoled-color-primary)', description: '0-49% MRs closed' },
      ],
      'Pull Requests Approval Rate': [
        { label: 'Red', color: 'var(--trisoled-color-tertiary)', description: '≥ 90% approved' },
        { label: 'Green', color: 'var(--trisoled-color-primary)', description: '< 90% approved' },
      ],
      'Merge Requests Approval Rate': [
        { label: 'Red', color: 'var(--trisoled-color-tertiary)', description: '≥ 90% approved' },
        { label: 'Green', color: 'var(--trisoled-color-primary)', description: '< 90% approved' },
      ],
      'Average PRs Iteration Time': [
        { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '≤ 24 hours' },
        { label: 'Orange', color: 'var(--trisoled-color-secondary)', description: '24-120 hours' },
        { label: 'Red', color: 'var(--trisoled-color-primary)', description: '> 120 hours' },
      ],
      'Average MRs Iteration Time': [
        { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '≤ 24 hours' },
        { label: 'Orange', color: 'var(--trisoled-color-secondary)', description: '24-120 hours' },
        { label: 'Red', color: 'var(--trisoled-color-primary)', description: '> 120 hours' },
      ],
      'Total Merged PRs Without Review': [
        { label: 'Red', color: 'var(--trisoled-color-primary)', description: '100%' },
        { label: 'Orange', color: 'var(--trisoled-color-secondary)', description: '50-99%' },
        { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '0-49%' },
      ],
      'Total Merged MRs Without Review': [
        { label: 'Red', color: 'var(--trisoled-color-primary)', description: '100%' },
        { label: 'Orange', color: 'var(--trisoled-color-secondary)', description: '50-99%' },
        { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '0-49%' },
      ],
      'Merge Requests Size': [
        {
          label: 'Red',
          color: 'var(--trisoled-color-primary)',
          description: 'XS / S (0-29 lines)',
        },
        {
          label: 'Orange',
          color: 'var(--trisoled-color-secondary)',
          description: 'M / L (30-499 lines)',
        },
        {
          label: 'Green',
          color: 'var(--trisoled-color-tertiary)',
          description: 'XL / XXL (500+ lines)',
        },
      ],
      'Pull Requests Size': [
        {
          label: 'Red',
          color: 'var(--trisoled-color-primary)',
          description: 'XS / S (0-29 lines)',
        },
        {
          label: 'Orange',
          color: 'var(--trisoled-color-secondary)',
          description: 'M / L (30-499 lines)',
        },
        {
          label: 'Green',
          color: 'var(--trisoled-color-tertiary)',
          description: 'XL / XXL (500+ lines)',
        },
      ],
      'Total Cycle Time': [
        { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: '≤ 1 day' },
        { label: 'Orange', color: 'var(--trisoled-color-secondary)', description: '2-5 days' },
        { label: 'Red', color: 'var(--trisoled-color-primary)', description: '> 5 days' },
      ],
      'Static Code Analysis': [
        { label: 'Green', color: 'var(--trisoled-color-tertiary)', description: 'Score: 90-100' },
        { label: 'Orange', color: 'var(--trisoled-color-secondary)', description: 'Score: 75-89' },
        { label: 'Red', color: 'var(--trisoled-color-primary)', description: 'Score: < 75' },
      ],
    }),
    [],
  );

  const gitMetrics = useMemo(
    () => [
      {
        title: `Total ${prLabel}`,
        value: TotalPRs,
        description: `Total ${prLabel}`,
        color: '#F59E0B',
        content: ReactDOMServer.renderToStaticMarkup(
          getTooltipContent(`Total ${prLabel}`, tableDataConfig[`Total ${prLabel}`]),
        ),
      },
      {
        title: `Total Open ${prLabel}`,
        value: openPRs,
        description: `Total ${prLabel}`,
        color: '#EF4444',
        content: ReactDOMServer.renderToStaticMarkup(
          getTooltipContent(`Total Open ${prLabel}`, tableDataConfig[`Total Open ${prLabel}`]),
        ),
      },
      {
        title: `Total Closed ${prLabel}`,
        value: closedPRs,
        description: `Total ${prLabel}`,
        color: '#F59E0B',
        content: ReactDOMServer.renderToStaticMarkup(
          getTooltipContent(`Total Closed ${prLabel}`, tableDataConfig[`Total Closed ${prLabel}`]),
        ),
      },
      {
        title: `${prLabel} Approval Rate`,
        key: '%',
        value: gitApprovalRate,
        description: 'Approval Rate',
        color: '#EF4444',
        content: ReactDOMServer.renderToStaticMarkup(
          getTooltipContent(
            `${prLabel} Approval Rate`,
            tableDataConfig[`${prLabel} Approval Rate`],
          ),
        ),
      },
      {
        title: `Average ${prLabel === 'Pull Requests' ? 'PRs' : 'MRs'} Iteration Time`,
        key: 'hrs',
        value: gitIterationTime,
        description: 'Total hours',
        color: '#EF4444',
        content: ReactDOMServer.renderToStaticMarkup(
          getTooltipContent(
            `Average ${prLabel === 'Pull Requests' ? 'PRs' : 'MRs'} Iteration Time`,
            tableDataConfig[
            `Average ${prLabel === 'Pull Requests' ? 'PRs' : 'MRs'} Iteration Time`
            ],
          ),
        ),
      },
      {
        title: `Total Merged ${prLabel === 'Pull Requests' ? 'PRs' : 'MRs'} Without Review`,
        value: mergedPRs,
        description: `Total ${prLabel === 'Pull Requests' ? 'PRs' : 'MRs'}`,
        color: '#34D399',
        content: ReactDOMServer.renderToStaticMarkup(
          getTooltipContent(
            `Total Merged ${prLabel === 'Pull Requests' ? 'PRs' : 'MRs'} Without Review`,
            tableDataConfig[
              `Total Merged ${prLabel === 'Pull Requests' ? 'PRs' : 'MRs'} Without Review`
            ],
          ),
        ),
      },
      {
        title: `${prLabel} Size`,
        value: pullRequestSize,
        description: `Total ${prLabel}`,
        color: '#EF4444',
        content: ReactDOMServer.renderToStaticMarkup(
          getTooltipContent(`${prLabel} Size`, tableDataConfig[`${prLabel} Size`]),
        ),
      },
      {
        title: 'Total Cycle Time',
        key: 'days',
        value: gitCycleTime,
        description: 'Total hours',
        color: '#34D399',
        content: ReactDOMServer.renderToStaticMarkup(
          getTooltipContent(`Total Cycle Time`, tableDataConfig[`Total Cycle Time`]),
        ),
      },
      {
        title: 'Static Code Analysis',
        value: staticCodeTrendVal,
        description: 'Static Code Analysis',
        color: '#EF4444',
        content: ReactDOMServer.renderToStaticMarkup(
          getTooltipContent(`Static Code Analysis`, tableDataConfig[`Static Code Analysis`]),
        ),
      },
    ],
    [
      prLabel,
      TotalPRs,
      tableDataConfig,
      openPRs,
      closedPRs,
      gitApprovalRate,
      gitIterationTime,
      mergedPRs,
      pullRequestSize,
      gitCycleTime,
      staticCodeTrendVal,
    ],
  );

  const getSonarQubeReportByRepo = (data, repoName) => {
    let report = {};
    if (data?.engineeringScoreObject?.developerScoreObject) {
      const sonarQubeScanReports =
        data?.engineeringScoreObject?.developerScoreObject?.sonarQubeScanReport;
      report = sonarQubeScanReports.find((report) => {
        const repoLastName = report.repo.split('/').pop();
        return repoLastName === repoName;
      });
    }
    dispatch(addData(report));
  };
  const handleSprintChange = async (value) => {
    try {
      await handleSprint(value, dispatch);
    } catch (error) {
      console.error('Error handling project selection:', error);
    }
    getSonarQubeReportByRepo(getReleaseReadiness, selectedRepo);
    setIsSprintOpen(false);
  };

  const handleReleaseChange = async (value) => {
    try {
      await handleRelease(value, dispatch);
    } catch (error) {
      console.error('Error handling project selection:', error);
    }

    const selectedRelease = getAllReleaseList.find((release) => release._id === value);
    sessionStorage.setItem('releaseId', selectedRelease._id);
    setSelectedRelease({ id: selectedRelease._id, releaseName: selectedRelease.releaseName });
    getSonarQubeReportByRepo(getReleaseReadiness, selectedRepo);
    setIsSprintOpen(false);
  };

  // Helper function to convert existing gitMetrics to GitDataCard format
  const convertToGitDataCard = (
    metric,
    index,
    cycleTimeData = null,
    sonarData = null,
    mergedPRsData = null,
  ) => {
    const baseCard = {
      title:
        metric.title === 'Total Pull Requests'
          ? 'Pull Requests'
          : metric.title === 'Total Merge Requests'
          ? 'Merge Requests'
          : metric.title,
      trendValue: metric.value,
      toolTip: metric.content,
      index: index,
      isSelected: SelectOption === metric.title,
    };

    // Add specific configurations based on card type
    switch (metric.title) {
      case 'Total Pull Requests':
      case 'Total Merge Requests':
        return {
          ...baseCard,
          hasDropdown: true,
          // dropdownLabel: 'Pull Requests',
          dropdownLabel: prLabel,
          dropdownOptions: [
            { value: 'sprint', label: 'By Sprint' },
            { value: 'developer', label: 'By Developer' },
            { value: 'repository', label: 'By Repository' },
          ],
          onDropdownChange: () => {},
          mainContentData: {
            secondaryMetrics: [
              { label: `Total ${prPluralShortLabel}`, value: metric.value },
              { label: `Total Open ${prPluralShortLabel}`, value: openPRs },
              { label: `Total Closed ${prPluralShortLabel}`, value: closedPRs },
            ],
          },
        };

      case 'Pull Requests Approval Rate':
      case 'Merge Requests Approval Rate':
        return {
          ...baseCard,
          mainContentData: {
            secondaryMetrics: [
              // { label: 'Average PR Approval Rate By Sprint', value: metric.value },
              // { label: 'Average PR Approval Rate By Dev', value: metric.value },
              { label: `Average ${prShortLabel} Approval Rate By Sprint`, value: metric.value },
  { label: `Average ${prShortLabel} Approval Rate By Dev`, value: metric.value },
            ],
          },
        };

      case 'Average PRs Iteration Time':
      case 'Average MRs Iteration Time': {
        // Use real API data instead of hardcoded values
        const iterationTimeData = gitData.gitIterationTimeData;

        const avgPerSprint =
          iterationTimeData?.averagePRIterationTimePerSprint?.length > 0
            ? iterationTimeData.averagePRIterationTimePerSprint.reduce(
                (sum, item) => sum + parseFloat(item.iterationTime || 0),
                0,
              ) / iterationTimeData.averagePRIterationTimePerSprint.length
            : 0;
        const avgByDev =
          iterationTimeData?.averagePRIterationTimeByDev?.length > 0
            ? iterationTimeData.averagePRIterationTimeByDev.reduce(
                (sum, item) => sum + parseFloat(item.iterationTime || 0),
                0,
              ) / iterationTimeData.averagePRIterationTimeByDev.length
            : 0;

        // Format values to 2 decimal places to prevent overflow
        const formatValue = (val) => {
          if (typeof val === 'number') {
            return parseFloat(val.toFixed(2));
          }
          const numVal = parseFloat(val);
          return isNaN(numVal) ? val : parseFloat(numVal.toFixed(2));
        };

        return {
          ...baseCard,
          mainContentData: {
            secondaryMetrics: [
              { label: `Total Average ${prShortLabel} Iteration Time`, value: formatValue(metric.value) },
              { label: `Avg ${prShortLabel} Iteration Time Per Sprint`, value: formatValue(avgPerSprint) },
              { label: `Avg ${prShortLabel} Iteration Time By Dev`, value: formatValue(avgByDev) },
            ],
          },
        };
      }

      case 'Pull Requests Size':
      case 'Merge Requests Size': {
        // Use actual PR size data from gitData
        const prSizeDataFromStore = gitData.prSizeData || {};
        const avgSizePerSprint = prSizeDataFromStore.averagePRSizePerSprint || {};
        const avgSizeByDev = prSizeDataFromStore.averagePRSizeByDeveloper || [];

        // Get the latest sprint's average size
        const sprintSizes = Object.values(avgSizePerSprint);
        const latestSprintSize = sprintSizes.length > 0 ? sprintSizes[sprintSizes.length - 1] : 0;

        // Get average of all developers
        const devSizes = avgSizeByDev.map((dev) => dev.averagePRSize || dev.averageMRSize || 0);
        const avgDevSize =
          devSizes.length > 0
            ? Math.round(devSizes.reduce((a, b) => a + b, 0) / devSizes.length)
            : 0;

        // Calculate overall average for the main card (same logic as above)
        let overallAverageSizeForCard = 0;
        if (sprintSizes.length > 0) {
          overallAverageSizeForCard = Math.round(
            sprintSizes.reduce((a, b) => a + b, 0) / sprintSizes.length,
          );
        } else if (devSizes.length > 0) {
          overallAverageSizeForCard = avgDevSize;
        }

        // Convert to size label for main card
        const mainCardSizeLabel = getPullRequestSizeLabel(overallAverageSizeForCard);

        return {
          ...baseCard,
          trendValue: mainCardSizeLabel, // Override with correct size label
          mainContentData: {
            secondaryMetrics: [
              {
                label: `Average ${prShortLabel} Size Per Sprint`,
                value: getPullRequestSizeLabel(latestSprintSize),
              },
              { label: `Average ${prShortLabel} Size By Developer`, value: getPullRequestSizeLabel(avgDevSize) },
            ],
          },
        };
      }

      case 'Total Merged PRs Without Review':
      case 'Total Merged MRs Without Review': {
        // Get real data from passed parameters - using the same structure as TotalOpenPRWithoutMerge component
        const mergedPRsDataArray = mergedPRsData || [];

        // Extract data using the same pattern as the original component (lines 35-99 in totalPRWithoutMerge.jsx)
        const mergedPRsWithoutReview =
          mergedPRsDataArray.length > 0
            ? mergedPRsDataArray.map(
                (item) => item.getMergedPRsWithoutReviews?.mergedWithoutReview,
              )[0] || 0
            : 0;

        // Extract additional data fields from old code
        const mergedPRsWithReview =
          mergedPRsDataArray.length > 0
            ? mergedPRsDataArray[0]?.getMergedPRsWithoutReviews?.mergedWithReviewPrs || 0
            : 0;

        const totalMergedPRs =
          mergedPRsDataArray.length > 0
            ? mergedPRsDataArray[0]?.getMergedPRsWithoutReviews?.totalMergedPRs || 0
            : 0;

        // Calculate percentage if not available directly
        const percentageWithoutReview =
          mergedPRsDataArray.length > 0
            ? mergedPRsDataArray.map((item) => item.getPercentageMergedPRsNoReviews)[0] ||
              (mergedPRsDataArray[0]?.getMergedPRsWithoutReviews?.totalMergedPRs > 0
                ? Math.round(
                    (mergedPRsDataArray[0]?.getMergedPRsWithoutReviews?.mergedWithoutReview /
                      mergedPRsDataArray[0]?.getMergedPRsWithoutReviews?.totalMergedPRs) *
                      100,
                  )
                : 0)
            : 0;

        const averageTimeWithoutReview =
          mergedPRsDataArray.length > 0
            ? mergedPRsDataArray.map((item) => item.getAvgTimeMergedPRsNoReviews)[0] || '0m'
            : '0m';

        const averageTimeWithReview =
          mergedPRsDataArray.length > 0
            ? mergedPRsDataArray.find((item) => item.getAverageMergeTimeWithReview)
                ?.getAverageMergeTimeWithReview?.AverageTimeToMerge || '0 hrs'
            : '0 hrs';

        // Get trend value from API data - lastWeekUnreviewedPercentage
        const lastWeekPercentage =
          mergedPRsDataArray.length > 0
            ? mergedPRsDataArray[0]?.getMergedPRsWithoutReviews?.lastWeekUnreviewedPercentage ||
              '0.0'
            : '0.0';

        // Calculate trend value using the same format as old code
        const mergedPRsWithoutReviewLastWeekPercentage = lastWeekPercentage;
        const trendText = `${
          parseFloat(mergedPRsWithoutReviewLastWeekPercentage) > 0 ? '+' : ''
        }${Math.round(parseFloat(mergedPRsWithoutReviewLastWeekPercentage))}% since last week`;

        // Get unreviewed PRs details (lines 101-109 in totalPRWithoutMerge.jsx)
        const unreviewedPRs =
          mergedPRsDataArray.length > 0
            ? mergedPRsDataArray.flatMap(
                (item) => item.getMergedPRsWithoutReviews?.unreviewedPRDetails || [],
              )
            : [];

        // Also check for high risk PRs data
        const highRiskData =
          mergedPRsDataArray.length > 0
            ? mergedPRsDataArray.find((item) => item.getHighRiskPRs)?.getHighRiskPRs
            : null;

        // Extract high-risk factors like in old code
        const highRiskFactors = highRiskData?.riskFactorCounts || {
          large_size: 0,
          many_files: 0,
          no_reviews: 0,
          self_merged: 0,
          missing_tests: 0,
          sensitive_changes: 0,
        };

        // Get unreviewed PRs from high risk data if available
        const unreviewedPRsFromHighRisk = highRiskData?.riskFactorPRs?.no_reviews || [];

        // Get recent PRs from unreviewedPRs or high risk data (first 2 items)
        const prsToUse = unreviewedPRs.length > 0 ? unreviewedPRs : unreviewedPRsFromHighRisk;

        const recentPRs = prsToUse.slice(0, 2).map((pr) => ({
          title: pr.title || `${prShortLabel} #${pr.prNumber || 'Unknown'}`,
          details: `Merged: ${pr.daysAgo === 0 ? 'Today' : `${pr.daysAgo} days ago`}`,
          prNumber: pr.prNumber,
          repo: pr.repo,
          host:
            mergedPRsDataArray.length > 0
              ? mergedPRsDataArray[0]?.getMergedPRsWithoutReviews?.host ||
                'Trigent-Software-Pvt-Ltd'
              : 'Trigent-Software-Pvt-Ltd',
        }));

        return {
          ...baseCard,
          trendValue: mergedPRsWithoutReview, // Use the actual count as the main value
          trendText: trendText, // Pass the trend text separately
          warningMessage:
            mergedPRsWithoutReview > 0
              ? `High number of unreviewed ${prPluralShortLabel} detected this sprint`
              : null,
          mainContentData: {
            secondaryMetrics: [
              {
                label: `Total ${prPluralShortLabel} Merged Without Review`,
                value: `${mergedPRsWithoutReview}`,
              },
              {
                label: `Percentage Of ${prPluralShortLabel} Merged Without Review`,
                value: `${percentageWithoutReview}%`,
              },
              {
                label: `Average Time To Merge Without Review`,
                value: averageTimeWithoutReview,
              },
            ],
            // Additional data fields from old code
            mergedPRsWithReview: mergedPRsWithReview,
            totalMergedPRs: totalMergedPRs,
            averageTimeWithReview: averageTimeWithReview,
            highRiskFactors: highRiskFactors,
            highRiskCount: highRiskData?.highRiskCount || mergedPRsWithoutReview,
            affectedModules: prsToUse.length > 0 ? 'Multiple' : 'None',
            recentPRs: recentPRs,
          },
        };
      }

      case 'Total Cycle Time':
        return {
          ...baseCard,
          mainContentData: {
            secondaryMetrics: [
              {
                label: 'Coding Time',
                value: `${cycleTimeData?.detailedCycleTimeMetrics?.codingTime || '0'} hrs`,
              },
              {
                label: 'Pick Up Time',
                value: `${cycleTimeData?.detailedCycleTimeMetrics?.pickupTime || '0'} hrs`,
              },
              {
                label: 'Review Time',
                value: `${cycleTimeData?.detailedCycleTimeMetrics?.reviewTime || '0'} hrs`,
              },
              {
                label: 'Average Cycle Time By Sprint',
                value: cycleTimeData?.averageCycleTimeBySprint || metric.value,
              },
              {
                label: 'Average Cycle Time By Dev',
                value: cycleTimeData?.averageCycleTimeByDev || metric.value,
              },
            ],
          },
        };

      case 'Static Code Analysis': {
        return {
          ...baseCard,
          metrics: [
            {
              label: 'Duplicated Files',
              value: sonarData?.duplicated_files || '0',
              toolTip: ReactDOMServer.renderToStaticMarkup(
                getTooltipContent('Duplicated Files', []),
              ),
            },
            {
              label: 'Non-Commented Lines Of Code',
              value: sonarData?.ncloc || '0',
              toolTip: ReactDOMServer.renderToStaticMarkup(
                getTooltipContent('Non-Commented Lines Of Code', []),
              ),
            },
            {
              label: 'Vulnerabilities',
              value: sonarData?.vulnerabilities || '0',
              toolTip: ReactDOMServer.renderToStaticMarkup(
                getTooltipContent('Vulnerabilities', []),
              ),
            },
            {
              label: 'Security Hotspots',
              value: sonarData?.security_hotspots || '0',
              toolTip: ReactDOMServer.renderToStaticMarkup(
                getTooltipContent('Security Hotspots', []),
              ),
            },
            {
              label: 'Duplicated Blocks',
              value: sonarData?.duplicated_blocks || '0',
              toolTip: ReactDOMServer.renderToStaticMarkup(
                getTooltipContent('Duplicated Blocks', []),
              ),
            },
            {
              label: 'Duplicated Lines',
              value: sonarData?.duplicated_lines || '0',
              toolTip: ReactDOMServer.renderToStaticMarkup(
                getTooltipContent('Duplicated Lines', []),
              ),
            },
            {
              label: 'Code Smells',
              value: sonarData?.code_smells || '0',
              toolTip: ReactDOMServer.renderToStaticMarkup(getTooltipContent('Code Smells', [])),
            },
          ],
        };
      }

      default:
        return {
          ...baseCard,
          mainContentData: {
            secondaryMetrics: [{ label: 'Value', value: metric.value }],
          },
        };
    }
  };

  const renderGitMetrics = () => {
    if (viewMode === APP_STRINGS.VIEW_GRID) {
      // Filter out the separate open/closed PR cards since they're consolidated into the main PR card
      const filteredMetrics = gitMetrics.filter(
        (metric) =>
          ![
            'Total Open Pull Requests',
            'Total Closed Pull Requests',
            'Total Open Merge Requests',
            'Total Closed Merge Requests',
          ].includes(metric.title),
      );

      return (
        <div className="grid grid-cols-3 gap-4" ref={scrollContainerRef}>
          {filteredMetrics.map((metric, index) => {
            // Use special component for "Total Merged PRs Without Review"
            if (
              metric.title === 'Total Merged PRs Without Review' ||
              metric.title === 'Total Merged MRs Without Review'
            ) {
              const cardProps = convertToGitDataCard(
                metric,
                index,
                getCycleTimeData,
                sonarQubeGitData,
                getAllMergedPRsWithoutReview,
              );
              return (
                <MergedPRsCard
                  key={metric.title}
                  title={cardProps.title}
                  trendValue={cardProps.trendValue}
                  trendText={cardProps.trendText}
                  toolTip={cardProps.toolTip}
                  index={cardProps.index}
                  isSelected={cardProps.isSelected}
                  mainContentData={cardProps.mainContentData}
                  warningMessage={cardProps.warningMessage}
                  repoConnector={repoSource}
                  prLabel={prLabel}
                  prShortLabel={prShortLabel}
                  prPluralShortLabel={prPluralShortLabel}
                />
              );
            }

            // Use regular GitDataCard for other cards
            const cardProps = convertToGitDataCard(
              metric,
              index,
              getCycleTimeData,
              sonarQubeGitData,
              getAllMergedPRsWithoutReview,
            );
            return (
              <GitDataCard
                key={metric.title}
                {...cardProps}
                className={cardProps.isLargeCard ? 'col-span-2' : ''}
              />
            );
          })}
        </div>
      );
    } else {
      // List view - new implementation
      const filteredMetrics = gitMetrics.filter(
        (metric) =>
          ![
            'Total Open Pull Requests',
            'Total Closed Pull Requests',
            'Total Open Merge Requests',
            'Total Closed Merge Requests',
          ].includes(metric.title),
      );

      return (
        <div className="flex flex-col gap-6" ref={scrollContainerRef}>
          {filteredMetrics.map((metric, index) => {
            const cardProps = convertToGitDataCard(
              metric,
              index,
              getCycleTimeData,
              sonarQubeGitData,
              getAllMergedPRsWithoutReview,
            );

            const getChartData = (metricTitle) => {
              switch (metricTitle) {
                case 'Total Pull Requests':
                case 'Total Merge Requests': {
                  const totalPRsData = gitData.totalPRs;
                  if (totalPRsData?.totalPullRequests?.length > 0) {
                    return {
                      labels: totalPRsData.totalPullRequests.map((item) => item.name),
                      dataPoints: totalPRsData.totalPullRequests.map((item) => item.count || 0),
                      label: 'Total Pull Requests',
                      borderColor: '#10B981',
                    };
                  } else {
                    return {
                      labels: ['No Data'],
                      dataPoints: [0],
                      label: 'No Data Available',
                      borderColor: '#10B981',
                    };
                  }
                }
                case 'Pull Requests Approval Rate':
                case 'Merge Requests Approval Rate': {
                  const approvalRateData = gitData.gitApprovalRateData;
                  if (approvalRateData?.averagePRApprovalRatePerSprint?.length > 0) {
                    return {
                      labels: approvalRateData.averagePRApprovalRatePerSprint.map(
                        (item) => item.sprint,
                      ),
                      dataPoints: approvalRateData.averagePRApprovalRatePerSprint.map((item) =>
                        parseFloat(item.approvalRate || 0),
                      ),
                      label: 'Average PR Approval Rate Per Sprint',
                      borderColor: '#3B82F6',
                    };
                  } else {
                    return {
                      labels: ['No Data'],
                      dataPoints: [0],
                      label: 'No Data Available',
                      borderColor: '#3B82F6',
                    };
                  }
                }
                case 'Average PRs Iteration Time':
                case 'Average MRs Iteration Time': {
                  const iterationTimeData = gitData.gitIterationTimeData;
                  if (iterationTimeData?.averagePRIterationTimePerSprint?.length > 0) {
                    return {
                      labels: iterationTimeData.averagePRIterationTimePerSprint.map(
                        (item) => item.sprint,
                      ),
                      dataPoints: iterationTimeData.averagePRIterationTimePerSprint.map((item) =>
                        parseFloat(item.iterationTime || 0),
                      ),
                      label: 'Avg PR Iteration Time Per Sprint',
                      borderColor: '#F59E0B',
                    };
                  } else if (iterationTimeData?.averagePRIterationTimeByDev?.length > 0) {
                    return {
                      labels: iterationTimeData.averagePRIterationTimeByDev.map(
                        (item) => item.name,
                      ),
                      dataPoints: iterationTimeData.averagePRIterationTimeByDev.map((item) =>
                        parseFloat(item.iterationTime || 0),
                      ),
                      label: 'Avg PR Iteration Time By Dev',
                      borderColor: '#F59E0B',
                    };
                  } else {
                    return {
                      labels: ['No Data'],
                      dataPoints: [0],
                      label: 'No Data Available',
                      borderColor: '#F59E0B',
                    };
                  }
                }
                case 'Pull Requests Size':
                case 'Merge Requests Size': {
                  const prSizeData = gitData.prSizeData;
                  if (prSizeData?.averagePRSizePerSprint?.length > 0) {
                    return {
                      labels: prSizeData.averagePRSizePerSprint.map((item) => item.sprint),
                      dataPoints: prSizeData.averagePRSizePerSprint.map((item) =>
                        parseFloat(item.size || 0),
                      ),
                      label: 'Average PR Size Per Sprint',
                      borderColor: '#EF4444',
                    };
                  } else if (prSizeData?.averagePRSizeByDev?.length > 0) {
                    return {
                      labels: prSizeData.averagePRSizeByDev.map((item) => item.name),
                      dataPoints: prSizeData.averagePRSizeByDev.map((item) =>
                        parseFloat(item.size || 0),
                      ),
                      label: 'Average PR Size By Developer',
                      borderColor: '#EF4444',
                    };
                  } else {
                    return {
                      labels: ['No Data'],
                      dataPoints: [0],
                      label: 'No Data Available',
                      borderColor: '#EF4444',
                    };
                  }
                }
                case 'Total Cycle Time': {
                  // Use real data from Redux store
                  const cycleTimeData = getCycleTimeData?.cycleTimePerSprintOrRelease || [];

                  if (cycleTimeData.length > 0) {
                    const labels = cycleTimeData.map((item) => item.name);
                    const cycleTimeDataPoints = cycleTimeData.map((item) => item.cycleTime || 0);
                    const prsMergedDataPoints = cycleTimeData.map((item) => item.prsMerged || 0);
                    const prsOpenDataPoints = cycleTimeData.map((item) => item.prsOpen || 0);

                    return {
                      labels,
                      datasetData: [
                        {
                          label: 'Cycle Time',
                          data: cycleTimeDataPoints,
                          backgroundColor: '#8B5CF6',
                        },
                        {
                          label: 'PRs Merged',
                          data: prsMergedDataPoints,
                          backgroundColor: '#10B981',
                        },
                        {
                          label: 'PRs InProgress',
                          data: prsOpenDataPoints,
                          backgroundColor: '#F59E0B',
                        },
                      ],
                      label: 'Cycle Time Per Sprint',
                      isGroupChart: true,
                    };
                  } else {
                    return {
                      labels: ['No Data'],
                      datasetData: [
                        {
                          label: 'Cycle Time',
                          data: [0],
                          backgroundColor: '#8B5CF6',
                        },
                        {
                          label: 'PRs Merged',
                          data: [0],
                          backgroundColor: '#10B981',
                        },
                        {
                          label: 'PRs InProgress',
                          data: [0],
                          backgroundColor: '#F59E0B',
                        },
                      ],
                      label: 'No Data Available',
                      isGroupChart: true,
                    };
                  }
                }
                default:
                  return null;
              }
            };

            // Use special component for "Total Merged PRs Without Review"
            if (
              metric.title === 'Total Merged PRs Without Review' ||
              metric.title === 'Total Merged MRs Without Review'
            ) {
              return (
                <MergedPRsListView
                  key={metric.title}
                  title={cardProps.title}
                  trendValue={cardProps.trendValue}
                  trendText={cardProps.trendText}
                  toolTip={cardProps.toolTip}
                  index={cardProps.index}
                  isSelected={cardProps.isSelected}
                  mainContentData={cardProps.mainContentData}
                  warningMessage={cardProps.warningMessage}
                  repoConnector={repoSource}
                  prShortLabel={prShortLabel}
                  prPluralShortLabel={prPluralShortLabel}
                />
              );
            }

            // Use regular GitListView for other cards
            return (
              <GitListView
                key={metric.title}
                title={cardProps.title}
                trendValue={cardProps.trendValue}
                toolTip={cardProps.toolTip}
                index={cardProps.index}
                isSelected={cardProps.isSelected}
                mainContentData={cardProps.mainContentData}
                metrics={cardProps.metrics}
                hasDropdown={cardProps.hasDropdown}
                dropdownOptions={cardProps.dropdownOptions}
                dropdownLabel={cardProps.dropdownLabel}
                onDropdownChange={cardProps.onDropdownChange}
                warningMessage={cardProps.warningMessage}
                chartData={getChartData(metric.title)}
                chartType={metric.title === 'Total Cycle Time' ? 'bar' : 'line'}
                prLabel={prLabel}
                prShortLabel={prShortLabel}
              />
            );
          })}
        </div>
      );
    }
  };
  const handleRepoChange = async (value) => {
    try {
      await handleRepo(value, dispatch);
    } catch (error) {
      console.error('Error handling repo selection:', error);
    }

    setSelectedSprint({ id: '', name: '' });
    const selectedRep = repoList?.find((repo) => repo === value.label);
    sessionStorage.setItem('repo', selectedRep);
    setSelectedRepo(selectedRep);
    dispatch(setSelectedRepository(selectedRep));
    if (selectedSprint?.id) {
      handleSprintChange(selectedSprint.id);
    }
    if (selectedRelease?.id) {
      handleReleaseChange(selectedRelease.id);
    }
  };

  const handleOrganizationChange = async (value) => {
    try {
      await handleOrganization(value, dispatch);
    } catch (error) {
      console.error('Error handling project selection:', error);
    }
  };

  const handleProjectChange = async (value) => {
    try {
      setIsBoardOpen(false);
      setSubMenuBoards([]);
      setCurrentProjectForBoard(null);
      setSelectedBoard({ id: '', name: '', type: '' });
      sessionStorage.removeItem(APP_STRINGS.SESSION_BOARD_ID);

      const companyId = getId().companyId;
      const boards = await fetchBoardList(companyId, value);

      if (boards.length > 1) {
        setIsBoardOpen(false);
        setSubMenuBoards([]);
        setCurrentProjectForBoard(null);

        const firstBoard = boards[0];
        const boardId = firstBoard?.id || firstBoard?._id || '';

        const project = getAllProjectsList?.find((p) => p._id === value);
        if (project) {
          setSelectedProject({
            id: project._id,
            name: project.name,
          });

          setSelectedBoard({
            id: boardId,
            name: firstBoard?.name || firstBoard?.boardName || '',
            type: firstBoard?.type || firstBoard?.boardType || '',
          });

          sessionStorage.setItem(APP_STRINGS.SESSION_BOARD_ID, boardId);

          storeBoardInSession(
            boardId,
            firstBoard?.name || firstBoard?.boardName || '',
            firstBoard?.type || firstBoard?.boardType || '',
          );

          await handleProject(value, firstBoard?.type || firstBoard?.boardType || '', dispatch);
        }

        return;
      }
    const project = getAllProjectsList?.find((p) => p._id === value);
      if (project) {
        setSelectedProject({
          id: project._id,
          name: project.name,
        });

        if (boards[0]) {
          const boardId = boards[0]?.id || boards[0]?._id || '';
          setSelectedBoard({
            id: boardId,
            name: boards[0]?.name || boards[0]?.boardName || '',
            type: boards[0]?.type || boards[0]?.boardType || '',
          });

          sessionStorage.setItem(APP_STRINGS.SESSION_BOARD_ID, boardId);

          storeBoardInSession(
            boardId,
            boards[0]?.name || boards[0]?.boardName || '',
            boards[0]?.type || boards[0]?.boardType || '',
          );
        }
      await handleProject(value, boards[0]?.type || boards[0]?.boardType || '', dispatch);
      }

    } catch (error) {
      console.error('Error handling project selection:', error);
    }
  };

  const fetchBoardList = async (companyId, projectId) => {
    try {
      const cachedBoards = jiraData?.boardListByProjectId?.[projectId];
      if (cachedBoards?.length > 0) {
        return cachedBoards;
      }
      const response = await getBoardList(companyId, projectId);
      let boards = [];
      if (response && response.data) {
        if (Array.isArray(response.data)) {
          boards = response.data;
        } else if (response.data.boards && Array.isArray(response.data.boards)) {
          boards = response.data.boards;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          boards = response.data.data;
        }
      }
      if (boards.length > 0) {
        dispatch(setBoardListForProject({ projectId, boards }));
      }
      return boards;
    } catch (error) {
      console.error('Error fetching board list:', error);
      return [];
    }
  };

  const handleBoardChange = async (boardId, projectId) => {
    try {
      const selectedBoardData = subMenuBoards.find((board) => (board.id || board._id) === boardId);
      if (selectedBoardData) {
        setSelectedBoard({
          id: boardId,
          name: selectedBoardData.name || selectedBoardData.boardName || '',
          type: selectedBoardData.type || selectedBoardData.boardType || '',
        });
        sessionStorage.setItem(APP_STRINGS.SESSION_BOARD_ID, boardId);
        storeBoardInSession(
          boardId,
          selectedBoardData.name || selectedBoardData.boardName || '',
          selectedBoardData.type || selectedBoardData.boardType || '',
        );
        await handleProject(
          projectId,
          selectedBoardData.type || selectedBoardData.boardType,
          dispatch,
        );
        const project = getAllProjectsList.find((p) => p._id === projectId);
        setSelectedProject({
          id: projectId,
          name: project?.name || '',
        });
        setSubMenuBoards([]);
        setCurrentProjectForBoard('');
        setIsBoardOpen(false);
      }
    } catch (error) {
      console.error('Error handling board selection:', error);
    }
  };

  const handleProjectHover = async (projectId) => {
    try {
      setIsBoardOpen(false);
      setSubMenuBoards([]);
      setCurrentProjectForBoard('');
      await new Promise((resolve) => setTimeout(resolve, 50));
      const companyId = getId().companyId;
      const boards = await fetchBoardList(companyId, projectId);
      if (boards.length > 1) {
        const hoveredElement = document.querySelector(
          `[${APP_STRINGS.ATTR_DATA_PROJECT_ID}="${projectId}"]`,
        );
        if (hoveredElement) {
          const rect = hoveredElement.getBoundingClientRect();
          setSubMenuPosition({
            top: rect.top,
            left: rect.right + 10, // Add small spacing to match StandUp page visual gap
          });
        } else {
          setSubMenuPosition({
            top: 100,
            left: 420,
          });
        }

        setSubMenuBoards(boards);
        setCurrentProjectForBoard(projectId);
        setIsBoardOpen(true);
      } else {
        setIsBoardOpen(false);
        setSubMenuBoards([]);
        setCurrentProjectForBoard('');
      }
    } catch (error) {
      console.error('Error in handleProjectHover:', error);
      setIsBoardOpen(false);
      setSubMenuBoards([]);
      setCurrentProjectForBoard('');
    }
  };

  const handleProjectMouseLeave = () => {
    setTimeout(() => {
      const submenuElement = document.querySelector(APP_STRINGS.CLASS_BOARD_SUBMENU);
      const allProjectElements = document.querySelectorAll(APP_STRINGS.QUERY_DATA_PROJECT_ID);
      let isHoveringOverProject = false;
      allProjectElements.forEach((element) => {
        if (element.matches(':hover')) {
          isHoveringOverProject = true;
        }
      });

      if (submenuElement && !submenuElement.matches(':hover') && !isHoveringOverProject) {
        setIsBoardOpen(false);
        setSubMenuBoards([]);
        setCurrentProjectForBoard('');
      }
    }, 150);
  };

  

  const handleValueChange = (value) => {
    handleValue(value, dispatch);
    setSelectedValue(value);
    setGetAllSprintList(jiraData.sprintList);
    dispatch(setSelectedTypeValue({ selectedValueLabel: value.label, selectedValue: value.value }));
    setIsValueOpen(false);
    setSelectedSprint({ id: '', name: '' });
    setSelectedRelease({ id: '', releaseName: '' });
  };
  useEffect(() => {
    if (location.state?.autoExpand && location.state?.expand) {
      const widgetIndex = gitMetrics.findIndex((item) => item.title === location.state.expand);

      if (widgetIndex !== -1) {
        setOpenAccordion(widgetIndex);
        setSelectOption(location.state.expand);

        const scrollWithRetry = () => {
          setTimeout(() => {
            if (scrollContainerRef.current) {
              const targetElement = scrollContainerRef.current.querySelector(
                `[data-index="${widgetIndex}"]`,
              );
              if (targetElement) {
                const headerHeight = 64;
                const scrollOptions = {
                  behavior: 'smooth',
                  block: 'start',
                  inline: 'nearest',
                };
                const scrollTop =
                  targetElement.getBoundingClientRect().top + window.scrollY - headerHeight;
                window.scrollTo({ ...scrollOptions, top: scrollTop });
                navigate('/gitDashboard', { replace: true, state: {} });
              } else {
                setTimeout(scrollWithRetry, 500);
              }
            } else {
              setTimeout(scrollWithRetry, 500);
            }
          }, 300);
        };
        scrollWithRetry();
      }
    }
  }, [location, navigate, gitMetrics, openAccordion, scrollContainerRef]);

  useEffect(() => {
    const fetchProjectBoardCounts = async () => {
      if (getAllProjectsList.length === 0) return;
      try {
        const companyId = getId().companyId;
        const boardCounts = {};
        for (const project of getAllProjectsList) {
          try {
            const boards = await fetchBoardList(companyId, project._id);
            boardCounts[project._id] = boards.length;
          } catch (error) {
            console.error(`Error fetching board count for project ${project._id}:`, error);
            boardCounts[project._id] = 0;
          }
        }
        setProjectBoardCount(boardCounts);
      } catch (error) {
        console.error('Error fetching project board counts:', error);
      }
    };
    fetchProjectBoardCounts();
  }, [getAllProjectsList]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isBoardOpen && !event.target.closest(APP_STRINGS.CLASS_BOARD_SUBMENU)) {
        setIsBoardOpen(false);
        setSubMenuBoards([]);
        setCurrentProjectForBoard('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isBoardOpen]);

  const selectedProjectDisplayName = computeProjectDisplayName(selectedProject, selectedBoard);

  return (
    <CommonLayout>
      {loading && (
        <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-white bg-opacity-50 dark:bg-[#151F2C] dark:bg-opacity-50 text-black dark:text-white z-50">
          <Spinner />
        </div>
      )}
      <div className="relative transition-all duration-300">
        <div className="sticky top-12 w-full px-[15px] bg-[#F0F4F8] dark:bg-[#151F2C] z-10 pt-6 pb-4 flex justify-between mb-[50px] shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <div className="flex gap-2 w-full">
            {getAllOrgsList.length > 0 && (
              <div className="flex">
                <DropdownButton
                  buttonLabel={APP_STRINGS.LABEL_SELECT}
                  options={getAllOrgsList.map((org) => ({
                    value: org._id,
                    label: org.companyName,
                  }))}
                  onSelect={handleOrganizationChange}
                  placeholder={APP_STRINGS.LABEL_SELECT}
                  selectedOption={selectedOrg.name}
                  isOpen={isOrganizationOpen}
                  setIsOpen={setIsOrganizationOpen}
                  reference={organizationRef}
                  type={APP_STRINGS.DROPDOWN_TYPE_ORGANIZATION}
                  width="sm"
                />
              </div>
            )}
            <div>
              <DropdownButton
                buttonLabel={APP_STRINGS.LABEL_SELECT_PROJECT}
                options={getAllProjectsList.map((project) => ({
                  value: project._id,
                  label: project.name,
                  boardCount: projectBoardCount[project._id] || 0,
                  hasMultipleBoards: (projectBoardCount[project._id] || 0) > 1,
                }))}
                onSelect={handleProjectChange}
                onOptionHover={handleProjectHover}
                onOptionMouseLeave={handleProjectMouseLeave}
                placeholder={APP_STRINGS.LABEL_SELECT_PROJECT}
                selectedOption={selectedProjectDisplayName}
                isOpen={isProjectOpen}
                setIsOpen={setIsProjectOpen}
                reference={projectRef}
                type={APP_STRINGS.DROPDOWN_TYPE_PROJECT}
                width="lg"
              />
            </div>

            {/* Board Sub-menu Overlay */}
            {isBoardOpen && subMenuBoards.length > 0 && (
              <div
                className="board-submenu fixed z-[9999] bg-white dark:bg-[#182433] rounded-lg shadow-lg border border-gray-200 dark:border-[#30445A] min-w-[200px]"
                style={{
                  top: `${subMenuPosition.top}px`,
                  left: `${subMenuPosition.left}px`,
                }}
                onMouseEnter={() => {}}
                onMouseLeave={() => {
                  setTimeout(() => {
                    const projectElement = document.querySelector(
                      `[${APP_STRINGS.ATTR_DATA_PROJECT_ID}="${currentProjectForBoard}"]`,
                    );
                    if (!projectElement || !projectElement.matches(':hover')) {
                      setIsBoardOpen(false);
                      setSubMenuBoards([]);
                      setCurrentProjectForBoard('');
                    }
                  }, 100);
                }}
              >
                <div className="py-2">
                  {subMenuBoards.map((board, index) => (
                    <div
                      key={board.id || board._id || index}
                      className="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#1E2B3A] transition-colors"
                      onClick={() => {
                        handleBoardChange(board.id || board._id, currentProjectForBoard);
                      }}
                    >
                      <span className="text-sm text-gray-700 dark:text-[#D9E4F1]">
                        {board.name || board.boardName} ({board.type || board.boardType})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <DropdownButton
                buttonLabel={APP_STRINGS.LABEL_SELECT_PROJECT}
                options={
                  repoList?.map((project) => ({
                    label: project,
                    value: project,
                  })) || []
                }
                onSelect={handleRepoChange}
                placeholder={APP_STRINGS.LABEL_SELECT_REPOSITORY}
                selectedOption={selectedRepo}
                isOpen={isRepoOpen}
                setIsOpen={setIsRepoOpen}
                reference={repoRef}
                type={APP_STRINGS.DROPDOWN_TYPE_REPO}
                width="md"
              />
            </div>

            <div>
              {(() => {
                const { sprintLabel, releaseLabel } = getBoardLabels({
                  projectList: getAllProjectsList || jiraData?.projectList,
                });
                return (
                  <DropdownButton
                    options={[
                      { value: APP_STRINGS.VALUE_SPRINT, label: sprintLabel },
                      { value: APP_STRINGS.VALUE_DATE_RANGE, label: APP_STRINGS.VALUE_DATE_RANGE },
                      { value: APP_STRINGS.VALUE_RELEASE, label: releaseLabel },
                    ]}
                    onSelect={handleValueChange}
                    placeholder={APP_STRINGS.LABEL_SELECT_PREFIX}
                    selectedOption={
                      selectedValue.value === APP_STRINGS.VALUE_SPRINT
                        ? sprintLabel
                        : selectedValue.value === APP_STRINGS.VALUE_RELEASE
                        ? releaseLabel
                        : selectedValue.value
                    }
                    isOpen={isValueOpen}
                    setIsOpen={setIsValueOpen}
                    reference={valueRef}
                    width="sm"
                  />
                );
              })()}
            </div>
            {selectedValue.value === APP_STRINGS.VALUE_SPRINT && (
              <div className="w-1/5">
                <DropdownButton
                  buttonLabel={`${APP_STRINGS.LABEL_SELECT_PREFIX}${
                    getBoardLabels({ projectList: getAllProjectsList || jiraData?.projectList })
                      .sprintLabel
                  }`}
                  options={getAllSprintList.map((sprint) => ({
                    value: sprint._id,
                    label: sprint.name,
                    state: sprint.state,
                  }))}
                  onSelect={handleSprintChange}
                  placeholder={APP_STRINGS.SELECT_AN_OPTION}
                  selectedOption={selectedSprint.name}
                  isOpen={isSprintOpen}
                  setIsOpen={setIsSprintOpen}
                  reference={sprintRef}
                  type={APP_STRINGS.API_SPRINT}
                  width="lg"
                />
              </div>
            )}
            {selectedValue.value === APP_STRINGS.VALUE_RELEASE && (
              <div className="w-1/5">
                <DropdownButton
                  buttonLabel={`${APP_STRINGS.LABEL_SELECT_PREFIX}${(() => {
                    const boardTypeSession = String(
                      sessionStorage.getItem(APP_STRINGS.SESSION_BOARD_TYPE) || '',
                    ).toLowerCase();
                    const hasAnyAzureBoard =
                      boardTypeSession.includes(APP_STRINGS.AZURE) ||
                      (Array.isArray(getAllProjectsList) &&
                        getAllProjectsList.some((p) => {
                          const t = String(
                            p?.boardType || p?.type || p?.projectTypeKey || '',
                          ).toLowerCase();
                          const self = String(p?.self || '').toLowerCase();
                          return (
                            t === APP_STRINGS.AZURE_BOARD ||
                            t === APP_STRINGS.AZURE_BOARD_KEBAB ||
                            t.includes(APP_STRINGS.AZURE) ||
                            self.includes(APP_STRINGS.DEV_AZURE_COM)
                          );
                        })) ||
                      (Array.isArray(jiraData?.projectList) &&
                        jiraData.projectList.some((p) => {
                          const t = String(
                            p?.boardType || p?.type || p?.projectTypeKey || '',
                          ).toLowerCase();
                          const self = String(p?.self || '').toLowerCase();
                          return (
                            t === APP_STRINGS.AZURE_BOARD ||
                            t === APP_STRINGS.AZURE_BOARD_KEBAB ||
                            t.includes(APP_STRINGS.AZURE) ||
                            self.includes(APP_STRINGS.DEV_AZURE_COM)
                          );
                        }));
                    return hasAnyAzureBoard ? APP_STRINGS.LABEL_EPIC : APP_STRINGS.VALUE_RELEASE;
                  })()}`}
                  options={getAllReleaseList.map((sprint) => ({
                    value: sprint._id,
                    label: sprint.releaseName,
                    status: sprint.status,
                  }))}
                  onSelect={handleReleaseChange}
                  placeholder={APP_STRINGS.SELECT_AN_OPTION}
                  selectedOption={selectedRelease.releaseName}
                  isOpen={isSprintOpen}
                  setIsOpen={setIsSprintOpen}
                  reference={sprintRef}
                  type={APP_STRINGS.API_RELEASE}
                  width="lg"
                />
              </div>
            )}
          </div>
        </div>
        <div className="border dark:border-[#25384F66] border-[#7896AE] rounded-lg mb-2 m-4">
          {/* Git Header with View Switching */}
          <div className="flex items-center justify-between p-4">
            <h1 className="text-2xl font-semibold dark:text-white text-[#0A2342]">Git</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center rounded-lg p-1 gap-2">
                <div className="relative group">
                  <div
                    className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 flex items-center justify-center ${
                      viewMode === APP_STRINGS.VIEW_GRID
                        ? (theme === APP_STRINGS.THEME_LIGHT ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                        : (theme === APP_STRINGS.THEME_LIGHT ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                    }`}
                    onClick={() => setViewMode(APP_STRINGS.VIEW_GRID)}
                  >
                    <GridViewIcon className={`w-5 h-5 ${viewMode === APP_STRINGS.VIEW_GRID ? 'text-white' : theme === APP_STRINGS.THEME_LIGHT ? 'text-[#7EA6CA] group-hover:text-white' : 'text-[#6C7A91]'}`} />
                  </div>
                  <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition z-50 ${theme === APP_STRINGS.THEME_LIGHT ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                    {APP_STRINGS.LABEL_GRID_VIEW}
                  </div>
                </div>
                <div className="relative group">
                  <ListViewIcon
                    className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                      viewMode === APP_STRINGS.VIEW_LIST
                        ? (theme === APP_STRINGS.THEME_LIGHT ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                        : (theme === APP_STRINGS.THEME_LIGHT ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                    }`}
                    onClick={() => setViewMode(APP_STRINGS.VIEW_LIST)}
                  />
                  <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition z-50 ${theme === APP_STRINGS.THEME_LIGHT ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                    {APP_STRINGS.LABEL_LIST_VIEW}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="px-4 p-2">{renderGitMetrics()}</div>
        </div>
      </div>
    </CommonLayout>
  );
};

export default GitDashboard;
