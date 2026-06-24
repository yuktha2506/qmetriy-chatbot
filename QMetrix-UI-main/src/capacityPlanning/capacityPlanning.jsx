import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CommonLayout from '../../layout/CommonLayout';
import {
  addStoryPoints,
  getRoleRatesAndStoryPoints,
  addCapacity,
  getProjectList,
  getHolidayList,
  getId,
  getBoardList,
  getProjectManagementData,
  APP_STRINGS,
  getSprintList,
  getReleaseDetails,
} from '../../constants';
import DropdownButton from '../Common/DropDown';
import { CommonFunction } from '../../utils/commonFunctions';
import { 
  storeBoardInSession, 
  restoreBoardFromSession, 
  clearBoardFromSession,
  computeProjectDisplayName
} from '../../utils/boardUtils';
// import { useQuery } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import Modal from '../Common/Modal';
import AddCapacityUsersModal from './AddCapacityUsersModal';
import { useNavigate } from 'react-router-dom';
import AGrid from '../Common/AGgrid';
import { capacityPlanningColumns } from '../AGColumns/CapacityPlanningColumns';
// import { getAllOrgsListAPI } from '../../constants';
import { 
  setSelectedTypeValue,
  setProjectList,
  setBoardListForProject,
  setHolidayListForCompany,
  setRoleRates,
  setStoryPointRatio,
  setUserList,
  setUserListForProject,
} from '../../store/JiraSlices/jiraSlice';
import Spinner from '../Common/Spinner';
import '../../assets/css/global.scss';
import { useSelector } from 'react-redux';
import { getBoardLabels } from '../../utils/boardUtils';
import {
  isBucketAssigneeName,
  isManuallyAddedCapacityRow,
  isSprintOrReleaseLockedRow,
  shouldShowUnassignedCapacityApiAssignee,
  shouldShowUnassignedCapacityGridRow,
} from '../../utils/capacityPlanningUtils';

const getUniqueId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normCapacityName = (n) => String(n || '').trim().toLowerCase();

const CapacityDashboard = () => {
  const [teamData, setTeamData] = useState([]);
  const [roles, setRoles] = useState([]);
  const [storyPointToHourRatio, setStoryPointToHourRatio] = useState(8);
  const theme = useSelector((state) => state.theme.theme);
  const [saveStatus, setSaveStatus] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isHoursBasedProject, setIsHoursBasedProject] = useState(false);
  const projectRef = useRef(null);
  const dispatch = useDispatch();
  const [selectedSprint, setSelectedSprint] = useState({ id: '', name: '' });
  const [selectedProject, setSelectedProject] = useState({ id: '', name: '' });
  const [selectedRelease, setSelectedRelease] = useState({ id: '', releaseName: '' });
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isSprintOpen, setIsSprintOpen] = useState(false);
  const [getAllProjectList, setGetAllProjectList] = useState([]);
  const [getAllOrgsList, setGetAllOrgsList] = useState([]);
  const [getAllSprintList, setGetAllSprintList] = useState([]);
  const [isValueOpen, setIsValueOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState({
    label: APP_STRINGS.SELECT_AN_OPTION,
    value: '',
  });
  const [getAllReleaseList, setGetAllReleaseList] = useState([]);
  const organizationRef = useRef(null);
  const [selectedOrg, setSelectedOrg] = useState({ id: '', name: '' });
  const [isOrganizationOpen, setIsOrganizationOpen] = useState(false); 
  const [warningModal, setWarningModal] = useState({isOpen: false, message: ''});
  const [isAddUsersModalOpen, setIsAddUsersModalOpen] = useState(false);
  const [addModalSprintReleaseAssignees, setAddModalSprintReleaseAssignees] = useState([]);
  const [modalRecalledOffPlan, setModalRecalledOffPlan] = useState([]);
  const [manualDeleteConfirmRowId, setManualDeleteConfirmRowId] = useState(null);
  const [purgedOffPlanManualNorms, setPurgedOffPlanManualNorms] = useState([]);
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [projectBoardCount, setProjectBoardCount] = useState({});
  const [subMenuBoards, setSubMenuBoards] = useState([]);
  const [subMenuPosition, setSubMenuPosition] = useState({ top: 0, left: 0 });
  const [currentProjectForBoard, setCurrentProjectForBoard] = useState(null);
  const [selectedBoard, setSelectedBoard] = useState({ id: '', name: '', type: '' });
   const [pageSize, setPageSize] = useState(7);
   const [gridHeight, setGridHeight] = useState("58vh");
  const sprintRef = useRef(null);
  const valueRef = useRef(null);
  const [, setType] = useState(APP_STRINGS.VALUE_SPRINT);
  const navigate = useNavigate();
  const gridApiRef = useRef(null);
  const changingRef = useRef(false);
  const rolesRef = useRef([]);
  const roleRatesFetchPromiseRef = useRef(null);
  const holidayFetchPromiseRef = useRef(null);
  const userListFetchPromiseRef = useRef({});
  const pendingBoardValidationRef = useRef(null);
  const fetchProjectDataRef = useRef(null);
  const teamDataRef = useRef([]);
  /** Sprint|release assignees with addedManually + presentInPlan no (hidden from grid); merged into Save Data payload. */
  const offPlanManualAssigneesRef = useRef([]);
  const jiraData = useSelector((state) => state.jira || {});
  const sprintLength = jiraData?.sprintLength || null;
  const totalDays = sprintLength?.sprintLengthInDays ?? 0;
  const { sprintLabel, releaseLabel, isAzure } = getBoardLabels({ selectedBoard });

  const {
    handleProject,
    handleSprint,
    updateCapacityValues,
    handleRelease,
    handleValue,
    handleOrganization,
  } = CommonFunction();

  useEffect(() => { rolesRef.current = roles; }, [roles]);
  useEffect(() => {
    teamDataRef.current = teamData;
  }, [teamData]);
  const recallContextKeyRef = useRef('');
  useEffect(() => {
    const mode = String(selectedValue?.value || '').toLowerCase();
    const isSprint = mode === 'sprint';
    const isRelease = mode === 'release';
    const sid = isSprint ? sessionStorage.getItem('sprintId') || '' : '';
    const rid = isRelease ? sessionStorage.getItem('releaseId') || '' : '';
    const key = `${isSprint ? 's' : isRelease ? 'r' : 'n'}:${sid || rid}`;
    if (recallContextKeyRef.current && recallContextKeyRef.current !== key) {
      setModalRecalledOffPlan([]);
      setPurgedOffPlanManualNorms([]);
    }
    recallContextKeyRef.current = key;
  }, [selectedSprint.id, selectedRelease.id, selectedValue.value]);

  const orgsData = useSelector((state) => state.jira?.organizationList);

  const allColumns = useMemo(
    () => capacityPlanningColumns(!isHoursBasedProject, theme, selectedValue?.value),
    [isHoursBasedProject, theme, selectedValue?.value],
  );

  const handleOrganizationChange = async (value) => {
    try {
      await handleOrganization(value, dispatch);
    } catch (error) {
      console.error('Error handling project selection:', error);
    }
  };

  const handleValueChange = (value) => {
    handleValue(value, dispatch);
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
      setSelectedBoard({ id: '', name: '', type: '' });
      clearBoardFromSession();

      const companyId = getId().companyId;
      const boards = await fetchBoardList(companyId, value);
      const firstBoard = boards[0];
      const boardId = firstBoard?.id || firstBoard?._id || '';
      const boardType = firstBoard?.type || firstBoard?.boardType || '';

      if (boardId) {
        setSelectedBoard({
          id: boardId,
          name: firstBoard?.name || firstBoard?.boardName || '',
          type: boardType,
        });
        sessionStorage.setItem('boardId', boardId);
        storeBoardInSession(
          boardId,
          firstBoard?.name || firstBoard?.boardName || '',
          boardType,
        );
      }

      await handleProject(value, boardType, dispatch);
      await fetchProjectDataRef.current?.();
    } catch (error) {
      console.error('Error handling project selection:', error);
    }
  };

  const fetchBoardList = async (companyId, projectId) => {
    try {
      const cachedBoardsByProject = jiraData?.boardListByProjectId || {};
      const cachedBoards = cachedBoardsByProject[projectId];
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
      dispatch(setBoardListForProject({ projectId, boards }));
      return boards;
    } catch (error) {
      console.error('Error fetching board list:', error);
      return [];
    }
  };

  const handleBoardChange = async (boardId, projectId) => {
    try {
      const selectedBoardData = subMenuBoards.find(board => (board.id || board._id) === boardId);
      if (selectedBoardData) {
        setSelectedBoard({
          id: boardId,
          name: selectedBoardData.name || selectedBoardData.boardName || '',
          type: selectedBoardData.type || selectedBoardData.boardType || ''
        });
        sessionStorage.setItem('boardId', boardId);
        storeBoardInSession(boardId, selectedBoardData.name || selectedBoardData.boardName || '', selectedBoardData.type || selectedBoardData.boardType || '');
        await handleProject(projectId, selectedBoardData.type || selectedBoardData.boardType, dispatch);
        const project = getAllProjectList.find(p => p._id === projectId);
        setSelectedProject({
          id: projectId,
          name: project?.name || ''
        });
        await fetchProjectDataRef.current?.();
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
      await new Promise(resolve => setTimeout(resolve, 50));
      const companyId = getId().companyId;
      const boards = await fetchBoardList(companyId, projectId);
      if (boards.length > 1) {
        const hoveredElement = document.querySelector(`[data-project-id="${projectId}"]`);
        if (hoveredElement) {
          const rect = hoveredElement.getBoundingClientRect();
          setSubMenuPosition({
            top: rect.top,
            left: rect.right + 10 // Add small spacing to match StandUp page visual gap
          });
        } else {
          setSubMenuPosition({
            top: 100,
            left: 420
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
      const submenuElement = document.querySelector('.board-submenu');
      const allProjectElements = document.querySelectorAll('[data-project-id]');
      let isHoveringOverProject = false;
      allProjectElements.forEach(element => {
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

 
  const handleSprintChange = async (value) => {
    changingRef.current = true;
    try {
      await handleSprint(value, dispatch);
    } catch (error) {
      console.error('Error handling project selection:', error);
    }
    const selectedSprint = getAllSprintList.find((sprint) => sprint._id === value);
    sessionStorage.setItem('sprintId', selectedSprint._id);
    setSelectedSprint({ id: selectedSprint._id, name: selectedSprint.name });
    setType(APP_STRINGS.VALUE_SPRINT);
    await fetchProjectDataRef.current?.();
    setTimeout(() => {
      changingRef.current = false;
    }, 300);
  };

  const handleReleaseChange = async (value) => {
    changingRef.current = true;
    try {
      await handleRelease(value, dispatch);
    } catch (error) {
      console.error('Error handling project selection:', error);
    }
    const releaseSelected = getAllReleaseList.find((release) => release._id === value);
    sessionStorage.setItem('releaseId', releaseSelected._id);
    setSelectedRelease({ id: releaseSelected._id, releaseName: releaseSelected.releaseName });
    setIsSprintOpen(false);
    setType(APP_STRINGS.VALUE_RELEASE);
    await fetchProjectDataRef.current?.();
    setTimeout(() => {
      changingRef.current = false;
    }, 300);
  };

  const calculateDependentValues = useCallback(
    (row, projectIsHoursBased = isHoursBasedProject) => {
      const allocatedStoryPoints = Number(row.allocatedStoryPoints || 0);
      const allocatedHours = Number(row.allocatedHours || 0);
      const leaves = Number(row.leaves || 0);
      const holiday = Number(row.holiday || 0);
      const sprintLength = Number(totalDays || 0);
      const availableDays = Math.max(sprintLength - leaves - holiday, 0);
      let availableHours;
      if (row.availableHours && row.availableHours > 0) {
        availableHours = row.availableHours;
      } else {
        availableHours = 0;
      }
      let netAvailableCapacity = row.availableHours;
      if (row.allocationType?.toLowerCase() === 'full' && row.availableHours !== 0) {
       const totalOffDays = holiday + leaves;
  netAvailableCapacity -= projectIsHoursBased ? totalOffDays * 9 : totalOffDays * 1;
  netAvailableCapacity = Math.max(netAvailableCapacity, 0); 
      }
      const billingRate = Number(row.billingRate || 0);
      let remainingCapacity, overage, workload, totalBilling;
      if (projectIsHoursBased) {
        remainingCapacity = netAvailableCapacity - allocatedHours;
        overage = allocatedHours - netAvailableCapacity;
        workload =
          netAvailableCapacity > 0 ? Math.min((allocatedHours / netAvailableCapacity) * 100) : 0;
        totalBilling = allocatedHours * billingRate;
      } else {
        remainingCapacity = netAvailableCapacity - allocatedStoryPoints;
        overage = allocatedStoryPoints - netAvailableCapacity;
        workload =
          netAvailableCapacity > 0
            ? Math.min((allocatedStoryPoints / netAvailableCapacity) * 100)
            : 0;
        const hoursForBilling = allocatedStoryPoints * (storyPointToHourRatio || 8);
        totalBilling = hoursForBilling * billingRate;
      }
      return {
        ...row,
        availableDays,
        availableHours: parseFloat(availableHours.toFixed(2)),
        sprintLength,
        allocatedHours: parseFloat(allocatedHours.toFixed(2)),
        allocatedStoryPoints: parseFloat(allocatedStoryPoints.toFixed(2)),
        remainingCapacity: parseFloat(remainingCapacity.toFixed(2)),
        overage: parseFloat(overage.toFixed(2)),
        totalBilling: parseFloat(totalBilling.toFixed(2)),
        workload: parseFloat(workload.toFixed(2)),
        netAvailableCapacity: parseFloat(netAvailableCapacity.toFixed(2)),
      };
    },
    [totalDays, storyPointToHourRatio, isHoursBasedProject],
  );

  const getHolidaysInSprint = (holidays, sprintStart, sprintEnd) => {
    const start = new Date(sprintStart);
    const end = new Date(sprintEnd);
    const sprintHolidays = holidays.filter((h) => {
      const holidayDate = new Date(h.date);
      return holidayDate >= start && holidayDate <= end;
    });
    const uniqueHolidayDates = Array.from(
      new Set(sprintHolidays.map((h) => new Date(h.date).toISOString().split('T')[0])),
    );
    return uniqueHolidayDates;
  };

  const updateTeamDataWithUserData = useCallback(
    (project, holidays = []) => {
      if (project && project.assignees && project.assignees.length > 0) {
        const projectIsHoursBased = project.hours || false;
        const sprintHolidays = getHolidaysInSprint(holidays, project.startDate, project.endDate);
        const assigneesForGrid = project.assignees.filter((a) => {
          if (!shouldShowUnassignedCapacityApiAssignee(a)) return false;
          if (!isManuallyAddedCapacityRow(a)) return true;
          return a.presentInPlan !== 'no' && a.presentInPlan !== false;
        });
        const jiraOrdered = [];
        const manualOrdered = [];
        for (const a of assigneesForGrid) {
          if (isManuallyAddedCapacityRow(a)) {
            manualOrdered.push(a);
          } else {
            jiraOrdered.push(a);
          }
        }
        const sortJira = (arr) => {
          const locked = arr.filter((x) => isSprintOrReleaseLockedRow(x));
          const rest = arr.filter((x) => !isSprintOrReleaseLockedRow(x));
          return [...locked, ...rest];
        };
        const orderedAssignees = [...sortJira(jiraOrdered), ...manualOrdered];
        const updatedTeamData = orderedAssignees.map((assignee) => {
          const holidayCount = sprintHolidays.length;
          const leaveCount = assignee.leaves || 0;
          const latestRole = rolesRef.current.find((r) => r.role === assignee.role);
          const billingRate = latestRole ? latestRole.rate : (assignee.billingRate || 0);
          const manuallyAdded = isManuallyAddedCapacityRow(assignee);
          const addedManuallyFlag =
            assignee.addedManually === 'yes' || assignee.addedManually === true ? 'yes' : 'no';
          const sprintOrReleaseUser =
            assignee.sprintOrReleaseUser === 'yes' || assignee.sprintOrReleaseUser === true
              ? 'yes'
              : 'no';
          const mappedData = {
            id: assignee._id != null ? String(assignee._id) : getUniqueId(),
            name: assignee.assignee,
            role: assignee.role,
            allocationType: assignee.allocationType || '',
            availableHours: assignee.availableHours || 0,
            allocatedStoryPoints: projectIsHoursBased ? 0 : assignee.allocatedHours || 0,
            allocatedHours: projectIsHoursBased ? assignee.allocatedHours || 0 : 0,
            billingRate,
            leaves: leaveCount || 0,
            holiday: holidayCount,
            isNew: false,
            manuallyAdded,
            addedManually: manuallyAdded ? 'yes' : addedManuallyFlag,
            sprintOrReleaseUser,
            presentInPlan:
              assignee.presentInPlan === 'no' || assignee.presentInPlan === false ? 'no' : 'yes',
          };
          const calculated = calculateDependentValues(mappedData, projectIsHoursBased);
          let netAvailableCapacity = calculated.availableHours;

          if (
            mappedData.allocationType?.toLowerCase() === 'full' &&
            mappedData.availableHours !== 0
          ) {
            const totalOffDays = holidayCount + leaveCount;
            const offHours = projectIsHoursBased ? totalOffDays * 9 : totalOffDays * 1;
            netAvailableCapacity = Math.max(calculated.availableHours - offHours, 0);
          }
          if (!mappedData.availableHours || mappedData.availableHours === 0) {
            return {
              ...calculated,
              netAvailableCapacity,
            };
          } else {
            return {
              ...calculated,
              availableHours: mappedData.availableHours,
              netAvailableCapacity,
            };
          }
        });
        setTeamData(updatedTeamData);
      } else {
        setTeamData([
          {
            id: getUniqueId(),
            name: '',
            role: '',
            allocationType: '',
            availableHours: 0,
            netAvailableCapacity: 0,
            previousAvailableDays: 0,
            previousStoryPointRatio: storyPointToHourRatio,
            allocatedStoryPoints: 0,
            allocatedHours: 0,
            billingRate: 0,
            leaves: 0,
            holiday: 0,
            availableDays: 0,
            isNew: true,
            manuallyAdded: false,
          },
        ]);
      }
    },
    [calculateDependentValues, storyPointToHourRatio],
  );

  const fetchProjectData = useCallback(async () => {
    setLoading(true);
    try {
      const sprintId = sessionStorage.getItem('sprintId');
      const releaseId = sessionStorage.getItem('releaseId');
      const rawCapacityMode =
        selectedValue?.value || jiraData?.selectedValue || sessionStorage.getItem('typeValue') || '';
      const capacityMode = String(rawCapacityMode).toLowerCase();
      const isSprintCapacity = capacityMode === 'sprint';
      const isReleaseCapacity = capacityMode === 'release';
      let startDate = null;
      let endDate = null;
      const companyId = getId().companyId;
      let holidays = [];
      try {
        const cachedHolidays = jiraData?.holidayListByCompanyId?.[companyId];
        if (Array.isArray(cachedHolidays)) {
          holidays = cachedHolidays;
        } else {
          if (!holidayFetchPromiseRef.current) {
            holidayFetchPromiseRef.current = (async () => {
              const holidayData = await getHolidayList(companyId);
              const fetchedHolidays = holidayData?.holidayList || [];
              dispatch(setHolidayListForCompany({ companyId, holidays: fetchedHolidays }));
              return fetchedHolidays;
            })()
              .catch((holidayError) => {
                console.warn('Could not load holiday list:', holidayError);
                return [];
              })
              .finally(() => {
                holidayFetchPromiseRef.current = null;
              });
          }
          holidays = await holidayFetchPromiseRef.current;
        }
      } catch (holidayError) {
        console.warn('Could not load holiday list:', holidayError);
      }
      const normalizeAssigneeName = (name) => String(name || '').trim().toLowerCase();
      let assignees = [];
      let sprintSource = null;
      let releaseSource = null;
      /** True when assignees came from sprint|release document (before user-list fallback). Bucket rows only allowed in that case. */
      let usedSprintReleaseAssigneeList = false;
      /** When true, team was built from full user list — filter to issue assignees only. When false, list comes from Sprint/Release API (include every saved assignee, e.g. manually added capacity users). */
      let filterAssigneesToActiveIssues = false;
      if (isSprintCapacity && sprintId) {
        try {
          const sprintListResp = await getSprintList();
          const freshSprints = Array.isArray(sprintListResp?.data) ? sprintListResp.data : [];
          sprintSource = freshSprints.find((s) => String(s._id) === String(sprintId));
        } catch (e) {
          console.warn('Capacity planning: could not load fresh sprint list', e);
        }
        if (!sprintSource) {
          sprintSource =
            jiraData?.sprintList?.find((s) => String(s._id) === String(sprintId)) ||
            (jiraData?.Sprint && String(jiraData.Sprint._id) === String(sprintId)
              ? jiraData.Sprint
              : null);
        }
        if (sprintSource) {
          assignees = Array.isArray(sprintSource.assignees) ? sprintSource.assignees : [];
          startDate = sprintSource.startDate;
          endDate = sprintSource.completedDate || sprintSource.endDate;
          filterAssigneesToActiveIssues = false;
          usedSprintReleaseAssigneeList = true;
        }
      } else if (isReleaseCapacity && releaseId) {
        try {
          const releaseListResp = await getReleaseDetails();
          const freshReleases = Array.isArray(releaseListResp?.data) ? releaseListResp.data : [];
          releaseSource = freshReleases.find((r) => String(r._id) === String(releaseId));
        } catch (e) {
          console.warn('Capacity planning: could not load fresh release list', e);
        }
        if (!releaseSource) {
          releaseSource =
            jiraData?.releasesList?.find((r) => String(r._id) === String(releaseId)) ||
            (jiraData?.Release && String(jiraData.Release._id) === String(releaseId)
              ? jiraData.Release
              : null);
        }
        if (releaseSource) {
          assignees = Array.isArray(releaseSource.assignees) ? releaseSource.assignees : [];
          startDate = releaseSource.startDate;
          endDate = releaseSource.releaseDate;
          filterAssigneesToActiveIssues = false;
          usedSprintReleaseAssigneeList = true;
        }
      }
      // Fallback: build team from user list / previously saved capacity if no assignees on sprint/release
      if (!assignees || assignees.length === 0) {
        usedSprintReleaseAssigneeList = false;
        filterAssigneesToActiveIssues = true;
        const projectId = sessionStorage.getItem('projectId');
        const cachedUsersByProject = jiraData?.userListByProjectId?.[projectId];
        let users = Array.isArray(cachedUsersByProject) ? cachedUsersByProject : [];
        if (!users.length) {
          // Fetch user list on-demand if not already loaded
          try {
            if (!userListFetchPromiseRef.current[projectId]) {
              const value = isReleaseCapacity ? 'release' : 'sprint';
              userListFetchPromiseRef.current[projectId] = (async () => {
                const resp = await getProjectManagementData({ sections: 'userList', value });
                const fetchedUsers = resp?.data?.userList || [];
                dispatch(setUserList(fetchedUsers));
                dispatch(setUserListForProject({ projectId, users: fetchedUsers }));
                return fetchedUsers;
              })()
                .catch((e) => {
                  console.warn('getProjectManagementData userList failed:', e?.message || e);
                  return [];
                })
                .finally(() => {
                  delete userListFetchPromiseRef.current[projectId];
                });
            }
            users = await userListFetchPromiseRef.current[projectId];
          } catch (e) {
            console.warn('getProjectManagementData userList failed:', e?.message || e);
            users = [];
          }
        }
        const savedCapList = Array.isArray(jiraData?.availableHours?.assignees)
          ? jiraData.availableHours.assignees
          : [];
        const savedByName = new Map(savedCapList.map((a) => [a.assignee, a]));
        const prevAssignees = jiraData?.Sprint?.assignees || jiraData?.Release?.assignees || [];
        const prevByName = new Map(prevAssignees.map((a) => [a.assignee, a]));
        const currentRoles = rolesRef.current || [];
        assignees = users.map((u) => {
          const cap = savedByName.get(u.displayName) || {};
          const prev = prevByName.get(u.displayName) || {};
          const role = prev.role || cap.role || u.role || '';
          const roleRate = currentRoles.find((r) => r.role === role);
          const manualFromSaved =
            prev.addedManually === 'yes' ||
            prev.addedManually === true ||
            cap.addedManually === 'yes' ||
            cap.addedManually === true;
          return {
            _id: prev._id || cap._id || getUniqueId(),
            assignee: u.displayName,
            role,
            allocationType: prev.allocationType || cap.allocationType || '',
            availableHours: Number(prev.availableHours || cap.availableHours || 0),
            allocatedHours: Number(cap.allocatedHours || 0),
            billingRate: roleRate ? roleRate.rate : Number(prev.billingRate || cap.billingRate || 0),
            leaves: Number(cap.leaves || 0),
            addedManually: manualFromSaved ? 'yes' : 'no',
          };
        });
        const nameSetFallback = new Set(assignees.map((a) => normalizeAssigneeName(a.assignee)));
        const manualExtraSeen = new Set();
        for (const src of [...savedCapList, ...prevAssignees]) {
          if (!src?.assignee) continue;
          const n = normalizeAssigneeName(src.assignee);
          if (!n || manualExtraSeen.has(n)) continue;
          const isManual = src.addedManually === 'yes' || src.addedManually === true;
          if (!isManual) continue;
          manualExtraSeen.add(n);
          if (nameSetFallback.has(n)) continue;
          nameSetFallback.add(n);
          const role = src.role || '';
          const roleRate = currentRoles.find((r) => r.role === role);
          assignees.push({
            _id: src._id || getUniqueId(),
            assignee: src.assignee,
            role,
            allocationType: src.allocationType || '',
            availableHours: Number(src.availableHours || 0),
            allocatedHours: Number(src.allocatedHours || 0),
            billingRate: roleRate ? roleRate.rate : Number(src.billingRate || 0),
            leaves: Number(src.leaves || 0),
            addedManually: 'yes',
          });
        }
      }
      const activeIssues = jiraData?.jiraTableData?.issues || [];
      const activeAssignees = new Set(
        activeIssues
          .map((issue) => normalizeAssigneeName(issue?.assignee || issue?.developer))
          .filter(Boolean),
      );
      if (
        filterAssigneesToActiveIssues &&
        assignees.length > 0 &&
        activeAssignees.size > 0
      ) {
        const filteredAssignees = assignees.filter((assignee) => {
          const isManual =
            assignee.addedManually === 'yes' || assignee.addedManually === true;
          if (isManual) return true;
          return activeAssignees.has(normalizeAssigneeName(assignee?.assignee));
        });
        if (filteredAssignees.length > 0) {
          assignees = filteredAssignees;
        }
      }
      if (!usedSprintReleaseAssigneeList && Array.isArray(assignees)) {
        assignees = assignees.filter((a) => !isBucketAssigneeName(a?.assignee));
      }
      if (usedSprintReleaseAssigneeList && Array.isArray(assignees)) {
        offPlanManualAssigneesRef.current = assignees.filter(
          (a) =>
            (a.addedManually === 'yes' || a.addedManually === true) &&
            (a.presentInPlan === 'no' || a.presentInPlan === false),
        );
      } else {
        offPlanManualAssigneesRef.current = [];
      }
      setPurgedOffPlanManualNorms([]);
      // Always update grid, even when no assignees (shows a blank editable row)
      const hoursMode =
        (sprintSource?.hours === true) ||
        (releaseSource?.hours === true) ||
        isAzure ||
        isHoursBasedProject;
      const mockProject = {
        assignees: assignees || [],
        hours: hoursMode,
        startDate,
        endDate,
      };
      updateTeamDataWithUserData(mockProject, holidays);
    } catch (error) {
      console.error('Error fetching project data:', error);
      setTeamData([]);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  }, [
    dispatch,
    selectedValue.value,
    isHoursBasedProject,
    isAzure,
    updateTeamDataWithUserData,
    jiraData?.selectedValue,
    jiraData?.holidayListByCompanyId,
    jiraData?.sprintList,
    jiraData?.Sprint,
    jiraData?.releasesList,
    jiraData?.Release,
    jiraData?.userListByProjectId,
    jiraData?.availableHours,
    jiraData?.jiraTableData,
  ]);

  fetchProjectDataRef.current = fetchProjectData;

  const mapRowsToCapacityAssignees = useCallback(
    (rows) =>
      rows.map((member) => ({
        assignee: member.name,
        role: member.role,
        allocationType: member.allocationType || '',
        availableHours: member.availableHours,
        allocatedHours: isHoursBasedProject ? member.allocatedHours : member.allocatedStoryPoints,
        billingRate: member.billingRate,
        leaves: member.leaves,
        holiday: member.holiday,
        availableDays: member.availableDays,
        netAvailableCapacity: member.netAvailableCapacity,
        addedManually: isManuallyAddedCapacityRow(member) ? 'yes' : 'no',
        presentInPlan:
          isManuallyAddedCapacityRow(member) && (member.presentInPlan === 'no' || member.presentInPlan === false)
            ? 'no'
            : 'yes',
      })),
    [isHoursBasedProject],
  );

  const persistCapacityAssignees = useCallback(
    async (rows) => {
      const sprintId = sessionStorage.getItem('sprintId');
      const releaseId = sessionStorage.getItem('releaseId');
      const projectId = sessionStorage.getItem('projectId');
      const dataKey =
        selectedValue.value === APP_STRINGS.VALUE_SPRINT ? sprintId : releaseId;
      if (!projectId || !dataKey) {
        throw new Error('Select a project, board, and sprint or release before saving.');
      }
      let assigneesPayload = mapRowsToCapacityAssignees(rows);
      const payloadHasOffPlanManual = assigneesPayload.some(
        (a) =>
          (a.addedManually === 'yes' || a.addedManually === true) && a.presentInPlan === 'no',
      );
      if (!payloadHasOffPlanManual && offPlanManualAssigneesRef.current?.length > 0) {
        const norms = new Set(
          assigneesPayload.map((a) => normCapacityName(a.assignee)),
        );
        for (const a of offPlanManualAssigneesRef.current) {
          const aname = String(a.assignee || '').trim();
          if (!aname) continue;
          const k = normCapacityName(aname);
          if (norms.has(k)) continue;
          norms.add(k);
          assigneesPayload.push({
            assignee: a.assignee,
            role: a.role || '',
            allocationType: a.allocationType || '',
            availableHours: Number(a.availableHours || 0),
            allocatedHours: Number(a.allocatedHours || 0),
            billingRate: Number(a.billingRate || 0),
            holiday: Number(a.holiday ?? 0),
            leaves: Number(a.leaves ?? 0),
            addedManually: 'yes',
            sprintOrReleaseUser: a.sprintOrReleaseUser === 'yes' ? 'yes' : 'no',
            presentInPlan: 'no',
          });
        }
      }
      const dataToSave = {
        projectKey: projectId,
        [selectedValue.value.toLowerCase() + 'Id']: dataKey,
        assignees: assigneesPayload,
      };
      await addCapacity([dataToSave]);
      await updateCapacityValues(dataKey, selectedValue.value);
      await fetchProjectData();
    },
    [fetchProjectData, mapRowsToCapacityAssignees, selectedValue.value, updateCapacityValues],
  );

  const saveCapacityData = async () => {
    if (gridApiRef.current) gridApiRef.current.stopEditing();

    try {
      setLoading(true);
      await addStoryPoints(storyPointToHourRatio);
      await persistCapacityAssignees(teamData);
      setSaveStatus(true);
      setIsModalOpen(true);
      setTimeout(() => setSaveStatus(false), 500);
    } catch (error) {
      console.error('Error saving capacity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = useCallback(
    (uniqueKey, field, value) => {
      setTeamData((prevTeamData) => {
        const next = prevTeamData.map((row) => {
          if (row.id === uniqueKey) {
            const updatedRow = { ...row };
            if (field === 'role') {
              const selectedRole = roles.find((role) => role.role === value);
              updatedRow.role = value;
              updatedRow.billingRate = selectedRole ? selectedRole.rate : 0;
            } else if (field === 'allocationType') {
              updatedRow.allocationType = value;
            } else {
              updatedRow[field] = value;
            }
            return calculateDependentValues(updatedRow);
          }
          return row;
        });
        return next.filter((row) => shouldShowUnassignedCapacityGridRow(row, isHoursBasedProject));
      });
    },
    [roles, storyPointToHourRatio, calculateDependentValues, isHoursBasedProject],
  );

  const openAddUsersModal = useCallback(async () => {
    const rawMode =
      selectedValue?.value || jiraData?.selectedValue || sessionStorage.getItem('typeValue') || '';
    const mode = String(rawMode).toLowerCase();
    const isSprintCapacity = mode === 'sprint';
    const isReleaseCapacity = mode === 'release';
    const projectId = sessionStorage.getItem('projectId') || '';
    let assignees = [];
    try {
      if (isSprintCapacity) {
        const sprintId = sessionStorage.getItem('sprintId');
        if (sprintId) {
          const resp = await getSprintList();
          const list = Array.isArray(resp?.data) ? resp.data : [];
          const doc = list.find((s) => String(s._id) === String(sprintId));
          assignees = Array.isArray(doc?.assignees) ? doc.assignees : [];
        }
      } else if (isReleaseCapacity) {
        const releaseId = sessionStorage.getItem('releaseId');
        if (releaseId) {
          const resp = await getReleaseDetails();
          const list = Array.isArray(resp?.data) ? resp.data : [];
          const doc = list.find((r) => String(r._id) === String(releaseId));
          assignees = Array.isArray(doc?.assignees) ? doc.assignees : [];
        }
      }
    } catch (e) {
      console.warn('Add users modal: could not load sprint/release assignees', e);
      assignees = [];
    }

    const seen = new Set();
    for (const a of assignees) {
      const nm = String(a?.assignee || '').trim();
      if (nm) seen.add(normCapacityName(nm));
    }
    const merged = [...assignees];
    if (projectId) {
      let projectUsers = [];
      const fromStore = Array.isArray(jiraData?.projectList)
        ? jiraData.projectList.find((p) => String(p._id) === String(projectId))
        : null;
      if (fromStore && Array.isArray(fromStore.projectUsers)) {
        projectUsers = fromStore.projectUsers;
      }
      if (!projectUsers.length) {
        try {
          const projectsResponse = await getProjectList();
          const list = Array.isArray(projectsResponse?.data) ? projectsResponse.data : [];
          const fresh = list.find((p) => String(p._id) === String(projectId));
          if (fresh && Array.isArray(fresh.projectUsers) && fresh.projectUsers.length) {
            projectUsers = fresh.projectUsers;
            dispatch(setProjectList(list));
          }
        } catch (e) {
          console.warn('Add users modal: could not load project roster (projectUsers)', e);
        }
      }
      for (const u of projectUsers) {
        if (u && u.active === false) continue;
        const dn = String(u?.displayName || '').trim();
        const dnNorm = normCapacityName(dn);
        if (!dn || !dnNorm || dnNorm === 'unassigned' || dnNorm === 'none' || dnNorm === 'n/a') {
          continue;
        }
        const nk = dnNorm;
        if (seen.has(nk)) continue;
        seen.add(nk);
        merged.push({
          assignee: dn,
          role: u.role || '',
          allocationType: '',
          availableHours: 0,
          allocatedHours: 0,
          billingRate: 0,
          leaves: 0,
          addedManually: 'no',
          sprintOrReleaseUser: 'no',
        });
      }
    }

    setAddModalSprintReleaseAssignees(merged);
    setIsAddUsersModalOpen(true);
  }, [dispatch, jiraData?.projectList, jiraData?.selectedValue, selectedValue?.value]);

  const applyAddUsersModal = useCallback(
    async (newTeamData, prevTeamDataSnapshot) => {
      const prev =
        prevTeamDataSnapshot !== undefined && prevTeamDataSnapshot !== null
          ? prevTeamDataSnapshot
          : teamDataRef.current;
      const newNorms = new Set(
        newTeamData.filter((r) => r.name?.trim()).map((r) => normCapacityName(r.name)),
      );
      const removedEntries = [];
      for (const r of prev) {
        if (!r.name?.trim()) continue;
        const k = normCapacityName(r.name);
        if (newNorms.has(k)) continue;
        /** Roster-locked Jira rows stay on plan; manually added rows can always be taken off and recalled in the modal. */
        if (isSprintOrReleaseLockedRow(r) && !isManuallyAddedCapacityRow(r)) continue;
        removedEntries.push({
          name: r.name.trim(),
          manual: isManuallyAddedCapacityRow(r),
        });
      }

      setLoading(true);
      try {
        await persistCapacityAssignees(newTeamData);
        const offPlanManualNorms = new Set(
          newTeamData
            .filter(
              (r) =>
                isManuallyAddedCapacityRow(r) &&
                (r.presentInPlan === 'no' || r.presentInPlan === false),
            )
            .map((r) => normCapacityName(r.name)),
        );
        setModalRecalledOffPlan((recall) => {
          const map = new Map(recall.map((e) => [normCapacityName(e.name), e]));
          for (const ent of removedEntries) {
            if (offPlanManualNorms.has(normCapacityName(ent.name))) continue;
            map.set(normCapacityName(ent.name), ent);
          }
          for (const k of [...map.keys()]) {
            if (newNorms.has(k) || offPlanManualNorms.has(k)) {
              map.delete(k);
            }
          }
          return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
        });
      } catch (error) {
        console.error('Error saving capacity from Add Users modal:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [persistCapacityAssignees],
  );

  const requestRemoveManualUserFromPlan = useCallback((rowId) => {
    setManualDeleteConfirmRowId(rowId);
  }, []);

  const confirmRemoveManualUserFromPlan = useCallback(() => {
    setManualDeleteConfirmRowId((currentId) => {
      if (currentId == null) return null;
      const idStr = String(currentId);

      if (idStr.startsWith('recall:')) {
        const nk = idStr.slice(7);
        setModalRecalledOffPlan((prev) =>
          prev.filter((e) => !(e.manual && normCapacityName(e.name) === nk)),
        );
        return null;
      }

      if (idStr.startsWith('offplan:')) {
        const nk = idStr.slice(8);
        setPurgedOffPlanManualNorms((prev) => [...new Set([...prev, nk])]);
        offPlanManualAssigneesRef.current = offPlanManualAssigneesRef.current.filter(
          (a) => normCapacityName(a.assignee) !== nk,
        );
        setModalRecalledOffPlan((prev) =>
          prev.filter((e) => !(e.manual && normCapacityName(e.name) === nk)),
        );
        return null;
      }

      const row = teamDataRef.current.find((r) => String(r.id) === idStr);
      let nk = row?.name ? normCapacityName(row.name) : null;
      if (!nk) {
        const fromOff = offPlanManualAssigneesRef.current.find((a) => String(a._id || '') === idStr);
        if (fromOff?.assignee) nk = normCapacityName(fromOff.assignee);
      }
      if (nk) {
        offPlanManualAssigneesRef.current = offPlanManualAssigneesRef.current.filter(
          (a) => normCapacityName(a.assignee) !== nk,
        );
        setPurgedOffPlanManualNorms((prev) => [...new Set([...prev, nk])]);
        setModalRecalledOffPlan((prev) =>
          prev.filter((e) => !(e.manual && normCapacityName(e.name) === nk)),
        );
      } else {
        offPlanManualAssigneesRef.current = offPlanManualAssigneesRef.current.filter(
          (a) => String(a._id || '') !== idStr,
        );
      }
      setTeamData((prev) => prev.filter((r) => String(r.id) !== idStr));
      return null;
    });
  }, []);

  const onGridReady = useCallback((params) => {
    gridApiRef.current = params.api;
    if (params.api) params.api.sizeColumnsToFit();
  }, []);

  const isEditingAllowed = useMemo(() => {
    if (selectedValue.value === APP_STRINGS.VALUE_SPRINT) {
      const currentSprint = getAllSprintList.find((sprint) => sprint._id === selectedSprint.id);
      return (
        currentSprint?.state?.toLowerCase() === 'active' ||
        currentSprint?.state?.toLowerCase() === 'current'
      );
    } else if (selectedValue.value === APP_STRINGS.VALUE_RELEASE) {
      const currentRelease = getAllReleaseList.find(
        (release) => release._id === selectedRelease.id,
      );
      const status = currentRelease?.status?.toLowerCase();
      return status === 'unreleased' || status === 'active';
    }
    return false;
  }, [
    selectedValue.value,
    getAllSprintList,
    selectedSprint.id,
    getAllReleaseList,
    selectedRelease.id,
  ]);

  const enhancedColumns = useMemo(
    () =>
      allColumns.map((col) => {
        const updatedCol = { ...col };

        if (!isEditingAllowed) {
          updatedCol.editable = false;
          if (updatedCol.cellRenderer) {
            updatedCol.cellRendererParams = {
              ...(updatedCol.cellRendererParams || {}),
              calculateDependentValues,
              roles,
              handleInputChange,
              disabled: true,
            };
          }
        } else {
          if (updatedCol.cellRenderer) {
            updatedCol.cellRendererParams = {
              ...(updatedCol.cellRendererParams || {}),
              calculateDependentValues,
              roles,
              handleInputChange,
              disabled: false,
            };
          }
        }

        return updatedCol;
      }),
    [allColumns, calculateDependentValues, roles, handleInputChange, isEditingAllowed],
  );

  const memoizedTeamData = useMemo(() => teamData, [teamData]);

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
        const boardsForProject = jiraData?.boardListByProjectId?.[jiraData?.selectedProjectId] || [];
        const restoredId = restoredBoard?.id;
        if (boardsForProject.length === 0) {
          setSelectedBoard(restoredBoard);
          pendingBoardValidationRef.current = restoredId || null;
        } else {
          const isValidBoard = boardsForProject.some(
            (board) => (board.id || board._id) === restoredId,
          );
          if (isValidBoard) {
            setSelectedBoard(restoredBoard);
          }
        }
      }
      setSelectedOrg({
        id: jiraData.selectedOrgId || '',
        name: jiraData.selectedOrgName || '',
      });
      setIsProjectOpen(jiraData.isProjectOpen || false);
      setIsOrganizationOpen(jiraData.isOrganizationOpen || false);
      setIsSprintOpen(jiraData.isSprintOpen || false);
      setGetAllSprintList(jiraData.sprintList || []);
      setIsValueOpen(jiraData.isValueOpen || false);
      setSelectedValue({
        label: jiraData.selectedValueLabel || APP_STRINGS.SELECT_AN_OPTION,
        value: jiraData.selectedValue || '',
      });
      setGetAllReleaseList(jiraData.releasesList || []);
    }
  }, [jiraData]);

  useEffect(() => {
    const pendingId = pendingBoardValidationRef.current;
    if (!pendingId) return;
    const boardsForProject = jiraData?.boardListByProjectId?.[jiraData?.selectedProjectId] || [];
    if (boardsForProject.length === 0) return;
    const isValidBoard = boardsForProject.some(
      (board) => (board.id || board._id) === pendingId,
    );
    if (!isValidBoard) {
      setSelectedBoard({ id: '', name: '', type: '' });
      clearBoardFromSession();
    }
    pendingBoardValidationRef.current = null;
  }, [jiraData?.boardListByProjectId, jiraData?.selectedProjectId]);

  useEffect(() => {
    if (orgsData) {
      setGetAllOrgsList(orgsData);
    }
  }, [orgsData]);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const companyId = sessionStorage.getItem('companyId');
        let projects = jiraData?.projectList;
        if (!projects || projects.length === 0) {
          const projectsResponse = await getProjectList(companyId);
          projects = projectsResponse?.data || [];
          dispatch(setProjectList(projects));
        }
        if (isMounted) setGetAllProjectList(projects || []);

        let roleRates = Array.isArray(jiraData?.roleRates) ? jiraData.roleRates : null;
        let storyPointRatio = typeof jiraData?.storyPointRatio === 'number'
          ? jiraData.storyPointRatio
          : null;
        if (!roleRates || roleRates.length === 0 || storyPointRatio === null) {
          if (!roleRatesFetchPromiseRef.current) {
            roleRatesFetchPromiseRef.current = (async () => {
              const rolesData = await getRoleRatesAndStoryPoints(companyId);
              const fetchedRoleRates = rolesData?.roleRates || [];
              const fetchedStoryPointRatio =
                typeof rolesData?.storyPoints === 'number' ? rolesData.storyPoints : 8;
              dispatch(setRoleRates(fetchedRoleRates));
              dispatch(setStoryPointRatio(fetchedStoryPointRatio));
              return { roleRates: fetchedRoleRates, storyPointRatio: fetchedStoryPointRatio };
            })()
              .catch((rolesError) => {
                console.warn('Could not load role rates:', rolesError);
                return { roleRates: [], storyPointRatio: 8 };
              })
              .finally(() => {
                roleRatesFetchPromiseRef.current = null;
              });
          }
          const fetched = await roleRatesFetchPromiseRef.current;
          roleRates = fetched?.roleRates || [];
          storyPointRatio = typeof fetched?.storyPointRatio === 'number'
            ? fetched.storyPointRatio
            : 8;
        }
        if (isMounted) {
          if (roleRates) setRoles(roleRates);
          if (typeof storyPointRatio === 'number') setStoryPointToHourRatio(storyPointRatio);
        }

        const projectId = getId().projectId;
        if (projectId) {
          const selectedProject = projects.find((p) => p._id === projectId);
          if (selectedProject && isMounted) {
            setSelectedProject({ id: selectedProject._id, name: selectedProject.name });
            await fetchProjectDataRef.current?.();
          }
        }
      } catch (error) {
        if (isMounted) console.error('Error fetching data:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [dispatch, jiraData?.projectList, jiraData?.roleRates, jiraData?.storyPointRatio]);

  useEffect(() => {
    const selectedSprint = jiraData?.sprintList?.find(
      (sprint) => sprint._id === jiraData?.selectedSprintId,
    );
    const selectedRelease = jiraData?.releasesList?.find(
      (release) => release._id === jiraData?.selectedReleaseId,
    );
    const isHoursFromSprint = selectedSprint?.hours === true;
    const isHoursFromRelease = selectedRelease?.hours === true;
    const isHoursBased = isHoursFromSprint || isHoursFromRelease || isAzure;
    setIsHoursBasedProject(isHoursBased);
    sessionStorage.setItem('isHoursBasedProject', isHoursBased.toString());
  }, [jiraData, isAzure, setIsHoursBasedProject]);

  useEffect(() => {
    if (!selectedProject?.id) {
      return;
    }
    if (typeof jiraData?.storyPointRatio === 'number') {
      setStoryPointToHourRatio(jiraData.storyPointRatio);
    }
  }, [selectedProject?.id, jiraData?.storyPointRatio]);

  useEffect(() => {
    if (teamData.length === 0) return;
    const updated = teamData.map((row) => calculateDependentValues(row));
    const isDifferent = JSON.stringify(updated) !== JSON.stringify(teamData);
    if (isDifferent) {
      setTeamData(updated);
    }
  }, [calculateDependentValues]);

useEffect(() => {
    const handleResize = () => {
      const headerHeight = 220;
      const rowHeight = 40;
      const availableHeight = window.innerHeight - headerHeight;
      const rowsThatFit = Math.floor(availableHeight / rowHeight);

      if (rowsThatFit <= 10) setPageSize(7);
      else if (rowsThatFit <= 11) setPageSize(8);
      else if (rowsThatFit <= 12) setPageSize(9);
      else if (rowsThatFit <= 13) setPageSize(10);
      else if (rowsThatFit <= 14) setPageSize(11);
      else if (rowsThatFit <= 15) setPageSize(12);
      else if (rowsThatFit <= 16) setPageSize(13);
      else if (rowsThatFit <= 17) setPageSize(14);
      else if (rowsThatFit <= 20) setPageSize(15);
      else setPageSize(20);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const headerHeight = 220;
      const availableHeight = window.innerHeight - headerHeight;
      setGridHeight(`${availableHeight - 50}px`);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (getAllProjectList.length === 0) return;
    const cachedBoardLists = jiraData?.boardListByProjectId || {};
    const boardCounts = {};
    for (const project of getAllProjectList) {
      const cachedBoards = cachedBoardLists[project._id];
      boardCounts[project._id] = Array.isArray(cachedBoards) ? cachedBoards.length : 0;
    }
    setProjectBoardCount(boardCounts);
  }, [getAllProjectList, jiraData?.boardListByProjectId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isBoardOpen && !event.target.closest('.board-submenu')) {
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
      <>
        {loading && (
          <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-light-100 bg-opacity-50 dark:bg-secondary-500 dark:bg-opacity-50 text-black dark:text-custom-gray z-50">
            <Spinner />
          </div>
        )}
        <div className="mt-20 pr-6 pl-2">
          <button
            onClick={() => navigate('/standup')}
            className="flex items-center dark:text-[#FFFFFF] text-[#202020] hover:text-[#066FD1] font-medium mb-4 ml-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.707 14.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L4.414 9H17a1 1 0 110 2H4.414l3.293 3.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Back to StandUp Page
          </button>

          <div className="mt-4 grid grid-cols-1">
            <div className="flex flex-wrap gap-2 ml-3">
              {getAllOrgsList.length > 0 && (
                <div>
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
                    width="lg"
                  />
                </div>
              )}

              <div>
                <DropdownButton
                  buttonLabel="Select Project"
                  options={getAllProjectList
                    ?.filter((project) => project.isSelected && project.hideStatus === false)
                    .map((project) => ({
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
                  width="lg"
                />
              </div>
              
              {/* Board Sub-menu Overlay */}
              {isBoardOpen && subMenuBoards.length > 0 && (
                <div 
                  className="board-submenu fixed z-[9999] bg-white dark:bg-[#182433] rounded-lg shadow-lg border border-gray-200 dark:border-[#30445A] min-w-[200px]"
                  style={{
                    top: `${subMenuPosition.top}px`,
                    left: `${subMenuPosition.left}px`
                  }}
                  onMouseEnter={() => {
                  }}
                  onMouseLeave={() => {
                    setTimeout(() => {
                      const projectElement = document.querySelector(`[data-project-id="${currentProjectForBoard}"]`);
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
                  options={[
                    { value: APP_STRINGS.VALUE_SPRINT, label: sprintLabel },
                    { value: APP_STRINGS.VALUE_DATE_RANGE, label: APP_STRINGS.VALUE_DATE_RANGE },
                    { value: APP_STRINGS.VALUE_RELEASE, label: releaseLabel },
                  ]}
                  onSelect={handleValueChange}
                  selectedOption={
                        selectedValue?.value === APP_STRINGS.VALUE_SPRINT
                          ? sprintLabel
                          : selectedValue?.value === APP_STRINGS.VALUE_RELEASE
                          ? releaseLabel
                          : selectedValue?.value
                      }
                  isOpen={isValueOpen}
                  setIsOpen={setIsValueOpen}
                  reference={valueRef}
                  width="lg"
                />
              </div>

              {selectedValue.value === APP_STRINGS.VALUE_SPRINT && (
                <div className="min-w-[180px]">
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
                    width="lg"
                  />
                </div>
              )}

              {selectedValue.value === APP_STRINGS.VALUE_RELEASE && (
                <div className="min-w-[180px]">
                  <DropdownButton
                    buttonLabel={`${APP_STRINGS.LABEL_SELECT_PREFIX}${releaseLabel}`}
                    options={getAllReleaseList.map((release) => ({
                      value: release._id,
                      label: release.releaseName,
                      status: release.status,
                    }))}
                    onSelect={handleReleaseChange}
                    placeholder={APP_STRINGS.LABEL_SELECT_RELEASE}
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
            <div className="flex justify-between items-center mt-4 ml-4">
              <div>
                {!isHoursBasedProject && (() => {
                  const currentProject = getAllProjectList.find(p => p._id === selectedProject.id);
                  return currentProject?.projectTypeKey !== "gitlab-project";
                })() && (
                  <div className="flex items-center text-sm gap-2">
                    <span className="text-gray-700 dark:text-[#FFFFFF] font-medium">
                      1 Story Point
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={storyPointToHourRatio}
                      onChange={(e) => setStoryPointToHourRatio(Number(e.target.value))}
                      className="w-14 px-1 py-[2px] h-[32px] text-sm border bg-white dark:bg-[#182433] text-custom-black dark:text-[#FFFFFF] focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-md"
                    />
                    <span className="text-gray-700 dark:text-[#FFFFFF]">hrs</span>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={openAddUsersModal}
                  className={`${
                    !selectedProject.id || !isEditingAllowed
                      ? 'bg-gray-500 cursor-not-allowed'
                      : 'bg-[#22C55E] hover:bg-[#16A34A]'
                  } text-white px-4 py-2 rounded flex items-center`}
                  disabled={!selectedProject.id || !isEditingAllowed}
                >
                  Add Users
                </button>
                <button
                  onClick={saveCapacityData}
                  className={`${
                    !selectedProject.id || saveStatus || !isEditingAllowed
                      ? 'bg-gray-500 cursor-not-allowed'
                      : theme === 'light'
                        ? 'bg-[#24527A] hover:bg-[#5580A6]'
                        : 'bg-[#066FD1] hover:bg-[#2B8AE3]'
                  } text-white px-4 py-2 rounded flex items-center`}
                  disabled={!selectedProject.id || saveStatus || !isEditingAllowed}
                >
                  {saveStatus ? 'Saved' : 'Save Data'}
                </button>
              </div>
            </div>
            <div className="rounded-lg shadow-xl mt-4" style={{ height: "calc(100vh - 220px)" }}>
              <div className={`ml-3 pb-2 dark:bg-[#182433] dark:text-[#C8C8C8] ${theme === 'light' ? 'bg-[#FFFFFF] text-[#202020] border-2 border-[#DFE0EF]' : 'text-black border-2 border-[#25384F]'} rounded-lg shadow-md w-full flex-1 overflow-x-auto`}>
                <div className="capacity-planning-grid">
                  <AGrid
                    key={selectedValue}
                    rowData={memoizedTeamData}
                    columnDefs={enhancedColumns}
                    defaultColDef={{
                      sortable: true,
                      sortIcon: true,
                      sortingOrder: ['asc', 'desc'],
                      resizable: true,
                      flex: 1,
                      tooltipShowDelay: 0,
                      filter: false,
                      floatingFilter: false,
                    }}
                    onFilterChanged={() => {
                      if (gridApiRef.current) gridApiRef.current.onFilterChanged();
                    }}
                    onGridReady={onGridReady}
                    onApiReady={(api) => {
                      gridApiRef.current = api;
                    }}
                    context={{
                      handleInputChange,
                      isEditingAllowed,
                    }}
                    getRowId={(params) => params.data.id}
                    tooltipShowDelay={100}
                    tooltipMouseTrack
                    domLayout="normal"
                    height={gridHeight}
                    initialPageSize={pageSize}
                    theme={theme}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <AddCapacityUsersModal
          isOpen={isAddUsersModalOpen}
          onClose={() => setIsAddUsersModalOpen(false)}
          onApply={applyAddUsersModal}
          isPersistAllowed={isEditingAllowed}
          recalledOffPlan={modalRecalledOffPlan}
          purgedManualNormKeys={purgedOffPlanManualNorms}
          teamData={teamData}
          sprintReleaseAssignees={addModalSprintReleaseAssignees}
          isHoursBasedProject={isHoursBasedProject}
          storyPointToHourRatio={storyPointToHourRatio}
          calculateDependentValues={calculateDependentValues}
          roles={roles}
          onRequestRemoveManualUser={requestRemoveManualUserFromPlan}
        />
        {manualDeleteConfirmRowId != null && (
          <Modal
            isOpen
            onClose={() => setManualDeleteConfirmRowId(null)}
            title="Remove user"
            size="small"
            content={
              <div className="flex flex-col items-center justify-center py-4 px-4 text-center">
                <p
                  className={`text-sm mb-6 ${
                    theme === 'light' ? 'text-[#073C6A]' : 'text-gray-300'
                  }`}
                >
                  Are you sure you want to remove this user from the capacity plan?
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setManualDeleteConfirmRowId(null)}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                      theme === 'light'
                        ? 'bg-gray-200 text-[#202020] hover:bg-gray-300'
                        : 'bg-[#25384F] text-[#D9E4F1] hover:bg-[#2f4a63]'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmRemoveManualUserFromPlan}
                    className="px-4 py-2 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            }
          />
        )}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title=""
          className="max-w-sm"
          content={
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-3">
                <div className="h-10 w-10 rounded-full bg-green-500 bg-opacity-20 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="text-lg font-semibold mb-1 dark:text-white text-[#0A2342]">Success</h2>
              <p className={`text-sm mb-4 ${theme === 'light' ? 'text-[#0A2342]' : 'text-gray-300'}`}>Data saved successfully!</p>
              <button
                onClick={() => setIsModalOpen(false)}
                className="mt-2 px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition"
              >
                OK
              </button>
            </div>
          }
        />
        {warningModal.isOpen && (
          <Modal
            isOpen={warningModal.isOpen}
            onClose={() => setWarningModal({ isOpen: false, message: '' })}
            title="Warning"
            className="max-w-sm"
            content={
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="mb-3">
                  <div className="h-10 w-10 rounded-full bg-yellow-500 bg-opacity-20 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-yellow-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
                      />
                    </svg>
                  </div>
                </div>
                <h2 className="text-lg font-semibold mb-1 text-white">Warning</h2>
                <p className={`text-sm mb-4 ${theme === 'light' ? 'text-[#073C6A]' : 'text-gray-300'}`}>{warningModal.message}</p>
                <button
                  onClick={() => setWarningModal({ isOpen: false, message: '' })}
                  className="mt-2 px-3 py-1.5 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition"
                >
                  OK
                </button>
              </div>
            }
          />
        )}
      </>
    </CommonLayout>
  );
};

export default CapacityDashboard;
