import '@fortawesome/fontawesome-free/css/all.min.css';
import { useEffect, useRef, useState } from 'react';
import CommonLayout from '../layout/CommonLayout';
import DropdownButton from '../components/Common/DropDown';
import { useDispatch } from 'react-redux';
import DateRangePicker from '../components/Common/CustomDatePicker';
import { useSelector } from 'react-redux';
import CycleTime from '../components/Jira/CycleTimeAccordion/CycleTimeAccordion';
import Spinner from '../components/Common/Spinner';
// import { useQuery } from '@tanstack/react-query';
// For testing purposes we are using unified endpoints. If they work properly, we will remove the commented import later.
// import { getAllOrgsListAPI,getVelocity,getId, getBoardList, getPlatformName } from '../constants';
import {
  getId,
  getBoardList,
  getPlatformName,
  getProjectManagementData,
  JIRA_DASHBOARD,
} from '../constants';
import { CommonFunction, formatNumberWithSuffix } from '../utils/commonFunctions';
import Tooltip from '../components/Common/ToolTip';
import { setSelectedTypeValue, setSprint, setRelease, setBoardListForProject } from '../store/JiraSlices/jiraSlice';
import '../assets/css/animations.scss';
import { getMetricValue } from '../utils/commonFunctions';
import { setVelocityData } from '../store/JiraSlices/jiraSlice';
import { LayoutGrid } from 'lucide-react';
import { ListViewIcon } from '../utils/commonIcons';
import DefectDensity from '../components/Jira/DefectDensity/defectDensity';
import DreChart from '../components/Jira/DefectRemovalEfficiency/dre';
import DefectLeakageAnalysis from '../components/Jira/DefectLeakageAnalysis/DefectLeakageAnalysis';
import DefectRejectionRatio from '../components/Jira/DefectRejectionRatio/DefectRejectionRatio';
import CostOfFixingDefects from '../components/Jira/CostOfFixingDefects/CostOfFixingDefects';
import TimeToFixBug from '../components/Jira/TimeToFixBug/TimeToFixBug';
import Velocity from '../components/Jira/Velocity/Velocity';
import Burndown from '../components/Jira/Burndown/Burndown';
import BugRateClass from '../components/Jira/BugClassification/BugRateClass';
import IssueType from '../components/Jira/IssueType/IssueType';
import CommittedVsCompleted from '../components/Jira/CommittedVsCompleted/CommittedVsCompleted';
import Dashboard from '../components/Jira/AccordianDashboard/accordianDashboard';
import { getBoardLabels } from '../utils/boardUtils';
import { 
  storeBoardInSession, 
  restoreBoardFromSession, 
  computeProjectDisplayName
} from '../utils/boardUtils'; 

const TeamJeeraInsights = () => {
  const scrollContainerRef = useRef(null);
  const [selectedProject, setSelectedProject] = useState({ id: '', name: '' });
  const [selectedValue, setSelectedValue] = useState({
    label: JIRA_DASHBOARD.SELECT_AN_OPTION,
    value: '',
  });
  const [selectedSprint, setSelectedSprint] = useState({ id: '', name: '' });
  const [selectedSprintData, setSelectedSprintData] = useState([]);
  const [selectedReleaseData, setSelectedReleaseData] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState({ id: '', releaseName: '' });
  const [, setSelectedReleaseDate] = useState({ id: '', releaseDate: '' });
  const [, setSelectedSprintEndDate] = useState({ id: '', endDate: '' });
  const [value1, setValue1] = useState([null, null]);
  const [toggleType, setToggleType] = useState(JIRA_DASHBOARD.STORY_POINTS);
  const [velocityToggleType, setVelocityToggleType] = useState(JIRA_DASHBOARD.STORY_POINTS);
  const [getAllProjectList, setGetAllProjectList] = useState([]);
  const [getAllSprintList, setGetAllSprintList] = useState([]);
  const [getAllReleaseList, setGetAllReleaseList] = useState([]);
  const [getAllOrgsList, setGetAllOrgsList] = useState([]);
  const [currentSprint, setCurrentSprint] = useState({});
  const [currentRelease, setCurrentRelease] = useState({});
  const projectRef = useRef(null);
  const valueRef = useRef(null);
  const sprintRef = useRef(null);
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isValueOpen, setIsValueOpen] = useState(false);
  const [isSprintOpen, setIsSprintOpen] = useState(false);
  const [getStatusCount, setGetStatusCount] = useState([]);
  const [getTaskCountValue, setGetTaskCount] = useState([]);
  const [bugClassificationData, setBugClassificationData] = useState([]);
  const [defectDensity, setDefectDensity] = useState([]);
  const [costOfDefect, setCostOfDefect] = useState([]);
  const [defectLeakage, setDefectLeakage] = useState([]);
  const [velocityData, setVelocityDatas] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState({ id: '', name: '', type: '' });
  const [defectRejectionData, setDefectRejectionData] = useState([]);
  const [defectRemovalEfficiencyData, setDefectRemovalEfficiencyData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [getReleaseReadiness, setReleaseReadiness] = useState({});
  const [cycleTimeData, setCycleTimeData] = useState([]);
  const jiraData = useSelector((state) => state.jira || {});
  const cxoData = useSelector((state) => state.cxo || {});
  const theme = useSelector((state) => state.theme.theme);
  // Board selection state
    const [isBoardOpen, setIsBoardOpen] = useState(false);
    const [projectBoardCount, setProjectBoardCount] = useState({});
    const [subMenuBoards, setSubMenuBoards] = useState([]);
    const [subMenuPosition, setSubMenuPosition] = useState({ top: 0, left: 0 });
    const [currentProjectForBoard, setCurrentProjectForBoard] = useState(null);
  const dispatch = useDispatch();
  const userVelocityPickedRef = useRef(false);
  // For testing purposes we are using unified endpoints. If they work properly, we will remove the commented code later.
  // const fetchData = async (apiCall, action, params) => {
  //   try {
  //     const response = await apiCall(params);
  //     dispatch(action(response.data));
  //   } catch (error) {
  //     console.error('Fetching data failed:', error.message);
  //   }
  // };
  const [selectedView, setSelectedView] = useState(JIRA_DASHBOARD.VIEW_GRID);

  const { handleProject, handleSprint, handleRelease, handleValue, handleOrganization } =
    CommonFunction();
  const organizationRef = useRef(null);
  const [selectedOrg, setSelectedOrg] = useState({ id: '', name: '' });
  const [isOrganizationOpen, setIsOrganizationOpen] = useState(false);

  // For testing purposes we are using this change. If this endpoint works properly, we will remove the commented code later.
  // useEffect(() => {
  //   const matchSprintQuery = {
  //     companyId: sessionStorage.getItem('companyId'),
  //     projectId: sessionStorage.getItem('projectId'),
  //     sprintId: sessionStorage.getItem('sprintId'),
  //     releaseId: sessionStorage.getItem('releaseId'),
  //     repo: sessionStorage.getItem('repo'),
  //     value: selectedValue?.value === 'Sprint' ? 'sprint' : 'release',
  //     estimationType: velocityToggleType === 'Hours' ? 'hours' : 'storyPoints',
  //   };
  //   fetchData(getVelocity, setVelocityData, matchSprintQuery);
  // }, [velocityToggleType, selectedSprint?.id, selectedProject?.id, selectedValue?.value]);
  useEffect(() => {
    const fetchVelocityData = async () => {
      try {
        const response = await getProjectManagementData({
          sections: JIRA_DASHBOARD.SECTION_VELOCITY,
          value:
            selectedValue?.value === JIRA_DASHBOARD.VALUE_SPRINT
              ? JIRA_DASHBOARD.API_SPRINT
              : JIRA_DASHBOARD.API_RELEASE,
          estimationType:
            velocityToggleType === JIRA_DASHBOARD.HOURS
              ? JIRA_DASHBOARD.API_HOURS
              : JIRA_DASHBOARD.API_STORY_POINTS,
        });
        if (response?.data?.velocity !== undefined) {
          dispatch(setVelocityData(response.data.velocity));
        }
      } catch (error) {
        console.error('Fetching velocity data failed:', error.message);
      }
    };
    fetchVelocityData();
  }, [velocityToggleType, selectedSprint?.id, selectedProject?.id, selectedValue?.value]);

  useEffect(() => {
    if (jiraData) {
      setLoading(jiraData.loadingEngMetrics || false);
      setSelectedValue({
        label: jiraData.selectedValueLabel || JIRA_DASHBOARD.SELECT_AN_OPTION,
        value: jiraData.selectedValue || '',
      });
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
      setSelectedOrg({
        id: jiraData.selectedOrgId || '',
        name: jiraData.selectedOrgName || '',
      });
      const selectedProjects = (jiraData.projectList || []).filter(
        (project) => project.isSelected && project.hideStatus === false,
      );
      const restoredBoard = restoreBoardFromSession();
            if (restoredBoard) {
              setSelectedBoard(restoredBoard);
      }
      setGetAllProjectList(selectedProjects);
      setIsOrganizationOpen(jiraData.isOrganizationOpen || false);
      setCurrentSprint(jiraData.Sprint);
      setCurrentRelease(jiraData.Release);
      setGetAllSprintList(jiraData.sprintList || []);
      setGetAllReleaseList(jiraData.releasesList || []);
      setGetStatusCount(jiraData.statusCountData || []);
      setGetTaskCount(jiraData.taskCountData || []);
      setIsProjectOpen(jiraData.isProjectOpen || false);
      setIsSprintOpen(jiraData.isSprintOpen || false);
      setSelectedSprintData(jiraData?.Sprint?.committedVsCompletedMetrics || []);
      setSelectedReleaseData(jiraData?.Release?.committedVsCompletedMetrics || []);
      setBugClassificationData(jiraData.bugClassificationData || []);
      setDefectDensity(jiraData.defectDensityData || []);
      setCostOfDefect(jiraData.costOfFixingDefectData || []);
      setDefectLeakage(jiraData?.dlaData || []);
      setVelocityDatas(jiraData.velocityData || []);
      setDefectRejectionData(jiraData.defectRejectionData || []);
      setDefectRemovalEfficiencyData(jiraData.defectRemovalEfficiencyData || []);
      setCycleTimeData(jiraData.cycleTimeData || []);
    }
    if (cxoData) {
      setReleaseReadiness(cxoData?.releaseReadinessData?.savedCXO || {});
    }
  }, [jiraData, cxoData]);
  useEffect(() => {
    if (selectedProject.id && getAllProjectList.length > 0) {
      const project = getAllProjectList.find((p) => p._id === selectedProject.id);
      const type = project?.estimation?.type || '';

      let selectedEstimationType = type.toLowerCase().includes(JIRA_DASHBOARD.SUBSTRING_STORY_POINT)
        ? JIRA_DASHBOARD.STORY_POINTS
        : JIRA_DASHBOARD.HOURS;

      if (selectedValue?.value === JIRA_DASHBOARD.VALUE_SPRINT) {
        const sprintsForProject = jiraData?.sprintList?.filter(
          (sprint) => sprint.projectId === selectedProject.id,
        );

        const matchedSprint = sprintsForProject?.find((s) => s._id === selectedSprint?.id);

        const metrics = matchedSprint?.committedVsCompletedMetrics;

        const storyPointFields = JIRA_DASHBOARD.STORY_POINT_METRIC_FIELDS;

        const hourFields = JIRA_DASHBOARD.HOUR_METRIC_FIELDS;

        const hasStoryPointData = storyPointFields.some((field) => Number(metrics?.[field]) > 0);
        const hasHourData = hourFields.some((field) => Number(metrics?.[field]) > 0);

        if (hasStoryPointData) {
          selectedEstimationType = JIRA_DASHBOARD.STORY_POINTS;
        } else if (hasHourData) {
          selectedEstimationType = JIRA_DASHBOARD.HOURS;
        }
      }

      setToggleType(selectedEstimationType);
    }
  }, [selectedProject.id, getAllProjectList, selectedValue?.value, jiraData, selectedSprint?.id]);

  useEffect(() => {
    if (!selectedProject?.id || getAllProjectList.length === 0) return;

    if (userVelocityPickedRef.current) return;

    const project = getAllProjectList.find((p) => p._id === selectedProject.id);
    const projectDefaultType = (project?.estimation?.type || '')
      .toLowerCase()
      .includes(JIRA_DASHBOARD.SUBSTRING_STORY_POINT)
      ? JIRA_DASHBOARD.STORY_POINTS
      : JIRA_DASHBOARD.HOURS;

    let selectedVelocityType = projectDefaultType;

    if (selectedValue?.value === JIRA_DASHBOARD.VALUE_SPRINT) {
      const sprintsForProject = jiraData?.sprintList?.filter(
        (s) => s.projectId === selectedProject.id,
      );
      const matchedSprint = sprintsForProject?.find((s) => s._id === selectedSprint?.id);
      const velocity = matchedSprint?.velocity || {};

      const spVelocityFields = JIRA_DASHBOARD.SP_VELOCITY_FIELDS;
      const hrVelocityFields = JIRA_DASHBOARD.HR_VELOCITY_FIELDS;

      const hasSPData = spVelocityFields.some((f) => Number(velocity?.[f]) > 0);
      const hasHourData = hrVelocityFields.some((f) => Number(velocity?.[f]) > 0);

      if (hasSPData) selectedVelocityType = JIRA_DASHBOARD.STORY_POINTS;
      else if (hasHourData) selectedVelocityType = JIRA_DASHBOARD.HOURS;
    }

    if (selectedValue?.value === JIRA_DASHBOARD.VALUE_RELEASE) {
      const releasesForProject = jiraData?.releasesList?.filter(
        (r) => r.projectId === selectedProject.id,
      );
      const matchedRelease = releasesForProject?.find((r) => r._id === selectedRelease?.id);
      const velocity = matchedRelease?.velocity || {};

      const spVelocityFields = JIRA_DASHBOARD.SP_VELOCITY_FIELDS;
      const hrVelocityFields = JIRA_DASHBOARD.HR_VELOCITY_FIELDS;

      const hasHourData = hrVelocityFields.some((f) => Number(velocity?.[f]) > 0);
      const hasSPData = spVelocityFields.some((f) => Number(velocity?.[f]) > 0);

      if (hasHourData) selectedVelocityType = JIRA_DASHBOARD.HOURS;
      else if (hasSPData) selectedVelocityType = JIRA_DASHBOARD.STORY_POINTS;
    }

    setVelocityToggleType(selectedVelocityType);
    sessionStorage.setItem(
      JIRA_DASHBOARD.SESSION_VELOCITY_TOGGLE_TYPE,
      selectedVelocityType === JIRA_DASHBOARD.HOURS
        ? JIRA_DASHBOARD.API_HOURS
        : JIRA_DASHBOARD.API_STORY_POINTS,
    );
  }, [
    selectedProject?.id,
    getAllProjectList,
    selectedValue?.value,
    jiraData,
    selectedSprint?.id,
    selectedRelease?.id,
  ]);

  useEffect(() => {
    const endDate = new Date(currentSprint?.endDate);
    const formattedEndDate = endDate.toLocaleDateString(JIRA_DASHBOARD.LOCALE_EN_IN);
    setSelectedSprintEndDate({ id: currentSprint?._id, endDate: formattedEndDate });
    const releaseDate = new Date(currentRelease?.releaseDate);
    const formattedReleaseDate = releaseDate.toLocaleDateString(JIRA_DASHBOARD.LOCALE_EN_IN);
    setSelectedReleaseDate({ id: currentRelease?._id, releaseDate: formattedReleaseDate });
  }, [currentSprint, currentRelease]);

  const totalIssuesArray = jiraData?.storyPointsData
    ? jiraData.storyPointsData.reduce((acc, item) => {
        if (item.gettotalIssues?.totalIssues !== undefined) {
          acc.push(item.gettotalIssues.totalIssues);
        }
        return acc;
      }, [])
    : [];

  const totalIssues =
    totalIssuesArray.length > 0 ? totalIssuesArray.reduce((sum, num) => sum + num, 0) : 0;

  const items = [
    {
      name: JIRA_DASHBOARD.WIDGET_COMMITTED_VS_COMPLETED,
    },
    {
      name: JIRA_DASHBOARD.WIDGET_CYCLE_TIME,
    },
    {
      name: JIRA_DASHBOARD.WIDGET_ISSUE_TYPE,
    },
    {
      name: JIRA_DASHBOARD.WIDGET_DEFECT_DENSITY,
    },
    {
      name: JIRA_DASHBOARD.WIDGET_DEFECT_REMOVAL_EFFICIENCY,
    },
    {
      name: JIRA_DASHBOARD.WIDGET_DEFECT_LEAKAGE_ANALYSIS,
    },
    {
      name: JIRA_DASHBOARD.WIDGET_DEFECT_REJECTION_RATIO,
    },
    {
      name: JIRA_DASHBOARD.WIDGET_BUG_CLASSIFICATION,
    },
    {
      name: JIRA_DASHBOARD.WIDGET_COST_OF_FIXING_DEFECTS,
    },
    {
      name: JIRA_DASHBOARD.WIDGET_TIME_TO_FIX_BUG,
    },
    {
      name: JIRA_DASHBOARD.WIDGET_VELOCITY,
    },
    {
      name: JIRA_DASHBOARD.WIDGET_BURNDOWN,
    },
  ];

  const widgetDistribution = [2, 2, 3, 2, 2, 3];

  let currentIndex = 0;
  const rows = [];

  for (let count of widgetDistribution) {
    const row = items.slice(currentIndex, currentIndex + count);
    if (row.length > 0) rows.push(row);
    currentIndex += count;
  }

  const organizationList = useSelector((state) => state.jira?.organizationList);

  useEffect(() => {
    if (organizationList?.length > 0) {
      setGetAllOrgsList(organizationList);
    }
  }, [organizationList]);

 const handleProjectChange = async (value) => {
    try {
      userVelocityPickedRef.current = false;
      sessionStorage.removeItem(JIRA_DASHBOARD.SESSION_VELOCITY_TOGGLE_TYPE);
      // Reset board selection when project changes
      setIsBoardOpen(false);
      setSubMenuBoards([]);
      setCurrentProjectForBoard(null);
      setSelectedBoard({ id: '', name: '', type: '' });
      sessionStorage.removeItem(JIRA_DASHBOARD.SESSION_BOARD_ID);

      // Fetch boards for the selected project first
      const companyId = getId().companyId;
      const boards = await fetchBoardList(companyId, value);

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
          sessionStorage.setItem(JIRA_DASHBOARD.SESSION_BOARD_ID, boardId);

          // Store board information in sessionStorage for persistence
          storeBoardInSession(
            boardId,
            firstBoard?.name || firstBoard?.boardName || '',
            firstBoard?.type || firstBoard?.boardType || '',
          );

          // Proceed with normal project selection AFTER boardId is stored
          await handleProject(value, firstBoard?.type || firstBoard?.boardType || '', dispatch);
        }
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
          sessionStorage.setItem(JIRA_DASHBOARD.SESSION_BOARD_ID, boardId);

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
    } catch (error) {
      console.error('Error handling project selection:', error);
    }
  };
  // Function to handle board selection
    const handleBoardChange = async (boardId, projectId) => {
      try {
        const selectedBoardData = subMenuBoards.find((board) => (board.id || board._id) === boardId);
        if (selectedBoardData) {
          const currentProject = getAllProjectList?.find((project) => project._id === projectId);
          if (currentProject) {
            sessionStorage.setItem(JIRA_DASHBOARD.SESSION_BOARD_ID, boardId || '');
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
     // Function to handle hover over project options with multiple boards
      const handleProjectHover = async (projectId) => {
        try {
          setIsBoardOpen(false);
          setSubMenuBoards([]);
          setCurrentProjectForBoard(null);
          await new Promise((resolve) => setTimeout(resolve, 50));
          const companyId = getId().companyId;
          const boards = await fetchBoardList(companyId, projectId);
          if (boards.length > 1) {
            const hoveredElement = document.querySelector(
              `[${JIRA_DASHBOARD.ATTR_DATA_PROJECT_ID}="${projectId}"]`,
            );
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
    
      // Function to handle mouse leave from project options
      const handleProjectMouseLeave = () => {
        setTimeout(() => {
          const submenuElement = document.querySelector(JIRA_DASHBOARD.CLASS_BOARD_SUBMENU);
          const allProjectElements = document.querySelectorAll(JIRA_DASHBOARD.QUERY_DATA_PROJECT_ID);
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
    
      
    
      // Effect to fetch board counts for projects
      useEffect(() => {
        const fetchBoardCounts = async () => {
          if (getAllProjectList.length > 0) {
            const companyId = getId().companyId;
            const boardCounts = {};
    
            for (const project of getAllProjectList) {
              try {
                const boards = await fetchBoardList(companyId, project._id);
                boardCounts[project._id] = boards.length;
              } catch (error) {
                console.error(`Error fetching boards for project ${project._id}:`, error);
                boardCounts[project._id] = 0;
              }
            }
    
            setProjectBoardCount(boardCounts);
          }
        };
    
        fetchBoardCounts();
      }, [getAllProjectList]);
    
      // Effect to handle click outside board submenu
      useEffect(() => {
        const handleClickOutside = (event) => {
          if (isBoardOpen && !event.target.closest(JIRA_DASHBOARD.CLASS_BOARD_SUBMENU)) {
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
  const selectedProjectDisplayName = computeProjectDisplayName(selectedProject, selectedBoard);
  const handleOrganizationChange = async (value) => {
    try {
      await handleOrganization(value, dispatch);
    } catch (error) {
      console.error('Error handling project selection:', error);
    }
  };

  const handleValueChange = (value) => {
    handleValue(value, dispatch);
    setSelectedValue(value);
    dispatch(setSelectedTypeValue({ selectedValueLabel: value.label, selectedValue: value.value }));
    dispatch(setSprint(null));
    dispatch(setRelease(null));
    setSelectedSprintData([]);
    setSelectedReleaseData([]);
    setIsValueOpen(false);
    if (value !== JIRA_DASHBOARD.API_SPRINT) {
      setSelectedSprint({ id: '', name: '' });
    }
  };

  const handleSprintChange = async (value) => {
    try {
      userVelocityPickedRef.current = false;
      sessionStorage.removeItem(JIRA_DASHBOARD.SESSION_VELOCITY_TOGGLE_TYPE);
      await handleSprint(value, dispatch);
    } catch (error) {
      console.error('Error handling project selection:', error);
    }

    const selectedSprint = getAllSprintList.find((sprint) => sprint._id === value);
    setSelectedReleaseData([]);
    setSelectedSprintData(selectedSprint?.committedVsCompletedMetrics);
    sessionStorage.setItem(JIRA_DASHBOARD.SESSION_SPRINT_ID, selectedSprint._id);
    sessionStorage.setItem(JIRA_DASHBOARD.SESSION_VELOCITY_TOGGLE_TYPE, velocityToggleType);
    setSelectedSprint({ id: selectedSprint._id, name: selectedSprint.name });
    sessionStorage.setItem(JIRA_DASHBOARD.SESSION_SPRINT_END_DATE, selectedSprint.endDate);
    const endDate = new Date(selectedSprint.endDate);
    const formattedEndDate = endDate.toLocaleDateString(JIRA_DASHBOARD.LOCALE_EN_IN);
    setSelectedSprintEndDate({ id: selectedSprint._id, endDate: formattedEndDate });
    setIsSprintOpen(false);
  };
  const handleReleaseChange = async (value) => {
    try {
      userVelocityPickedRef.current = false;
      sessionStorage.removeItem(JIRA_DASHBOARD.SESSION_VELOCITY_TOGGLE_TYPE);
      await handleRelease(value, dispatch);
    } catch (error) {
      console.error('Error handling project selection:', error);
    }

    const selectedSprint = getAllReleaseList.find((sprint) => sprint._id === value);
    setSelectedSprintData([]);
    setSelectedReleaseData(selectedSprint?.committedVsCompletedMetrics);
    sessionStorage.setItem(JIRA_DASHBOARD.SESSION_RELEASE_NAME, selectedSprint.releaseName);
    setSelectedRelease({ id: selectedSprint._id, releaseName: selectedSprint.releaseName });
    sessionStorage.setItem(JIRA_DASHBOARD.SESSION_RELEASE_DATE, selectedSprint.releaseDate);
    const releaseDate = new Date(selectedSprint.releaseDate);
    const formattedReleaseDate = releaseDate.toLocaleDateString(JIRA_DASHBOARD.LOCALE_EN_IN);
    setSelectedReleaseDate({ id: selectedSprint._id, releaseDate: formattedReleaseDate });
    setIsSprintOpen(false);
  };

  const handleDateChange = (newValue) => {
    setValue1(newValue);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (projectRef.current && !projectRef.current.contains(event.target)) {
        setIsProjectOpen(false);
      }
      if (valueRef.current && !valueRef.current.contains(event.target)) {
        setIsValueOpen(false);
      }
      if (sprintRef.current && !sprintRef.current.contains(event.target)) {
        setIsSprintOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const { isAzure, isGitLab } = getBoardLabels();

  return (
    <CommonLayout>
      {loading && (
        <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-light-100 bg-opacity-50 dark:bg-secondary-500 dark:bg-opacity-50 text-black dark:text-custom-gray z-50">
          <Spinner />
        </div>
      )}
      <div className="relative transition-all duration-300">
        <div className="sticky top-12 w-full px-[15px] bg-[#F0F4F8] dark:bg-[#151F2C] z-10 pt-6 pb-4 flex justify-between mb-[50px] shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <div className="flex gap-2 w-full">
            {getAllOrgsList.length > 0 && (
              <div className="flex">
                <DropdownButton
                  buttonLabel={JIRA_DASHBOARD.LABEL_SELECT}
                  options={getAllOrgsList.map((org) => ({
                    value: org._id,
                    label: org.companyName,
                  }))}
                  onSelect={handleOrganizationChange}
                  placeholder={JIRA_DASHBOARD.LABEL_SELECT}
                  selectedOption={selectedOrg.name}
                  isOpen={isOrganizationOpen}
                  setIsOpen={setIsOrganizationOpen}
                  reference={organizationRef}
                  type={JIRA_DASHBOARD.DROPDOWN_TYPE_ORGANIZATION}
                  width="sm"
                />
              </div>
            )}
            <div>
              <DropdownButton
                  buttonLabel={JIRA_DASHBOARD.LABEL_SELECT_PROJECT}
                  options={getAllProjectList?.filter(project => project.isSelected && project.hideStatus === false).map(project => ({
                            value: project._id,
                            label: project.name,
                            boardCount: projectBoardCount[project._id] || 0,
                            hasMultipleBoards: (projectBoardCount[project._id] || 0) > 1,
                          }))}
                  onSelect={handleProjectChange}
                  onOptionHover={handleProjectHover}
                  onOptionMouseLeave={handleProjectMouseLeave}
                  placeholder={JIRA_DASHBOARD.LABEL_SELECT_PROJECT}
                  selectedOption={selectedProjectDisplayName}
                  isOpen={isProjectOpen}
                  setIsOpen={setIsProjectOpen}
                  reference={projectRef}
                  type={JIRA_DASHBOARD.DROPDOWN_TYPE_PROJECT}
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
                                  `[${JIRA_DASHBOARD.ATTR_DATA_PROJECT_ID}="${currentProjectForBoard}"]`,
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
            <div>
              {(() => {
                const { sprintLabel, releaseLabel } = getBoardLabels({
                  projectList: getAllProjectList || jiraData?.projectList,
                });
                return (
                  <DropdownButton
                    options={[
                      { value: JIRA_DASHBOARD.VALUE_SPRINT, label: sprintLabel },
                      { value: JIRA_DASHBOARD.VALUE_DATE_RANGE, label: JIRA_DASHBOARD.VALUE_DATE_RANGE },
                      { value: JIRA_DASHBOARD.VALUE_RELEASE, label: releaseLabel },
                    ]}
                    onSelect={handleValueChange}
                    selectedOption={
                      selectedValue.value === JIRA_DASHBOARD.VALUE_SPRINT
                        ? sprintLabel
                        : selectedValue.value === JIRA_DASHBOARD.VALUE_RELEASE
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
            {selectedValue.value === JIRA_DASHBOARD.VALUE_SPRINT && (
              <div>
                <DropdownButton
                  buttonLabel={`${JIRA_DASHBOARD.LABEL_SELECT_PREFIX}${
                    getBoardLabels({ projectList: getAllProjectList || jiraData?.projectList })
                      .sprintLabel
                  }`}
                  options={getAllSprintList.map((sprint) => ({
                    value: sprint._id,
                    label: sprint.name,
                    state: sprint.state,
                  }))}
                  onSelect={handleSprintChange}
                  placeholder={JIRA_DASHBOARD.SELECT_AN_OPTION}
                  selectedOption={selectedSprint.name}
                  isOpen={isSprintOpen}
                  setIsOpen={setIsSprintOpen}
                  reference={sprintRef}
                  type={JIRA_DASHBOARD.API_SPRINT}
                  width="xl"
                />
              </div>
            )}
            {selectedValue.value === JIRA_DASHBOARD.VALUE_RELEASE && (
              <div>
                <DropdownButton
                  buttonLabel={`${JIRA_DASHBOARD.LABEL_SELECT_PREFIX}${(() => {
                    const boardTypeSession = String(
                      sessionStorage.getItem(JIRA_DASHBOARD.SESSION_BOARD_TYPE) || '',
                    ).toLowerCase();
                    const hasAnyAzureBoard =
                      boardTypeSession.includes(JIRA_DASHBOARD.AZURE) ||
                      (Array.isArray(getAllProjectList) &&
                        getAllProjectList.some((p) => {
                          const t = String(
                            p?.boardType || p?.type || p?.projectTypeKey || '',
                          ).toLowerCase();
                          const self = String(p?.self || '').toLowerCase();
                          return (
                            t === JIRA_DASHBOARD.AZURE_BOARD ||
                            t === JIRA_DASHBOARD.AZURE_BOARD_KEBAB ||
                            t.includes(JIRA_DASHBOARD.AZURE) ||
                            self.includes(JIRA_DASHBOARD.DEV_AZURE_COM)
                          );
                        })) ||
                      (Array.isArray(jiraData?.projectList) &&
                        jiraData.projectList.some((p) => {
                          const t = String(
                            p?.boardType || p?.type || p?.projectTypeKey || '',
                          ).toLowerCase();
                          const self = String(p?.self || '').toLowerCase();
                          return (
                            t === JIRA_DASHBOARD.AZURE_BOARD ||
                            t === JIRA_DASHBOARD.AZURE_BOARD_KEBAB ||
                            t.includes(JIRA_DASHBOARD.AZURE) ||
                            self.includes(JIRA_DASHBOARD.DEV_AZURE_COM)
                          );
                        }));
                    return hasAnyAzureBoard ? JIRA_DASHBOARD.LABEL_EPIC : JIRA_DASHBOARD.VALUE_RELEASE;
                  })()}`}
                  options={getAllReleaseList.map((sprint) => ({
                    value: sprint._id,
                    label: sprint.releaseName,
                    status: sprint.status,
                  }))}
                  onSelect={handleReleaseChange}
                  placeholder={JIRA_DASHBOARD.SELECT_AN_OPTION}
                  selectedOption={selectedRelease.releaseName}
                  isOpen={isSprintOpen}
                  setIsOpen={setIsSprintOpen}
                  reference={sprintRef}
                  type={JIRA_DASHBOARD.API_RELEASE}
                  width="xl"
                />
              </div>
            )}
            {selectedValue.value === JIRA_DASHBOARD.VALUE_DATE_RANGE && (
              <DateRangePicker onChange={handleDateChange} value={value1} />
            )}
            <div className="flex items-center border border-[#A6C3DC] dark:border-[#25384F] rounded-md ml-auto px-3 py-2 space-x-3 bg-white dark:bg-[#151F2C] r-0">
              <span className="text-[#24527A] dark:text-white font-medium text-sm">{JIRA_DASHBOARD.LABEL_RAG_STATUS}</span>
              <span className="w-4 h-4 rounded-full bg-[#64D518]" />
              <span className="w-4 h-4 rounded-full bg-[#F59F12]" />
              <span className="w-4 h-4 rounded-full bg-[#FF0000]" />
            </div>
          </div>
        </div>
        <div
          ref={scrollContainerRef}
          className="m-4 flex flex-col gap-5 p-4 transition-all duration-300 relative border border-[#7896AE] dark:border-[#25384F] rounded-lg"
        >
          <div className="flex justify-between items-center">
            <h1 className="text-[#0A2342] dark:text-white text-2xl font-semibold">{getPlatformName(isGitLab, isAzure)}</h1>
            <div className="flex items-center gap-2">
              <div className="relative group">
                <div
                  className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 flex items-center justify-center ${
                    selectedView === JIRA_DASHBOARD.VIEW_GRID
                      ? (theme === JIRA_DASHBOARD.THEME_LIGHT ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                      : (theme === JIRA_DASHBOARD.THEME_LIGHT ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                  }`}
                  onClick={() => setSelectedView(JIRA_DASHBOARD.VIEW_GRID)}
                >
                  <LayoutGrid className={`w-5 h-5 ${selectedView === JIRA_DASHBOARD.VIEW_GRID ? 'text-white' : theme === JIRA_DASHBOARD.THEME_LIGHT ? 'text-[#7EA6CA] group-hover:text-white' : 'text-[#6C7A91]'}`} />
                </div>
                <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition z-50 ${theme === JIRA_DASHBOARD.THEME_LIGHT ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                  {JIRA_DASHBOARD.LABEL_GRID_VIEW}
                </div>
              </div>
              <div className="relative group">
                <ListViewIcon
                  className={`w-9 h-9 cursor-pointer rounded-[4px] p-1 ${
                    selectedView === JIRA_DASHBOARD.VIEW_LIST
                      ? (theme === JIRA_DASHBOARD.THEME_LIGHT ? 'text-white bg-[#24527A] border-[2px] border-[#24527A]' : 'text-white bg-[#066FD1] border-[2px] border-[#066FD1]')
                      : (theme === JIRA_DASHBOARD.THEME_LIGHT ? 'text-[#7EA6CA] border-[1.4px] border-[#7EA6CA] hover:bg-[#7EA6CA] hover:text-white hover:border-[#7EA6CA]' : 'text-[#6C7A91] border-[1.4px] border-[#6C7A91B2] hover:bg-[#374B5D] hover:border-[#6C7A91B2]')
                  }`}
                  onClick={() => setSelectedView(JIRA_DASHBOARD.VIEW_LIST)}
                />
                <div className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[11px] text-white whitespace-nowrap text-center opacity-0 group-hover:opacity-100 transition z-50 ${theme === JIRA_DASHBOARD.THEME_LIGHT ? 'bg-[#0D1621]' : 'bg-[#173A5A] border border-[#224F78]'}`}>
                  {JIRA_DASHBOARD.LABEL_LIST_VIEW}
                </div>
              </div>
            </div>
          </div>
          {selectedView === JIRA_DASHBOARD.VIEW_GRID ? (
            rows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className={`flex flex-col transition-opacity duration-300 ${
                  loading ? 'opacity-50 pointer-events-none' : 'opacity-100'
                }`}
              >
                <div className="flex gap-5">
                  {row.map((item, itemIndex) => {
                    const committed = getMetricValue({
                      selectedValue,
                      toggleType,
                      selectedSprintData,
                      selectedReleaseData,
                      metricType: JIRA_DASHBOARD.METRIC_COMMITTED,
                    });
                    const completed = getMetricValue({
                      selectedValue,
                      toggleType,
                      selectedSprintData,
                      selectedReleaseData,
                      metricType: JIRA_DASHBOARD.METRIC_COMPLETED,
                    });

                    const bugRatio =
                      Array.isArray(bugClassificationData) &&
                      bugClassificationData[0]?.bugRate?.bugRatio;
                    const rejectionRatio =
                      Array.isArray(defectRejectionData) &&
                      defectRejectionData[0]?.defectRejectedRate?.defectRejectionRatio;
                    const density =
                      Array.isArray(defectDensity) &&
                      defectDensity[0]?.defectDensity?.defectDensity;
                    const defectLeakageValue =
                      Array.isArray(defectLeakage) &&
                      Array.isArray(defectLeakage[0]?.dlaSprintOrRelease)
                        ? defectLeakage[0]?.dlaSprintOrRelease[0]?.dla ?? 0
                        : 0;
                    const bugCost = Array.isArray(costOfDefect) && costOfDefect[0]?.totalBugCost;
                    const timeToFix =
                      getReleaseReadiness?.engineeringScoreObject?.developerScoreObject?.timeToFix
                        ?.averageTimeToFix;
                    const cycleTime = Math.round(
                      cycleTimeData?.cycleTime?.cycleTimeTrend[0]?.overall?.cycleTime || 0,
                    );
                    const defectRemoval =
                      Array.isArray(defectRemovalEfficiencyData) &&
                      defectRemovalEfficiencyData[0]?.defectRemovalValue?.defectRemovalPercentage;

                    const value =
                      committed > 0 && item.name === JIRA_DASHBOARD.WIDGET_COMMITTED_VS_COMPLETED ? (
                        <span style={{ whiteSpace: 'nowrap' }} className="group">
                          <Tooltip content={committed.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                            <span>{formatNumberWithSuffix(committed).formatted}</span>
                          </Tooltip>
                          <span className="text-xl p-1">{JIRA_DASHBOARD.TEXT_VS}</span>
                          <Tooltip content={completed.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                            <span>{formatNumberWithSuffix(completed).formatted}</span>
                          </Tooltip>
                        </span>
                      ) : item.name === JIRA_DASHBOARD.WIDGET_ISSUE_TYPE ? (
                        <Tooltip content={totalIssues.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                          <span>{formatNumberWithSuffix(totalIssues).formatted}</span>
                        </Tooltip>
                      ) : bugRatio >= 0 && item.name === JIRA_DASHBOARD.WIDGET_BUG_CLASSIFICATION ? (
                        <Tooltip content={bugRatio.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                          <span>{formatNumberWithSuffix(bugRatio).formatted}</span>
                        </Tooltip>
                      ) : rejectionRatio >= 0 && item.name === JIRA_DASHBOARD.WIDGET_DEFECT_REJECTION_RATIO ? (
                        <Tooltip content={rejectionRatio.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                          <span>{formatNumberWithSuffix(rejectionRatio).formatted}</span>
                        </Tooltip>
                      ) : density >= 0 && item.name === JIRA_DASHBOARD.WIDGET_DEFECT_DENSITY ? (
                        <Tooltip content={density.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                          <span>{formatNumberWithSuffix(density).formatted}</span>
                        </Tooltip>
                      ) : item.name === JIRA_DASHBOARD.WIDGET_BURNDOWN ? (
                        <Tooltip
                          content={(
                            getReleaseReadiness?.releaseReadinessObject?.burndown
                              ?.burndownPercentage || 0
                          ).toLocaleString()}
                          position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}
                        >
                          <span>
                            {
                              formatNumberWithSuffix(
                                getReleaseReadiness?.releaseReadinessObject?.burndown
                                  ?.burndownPercentage || 0,
                              ).formatted
                            }
                          </span>
                        </Tooltip>
                      ) : item.name === JIRA_DASHBOARD.WIDGET_DEFECT_LEAKAGE_ANALYSIS && defectLeakageValue >= 0 ? (
                        <Tooltip content={defectLeakageValue.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                          <span>{formatNumberWithSuffix(defectLeakageValue).formatted}</span>
                        </Tooltip>
                      ) : item.name === JIRA_DASHBOARD.WIDGET_CYCLE_TIME && cycleTime >= 0 ? (
                        <Tooltip content={cycleTime.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                          <span>{formatNumberWithSuffix(cycleTime).formatted}</span>
                        </Tooltip>
                      ) : item.name === JIRA_DASHBOARD.WIDGET_COST_OF_FIXING_DEFECTS && bugCost >= 0 ? (
                        <Tooltip content={bugCost.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                          <span>{formatNumberWithSuffix(bugCost).formatted}</span>
                        </Tooltip>
                      ) : item.name === JIRA_DASHBOARD.WIDGET_TIME_TO_FIX_BUG && timeToFix >= 0 ? (
                        <Tooltip content={timeToFix.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                          <span>{formatNumberWithSuffix(timeToFix).formatted}</span>
                        </Tooltip>
                      ) : item.name === JIRA_DASHBOARD.WIDGET_DEFECT_REMOVAL_EFFICIENCY && defectRemoval >= 0 ? (
                        <Tooltip content={defectRemoval.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                          <span>{formatNumberWithSuffix(defectRemoval).formatted}</span>
                        </Tooltip>
                      ) : item.name === JIRA_DASHBOARD.WIDGET_VELOCITY ? (
                        <Tooltip
                          content={(typeof velocityData?.velocity === JIRA_DASHBOARD.TYPE_OBJECT
                            ? velocityData?.velocity?.velocity ?? 0
                            : velocityData?.velocity ?? 0
                          ).toLocaleString()}
                          position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}
                        >
                          <span>
                            {
                              formatNumberWithSuffix(
                                typeof velocityData?.velocity === JIRA_DASHBOARD.TYPE_OBJECT
                                  ? velocityData?.velocity?.velocity ?? 0
                                  : velocityData?.velocity ?? 0,
                              ).formatted
                            }
                          </span>
                        </Tooltip>
                      ) : (
                        0
                      );
                    if (item.name === JIRA_DASHBOARD.WIDGET_COMMITTED_VS_COMPLETED) {
                      return (
                        <div
                          key={itemIndex}
                          className={`relative h-80 ${itemIndex === 0 ? 'w-[64%]' : 'w-[36%]'}`}
                        >
                          <Dashboard
                            key={itemIndex}
                            layout={selectedView}
                            itemDetails={{ name: item.name, value: value }}
                          />
                        </div>
                      );
                    } else if (item.name === JIRA_DASHBOARD.WIDGET_CYCLE_TIME) {
                      return (
                        <div
                          key={itemIndex}
                          className={`relative h-80 ${itemIndex === 0 ? 'w-[73%]' : 'w-[36%]'}`}
                        >
                          <CycleTime
                            key={itemIndex}
                            layout={selectedView}
                            itemDetails={{ name: item.name, value: value }}
                          />
                        </div>
                      );
                    } else if (item.name === JIRA_DASHBOARD.WIDGET_ISSUE_TYPE) {
                      return (
                        <div
                          key={itemIndex}
                          className={`relative h-80 ${itemIndex === 0 ? 'w-[64%]' : 'w-[36%]'}`}
                        >
                          <IssueType
                            key={itemIndex}
                            getStatusCount={getStatusCount}
                            getTaskCountValue={getTaskCountValue}
                            selectedValue={selectedValue.value}
                            sprintData={selectedSprintData}
                            releaseData={selectedReleaseData}
                            toggleType={toggleType}
                            velocityToggleType={velocityToggleType}
                            layout={selectedView}
                            itemDetails={{ name: item.name, value: value }}
                          />
                        </div>
                      );
                    } else if (item.name === JIRA_DASHBOARD.WIDGET_DEFECT_DENSITY) {
                      return (
                        <div
                          key={itemIndex}
                          className={`relative h-80 ${itemIndex === 0 ? 'w-[64%]' : 'w-[36%]'}`}
                        >
                          <DefectDensity
                            key={itemIndex}
                            layout={selectedView}
                            itemDetails={{ name: item.name, value: value }}
                          />
                        </div>
                      );
                    } else if (item.name === JIRA_DASHBOARD.WIDGET_DEFECT_REMOVAL_EFFICIENCY) {
                      return (
                        <div
                          key={itemIndex}
                          className={`relative h-80 ${itemIndex === 0 ? 'w-[33%]' : 'w-[33%]'}`}
                        >
                          <DreChart
                            key={itemIndex}
                            layout={selectedView}
                            itemDetails={{ name: item.name, value: value }}
                          />
                        </div>
                      );
                    } else if (item.name === JIRA_DASHBOARD.WIDGET_DEFECT_LEAKAGE_ANALYSIS) {
                      return (
                        <div
                          key={itemIndex}
                          className={`relative h-80 ${itemIndex === 0 ? 'w-[33%]' : 'w-[33%]'}`}
                        >
                          <DefectLeakageAnalysis
                            key={itemIndex}
                            layout={selectedView}
                            itemDetails={{ name: item.name, value: value }}
                          />
                        </div>
                      );
                    } else if (item.name === JIRA_DASHBOARD.WIDGET_DEFECT_REJECTION_RATIO) {
                      return (
                        <div
                          key={itemIndex}
                          className={`relative h-80 ${itemIndex === 0 ? 'w-[33%]' : 'w-[33%]'}`}
                        >
                          <DefectRejectionRatio
                            key={itemIndex}
                            layout={selectedView}
                            itemDetails={{ name: item.name, value: value }}
                          />
                        </div>
                      );
                    } else if (item.name === JIRA_DASHBOARD.WIDGET_BUG_CLASSIFICATION) {
                      return (
                        <div
                          key={itemIndex}
                          className={`relative h-80 ${itemIndex === 0 ? 'w-[64%]' : 'w-[36%]'}`}
                        >
                          <BugRateClass
                            key={itemIndex}
                            layout={selectedView}
                            itemDetails={{ name: item.name, value: value }}
                          />
                        </div>
                      );
                    } else if (item.name === JIRA_DASHBOARD.WIDGET_COST_OF_FIXING_DEFECTS) {
                      return (
                        <div
                          key={itemIndex}
                          className={`relative h-80 ${itemIndex === 0 ? 'w-[64%]' : 'w-[36%]'}`}
                        >
                          <CostOfFixingDefects
                            key={itemIndex}
                            layout={selectedView}
                            itemDetails={{ name: item.name, value: value }}
                            itemIndex={itemIndex}
                          />
                        </div>
                      );
                    } else if (item.name === JIRA_DASHBOARD.WIDGET_TIME_TO_FIX_BUG) {
                      return (
                        <div
                          key={itemIndex}
                          className={`relative h-80 ${itemIndex === 0 ? 'w-[64%]' : 'w-[36%]'}`}
                        >
                          <TimeToFixBug
                            key={itemIndex}
                            layout={selectedView}
                            itemDetails={{ name: item.name, value: value }}
                            itemIndex={itemIndex}
                          />
                        </div>
                      );
                    } else if (item.name === JIRA_DASHBOARD.WIDGET_VELOCITY) {
                      return (
                        <div
                          key={itemIndex}
                          className={`relative h-80 ${itemIndex === 0 ? 'w-[64%]' : 'w-[36%]'}`}
                        >
                          <Velocity
                            key={itemIndex}
                            layout={selectedView}
                            itemDetails={{ name: item.name, value: value }}
                          />
                        </div>
                      );
                    } else if (item.name === JIRA_DASHBOARD.WIDGET_BURNDOWN) {
                      return (
                        <div
                          key={itemIndex}
                          className={`relative h-80 ${itemIndex === 0 ? 'w-[33%]' : 'w-[33%]'}`}
                        >
                          <Burndown
                            key={itemIndex}
                            layout={selectedView}
                            itemDetails={{ name: item.name, value: value }}
                          />
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-6">
              {items.map((item, index) => {
                const committed = getMetricValue({
                  selectedValue,
                  toggleType,
                  selectedSprintData,
                  selectedReleaseData,
                  metricType: JIRA_DASHBOARD.METRIC_COMMITTED,
                });
                const completed = getMetricValue({
                  selectedValue,
                  toggleType,
                  selectedSprintData,
                  selectedReleaseData,
                  metricType: JIRA_DASHBOARD.METRIC_COMPLETED,
                });

                const bugRatio =
                  Array.isArray(bugClassificationData) &&
                  bugClassificationData[0]?.bugRate?.bugRatio;
                const rejectionRatio =
                  Array.isArray(defectRejectionData) &&
                  defectRejectionData[0]?.defectRejectedRate?.defectRejectionRatio;
                const density =
                  Array.isArray(defectDensity) && defectDensity[0]?.defectDensity?.defectDensity;
                const defectLeakageValue =
                  Array.isArray(defectLeakage) &&
                  Array.isArray(defectLeakage[0]?.dlaSprintOrRelease)
                    ? defectLeakage[0]?.dlaSprintOrRelease[0]?.dla ?? 0
                    : 0;
                const bugCost = Array.isArray(costOfDefect) && costOfDefect[0]?.totalBugCost;
                const timeToFix =
                  getReleaseReadiness?.engineeringScoreObject?.developerScoreObject?.timeToFix
                    ?.averageTimeToFix;
                const cycleTime = Math.round(
                  cycleTimeData?.cycleTime?.cycleTimeTrend[0]?.overall?.cycleTime || 0,
                );
                const defectRemoval =
                  Array.isArray(defectRemovalEfficiencyData) &&
                  defectRemovalEfficiencyData[0]?.defectRemovalValue?.defectRemovalPercentage;

                const value =
                  committed > 0 && item.name === JIRA_DASHBOARD.WIDGET_COMMITTED_VS_COMPLETED ? (
                    <span style={{ whiteSpace: 'nowrap' }} className="group">
                      <Tooltip content={committed.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                        <span>{formatNumberWithSuffix(committed).formatted}</span>
                      </Tooltip>
                      <span className="text-xl p-1">{JIRA_DASHBOARD.TEXT_VS}</span>
                      <Tooltip content={completed.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                        <span>{formatNumberWithSuffix(completed).formatted}</span>
                      </Tooltip>
                    </span>
                  ) : item.name === JIRA_DASHBOARD.WIDGET_ISSUE_TYPE ? (
                    <Tooltip content={totalIssues.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                      <span>{formatNumberWithSuffix(totalIssues).formatted}</span>
                    </Tooltip>
                  ) : bugRatio >= 0 && item.name === JIRA_DASHBOARD.WIDGET_BUG_CLASSIFICATION ? (
                    <Tooltip content={bugRatio.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                      <span>{formatNumberWithSuffix(bugRatio).formatted}</span>
                    </Tooltip>
                  ) : rejectionRatio >= 0 && item.name === JIRA_DASHBOARD.WIDGET_DEFECT_REJECTION_RATIO ? (
                    <Tooltip content={rejectionRatio.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                      <span>{formatNumberWithSuffix(rejectionRatio).formatted}</span>
                    </Tooltip>
                  ) : density >= 0 && item.name === JIRA_DASHBOARD.WIDGET_DEFECT_DENSITY ? (
                    <Tooltip content={density.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                      <span>{formatNumberWithSuffix(density).formatted}</span>
                    </Tooltip>
                  ) : item.name === JIRA_DASHBOARD.WIDGET_BURNDOWN ? (
                    <Tooltip
                      content={(
                        getReleaseReadiness?.releaseReadinessObject?.burndown?.burndownPercentage ||
                        0
                      ).toLocaleString()}
                      position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}
                    >
                      <span>
                        {
                          formatNumberWithSuffix(
                            getReleaseReadiness?.releaseReadinessObject?.burndown
                              ?.burndownPercentage || 0,
                          ).formatted
                        }
                      </span>
                    </Tooltip>
                  ) : item.name === JIRA_DASHBOARD.WIDGET_DEFECT_LEAKAGE_ANALYSIS && defectLeakageValue >= 0 ? (
                    <Tooltip content={defectLeakageValue.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                      <span>{formatNumberWithSuffix(defectLeakageValue).formatted}</span>
                    </Tooltip>
                  ) : item.name === JIRA_DASHBOARD.WIDGET_CYCLE_TIME && cycleTime >= 0 ? (
                    <Tooltip content={cycleTime.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                      <span>{formatNumberWithSuffix(cycleTime).formatted}</span>
                    </Tooltip>
                  ) : item.name === JIRA_DASHBOARD.WIDGET_COST_OF_FIXING_DEFECTS && bugCost >= 0 ? (
                    <Tooltip content={bugCost.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                      <span>{formatNumberWithSuffix(bugCost).formatted}</span>
                    </Tooltip>
                  ) : item.name === JIRA_DASHBOARD.WIDGET_TIME_TO_FIX_BUG && timeToFix >= 0 ? (
                    <Tooltip content={timeToFix.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                      <span>{formatNumberWithSuffix(timeToFix).formatted}</span>
                    </Tooltip>
                  ) : item.name === JIRA_DASHBOARD.WIDGET_DEFECT_REMOVAL_EFFICIENCY && defectRemoval >= 0 ? (
                    <Tooltip content={defectRemoval.toLocaleString()} position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}>
                      <span>{formatNumberWithSuffix(defectRemoval).formatted}</span>
                    </Tooltip>
                  ) : item.name === JIRA_DASHBOARD.WIDGET_VELOCITY ? (
                    <Tooltip
                      content={(typeof velocityData?.velocity === JIRA_DASHBOARD.TYPE_OBJECT
                        ? velocityData?.velocity?.velocity ?? 0
                        : velocityData?.velocity ?? 0
                      ).toLocaleString()}
                      position={JIRA_DASHBOARD.TOOLTIP_POSITION_TOP}
                    >
                      <span>
                        {
                          formatNumberWithSuffix(
                            typeof velocityData?.velocity === JIRA_DASHBOARD.TYPE_OBJECT
                              ? velocityData?.velocity?.velocity ?? 0
                              : velocityData?.velocity ?? 0,
                          ).formatted
                        }
                      </span>
                    </Tooltip>
                  ) : (
                    0
                  );

                if (item.name === JIRA_DASHBOARD.WIDGET_ISSUE_TYPE) {
                  return (
                    <IssueType
                      key={index}
                      getStatusCount={getStatusCount}
                      getTaskCountValue={getTaskCountValue}
                      selectedValue={selectedValue.value}
                      sprintData={selectedSprintData}
                      releaseData={selectedReleaseData}
                      toggleType={toggleType}
                      velocityToggleType={velocityToggleType}
                      layout={JIRA_DASHBOARD.VIEW_LIST}
                      itemDetails={{ name: item.name, value: value }}
                    />
                  );
                }

                if (item.name === JIRA_DASHBOARD.WIDGET_CYCLE_TIME) {
                  return (
                    <CycleTime
                      key={index}
                      layout={JIRA_DASHBOARD.VIEW_LIST}
                      itemDetails={{ name: item.name, value: value }}
                    />
                  );
                }

                if (item.name === JIRA_DASHBOARD.WIDGET_DEFECT_DENSITY) {
                  return (
                    <DefectDensity
                      key={index}
                      layout={JIRA_DASHBOARD.VIEW_LIST}
                      itemDetails={{ name: item.name, value: value }}
                    />
                  );
                }

                if (item.name === JIRA_DASHBOARD.WIDGET_DEFECT_REMOVAL_EFFICIENCY) {
                  return (
                    <DreChart
                      key={index}
                      layout={JIRA_DASHBOARD.VIEW_LIST}
                      itemDetails={{ name: item.name, value: value }}
                    />
                  );
                }

                if (item.name === JIRA_DASHBOARD.WIDGET_DEFECT_LEAKAGE_ANALYSIS) {
                  return (
                    <DefectLeakageAnalysis
                      key={index}
                      layout={JIRA_DASHBOARD.VIEW_LIST}
                      itemDetails={{ name: item.name, value: value }}
                    />
                  );
                }

                if (item.name === JIRA_DASHBOARD.WIDGET_DEFECT_REJECTION_RATIO) {
                  return (
                    <DefectRejectionRatio
                      key={index}
                      layout={JIRA_DASHBOARD.VIEW_LIST}
                      itemDetails={{ name: item.name, value: value }}
                    />
                  );
                }

                if (item.name === JIRA_DASHBOARD.WIDGET_TIME_TO_FIX_BUG) {
                  return (
                    <TimeToFixBug
                      key={index}
                      layout={JIRA_DASHBOARD.VIEW_LIST}
                      itemDetails={{ name: item.name, value: value }}
                    />
                  );
                }

                if (item.name === JIRA_DASHBOARD.WIDGET_COMMITTED_VS_COMPLETED) {
                  return (
                    <CommittedVsCompleted
                      key={index}
                      layout={JIRA_DASHBOARD.VIEW_LIST}
                      itemDetails={{ name: item.name, value: value }}
                    />
                  );
                }

                if (item.name === JIRA_DASHBOARD.WIDGET_BUG_CLASSIFICATION) {
                  return (
                    <BugRateClass
                      key={index}
                      layout={JIRA_DASHBOARD.VIEW_LIST}
                      itemDetails={{ name: item.name, value: value }}
                    />
                  );
                }

                if (item.name === JIRA_DASHBOARD.WIDGET_COST_OF_FIXING_DEFECTS) {
                  return (
                    <CostOfFixingDefects
                      key={index}
                      layout={JIRA_DASHBOARD.VIEW_LIST}
                      itemDetails={{ name: item.name, value: value }}
                    />
                  );
                }

                if (item.name === JIRA_DASHBOARD.WIDGET_VELOCITY) {
                  return (
                    <Velocity
                      key={index}
                      layout={JIRA_DASHBOARD.VIEW_LIST}
                      itemDetails={{ name: item.name, value: value }}
                    />
                  );
                }

                if (item.name === JIRA_DASHBOARD.WIDGET_BURNDOWN) {
                  return (
                    <Burndown
                      key={index}
                      layout={JIRA_DASHBOARD.VIEW_LIST}
                      itemDetails={{ name: item.name, value: value }}
                      itemIndex={index}
                    />
                  );
                }

                return (
                  <div key={index} className="w-full">
                    <div className="grid grid-cols-12 gap-6 items-start">
                      <div className="col-span-4">
                        {/* Main Card - Similar to BetaDataCard but simplified for now */}
                        <div className="bg-white dark:bg-[#182433] border border-[#E5E5E5] dark:border-[#25384F] rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] h-80">
                          <div className="flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4">
                              <h2 className="text-[#202020] dark:text-gray-300 text-lg font-medium">
                                {item.name}
                              </h2>
                              <div className="flex items-center">
                                <span className="text-xl font-semibold text-blue-400 mr-2">
                                  {value}
                                </span>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth="3.5"
                                  stroke="currentColor"
                                  className="w-4 h-4 ml-2 text-green-500"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
                                  />
                                </svg>
                              </div>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                              <p className="text-[#7A7A7A] dark:text-gray-400 text-sm">
                                {JIRA_DASHBOARD.PLACEHOLDER_DETAILED_SOON}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-8">
                        {/* Chart/Detailed Analysis Section */}
                        <div className="bg-white dark:bg-[#182433] border border-[#E5E5E5] dark:border-[#25384F] rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] h-80">
                          <div className="flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4">
                              <h2 className="text-[#202020] dark:text-gray-300 text-lg font-medium">
                                {item.name}{JIRA_DASHBOARD.SUFFIX_ANALYSIS}
                              </h2>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                              <div className="text-center">
                                <p className="text-[#7A7A7A] dark:text-gray-400 text-sm mb-2">
                                  {JIRA_DASHBOARD.PLACEHOLDER_CHARTS_HERE}
                                </p>
                                <p className="text-[#7A7A7A] dark:text-gray-400 text-xs">
                                  {JIRA_DASHBOARD.PLACEHOLDER_TREND_CHARTS}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CommonLayout>
  );
};

export default TeamJeeraInsights;
