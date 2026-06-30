/* eslint-disable react-hooks/exhaustive-deps */
import CommonLayout from '../layout/CommonLayout';
import { useDispatch, useSelector } from 'react-redux';
import { PRColumns } from '../components/AGColumns/PRsColumn';
import { CommonFunction } from '../utils/commonFunctions';
import {
  storeBoardInSession,
  restoreBoardFromSession,
  computeProjectDisplayName,
} from '../utils/boardUtils';
import { jiraColumnDefs } from '../components/AGColumns/JiraColumn';
import DropdownButton from '../components/Common/DropDown';
import { useState, useRef, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import {
  setSelectedTypeValue,
  setSprint,
  setRelease,
  setSelectedDeveloperName,
  // setQAReferenceData,
  setStoryChurnData,
  // setBurndownData,
} from '../store/JiraSlices/jiraSlice';
import Spinner from '../components/Common/Spinner';
import { setSelectedRepository } from '../store/GitSlices/gitSlices';
import PropTypes from 'prop-types';
import Modal from '../components/Common/Modal';
import CustomEditableCellRenderer from '../components/AGColumns/CustomEditableCellRenderer';
// For testing purposes we are using unified endpoints. If they work properly, we will remove the commented imports later.
// import {
//   getId,
//   getRoleRatesAndStoryPoints,
//   getBoardList, getBurndownData, getReleaseBurndownData, getPlatformName, PR_FILTER_RANGES,
//   getStoryChurnData,
//   getStoryChurnExcludingBugs,
// } from '../constants';
import {
  getId,
  getBoardList,
  PR_FILTER_RANGES,
  getStandupDashboardData,
  APP_STRINGS,
  // getProjectManagementData,
} from '../constants';
// eslint-disable-next-line no-unused-vars
import axiosInstance from '../axiosInstance';
import { useNavigate, useLocation } from 'react-router-dom';
import SearchFloatingFilter from '../components/Common/searchFloatingFilter';
import {
  processNewBurndownData,
  processReleaseBurndownData,
} from '../utils/burndownUtils';
import '../assets/css/global.scss';
import {
  tailwindColors,
  getWorkingDaysBetweenDates,
  isNearbyMatch,
  createColorMapping,
  getStatusColor,
} from '../components/Common/standUpCommonFunctions';
import { getBoardLabels } from '../utils/boardUtils';
import {
  isBucketAssigneeName,
  isManuallyAddedCapacityRow,
  isUnassignedBucketName,
  shouldShowUnassignedCapacityApiAssignee,
} from '../utils/capacityPlanningUtils';
import QAInsights from '../components/StandUp/QAInsights';
import StandUpPRSummarySection from '../components/StandUp/StandUpPRSummarySection';
import StandUpSprintGoalSuccessSection from '../components/StandUp/StandUpSprintGoalSuccessSection';
import StandUpBurndownSection from '../components/StandUp/StandUpBurndownSection';
import StandUpJiraGraphSection from '../components/StandUp/StandUpJiraGraphSection';
import StandUpCapacitySection from '../components/StandUp/StandUpCapacitySection';
import StandUpChurnSection from '../components/StandUp/StandUpChurnSection';
import StandUpToolbarFiltersRow from '../components/StandUp/StandUpToolbarFiltersRow';
import { standUpChartSuspenseFallback as chartSuspenseFallback } from '../components/StandUp/StandUpChartSuspenseFallback';

const AGrid = lazy(() => import('../components/Common/AGgrid'));
const LazyBurnupChart = lazy(() => import('../components/StandUp/BurnupChart'));
const LazyReleaseBurndownStackedBar = lazy(() =>
  import('../components/StandUp/ReleaseBurndownStackedBar'),
);
const ChurnStoryLineChart = lazy(() =>
  import('../components/StandUp/StandUpRechartsCharts').then((m) => ({ default: m.ChurnStoryLineChart })),
);
const JiraDeveloperStatusBarChart = lazy(() =>
  import('../components/StandUp/StandUpRechartsCharts').then((m) => ({
    default: m.JiraDeveloperStatusBarChart,
  })),
);
const BurndownSprintLineChart = lazy(() =>
  import('../components/StandUp/StandUpRechartsCharts').then((m) => ({ default: m.BurndownSprintLineChart })),
);
const SprintGoalBarChart = lazy(() =>
  import('../components/StandUp/StandUpRechartsCharts').then((m) => ({ default: m.SprintGoalBarChart })),
);

function filterAssigneesForCapacityPlanView(assigneesList) {
  if (!Array.isArray(assigneesList)) return [];
  return assigneesList.filter((a) => {
    const name = String(a?.assignee || '').trim();
    if (!name) return false;
    /** Match capacity planning: Unassigned appears only when allocatedHours / SP allocation is greater than 0. */
    if (isUnassignedBucketName(name)) {
      return shouldShowUnassignedCapacityApiAssignee(a);
    }
    if (isBucketAssigneeName(name)) return false;
    if (!isManuallyAddedCapacityRow(a)) return true;
    return a.presentInPlan !== 'no' && a.presentInPlan !== false;
  });
}

function assigneeLabelIsUnassigned(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase() === 'unassigned';
}

function jiraIssuesHaveMissingAssignee(issues) {
  if (!Array.isArray(issues)) return false;
  return issues.some((issue) => {
    const a = issue?.assignee;
    if (a == null) return true;
    return typeof a === 'string' && a.trim() === '';
  });
}

function getMaxLabelLengthEstimated(data, key) {
  if (!Array.isArray(data) || data.length === 0) return 50;

  const longest = data.reduce((a, b) => ((a[key]?.length || 0) > (b[key]?.length || 0) ? a : b))[
    key
  ];

  const textLength = longest?.length || 0;

  const maxDisplayLength = Math.min(textLength, 18);
  const charWidth = 6.5;
  const estimatedWidth = maxDisplayLength * charWidth;
  const padding = 5;
  const calculatedMargin = Math.ceil(estimatedWidth + padding);

  const minMargin = 20;
  const maxMargin = 50;

  return Math.max(minMargin, Math.min(calculatedMargin, maxMargin));
}

const StandUpPage = () => {
  const [getAllProjectList, setGetAllProjectList] = useState([]);
  const [getAllSprintList, setGetAllSprintList] = useState([]);
  const [getAllReleaseList, setGetAllReleaseList] = useState([]);
  const { handleProject, handleSprint, handleRelease, handleValue, handleDeveloper, handleTeam } =
    CommonFunction();

  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isValueOpen, setIsValueOpen] = useState(false);
  const [isSprintOpen, setIsSprintOpen] = useState(false);
  const [selectedSprint, setSelectedSprint] = useState({ id: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState({ id: '', releaseName: '' });
  const [selectedValue, setSelectedValue] = useState({
    label: APP_STRINGS.SELECT_AN_OPTION,
    value: '',
  });
  const [selectedProject, setSelectedProject] = useState({ id: '', name: '' });
  const [selectedBoard, setSelectedBoard] = useState({
    id: '',
    name: '',
    type: '',
  });
  const { sprintLabel, releaseLabel, isAzure, isGitLab } = getBoardLabels();
  const selectedValueDisplay =
    selectedValue?.value === APP_STRINGS.VALUE_SPRINT
      ? sprintLabel
      : selectedValue?.value === APP_STRINGS.VALUE_RELEASE
      ? releaseLabel
      : selectedValue?.value;

  // Compute display name for selected project (includes board name if board is selected)
  const selectedProjectDisplayName = computeProjectDisplayName(selectedProject, selectedBoard);
  const [selectedRepos, setSelectedRepos] = useState([]);
  const [isRepoOpen, setIsRepoOpen] = useState(false);
  const [repoList, setRepoList] = useState([]);
  const [jiraDeveloperStatusData, setJiraDeveloperStatusData] = useState([]);
  const [value1, setValue1] = useState([null, null]);
  const [currentSprint, setCurrentSprint] = useState({});
  const [currentRelease, setCurrentRelease] = useState({});
  const [selectedDeveloper, setSelectedDeveloper] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [assigneeStoryPointList, setAssigneeStoryPointList] = useState([]);
  const [assigneeIsOpen, setAssigneeIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReleaseDate, setSelectedReleaseDate] = useState({
    id: '',
    startDate: '',
    releaseDate: '',
    overdue: false,
  });
  const [releaseDaysInfo, setReleaseDaysInfo] = useState({ remainingDays: 0 });
  const [selectedSprintEndDate, setSelectedSprintEndDate] = useState({ id: '', endDate: '' });
  const [actualSprintEndDate, setActualSprintEndDate] = useState({ id: '', completeDate: '' });
  const [sprintDaysInfo, setSprintDaysInfo] = useState({ days: 0, status: '' });
  const [isStoryPoints, setIsStoryPoints] = useState(true);
  const [actualStory, setActualStory] = useState({
    actualStoryPoints: [],
    mode: APP_STRINGS.API_SPRINT,
  });
  const [lastLoggedDate, setLastLoggedDate] = useState(null);
  const cxoData = useSelector((state) => state.cxo || {});
  const [overloadCount, setOverloadCount] = useState(0);
  const [underloadCount, setUnderloadCount] = useState(0);
  const [selectedOption, setSelectedOption] = useState('All');
  const [selectedIssueTypes, setSelectedIssueTypes] = useState({});
  const [dailyBurnup, setDailyBurnup] = useState([]);
  const [showAddedWork, setShowAddedWork] = useState(false);
  const [randomizeEnabled, setRandomizeEnabled] = useState(false);
  const [selectedSprintStartDate, setSelectedSprintStartDate] = useState({ id: '', startDate: '' });
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [sortOrder, setSortOrder] = useState('default');
  const [isHoursBasedProject, setIsHoursBasedProject] = useState(false);
  const [clearFiltersSignal, setClearFiltersSignal] = useState(0);
  const [getStoryPoints, setStoryPoints] = useState(8);
  const [prFilterType, setPrFilterType] = useState('all');
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const [remainingCapacity, setRemainingCapacity] = useState([]);
  const [statusCarouselIndex, setStatusCarouselIndex] = useState(0);
  const [statusItemsPerPage, setStatusItemsPerPage] = useState(5);
  const [visibleBadgeCount, setVisibleBadgeCount] = useState(0);
  const statusBadgesRef = useRef(null);
  const statusCarouselContainerRef = useRef(null);
  const [availableCapacity, setAvailableCapacity] = useState([]);
  const [allocatedCapacity, setAllocatedCapacity] = useState([]);
  const [isRemainingNegative, setIsRemainingNegative] = useState(false);
  const [capacityGaugeUtilization, setCapacityGaugeUtilization] = useState(0);
  const [showChurnDetails, setShowChurnDetails] = useState(false);
  const [showJiraSearch, setShowJiraSearch] = useState(false);
  const [getCapacity, setCapacity] = useState(0);
  const [excludeBugsInChurn, setExcludeBugsInChurn] = useState(() => {
    const stored = sessionStorage.getItem('excludeBugsInChurn');
    return stored === 'true';
  });
  const [repoSource, setRepoSource] = useState('');
  const jiraData = useSelector((state) => state.jira || {});
  const gitData = useSelector((state) => state.git || {});
  const pointsSourceType = useMemo(() => {
    if (isAzure) return 'effort';
    const fromApi =
      selectedValue?.value === APP_STRINGS.VALUE_SPRINT
        ? jiraData?.Sprint?.pointsSourceType
        : selectedValue?.value === APP_STRINGS.VALUE_RELEASE
        ? jiraData?.Release?.pointsSourceType
        : null;
    return fromApi ?? 'storyPoints';
  }, [selectedValue, jiraData, isAzure]);
  const [burnupModePoints, setBurnupModePoints] = useState(true);
  const todaysVelocity = jiraData?.burndownVelocity?.today ?? 0;
  const yesterdayVelocity = jiraData?.burndownVelocity?.yesterday ?? 0;
  const burndownStatus = todaysVelocity > yesterdayVelocity ? 'greatGoing' : 'moveFaster';
  const columnSelectorRef = useRef(null);
  const dispatch = useDispatch();
  const projectRef = useRef(null);
  const valueRef = useRef(null);
  const sprintRef = useRef(null);
  const repoRef = useRef(null);
  const gridApiRef = useRef(null);
  const prGridApiRef = useRef(null);
  const aGridRef = useRef(null);
  const [isUsingStoryPoints, setIsUsingStoryPoints] = useState(false);
  const [isSprintGoalStoryPoints, setIsSprintGoalStoryPoints] = useState(true);
  const lockToHours = isHoursBasedProject && pointsSourceType !== 'effort';
  const lockToPoints = !lockToHours;
  const theme = useSelector((state) => state.theme.theme);
  const [heavyChartsReady, setHeavyChartsReady] = useState(false);
  useEffect(() => {
    let idleCallbackId;
    let timeoutId;
    if (typeof window.requestIdleCallback === 'function') {
      idleCallbackId = window.requestIdleCallback(() => setHeavyChartsReady(true), {
        timeout: 2000,
      });
    } else {
      timeoutId = window.setTimeout(() => setHeavyChartsReady(true), 1);
    }
    return () => {
      if (idleCallbackId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const capacityBarSegments = useMemo(() => {
    const avail = Number(availableCapacity) || 0;
    const used = Number(allocatedCapacity) || 0;
    if (avail === 0) {
      return { greenPct: 0, redPct: 0, emptyPct: 100 };
    }
    const scale = Math.max(avail, used, 1);
    const greenPct = (Math.min(used, avail) / scale) * 100;
    const redPct = used > avail ? ((used - avail) / scale) * 100 : 0;
    const emptyPct = Math.max(0, 100 - greenPct - redPct);
    return { greenPct, redPct, emptyPct };
  }, [availableCapacity, allocatedCapacity]);

  const capacityGaugeGeom = useMemo(() => {
    const r = 40;
    const sw = 9;
    const circumference = 2 * Math.PI * r;
    const util = Math.max(0, Number(capacityGaugeUtilization) || 0);
    const greenLen = (Math.min(util, 100) / 100) * circumference;
    const redLen = util > 100 ? ((Math.min(util, 200) - 100) / 100) * circumference : 0;
    const isOverloaded = util > 100;
    let gradientRing = null;
    if (isOverloaded) {
      const totalDeg = (Math.min(util, 200) / 100) * 360;
      const transStartDeg = totalDeg * 0.72;
      const spanDeg = totalDeg - transStartDeg;
      const midOffset = spanDeg * 0.53;
      const pxScale = 88 / 104;
      const ringR = r * pxScale;
      const halfStroke = (sw / 2) * pxScale;
      const capDia = halfStroke * 2;
      const endRad = ((totalDeg % 360) * Math.PI) / 180;
      const maskInner = ((ringR - halfStroke) / 44) * 100;
      const maskOuter = ((ringR + halfStroke) / 44) * 100;
      gradientRing = {
        totalDeg,
        transStartDeg,
        midOffset,
        spanDeg,
        capDia,
        halfStroke,
        endCapX: 44 + ringR * Math.sin(endRad),
        endCapY: 44 - ringR * Math.cos(endRad),
        maskInner: maskInner.toFixed(1),
        maskInnerSoft: (maskInner + 1).toFixed(1),
        maskOuterSoft: (maskOuter - 1).toFixed(1),
        maskOuter: maskOuter.toFixed(1),
      };
    }
    return { r, circumference, greenLen, redLen, isOverloaded, gradientRing };
  }, [capacityGaugeUtilization]);

  let chartLineData = jiraData?.storyChurnData?.storyChurn?.overAllData;
  let churnTableData = jiraData?.storyChurnData?.storyChurn?.tableData;
  churnTableData = churnTableData?.map((sprint) => {
    const total = {
      issueType: 'All',
      planned: 0,
      added: 0,
      removed: 0,
      churnRate: 0,
    };
    sprint.churnData.forEach((item) => {
      total.planned += item.planned;
      total.added += item.added;
      total.removed += item.removed;
    });
    total.churnRate = total.planned
      ? parseFloat((((total.added + total.removed) / total.planned) * 100).toFixed(1))
      : 0;
    return {
      ...sprint,
      churnData: [...sprint.churnData, total],
    };
  });

  const buildInitialIssueTypesMap = useCallback(
    (tableData) => {
      const labelKey = selectedValue?.value === APP_STRINGS.VALUE_SPRINT ? APP_STRINGS.API_SPRINT : APP_STRINGS.API_RELEASE;
      return (tableData || []).reduce((acc, row) => {
        const label = row[labelKey] || row.sprint || row.release;
        acc[label] = 'All';
        return acc;
      }, {});
    },
    [selectedValue?.value],
  );

  // For testing purposes we are using this change. If this endpoint works properly, we will remove the commented code later.
  // const refetchChurn = useCallback(
  //   async (excludeBugs) => {
  //     try {
  //       const typeValue = sessionStorage.getItem('typeValue');
  //       const value = typeValue === 'Release' ? 'release' : 'sprint';
  //       const projectId = getId().projectId;
  //       const api = excludeBugs ? getStoryChurnExcludingBugs : getStoryChurnData;
  //       const response = await api({ projectId, value });
  //       dispatch(setStoryChurnData(response?.data));
  //       setSelectedIssueTypes(buildInitialIssueTypesMap(response?.data?.storyChurn?.tableData));
  //     } catch (error) {
  //       console.error('Error fetching churn data:', error);
  //     }
  //   },
  //   [buildInitialIssueTypesMap, dispatch],
  // );
  const refetchChurn = useCallback(
    async (excludeBugs) => {
      try {
        const typeValue = sessionStorage.getItem('typeValue');
        const value =
          typeValue === APP_STRINGS.VALUE_RELEASE
            ? APP_STRINGS.API_RELEASE
            : APP_STRINGS.API_SPRINT;
        const section = excludeBugs ? 'storyChurnExcludingBugs' : 'storyChurn';
        const response = await getStandupDashboardData({ value, sections: section });
        const churnData = response?.data?.[section];
        if (churnData !== undefined) {
          dispatch(setStoryChurnData(churnData));
          setSelectedIssueTypes(buildInitialIssueTypesMap(churnData?.storyChurn?.tableData));
        }
      } catch (error) {
        console.error('Error fetching churn data:', error);
      }
    },
    [buildInitialIssueTypesMap, dispatch],
  );

  const handleExcludeBugsInChurnToggle = useCallback(
    async (e) => {
      const includeBugsChecked = e.target.checked;
      const nextExclude = !includeBugsChecked;
      setExcludeBugsInChurn(nextExclude);
      sessionStorage.setItem('excludeBugsInChurn', String(nextExclude));
      setSelectedOption('All');
      setSelectedIssueTypes(buildInitialIssueTypesMap(churnTableData));

      await refetchChurn(nextExclude);
    },
    [buildInitialIssueTypesMap, churnTableData, refetchChurn],
  );

  const issueTypes = chartLineData?.length
    ? Object.keys(chartLineData[chartLineData.length - 1]).filter((key) => key !== 'label')
    : [];

  issueTypes.unshift('All');
  const createShortName = (fullName) => {
    if (fullName === 'All') return 'All';
    const words = fullName.split(/[\s_-]+/);
    if (words.length === 1) {
      return fullName.length > 6 ? fullName.substring(0, 4) + '..' : fullName;
    } else if (words.length === 2) {
      const firstWord = words[0];
      const secondWordFirstLetter = words[1].charAt(0).toUpperCase();
      return firstWord + '.' + secondWordFirstLetter;
    } else {
      return words.map((word) => word.charAt(0).toUpperCase()).join('.');
    }
  };

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;

    const labelKey = selectedValue?.value === APP_STRINGS.VALUE_SPRINT ? APP_STRINGS.API_SPRINT : APP_STRINGS.API_RELEASE;

    const initialTypes = (churnTableData || []).reduce((acc, row) => {
      const label = row[labelKey] || row.sprint || row.release;
      acc[label] = 'All';
      return acc;
    }, {});

    setSelectedIssueTypes(initialTypes);
    initializedRef.current = true;
  }, [churnTableData, selectedValue]);

useEffect(() => {
  setIsStoryPoints(lockToPoints);
  setBurnupModePoints(lockToPoints);
  setIsSprintGoalStoryPoints(lockToPoints);
}, [lockToPoints]);

  const handleIssueTypeChange = ({ data, newValue }) => {
    const labelKey = selectedValue?.value === APP_STRINGS.VALUE_SPRINT ? APP_STRINGS.API_SPRINT : APP_STRINGS.API_RELEASE;
    const label = data[labelKey];

    setSelectedIssueTypes((prev) => ({
      ...prev,
      [label]: newValue,
    }));
  };
  const transformedRowData = useMemo(() => {
    if (!Array.isArray(churnTableData)) return [];

    const labelKey = selectedValue?.value === APP_STRINGS.VALUE_SPRINT ? APP_STRINGS.API_SPRINT : APP_STRINGS.API_RELEASE;
    return churnTableData.map((row) => {
      const label = row[labelKey] || row.sprint || row.release;
      const selected = selectedIssueTypes[label];
      const data = row.churnData.find((item) => item.issueType === selected) || {};
      return {
        [labelKey]: label,
        issueType: selected,
        planned: data.planned ?? 0,
        added: data.added ?? 0,
        removed: data.removed ?? 0,
        churnRate: data.churnRate ?? 0,
        issueTypeOptions: row.churnData.map((i) => i.issueType),
      };
    });
  }, [churnTableData, selectedIssueTypes, selectedValue]);

  const StoryChurnColumns = [
    {
      headerName:
        selectedValue?.value === APP_STRINGS.VALUE_RELEASE
          ? String(releaseLabel).toUpperCase()
          : String(sprintLabel).toUpperCase(),
      field:
        selectedValue?.value === APP_STRINGS.VALUE_RELEASE
          ? APP_STRINGS.API_RELEASE
          : APP_STRINGS.API_SPRINT,
      filter: false,
    },
    {
      headerName: 'ISSUE TYPE',
      field: 'issueType',
      cellRenderer: CustomEditableCellRenderer,
      cellRendererParams: { issueTypes },
      filter: false,
      maxWidth: 125,
    },
    { headerName: 'PLANNED', field: 'planned', filter: false, maxWidth: 130 },
    { headerName: 'ADDED', field: 'added', filter: false, maxWidth: 130 },
    { headerName: 'REMOVED', field: 'removed', filter: false, maxWidth: 130 },
    {
      headerName: 'CHURN (%)',
      field: 'churnRate',
      valueFormatter: (params) => {
        const planned = Number(params.data?.planned);
        if (planned === 0) {
          return 'N/A';
        }
        const added = Number(params.data?.added ?? 0);
        const removed = Number(params.data?.removed ?? 0);
        if (added === 0 && removed === 0) {
          return 'N/A';
        }
        const value = Number(params.value);
        return isNaN(value) ? 'N/A' : value.toFixed(1);
      },
      filter: false,
      maxWidth: 120,
    },
  ];
  const IssueTypeDropdown = ({ data }) => {
    return (
      <select
        value={data.issueType}
        onChange={(e) => {
          const labelKey = selectedValue?.value === APP_STRINGS.VALUE_SPRINT ? APP_STRINGS.API_SPRINT : APP_STRINGS.API_RELEASE;
          const label = data[labelKey];
          setSelectedIssueTypes((prev) => ({
            ...prev,
            [label]: e.target.value,
          }));
        }}
        className={`${
          theme === 'light'
            ? 'bg-[#F0F4F8] text-[#24527A] border border-[#D1E2F0]'
            : 'bg-[#0e2439] text-white'
        } rounded px-2 py-[2px]`}
      >
        {data.issueTypeOptions.map((type) => (
          <option
            key={type}
            value={type}
            className={theme === 'light' ? 'text-[#24527A]' : 'text-white'}
          >
            {type}
          </option>
        ))}
      </select>
    );
  };

  IssueTypeDropdown.propTypes = {
    data: PropTypes.shape({
      sprint: PropTypes.string.isRequired,
      issueType: PropTypes.string.isRequired,
      issueTypeOptions: PropTypes.arrayOf(PropTypes.string).isRequired,
    }).isRequired,
  };

  const initialStoryPoint = jiraData?.Sprint?.committedVsCompletedMetrics?.initialStoryPoints || 0;
  const initialHours =
    jiraData?.Sprint?.committedVsCompletedMetrics?.initialOriginalEstimateHrs || 0;
  const spilloverStoryPoints = jiraData?.Sprint?.committedVsCompletedMetrics?.spilloverStoryPoints ?? 0;
  const spilloverHours = jiraData?.Sprint?.committedVsCompletedMetrics?.spilloverHours ?? 0;
  const companyId = getId().companyId;
  const navigate = useNavigate();
  const location = useLocation();
  const newBurndownData = jiraData?.burndownData;

  // Scroll to jira table when navigating with #jira-table hash (e.g. from Release Dashboard Open Issues link)
  useEffect(() => {
    if (location.hash === '#jira-table') {
      const timer = setTimeout(() => {
        document.getElementById('jira-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [location.hash]);

  // Filter from Release Dashboard (Open Issues / Critical / View Blockers): filter Jira table by issue keys or type
  const [navigationJiraFilter, setNavigationJiraFilter] = useState(null);
  useEffect(() => {
    const filter = location.state?.jiraTableFilter;
    if (filter && (filter.issueKeys?.length || filter.filterType)) {
      setNavigationJiraFilter(filter);
    }
  }, [location.state]);

  const isReleaseSelected = selectedValue?.value === APP_STRINGS.VALUE_RELEASE;

  useEffect(() => {
    const hasSelection = selectedValue?.value === APP_STRINGS.VALUE_RELEASE
      ? !!selectedRelease?.id
      : !!selectedSprint?.id;
    if (!hasSelection) {
      setCapacity(0);
      return;
    }
    const currentData = selectedValue?.value === APP_STRINGS.VALUE_RELEASE
      ? (jiraData?.Release ?? jiraData?.Sprint)
      : (jiraData?.Sprint ?? jiraData?.Release);
    const assigneesList = currentData?.assignees || [];
    const capacityPlanAssignees = filterAssigneesForCapacityPlanView(assigneesList);
    const allNetAvailableZeroOrMissing = capacityPlanAssignees.every(
      (item) =>
        item.netAvailableCapacity === undefined ||
        item.netAvailableCapacity === null ||
        item.netAvailableCapacity === 0,
    );
    const totalCapacity = capacityPlanAssignees.reduce((sum, item) => {
      if (allNetAvailableZeroOrMissing) {
        return sum + Number(item.availableHours || 0);
      }
      return sum + Number(item.netAvailableCapacity || 0);
    }, 0);

    setCapacity(totalCapacity);
  }, [jiraData, selectedValue, selectedSprint, selectedRelease]);

  const processBurndownData = () => {
    const isReleaseMode = selectedValue?.value === APP_STRINGS.VALUE_RELEASE;
    const hasSelection = isReleaseMode ? !!selectedRelease?.id : !!selectedSprint?.id;
    if (!hasSelection) return [];

    const hasNewReleaseData = newBurndownData?.sprintBreakdown && 
                               Array.isArray(newBurndownData.sprintBreakdown) &&
                               newBurndownData.sprintBreakdown.length > 0;

    if (isReleaseMode && hasNewReleaseData) {
      return processReleaseBurndownData(newBurndownData);
    }

    if (Array.isArray(newBurndownData?.dailyData) && newBurndownData.dailyData.length > 0) {
      return processNewBurndownData({
        burndownData: newBurndownData,
        isStoryPoints,
        jiraData,
        selectedDeveloper,
        getCapacity,
        lastLoggedDate,
      });
    }

    return [];
  };

  const burndownChartData = processBurndownData();

  const initialEffortByDevMemo = useMemo(() => {
    return jiraData?.Sprint?.idealBurnupByDev || jiraData?.Release?.idealBurnupByDev || [];
  }, [jiraData?.Sprint?.idealBurnupByDev, jiraData?.Release?.idealBurnupByDev]);

  const jiraTableData = jiraData?.jiraTableData;
  const storyChurnData = jiraData?.storyChurnData || [];

  const openPrData = (() => {
    const prsData = jiraTableData?.PRsData || [];

    if (selectedRepos.length === 0 || selectedRepos.length === repoList.length) {
      const aggregatedData = prsData.reduce((acc, prGroup) => {
        return {
          repo: 'All Repositories',
          openReviewedPRs: (acc.openReviewedPRs || 0) + (prGroup.openReviewedPRs || 0),
          openUnreviewedPRs: (acc.openUnreviewedPRs || 0) + (prGroup.openUnreviewedPRs || 0),
          totalMergedPRs: (acc.totalMergedPRs || 0) + (prGroup.totalMergedPRs || 0),
          closedPrs: (acc.closedPrs || 0) + (prGroup.closedPrs || 0),
          totalPrs: (acc.totalPrs || 0) + (prGroup.totalPrs || 0),
          averageTimeToMergeForReviewedPRs:
            acc.averageTimeToMergeForReviewedPRs ||
            prGroup.averageTimeToMergeForReviewedPRs ||
            '0 hrs 0m',
        };
      }, {});
      return aggregatedData;
    } else {
      const filteredData = prsData.filter((prGroup) =>
        selectedRepos.some((repo) => prGroup?.repo?.toLowerCase() === repo.toLowerCase()),
      );

      if (filteredData.length === 1) {
        return filteredData[0];
      } else if (filteredData.length > 1) {
        return filteredData.reduce((acc, prGroup) => {
          return {
            repo: selectedRepos.join(', '),
            openReviewedPRs: (acc.openReviewedPRs || 0) + (prGroup.openReviewedPRs || 0),
            openUnreviewedPRs: (acc.openUnreviewedPRs || 0) + (prGroup.openUnreviewedPRs || 0),
            totalMergedPRs: (acc.totalMergedPRs || 0) + (prGroup.totalMergedPRs || 0),
            closedPrs: (acc.closedPrs || 0) + (prGroup.closedPrs || 0),
            totalPrs: (acc.totalPrs || 0) + (prGroup.totalPrs || 0),
            averageTimeToMergeForReviewedPRs:
              acc.averageTimeToMergeForReviewedPRs ||
              prGroup.averageTimeToMergeForReviewedPRs ||
              '0 hrs 0m',
          };
        }, {});
      } else {
        return {};
      }
    }
  })();


  const rowData = useMemo(() => {
    return (
      jiraTableData?.issues?.map((issue) => {
        const pullRequests = Array.isArray(issue.pullRequests) ? issue.pullRequests : [];
        const prId = pullRequests.length ? pullRequests.map((pr) => pr.prNumber).join(', ') : 'NA';
        return {
          jiraTicket: issue.key,
          type: issue.type !== 'NA' ? issue.type : 'NA',
          prId,
          dueDate:
            issue.duedate !== 'NA'
              ? new Date(issue.duedate).toISOString().split('T')[0]
              : 'No Due Date',
          sprintOutcome: issue.sprintOutcome || { spilledOver: null, sprintNames: [] },
          status: issue.status || 'No Status',
          summary: issue.summary || 'No Summary',
          assignedTo: issue.assignee || 'Unassigned',
          blocker: issue.blockedBy || 'No blocker',
          priority: issue.priority,
          severity:issue.severity ?? 'NA',
          jiraUrl: issue.jiraUrl,
          storyPoints: issue.storyPoints || 0,
          originalEstimate: issue.originalEstimate || 0,
          developer: issue.developer || 'Unassigned',
          epic: issue.epic || 'No Epic',
          labels: issue.labels || 'No Label',
          timeSpent: issue.timeSpent || 0,
          cycleTime: issue.cycleTime || '0d',
          backflowRate: issue.backflowRate || 0,
          customFields: issue.customFields || {},
          customFieldsByName: issue.customFieldsByName || {},
        };
      }) || []
    );
  }, [jiraTableData?.issues]);

  // Apply filter from Release Dashboard (issue keys or filterType: openIssues / critical / blockers)
  const rowDataAfterNavFilter = useMemo(() => {
    if (!navigationJiraFilter || !rowData?.length) return rowData;
    const keys = navigationJiraFilter.issueKeys;
    if (Array.isArray(keys) && keys.length > 0) {
      const keySet = new Set(keys.map((k) => String(k).toUpperCase()));
      return rowData.filter((row) => row?.jiraTicket && keySet.has(String(row.jiraTicket).toUpperCase()));
    }
    const type = navigationJiraFilter.filterType;
    if (type === 'openIssues') {
      return rowData.filter((row) => row?.status !== 'Done' && row?.status !== 'Closed');
    }
    if (type === 'critical') {
      return rowData.filter((row) => String(row?.priority || '').toLowerCase() === 'critical');
    }
    if (type === 'blockers') {
      return rowData.filter((row) => row?.blocker && row.blocker !== 'No blocker');
    }
    return rowData;
  }, [rowData, navigationJiraFilter]);

  // When navigated from Release page with filter: status badges show counts from filtered table only
  const statusDistributionFromFilteredRows = useMemo(() => {
    if (!navigationJiraFilter || !rowDataAfterNavFilter?.length) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const statusCounts = {};
    let overdueCount = 0;
    rowDataAfterNavFilter.forEach((row) => {
      const status = row?.status || 'No Status';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      const dueDate = new Date(row.dueDate);
      if (
        row.dueDate !== 'No Due Date' &&
        dueDate < today &&
        row.status !== 'Done' &&
        row.status !== 'Closed'
      ) {
        overdueCount += 1;
      }
    });
    const list = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));
    if (overdueCount > 0) {
      list.push({ status: 'Overdue', count: overdueCount });
    }
    return list;
  }, [navigationJiraFilter, rowDataAfterNavFilter]);

  const assigneeStoryPoints = {};
  jiraTableData?.issues?.forEach((item) => {
    const assignee = item.assignee || 'UnAssigned';
    const storyPoints = isNaN(item.storyPoints) ? 0 : Number(item.storyPoints);

    if (!assigneeStoryPoints[assignee]) {
      assigneeStoryPoints[assignee] = {
        committed: 0,
        completed: 0,
      };
    }

    if (item.status === 'Closed') {
      assigneeStoryPoints[assignee].completed += storyPoints;
    } else {
      assigneeStoryPoints[assignee].committed += storyPoints;
    }
  });

  Object.keys(assigneeStoryPoints).forEach((assignee) => {
    const { committed, completed } = assigneeStoryPoints[assignee];
    assigneeStoryPoints[assignee].remaining = Math.max(committed - completed, 0);
  });

  assigneeStoryPointList.forEach((item) => {
    if (assigneeStoryPoints[item.assignee]) {
      assigneeStoryPoints[item.assignee].allocatedStoryPoints = item.allocatedStoryPoints;
    }
  });

  const prRowData = (jiraTableData?.issues || [])
    .flatMap((issue) => {
      const pullRequests = Array.isArray(issue.pullRequests) ? issue.pullRequests : [];
      return pullRequests
        .map((pr) => {
          const isBySelectedDev = selectedDeveloper
            ? isNearbyMatch(selectedDeveloper, pr.prCreatedBy)
            : true;

          const isInSelectedRepo =
            selectedRepos.length === 0 ||
            selectedRepos.some((repo) => pr?.repo?.toLowerCase() === repo.toLowerCase());

          if (!isBySelectedDev || !isInSelectedRepo) return null;

          let daysOpenValue = 0;
          let daysOpenDisplay = 'NA';
          if (pr.daysOpen !== undefined && pr.daysOpen !== null && pr.daysOpen !== 'NA') {
            if (typeof pr.daysOpen === 'number') {
              daysOpenValue = pr.daysOpen;
              daysOpenDisplay = `${daysOpenValue}`;
            } else if (typeof pr.daysOpen === 'string') {
              const match = pr.daysOpen.match(/\d+/);
              if (match) {
                daysOpenValue = parseInt(match[0], 10);
                daysOpenDisplay = pr.daysOpen;
              }
            }
          } else if (pr.createdAt || pr.prCreatedAt || pr.created_at) {
            const createdAt = pr.createdAt || pr.prCreatedAt || pr.created_at;
            const createdDate = new Date(createdAt);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            createdDate.setHours(0, 0, 0, 0);
            const diffTime = today - createdDate;
            daysOpenValue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            daysOpenDisplay = daysOpenValue >= 0 ? `${daysOpenValue}` : '0';
          }

          
          const reviewerCount = pr.prReviews?.length ?? 0;
          const reviewerText = reviewerCount > 0
            ? pr.prReviews.map((r) => r.reviewerUsername).join(', ')
            : 'NA';

          let reviewerRange = PR_FILTER_RANGES.REVIEWER.NO_REVIEWERS;
          if (reviewerCount === 1) {
            reviewerRange = PR_FILTER_RANGES.REVIEWER.ONE_REVIEWER;
          } else if (reviewerCount >= 2 && reviewerCount <= 3) {
            reviewerRange = PR_FILTER_RANGES.REVIEWER.TWO_TO_THREE_REVIEWERS;
          } else if (reviewerCount >= 4) {
            reviewerRange = PR_FILTER_RANGES.REVIEWER.FOUR_PLUS_REVIEWERS;
          }

          const filesChanged = pr.filesChanged || 0;
          

          return {
            prId: pr.prNumber,
            title: pr.prTitle !== 'NA' ? pr.prTitle : 'No PR',
            author: pr.prCreatedBy || 'NA',
            status: pr.prStatus || 'No Status',
            daysOpen: daysOpenDisplay,
            daysOpenRange: daysOpenValue, // For filtering
            daysOpenValue: daysOpenValue, // For sorting
            reviewer: reviewerText,
            reviewerRange: reviewerRange, // For filtering
            reviewerCount: reviewerCount, // For sorting
            codeChanges: filesChanged,
            filesChangedRange: filesChanged, // For filtering
            branch: pr.branchName !== 'NA' ? pr.branchName : 'No Branch',
            prUrl: pr.prUrl,
            repo: pr.repo || 'NA',
            merged: ['true', 'merged'].includes(pr?.merged?.toString()?.toLowerCase())
              ? 'Yes'
              : 'No',
            isReviewed: Array.isArray(pr.prReviews) && pr.prReviews.length > 0,
          };
        })
        .filter(Boolean);
    })
    .filter((pr) => {
      if (prFilterType === 'openReviewed') {
        return ['open', 'opened'].includes(pr.status) && pr.isReviewed;
      }
      if (prFilterType === 'openUnreviewed') {
        return ['open', 'opened'].includes(pr.status) && !pr.isReviewed;
      }
      if (prFilterType === 'merged') return pr.merged === 'Yes';
      if (prFilterType === 'totalOpenPRs') return ['open', 'opened'].includes(pr.status);
      if (prFilterType === 'closedPrs') {
        return pr.status === 'closed' && pr.merged === 'No';
      }
      return true;
    });

  const filteredPRColumns = PRColumns(jiraTableData?.sourceManagement);

  const statusDistribution = jiraData?.taskCountData?.find((item) => item.statusDistribution)
    ?.statusDistribution?.result;

  const result = Object.entries(jiraDeveloperStatusData).map(([status, count], index) => ({
    status,
    count,
    color: tailwindColors[index % tailwindColors.length],
  }));

  const statusData = useMemo(() => {
    return statusDistribution
      ? statusDistribution.map((item, index) => ({
          status: item.name,
          count: item.count,
          color: tailwindColors[index % tailwindColors.length],
        }))
      : [];
  }, [statusDistribution]);

  const barChartData = useMemo(() => {
    return (selectedDeveloper ? result : statusData) || [];
  }, [selectedDeveloper, result, statusData]);

  const statusColorMap = useMemo(() => {
    return createColorMapping(barChartData);
  }, [barChartData]);

  const sortedBarChartData = useMemo(() => {
    if (sortOrder === 'default') {
      return barChartData;
    }

    return [...barChartData].sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.count - b.count;
      } else if (sortOrder === 'desc') {
        return b.count - a.count;
      }
      return 0;
    });
  }, [barChartData, sortOrder]);

  const statusBarLeftMargin = useMemo(
    () => getMaxLabelLengthEstimated(sortedBarChartData, 'status'),
    [sortedBarChartData],
  );

  const getStoryPointData = jiraData?.getStoryPointData;
  const getCommittedData = getStoryPointData?.lastFiveData;

  const sprintdata = useMemo(() => {
    return Array.isArray(getCommittedData)
      ? getCommittedData.map((item) => {
          const { name, committedVsCompletedMetrics } = item;
          return {
            sprint: name,
            committed: committedVsCompletedMetrics?.committedStoryPoints ?? 0,
            committedHours: committedVsCompletedMetrics?.committedHours ?? 0,
            completed: committedVsCompletedMetrics?.completedStoryPoints ?? 0,
            completedHours: committedVsCompletedMetrics?.completedHours ?? 0,
          };
        })
      : [];
  }, [getCommittedData]);

  const sprintGoalRechartsPayload = useMemo(() => {
    const chartData = sprintdata.map((item) => ({
      ...item,
      committedDynamic: isSprintGoalStoryPoints ? item.committed : item.committedHours,
      completedDynamic: isSprintGoalStoryPoints ? item.completed : item.completedHours,
    }));
    const maxValue = Math.max(
      ...chartData.flatMap((item) => [item.committedDynamic, item.completedDynamic]),
      1,
    );
    const length = sprintdata.length;
    const gaps = {
      1: '20%',
      2: '30%',
      3: '35%',
      4: '38%',
      5: '40%',
    };
    const barCategoryGap = gaps[length] || '40%';
    return { chartData, maxValue, barCategoryGap };
  }, [sprintdata, isSprintGoalStoryPoints]);

  useEffect(() => {
    if (jiraData) {
      setJiraDeveloperStatusData(jiraData.jiraStatusByDeveloper || []);
      setSelectedDeveloper(jiraData.selectedDeveloperName?.value || '');
      const selectedProjects = (jiraData.projectList || []).filter(
        (project) => project.isSelected && project.hideStatus === false,
      );
      setGetAllProjectList(selectedProjects);
    }
  }, [jiraData]);

  const handleProjectChange = async (value) => {
    try {
      setSelectedStatuses([]);
      setShowJiraSearch(false);
      setVisibleColumns(fullColumnDefs.filter((col) => !col.optional).map((col) => col.field));
      setIsColumnSelectorOpen(false);
      setPrFilterType('all');
      setSelectedOption('All');

      // Reset board selection when project changes
      setIsBoardOpen(false);
      setSubMenuBoards([]);
      setCurrentProjectForBoard(null);
      setSelectedBoard({ id: '', name: '', type: '' });
      sessionStorage.removeItem('boardId');

      // Fetch boards for the selected project first
      const companyId = getId().companyId;
      const boards = await fetchBoardList(companyId, value);
      
      if (!fetchedProjectIdsRef.current.has(value)) {
        fetchedProjectIdsRef.current.add(value);
        setProjectBoardCount(prev => ({
          ...prev,
          [value]: boards.length
        }));
      }

      // If project has multiple boards, show board selection and auto-select first board
      if (boards.length > 1) {
        // Close submenu immediately when project is clicked
        setIsBoardOpen(false);
        setSubMenuBoards([]);
        setCurrentProjectForBoard(null);

        // Auto-select the first board as fallback
        const firstBoard = boards[0];
        const boardId = firstBoard?.id || firstBoard?._id || '';

        // Find the project details and set selectedProject
        const project = getAllProjectList?.find((p) => p._id === value);
        if (project) {
          setSelectedProject({
            id: project._id,
            name: project.name,
          });

          // Set the first board as selected
          setSelectedBoard({
            id: boardId,
            name: firstBoard?.name || firstBoard?.boardName || '',
            type: firstBoard?.type || firstBoard?.boardType || '',
          });

          // Store boardId in sessionStorage FIRST before making API calls
          sessionStorage.setItem('boardId', boardId);

          // Store board information in sessionStorage for persistence
          storeBoardInSession(
            boardId,
            firstBoard?.name || firstBoard?.boardName || '',
            firstBoard?.type || firstBoard?.boardType || '',
          );

          // Proceed with normal project selection AFTER boardId is stored
          await handleProject(value, firstBoard?.type || firstBoard?.boardType || '', dispatch);
        }

        setClearFiltersSignal((s) => s + 1);
        return; // Don't proceed with the single board logic below
      }

      // Find the project details and set selectedProject
      const project = getAllProjectList?.find((p) => p._id === value);
      if (project) {
        setSelectedProject({
          id: project._id,
          name: project.name,
        });

        // Set the board information if available
        if (boards[0]) {
          const boardId = boards[0]?.id || boards[0]?._id || '';
          setSelectedBoard({
            id: boardId,
            name: boards[0]?.name || boards[0]?.boardName || '',
            type: boards[0]?.type || boards[0]?.boardType || '',
          });

          // Store boardId in sessionStorage FIRST before making API calls
          sessionStorage.setItem('boardId', boardId);

          // Store board information in sessionStorage for persistence
          storeBoardInSession(
            boardId,
            boards[0]?.name || boards[0]?.boardName || '',
            boards[0]?.type || boards[0]?.boardType || '',
          );
        }

        // Proceed with normal project selection AFTER boardId is stored
        await handleProject(value, boards[0]?.type || boards[0]?.boardType || '', dispatch);
      }

      setClearFiltersSignal((s) => s + 1);
    } catch (error) {
      console.error('Error handling project selection:', error);
    }
  };

  // Function to fetch board list for a project
  const fetchBoardList = async (companyId, projectId) => {
    try {
      const cachedBoards = jiraData?.boardList;
      if (cachedBoards?.length > 0 && projectId === jiraData?.selectedProjectId) {
        return cachedBoards;
      }
      const response = await getBoardList(companyId, projectId);
      let boards = [];
      if (response.data) {
        boards = Array.isArray(response.data) ? response.data : [];
      } else if (Array.isArray(response)) {
        boards = response;
      }
      return boards;
    } catch (error) {
      console.error('Error fetching board list:', error);
      return [];
    }
  };

  // Function to handle board selection
  const handleBoardChange = async (boardId, projectId) => {
    try {
      const selectedBoardData = subMenuBoards.find((board) => (board.id || board._id) === boardId);
      if (selectedBoardData) {
        const currentProject = getAllProjectList?.find((project) => project._id === projectId);
        if (currentProject) {
          sessionStorage.setItem('boardId', boardId || '');
          storeBoardInSession(
            boardId || '',
            selectedBoardData.name || selectedBoardData.boardName || '',
            selectedBoardData.type || selectedBoardData.boardType || '',
          );
          setSelectedProject({
            id: currentProject._id,
            name: currentProject.name,
          });
          setSelectedBoard({
            id: boardId || '',
            name: selectedBoardData.name || selectedBoardData.boardName || '',
            type: selectedBoardData.type || selectedBoardData.boardType || '',
          });
          const boardType = selectedBoardData.type || selectedBoardData.boardType;
          await handleProject(projectId, boardType, dispatch);
        }
        setIsBoardOpen(false);
        setSubMenuBoards([]);
        setCurrentProjectForBoard(null);
        setClearFiltersSignal((s) => s + 1);
      }
    } catch (error) {
      console.error('Error handling board selection:', error);
    }
  };

  const handleProjectHover = async (projectId) => {
    try {
        setIsBoardOpen(false);
        setSubMenuBoards([]);
        setCurrentProjectForBoard(null);
        await new Promise((resolve) => setTimeout(resolve, 50));
        const companyId = getId().companyId;       
        const boards = await fetchBoardList(companyId, projectId);        
        if (!fetchedProjectIdsRef.current.has(projectId)) {
          fetchedProjectIdsRef.current.add(projectId);
          setProjectBoardCount(prev => ({
            ...prev,
            [projectId]: boards.length
          }));
        }
        
        if (boards.length > 1) {
          const hoveredElement = document.querySelector(`[data-project-id="${projectId}"]`);
          if (hoveredElement) {
            const rect = hoveredElement.getBoundingClientRect();
            setSubMenuPosition({
              top: rect.top,
              left: rect.right + 10,
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
          setCurrentProjectForBoard(null);
        }
      } catch (error) {
        console.error('Error handling project hover:', error);
      }
  };

  const handleProjectMouseLeave = () => {
    setTimeout(() => {
      const submenuElement = document.querySelector('.board-submenu');
      const allProjectElements = document.querySelectorAll('[data-project-id]');
      let isHoveringOverProject = false;
      allProjectElements.forEach((element) => {
        if (element.matches(':hover')) {
          isHoveringOverProject = true;
        }
      });

      if (submenuElement && !submenuElement.matches(':hover') && !isHoveringOverProject) {
        setIsBoardOpen(false);
        setSubMenuBoards([]);
        setCurrentProjectForBoard(null);
      }
    }, 150);
  };

  const getChurnData = (
    churnTableData,
    selectedValue,
    selectedIssueType,
    selectedSprint,
    selectedRelease,
  ) => {
    if (!selectedValue || !selectedIssueType) return null;
    let entry = null;

    if (selectedValue.value === APP_STRINGS.VALUE_SPRINT && selectedSprint?.name) {
      entry = churnTableData?.find((e) => e.sprint === selectedSprint.name);
    } else if (selectedValue.value === APP_STRINGS.VALUE_RELEASE && selectedRelease?.releaseName) {
      entry = churnTableData?.find((e) => e.release === selectedRelease.releaseName);
    }

    if (!entry) return null;

    const churnEntry = entry?.churnData?.find((d) => d.issueType === selectedIssueType);
    if (!churnEntry) return null;
    return {
      churnRate: churnEntry.churnRate ?? null,
      planned: churnEntry.planned ?? 0,
      added: churnEntry.added ?? 0,
      removed: churnEntry.removed ?? 0,  
    };
  };

  const handleSprintChange = async (value) => {
    try {
      await handleSprint(value, dispatch);
      setClearFiltersSignal((s) => s + 1);
      const selectedSprint = getAllSprintList.find((sprint) => sprint._id === value);
      if (!selectedSprint) {
        console.warn('Selected sprint not found in sprint list');
        return;
      }
      sessionStorage.setItem('sprintId', selectedSprint._id);
      sessionStorage.setItem('sprintStartDate', selectedSprint.startDate);
      sessionStorage.setItem('sprintEndDate', selectedSprint.endDate);
      setSelectedSprint({ id: selectedSprint._id, name: selectedSprint.name });
      const startDate = new Date(selectedSprint.startDate);
      const formattedStartDate = startDate.toLocaleDateString('en-IN');
      setSelectedSprintStartDate({ id: selectedSprint._id, startDate: formattedStartDate });
      const endDate = new Date(selectedSprint.endDate);
      const formattedEndDate = endDate.toLocaleDateString('en-IN');
      setSelectedSprintEndDate({ id: selectedSprint._id, endDate: formattedEndDate });
      setIsSprintOpen(false);
      setPrFilterType('all');
      setSelectedOption('All');
    } catch (error) {
      console.error('Error handling sprint selection:', error);
    }
  };

  const handleReleaseChange = async (value) => {
    try {
      await handleRelease(value, dispatch);
      setClearFiltersSignal((s) => s + 1);
      const releaseSelected = getAllReleaseList.find((release) => release._id === value);
      if (!releaseSelected) {
        console.warn('Selected release not found in list');
        return;
      }
      sessionStorage.setItem('releaseName', releaseSelected.releaseName);
      sessionStorage.setItem('releaseDate', releaseSelected.releaseDate);
      setSelectedRelease({ id: releaseSelected._id, releaseName: releaseSelected.releaseName });
      const formattedReleaseDate = releaseSelected.releaseDate
        ? new Date(releaseSelected.releaseDate).toLocaleDateString('en-IN')
        : 'NA';
      const formattedReleaseStartDate = releaseSelected.startDate
        ? new Date(releaseSelected.startDate).toLocaleDateString('en-IN')
        : 'NA';
      setSelectedReleaseDate({
        id: releaseSelected._id,
        startDate: formattedReleaseStartDate,
        releaseDate: formattedReleaseDate,
        overdue: releaseSelected.overdue,
      });
      setPrFilterType('all');
      setSelectedOption('All');
      setIsSprintOpen(false);
    } catch (error) {
      console.error('Error handling release selection:', error);
    }
  };

  const handleRepoChange = async (selectedReposList) => {
    try {
      setSelectedRepos(selectedReposList);
      const primaryRepo = selectedReposList.length > 0 ? selectedReposList[0] : '';
      sessionStorage.setItem('repo', primaryRepo);
      dispatch(setSelectedRepository(primaryRepo));
      setPrFilterType('all');
      setSelectedOption('All');
    } catch (error) {
      console.error('Error handling repo selection:', error);
    }
  };

  const handleValueChange = (value) => {
    handleValue(value, dispatch);
    setSelectedValue(value);
    dispatch(setSelectedTypeValue({ selectedValueLabel: value.label, selectedValue: value.value }));
    dispatch(setSprint(null));
    dispatch(setRelease(null));
    setIsValueOpen(false);
    setSelectedOption('All');
    if (value !== APP_STRINGS.API_SPRINT) {
      setSelectedSprint({ id: '', name: '' });
    }
    if (value?.value !== APP_STRINGS.VALUE_SPRINT) {
      setSelectedSprint({ id: '', name: '' });
    }
    const labelKey =
      value?.value === APP_STRINGS.VALUE_SPRINT
        ? APP_STRINGS.API_SPRINT
        : APP_STRINGS.API_RELEASE;
    const initialTypes = (churnTableData || []).reduce((acc, row) => {
      const label = row[labelKey] || row.sprint || row.release;
      acc[label] = 'All';
      return acc;
    }, {});
    setSelectedIssueTypes(initialTypes);
  };

  const handleDateChange = (newValue) => {
    setValue1(newValue);
  };

  const handleTeamClick = async () => {
    setSelectedStatuses([]);
    setSelectedDeveloper(null);
    dispatch(setSelectedDeveloperName(null));
    setPrFilterType('all');
    setSelectedOption('All');
    sessionStorage.removeItem('developer');
    setClearFiltersSignal((s) => s + 1);
    try {
      await handleTeam(null, dispatch);
    } catch (error) {
      console.error('Error handling Team selection:', error);
    }
  };

  const dropdownRef = useRef(null);

  const filteredDevelopers =
    assignees.filter((dev) => dev?.toLowerCase().includes(searchTerm?.toLowerCase())) || [];

  const getDisplayedDevelopers = () => {
    if (randomizeEnabled) {
      return [...filteredDevelopers].sort(() => Math.random() - 0.5);
    } else {
      return [...filteredDevelopers].sort((a, b) => a.localeCompare(b));
    }
  };

  const displayedDevelopers = getDisplayedDevelopers();

  const handleDeveloperSelect = async (developer) => {
    setSelectedStatuses([]);
    setSelectedDeveloper(developer);
    dispatch(setSelectedDeveloperName(developer));
    setAssigneeIsOpen(false);
    setSearchTerm('');
    setPrFilterType('all');
    setSelectedOption('All');
    try {
      await handleDeveloper(developer, dispatch);
      setClearFiltersSignal((s) => s + 1);
    } catch (error) {
      console.error('Error handling developer selection:', error);
    }
  };

  const toggleRandomize = () => {
    setRandomizeEnabled(!randomizeEnabled);
  };

  const handleViewCapacityDetails = () => {
    navigate('/capacityPlanning');
  };

  const handleCloseDetails = () => {
    setShowChurnDetails(false);
    const labelKey = selectedValue?.value === APP_STRINGS.VALUE_SPRINT ? APP_STRINGS.API_SPRINT : APP_STRINGS.API_RELEASE;
    const initialTypes = (churnTableData || []).reduce((acc, row) => {
      const label = row[labelKey] || row.sprint || row.release;
      acc[label] = 'All';
      return acc;
    }, {});
    setSelectedIssueTypes(initialTypes);
  };

  const handleViewChurnDetails = () => {
    setShowChurnDetails(true);
    const labelKey = selectedValue?.value === APP_STRINGS.VALUE_SPRINT ? APP_STRINGS.API_SPRINT : APP_STRINGS.API_RELEASE;
    const initialTypes = (churnTableData || []).reduce((acc, row) => {
      const label = row[labelKey] || row.sprint || row.release;
      acc[label] = selectedOption || 'All';
      return acc;
    }, {});
    setSelectedIssueTypes(initialTypes);
  };

  const toggleStatus = (status) => {
    setSelectedStatuses((prev) => {
      const isCurrentlySelected = prev.includes(status);
      return isCurrentlySelected ? prev.filter((s) => s !== status) : [...prev, status];
    });
  };

  const handleStatusCarouselNext = () => {
    if (isStatusAtEnd) return;
    const itemsToScroll = visibleBadgeCount > 0 ? visibleBadgeCount : statusItemsPerPage;
    setStatusCarouselIndex((prev) => prev + itemsToScroll);
  };

  const handleStatusCarouselPrev = () => {
    if (isStatusAtStart) return;
    const itemsToScroll = visibleBadgeCount > 0 ? visibleBadgeCount : statusItemsPerPage;
    setStatusCarouselIndex((prev) => Math.max(0, prev - itemsToScroll));
  };

  const today = new Date();
  const overdueTickets = rowData.filter((row) => {
    const dueDate = new Date(row.dueDate);
    return (
      row.dueDate !== 'No Due Date' &&
      dueDate < new Date(today.setHours(0, 0, 0, 0)) &&
      row.status !== 'Done' &&
      row.status !== 'Closed'
    );
  });

  const statusDataWithOverdue = useMemo(() => {
    if (navigationJiraFilter && statusDistributionFromFilteredRows?.length) {
      return statusDistributionFromFilteredRows;
    }
    const result =
      overdueTickets.length > 0
        ? [
            ...barChartData,
            {
              status: 'Overdue',
              count: overdueTickets.length,
              color: 'bg-red-500',
            },
          ]
        : barChartData;

    return result;
  }, [navigationJiraFilter, statusDistributionFromFilteredRows, overdueTickets.length, barChartData]);

  const effectiveItemsPerPage = visibleBadgeCount > 0 ? visibleBadgeCount : statusItemsPerPage;

  const safeStatusStart = Math.max(
    0,
    Math.min(statusCarouselIndex, statusDataWithOverdue.length - 1),
  );
  const isStatusAtStart = safeStatusStart === 0;

  const isStatusAtEnd = safeStatusStart + effectiveItemsPerPage >= statusDataWithOverdue.length;

  const shouldShowArrows = statusDataWithOverdue.length > effectiveItemsPerPage;

  const getVisibleStatusItems = () => {
    const endIndex = Math.min(
      safeStatusStart + effectiveItemsPerPage,
      statusDataWithOverdue.length,
    );
    const visibleItems = statusDataWithOverdue.slice(safeStatusStart, endIndex);
    return visibleItems;
  };
  useEffect(() => {
    if (statusDataWithOverdue.length > 0) {
      setStatusCarouselIndex(0);
    }
  }, [statusDataWithOverdue.length]);

  useEffect(() => {
    const calculateVisibleBadges = () => {
      if (!statusCarouselContainerRef.current || statusDataWithOverdue.length === 0) {
        setVisibleBadgeCount(statusDataWithOverdue.length);
        return;
      }

      const container = statusCarouselContainerRef.current;
      const containerWidth = container.clientWidth;

      const buttonSpace = 70;
      const padding = 40;
      const gapBetweenBadges = 8;

      let totalWidthNeeded = 0;

      for (let i = 0; i < statusDataWithOverdue.length; i++) {
        const badge = statusDataWithOverdue[i];
        const text = `${badge.count} ${badge.status}`;
        const estimatedBadgeWidth = text.length * 7 + 52;
        totalWidthNeeded += estimatedBadgeWidth + (i > 0 ? gapBetweenBadges : 0);
      }

      const availableWidthWithoutArrows = containerWidth - buttonSpace - padding;

      if (totalWidthNeeded <= availableWidthWithoutArrows) {
        setVisibleBadgeCount((prevCount) => {
          if (prevCount !== statusDataWithOverdue.length && prevCount > 0) {
            setStatusCarouselIndex(0);
          }
          return statusDataWithOverdue.length;
        });
        return;
      }

      const arrowSpace = 32 * 2 + 24;
      const availableWidthWithArrows = containerWidth - arrowSpace - buttonSpace - padding;

      let totalWidth = 0;
      let visibleCount = 0;

      for (let i = 0; i < statusDataWithOverdue.length; i++) {
        const badge = statusDataWithOverdue[i];
        const text = `${badge.count} ${badge.status}`;
        const estimatedBadgeWidth = text.length * 7 + 52;

        if (
          totalWidth + estimatedBadgeWidth + (visibleCount > 0 ? gapBetweenBadges : 0) <=
          availableWidthWithArrows
        ) {
          totalWidth += estimatedBadgeWidth + (visibleCount > 0 ? gapBetweenBadges : 0);
          visibleCount++;
        } else {
          break;
        }
      }

      const finalCount = Math.max(1, visibleCount);

      setVisibleBadgeCount((prevCount) => {
        if (prevCount !== finalCount && prevCount > 0) {
          setStatusCarouselIndex(0);
        }
        return finalCount;
      });
    };

    calculateVisibleBadges();

    window.addEventListener('resize', calculateVisibleBadges);
    return () => window.removeEventListener('resize', calculateVisibleBadges);
  }, [statusDataWithOverdue, statusCarouselContainerRef]);

  const filteredRowData = selectedStatuses.length
    ? (() => {
        // Get the current project once to avoid repeated lookups
        const project = getAllProjectList?.find((p) => p._id === selectedProject.id);
        const isGitLabProject = project?.projectTypeKey === 'gitlab-project';
        
        return rowDataAfterNavFilter.filter((row) => {
          const dueDate = new Date(row.dueDate);
          const isOverdue =
            row.dueDate !== 'No Due Date' &&
            dueDate < new Date(new Date().setHours(0, 0, 0, 0)) &&
            row.status !== 'Done' &&
            row.status !== 'Closed';

          const isOverdueSelected = selectedStatuses.includes('Overdue');
          
          // Conditional filtering based on project type
          let matchesStatus = false;
          if (isGitLabProject) {
            // For GitLab projects: first check row.label, then fall back to row.status
            if (row?.labels && selectedStatuses.includes(row.labels)) {
              matchesStatus = true;
            } else {
              matchesStatus = selectedStatuses.includes(row.status);
            }
          } else {
            // For all other project types: use only row.status
            matchesStatus = selectedStatuses.includes(row.status);
          }

          return matchesStatus || (isOverdueSelected && isOverdue);
        });
      })()
    : rowDataAfterNavFilter;

  const StatusBadges = ({ statusData, selectedStatuses, onToggle, colorMap, badgesRef }) => (
    <div ref={badgesRef} className="contents">
      {statusData?.map(({ status, count }) => {
        const isSelected = selectedStatuses.includes(status);
        const statusColor = getStatusColor(status, colorMap);

        return (
          <button
            key={status}
            onClick={() => onToggle(status)}
            className={`inline-flex items-center px-4 py-2 rounded-md whitespace-nowrap
            ${
              isSelected
                ? 'bg-[#24527A] dark:bg-[#066FD1] text-white'
                : 'dark:bg-[#293345] bg-[#E5E5E5] dark:text-white text-[#24527A]'
            }
            transition-colors duration-200`}
            style={{ width: 'fit-content' }}
            title={`${count} ${status}`}
          >
            <div
              className={`w-3 h-3 mr-2 rounded-full flex-shrink-0 ${statusColor.tailwind}`}
            ></div>
            <span className="text-sm font-medium">
              {count} {status}
            </span>
          </button>
        );
      })}
    </div>
  );

  StatusBadges.propTypes = {
    statusData: PropTypes.arrayOf(
      PropTypes.shape({
        status: PropTypes.string.isRequired,
        count: PropTypes.number.isRequired,
      }),
    ).isRequired,
    selectedStatuses: PropTypes.arrayOf(PropTypes.string).isRequired,
    onToggle: PropTypes.func.isRequired,
    colorMap: PropTypes.instanceOf(Map).isRequired,
    badgesRef: PropTypes.oneOfType([
      PropTypes.func,
      PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    ]),
  };

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      sortIcon: true,
      sortingOrder: ['asc', 'desc'],
      resizable: true,
      flex: 1,
      tooltipShowDelay: 0,
      floatingFilterComponent: SearchFloatingFilter,
      floatingFilterComponentParams: {
        gridApi: gridApiRef.current,
      },
    }),
    [gridApiRef],
  );
  const handleFilterIconClick = useCallback((field) => {
    const floatingFilter = gridApiRef.current?.getFloatingFilterComponent(field);
    floatingFilter?.getGui()?.focus();
  }, []);

  const columnDefsWithApi = useMemo(() => {
    const sampleCustomFields =
      filteredRowData.length > 0
        ? filteredRowData.reduce((acc, row) => {
            return { ...acc, ...(row.customFieldsByName || {}) };
          }, {})
        : (jiraTableData?.issues || []).reduce((acc, issue) => {
            return { ...acc, ...(issue.customFieldsByName || {}) };
          }, {});
    return jiraColumnDefs(handleFilterIconClick, sampleCustomFields,jiraTableData?.sourceManagement)?.map((colDef) => {
      const isSearchFloating = colDef.floatingFilterComponent === SearchFloatingFilter;

      return {
        ...colDef,
        floatingFilterComponentParams: {
          ...(isSearchFloating ? { gridApi: gridApiRef.current } : {}),
        },
      };
    });
  }, [
    gridApiRef,
    filteredRowData,
    handleFilterIconClick,
    jiraTableData,
  ]);

  const onGridReady = useCallback(
    (params) => {
      gridApiRef.current = params.api;
      params.api.setFloatingFiltersHeight(showJiraSearch ? 36 : 0);
      params.api.onFilterChanged();
    },
    [showJiraSearch],
  );

  const onPRGridReady = useCallback((api) => {
    prGridApiRef.current = api;
  }, []);

  const onFilterChanged = () => {
    gridApiRef.current.onFilterChanged();
  };
  useEffect(() => {
    const updateItemsPerPage = () => {
      setStatusItemsPerPage(4);
    };

    updateItemsPerPage();

    let resizeObserver;
    if (window.ResizeObserver && statusCarouselContainerRef.current) {
      resizeObserver = new ResizeObserver(updateItemsPerPage);
      resizeObserver.observe(statusCarouselContainerRef.current);
    } else {
      window.addEventListener('resize', updateItemsPerPage);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener('resize', updateItemsPerPage);
    };
  }, [statusDataWithOverdue]);

  const fullColumnDefs = useMemo(() => {
    const sampleCustomFields =
      filteredRowData.length > 0 ? filteredRowData[0].customFieldsByName : {};
    return jiraColumnDefs(handleFilterIconClick, sampleCustomFields);
  }, [handleFilterIconClick, filteredRowData]);

  const [visibleColumns, setVisibleColumns] = useState(() => {
    return fullColumnDefs.filter((col) => !col.optional).map((col) => col.field);
  });

  const allColumns = useMemo(() => {
    const hasDeveloperData = filteredRowData?.some(
      (row) => row.developer && row.developer !== 'Unassigned',
    );
    return fullColumnDefs.filter(
      (col) => col.allowToggle && (col.field !== 'developer' || hasDeveloperData),
    );
  }, [fullColumnDefs, filteredRowData]);

  const handleColumnToggle = (field) => {
    const isCurrentlyVisible = visibleColumns.includes(field);
    const canHideColumn = visibleColumns.length > 1;
    const willBeVisible = !isCurrentlyVisible;

    const newVisibleColumns = isCurrentlyVisible
      ? canHideColumn
        ? visibleColumns.filter((f) => f !== field)
        : visibleColumns
      : [...visibleColumns, field];
    setVisibleColumns(newVisibleColumns);
    if (aGridRef.current?.clearExternalFilter) {
      aGridRef.current.clearExternalFilter(field);
    }
    if (gridApiRef.current?.columnApi) {
      gridApiRef.current.columnApi.setColumnVisible(field, willBeVisible);
    }

    if (isCurrentlyVisible && canHideColumn && gridApiRef.current) {
      const filterModel = gridApiRef.current.getFilterModel();
      const isFilterApplied = Object.prototype.hasOwnProperty.call(filterModel, field);

      if (isFilterApplied) {
        const filterInstance = gridApiRef.current.getFilterInstance(field);
        if (filterInstance) {
          filterInstance.setModel(null);
        }

        const floatingFilterComponent = gridApiRef.current.getFloatingFilterComponent(field);
        if (floatingFilterComponent) {
          floatingFilterComponent.onFloatingFilterChanged({
            model: null,
            filterInstance,
          });
        }

        gridApiRef.current.onFilterChanged();
        gridApiRef.current.refreshHeader();
        setClearFiltersSignal((prev) => prev + 1);
        if (aGridRef.current && aGridRef.current.clearExternalFilter) {
          aGridRef.current.clearExternalFilter(field);
        }
      }
    }
  };

  const handleColumnsClearAll = useCallback(() => {
    const requiredColumns = fullColumnDefs
      .filter((col) => !col.optional)
      .map((col) => col.field);
    setVisibleColumns(requiredColumns);
    if (gridApiRef.current?.columnApi) {
      allColumns.forEach((col) => {
        const shouldBeVisible = requiredColumns.includes(col.field);
        gridApiRef.current.columnApi.setColumnVisible(
          col.field,
          shouldBeVisible,
        );
      });
    }
  }, [fullColumnDefs, allColumns]);

  // For testing purposes we are using this change. If this endpoint works properly, we will remove the commented code later.
  // useEffect(() => {
  //   const fetchData = async () => {
  //     try {
  //       const fetchedStoryPoints = await getRoleRatesAndStoryPoints(companyId);
  //       const storyPoints = fetchedStoryPoints?.storyPoints ?? 8;
  //       setStoryPoints(storyPoints);
  //       const projectId = getId().projectId;
  //       const response = await axiosInstance.get(
  //         `/api/jira/getLastSynced/${companyId}/${projectId}`,
  //       );
  //       const rawDate = response?.data?.lastSynced.split(',')[0];
  //       const [day, month, year] = rawDate.split('/');
  //       setLastLoggedDate(`${year}-${month}-${day}`);
  //     } catch (error) {
  //       console.error('Error during companyId-related fetches:', error);
  //     }
  //   };
  //   fetchData();
  // }, [companyId]);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await getStandupDashboardData({
          value:
            sessionStorage.getItem(APP_STRINGS.SESSION_TYPE_VALUE) === APP_STRINGS.VALUE_RELEASE
              ? APP_STRINGS.API_RELEASE
              : APP_STRINGS.API_SPRINT,
          sections: 'roleRatesAndStoryPoints,lastSynced',
        });
        const data = response?.data;
        if (data?.roleRatesAndStoryPoints) {
          const sp = data.roleRatesAndStoryPoints?.storyPoints ?? 8;
          setStoryPoints(sp);
        }
        if (data?.lastSynced) {
          const rawDate = data.lastSynced?.lastSynced?.split(',')[0];
          if (rawDate) {
            const [day, month, year] = rawDate.split('/');
            setLastLoggedDate(`${year}-${month}-${day}`);
          }
        }
      } catch (error) {
        console.error('Error during companyId-related fetches:', error);
      }
    };
    fetchData();
  }, [companyId]);
  useEffect(() => {
  if (!getAllProjectList || !jiraData?.selectedProjectId) {
    setRepoSource('No repositories found or project not matched.');
    return;
  }

  const getMatchingProject = getAllProjectList.find(
    (project) => project?._id === jiraData?.selectedProjectId,
  );

  if (getMatchingProject?.repos && Array.isArray(getMatchingProject.repos)) {
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
}, [getAllProjectList, jiraData?.selectedProjectId]);
  const prLabel = repoSource?.toLowerCase() === 'gitlab' ? 'Merge Requests' : 'Pull Requests';
  const prShortLabel = repoSource?.toLowerCase() === 'gitlab' ? 'MR' : 'PR';
  const prPluralShortLabel = `${prShortLabel}s`;

  useEffect(() => {
    if (jiraData) {
      setJiraDeveloperStatusData(jiraData.jiraStatusByDeveloper || []);
      setLoading(jiraData.loadingEngMetrics || false);
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
      setCurrentSprint(jiraData.Sprint);
      setCurrentRelease(jiraData.Release);
      setGetAllSprintList(jiraData.sprintList || []);
      setGetAllReleaseList(jiraData.releasesList || []);
      setSelectedProject({
        id: jiraData.selectedProjectId || '',
        name: jiraData.selectedProjectName || '',
      });

      const restoredDeveloper = jiraData.selectedDeveloperName?.value || '';
      const sessionDev = sessionStorage.getItem('developer');
      if (restoredDeveloper && selectedDeveloper !== restoredDeveloper) {
        setSelectedDeveloper(restoredDeveloper);
        if (sessionDev !== restoredDeveloper) {
          sessionStorage.setItem('developer', restoredDeveloper);
        }
      } else if (!restoredDeveloper && selectedDeveloper) {
        setSelectedDeveloper(null);
        if (sessionDev) {
          sessionStorage.removeItem('developer');
        }
      }

      const restoredBoard = restoreBoardFromSession();
      if (restoredBoard) {
        setSelectedBoard(restoredBoard);
      }
      setIsProjectOpen(jiraData.isProjectOpen || false);
      setIsSprintOpen(jiraData.isSprintOpen || false);
      setRepoList(jiraData.repoList || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jiraData, gitData, selectedRepos]);

  useEffect(() => {
    if (repoList.length > 0) {
      setSelectedRepos(repoList);
    } else {
      setSelectedRepos([]);
    }
  }, [repoList]);

  useEffect(() => {
    const hasSelection = selectedValue?.value === APP_STRINGS.VALUE_RELEASE
      ? !!selectedRelease?.id
      : !!selectedSprint?.id;
    if (!hasSelection) {
      setAssigneeStoryPointList([]);
      setAssignees([]);
      setAvailableCapacity(0);
      setAllocatedCapacity(0);
      setRemainingCapacity(0);
      setIsRemainingNegative(false);
      setCapacityGaugeUtilization(0);
      setOverloadCount(0);
      setUnderloadCount(0);
      return;
    }
    const currentData = selectedValue?.value === APP_STRINGS.VALUE_RELEASE
      ? (jiraData?.Release ?? jiraData?.Sprint)
      : (jiraData?.Sprint ?? jiraData?.Release);
    const assigneesList = currentData?.assignees || [];
    const capacityPlanAssignees = filterAssigneesForCapacityPlanView(assigneesList);
    const pointsSourceTypeRaw = currentData?.pointsSourceType;
    const effectivePointsSourceType = pointsSourceTypeRaw ?? (isAzure ? 'effort' : 'storyPoints');
    const hasCommittedHours =
      currentData?.committedVsCompletedMetrics?.committedHours > 0 ||
      currentData?.committedVsCompletedMetrics?.completedHours > 0;
    let isHoursBased = currentData?.hours === true;
    if (!isHoursBased && effectivePointsSourceType !== 'storyPoints' && hasCommittedHours) {
      isHoursBased = true;
    }
    setIsHoursBasedProject(isHoursBased);
    sessionStorage.setItem('isHoursBasedProject', isHoursBased.toString());
    const hasNetAvailable = capacityPlanAssignees.some(
      (item) => item.netAvailableCapacity !== undefined && item.netAvailableCapacity !== null,
    );
    const allNetAvailableZeroOrMissing =
      !hasNetAvailable ||
      capacityPlanAssignees.every((item) => Number(item.netAvailableCapacity || 0) === 0);

    const assigneeStoryPointList = capacityPlanAssignees.map((item) => {
      const allocatedValue = isHoursBased
        ? Number(item.allocatedHours || 0)
        : Number((item.allocatedStoryPoints ?? item.allocatedHours) || 0);
      return {
        assignee: item.assignee,
        allocatedStoryPoints: allocatedValue,
        availableHours: allNetAvailableZeroOrMissing
          ? item.availableHours || 0
          : item.netAvailableCapacity,
      };
    });
    const developerNamesFromCapacity = capacityPlanAssignees.map((a) => a.assignee).filter(Boolean);
    const issues = jiraData?.jiraTableData?.issues;
    const injectUnassignedForIssues =
      !developerNamesFromCapacity.some(assigneeLabelIsUnassigned) &&
      jiraIssuesHaveMissingAssignee(issues);

    const developerNames = injectUnassignedForIssues
      ? [...developerNamesFromCapacity, 'Unassigned']
      : developerNamesFromCapacity;
    setAssigneeStoryPointList(assigneeStoryPointList);
    setAssignees(developerNames);
    if (selectedDeveloper && !developerNames.includes(selectedDeveloper)) {
      setSelectedDeveloper(null);
      dispatch(setSelectedDeveloperName(null));
      sessionStorage.removeItem('developer');
      void handleTeam(null, dispatch);
    }
    const available = assigneeStoryPointList.map((a) => ({
      assignee: a.assignee,
      availableCapacity: a.availableHours,
    }));
    const allocated = assigneeStoryPointList.map((a) => ({
      assignee: a.assignee,
      allocatedCapacity: a.allocatedStoryPoints,
    }));

    const remaining = assigneeStoryPointList.map((a) => ({
      assignee: a.assignee,
      remainingCapacity: a.availableHours - a.allocatedStoryPoints,
    }));
    const totalAvailableCapacity = available.reduce((sum, item) => {
      return sum + (item.availableCapacity || 0);
    }, 0);

    const totalAllocatedCapacity = allocated.reduce((sum, item) => {
      return sum + (item.allocatedCapacity || 0);
    }, 0);

    const totalRemainingCapacity = remaining.reduce((total, dev) => {
      return total + dev.remainingCapacity;
    }, 0);

    let availableForSelectedDev = 0;
    let allocatedForSelectedDev = 0;
    let remainingForSelectedDev = 0;

    if (selectedDeveloper) {
      const selectedDevData = assigneeStoryPointList.find(
        (dev) => dev.assignee === selectedDeveloper,
      );
      if (selectedDevData) {
        availableForSelectedDev = selectedDevData.availableHours || 0;
        allocatedForSelectedDev = selectedDevData.allocatedStoryPoints || 0;
        remainingForSelectedDev = availableForSelectedDev - allocatedForSelectedDev;
      }
    }

    const commonAvailablePoints = selectedDeveloper
      ? availableForSelectedDev
      : totalAvailableCapacity;
    const commonAllocatedPoints = selectedDeveloper
      ? allocatedForSelectedDev
      : totalAllocatedCapacity;
    const commonRemainingPoints = selectedDeveloper
      ? remainingForSelectedDev
      : totalRemainingCapacity;
    setAvailableCapacity(Number(commonAvailablePoints.toFixed(2)));
    setAllocatedCapacity(Number(commonAllocatedPoints.toFixed(2)));
    setRemainingCapacity(Number(commonRemainingPoints.toFixed(2)));
    const isNegative = commonRemainingPoints < 0;
    setIsRemainingNegative(isNegative);

    const availTotal = Number(commonAvailablePoints);
    const allocTotal = Number(commonAllocatedPoints);
    const gaugeUtilization =
      availTotal > 0 ? Math.round((allocTotal / availTotal) * 100) : 0;
    setCapacityGaugeUtilization(gaugeUtilization);

    let overload = 0;
    let underload = 0;

    capacityPlanAssignees.forEach((assignee) => {
      const { allocatedHours, netAvailableCapacity, availableHours } = assignee;
      const dynamicAllocatedHours = Number(allocatedHours || 0);
      if (dynamicAllocatedHours <= 0) return;
      const capacity = allNetAvailableZeroOrMissing
        ? Number(availableHours || 0)
        : Number(netAvailableCapacity || 0);
      if (dynamicAllocatedHours > capacity) {
        overload++;
      } else if (dynamicAllocatedHours < capacity) {
        underload++;
      }
    });
    setOverloadCount(overload);
    setUnderloadCount(underload);
  }, [
    jiraData,
    gitData,
    getStoryPoints,
    selectedDeveloper,
    selectedValue,
    selectedSprint,
    selectedRelease,
  ]);

  // Board selection state
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [projectBoardCount, setProjectBoardCount] = useState({});
  const [subMenuBoards, setSubMenuBoards] = useState([]);
  const [subMenuPosition, setSubMenuPosition] = useState({ top: 0, left: 0 });
  const [currentProjectForBoard, setCurrentProjectForBoard] = useState(null);
  const fetchedProjectIdsRef = useRef(new Set());
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isBoardOpen && !event.target.closest('.board-submenu')) {
        setIsBoardOpen(false);
        setSubMenuBoards([]);
        setCurrentProjectForBoard(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isBoardOpen]);

  useEffect(() => {
    const endDate = new Date(currentSprint?.endDate);
    setSelectedSprintEndDate({
      id: currentSprint?._id,
      endDate: endDate.toLocaleDateString('en-IN'),
    });

    const startDate = new Date(currentSprint?.startDate);
    setSelectedSprintStartDate({
      id: currentSprint?._id,
      startDate: startDate.toLocaleDateString('en-IN'),
    });

    const releaseStartDate = currentRelease?.startDate ? new Date(currentRelease.startDate) : null;
    const releaseDate = currentRelease?.releaseDate ? new Date(currentRelease.releaseDate) : null;
    setSelectedReleaseDate({
      id: currentRelease?._id,
      startDate: releaseStartDate?.toLocaleDateString('en-IN') || 'NA',
      releaseDate: releaseDate?.toLocaleDateString('en-IN') || 'NA',
      overdue: currentRelease?.overdue,
    });

    let formattedCompleteDate = '';
    let referenceDate = new Date();
    if (currentSprint?.completeDate) {
      const completeDate = new Date(currentSprint?.completeDate);
      formattedCompleteDate = completeDate.toLocaleDateString('en-IN');
      referenceDate = completeDate;
    }
    setActualSprintEndDate({ id: currentSprint?._id, completeDate: formattedCompleteDate });

    if (currentSprint?.endDate) {
      const sprintEnd = new Date(currentSprint?.endDate);
      sprintEnd.setHours(23, 59, 59, 999);
      const compareStart = new Date(Math.min(referenceDate.getTime(), sprintEnd.getTime()));
      const compareEnd = new Date(Math.max(referenceDate.getTime(), sprintEnd.getTime()));
      const workingDays = getWorkingDaysBetweenDates(compareStart, compareEnd);
      setSprintDaysInfo({
        days: workingDays,
        status: referenceDate > sprintEnd ? 'overdue' : 'remaining',
      });
    }

    if (currentRelease?.releaseDate && currentRelease?.startDate) {
      const releaseEnd = new Date(currentRelease.releaseDate);
      releaseEnd.setHours(23, 59, 59, 999);

      const releaseStart = new Date(currentRelease.startDate);
      releaseStart.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let remainingWorkingDays;

      if (releaseStart > today) {
        remainingWorkingDays = getWorkingDaysBetweenDates(releaseStart, releaseEnd);
      } else {
        remainingWorkingDays = getWorkingDaysBetweenDates(today, releaseEnd);
      }

      setReleaseDaysInfo({
        remainingDays: remainingWorkingDays,
      });
    }
  }, [currentSprint, currentRelease]);

  useEffect(() => {
    const isUsingStoryPoints = sprintdata.some((item) => item.committed > 0 || item.completed > 0);
    setIsUsingStoryPoints(isUsingStoryPoints);
    const isUsingHours = sprintdata.some(
      (item) => item.committedHours > 0 || item.completedHours > 0,
    );
    if (isUsingStoryPoints) {
      setIsSprintGoalStoryPoints(true);

    } else if (isUsingHours) {
      setIsSprintGoalStoryPoints(false);

    }
  }, [selectedDeveloper, sprintdata]);

  useEffect(() => {
    if (gridApiRef.current) {
      gridApiRef.current.setFloatingFiltersHeight(showJiraSearch ? 36 : 0);
    }

    if (gridApiRef.current?.columnApi) {
      fullColumnDefs.forEach((col) => {
        const isVisible = visibleColumns.includes(col.field);
        gridApiRef.current.columnApi.setColumnVisible(col.field, isVisible);
      });
    }

    if (cxoData) {
        setActualStory(
          cxoData.actualStoryPoints || {
            actualStoryPoints: [],
            mode: APP_STRINGS.API_SPRINT,
          },
        );
      setDailyBurnup(cxoData.dailyBurnup || []);
    }
  }, [showJiraSearch, fullColumnDefs, visibleColumns, cxoData]);

  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (showChurnDetails) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      const scrollY = document.body.style.top
        ? parseInt(document.body.style.top || '0', 10) * -1
        : 0;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.paddingRight = '';
      window.scrollTo(0, scrollY);
    }

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setAssigneeIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.paddingRight = '';
    };
  }, [showChurnDetails]);

  const hasSessionData = sessionStorage.getItem('sprintId') || sessionStorage.getItem('releaseId');
  const hasJiraData =
    jiraData?.selectedSprintId ||
    jiraData?.selectedReleaseId ||
    (jiraData?.projectList?.length > 0) ||
    jiraData?.Sprint ||
    jiraData?.Release;
  // Don't show spinner when we have cached data matching session AND no fetch in progress
  const hasDisplayableData = (jiraData?.Sprint && jiraData?.selectedSprintId) || (jiraData?.Release && jiraData?.selectedReleaseId);
  const sessionMatchesContext =
    (sessionStorage.getItem('sprintId') === jiraData?.selectedSprintId) ||
    (sessionStorage.getItem('releaseId') === jiraData?.selectedReleaseId);
  const useCachedDataWithoutSpinner = hasDisplayableData && sessionMatchesContext;
  // Always show spinner when fetch is in progress; skip only when we have cached data and no fetch
  const isFetchInProgress = loading || jiraData?.loadingEngMetrics;
  const showSpinner =
    isFetchInProgress ||
    (!useCachedDataWithoutSpinner && hasSessionData && !hasJiraData);

  return (
    <div className="w-screen">
      <CommonLayout>
        {(isCollapsed) => (
          <>
            {showSpinner && (
              <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-light-100 bg-opacity-50 dark:bg-secondary-500 dark:bg-opacity-50 text-black dark:text-custom-gray z-50">
                <Spinner />
              </div>
            )}

            <div className="mt-20 ml-0 pb-10 relative transition-all duration-300">
              <div
                className="fixed top-14 z-20 left-[100px] right-0 pl-5 pr-0 flex flex-col dark:bg-[#151F2C] bg-[#F0F4F8] dark:shadow-none"
                aria-expanded={!isCollapsed}
              >
                <StandUpToolbarFiltersRow
                  getAllProjectList={getAllProjectList}
                  projectBoardCount={projectBoardCount}
                  handleProjectChange={handleProjectChange}
                  handleProjectHover={handleProjectHover}
                  handleProjectMouseLeave={handleProjectMouseLeave}
                  selectedProjectDisplayName={selectedProjectDisplayName}
                  isProjectOpen={isProjectOpen}
                  setIsProjectOpen={setIsProjectOpen}
                  projectRef={projectRef}
                  isBoardOpen={isBoardOpen}
                  subMenuBoards={subMenuBoards}
                  subMenuPosition={subMenuPosition}
                  currentProjectForBoard={currentProjectForBoard}
                  handleBoardChange={handleBoardChange}
                  setIsBoardOpen={setIsBoardOpen}
                  setSubMenuBoards={setSubMenuBoards}
                  setCurrentProjectForBoard={setCurrentProjectForBoard}
                  repoList={repoList}
                  handleRepoChange={handleRepoChange}
                  selectedRepos={selectedRepos}
                  isRepoOpen={isRepoOpen}
                  setIsRepoOpen={setIsRepoOpen}
                  repoRef={repoRef}
                  sprintLabel={sprintLabel}
                  releaseLabel={releaseLabel}
                  handleValueChange={handleValueChange}
                  selectedValue={selectedValue}
                  isValueOpen={isValueOpen}
                  setIsValueOpen={setIsValueOpen}
                  valueRef={valueRef}
                  getAllSprintList={getAllSprintList}
                  handleSprintChange={handleSprintChange}
                  selectedSprint={selectedSprint}
                  isSprintOpen={isSprintOpen}
                  setIsSprintOpen={setIsSprintOpen}
                  sprintRef={sprintRef}
                  getAllReleaseList={getAllReleaseList}
                  handleReleaseChange={handleReleaseChange}
                  selectedRelease={selectedRelease}
                  handleDateChange={handleDateChange}
                  value1={value1}
                  theme={theme}
                  assigneeIsOpen={assigneeIsOpen}
                  setAssigneeIsOpen={setAssigneeIsOpen}
                  dropdownRef={dropdownRef}
                  selectedDeveloper={selectedDeveloper}
                  randomizeEnabled={randomizeEnabled}
                  toggleRandomize={toggleRandomize}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  displayedDevelopers={displayedDevelopers}
                  handleDeveloperSelect={handleDeveloperSelect}
                  handleTeamClick={handleTeamClick}
                />

                <div
                  className="flex mt-1 dark:bg-[#293345] bg-[#D9EAF9] w-full"
                  aria-expanded={!isCollapsed}
                >
                  {selectedValue.value === APP_STRINGS.VALUE_SPRINT && selectedSprint.name && (
                    <div className="flex items-center space-x-4 text-[15px] h-[34px] p-2 pl-8">
                      <div className="dark:text-[#48A7FF] text-[#066FD1]">
                        {sprintLabel} Start & End Date:{' '}
                        <span>{selectedSprintStartDate.startDate}</span> -{' '}
                        <span>{selectedSprintEndDate.endDate}</span>
                      </div>
                      <div className="dark:text-[#F59F12] text-[#F59F12]">
                        Actual {sprintLabel} End Date:{' '}
                        <span className="dark:text-[#F59F12] text-[#F59F12]">
                          {actualSprintEndDate?.completeDate
                            ? actualSprintEndDate.completeDate
                            : 'NA'}
                        </span>
                      </div>
                      {sprintDaysInfo &&
                        selectedSprintEndDate.endDate !== actualSprintEndDate?.completeDate && (
                          <div
                            className={
                              sprintDaysInfo.status === 'overdue'
                                ? 'text-[#FF0000]'
                                : theme === 'light' ? 'text-green-600' : 'text-[#64D518]'
                            }
                          >
                            {sprintDaysInfo.status === 'overdue' ? (
                              <>
                                {sprintDaysInfo.days} day{sprintDaysInfo.days > 1 ? 's' : ''}{' '}
                                overdue
                              </>
                            ) : (
                              <>
                                {sprintDaysInfo.days} day{sprintDaysInfo.days > 1 ? 's' : ''}{' '}
                                remaining
                              </>
                            )}
                          </div>
                        )}
                    </div>
                  )}
                  {selectedValue.value === APP_STRINGS.VALUE_RELEASE && selectedRelease?.releaseName && (
                    <div className="flex items-center space-x-4 text-[15px] h-[34px] p-2">
                      <div className="text-[#066FD1] dark:text-[#48A7FF] flex items-center space-x-2">
                        <span>
                          {releaseLabel} Start & End Date:{' '}
                          {selectedReleaseDate?.startDate === 'NA' &&
                          selectedReleaseDate?.releaseDate === 'NA' ? (
                            <span>NA</span>
                          ) : (
                            <>
                              <span>{selectedReleaseDate?.startDate ?? 'NA'}</span> -{' '}
                              <span
                                className={
                                  currentRelease?.isFallbackUsed === true
                                    ? 'text-red-500 font-medium'
                                    : ''
                                }
                              >
                                {selectedReleaseDate?.releaseDate ?? 'NA'}
                              </span>
                            </>
                          )}
                        </span>
                        {selectedReleaseDate?.overdue && (
                          <div className="flex items-center space-x-2">
                            <span className="bg-[#D92D20] text-white text-xs font-medium px-2 py-1 rounded-full flex items-center space-x-2">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 text-white"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.257 3.099c.765-1.36 2.721-1.36 3.486 0l5.514 9.799c.75 1.333-.213 3.002-1.742 3.002H4.485c-1.53 0-2.492-1.67-1.742-3.002l5.514-9.799zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V7a1 1 0 112 0v3a1 1 0 01-1 1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span>Overdue</span>
                            </span>
                          </div>
                        )}
                        {selectedReleaseDate?.startDate !== 'NA' &&
                          selectedReleaseDate?.releaseDate !== 'NA' &&
                          !selectedReleaseDate?.overdue &&
                          selectedReleaseDate?.releaseDate &&
                          currentRelease?.status === 'Unreleased' && (
                            <span className={`${theme === 'light' ? 'text-green-500' : 'text-[#64D518]'} text-sm font-medium`}>
                              {releaseDaysInfo?.remainingDays} day
                              {releaseDaysInfo.remainingDays > 1 ? 's' : ''} remaining
                            </span>
                          )}
                        {currentRelease?.isFallbackUsed && (
                          <div className="flex items-center space-x-2">
                            <span className="bg-yellow-500 text-white text-xs font-medium px-2 py-1 rounded-sm flex items-center space-x-2">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 text-white"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.257 3.099c.765-1.36 2.721-1.36 3.486 0l5.514 9.799c.75 1.333-.213 3.002-1.742 3.002H4.485c-1.53 0-2.492-1.67-1.742-3.002l5.514-9.799zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V7a1 1 0 112 0v3a1 1 0 01-1 1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span>
                                {' '}
                                Using today’s date as end date and update it for accurate result.
                              </span>
                            </span>
                          </div>
                        )}
                        {selectedReleaseDate?.startDate === 'NA' &&
                          selectedReleaseDate?.releaseDate !== 'NA' && (
                            <div className="flex items-center space-x-2">
                              <span className="bg-[#D92D20] text-white text-xs font-medium px-2 py-1 rounded-sm flex items-center space-x-2">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4 text-white"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M8.257 3.099c.765-1.36 2.721-1.36 3.486 0l5.514 9.799c.75 1.333-.213 3.002-1.742 3.002H4.485c-1.53 0-2.492-1.67-1.742-3.002l5.514-9.799zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V7a1 1 0 112 0v3a1 1 0 01-1 1z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span>
                                  {' '}
                                  Release start date is missing. set it to get full metrics.
                                </span>
                              </span>
                            </div>
                          )}
                        {selectedReleaseDate?.startDate === 'NA' &&
                          selectedReleaseDate?.releaseDate === 'NA' && (
                            <div className="flex items-center space-x-2">
                              <span className="bg-[#D92D20] text-white text-xs font-medium px-2 py-1 rounded-sm flex items-center space-x-2">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4 text-white"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M8.257 3.099c.765-1.36 2.721-1.36 3.486 0l5.514 9.799c.75 1.333-.213 3.002-1.742 3.002H4.485c-1.53 0-2.492-1.67-1.742-3.002l5.514-9.799zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V7a1 1 0 112 0v3a1 1 0 01-1 1z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span>
                                  {' '}
                                  Release start & end dates are missing. update them to get full
                                  metrics.
                                </span>
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div
              className={`mt-5 ${
                (selectedValue.value === APP_STRINGS.VALUE_SPRINT && selectedSprint.name) ||
                (selectedValue.value === APP_STRINGS.VALUE_RELEASE &&
                  selectedRelease?.releaseName &&
                  selectedReleaseDate?.releaseDate)
                  ? 'pt-10'
                  : 'pt-4'
              } flex flex-wrap gap-5 justify-center lg:justify-between`}
            >
              {/* {/ {/ Sprint Churn (Wider)  /} /} */}
              <StandUpChurnSection
                getChurnData={getChurnData}
                churnTableData={churnTableData}
                selectedValue={selectedValue}
                selectedOption={selectedOption}
                selectedSprint={selectedSprint}
                selectedRelease={selectedRelease}
                releaseLabel={releaseLabel}
                sprintLabel={sprintLabel}
                excludeBugsInChurn={excludeBugsInChurn}
                handleExcludeBugsInChurnToggle={handleExcludeBugsInChurnToggle}
                issueTypes={issueTypes}
                createShortName={createShortName}
                setSelectedOption={setSelectedOption}
                storyChurnData={storyChurnData}
                handleViewChurnDetails={handleViewChurnDetails}
                heavyChartsReady={heavyChartsReady}
                chartSuspenseFallback={chartSuspenseFallback}
                chartLineData={chartLineData}
                theme={theme}
                ChurnStoryLineChart={ChurnStoryLineChart}
              />
              <Modal
                isOpen={showChurnDetails}
                onClose={handleCloseDetails}
                title={`${
                  selectedOption === 'All'
                    ? selectedValue?.value === APP_STRINGS.VALUE_RELEASE
                      ? releaseLabel
                      : sprintLabel
                    : selectedOption
                } Churn`}
                size="medium"
                content={
                  <div className="ag-theme-alpine-dark" style={{ height: '295px', width: '100%' }}>
                    {heavyChartsReady ? (
                      <Suspense fallback={chartSuspenseFallback}>
                        <AGrid
                          rowData={transformedRowData}
                          columnDefs={StoryChurnColumns}
                          frameworkComponents={{ issueTypeRenderer: IssueTypeDropdown }}
                          context={{ onCellValueChanged: handleIssueTypeChange }}
                          height="290px"
                          defaultColDef={{ flex: 1, resizable: true }}
                          theme={theme}
                          disableFirstColumnSearch={true}
                        />
                      </Suspense>
                    ) : (
                      chartSuspenseFallback
                    )}
                  </div>
                }
              />

              {/* Capacity widget */}
              <StandUpCapacitySection
                theme={theme}
                selectedDeveloper={selectedDeveloper}
                handleViewCapacityDetails={handleViewCapacityDetails}
                capacityGaugeGeom={capacityGaugeGeom}
                capacityGaugeUtilization={capacityGaugeUtilization}
                availableCapacity={availableCapacity}
                pointsSourceType={pointsSourceType}
                isHoursBasedProject={isHoursBasedProject}
                allocatedCapacity={allocatedCapacity}
                isRemainingNegative={isRemainingNegative}
                capacityBarSegments={capacityBarSegments}
                overloadCount={overloadCount}
                underloadCount={underloadCount}
                remainingCapacity={remainingCapacity}
              />

              {/* Jira Graph */}
              <StandUpJiraGraphSection
                isGitLab={isGitLab}
                isAzure={isAzure}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                heavyChartsReady={heavyChartsReady}
                chartSuspenseFallback={chartSuspenseFallback}
                sortedBarChartData={sortedBarChartData}
                theme={theme}
                statusColorMap={statusColorMap}
                statusBarLeftMargin={statusBarLeftMargin}
                JiraDeveloperStatusBarChart={JiraDeveloperStatusBarChart}
              />
            </div>
            <div className="pt-5 flex flex-wrap basis-[300px] gap-5 justify-center lg:justify-between w-full min-w-0">
              {/* Burndown Chart */}
              <StandUpBurndownSection
                isReleaseSelected={isReleaseSelected}
                selectedDeveloper={selectedDeveloper}
                selectedValue={selectedValue}
                burndownStatus={burndownStatus}
                isStoryPoints={isStoryPoints}
                setIsStoryPoints={setIsStoryPoints}
                lockToHours={lockToHours}
                lockToPoints={lockToPoints}
                pointsSourceType={pointsSourceType}
                newBurndownData={newBurndownData}
                chartSuspenseFallback={chartSuspenseFallback}
                burndownChartData={burndownChartData}
                theme={theme}
                isHoursBasedProject={isHoursBasedProject}
                selectedSprint={selectedSprint}
                jiraData={jiraData}
                todaysVelocity={todaysVelocity}
                yesterdayVelocity={yesterdayVelocity}
                heavyChartsReady={heavyChartsReady}
                LazyReleaseBurndownStackedBar={LazyReleaseBurndownStackedBar}
                BurndownSprintLineChart={BurndownSprintLineChart}
              />

              {/* Burnup Chart - sprint only; supports both Story Points and Hours */}
              {selectedValue?.value === APP_STRINGS.VALUE_SPRINT && (
                <Suspense fallback={chartSuspenseFallback}>
                  <LazyBurnupChart
                    dailyBurnup={dailyBurnup}
                    actualStory={actualStory}
                    showAddedWork={showAddedWork}
                    onShowAddedWorkChange={setShowAddedWork}
                    burnupModePoints={burnupModePoints}
                    onBurnupModePointsChange={setBurnupModePoints}
                    pointsSourceType={pointsSourceType}
                    isHoursBasedProject={lockToHours}
                    initialStoryPoint={initialStoryPoint}
                    initialHours={initialHours}
                    selectedDeveloper={selectedDeveloper}
                    initialEffortByDevMemo={initialEffortByDevMemo}
                    spilloverStoryPoints={spilloverStoryPoints}
                    spilloverHours={spilloverHours}
                    lastLoggedDate={lastLoggedDate}
                    theme={theme}
                  />
                </Suspense>
              )}

              {/* Sprint Goal Success & Velocity */}
              {!selectedDeveloper && !isReleaseSelected && (
                <StandUpSprintGoalSuccessSection
                  selectedDeveloper={selectedDeveloper}
                  selectedValueDisplay={selectedValueDisplay}
                  theme={theme}
                  isSprintGoalStoryPoints={isSprintGoalStoryPoints}
                  setIsSprintGoalStoryPoints={setIsSprintGoalStoryPoints}
                  lockToHours={lockToHours}
                  lockToPoints={lockToPoints}
                  pointsSourceType={pointsSourceType}
                  sprintdata={sprintdata}
                  isUsingStoryPoints={isUsingStoryPoints}
                  heavyChartsReady={heavyChartsReady}
                  chartSuspenseFallback={chartSuspenseFallback}
                  sprintGoalRechartsPayload={sprintGoalRechartsPayload}
                  SprintGoalBarChart={SprintGoalBarChart}
                />
              )}
            </div>
            {/* Pull Request Summary Card */}
            <StandUpPRSummarySection
              theme={theme}
              prLabel={prLabel}
              prPluralShortLabel={prPluralShortLabel}
              prShortLabel={prShortLabel}
              openPrData={openPrData}
              prFilterType={prFilterType}
              setPrFilterType={setPrFilterType}
              heavyChartsReady={heavyChartsReady}
              chartSuspenseFallback={chartSuspenseFallback}
              AGrid={AGrid}
              prRowData={prRowData}
              filteredPRColumns={filteredPRColumns}
              onPRGridReady={onPRGridReady}
            />

            {/* QA Insights Component */}
            {!selectedDeveloper && (
              <div className="pt-5 ml-5 mr-2">
                <QAInsights />
              </div>
            )}

            <div className="pt-5 flex flex-wrap gap-4 items-stretch justify-between mr-2">
              <div
                id="jira-table"
                ref={statusCarouselContainerRef}
                className="ml-5 p-2 bg-[#FFFFFF] dark:bg-[#182433] dark:text-[#C8C8C8] text-[#24527A] rounded-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] dark:shadow-md border border-[#D1E2F0] dark:border-slate-700 w-full flex-1 relative"
              >
                <div className="flex items-center">
                  {shouldShowArrows && (
                    <button
                      onClick={handleStatusCarouselPrev}
                      disabled={isStatusAtStart}
                      className={`flex-shrink-0 w-8 h-8 p-2 rounded-md flex items-center justify-center transition-colors duration-200 mr-3 text-[#182433] dark:text-white opacity-60 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-[#202020] hover:text-[#202020] hover:bg-[#e6e6e6] hover:opacity-100`}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                  )}

                  <div
                    className={`${
                      shouldShowArrows ? 'flex-1' : 'flex-1'
                    } max-h-48 overflow-hidden ${shouldShowArrows ? 'pr-4' : 'px-4'}`}
                  >
                    <div className="flex flex-wrap gap-2 p-2 -ml-2 -mt-1">
                      <StatusBadges
                        statusData={getVisibleStatusItems()}
                        selectedStatuses={selectedStatuses}
                        onToggle={toggleStatus}
                        colorMap={statusColorMap}
                        badgesRef={statusBadgesRef}
                      />
                    </div>
                  </div>

                  {shouldShowArrows && (
                    <button
                      onClick={handleStatusCarouselNext}
                      disabled={isStatusAtEnd}
                      className={`flex-shrink-0 w-8 h-8 p-2 rounded-md flex items-center justify-center transition-colors duration-200 ml-3 text-[#182433] dark:text-white opacity-60 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-[#202020] hover:text-[#202020] hover:bg-[#e6e6e6] hover:opacity-100`}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  )}

                  <div
                    className={`flex-shrink-0 ${shouldShowArrows ? 'ml-4' : 'ml-2'} relative z-10`}
                  >
                    <DropdownButton
                      variant="icon"
                      type="columns"
                      title="Add Column"
                      options={allColumns
                        .filter((col) => col.allowToggle)
                        .map((col) => ({
                          value: col.field,
                          label: col.headerName,
                          checked: visibleColumns.includes(col.field),
                          disabled:
                            visibleColumns.length === 1 && visibleColumns.includes(col.field),
                        }))}
                      onSelect={handleColumnToggle}
                      onClearAll={handleColumnsClearAll}
                      isOpen={isColumnSelectorOpen}
                      setIsOpen={setIsColumnSelectorOpen}
                      reference={columnSelectorRef}
                      showSearch={true}
                    />
                  </div>
                </div>
                <div className="mt-1 -ml-2 -mr-2">
                  {heavyChartsReady ? (
                    <Suspense fallback={chartSuspenseFallback}>
                      <AGrid
                        rowData={filteredRowData}
                        columnDefs={columnDefsWithApi.filter((col) =>
                          visibleColumns.includes(col.field),
                        )}
                        defaultColDef={defaultColDef}
                        tooltipShowDelay={100}
                        onGridReady={onGridReady}
                        tooltipMouseTrack
                        domLayout="normal"
                        height="360px"
                        initialPageSize={7}
                        onFilterChanged={onFilterChanged}
                        preventColumnDrag={false}
                        enableColumnDragRestore={true}
                        floatingFilter={showJiraSearch}
                        clearFiltersSignal={clearFiltersSignal}
                        ref={aGridRef}
                        theme={theme}
                      />
                    </Suspense>
                  ) : (
                    chartSuspenseFallback
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </CommonLayout>
    </div>
  );
};

StandUpPage.propTypes = {
  initialData: PropTypes.shape({
    allocated: PropTypes.number.isRequired,
    remaining: PropTypes.number.isRequired,
    overloaded: PropTypes.number.isRequired,
    underutilized: PropTypes.number.isRequired,
  }),
  statusData: PropTypes.arrayOf(
    PropTypes.shape({
      status: PropTypes.string,
      count: PropTypes.number,
      color: PropTypes.string,
    }),
  ).isRequired,
  selectedStatuses: PropTypes.arrayOf(PropTypes.string).isRequired,
  onToggle: PropTypes.func.isRequired,
  capacityRowData: PropTypes.arrayOf(
    PropTypes.shape({
      userName: PropTypes.string.isRequired,
      role: PropTypes.string.isRequired,
      capacity: PropTypes.number.isRequired,
      leaves: PropTypes.number,
      adjustedCapacity: PropTypes.number,
    }),
  ),
};

export default StandUpPage;
