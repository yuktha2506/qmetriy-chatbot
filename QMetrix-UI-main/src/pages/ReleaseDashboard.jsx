import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  CircleGauge,
  TriangleAlert,
  TrendingDown,
  RefreshCcwDot,
  ScanSearch,
  Target,
} from 'lucide-react';
import { LineChartIcon, BarChartIcon } from '../utils/commonIcons';
import AccuracyScoreIcon from '../assets/images/AccuracyScoreIcon.svg';
import PrioritizePlannedWorkIcon from '../assets/images/PrioritizePlannedWork.svg';
import CommittingGoalIcon from '../assets/images/CommittingGoalIcon.svg';
import CommonLayout from '../layout/CommonLayout';
import DropdownButton from '../components/Common/DropDown';
import Spinner from '../components/Common/Spinner';
import { CommonFunction } from '../utils/commonFunctions';
import ReleaseBurnupLineChart from '../components/StandUp/ReleaseBurnupLineChart';
import ReleaseBurndownStackedBar from '../components/StandUp/ReleaseBurndownStackedBar';
import { processReleaseBurndownData } from '../utils/burndownUtils';
import {
  storeBoardInSession,
  restoreBoardFromSession,
  computeProjectDisplayName,
} from '../utils/boardUtils';
import { getBoardLabels } from '../utils/boardUtils';
import {
  getId,
  getBoardList,
  getAllOrgsListAPI,
  getReleaseDetails,
  APP_STRINGS,
} from '../constants';
import { fetchReleaseDashboardData, resetReleaseDashboard } from '../store/releaseDashboard/releaseDashboardSlice';
import {
  setSelectedTypeValue,
  bumpRefreshToken,
  setSelectedRelease as setJiraSelectedRelease,
  setReleasesList,
  setBoardListForProject,
} from '../store/JiraSlices/jiraSlice';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import PropTypes from 'prop-types';
import InvestmentProfile from '../components/ReleaseDashboard/InvestmentProfile';

ChartJS.register(ArcElement, Tooltip, Legend);

/** Doughnut chart for Accuracy Score (75%) - matches QMetrixBeta style with center text */
function AccuracyScoreDoughnut({ theme, value = 75 }) {
  const clampedValue = Math.min(100, Math.max(0, Number(value)));
  const labelColor = theme === 'light' ? '#5580A6' : '#F0F4F8';
  const textCenter = useMemo(
    () => ({
      id: 'textCenter',
      afterDraw(chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        if (meta.data.length) {
          const x = meta.data[0].x;
          const y = meta.data[0].y;
          const displayValue = chart.data.datasets[0]?.data?.[0] ?? 0;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = labelColor;
          ctx.font = 'bold 15px Inter, Arial';
          ctx.fillText(`${displayValue}%`, x, y);
          ctx.restore();
        }
      },
    }),
    [labelColor, clampedValue]
  );
  const data = useMemo(
    () => {
      const emptyTrackColor = theme === 'light' ? '#E0EDF8' : '#2A3A4F';
      const filledColor =
        clampedValue === 0
          ? emptyTrackColor
          : clampedValue <= 35
            ? (theme === 'light' ? '#E6970B' : '#F9161A')
            : clampedValue < 100
              ? (theme === 'light' ? '#2FCB37' : '#E6970B')
              : '#2FCB37';
      return {
        labels: ['Accuracy Score', ''],
        datasets: [
          {
            data: [clampedValue, 100 - clampedValue],
            backgroundColor: [filledColor, emptyTrackColor],
            borderWidth: 0,
            borderRadius: 10,
          },
        ],
      };
    },
    [clampedValue, theme]
  );
  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '80%',
      plugins: {
        tooltip: { enabled: false },
        legend: { display: false },
      },
    }),
    []
  );
  return <Doughnut key={theme} data={data} options={options} plugins={[textCenter]} />;
}

AccuracyScoreDoughnut.propTypes = {
  theme: PropTypes.oneOf(['light', 'dark']).isRequired,
  value: PropTypes.number,
};

function AccuracyScorePopover({ anchorRect, accuracyScoreDetails, showAll = false, onShowAllChange, theme = 'dark', onMouseEnter, onMouseLeave }) {
  const { accuracyScore, planningAccuracy, capacityAccuracy, sprints = [] } = accuracyScoreDetails || {};

  const chartData = showAll ? sprints : sprints.slice(-4);

  const yMax = useMemo(() => {
    const allVals = chartData.flatMap((s) => [s.planningAccuracy, s.capacityAccuracy]).filter((v) => v != null);
    const max = Math.max(...allVals, 100);
    return Math.ceil(max / 50) * 50 || 100;
  }, [chartData]);

  const yTicks = useMemo(() => {
    const step = yMax / 4;
    return [0, step, step * 2, step * 3, yMax];
  }, [yMax]);

  if (!anchorRect) return null;

  const popoverBg = theme === 'light' ? '#0D1621' : '#173A5A';

  if (!accuracyScoreDetails || accuracyScoreDetails.insufficientSprint) {
    const popoverW = 280;
    const midY = (anchorRect.top + anchorRect.bottom) / 2;
    return createPortal(
      <div
        className="fixed z-[9999] shadow-2xl flex items-center justify-center"
        style={{ width: popoverW, height: 80, top: midY, left: anchorRect.left - popoverW - 10, transform: 'translateY(-50%)', fontFamily: 'Inter, sans-serif', backgroundColor: popoverBg, border: '1px solid #224F78', borderRadius: 6 }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <span style={{ fontSize: 14, color: '#94A3B8' }}>Insufficient sprint data</span>
      </div>,
      document.body,
    );
  }

  const accuracyVal = showAll ? accuracyScore?.total : accuracyScore?.latest;
  const planningVal = showAll ? planningAccuracy?.total : planningAccuracy?.latest;
  const capacityVal = showAll ? capacityAccuracy?.total : capacityAccuracy?.latest;

  const formatVal = (v) => (v == null ? '-' : `${Math.round(v * 10) / 10}%`);

  const popoverWidth = 463;
  const anchorMidY = (anchorRect.top + anchorRect.bottom) / 2;
  const top = anchorMidY;
  const left = anchorRect.left - popoverWidth - 10;

  const tooltipFormatter = (value, name) => [value == null ? '-' : value, name];

  return createPortal(
    <div
      className="fixed z-[9999] shadow-2xl overflow-hidden"
      style={{ width: popoverWidth, height: sprints.length > 4 ? 280 : 273, top, left, transform: 'translateY(-50%)', fontFamily: 'Inter, sans-serif', backgroundColor: popoverBg, border: '1px solid #224F78', borderRadius: 6, padding: 10 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {console.log('height', sprints.length > 4 ? 280 : 273)}
      {/* Top row - Three stat cards */}
      <div className="flex items-stretch">
        <div className="flex flex-1 flex-col items-start justify-center gap-0.5 py-3 px-3">
          <div className="flex items-center gap-1">
            <img src={AccuracyScoreIcon} alt="Accuracy Score" style={{ width: 16, height: 16 }} />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 20, fontWeight: 'bold', letterSpacing: '0%', color: '#FFFFFF' }}>{formatVal(accuracyVal)}</span>
          </div>
          <span style={{ fontSize: 16, fontFamily: 'Inter, sans-serif', letterSpacing: '0%', color: '#E0EDF8' }}>Accuracy Score</span>
        </div>
        <div style={{ width: 1, height: 62, opacity: 1, backgroundColor: '#224F78', alignSelf: 'center' }} />
        <div className="flex flex-1 flex-col items-start justify-center gap-0.5 py-3 px-3">
          <div className="flex items-center gap-1">
            <img src={PrioritizePlannedWorkIcon} alt="Prioritize Planned Work" style={{ width: 14, height: 14 }} />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 20, fontWeight: 'bold', letterSpacing: '0%', color: '#FFFFFF' }}>{formatVal(planningVal)}</span>
          </div>
          <span style={{ fontSize: 11, color: '#D96C6E' }}>Prioritize Planned Work</span>
          <span style={{ fontSize: 10, color: '#94A3B8' }}>
            Planning Accuracy <span className="cursor-help" title="Measures how well planned work is prioritized" style={{ fontSize: 10, color: '#5580A6', width: 10, height: 10, display: 'inline-block' }}>&#9432;</span>
          </span>
        </div>
        <div style={{ width: 1, height: 39, opacity: 1, backgroundColor: '#2B3E4F', alignSelf: 'center' }} />
        <div className="flex flex-1 flex-col items-start justify-center gap-0.5 py-3 px-3">
          <div className="flex items-center gap-1">
            <img src={CommittingGoalIcon} alt="Committing Goal" style={{ width: 14, height: 14 }} />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 20, fontWeight: 'bold', letterSpacing: '0%', color: '#FFFFFF' }}>{formatVal(capacityVal)}</span>
          </div>
          <span style={{ fontSize: 11, color: '#22C55E' }}>Committing Goal</span>
          <span style={{ fontSize: 10, color: '#94A3B8' }}>
          Capacity Accuracy <span className="cursor-help" title="Measures commitment to planned goals" style={{ fontSize: 10, color: '#5580A6', width: 10, height: 10, display: 'inline-block' }}>&#9432;</span>
          </span>
        </div>
      </div>
      <div style={{ width: '100%', height: 1, opacity: 1, backgroundColor: '#224F78' }} />

      {/* Show All checkbox - only when more than 4 sprints */}
      {sprints.length > 4 && (
        <div className="flex items-center justify-end px-2 pt-2">
          <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => onShowAllChange?.(!showAll)}>
            <div style={{ width: 14.82, height: 14.82, backgroundColor: showAll ? '#326AEB' : '#2A3A4F', border: showAll ? 'none' : '1.5px solid #5580A6', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {showAll && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#FFFFFF" strokeWidth="1.73" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span style={{ fontSize: 13.59, color: '#FFFFFF', fontFamily: 'Inter, sans-serif' }}>Show All</span>
          </label>
        </div>
      )}

      {/* Bottom - Line Chart */}
      <div className="px-2 pt-0 pb-1">
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={chartData.map((s) => ({ sprint: s.sprint, planning: s.planningAccuracy, capacity: s.capacityAccuracy }))} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
            <CartesianGrid horizontal={false} vertical={false} />
            <XAxis dataKey="sprint" hide />
            <YAxis
              tick={{ fill: '#5A7A97', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              domain={[0, yMax]}
              ticks={yTicks}
            />
            <RechartsTooltip
              contentStyle={{ backgroundColor: popoverBg, border: '1px solid #224F78', borderRadius: 6, fontSize: 10, color: '#fff' }}
              itemStyle={{ color: '#fff', fontSize: 10 }}
              formatter={tooltipFormatter}
            />
            <Line type="linear" dataKey="planning" stroke="#22C55E" strokeWidth={1} strokeDasharray="5 3" dot={{ r: 2, fill: '#22C55E', stroke: '#22C55E' }} name="Planning Accuracy" connectNulls={false} />
            <Line type="linear" dataKey="capacity" stroke="#066FD1" strokeWidth={1} dot={{ r: 2, fill: '#066FD1', stroke: '#066FD1' }} name="Capacity Accuracy" connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-1 mb-1 flex items-center justify-center gap-4" style={{ fontSize: 13, color: '#99A1AF', fontFamily: 'Inter, sans-serif' }}>
          <span className="flex items-center gap-1">
            <span className="inline-block rounded-full bg-[#2FCB37]" style={{ width: 10, height: 10, opacity: 1 }} />
            Planning Accuracy
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block rounded-full bg-[#0EA5E9]" style={{ width: 10, height: 10, opacity: 1 }} />
            Capacity Accuracy
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

AccuracyScorePopover.propTypes = {
  anchorRect: PropTypes.shape({
    top: PropTypes.number,
    left: PropTypes.number,
    bottom: PropTypes.number,
  }),
  accuracyScoreDetails: PropTypes.object,
  showAll: PropTypes.bool,
  onShowAllChange: PropTypes.func,
  theme: PropTypes.oneOf(['light', 'dark']),
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
};

const ReleaseDashboard = () => {
  const [getAllProjectList, setGetAllProjectList] = useState([]);
  const [getAllReleaseList, setGetAllReleaseList] = useState([]);
  const [getAllOrgsList, setGetAllOrgsList] = useState([]);
  const { handleProject, handleRelease, handleOrganization } = CommonFunction();

  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isReleaseOpen, setIsReleaseOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState({ id: '', releaseName: '' });
  const [selectedProject, setSelectedProject] = useState({ id: '', name: '' });
  const [selectedBoard, setSelectedBoard] = useState({ id: '', name: '', type: '' });
  const [selectedOrg, setSelectedOrg] = useState({ id: '', name: '' });
  const [isOrganizationOpen, setIsOrganizationOpen] = useState(false);

  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [projectBoardCount, setProjectBoardCount] = useState({});
  const [subMenuBoards, setSubMenuBoards] = useState([]);
  const [subMenuPosition, setSubMenuPosition] = useState({ top: 0, left: 0 });
  const [currentProjectForBoard, setCurrentProjectForBoard] = useState(null);

  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('releaseDashboardActiveTab') || 'release-dashboard');

  const [chartViewType, setChartViewType] = useState('bar');
  const [accuracyPopoverRect, setAccuracyPopoverRect] = useState(null);
  const [accuracyShowAll, setAccuracyShowAll] = useState(false);
  const accuracyRef = useRef(null);

  const accuracyLeaveTimer = useRef(null);
  const contextSwitchingRef = useRef(false);
  const handleAccuracyEnter = useCallback(() => {
    clearTimeout(accuracyLeaveTimer.current);
    if (accuracyRef.current) {
      const rect = accuracyRef.current.getBoundingClientRect();
      setAccuracyPopoverRect({ top: rect.top, left: rect.left, bottom: rect.bottom });
    }
  }, []);
  const handleAccuracyLeave = useCallback(() => {
    accuracyLeaveTimer.current = setTimeout(() => {
      setAccuracyPopoverRect(null);
      setAccuracyShowAll(false);
    }, 100);
  }, []);
  const handlePopoverEnter = useCallback(() => {
    clearTimeout(accuracyLeaveTimer.current);
  }, []);
  const handlePopoverLeave = useCallback(() => {
    accuracyLeaveTimer.current = setTimeout(() => {
      setAccuracyPopoverRect(null);
      setAccuracyShowAll(false);
    }, 100);
  }, []);

  const projectRef = useRef(null);
  const releaseRef = useRef(null);
  const organizationRef = useRef(null);

  const jiraData = useSelector((state) => state.jira || {});
  const refreshToken = useSelector((state) => state.jira?.refreshToken || 0);
  const theme = useSelector((state) => state.theme.theme);
  const releaseDashboardState = useSelector((state) => state.releaseDashboard || {});
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isHoursBasedProject = useMemo(() => {
    const selectedReleaseObj = getAllReleaseList.find((r) => r._id === selectedRelease?.id);
    if (selectedReleaseObj != null && typeof selectedReleaseObj.hours === 'boolean') {
      return selectedReleaseObj.hours === true;
    }
    return sessionStorage.getItem('isHoursBasedProject') === 'true';
  }, [getAllReleaseList, selectedRelease?.id]);

  /** Targeted and forecasted release dates from API (ISO date strings). */
  const targetedReleaseDate = releaseDashboardState?.data?.targetedReleaseDate ?? null;
  const forecastedDate = releaseDashboardState?.data?.forecastedDate ?? null;
  const riskAndAlert = releaseDashboardState?.data?.riskAndAlert ?? null;

  const accuracyScoreDetails = releaseDashboardState?.data?.accuracyScoreDetails ?? null;

  /** Release status from dates: on-track (same day), at-risk (1–7 days delay), off-track (>7 days delay) */
  const releaseStatus = useMemo(() => {
    const target = targetedReleaseDate ? new Date(targetedReleaseDate) : null;
    const forecast = forecastedDate ? new Date(forecastedDate) : null;
    if (!target || !forecast) return 'on-track';
    const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const f = new Date(forecast.getFullYear(), forecast.getMonth(), forecast.getDate());
    const diffMs = f.getTime() - t.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays <= 0) return 'on-track';
    if (diffDays <= 7) return 'at-risk';
    return 'off-track';
  }, [targetedReleaseDate, forecastedDate]);

  /** Format ISO date string to "Month DD, YYYY" for display */
  // const formatReleaseDate = (isoDate) => {
  //   if (!isoDate) return '';
  //   const d = new Date(isoDate);
  //   return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  // };
  // log

  const burnupInsufficientData = useMemo(() => {
    const apiSprints = releaseDashboardState.data?.burnup?.sprintBreakdown;
    if (!Array.isArray(apiSprints)) return false;
    return apiSprints.some((s) => s.isFuture && s.insufficientData);
  }, [releaseDashboardState.data]);

  const burnupCompletedSprintCount = useMemo(() => {
    const apiSprints = releaseDashboardState.data?.burnup?.sprintBreakdown;
    if (!Array.isArray(apiSprints)) return 0;
    return apiSprints.filter((s) => !s.isFuture).length;
  }, [releaseDashboardState.data]);

  /** Resolved IDs stay stable when values move from sessionStorage into local state (avoids duplicate releaseData fetches on load). */
  const effectiveCompanyId = useMemo(
    () => selectedOrg.id || getId().companyId || '',
    [selectedOrg.id],
  );
  const effectiveProjectId = useMemo(
    () => selectedProject.id || sessionStorage.getItem('projectId') || '',
    [selectedProject.id],
  );
  const effectiveBoardId = useMemo(
    () => selectedBoard.id || sessionStorage.getItem('boardId') || '',
    [selectedBoard.id],
  );
  const effectiveReleaseId = useMemo(
    () => selectedRelease.id || sessionStorage.getItem('releaseId') || '',
    [selectedRelease.id],
  );

  useEffect(() => {
    dispatch(resetReleaseDashboard());
  }, [dispatch]);

  const { releaseLabel } = getBoardLabels();
  const selectedProjectDisplayName = computeProjectDisplayName(selectedProject, selectedBoard);

  const { data: orgsData } = useQuery({
    queryKey: ['getAllOrgsListAPI'],
    queryFn: getAllOrgsListAPI,
  });

  useEffect(() => {
    if (orgsData) {
      const list = Array.isArray(orgsData)
        ? orgsData
        : orgsData?.data || orgsData?.companies || orgsData?.organizations || [];
      setGetAllOrgsList(Array.isArray(list) ? list : []);
    }
  }, [orgsData]);

  const fetchBoardList = async (companyId, projectId) => {
    try {
      const cachedBoardsByProject = jiraData?.boardListByProjectId || {};
      const cachedBoards = cachedBoardsByProject[projectId];
      if (Array.isArray(cachedBoards)) {
        return cachedBoards;
      }
      const response = await getBoardList(companyId, projectId);
      let boards = [];
      if (response?.data) {
        if (Array.isArray(response.data)) boards = response.data;
        else if (Array.isArray(response.data?.boards)) boards = response.data.boards;
        else if (Array.isArray(response.data?.data)) boards = response.data.data;
      }
      dispatch(setBoardListForProject({ projectId, boards }));
      return boards;
    } catch (error) {
      console.error('Error fetching board list:', error);
      return [];
    }
  };

  useEffect(() => {
    setSelectedRelease({
      id: jiraData.selectedReleaseId || '',
      releaseName: jiraData.selectedReleaseName || '',
    });
    setSelectedProject({
      id: jiraData.selectedProjectId || '',
      name: jiraData.selectedProjectName || '',
    });
    setSelectedOrg({
      id: jiraData.selectedOrgId || '',
      name: jiraData.selectedOrgName || '',
    });
    const restoredBoard = restoreBoardFromSession();
    if (restoredBoard) setSelectedBoard(restoredBoard);
    setGetAllReleaseList(jiraData.releasesList || []);
    if (jiraData?.projectList) {
      const selectedProjects = (jiraData.projectList || []).filter(
        (project) => project.isSelected && project.hideStatus === false,
      );
      setGetAllProjectList(selectedProjects);
    }
  }, [jiraData]);

  useEffect(() => {
    if (getAllProjectList.length === 0) return;
    const cachedBoardLists = jiraData?.boardListByProjectId || {};
    const counts = {};
    for (const project of getAllProjectList) {
      const cachedBoards = cachedBoardLists[project._id];
      counts[project._id] = Array.isArray(cachedBoards) ? cachedBoards.length : 0;
    }
    setProjectBoardCount(counts);
  }, [getAllProjectList, jiraData?.boardListByProjectId]);

  useEffect(() => {
    if (
      !effectiveCompanyId ||
      !effectiveProjectId ||
      !effectiveBoardId ||
      !effectiveReleaseId
    ) {
      return;
    }
    if (contextSwitchingRef.current) {
      return;
    }
    dispatch(
      fetchReleaseDashboardData({
        companyId: effectiveCompanyId,
        projectId: effectiveProjectId,
        boardId: effectiveBoardId,
        releaseId: effectiveReleaseId,
      }),
    );
  }, [
    dispatch,
    effectiveCompanyId,
    effectiveProjectId,
    effectiveBoardId,
    effectiveReleaseId,
    refreshToken,
  ]);

  /** When landing on Release Dashboard with no release selected (e.g. came from StandUp with Sprint), default to latest unreleased release */
  useEffect(() => {
    const hasProjectAndBoard = selectedProject?.id && selectedBoard?.id;
    const noReleaseSelected = !selectedRelease?.id;
    if (!hasProjectAndBoard || !noReleaseSelected) return;

    const getLatestUnreleased = (list) => {
      if (!Array.isArray(list) || list.length === 0) return null;
      const unreleased = list
        .filter((r) => String(r.status || '').toLowerCase() === 'unreleased')
        .sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
      const pick = unreleased[0] || [...list].sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0))[0];
      return pick || null;
    };

    const applyLatestUnreleased = (release) => {
      if (!release?._id) return;
      setSelectedRelease({ id: release._id, releaseName: release.releaseName || '' });
      sessionStorage.setItem('releaseId', release._id);
      sessionStorage.setItem('releaseName', release.releaseName || '');
      sessionStorage.setItem(APP_STRINGS.SESSION_TYPE_VALUE, APP_STRINGS.VALUE_RELEASE);
      sessionStorage.setItem(APP_STRINGS.SESSION_TYPE_VALUE_LABEL, releaseLabel);
      sessionStorage.setItem('isHoursBasedProject', release?.hours === true ? 'true' : 'false');
      dispatch(setJiraSelectedRelease({ selectedReleaseId: release._id, selectedReleaseName: release.releaseName || '' }));
      dispatch(
        setSelectedTypeValue({
          selectedValueLabel: releaseLabel,
          selectedValue: APP_STRINGS.VALUE_RELEASE,
        }),
      );
    };

    if (getAllReleaseList?.length > 0) {
      const latest = getLatestUnreleased(getAllReleaseList);
      if (latest) applyLatestUnreleased(latest);
      return;
    }

    const fetchAndApply = async () => {
      try {
        sessionStorage.setItem('projectId', selectedProject.id);
        sessionStorage.setItem('boardId', selectedBoard.id);
        const res = await getReleaseDetails();
        const list = res?.data || [];
        if (list.length > 0) {
          setGetAllReleaseList(list);
          dispatch(setReleasesList(list));
          const latest = getLatestUnreleased(list);
          if (latest) applyLatestUnreleased(latest);
        }
      } catch (e) {
        console.error('Error fetching releases for default selection:', e);
      }
    };
    fetchAndApply();
  }, [selectedProject?.id, selectedBoard?.id, selectedRelease?.id, releaseLabel, dispatch, getAllReleaseList?.length]);

  const burnupChartData = useMemo(() => {
    const apiSprints = releaseDashboardState.data?.burnup?.sprintBreakdown;
    if (!Array.isArray(apiSprints) || apiSprints.length === 0) return [];

    const hasFutureSprints = apiSprints.some((s) => s.isFuture);
    const lastActualIndex = apiSprints.reduce(
      (idx, s, i) => (!s.isFuture ? i : idx),
      -1,
    );

    let cumulativePoints = 0;
    return apiSprints.map((s, i) => {
      const isBridge = hasFutureSprints && i === lastActualIndex;
      if (!s.isFuture) {
        cumulativePoints += s.completedPoints ?? 0;
        return {
          sprint: s.sprintName,
          actual: cumulativePoints,
          sprintPoints: s.completedPoints ?? 0,
          likely: isBridge ? cumulativePoints : null,
          pessimistic: isBridge ? cumulativePoints : null,
          optimistic: isBridge ? cumulativePoints : null,
        };
      }
      return {
        sprint: s.sprintName,
        actual: null,
        sprintPoints: null,
        likely: s.likely ?? null,
        pessimistic: s.pessimistic ?? null,
        optimistic: s.optimistic ?? null,
      };
    });
  }, [releaseDashboardState.data]);

  const releaseBurndownChartData = useMemo(() => {
    const burndown = releaseDashboardState.data?.burndown;
    const data = releaseDashboardState.data;
    if (!burndown?.sprintBreakdown || !Array.isArray(burndown.sprintBreakdown)) return [];
    // Use burndown.workForecast if present; otherwise build from top-level release dashboard fields
    const hasBurndownForecast = burndown.workForecast && Number(burndown.workForecast.sprintsRemaining ?? burndown.workForecast.sprints_remaining ?? 0) > 0;
    const workForecast =
      burndown.workForecast && hasBurndownForecast
        ? burndown.workForecast
        : data?.remainingSprints != null &&
            Number(data.remainingSprints) > 0 &&
            (data?.averageVelocity != null || data?.remainingWork != null)
          ? {
              sprintsRemaining: Number(data.remainingSprints),
              averageVelocity: Number(data.averageVelocity ?? 0),
              remainingWork: Number(data.remainingWork ?? data.remainingPoints ?? 0) || Number(data.remainingSprints) * Number(data.averageVelocity ?? 0),
            }
          : null;
    return processReleaseBurndownData({ ...burndown, workForecast: workForecast || burndown.workForecast });
  }, [releaseDashboardState.data]);

  const handleProjectChange = async (value) => {
    contextSwitchingRef.current = true;
    dispatch(resetReleaseDashboard());
    try {
      setIsBoardOpen(false);
      setSubMenuBoards([]);
      setCurrentProjectForBoard(null);
      setSelectedBoard({ id: '', name: '', type: '' });
      setSelectedRelease({ id: '', releaseName: '' });
      sessionStorage.removeItem('boardId');
      sessionStorage.removeItem('releaseId');
      const companyId = getId().companyId;
      const boards = await fetchBoardList(companyId, value);
      const project = getAllProjectList?.find((p) => p._id === value);
      if (!project) return;
      setSelectedProject({ id: project._id, name: project.name });
      if (boards.length > 1) {
        const firstBoard = boards[0];
        const boardId = firstBoard?.id || firstBoard?._id || '';
        setSelectedBoard({
          id: boardId,
          name: firstBoard?.name || firstBoard?.boardName || '',
          type: firstBoard?.type || firstBoard?.boardType || '',
        });
        sessionStorage.setItem('boardId', boardId);
        storeBoardInSession(
          boardId,
          firstBoard?.name || firstBoard?.boardName || '',
          firstBoard?.type || firstBoard?.boardType || '',
        );
        await handleProject(value, firstBoard?.type || firstBoard?.boardType || '', dispatch);
        return;
      }
      if (boards[0]) {
        const boardId = boards[0]?.id || boards[0]?._id || '';
        setSelectedBoard({
          id: boardId,
          name: boards[0]?.name || boards[0]?.boardName || '',
          type: boards[0]?.type || boards[0]?.boardType || '',
        });
        sessionStorage.setItem('boardId', boardId);
        storeBoardInSession(
          boardId,
          boards[0]?.name || boards[0]?.boardName || '',
          boards[0]?.type || boards[0]?.boardType || '',
        );
      }
      await handleProject(value, boards[0]?.type || boards[0]?.boardType || '', dispatch);
    } finally {
      contextSwitchingRef.current = false;
    }
  };

  const handleBoardChange = async (boardId, projectId) => {
    contextSwitchingRef.current = true;
    dispatch(resetReleaseDashboard());
    try {
      const selectedBoardData = subMenuBoards.find((board) => (board.id || board._id) === boardId);
      if (!selectedBoardData) return;
      setSelectedRelease({ id: '', releaseName: '' });
      sessionStorage.removeItem('releaseId');
      const currentProject = getAllProjectList?.find((p) => p._id === projectId);
      if (currentProject) {
        sessionStorage.setItem('boardId', boardId || '');
        storeBoardInSession(
          boardId || '',
          selectedBoardData.name || selectedBoardData.boardName || '',
          selectedBoardData.type || selectedBoardData.boardType || '',
        );
        setSelectedProject({ id: currentProject._id, name: currentProject.name });
        setSelectedBoard({
          id: boardId || '',
          name: selectedBoardData.name || selectedBoardData.boardName || '',
          type: selectedBoardData.type || selectedBoardData.boardType || '',
        });
        await handleProject(
          projectId,
          selectedBoardData.type || selectedBoardData.boardType || '',
          dispatch,
        );
      }
      setIsBoardOpen(false);
      setSubMenuBoards([]);
      setCurrentProjectForBoard(null);
    } finally {
      contextSwitchingRef.current = false;
    }
  };

  const handleProjectHover = async (projectId) => {
    setIsBoardOpen(false);
    setSubMenuBoards([]);
    setCurrentProjectForBoard(null);
    await new Promise((r) => setTimeout(r, 50));
    const companyId = getId().companyId;
    const boards = await fetchBoardList(companyId, projectId);
    if (boards.length > 1) {
      const el = document.querySelector(`[data-project-id="${projectId}"]`);
      const rect = el?.getBoundingClientRect();
      setSubMenuPosition(
        rect ? { top: rect.top, left: rect.right + 10 } : { top: 100, left: 420 },
      );
      setSubMenuBoards(boards);
      setCurrentProjectForBoard(projectId);
      setIsBoardOpen(true);
    }
  };

  const handleProjectMouseLeave = () => {
    setTimeout(() => {
      const submenu = document.querySelector('.board-submenu');
      const projects = document.querySelectorAll('[data-project-id]');
      const stillHover = Array.from(projects).some((el) => el.matches(':hover'));
      if (submenu && !submenu.matches(':hover') && !stillHover) {
        setIsBoardOpen(false);
        setSubMenuBoards([]);
        setCurrentProjectForBoard(null);
      }
    }, 150);
  };

  const handleReleaseChange = async (value) => {
    const currentReleaseId = selectedRelease?.id || sessionStorage.getItem('releaseId') || '';
    if (value === currentReleaseId) {
      setIsReleaseOpen(false);
      return;
    }
    contextSwitchingRef.current = true;
    dispatch(resetReleaseDashboard());
    try {
      await handleRelease(value, dispatch);
      const release = getAllReleaseList.find((r) => r._id === value);
      if (release) {
        contextSwitchingRef.current = false;
        setSelectedRelease({ id: release._id, releaseName: release.releaseName });
        sessionStorage.setItem('releaseId', release._id);
      } else {
        contextSwitchingRef.current = false;
      }
      setIsReleaseOpen(false);
    } finally {
      contextSwitchingRef.current = false;
    }
  };

  const handleOrganizationChange = async (value) => {
    await handleOrganization(value, dispatch);
    setIsOrganizationOpen(false);
  };

  // const releaseBurndownData = jiraData?.burndownData;
  // const hasReleaseBurndown =
  //   selectedRelease?.id &&
  //   releaseBurndownData?.sprintBreakdown &&
  //   Array.isArray(releaseBurndownData.sprintBreakdown) &&
  //   releaseBurndownData.sprintBreakdown.length > 0;
  // const releaseBurndownChartData = hasReleaseBurndown
  //   ? processReleaseBurndownData(releaseBurndownData)
  //   : [];

  const hasContext =
    selectedOrg.id && selectedProject.id && selectedBoard.id && selectedRelease.id;
  const hasData = releaseDashboardState?.data != null;
  const showSpinner =
    releaseDashboardState?.loading ||
    (hasContext && !hasData && !releaseDashboardState?.error);

  /** Navigate to StandUp page with Release selected and scroll to Jira table. Optionally pass filter so the Jira table shows only matching issues (by issue keys or filterType). */
  const navigateToStandupJiraTable = (filter) => {
    if (selectedRelease?.id) {
      dispatch(
        setSelectedTypeValue({
          selectedValueLabel: releaseLabel,
          selectedValue: APP_STRINGS.VALUE_RELEASE,
        }),
      );
      sessionStorage.setItem(APP_STRINGS.SESSION_TYPE_VALUE, APP_STRINGS.VALUE_RELEASE);
      sessionStorage.setItem(APP_STRINGS.SESSION_TYPE_VALUE_LABEL, releaseLabel);
      dispatch(bumpRefreshToken());
    }
    const state = filter ? { jiraTableFilter: filter } : undefined;
    navigate('/standUp#jira-table', { state });
  };

  return (
    <div className="w-screen">
      <CommonLayout>
        {() => (
          <>
            {showSpinner && (
              <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-light-100 bg-opacity-50 dark:bg-secondary-500 dark:bg-opacity-50 text-black dark:text-custom-gray z-50">
                <Spinner />
              </div>
            )}

            <div className="mt-20 ml-0 pb-10 relative transition-all duration-300 min-h-screen overflow-y-auto">
              <div
                className="fixed top-14 z-20 left-[100px] right-0 pl-5 pr-0 pt-4 flex flex-col dark:bg-[#151F2C] bg-[#F0F4F8] dark:shadow-none"
                aria-expanded
              >
                <div className="flex space-x-2 flex-1 items-center pr-5 py-3">
                  {getAllOrgsList.length > 0 && (
                    <div className="flex mt-1">
                      {getAllOrgsList.length === 1 ? (
                        <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-light-200 dark:bg-secondary-400 text-primary dark:text-custom-gray">
                          {selectedOrg.name || getAllOrgsList[0]?.companyName || ''}
                        </span>
                      ) : (
                        <DropdownButton
                          buttonLabel="Select"
                          options={(getAllOrgsList || []).map((org) => ({
                            value: org._id,
                            label: org.companyName,
                          }))}
                          onSelect={handleOrganizationChange}
                          placeholder="Select"
                          selectedOption={selectedOrg.name}
                          isOpen={isOrganizationOpen}
                          setIsOpen={setIsOrganizationOpen}
                          reference={organizationRef}
                          type="organization"
                          width="sm"
                        />
                      )}
                    </div>
                  )}
                  <div className="w-1/7 mt-1 relative">
                    <DropdownButton
                      buttonLabel="Select Project"
                      options={(getAllProjectList || [])
                        ?.filter((p) => p.isSelected && p.hideStatus === false)
                        .map((p) => ({
                          value: p._id,
                          label: p.name,
                          boardCount: projectBoardCount[p._id] || 0,
                          hasMultipleBoards: (projectBoardCount[p._id] || 0) > 1,
                        }))}
                      onSelect={handleProjectChange}
                      onOptionHover={handleProjectHover}
                      onOptionMouseLeave={handleProjectMouseLeave}
                      placeholder="Select Project"
                      selectedOption={selectedProjectDisplayName}
                      isOpen={isProjectOpen}
                      setIsOpen={setIsProjectOpen}
                      reference={projectRef}
                      type="project"
                      width="xl"
                    />
                  </div>

                  {isBoardOpen && subMenuBoards.length > 0 && (
                    <div
                      className="board-submenu fixed z-[9999] bg-white dark:bg-[#182433] rounded-lg shadow-lg border border-gray-200 dark:border-[#30445A] min-w-[200px]"
                      style={{ top: subMenuPosition.top, left: subMenuPosition.left }}
                      onMouseLeave={() => {
                        setTimeout(() => {
                          const el = document.querySelector(
                            `[data-project-id="${currentProjectForBoard}"]`,
                          );
                          if (!el?.matches(':hover')) {
                            setIsBoardOpen(false);
                            setSubMenuBoards([]);
                            setCurrentProjectForBoard(null);
                          }
                        }, 100);
                      }}
                    >
                      <div className="py-2">
                        {subMenuBoards.map((board, index) => (
                          <div
                            key={board.id || board._id || index}
                            className="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#1E2B3A] transition-colors"
                            onClick={() =>
                              handleBoardChange(board.id || board._id, currentProjectForBoard)
                            }
                          >
                            <span className="text-sm text-gray-700 dark:text-[#D9E4F1]">
                              {board.name || board.boardName} ({board.type || board.boardType})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-1">
                    <DropdownButton
                      buttonLabel={`Select ${releaseLabel}`}
                      options={(getAllReleaseList || []).map((r) => ({
                        value: r?._id,
                        label: r?.releaseName,
                        status: r?.status,
                      }))}
                      onSelect={handleReleaseChange}
                      placeholder="Select Release"
                      selectedOption={selectedRelease.releaseName}
                      isOpen={isReleaseOpen}
                      setIsOpen={setIsReleaseOpen}
                      reference={releaseRef}
                      type="release"
                      width="xl"
                    />
                  </div>

                </div>

                <div
                  className="flex mt-1 dark:bg-[#293345] bg-[#D9EAF9] w-full"
                  aria-expanded
                />
              </div>

              {/* Card with tabs only - content will go in a new card below */}
              <div
                className={`mx-5 mt-16 rounded-lg bg-white dark:bg-[#182433] shadow-md overflow-visible ${theme !== 'light' ? 'border border-[#25384F] dark:border-[#30445A]' : ''}`}
                style={theme === 'light' ? { border: '1px solid var(--N-LM-Strk-1, #A6C3DC)' } : undefined}
              >
                <div className="flex gap-2 border-b border-[#D1E2F0] dark:border-[#25384F] pl-2 pr-5 pt-0.5 pb-0">
                  {[
                    { id: 'release-dashboard', label: 'Release Dashboard' },
                    { id: 'investment-profile', label: 'Investment Profile' },
                    { id: 'tab3', label: 'Tab 3' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => { sessionStorage.setItem('releaseDashboardActiveTab', tab.id); setActiveTab(tab.id); }}
                      className={`pl-3 pr-6 py-2 text-base font-medium transition-colors border-b-4 -mb-px ${
                        activeTab === tab.id
                          ? theme === 'light'
                            ? 'text-white border-transparent'
                            : 'text-white dark:text-white border-[#326AEB] dark:border-[#326AEB]'
                          : 'text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-300 dark:hover:text-gray-400'
                      }`}
                      style={
                        theme === 'light'
                          ? {
                              color: 'var(--N-LM-PR1, #24527A)',
                              ...(activeTab === tab.id ? { borderBottomColor: 'var(--N-LM-PR1, #24527A)' } : {}),
                            }
                          : undefined
                      }
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content card - content for selected tab */}
              <div
                className={`mx-5 mt-4 overflow-visible ${activeTab === 'investment-profile' ? '' : 'rounded-lg shadow-md'} ${activeTab !== 'investment-profile' && theme !== 'light' ? 'border border-[#25384F] dark:border-[#30445A] bg-[#182433]' : ''}`}
                style={activeTab !== 'investment-profile' && theme === 'light' ? { border: '1px solid var(--N-LM-Strk-1, #A6C3DC)', backgroundColor: '#FFFFFF' } : undefined}
              >
                <div className={`min-h-[200px] ${activeTab === 'investment-profile' ? '' : 'p-5'}`}>
                  {activeTab === 'release-dashboard' && (
                    <div className="space-y-6 text-[#24527A] dark:text-[#D9E4F1]">
                      {/* Figma layout: left panel (release + 4 metrics) + right card (Accuracy, Open Issues, Critical) */}
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-flex-start">
                        {/* Left panel - Release title + 4 metrics */}
                        <div
                          className="flex-1 min-w-0 space-y-4 rounded-lg p-2"
                          style={theme === 'light' ? { backgroundColor: '#FFFFFF' } : { backgroundColor: '#182433' }}
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <h1
                              className="text-[24px] font-['Inter'] text-white"
                              style={theme === 'light' ? { color: 'var(--N-LM-PR1, #24527A)' } : undefined}
                            >
                              Release: {releaseDashboardState.data?.releaseName || selectedRelease.releaseName || '—'}
                            </h1>
                            {(() => {
                              const statusConfig = theme === 'light'
                                ? {
                                    'on-track': { label: 'On Track', bg: '#E7FFDE', color: '#16A34A', dotBg: '#16A34A' },
                                    'at-risk': { label: 'At Risk', bg: '#FFF6E6', color: '#F8A215', dotBg: '#F8A215' },
                                    'off-track': { label: 'Off Track', bg: '#FFEEEE', color: '#D90F0F', dotBg: '#D90F0F' },
                                  }
                                : {
                                    'on-track': { label: 'On Track', bg: '#213B25', color: '#22C55E', dotBg: '#22C55E' },
                                    'at-risk': { label: 'At Risk', bg: '#30281B', color: '#F59F12', dotBg: '#F59F12' },
                                    'off-track': { label: 'Off Track', bg: '#2F2323', color: '#D90F0F', dotBg: '#D90F0F' },
                                  };
                              const config = statusConfig[releaseStatus] || statusConfig['on-track'];
                              return (
                                <span
                                  className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1 text-sm font-medium"
                                  style={{ backgroundColor: config.bg, color: config.color }}
                                >
                                  <span
                                    className="h-[10px] w-[10px] rounded-full shrink-0"
                                    style={{ backgroundColor: config.dotBg }}
                                  />
                                  {config.label}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex flex-wrap gap-10">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-[#A0A6AD]">Targeted Release Date</div>
                              <div className="mt-1 flex items-center gap-2">
                                <Calendar className="h-4 w-4 shrink-0 text-[#0EA5E9]" />
                                <span className="text-sm font-medium" style={{ color: theme === 'light' ? '#788d9d' : '#fff' }}>
                                  {releaseDashboardState.data?.targetedReleaseDate
                                    ? new Date(releaseDashboardState.data.targetedReleaseDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                    : '—'}
                                </span>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-[#A0A6AD]">Forecasted Date</div>
                              <div className="mt-1 flex items-center gap-2">
                                <Calendar className="h-4 w-4 shrink-0 text-[#0EA5E9]" />
                                <span
                                  className="text-sm font-medium"
                                  style={{
                                    color: !releaseDashboardState.data?.forecastedDate && releaseDashboardState.data?.remainingSprints === 0 ? '#788D9D' : '#fff',
                                  }}
                                >
                                  {!releaseDashboardState.data?.forecastedDate && releaseDashboardState.data?.remainingSprints === 0
                                    ? 'Not Available'
                                    : releaseDashboardState.data?.forecastedDate
                                      ? new Date(releaseDashboardState.data.forecastedDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                      : '—'}
                                </span>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-[#A0A6AD]">Remaining Sprints</div>
                              <div className="mt-1 flex items-center gap-2">
                                <Target className="h-4 w-4 shrink-0 text-[#0EA5E9]" />
                                <span
                                  className="text-sm font-medium"
                                  style={{
                                    color: !releaseDashboardState.data?.forecastedDate && releaseDashboardState.data?.remainingSprints === 0 ? '#788D9D' : '#fff',
                                  }}
                                >
                                  {!releaseDashboardState.data?.forecastedDate && releaseDashboardState.data?.remainingSprints === 0
                                    ? 'Not Available'
                                    : releaseDashboardState.data?.remainingSprints != null
                                      ? `${releaseDashboardState.data.remainingSprints} Sprint${releaseDashboardState.data.remainingSprints !== 1 ? 's' : ''} Left`
                                      : '—'}
                                </span>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-[#A0A6AD]">Avg Velocity</div>
                              <div className="mt-1 flex items-center gap-2">
                                <CircleGauge className="h-4 w-4 shrink-0 text-[#0EA5E9]" />
                                <span className="text-sm font-medium" style={{ color: theme === 'light' ? '#788d9d' : '#fff' }}>
                                  {releaseDashboardState.data?.averageVelocity != null
                                    ? releaseDashboardState.data.averageVelocity
                                    : '—'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right card - Summary metrics (Accuracy Score, Open Issues, Critical) */}
                        <div
                          className="flex shrink-0 flex-row items-stretch overflow-hidden rounded-lg lg:w-[440px]"
                          style={theme === 'light' ? { backgroundColor: '#F0F4F8' } : { backgroundColor: '#212F40' }}
                        >
                          <div
                            className="flex flex-1 flex-row items-center justify-center gap-3 p-4 cursor-pointer"
                          >
                            <div
                              ref={accuracyRef}
                              className="w-16 h-16 shrink-0"
                              onMouseEnter={handleAccuracyEnter}
                              onMouseLeave={handleAccuracyLeave}
                            >
                              <AccuracyScoreDoughnut theme={theme} value={accuracyScoreDetails?.accuracyScore?.[accuracyShowAll ? 'total' : 'latest'] ?? 0} />
                            </div>

                            <div
                              className="flex flex-col text-left text-sm"
                              style={theme === 'light' ? { color: 'var(--N-LM-PR1, #24527A)' } : { color: '#A0A6AD' }}
                            >
                              <span>Accuracy</span>
                              <span>Score</span>
                            </div>
                            {accuracyPopoverRect && <AccuracyScorePopover anchorRect={accuracyPopoverRect} accuracyScoreDetails={accuracyScoreDetails} showAll={accuracyShowAll} onShowAllChange={setAccuracyShowAll} onMouseEnter={handlePopoverEnter} onMouseLeave={handlePopoverLeave} />}
                          </div>
                          <div className="mx-10 h-[64px] w-px shrink-0 self-center bg-[#3C5C79] opacity-100" aria-hidden />
                          <div className="flex flex-1 flex-col items-start justify-center py-4 pl-2 pr-4 text-left">
                            <div className="text-sm" style={theme === 'light' ? { color: 'var(--N-LM-PR1, #24527A)' } : { color: '#A0A6AD' }}>Open Issues</div>
                            <button
                              type="button"
                              disabled={(releaseDashboardState?.data?.riskAndAlert?.openIssueCount ?? 0) <= 0}
                              className="mt-1 text-base font-bold text-[#0EA5E9] underline bg-transparent border-0 p-0 text-left disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline cursor-pointer hover:opacity-80"
                              onClick={() =>
                                navigateToStandupJiraTable(
                                  releaseDashboardState?.data?.riskAndAlert?.openIssues?.length
                                    ? { issueKeys: releaseDashboardState.data.riskAndAlert.openIssues }
                                    : { filterType: 'openIssues' },
                                )
                              }
                            >
                              {releaseDashboardState?.data?.riskAndAlert?.openIssueCount ?? 0}
                            </button>
                          </div>
                          <div className="flex flex-1 flex-col items-start justify-center p-4 text-left">
                            <div className="text-sm" style={theme === 'light' ? { color: 'var(--N-LM-PR1, #24527A)' } : { color: '#A0A6AD' }}>Critical</div>
                            <button
                              type="button"
                              disabled={(releaseDashboardState?.data?.riskAndAlert?.criticalCount ?? 0) <= 0}
                              className="mt-1 text-base font-bold text-[#FC3636] underline bg-transparent border-0 p-0 text-left disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline cursor-pointer hover:opacity-80"
                              onClick={() =>
                                navigateToStandupJiraTable(
                                  releaseDashboardState?.data?.riskAndAlert?.criticalIssues?.length
                                    ? { issueKeys: releaseDashboardState.data.riskAndAlert.criticalIssues }
                                    : { filterType: 'critical' },
                                )
                              }
                            >
                              {releaseDashboardState?.data?.riskAndAlert?.criticalCount ?? 0}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Chart section - full width for both bar and line; Risk & Alerts below when chart visible */}
                      <div className="space-y-3">
                        <div
                          className={`rounded-lg pt-5 pb-3 px-3 flex flex-col ${
                            chartViewType === 'bar' && releaseBurndownChartData.length > 0 ? 'h-[360px] min-h-[360px]' : 'min-h-[280px]'
                          } ${theme !== 'light' ? 'border border-[#25384F] dark:border-[#30445A] bg-[#182433]' : ''}`}
                          style={theme === 'light' ? { backgroundColor: '#FFFFFF', border: '1px solid var(--N-LM-03, #D1E2F0)' } : undefined}
                        >
                          <div className="grid grid-cols-3 items-center gap-2 mb-3 px-1">
                            <h2 className="font-semibold truncate" style={{ fontSize: '18px', color: theme === 'light' ? '#0A2342' : '#FFFFFF' }}>
                              {chartViewType === 'bar'
                                ? 'Release Forecast & Burndown'
                                : 'Release Forecast & Burn-up'}
                            </h2>
                            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-1">
                              {chartViewType === 'line' && (
                                <>
                                  <span className="flex items-center gap-1.5 text-[13px] text-[#A5B3CB]">
                                    <svg width="12" height="12" className="shrink-0" viewBox="0 0 12 12" aria-hidden>
                                      <circle cx="6" cy="6" r="5" fill="none" stroke="#F7A13B" strokeWidth="1.5" strokeDasharray="2 2" />
                                    </svg>
                                    Optimistic
                                  </span>
                                  <span className="flex items-center gap-1.5 text-[13px] text-[#A5B3CB]">
                                    <svg width="12" height="12" className="shrink-0" viewBox="0 0 12 12" aria-hidden>
                                      <circle cx="6" cy="6" r="5" fill="none" stroke="#48A7FF" strokeWidth="1.5" strokeDasharray="2 2" />
                                    </svg>
                                    Likely
                                  </span>
                                  <span className="flex items-center gap-1.5 text-[13px] text-[#A5B3CB]">
                                    <svg width="12" height="12" className="shrink-0" viewBox="0 0 12 12" aria-hidden>
                                      <circle cx="6" cy="6" r="5" fill="none" stroke="#FF4D4F" strokeWidth="1.5" strokeDasharray="2 2" />
                                    </svg>
                                    Pessimistic
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 justify-end">
                              <div className="relative group">
                                <button
                                  type="button"
                                  onClick={() => setChartViewType('bar')}
                                  className={`rounded-[4px] p-1 transition-colors ${
                                    chartViewType === 'bar'
                                      ? theme === 'light'
                                        ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]'
                                        : 'bg-[#066FD1] text-white border-[2px] border-[#066FD1]'
                                      : theme === 'light'
                                        ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]'
                                        : 'border-[1.4px] border-[#6C7A91] bg-[#1E252D]/80 text-[#6C7A91] hover:border-[#6C7A91] hover:text-[#6C7A91] dark:border-[#6C7A91] dark:bg-[#1E252D] dark:text-[#6C7A91] dark:hover:border-[#6C7A91] dark:hover:text-[#6C7A91]'
                                  }`}
                                  aria-label="Bar chart"
                                >
                                  <BarChartIcon className="w-7 h-7" />
                                </button>
                                <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                                Burndown Chart
                                </div>
                              </div>
                              <div className="relative group">
                                <button
                                  type="button"
                                  onClick={() => setChartViewType('line')}
                                  className={`rounded-[4px] p-1 transition-colors ${
                                    chartViewType === 'line'
                                      ? theme === 'light'
                                        ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]'
                                        : 'bg-[#066FD1] text-white border-[2px] border-[#066FD1]'
                                      : theme === 'light'
                                        ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]'
                                        : 'border-[1.4px] border-[#6C7A91] bg-[#1E252D]/80 text-[#6C7A91] hover:border-[#6C7A91] hover:text-[#6C7A91] dark:border-[#6C7A91] dark:bg-[#1E252D] dark:text-[#6C7A91] dark:hover:border-[#6C7A91] dark:hover:text-[#6C7A91]'
                                  }`}
                                  aria-label="Line chart"
                                >
                                  <LineChartIcon className="w-7 h-7" />
                                </button>
                                <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                                Burnup Chart
                                </div>
                              </div>
                            </div>
                          </div>
                          {chartViewType === 'bar' ? (
                            releaseDashboardState.loading ? (
                              <div className="flex-1 flex items-center justify-center min-h-[246px] text-sm text-gray-400">
                                Loading burndown data…
                              </div>
                            ) : releaseDashboardState.error ? (
                              <div className="flex-1 flex items-center justify-center min-h-[246px] text-sm text-red-400">
                                Failed to load burndown data
                              </div>
                            ) : releaseBurndownChartData.length > 0 ? (
                              <div className="flex-1 min-h-0 min-w-0 overflow-hidden w-full">
                                <ReleaseBurndownStackedBar
                                  data={releaseBurndownChartData}
                                  theme={theme}
                                  isHoursBasedProject={isHoursBasedProject}
                                />
                              </div>
                            ) : (
                              <div className="flex-1 flex items-center justify-center min-h-[246px] text-sm text-gray-400">
                                No burndown data available. Select a release to view the chart.
                              </div>
                            )
                          ) : (
                            releaseDashboardState.loading ? (
                              <div className="flex-1 flex items-center justify-center min-h-[246px] text-sm text-gray-400">
                                Loading burn-up data…
                              </div>
                            ) : releaseDashboardState.error ? (
                              <div className="flex-1 flex items-center justify-center min-h-[246px] text-sm text-red-400">
                                Failed to load burn-up data
                              </div>
                            ) : burnupChartData.length > 0 ? (
                              <ReleaseBurnupLineChart
                                data={burnupChartData}
                                theme={theme}
                                insufficientData={burnupInsufficientData}
                                completedSprintCount={burnupCompletedSprintCount}
                              />
                            ) : (
                              <div className="flex-1 flex items-center justify-center min-h-[246px] text-sm text-gray-400">
                                No burn-up data available. Select a release to view the chart.
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      {/* Risk & Alerts - below chart when bar (with data) or line view; inside a card with per-card colors */}
                      {((chartViewType === 'bar' && releaseBurndownChartData.length > 0) || chartViewType === 'line') && (
                        <div
                          className={`rounded-lg p-5 shadow-sm ${theme !== 'light' ? 'border border-[#25384F] dark:border-[#30445A] bg-[#182433]' : ''}`}
                          style={theme === 'light' ? { backgroundColor: '#FFFFFF', border: '1px solid var(--N-LM-Strk-1, #A6C3DC)' } : undefined}
                        >
                          <div className="mb-4">
                            <h2 className="text-[18px] font-semibold dark:text-white" style={theme === 'light' ? { color: '#24527A' } : undefined}>
                              Risk & Alerts
                            </h2>
                            <p className="text-[12px]" style={{ color: theme === 'light' ? '#5580A6' : '#788D9D' }}>
                              Real-Time Risk & Alert Intelligence
                            </p>
                          </div>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {/* Blockers Detected - dark red tint */}
                            <div
                              className={`rounded-lg border p-4 flex gap-2 ${
                                (riskAndAlert?.blockerDetected ?? 0) === 0
                                  ? 'border-[#4A5568] dark:border-[#4A5568] bg-[#4A556866] dark:bg-[#4A556866] opacity-70'
                                  : theme === 'light'
                                    ? ''
                                    : 'border-[#552626] dark:border-[#552626] bg-[#55262666] dark:bg-[#55262666]'
                              }`}
                              style={(riskAndAlert?.blockerDetected ?? 0) > 0 && theme === 'light' ? { backgroundColor: '#FFEFEF', border: '1px solid #FFBFBF' } : undefined}
                            >
                              <div
                                className={`shrink-0 pt-0.5 flex h-8 w-8 items-center justify-center rounded-[5px] ${
                                  (riskAndAlert?.blockerDetected ?? 0) === 0 ? 'bg-[#4A5568]' : ''
                                }`}
                                style={(riskAndAlert?.blockerDetected ?? 0) > 0 ? { backgroundColor: theme === 'light' ? '#FED5D5' : '#493333' } : undefined}
                              >
                                <TriangleAlert
                                  className={`h-5 w-5 ${
                                    (riskAndAlert?.blockerDetected ?? 0) === 0 ? 'text-[#718096]' : 'text-[#DC504E]'
                                  }`}
                                />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span
                                  className={`font-medium mb-2 ${
                                    (riskAndAlert?.blockerDetected ?? 0) === 0 ? 'text-[#718096]' : 'text-[#DC504E]'
                                  }`}
                                >
                                  Blockers Detected
                                </span>
                                <p className={`mb-3 text-sm ${(riskAndAlert?.blockerDetected ?? 0) === 0 ? 'text-[#718096]' : ''}`} style={(riskAndAlert?.blockerDetected ?? 0) > 0 ? { color: theme === 'light' ? '#BC7171' : '#A37878' } : undefined}> {riskAndAlert?.blockerDetected ?? 0} High-priority blockers detected</p>
                                <button
                                  type="button"
                                  disabled={(riskAndAlert?.blockerDetected ?? 0) <= 0}
                                  className={`rounded px-3 py-1.5 text-[10px] text-[#FFFFFF] w-fit disabled:cursor-not-allowed disabled:opacity-50 ${
                                    theme === 'light'
                                      ? 'bg-[#E15E5E] hover:bg-[#D04E4E] disabled:hover:bg-[#E15E5E]'
                                      : 'bg-[#6F3636] hover:bg-[#5C2E2E] disabled:hover:bg-[#6F3636]'
                                  }`}
                                  onClick={() =>
                                  navigateToStandupJiraTable(
                                    releaseDashboardState?.data?.riskAndAlert?.blockerIssues?.length
                                      ? { issueKeys: releaseDashboardState.data.riskAndAlert.blockerIssues }
                                      : { filterType: 'blockers' },
                                  )
                                }
                                >
                                  View Blockers
                                </button>
                              </div>
                            </div>
                            {/* Velocity Drop - dark amber/orange tint */}
                            <div
                              className={`rounded-lg border p-4 flex gap-2 ${
                                theme === 'light'
                                  ? ''
                                  : !riskAndAlert?.velocityDrop
                                    ? 'border-[#4A5568] dark:border-[#4A5568] bg-[#4A556866] dark:bg-[#4A556866] opacity-70'
                                    : 'border-[#5D4F37] dark:border-[#5D4F37] bg-[#3D352066] dark:bg-[#3D352066]'
                              }`}
                              style={theme === 'light' ? { backgroundColor: '#FFF6E7', border: '1px solid #FFD186' } : undefined}
                            >
                              <div
                                className={`shrink-0 pt-0.5 flex h-8 w-8 items-center justify-center rounded-[5px] ${
                                  theme === 'light' ? '' : !riskAndAlert?.velocityDrop ? 'bg-[#4A5568]' : 'bg-[#644A21]'
                                }`}
                                style={theme === 'light' ? { backgroundColor: '#FFE9C4' } : undefined}
                              >
                                <TrendingDown
                                  className={`h-5 w-5 ${theme === 'light' ? 'text-[#F59F12]' : !riskAndAlert?.velocityDrop ? 'text-[#718096]' : 'text-[#F59F12]'}`}
                                />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span
                                  className={`font-medium mb-2 ${
                                    theme === 'light' ? 'text-[#F59F12]' : !riskAndAlert?.velocityDrop ? 'text-[#718096]' : 'text-[#F59F12]'
                                  }`}
                                >
                                  Velocity Drop
                                </span>
                                { riskAndAlert?.velocityDrop ? (
                                  <p className="mb-3 text-sm text-[#A37878]" style={theme === 'light' ? { color: '#B59247' } : undefined}>Velocity has dropped by {riskAndAlert.velocityDrop}% compared to the last 3 sprints</p>
                                ) : (
                                  <p className="mb-3 text-sm text-[#718096]" style={theme === 'light' ? { color: '#B59247' } : undefined}>Insufficient sprint data</p>
                                )}
                              </div>
                            </div>
                            {/* Scope Update - dark blue tint */}
                            <div
                              className={`rounded-lg border p-4 flex gap-2 ${theme !== 'light' ? 'border-[#114077] bg-[#15325966]' : ''}`}
                              style={theme === 'light' ? { backgroundColor: '#D9E9FF', border: '1px solid #8ABFFF' } : undefined}
                            >
                              <div
                                className="shrink-0 pt-0.5 flex h-8 w-8 items-center justify-center rounded-[5px]"
                                style={{ backgroundColor: theme === 'light' ? '#BFDBFF' : '#243760' }}
                              >
                                <RefreshCcwDot className="h-5 w-5 text-[#359DFF]" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium text-[#359DFF] mb-2">Scope Update</span>
                                <p className={theme !== 'light' ? 'text-sm text-[#6184A0]' : ''} style={theme === 'light' ? { fontSize: '12px', color: '#5181A6' } : undefined}>
                                  Scope increased by {riskAndAlert?.scopeUpdate ?? 0}{' '}
                                  {(() => {
                                    const n = Number(riskAndAlert?.scopeUpdate) || 0;
                                    if (isHoursBasedProject) return n === 1 ? 'hour' : 'hours';
                                    return n === 1 ? 'story point' : 'story points';
                                  })()}
                                </p>
                              </div>
                            </div>
                            {/* Insights - dark purple tint */}
                            <div
                              className={`rounded-lg border p-4 flex gap-2 ${theme !== 'light' ? 'border-[#432460] bg-[#43246066]' : ''}`}
                              style={theme === 'light' ? { backgroundColor: '#F0E0FF', border: '1px solid #D2A2FF' } : undefined}
                            >
                              <div
                                className="shrink-0 pt-0.5 flex h-8 w-8 items-center justify-center rounded-[5px]"
                                style={{ backgroundColor: theme === 'light' ? '#E1C1FF' : '#432460' }}
                              >
                                <ScanSearch className="h-5 w-5" style={{ color: theme === 'light' ? '#AE58FF' : '#BA70FF' }} />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium text-[#A34CF4] mb-2">Insights</span>
                                <p className="leading-relaxed" style={{ fontSize: '12px', color: theme === 'light' ? '#8C63B2' : '#8B799C' }}>
                                  Based on current testing pace, UAT may become a bottleneck in 10 days.
                                  Recommend reassigning 2 QA engineers to &apos;Module-B&apos; Regression.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {activeTab === 'investment-profile' && <InvestmentProfile isHoursBasedProject={isHoursBasedProject} />}
                  {activeTab === 'tab3' && (
                    <div className="text-[#24527A] dark:text-[#D9E4F1] text-sm">
                      Tab 3 content goes here.
                    </div>
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

export default ReleaseDashboard;
