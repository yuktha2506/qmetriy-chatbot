/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useSelector, useDispatch } from 'react-redux';
// import { useQuery } from '@tanstack/react-query';
import CommonLayout from '../layout/CommonLayout';
import Spinner from '../components/Common/Spinner';
import DropdownButton from '../components/Common/DropDown';
import Modal from '../components/Common/Modal';
import { ListViewIcon } from '../utils/commonIcons';
import { CommonFunction } from '../utils/commonFunctions';
import { setSelectedProject } from '../store/JiraSlices/jiraSlice';
import { getId, getBoardList } from '../constants';
import { fetchTechQualityMetrics, resetTechQuality } from '../store/techQualitySlice/techQualitySlice';
import { storeBoardInSession, restoreBoardFromSession, computeProjectDisplayName } from '../utils/boardUtils';
import {
  TECH_QUALITY_WIDGETS_STORAGE_KEY,
  TECH_QUALITY_WIDGETS,
  TECH_QUALITY_TARGETS,
  SeverityDropdown,
  AddWidgetTypeahead,
  WidgetShell,
  MetricCard,
  TrendCard,
  AddNewWidget,
  TrendUpArrowIcon,
  TrendDownArrowIcon,
} from '../components/techQuality/techIndex';
import '../assets/css/global.scss';
import '../assets/css/techQuality.css';

const TechQuality = () => {
  const dispatch = useDispatch();
  const theme = useSelector((state) => state.theme.theme);
  const jiraData = useSelector((state) => state.jira || {});
  const refreshToken = useSelector((state) => state?.jira?.refreshToken);
  const techQualityFromStore = useSelector((state) => state.techQuality?.data);
  const techQualityLoading = useSelector((state) => state.techQuality?.loading);
  const lastFetchedFor = useSelector((state) => state.techQuality?.lastFetchedFor);
  const { handleOrganization } = CommonFunction();
  const [selectedView, setSelectedView] = useState('grid');
  const [isOrganizationOpen, setIsOrganizationOpen] = useState(false);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const organizationRef = useRef(null);
  const projectRef = useRef(null);
  const [activeWidgetId, setActiveWidgetId] = useState(null);
  const [selectedBoard, setSelectedBoard] = useState(() => restoreBoardFromSession() || { id: '', name: '', type: '' });
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [subMenuBoards, setSubMenuBoards] = useState([]);
  const [subMenuPosition, setSubMenuPosition] = useState({ top: 0, left: 0 });
  const [projectBoardCount, setProjectBoardCount] = useState({});
  const projectHoverTimeoutRef = useRef(null);
  const lastHoveredProjectRef = useRef(null);
  const [selectedSeverity, setSelectedSeverity] = useState('All');
  const [periodByWidgetId, setPeriodByWidgetId] = useState({});

  const techQualityData =
    techQualityFromStore && typeof techQualityFromStore === 'object' && Object.keys(techQualityFromStore).length > 0
      ? techQualityFromStore
      : {};

  const timeToResolutionData = techQualityData?.TimeToResolution ?? techQualityData?.timeToResolution;

  const { companyId, projectId } = getId();
  const boardIdForApi = selectedBoard?.id || sessionStorage.getItem('boardId') || '';

  const hasCachedData =
    techQualityFromStore && typeof techQualityFromStore === 'object' && Object.keys(techQualityFromStore).length > 0;
  const sessionMatchesContext =
    lastFetchedFor &&
    lastFetchedFor.companyId === companyId &&
    lastFetchedFor.projectId === projectId &&
    lastFetchedFor.boardId === boardIdForApi;
  const useCachedDataWithoutSpinner = hasCachedData && sessionMatchesContext;
  const showSpinner = techQualityLoading && !useCachedDataWithoutSpinner;

  const fetchBoardList = useCallback(async (cid, pid) => {
    if (!cid || !pid) return [];
    try {
      const cachedBoards = jiraData?.boardList;
      if (cachedBoards?.length > 0 && pid === jiraData?.selectedProjectId) {
        return cachedBoards;
      }
      const response = await getBoardList(cid, pid);
      if (!response?.data) return [];
      if (Array.isArray(response.data)) return response.data;
      if (Array.isArray(response.data?.boards)) return response.data.boards;
      if (Array.isArray(response.data?.data)) return response.data.data;
      return [];
    } catch (e) {
      console.error('Error fetching board list:', e);
      return [];
    }
  }, [jiraData?.boardList, jiraData?.selectedProjectId]);

  useEffect(() => {
    if (companyId && projectId && boardIdForApi) {
      dispatch(fetchTechQualityMetrics({ companyId, projectId, boardId: boardIdForApi }));
    } else {
      dispatch(resetTechQuality());
    }
  }, [dispatch, companyId, projectId, boardIdForApi, jiraData?.selectedOrgId, jiraData?.selectedProjectId, refreshToken]);

  const organizationList = useSelector((state) => state.jira?.organizationList);
  const orgList = organizationList ?? [];

  const getAllProjectsList = useMemo(
    () =>
      (jiraData?.projectList || []).filter(
        (project) => project.isSelected && project.hideStatus === false,
      ),
    [jiraData?.projectList],
  );

  const selectedOrg = useMemo(
    () => ({
      id: jiraData?.selectedOrgId || '',
      name: jiraData?.selectedOrgName || '',
    }),
    [jiraData?.selectedOrgId, jiraData?.selectedOrgName],
  );

  const selectedProject = useMemo(
    () => ({
      id: jiraData?.selectedProjectId || '',
      name: jiraData?.selectedProjectName || '',
    }),
    [jiraData?.selectedProjectId, jiraData?.selectedProjectName],
  );

  useEffect(() => {
    setIsOrganizationOpen(jiraData.isOrganizationOpen || false);
    setIsProjectOpen(jiraData.isProjectOpen || false);
  }, [jiraData.isOrganizationOpen, jiraData.isProjectOpen]);

  const selectedProjectDisplayName = computeProjectDisplayName(selectedProject, selectedBoard);

  const boards = subMenuBoards;

  const handleOrganizationChange = async (value) => {
    try {
      await handleOrganization(value, dispatch);
    } catch (error) {
      console.error('Error handling organization selection:', error);
    }
  };

  const handleProjectChange = async (value) => {
    const project = getAllProjectsList?.find((p) => p._id === value);
    if (!project) return;
    setIsBoardOpen(false);
    setSubMenuBoards([]);
    setSelectedBoard({ id: '', name: '', type: '' });
    sessionStorage.removeItem('boardId');

    const cid = getId().companyId;
    const boards = await fetchBoardList(cid, value);
    setProjectBoardCount((prev) => ({ ...prev, [value]: boards.length }));

    dispatch(
      setSelectedProject({
        selectedProjectName: project.name,
        selectedProjectId: project._id,
        sonarQubeCombinedScanReport: project.combinedScanData ?? null,
      }),
    );
    sessionStorage.setItem('projectId', project._id);
    sessionStorage.setItem('projectName', project.name);
    dispatch({ type: 'jiraSlice/setIsProjectOpen', payload: false });

    const boardToUse = boards[0];
    if (boardToUse) {
      const boardId = boardToUse.id || boardToUse._id || '';
      setSelectedBoard({
        id: boardId,
        name: boardToUse.name || boardToUse.boardName || '',
        type: boardToUse.type || boardToUse.boardType || '',
      });
      sessionStorage.setItem('boardId', boardId);
      storeBoardInSession(
        boardId,
        boardToUse.name || boardToUse.boardName || '',
        boardToUse.type || boardToUse.boardType || '',
      );
    }
  };

  const handleProjectHover = async (projectId) => {
    if (projectHoverTimeoutRef.current) clearTimeout(projectHoverTimeoutRef.current);
    if (lastHoveredProjectRef.current === projectId) return;
    projectHoverTimeoutRef.current = setTimeout(async () => {
      try {
        lastHoveredProjectRef.current = projectId;
        setIsBoardOpen(false);
        setSubMenuBoards([]);
        await new Promise((r) => setTimeout(r, 50));
        const cid = getId().companyId;
        const boards = await fetchBoardList(cid, projectId);
        setProjectBoardCount((prev) => ({ ...prev, [projectId]: boards.length }));
        if (boards.length > 1) {
          const el = document.querySelector(`[data-project-id="${projectId}"]`);
          if (el) {
            const rect = el.getBoundingClientRect();
            setSubMenuPosition({ top: rect.top, left: rect.right });
          } else {
            setSubMenuPosition({ top: 100, left: 420 });
          }
          setSubMenuBoards(boards);
          setIsBoardOpen(true);
        } else {
          setIsBoardOpen(false);
          setSubMenuBoards([]);
        }
      } catch (err) {
        console.error('Error handling project hover:', err);
      }
    }, 200);
  };

  const handleProjectMouseLeave = () => {
    setTimeout(() => {
      const submenuEl = document.querySelector('.board-submenu');
      const projectEls = document.querySelectorAll('[data-project-id]');
      let overProject = false;
      projectEls.forEach((el) => {
        if (el.matches(':hover')) overProject = true;
      });
      if (submenuEl && !submenuEl.matches(':hover') && !overProject) {
        setIsBoardOpen(false);
        setSubMenuBoards([]);
        lastHoveredProjectRef.current = null;
      }
    }, 150);
  };

  const handleBoardChange = async (boardId) => {
    const boardData = subMenuBoards.find((b) => (b.id || b._id) === boardId);
    if (boardData) {
      sessionStorage.setItem('boardId', boardId || '');
      storeBoardInSession(
        boardId || '',
        boardData.name || boardData.boardName || '',
        boardData.type || boardData.boardType || '',
      );
      setSelectedBoard({
        id: boardId || '',
        name: boardData.name || boardData.boardName || '',
        type: boardData.type || boardData.boardType || '',
      });
      setSubMenuBoards([]);
      setIsBoardOpen(false);
      lastHoveredProjectRef.current = null;
    }
  };
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [pendingDeleteWidgetId, setPendingDeleteWidgetId] = useState(null);
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState(() => {
    try {
      const raw = sessionStorage.getItem(TECH_QUALITY_WIDGETS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const allowed = new Set(TECH_QUALITY_WIDGETS.map((w) => w.id));
      const hidden = Array.isArray(parsed?.hidden) ? parsed.hidden.filter((id) => allowed.has(id)) : [];
      return hidden;
    } catch {
      return [];
    }
  });
  const [widgetOrder, setWidgetOrder] = useState(() => {
    try {
      const raw = sessionStorage.getItem(TECH_QUALITY_WIDGETS_STORAGE_KEY);
      const allowed = new Set(TECH_QUALITY_WIDGETS.map((w) => w.id));
      if (!raw) return TECH_QUALITY_WIDGETS.map((w) => w.id);
      const parsed = JSON.parse(raw);
      const order = Array.isArray(parsed?.order) ? parsed.order.filter((id) => allowed.has(id)) : [];
      const missing = TECH_QUALITY_WIDGETS.map((w) => w.id).filter((id) => !order.includes(id));
      const combined = [...order, ...missing];
      return combined.length ? combined : TECH_QUALITY_WIDGETS.map((w) => w.id);
    } catch {
      return TECH_QUALITY_WIDGETS.map((w) => w.id);
    }
  });
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [addWidgetAnchorId, setAddWidgetAnchorId] = useState(null);
  const [selectedWidgetToAdd, setSelectedWidgetToAdd] = useState(null);
  const contentRef = useRef(null);

  const periodOptions = [
    { label: 'Monthly', value: 'monthly' },
    { label: 'Quarterly', value: 'quarterly' },
    { label: 'Yearly', value: 'yearly' },
  ];

  const getPeriodForWidget = (widgetId) => periodByWidgetId[widgetId] ?? 'monthly';
  const setPeriodForWidget = useCallback((widgetId, period) => {
    setPeriodByWidgetId((prev) => ({ ...prev, [widgetId]: period }));
  }, []);

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const bugRateDataSource = useMemo(() => {
    const api = techQualityData?.bugRate;
    const empty = {
      metric: { lifeTime: 0, trend: 0, status: undefined, high: 0, low: 0 },
      monthly: [],
      quarterly: [],
      yearly: [],
    };
    if (!api || !api.metric) return empty;
    return api;
  }, [techQualityData?.bugRate]);

  const bugRateTrend = useMemo(() => {
    const period = getPeriodForWidget('bugRate');
    const raw = bugRateDataSource?.[period];
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => ({
      label: String(item.period),
      value: toNum(item.value),
    }));
  }, [bugRateDataSource, periodByWidgetId]);

  const timeToResolutionTrend = useMemo(() => {
    const period = getPeriodForWidget('timeToResolution');
    const raw = timeToResolutionData?.[period];
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
      const s = item.bySeverity || {};
      return {
        label: String(item.period),
        critical: toNum(s.critical?.value),
        high: toNum(s.high?.value),
        medium: toNum(s.medium?.value),
        low: toNum(s.low?.value),
      };
    });
  }, [timeToResolutionData, periodByWidgetId]);

  const defectEscapeTrend = useMemo(() => {
    const period = getPeriodForWidget('defectEscapeRatio');
    const raw = techQualityData?.defectEscapeRatio?.[period];
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => ({
      label: String(item.period),
      value: toNum(item.value),
    }));
  }, [techQualityData, periodByWidgetId]);

  const defectAcceptanceTrend = useMemo(() => {
    const period = getPeriodForWidget('defectAcceptanceRatio');
    const raw = techQualityData?.defectAcceptanceRatio?.[period];
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => ({
      label: String(item.period),
      value: toNum(item.value),
    }));
  }, [techQualityData, periodByWidgetId]);

  const periodControlForWidget = (widgetId) => {
    const period = getPeriodForWidget(widgetId);
    const periodLabel = periodOptions.find((o) => o.value === period)?.label ?? 'Monthly';
    return (
      <DropdownButton
        placeholder={periodLabel}
        options={periodOptions}
        selectedOption={periodLabel}
        onSelect={(opt) => setPeriodForWidget(widgetId, opt?.value ?? opt)}
        width="xs"
        height="xs"
        textSize="xs"
        type="default"
        showSearch={false}
      />
    );
  };

  const getTtrMetric = useMemo(() => {
    const m = timeToResolutionData?.metric;
    const fallback = { lifetime: 0, trend: 0, trendStatus: 'NA', high: 0, low: 0 };
    if (!m) return fallback;
    const statusVal = (x) => (x?.status !== undefined && x?.status !== null ? x.status : (x?.trendStatus ?? 'NA'));
    if (selectedSeverity === 'All') {
      return {
        lifetime: m.lifetime ?? 0,
        trend: m.trend ?? 0,
        trendStatus: statusVal(m),
        high: m.high ?? 0,
        low: m.low ?? 0,
      };
    }
    const sev = selectedSeverity.toLowerCase();
    const bySev = m.bySeverity?.[sev] ?? m.bySeverity?.critical;
    if (bySev) {
      return {
        lifetime: bySev.lifetime ?? 0,
        trend: bySev.trend ?? 0,
        trendStatus: statusVal(bySev),
        high: bySev.high ?? 0,
        low: bySev.low ?? 0,
      };
    }
    return {
      lifetime: m.lifetime ?? 0,
      trend: m.trend ?? 0,
      trendStatus: statusVal(m),
      high: m.high ?? 0,
      low: m.low ?? 0,
    };
  }, [timeToResolutionData, selectedSeverity]);

  const renderWidget = (widgetId) => {
    switch (widgetId) {
      case 'bugRate': {
        const m = bugRateDataSource?.metric;
        const lifeTime = m?.lifeTime ?? 0;
        const displayValue = Number(lifeTime) === lifeTime && lifeTime % 1 !== 0 ? Number(lifeTime).toFixed(2) : lifeTime;
        const trend = m?.trend ?? 0;
        const status = m?.status; 
        const high = m?.high ?? 0;
        const low = m?.low ?? 0;
        return (
          <MetricCard
            title="Bug Rate"
            target={TECH_QUALITY_TARGETS.bugRate}
            value={displayValue}
            delta={status === 'NA' || status == null ? (trend === 0 ? '0' : '—') : `${Math.abs(trend)}%`}
            trendStatus={status}
            tooltipText="Bug Rate per Story"
            footerMidValue={high}
            footerRightValue={low}
              bottomBannerClassName="mt-6"
              valueBannerWrapperClassName="mt-9"
              theme={theme}
            />
          );
      }
      case 'timeToResolution': {
        const m = getTtrMetric;
        const trendPct = (m.trendStatus === true || m.trendStatus === false) && typeof m.trend === 'number' ? `${m.trend}%` : '';
        return (
          <MetricCard
            title="Time to Resolution"
            target={TECH_QUALITY_TARGETS.timeToResolution}
            value={m.lifetime}
            valueSuffix="Days"
            delta={trendPct}
            trendStatus={m.trendStatus}
            footerMidValue={m.high}
            footerRightValue={m.low}
            tooltipText="Average Time Taken To Resolve Bugs"
            hideValueBanner
            topControl={
                <div className="flex items-center justify-center gap-4">
                  <SeverityDropdown
                    value={selectedSeverity}
                    onChange={(next) => setSelectedSeverity(next)}
                    options={[
                      { label: 'All', value: 'All' },
                      { label: 'Critical', value: 'Critical' },
                      { label: 'High', value: 'High' },
                      { label: 'Medium', value: 'Medium' },
                      { label: 'Low', value: 'Low' },
                    ]}
                    theme={theme}
                  />
                  <div
                    className={`px-1 pt-0.5 pb-1 rounded-lg flex items-center justify-between gap-1 border min-w-[105px] leading-none ${
                      theme === 'light' ? 'text-[#0A2342] border-[#A6C3DC]' : 'text-white border-[#224F78]'
                    }`}
                    style={{
                      background:
                        theme === 'light'
                          ? 'linear-gradient(180deg, #EFF8FE 0%, #BAE6FD 100%)'
                          : 'linear-gradient(180deg, #2E4F7A 0%, #18304E 100%)',
                    }}
                  >
                  <span className="text-[22px] font-semibold">{m.lifetime}</span>
                    <div className="flex flex-col items-start leading-[1.05]">
                    {(m.trendStatus === true || m.trendStatus === false) && (
                      <span
                        className={`text-[11px] font-semibold flex items-center gap-1 ${
                          m.trendStatus === true ? (theme === 'light' ? 'text-[#22AD38]' : 'text-[#2ad544]') : (theme === 'light' ? 'text-[#CC2018]' : 'text-[#FF6B6B]')
                        }`}
                      >
                        {trendPct}
                        {m.trendStatus === true ? (
                          <TrendUpArrowIcon className={`w-4 h-4 ${theme === 'light' ? 'text-[#22AD38]' : 'text-[#2ad544]'}`} />
                        ) : (
                          <TrendDownArrowIcon className={`w-4 h-4 ${theme === 'light' ? 'text-[#CC2018]' : 'text-[#FF6B6B]'}`} />
                        )}
                      </span>
                    )}
                    {(m.trendStatus === 'NA' || m.trendStatus == null) && (
                      <span className={`text-[11px] font-semibold ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#A3B1C9]'}`}>{m.trend === 0 ? '0' : '—'}</span>
                    )}
                      <span className={`text-[10px] font-semibold ${theme === 'light' ? 'text-[#0A2342]' : 'text-white'}`}>
                        Days
                      </span>
                    </div>
                  </div>
                </div>
              }
              topControlWrapperClassName="mt-9"
              theme={theme}
            />
          );
      }
      case 'defectEscapeRatio': {
        const m = techQualityData?.defectEscapeRatio?.metric;
        const lifeTime = m?.lifeTime ?? 0;
        const trend = m?.trend ?? 0;
        const status = m?.status; 
        const high = m?.high ?? 0;
        const low = m?.low ?? 0;
        return (
          <MetricCard
            title="Defect Escape Ratio"
            target={TECH_QUALITY_TARGETS.defectEscapeRatio}
            value={lifeTime}
            valueSuffix="%"
            delta={status === 'NA' || status == null ? (trend === 0 ? '0' : '—') : `${Math.abs(trend)}%`}
            trendStatus={status}
            tooltipText="Defects that were not caught internally"
            footerMidValue={high}
            footerRightValue={low}
              bottomBannerClassName="mt-6"
              valueBannerWrapperClassName="mt-9"
              theme={theme}
            />
          );
      }
      case 'defectAcceptanceRatio': {
        const m = techQualityData?.defectAcceptanceRatio?.metric;
        const lifeTime = m?.lifeTime ?? 0;
        const trend = m?.trend ?? 0;
        const status = m?.status ?? 'NA';
        const high = m?.high ?? 0;
        const low = m?.low ?? 0;
        const accepted = m?.accepted;
        const reported = m?.reported ?? m?.total;
          return (
            <MetricCard
              title="Defect Acceptance Ratio"
            target={TECH_QUALITY_TARGETS.defectAcceptanceRatio}
            value={lifeTime}
              valueSuffix="%"
            delta={status === 'NA' || status == null ? (trend === 0 ? '0' : '—') : `${Math.abs(trend)}%`}
            trendStatus={status}
            footerMidValue={high}
            footerRightValue={low}
              tooltipText="Defects accepted out of all defects found"
              hideValueBanner
              topControlWrapperClassName="mt-5"
              topControl={
                <div className="flex flex-col items-center justify-center gap-2">
                  <div
                    className={`px-1 py-0.5 rounded-lg flex items-center gap-1 border leading-none ${
                      theme === 'light' ? 'text-[#0A2342] border-[#A6C3DC]' : 'text-white border-[#224F78]'
                    }`}
                    style={{
                      background:
                        theme === 'light'
                          ? 'linear-gradient(180deg, #EFF8FE 0%, #BAE6FD 100%)'
                          : 'linear-gradient(180deg, #2E4F7A 0%, #18304E 100%)',
                    }}
                  >
                  <span className="text-[22px] font-semibold">{lifeTime}</span>
                    <span className="text-base font-semibold">%</span>
                  {(status === true || status === false) && (
                    <span
                      className={`text-[11px] font-semibold flex items-center gap-1 ${
                        status === true ? (theme === 'light' ? 'text-[#22AD38]' : 'text-[#2ad544]') : (theme === 'light' ? 'text-[#CC2018]' : 'text-[#FF6B6B]')
                      }`}
                    >
                      {Math.abs(trend)}%
                      {status === true ? (
                        <TrendUpArrowIcon className={`w-4 h-4 ${theme === 'light' ? 'text-[#22AD38]' : 'text-[#2ad544]'}`} />
                      ) : (
                        <TrendDownArrowIcon className={`w-4 h-4 ${theme === 'light' ? 'text-[#CC2018]' : 'text-[#FF6B6B]'}`} />
                      )}
                    </span>
                  )}
                  {(status === 'NA' || status == null) && (
                    <span className={`text-[11px] font-semibold ${theme === 'light' ? 'text-[#5580A6]' : 'text-[#A3B1C9]'}`}>{trend === 0 ? '0' : '—'}</span>
                  )}
                  </div>
                {accepted != null && reported != null && (
                  <div
                    className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-4 ${
                      theme === 'light' ? 'bg-[#EFF8FE] text-[#0A2342]' : 'bg-[#1A2D46] text-white'
                    }`}
                  >
                    <span>
                      Reported{' '}
                      <span className={`font-semibold ${theme === 'light' ? 'text-[#0072BB]' : 'text-[#3297F4]'}`}>
                        {reported}
                      </span>
                    </span>
                    <span>
                      Accepted{' '}
                      <span className={`font-semibold ${theme === 'light' ? 'text-[#0072BB]' : 'text-[#3297F4]'}`}>
                        {accepted}
                      </span>
                    </span>
                  </div>
                )}
                </div>
              }
              theme={theme}
            />
          );
      }
        default:
          return null;
      }
    };

  const renderTrendForWidget = (widgetId) => {
    const lineColor = theme === 'light' ? '#5580A6' : '#48A7FF';
    switch (widgetId) {
      case 'bugRate':
        return (
          <TrendCard
            title="Bug Rate Trend"
            data={bugRateTrend}
            lines={[{ key: 'value', color: lineColor, label: 'Bug Rate' }]}
            rightControl={periodControlForWidget('bugRate')}
            theme={theme}
          />
        );
      case 'timeToResolution':
        return (
          <TrendCard
            title="Time To Resolution Trend"
            data={timeToResolutionTrend}
            lines={[
              { key: 'critical', color: theme === 'light' ? '#B84446' : '#FF0000' },
              { key: 'high', color: theme === 'light' ? '#D46C0C' : '#F59F12' },
              { key: 'medium', color: theme === 'light' ? '#5580A6' : '#48A7FF' },
              { key: 'low', color: theme === 'light' ? '#269037' : '#64D518' },
            ]}
            rightControl={periodControlForWidget('timeToResolution')}
            theme={theme}
          />
        );
      case 'defectEscapeRatio':
        return (
          <TrendCard
            title="Defect Escape Ratio Trend"
            data={defectEscapeTrend}
            lines={[{ key: 'value', color: lineColor, label: 'Defect Escape Ratio' }]}
            rightControl={periodControlForWidget('defectEscapeRatio')}
            theme={theme}
          />
        );
      case 'defectAcceptanceRatio':
        return (
          <TrendCard
            title="Defect Acceptance Ratio Trend"
            data={defectAcceptanceTrend}
            lines={[{ key: 'value', color: lineColor, label: 'Defect Acceptance Ratio' }]}
            rightControl={periodControlForWidget('defectAcceptanceRatio')}
            theme={theme}
          />
        );
      default:
        return null;
    }
  };

  const visibleWidgetIds = useMemo(() => {
    return widgetOrder.filter((id) => !hiddenWidgetIds.includes(id));
  }, [hiddenWidgetIds, widgetOrder]);

  const hiddenWidgetsForAdd = useMemo(() => {
    return TECH_QUALITY_WIDGETS.filter((w) => hiddenWidgetIds.includes(w.id));
  }, [hiddenWidgetIds]);

  const moveWidget = useCallback(
    (fromIndex, toIndex) => {
      setWidgetOrder((prev) => {
        const visible = prev.filter((id) => !hiddenWidgetIds.includes(id));
        const hidden = prev.filter((id) => hiddenWidgetIds.includes(id));

        const nextVisible = [...visible];
        const [moved] = nextVisible.splice(fromIndex, 1);
        nextVisible.splice(toIndex, 0, moved);

        return [...nextVisible, ...hidden];
      });
    },
    [hiddenWidgetIds],
  );

  const openAddWidgetModal = useCallback((anchorId = null) => {
    setAddWidgetAnchorId(anchorId);
    setSelectedWidgetToAdd(null);
    setIsAddWidgetOpen(true);
  }, []);

  const closeAddWidgetModal = useCallback(() => {
    setIsAddWidgetOpen(false);
    setAddWidgetAnchorId(null);
    setSelectedWidgetToAdd(null);
  }, []);

  const handleDeleteWidget = useCallback((widgetId) => {
    setHiddenWidgetIds((prev) => (prev.includes(widgetId) ? prev : [...prev, widgetId]));
    setActiveWidgetId((prev) => (prev === widgetId ? null : prev));
  }, []);

  const openDeleteConfirm = useCallback((widgetId) => {
    setPendingDeleteWidgetId(widgetId);
    setIsDeleteConfirmOpen(true);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setIsDeleteConfirmOpen(false);
    setPendingDeleteWidgetId(null);
  }, []);

  const confirmDeleteWidget = useCallback(() => {
    if (!pendingDeleteWidgetId) return;
    handleDeleteWidget(pendingDeleteWidgetId);
    closeDeleteConfirm();
  }, [closeDeleteConfirm, handleDeleteWidget, pendingDeleteWidgetId]);

  const handleAddWidgetConfirm = useCallback(() => {
    if (!selectedWidgetToAdd) return;
    const widgetId = selectedWidgetToAdd.value ?? selectedWidgetToAdd;

    setHiddenWidgetIds((prev) => prev.filter((id) => id !== widgetId));
    setWidgetOrder((prev) => {
      const without = prev.filter((id) => id !== widgetId);
      if (!addWidgetAnchorId) return [...without, widgetId];
      const anchorIndex = without.indexOf(addWidgetAnchorId);
      if (anchorIndex === -1) return [...without, widgetId];
      const next = [...without];
      next.splice(anchorIndex + 1, 0, widgetId);
      return next;
    });

    closeAddWidgetModal();
  }, [addWidgetAnchorId, closeAddWidgetModal, selectedWidgetToAdd]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        TECH_QUALITY_WIDGETS_STORAGE_KEY,
        JSON.stringify({
          order: widgetOrder,
          hidden: hiddenWidgetIds,
        }),
      );
    } catch (e) {
        void e;
      }
  }, [hiddenWidgetIds, widgetOrder]);

  useEffect(() => {
    const onOutside = (e) => {
      if (!contentRef.current) return;
      const clickedInside = contentRef.current.contains(e.target);
      if (!clickedInside) {
        setActiveWidgetId(null);
        return;
      }
      if (!activeWidgetId) return;
      const activeEl = contentRef.current.querySelector(`[data-widget-id="${activeWidgetId}"]`);
      if (activeEl && !activeEl.contains(e.target)) {
        setActiveWidgetId(null);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [activeWidgetId]);

  return (
    <CommonLayout>
      {(isCollapsed) => (
        <>
          {showSpinner && (
            <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-light-100 bg-opacity-50 dark:bg-secondary-500 dark:bg-opacity-50 text-black dark:text-custom-gray z-50">
              <Spinner />
            </div>
          )}
          <div className={`${theme === 'light' ? 'bg-[#F0F4F8]' : 'bg-[#151F2C]'} min-h-[calc(100vh-70px)]`}>
          <div className={`sticky top-12 w-full px-[15px] z-10 pt-6 pb-4 mb-[40px] shadow-[0_1px_4px_rgba(0,0,0,0.08)] ${theme === 'light' ? 'bg-[#F0F4F8]' : 'bg-[#151F2C]'}`}>
            <div className="flex items-center justify-between">
              <div className="flex gap-2 w-full">
                {orgList.length > 0 && (
                  <div className="flex">
                    <DropdownButton
                      buttonLabel="Select"
                      options={orgList.map((org) => ({
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
                  </div>
                )}
                <div>
                  <DropdownButton
                    buttonLabel="Select Project"
                    options={getAllProjectsList.map((project) => ({
                      value: project._id,
                      label: project.name,
                      boardCount: projectBoardCount[project._id] ?? 0,
                      hasMultipleBoards: (projectBoardCount[project._id] ?? 0) > 1,
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
                    width="lg"
                  />
                </div>

                {isBoardOpen && boards.length > 0 && (
                  <div
                    className={`board-submenu fixed z-[9999] rounded-lg shadow-lg border min-w-[200px] ${
                      theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#182433] border-[#30445A]'
                    }`}
                    style={{ top: subMenuPosition.top, left: subMenuPosition.left }}
                    onMouseLeave={() => {
                      setTimeout(() => {
                        const submenuEl = document.querySelector('.board-submenu');
                        const projectEls = document.querySelectorAll('[data-project-id]');
                        let overProject = false;
                        projectEls.forEach((el) => {
                          if (el.matches(':hover')) overProject = true;
                        });
                        if (!submenuEl?.matches(':hover') && !overProject) {
                          setIsBoardOpen(false);
                          setSubMenuBoards([]);
                        }
                      }, 100);
                    }}
                  >
                    <div className="py-2">
                      {boards.map((board, index) => (
                        <div
                          key={board.id || board._id || index}
                          className={`px-4 py-2 cursor-pointer transition-colors ${
                            theme === 'light'
                              ? 'hover:bg-gray-100 text-gray-700'
                              : 'hover:bg-[#1E2B3A] text-[#D9E4F1]'
                          }`}
                          onClick={() => handleBoardChange(board.id || board._id)}
                        >
                          <span className="text-sm">
                            {board.name || board.boardName} ({board.type || board.boardType || ''})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative group">
                  <div
                    className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 flex items-center justify-center ${
                      selectedView === 'grid'
                        ? (theme === 'light'
                            ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]'
                            : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                        : (theme === 'light'
                            ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]'
                            : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                    }`}
                    onClick={() => setSelectedView('grid')}
                  >
                    <LayoutGrid
                      className={`w-5 h-5 ${
                        selectedView === 'grid'
                          ? 'text-white'
                          : theme === 'light'
                            ? 'text-[#7EA6CA] group-hover:text-white'
                            : 'text-[#6C7A91]'
                      }`}
                    />
                  </div>
                  <div className={`pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition z-50 ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                    Grid View
                  </div>
                </div>
                <div className="relative group">
                  <ListViewIcon
                    className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                      selectedView === 'list'
                        ? (theme === 'light'
                            ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]'
                            : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                        : (theme === 'light'
                            ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]'
                            : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                    }`}
                    onClick={() => setSelectedView('list')}
                  />
                  <div className={`pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition z-50 ${theme === 'light' ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                    List View
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DndProvider backend={HTML5Backend}>
            <div className="p-4" ref={contentRef}>
              {selectedView === 'grid' ? (
                <div
                  className={`grid gap-5 ${isCollapsed ? 'grid-cols-3' : 'grid-cols-3'} auto-rows-auto`}
                  style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
                >
                  {visibleWidgetIds.map((widgetId, index) => (
                    <WidgetShell
                      key={widgetId}
                      id={widgetId}
                      index={index}
                      isActive={activeWidgetId === widgetId}
                      onActivate={setActiveWidgetId}
                      onAddClick={(id) => openAddWidgetModal(id)}
                      onDeleteClick={openDeleteConfirm}
                      moveWidget={moveWidget}
                      theme={theme}
                    >
                      {renderWidget(widgetId)}
                    </WidgetShell>
                  ))}
                  <AddNewWidget onClick={() => openAddWidgetModal(null)} theme={theme} />
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {visibleWidgetIds.map((widgetId, index) => (
                    <div key={widgetId} className="grid grid-cols-3 gap-5 items-start">
                      <div className="col-span-1">
                        <WidgetShell
                          id={widgetId}
                          index={index}
                          isActive={activeWidgetId === widgetId}
                          onActivate={setActiveWidgetId}
                          onAddClick={(id) => openAddWidgetModal(id)}
                          onDeleteClick={openDeleteConfirm}
                          moveWidget={moveWidget}
                          theme={theme}
                        >
                          {renderWidget(widgetId)}
                        </WidgetShell>
                      </div>

                      <div className="col-span-2 w-full min-w-0">
                        {renderTrendForWidget(widgetId)}
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-3 gap-5 items-start">
                    <div className="col-span-3">
                      <AddNewWidget onClick={() => openAddWidgetModal(null)} theme={theme} />
                    </div>
                  </div>
                </div>
              )}

              <Modal
                isOpen={isAddWidgetOpen}
                onClose={closeAddWidgetModal}
                title="Add Widget"
                titleClassName="ml-2"
                size="small"
                hideHeaderDivider
                panelClassName={`${
                  theme === 'light'
                    ? 'border border-[#D1E2F0] shadow-[0_5.25px_21.02px_rgba(0,0,0,0.2)] min-h-[190px] overflow-visible'
                    : 'bg-[#182433] dark:bg-[#182433] border border-[#25384F] shadow-[0_5.25px_21.02px_rgba(0,0,0,0.8)] min-h-[190px] overflow-visible'
                }`}
                contentClassName="overflow-visible !overflow-y-hidden !max-h-none"
                content={
                  <div className="px-4 pt-4 pb-7 flex flex-col min-h-[150px] overflow-visible">
                    <div className="w-[337px]">
                      <AddWidgetTypeahead
                        options={hiddenWidgetsForAdd.map((w) => ({ label: w.label, value: w.id }))}
                        value={selectedWidgetToAdd}
                        onSelect={(opt) => setSelectedWidgetToAdd(opt)}
                        theme={theme}
                      />
                    </div>
                    <div className="mt-auto pt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={closeAddWidgetModal}
                        className={`px-4 py-1.5 text-sm rounded border ${
                          theme === 'light' ? 'border-[#24527A] text-[#24527A]' : 'border-[#48A7FF] text-[#48A7FF]'
                        } transition-opacity hover:opacity-80`}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddWidgetConfirm}
                        disabled={!hiddenWidgetsForAdd.length || !selectedWidgetToAdd}
                        className={`px-5 py-1.5 text-sm rounded text-white transition-opacity hover:opacity-90 disabled:bg-[#9C9C9C] disabled:opacity-100 disabled:hover:opacity-100 disabled:cursor-not-allowed ${
                          theme === 'light' ? 'bg-[#24527A]' : 'bg-[#2563eb]'
                        }`}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                }
              />

              <Modal
                isOpen={isDeleteConfirmOpen}
                onClose={closeDeleteConfirm}
                title="Delete Widget"
                size="small"
                hideHeaderDivider
                panelClassName={`${
                  theme === 'light'
                    ? 'border border-[#D1E2F0] shadow-[0_5.25px_21.02px_rgba(0,0,0,0.2)]'
                    : 'bg-[#182433] dark:bg-[#182433] border border-[#25384F] shadow-[0_5.25px_21.02px_rgba(0,0,0,0.8)]'
                }`}
                content={
                  <div className={`px-3 pt-2 pb-6 ${theme === 'light' ? 'text-[#24527A]' : 'text-white'}`}>
                    <div className={`text-sm font-light leading-snug ${theme === 'light' ? 'text-[#0A2342]' : ''}`}>
                      Are you sure do you want to delete the widget?
                    </div>

                    <div className="mt-12 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={closeDeleteConfirm}
                        className="w-[68px] px-4 py-1.5 text-sm rounded-lg border border-[#FF0C00] text-[#FF0C00] bg-transparent transition-colors hover:border-[#e60b00] hover:text-[#e60b00]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={confirmDeleteWidget}
                        className="w-[68px] px-4 py-1.5 text-sm rounded-lg bg-[#CC2018] text-white transition-colors hover:bg-[#b71d15]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                }
              />
            </div>
          </DndProvider>
        </div>
        </>
      )}
    </CommonLayout>
  );
};

export default TechQuality;

