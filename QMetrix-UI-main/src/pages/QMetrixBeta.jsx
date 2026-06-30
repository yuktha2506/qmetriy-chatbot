import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import CommonLayout from '../layout/CommonLayout';
import '../assets/css/level1.scss';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import DateRangePicker from '../components/Common/CustomDatePicker';
import DropdownButton from '../components/Common/DropDown';
import { useSelector } from 'react-redux';
import '../assets/css/commonColors.scss';
// For testing purposes we are using unified endpoints. If they work properly, we will remove the commented import later.
// import { fetchGetReleaseReadinessTrends, getId, getBoardList, getCXODashboardData } from '../constants';
import { getId, getBoardList, getCXODashboardData, APP_STRINGS } from '../constants';
// import { getAllOrgsListAPI } from '../constants';
import { CommonFunction } from '../utils/commonFunctions';
import {
  storeBoardInSession,
  restoreBoardFromSession,
  computeProjectDisplayName,
} from '../utils/boardUtils'; // Board utilities import
import { useDispatch } from 'react-redux';
import { setSelectedTypeValue } from '../store/JiraSlices/jiraSlice';
import Spinner from '../components/Common/Spinner';
import { InfoIcon } from '../utils/commonIcons';
import ReactDOMServer from 'react-dom/server';
import getTooltipContent from '../utils/Tooltip';
import tableDataConfig from '../utils/tableDataConfig';
import image from '../assets/images/image.png';
import 'react-tooltip/dist/react-tooltip.css';
import { getBoardLabels } from '../utils/boardUtils';

import '../assets/css/animations.scss';
import Dashboard from '../components/QMetrixBeta/ReleaseReadiness/ReleaseReadinessLevel2';
import EngScore from '../components/QMetrixBeta/EngDashboard/ESDashboard';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
const DoughnutChart = Doughnut;
ChartJS.register(ArcElement, ChartTooltip, Legend);
import { Tooltip as ReactTooltip } from 'react-tooltip';
const getTooltipPlacement = (index) => {
  if (index % 3 === 0) return 'bottom-end';
  if (index % 3 === 1) return 'bottom-start';
  return 'bottom';
};

const Dashboard1 = () => {
  const [accordion, setAccordion] = useState(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedSprint, setSelectedSprint] = useState({ id: '', name: '' });
  const [selectedProject, setSelectedProject] = useState({ id: '', name: '' });
  const [selectedRelease, setSelectedRelease] = useState({ id: '', releaseName: '' });
  const [selectedReleaseDate, setSelectedReleaseDate] = useState({
    id: '',
    startDate: '',
    releaseDate: '',
    overdue: false,
  });
  const [selectedSprintEndDate, setSelectedSprintEndDate] = useState({ id: '', endDate: '' });
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isSprintOpen, setIsSprintOpen] = useState(false);
  const [getStatusCount, setGetStatusCount] = useState([]);
  const [getAllProjectList, setGetAllProjectList] = useState([]);
  const [getAllOrgsList, setGetAllOrgsList] = useState([]);
  const [getAllSprintList, setGetAllSprintList] = useState([]);
  const [value1, setValue1] = useState([null, null]);
  const [currentSprint, setCurrentSprint] = useState({});
  const [currentRelease, setCurrentRelease] = useState({});
  const [isValueOpen, setIsValueOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState({
    label: APP_STRINGS.SELECT_AN_OPTION,
    value: '',
  });
  const [selectedSprintStartDate, setSelectedSprintStartDate] = useState({ id: '', startDate: '' });
  const [actualSprintEndDate, setActualSprintEndDate] = useState({ id: '', completeDate: '' });
  const [sprintDaysInfo, setSprintDaysInfo] = useState({ days: 0, status: '' });
  const [releaseDaysInfo, setReleaseDaysInfo] = useState({ remainingDays: 0 });
  const [getAllReleaseList, setGetAllReleaseList] = useState([]);
  const [getReleaseReadiness, setReleaseReadiness] = useState({});
  const [getReleaseReadinessTrends, setReleaseReadinessTrends] = useState([]);
  const [getEngineeringScoreTrends, setEngineeringScoreTrends] = useState([]);
  const [pagevalue, setPageValue] = useState('7');
  const [chartType, setChartType] = useState('Line');
  const [type, setType] = useState(APP_STRINGS.VALUE_SPRINT);
  const navigate = useNavigate();
  const projectRef = useRef(null);
  const organizationRef = useRef(null);
  const fetchedProjectIdsRef = useRef(new Set()); 
  const [selectedOrg, setSelectedOrg] = useState({ id: '', name: '' });
  const [isOrganizationOpen, setIsOrganizationOpen] = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [projectBoardCount, setProjectBoardCount] = useState({});
  const [subMenuBoards, setSubMenuBoards] = useState([]);
  const [subMenuPosition, setSubMenuPosition] = useState({ top: 0, left: 0 });
  const [currentProjectForBoard, setCurrentProjectForBoard] = useState(null);
  const [selectedBoard, setSelectedBoard] = useState({
    id: '',
    name: '',
    type: '',
  });
  const sprintRef = useRef(null);
  const valueRef = useRef(null);
  const jiraData = useSelector((state) => state.jira || {});
  const cxoData = useSelector((state) => state.cxo || {});
  const dispatch = useDispatch();

  const { handleProject, handleSprint, handleRelease, handleValue, handleOrganization } =
    CommonFunction();

  const selectedProjectDisplayName = computeProjectDisplayName(selectedProject, selectedBoard);
  const { sprintLabel, releaseLabel } = useMemo(() => 
    getBoardLabels({
      projectList: getAllProjectList,
      selectedBoard: selectedBoard,
    }),
    [getAllProjectList, selectedBoard]
  );

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
  useEffect(() => {
    if (jiraData) {
      setLoading(jiraData.loading || false);
      if (jiraData.projectList) {
        setGetAllProjectList(jiraData.projectList || []);
      }
      setSelectedSprint({
        id: jiraData.selectedSprintId || '',
        name: jiraData.selectedSprintName || '',
      });
      setSelectedRelease({
        id: jiraData.selectedReleaseId || '',
        releaseName: jiraData.selectedReleaseName || '',
      });
      setSelectedProject({
        id: jiraData.selectedProjectId || '',
        name: jiraData.selectedProjectName || '',
      });

      const restoredBoard = restoreBoardFromSession();
      if (restoredBoard) {
        setSelectedBoard(restoredBoard);
      }

      setSelectedOrg({
        id: jiraData.selectedOrgId || '',
        name: jiraData.selectedOrgName || '',
      });
      setCurrentSprint(jiraData.Sprint);
      setCurrentRelease(jiraData.Release);
      setIsProjectOpen(jiraData.isProjectOpen || false);
      setIsOrganizationOpen(jiraData.isOrganizationOpen || false);
      setIsSprintOpen(jiraData.isSprintOpen || false);
      setGetStatusCount(jiraData.statusCountData || []);
      setGetAllSprintList(jiraData.sprintList || []);
      setValue1(jiraData.value1 || [null, null]);
      setIsValueOpen(jiraData.isValueOpen || false);
      setSelectedValue({
        label: jiraData.selectedValueLabel || APP_STRINGS.SELECT_AN_OPTION,
        value: jiraData.selectedValue || '',
      });
      setGetAllReleaseList(jiraData.releasesList || []);
      setPageValue(pagevalue);
      setChartType(jiraData.chartType || 'Line');
      setType(jiraData.selectedValue || APP_STRINGS.VALUE_RELEASE);
    }
    if (cxoData) {
      setReleaseReadiness(cxoData.releaseReadinessData || {});
    }
  }, [jiraData, cxoData, pagevalue]);

  useEffect(() => {
    const endDate = new Date(currentSprint?.endDate);
    const formattedEndDate = endDate.toLocaleDateString('en-IN');
    setSelectedSprintEndDate({ id: currentSprint?._id, endDate: formattedEndDate });
    const startDate = currentRelease?.startDate ? new Date(currentRelease.startDate) : null;
    const releaseDate = currentRelease?.releaseDate ? new Date(currentRelease.releaseDate) : null;
    const overdueData = currentRelease?.overdue;
    const formattedReleaseStartDate = startDate ? startDate.toLocaleDateString('en-IN') : 'NA';
    const formattedReleaseDate = releaseDate ? releaseDate.toLocaleDateString('en-IN') : 'NA';
    setSelectedReleaseDate({
      id: currentRelease?._id,
      startDate: formattedReleaseStartDate,
      releaseDate: formattedReleaseDate,
      overdue: overdueData,
    });
  }, [currentSprint, currentRelease]);

  useEffect(() => {
    const endDate = new Date(currentSprint?.endDate);
    const formattedEndDate = endDate.toLocaleDateString('en-IN');
    setSelectedSprintEndDate({ id: currentSprint?._id, endDate: formattedEndDate });

    const startDate = new Date(currentSprint?.startDate);
    const formattedStartDate = startDate.toLocaleDateString('en-IN');
    setSelectedSprintStartDate({ id: currentSprint?._id, startDate: formattedStartDate });

    const formattedReleaseDate = currentRelease?.releaseDate
      ? new Date(currentRelease.releaseDate).toLocaleDateString('en-IN')
      : 'NA';
    const formattedReleaseStartDate = currentRelease?.startDate
      ? new Date(currentRelease.startDate).toLocaleDateString('en-IN')
      : 'NA';
    const overdueData = currentRelease?.overdue;
    setSelectedReleaseDate({
      id: currentRelease?._id,
      startDate: formattedReleaseStartDate,
      releaseDate: formattedReleaseDate,
      overdue: overdueData,
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
  const getWorkingDaysBetweenDates = (startDate, endDate) => {
    let count = 0;
    const curDate = new Date(startDate);

    while (curDate <= endDate) {
      const dayOfWeek = curDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      curDate.setDate(curDate.getDate() + 1);
    }

    return count;
  };

  const metrics = useMemo(
    () => [
      {
        value: 'Release Readiness',
        description: ReactDOMServer.renderToStaticMarkup(
          getTooltipContent(`Release Readiness`, tableDataConfig[`Release Readiness`]),
        ),
        score: getReleaseReadiness?.savedCXO?.releaseReadinessObject?.releaseReadiness || 0,
      },
      {
        value: 'Engineering Score',
        description: ReactDOMServer.renderToStaticMarkup(
          getTooltipContent(`Engineering Score`, tableDataConfig[`Engineering Score`]),
        ),
        score: getReleaseReadiness?.savedCXO?.engineeringScoreObject?.engineeringScore || 0,
      },
      {
        value: 'Release Velocity',
        description: ReactDOMServer.renderToStaticMarkup(
          getTooltipContent(`Release Velocity`, tableDataConfig[`Release Velocity`]),
        ),
        score: '0',
      },
    ],
    [getReleaseReadiness],
  );

  const handleClick = (title, index) => {
    setAccordion((prevIndex) => (prevIndex === index ? null : index));
    setTitle(title);
    setActiveCard((prev) =>
    prev === title ? null : title
  );
  };

  const organizationList = useSelector((state) => state.jira?.organizationList);

  useEffect(() => {
    if (organizationList?.length > 0) {
      setGetAllOrgsList(organizationList);
    }
  }, [organizationList]);

  // For testing purposes we are using this change. If this endpoint works properly, we will remove the commented code later.
  // const { mutate: fetchGetRelaseReadinessTrends } = useMutation({
  //   mutationFn: fetchGetReleaseReadinessTrends,
  //   onSuccess: (releaseReadinessDetails) => {
  //     if (releaseReadinessDetails.status === 200) {
  //       const readinessTrend = releaseReadinessDetails?.data.find(
  //         (item) => item.releaseReadinessTrend,
  //       )?.releaseReadinessTrend;
  //       const engineeringScoreTrend = releaseReadinessDetails?.data.find(
  //         (item) => item.engineeringScoreTrend,
  //       )?.engineeringScoreTrend;
  //       setEngineeringScoreTrends(engineeringScoreTrend);
  //       setReleaseReadinessTrends(readinessTrend);
  //     } else if (releaseReadinessDetails.code === '003') {
  //       setTimeout(() => {
  //         navigate('/auth/login');
  //       }, 2000);
  //     }
  //   },
  //   onError: (error) => {
  //     console.error('Fetching sprints failed:', error.message);
  //   },
  // });
  const { mutate: fetchGetRelaseReadinessTrends } = useMutation({
    mutationFn: (params) => getCXODashboardData({ ...params, sections: 'cxoTrends' }),
    onSuccess: (response) => {
      if (response.status === 200) {
        const trendsData = response?.data?.cxoTrends;
        if (Array.isArray(trendsData)) {
          const readinessTrend = trendsData.find(
            (item) => item.releaseReadinessTrend,
          )?.releaseReadinessTrend;
          const engineeringScoreTrend = trendsData.find(
            (item) => item.engineeringScoreTrend,
          )?.engineeringScoreTrend;
          setEngineeringScoreTrends(engineeringScoreTrend);
          setReleaseReadinessTrends(readinessTrend);
        }
      } else if (response.code === '003') {
        setTimeout(() => {
          navigate('/auth/login');
        }, 2000);
      }
    },
    onError: (error) => {
      console.error('Fetching CXO trends failed:', error.message);
    },
  });
  const handleOrganizationChange = async (value) => {
    try {
      await handleOrganization(value, dispatch);
    } catch (error) {
      console.error('Error handling project selection:', error);
    }
  };
  const handleValueChange = (value) => {
    handleValue(value, dispatch);
    setPageValue('7');
    setType(value.value);
    setSelectedValue(value);
    dispatch(setSelectedTypeValue({ selectedValueLabel: value.label, selectedValue: value.value }));
    setIsValueOpen(false);
    if (value !== 'sprint') {
      setSelectedSprint({ id: '', name: '' });
    }
  };

  const handleProjectChange = async (value) => {
    try {
      setIsBoardOpen(false);
      setSubMenuBoards([]);
      setCurrentProjectForBoard(null);
      setSelectedBoard({ id: '', name: '', type: '' });
      sessionStorage.removeItem('boardId');

      const companyId = getId().companyId;
      const boards = await fetchBoardList(companyId, value);
      
      if (!fetchedProjectIdsRef.current.has(value)) {
        fetchedProjectIdsRef.current.add(value);
        setProjectBoardCount(prev => ({
          ...prev,
          [value]: boards.length
        }));
      }

      if (boards.length > 1) {
        setIsBoardOpen(false);
        setSubMenuBoards([]);
        setCurrentProjectForBoard(null);

        const firstBoard = boards[0];
        const boardId = firstBoard?.id || firstBoard?._id || '';

        const project = getAllProjectList?.find((p) => p._id === value);
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

          sessionStorage.setItem('boardId', boardId);

          storeBoardInSession(
            boardId,
            firstBoard?.name || firstBoard?.boardName || '',
            firstBoard?.type || firstBoard?.boardType || '',
          );

          await handleProject(value, firstBoard?.type || firstBoard?.boardType || '', dispatch);
        }
        return; 
      }
      const project = getAllProjectList?.find((p) => p._id === value);
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

          sessionStorage.setItem('boardId', boardId);

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
          await handleProject(
            projectId,
            selectedBoardData.type || selectedBoardData.boardType || '',
            dispatch,
          );
        }

        setIsBoardOpen(false);
        setSubMenuBoards([]);
        setCurrentProjectForBoard(null);
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
      console.error(' Error handling project hover:', error);
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

  

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isBoardOpen && !event.target.closest('.board-submenu')) {
        setIsBoardOpen(false);
        setSubMenuBoards([]);
        setCurrentProjectForBoard(null);
      }
    };

    if (isBoardOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isBoardOpen]);

  const handleSprintChange = async (value) => {
    setPageValue('7');
    try {
      await handleSprint(value, pagevalue, dispatch);
    } catch (error) {
      console.error('Error handling project selection:', error);
    }

    const selectedSprint = getAllSprintList.find((sprint) => sprint._id === value);
    sessionStorage.setItem('sprintId', selectedSprint._id);
    setSelectedSprint({ id: selectedSprint._id, name: selectedSprint.name });
    sessionStorage.setItem('sprintEndDate', selectedSprint.endDate);
    const endDate = new Date(selectedSprint.endDate);
    const formattedEndDate = endDate.toLocaleDateString('en-IN');
    const startDate = new Date(selectedSprint.startDate);
    const formattedStartDate = startDate.toLocaleDateString('en-IN');
    setSelectedSprintStartDate({ id: selectedSprint._id, startDate: formattedStartDate });
    setSelectedSprintEndDate({ id: selectedSprint._id, endDate: formattedEndDate });
    setType(APP_STRINGS.VALUE_SPRINT);
  };
  const handleReleaseChange = async (value) => {
    setPageValue('7');
    try {
      await handleRelease(value, dispatch);
    } catch (error) {
      console.error('Error handling project selection:', error);
    }

    const releaseSelected = getAllReleaseList.find((release) => release._id === value);
    sessionStorage.setItem('releaseId', releaseSelected._id);
    setSelectedRelease({ id: releaseSelected._id, releaseName: releaseSelected.releaseName });
    sessionStorage.setItem('releaseDate', releaseSelected.releaseDate);
    const overdueData = releaseSelected?.overdue;
    const formattedReleaseDate = releaseSelected?.releaseDate
      ? new Date(releaseSelected.releaseDate).toLocaleDateString('en-IN')
      : 'NA';
    const formattedReleaseStartDate = releaseSelected?.startDate
      ? new Date(releaseSelected.startDate).toLocaleDateString('en-IN')
      : 'NA';
    setSelectedReleaseDate({
      id: releaseSelected?._id,
      startDate: formattedReleaseStartDate,
      releaseDate: formattedReleaseDate,
      overdue: overdueData,
    });
    setIsSprintOpen(false);
    setType(APP_STRINGS.VALUE_RELEASE);
  };
  const handlePageChange = (option) => {
    setPageValue(option.value);
    const companyId = getId().companyId;
    const projectId = getId().projectId;
    const sprintId = getId().sprintId;
    const matchSprintQuery = {
      companyId: companyId,
      projectId: projectId,
      sprintId: sprintId,
      pageValue: option.value,
      value: type.toLowerCase(),
    };
    fetchGetRelaseReadinessTrends(matchSprintQuery);
  };

  const handleDateChange = (newValue) => {
    setValue1(newValue);
  };

  const theme = useSelector((state) => state.theme.theme);
  const themes = useMemo(
    () => ({
      light: {
        backgroundColor: 'white',
        labelColor: 'black',
        gridColor: '#ebeaec',
        borderColor: '#9ea5b1',
      },
      dark: {
        backgroundColor: '#2f3349',
        labelColor: '#D4D4D4',
        gridColor: '#40445a',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
    }),
    [],
  );

  const getChangeColor = useCallback((change) => {
    const rootStyles = getComputedStyle(document.documentElement);

    const getColor = (value) => {
      if (value >= 0 && value < 35) {
        return rootStyles.getPropertyValue('--trisoled-color-primary').trim();
      } else if (value >= 35 && value <= 70) {
        return rootStyles.getPropertyValue('--trisoled-color-secondary').trim();
      } else {
        return rootStyles.getPropertyValue('--trisoled-color-tertiary').trim();
      }
    };

    return getColor(change);
  }, []);

  const textCenter = (metricType) => ({
    id: 'textCenter',
    beforeDatasetsDraw(chart) {
      const { ctx } = chart;
      const dataset = chart.data.datasets[0];
      const meta = chart.getDatasetMeta(0);

      if (meta.data.length) {
        const x = meta.data[0].x;
        const y = meta.data[0].y;
        const value = dataset.data[0] > 0 ? dataset.data[0] : 0;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = themes[theme].labelColor;

        ctx.font = 'bold 15px Arial';

        if (metricType === 'Release Readiness') {
          ctx.fillText(`${value}%`, x, y);
        } else {
          const valueText =
            metricType === 'Engineering Score' || metricType === 'Release Velocity'
              ? `${value}/100`
              : `${value}`;

          ctx.fillText(valueText, x, y);
        }

        ctx.restore();
      }
    },
  });

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '80%',
    plugins: {
      tooltip: {
        enabled: !!selectedProject?.name,
        callbacks: {
          title: () => '',
        },
      },
      legend: {
        display: false,
      },
      datalabels: {
        display: false,
        color: '#000',
        font: {
          size: 16,
          weight: 'bold',
        },
      },
    },
  };

  return (
    <div className="w-screen">
    <CommonLayout>
      {(isCollapsed) => (
        <>
                  {loading && (
                    <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-light-100 bg-opacity-50 dark:bg-secondary-500 dark:bg-opacity-50 text-black dark:text-custom-gray z-50">
                      <Spinner />
                    </div>
                  )}
                  <div>
                  <div className="mt-20 ml-0 pb-10 relative transition-all duration-300">
                    <div
                      className="fixed top-14 z-20 left-[100px] right-0 pl-5 pr-0 py-3 flex flex-col dark:bg-[#151F2C] bg-[#F0F4F8] dark:shadow-none"
                      aria-expanded={!isCollapsed}
                    >
                      {/* First Row - Filters */}
                    <div className="flex items-center justify-between w-full pr-5">
                      <div className="flex space-x-2 items-center flex-wrap">
                        {getAllOrgsList.length > 0 && (
                          <div className="flex mt-1">
                            <DropdownButton
                              buttonLabel="Select"
                              options={getAllOrgsList.map((org) => ({
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
                              width='sm'
                            />
                          </div>
                        )}
                        <div className="w-1/7 mt-1 relative">
                          <DropdownButton
                            buttonLabel="Select Project"
                            options={getAllProjectList?.filter(project => project.isSelected && project.hideStatus === false).map(project => ({
                              value: project._id,
                              label: project.name,
                              boardCount: projectBoardCount[project._id] || 0,
                              hasMultipleBoards: (projectBoardCount[project._id] || 0) > 1,
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
                                  `[data-project-id="${currentProjectForBoard}"]`,
                                );
                                if (!projectElement || !projectElement.matches(':hover')) {
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
                                  onClick={() => {
                                    handleBoardChange(
                                      board.id || board._id,
                                      currentProjectForBoard,
                                    );
                                  }}
                                >
                                  <span className="text-sm text-gray-700 dark:text-[#D9E4F1]">
                                    {board.name || board.boardName} ({board.type || board.boardType}
                                    )
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-1">
                        {(() => {
                          return (
                            <DropdownButton
                              options={[
                                { value: APP_STRINGS.VALUE_SPRINT, label: sprintLabel },
                                { value: APP_STRINGS.VALUE_DATE_RANGE, label: APP_STRINGS.VALUE_DATE_RANGE },
                                { value: APP_STRINGS.VALUE_RELEASE, label: releaseLabel },
                              ]}
                              onSelect={handleValueChange}
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
                      <div>
                        {selectedValue.value === APP_STRINGS.VALUE_SPRINT && (
                          <div className="w-1/7 mt-1">
                            <DropdownButton
                              buttonLabel={`${APP_STRINGS.LABEL_SELECT_PREFIX}${sprintLabel}`}
                              options={getAllSprintList.map((sprint) => ({
                                value: sprint._id,
                                label: sprint.name,
                                state: sprint.state,
                              }))}
                              onSelect={handleSprintChange}
                              placeholder={APP_STRINGS.SELECT_AN_OPTION}
                              selectedOption={selectedSprint?.name}
                              isOpen={isSprintOpen}
                              setIsOpen={setIsSprintOpen}
                              reference={sprintRef}
                              type={APP_STRINGS.API_SPRINT}
                              width="xl"
                            />
                          </div>
                        )}
                        {selectedValue.value === APP_STRINGS.VALUE_RELEASE && (
                          <div className="w-1/7 mt-1">
                            <DropdownButton
                              buttonLabel={`${APP_STRINGS.LABEL_SELECT_PREFIX}${releaseLabel}`}
                              options={getAllReleaseList.map((sprint) => ({
                                value: sprint._id,
                                label: sprint.releaseName,
                                status: sprint.status,
                              }))}
                              onSelect={handleReleaseChange}
                              placeholder={APP_STRINGS.LABEL_SELECT_RELEASE}
                              selectedOption={selectedRelease.releaseName}
                              isOpen={isSprintOpen}
                              setIsOpen={setIsSprintOpen}
                              reference={sprintRef}
                              type={APP_STRINGS.API_RELEASE}
                              width="xl"
                            />
                          </div>
                        )}
                        {selectedValue.value === APP_STRINGS.VALUE_DATE_RANGE && (
                          <div className="mt-1">
                            <DateRangePicker onChange={handleDateChange} value={value1} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center border border-[#E5E5E5] dark:border-[#25384F] rounded-md px-3 py-2 space-x-3 dark:bg-[#151F2C]">
                      <span className="dark:text-[#ffffff] text-[#202020] font-medium text-sm">
                        {APP_STRINGS.LABEL_RAG_STATUS}
                      </span>
                      <span className="w-4 h-4 rounded-full bg-[#1AB26D]" />
                      <span className="w-4 h-4 rounded-full bg-[#FFA33D]" />
                      <span className="w-4 h-4 rounded-full bg-[#FE2E18]" />
                    </div>
                  </div>
                  {/* Second Row - Sprint/Release Dates - full width to right edge */}
                  <div
                    className="flex mt-3 dark:bg-[#293345] bg-[#D9EAF9] pl-8 w-full"
                    aria-expanded={!isCollapsed}
                  >
                    {selectedValue.value === APP_STRINGS.VALUE_SPRINT && selectedSprint.name && (
                      <div className="flex items-center space-x-4 text-md h-[34px] p-2 font-semibold">
                        <div className="dark:text-[#48A7FF] text-[#066FD1]">
                          {sprintLabel} Start & End Date:{' '}
                          <span>{selectedSprintStartDate.startDate}</span> -{' '}
                          <span>{selectedSprintEndDate.endDate}</span>
                        </div>
                        <div className="text-[#F59F12]">
                          Actual {sprintLabel} End Date:{' '}
                          <span className="text-[#F59F12]">
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
                                  ? 'text-red-600'
                                  : 'text-green-600'
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
                      <div className="flex items-center space-x-4 text-md h-[34px] p-2 font-semibold">
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
                              <span className="text-green-500 text-sm font-medium">
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
                                    Release Start & end dates are missing. update them to get full
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
              {/* Third Row - Filters */}
              <div
                className={`grid flex grid-cols-3 gap-4 mt-5 px-5 ${
                  (selectedValue.value === APP_STRINGS.VALUE_SPRINT && selectedSprint.name) ||
                  (selectedValue.value === APP_STRINGS.VALUE_RELEASE &&
                    selectedRelease?.releaseName &&
                    selectedReleaseDate?.releaseDate)
                    ? 'pt-10'
                    : 'pt-4'
                }`}
              >
                {metrics.map((metric, index) => {
                  const achieved = metric.score;
                  const remaining = 100 - achieved;
                  const total = achieved + remaining;
                  let achievedPercent = (achieved / total) * 100;
                  let achievedRounded = Math.round(achievedPercent);
                  let remainingRounded = 100 - achievedRounded;
                  const singleDataChart = {
                    labels: [metric.value, ''],
                    datasets: [
                      {
                        data: [achievedRounded, remainingRounded],
                        backgroundColor: selectedProject?.name
                          ? [
                              theme === 'light' ? '#579B2A' : '#0F873C',
                              theme === 'light' ? '#FF403A' : '#BA3834',
                            ]
                          : [
                              theme === 'light' ? '#E0EDF8' : '#1A2B3C',
                              theme === 'light' ? '#E0EDF8' : '#1A2B3C',
                            ],
                        borderWidth: 0,
                        borderRadius: 10,
                      },
                    ],
                  };
                  const suffix = metric.value === 'Release Readiness' ? ' %' : ' / 100';

                  return (
                    <div
                      key={index}
                      className={`
                        w-1/3 transition-all duration-300
                        ${
                          activeCard && activeCard !== metric.value
                            ? 'blur-[0.5px] opacity-70 pointer-events-none'
                            : ''
                        }
                      `}
                      style={{
                        cursor: 'pointer',
                        borderBottom: selectedProject?.name
                          ? `solid 0.5vh ${getChangeColor(metric.score)}`
                          : theme === 'light'
                          ? 'solid 0.5vh #A5C3DC'
                          : 'solid 0.5vh rgba(28, 94, 145, 0.6)',

                        transition: 'border-bottom-color 0.3s ease, border-bottom-width 0.3s ease',
                        borderRadius: '0 0 8px 8px',
                      }}
                    >
                      <div
                        className={`relative ${
                          accordion === index
                            ? theme === 'light'
                              ? `bg-[#FFFFFF] border ${
                                  selectedProject?.name ? 'border-[#D1E2F0]' : 'border-[#DFEDF8]'
                                }`
                              : 'bg-[#182433]'
                            : theme === 'light'
                            ? `bg-[#FFFFFF] border ${
                                selectedProject?.name ? 'border-[#D1E2F0]' : 'border-[#DFEDF8]'
                              }`
                            : 'bg-white dark:bg-[#182433]'
                        } 
                            h-[164px] rounded-lg p-4 flex flex-col justify-between`}
                        style={{
                          boxShadow:
                            theme === 'light' && accordion === index
                              ? '-4px 0 10px rgba(178, 204, 216, 1), 4px 0 10px rgba(178, 204, 216, 1), 0 -4px 10px rgba(178, 204, 216, 1)'
                              : theme === 'light'
                              ? !selectedProject?.name
                                ? '0 4px 4px rgba(0,0,0,0.1)'
                                : 'none'
                              : accordion === index
                              ? '-4px -4px 8px rgba(28, 94, 145, 0.6), 4px -4px 8px rgba(28, 94, 145, 0.6)'
                              : '-1px -1px 2px rgba(28, 94, 145, 0.4), 1px -1px 2px rgba(28, 94, 145, 0.4)',
                          transition: 'box-shadow 0.3s ease',
                        }}
                      >
                        <div>
                          <img
                            src={image}
                            alt="glow"
                            fetchPriority="high"
                            loading="eager"
                            className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
                            style={{ opacity: theme === 'light' ? 0.18 : 0.25 }}
                          />
                          <div>
                            <div
                              style={{ color: theme === 'light' ? '#0A2342' : '#E4E4E4' }}
                              className={`${
                                accordion === index
                                  ? theme === 'light'
                                    ? 'text-[#0A2342]'
                                    : 'text-white'
                                  : theme === 'light'
                                  ? 'text-[#0A2342]'
                                  : 'text-gray-200 dark:text-white'
                              } text-lg font-normal mb-1`}
                            >
                              <div className="flex justify-between items-center gap-2 ml-12 mr-12">
                                <span>{metric.value}</span>
                                <span
                                  data-tooltip-id={`tooltip-${title}`}
                                  data-tooltip-html={metric.description}
                                  data-tooltip-place={getTooltipPlacement(index + 1)}
                                  data-tooltip-offset="15"
                                  className="w-6 h-6 cursor-pointer items-center"
                                >
                                  <InfoIcon
                                    style={{ color: theme === 'light' ? '#0A2342' : '#A3B1C9' }}
                                  />
                                </span>
                                <ReactTooltip
                                  id={`tooltip-${title}`}
                                  place={getTooltipPlacement(index + 1)}
                                  effect="solid"
                                  offset={1}
                                  float={false}
                                  allowHTML={true}
                                  arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                                  opacity={1}
                                  style={{
                                    backgroundColor: theme === 'dark' ? '#173A5A' : '#0D1621',
                                    borderStyle: 'solid',
                                    borderWidth: '1px',
                                    borderColor: theme === 'dark' ? '#224F78' : '#224F78',
                                    color: 'white',
                                    zIndex: 9999,
                                    padding: '8px',
                                    borderRadius: '5px',
                                    maxWidth: '500px',
                                    whiteSpace: 'normal',
                                    position: 'absolute',
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-4 px-2 ml-8 mr-8">
                              <div className="w-24 h-24">
                                <DoughnutChart
                                  key={theme}
                                  data={singleDataChart}
                                  options={options}
                                  plugins={[textCenter(metric.value)]}
                                />
                              </div>

                              <div
                                className={`flex flex-col justify-center gap-2 text-sm ${
                                  theme === 'light' ? 'text-[#24527A]' : 'text-white'
                                }`}
                              >
                                {metric.value === 'Release Readiness' && (
                                  <>
                                    <div className="flex items-center gap-2">
                                      {selectedProject?.name && (
                                        <span
                                          style={{
                                            backgroundColor:
                                              theme === 'light' ? '#579B2A' : '#0F873C',
                                          }}
                                          className="w-3 h-3 rounded-full"
                                        ></span>
                                      )}
                                      <span>
                                        {selectedProject?.name ? (
                                          `${achievedRounded}${suffix} Completed`
                                        ) : (
                                          <span>--&nbsp;&nbsp;Completed</span>
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {selectedProject?.name && (
                                        <span
                                          style={{
                                            backgroundColor:
                                              theme === 'light' ? '#FF403A' : '#BA3834',
                                          }}
                                          className="w-3 h-3 rounded-full"
                                        ></span>
                                      )}
                                      <span>
                                        {selectedProject?.name ? (
                                          `${remainingRounded}${suffix} Pending`
                                        ) : (
                                          <span>--&nbsp;&nbsp;Pending</span>
                                        )}
                                      </span>
                                    </div>
                                  </>
                                )}
                                <button
                                  className={`dark:bg-[#0E5191] bg-[#24527A] text-white font-semibold px-3 py-1 ml-5 rounded-full flex items-center gap-1 dark:hover:bg-[#0E5191] hover:bg-[#24527A] transition ${
                                    metric.value === 'Release Readiness' ? '' : 'mt-10'
                                  }`}
                                  style={{
                                    backgroundColor:
                                      theme === 'light' && !selectedProject?.name
                                        ? '#B9D6EF'
                                        : undefined,
                                    color:
                                      theme === 'light' && !selectedProject?.name
                                        ? '#FFFFFF'
                                        : undefined,
                                  }}
                                  onClick={() => handleClick(metric.value, index)}
                                  disabled={!selectedProject?.name}
                                >
                                  <span
                                    className={`${
                                      selectedProject?.name
                                        ? 'text-white'
                                        : theme === 'dark'
                                        ? 'text-[#3686D2]'
                                        : ''
                                    }`}
                                    style={{
                                      color:
                                        theme === 'light' && !selectedProject?.name
                                          ? '#FFFFFF'
                                          : undefined,
                                      marginLeft:'0px',
                                    }}
                                  >
                                    {accordion === index ? 'Hide Details' : 'View Details'}
                                  </span>
                                  <span className="text-base">
                                    <svg
                                      className={`w-4 h-4 fill-current ${
                                        selectedProject?.name
                                          ? 'text-white'
                                          : theme === 'light'
                                          ? 'text-white'
                                          : 'text-[#3686D2]'
                                      }`}
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 448 512"
                                    >
                                      <path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z" />
                                    </svg>
                                  </span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {accordion !== null && title === 'Release Readiness' && (
              <>
                <div className="mb-2">
                  <Dashboard
                    getStatusCount={getStatusCount}
                    getReleaseReadiness={getReleaseReadiness}
                    getReleaseReadinessTrends={getReleaseReadinessTrends}
                    pageValue={pagevalue}
                    setPageValue={setPageValue}
                    chartType={chartType}
                    setChartType={setChartType}
                    handlePageChange={handlePageChange}
                    fetchGetRelaseReadinessTrends={fetchGetRelaseReadinessTrends}
                    type={selectedValue.value}
                  />
                </div>
              </>
            )}

            {accordion !== null && title === 'Engineering Score' && (
              <div className="mb-8">
                <EngScore
                  getEngineeringScore={getReleaseReadiness?.savedCXO?.engineeringScoreObject}
                  getReleaseReadiness={getReleaseReadiness?.savedCXO}
                  getEngineeringScoreTrends={getEngineeringScoreTrends}
                  pageValue={pagevalue}
                  setPageValue={setPageValue}
                  chartType={chartType}
                  setChartType={setChartType}
                  handlePageChange={handlePageChange}
                  type={selectedValue.value}
                  fetchGetRelaseReadinessTrends={fetchGetRelaseReadinessTrends}
                />
              </div>
            )}
          </>
        )}
      </CommonLayout>
    </div>
  );
};

export default Dashboard1;
