import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useState, useMemo, useEffect } from 'react';
import { getChangeColorForWidget, getTooltipContentByName } from '../JiraCommonFunction';
import { InformationCircleIcon } from '@heroicons/react/outline';
import DropdownButton from '../../Common/DropDown';
import ReactDOMServer from 'react-dom/server';
import getTooltipContent from '../../../utils/Tooltip';
import { formatNumberWithSuffix } from '../../../utils/commonFunctions';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import Tooltip from '../../Common/ToolTip';
import { getBoardLabels } from '../../../utils/boardUtils';
import { APP_STRINGS } from '../../../constants';

const Dashboard = ({ layout, itemDetails }) => {
  const rootStyles = getComputedStyle(document.documentElement);
  const theme = useSelector((state) => state?.theme?.theme || APP_STRINGS.THEME_LIGHT);
  const jiraData = useSelector((state) => state?.jira || {});
  const sprintsData = jiraData?.sprintList || [];
  const releasesData = jiraData?.releasesList || [];
  const spBlockedData = jiraData?.blockedStoryPointsData || [];
  const spByTeamMemberData = jiraData?.teamMemberStoryPointsData || {};

  const [toggleType, setToggleType] = useState(APP_STRINGS.STORY_POINTS);
  const [selectedProject, setSelectedProject] = useState({ id: '', name: '' });
  const [selectedValue, setSelectedValue] = useState({
    label: APP_STRINGS.VALUE_SPRINT,
    value: APP_STRINGS.API_SPRINT,
  });
  const [selectedSprint, setSelectedSprint] = useState({ id: '', name: '' });
  const [selectedSprintData, setSelectedSprintData] = useState([]);
  const [selectedReleaseData, setSelectedReleaseData] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState({ id: '', releaseName: '' });
  const [selectedReleaseDate, setSelectedReleaseDate] = useState({ id: '', releaseDate: '' });
  const [selectedSprintEndDate, setSelectedSprintEndDate] = useState({ id: '', endDate: '' });
  const [getAllProjectList, setGetAllProjectList] = useState([]);
  const [currentSprint, setCurrentSprint] = useState({});
  const [currentRelease, setCurrentRelease] = useState({});
  const [toggleBlocked, setToggleBlocked] = useState('Blocked');
  const [toggleSprintTeam, setToggleSprintTeam] = useState(APP_STRINGS.API_SPRINT);
  const { sprintLabel, releaseLabel } = getBoardLabels();
  const selectedValueDisplay =
    selectedValue?.value === APP_STRINGS.VALUE_SPRINT
      ? sprintLabel
      : selectedValue?.value === APP_STRINGS.VALUE_RELEASE
      ? releaseLabel
      : selectedValue?.value;

  useEffect(() => {
    if (jiraData) {
      setSelectedValue({
        label: jiraData.selectedValueLabel || APP_STRINGS.VALUE_SPRINT,
        value: jiraData.selectedValue || APP_STRINGS.API_SPRINT,
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

      const selectedProjects = (jiraData.projectList || []).filter(
        (project) => project.isSelected && project.hideStatus === false,
      );
      setGetAllProjectList(selectedProjects);

      setCurrentSprint(jiraData.Sprint || {});
      setCurrentRelease(jiraData.Release || {});

      const sprintMetrics = jiraData?.Sprint?.committedVsCompletedMetrics || [];
      const releaseMetrics = jiraData?.Release?.committedVsCompletedMetrics || [];

      if (!Array.isArray(sprintMetrics) && sprintsData.length > 0) {
        setSelectedSprintData(sprintsData);
      } else {
        setSelectedSprintData(Array.isArray(sprintMetrics) ? sprintMetrics : []);
      }

      if (!Array.isArray(releaseMetrics) && releasesData.length > 0) {
        setSelectedReleaseData(releasesData);
      } else {
        setSelectedReleaseData(Array.isArray(releaseMetrics) ? releaseMetrics : []);
      }

      setToggleSprintTeam(jiraData.selectedValue || APP_STRINGS.API_SPRINT);
    }
  }, [jiraData, sprintsData, releasesData]);

  useEffect(() => {
    if (currentSprint?.endDate) {
      const endDate = new Date(currentSprint.endDate);
      if (!isNaN(endDate.getTime())) {
        const formattedEndDate = endDate.toLocaleDateString('en-IN');
        setSelectedSprintEndDate({ id: currentSprint?._id, endDate: formattedEndDate });
      }
    }

    if (currentRelease?.releaseDate) {
      const releaseDate = new Date(currentRelease.releaseDate);
      if (!isNaN(releaseDate.getTime())) {
        const formattedReleaseDate = releaseDate.toLocaleDateString('en-IN');
        setSelectedReleaseDate({ id: currentRelease?._id, releaseDate: formattedReleaseDate });
      }
    }
  }, [currentSprint, currentRelease]);

  const getMetricValue = ({
    selectedValue,
    toggleType,
    selectedSprintData,
    selectedReleaseData,
    metricType,
  }) => {
    const isSprintMode = selectedValue?.value?.toLowerCase() === APP_STRINGS.API_SPRINT;
    const isReleaseMode = selectedValue?.value?.toLowerCase() === APP_STRINGS.API_RELEASE;

    let dataSource = [];
    let selectedItem = null;

    if (isSprintMode) {
      dataSource =
        selectedSprintData && selectedSprintData.length > 0 ? selectedSprintData : sprintsData;
      selectedItem = selectedSprint;
    } else if (isReleaseMode) {
      dataSource =
        selectedReleaseData && selectedReleaseData.length > 0 ? selectedReleaseData : releasesData;
      selectedItem = selectedRelease;
    } else {
      dataSource =
        selectedSprintData && selectedSprintData.length > 0 ? selectedSprintData : sprintsData;
      selectedItem = selectedSprint;
    }

    if (!dataSource || !Array.isArray(dataSource) || dataSource.length === 0) {
      return 0;
    }

    let targetData = null;

    if (selectedItem && selectedItem.id) {
      targetData = dataSource.find((item) => {
        return (
          item?.sprintId === selectedItem.id ||
          item?._id === selectedItem.id ||
          item?.releaseId === selectedItem.id
        );
      });
    }

    if (!targetData && dataSource.length > 0) {
      targetData = dataSource[dataSource.length - 1];
    }

    if (!targetData) {
      return 0;
    }

    const metrics = targetData?.committedVsCompletedMetrics || targetData || {};

    const isStoryPoints = toggleType === APP_STRINGS.STORY_POINTS;

    let fieldName = '';
    let value = 0;

    switch (metricType) {
      case 'initial':
        fieldName = isStoryPoints ? 'initialStoryPoints' : 'initialHours';
        break;
      case 'spillover':
        fieldName = isStoryPoints ? 'spilloverStoryPoints' : 'spilloverHours';
        break;
      case 'committed':
        fieldName = isStoryPoints ? 'committedStoryPoints' : 'committedHours';
        break;
      case 'completed':
        fieldName = isStoryPoints ? 'completedStoryPoints' : 'completedHours';
        break;
      case 'remaining':
        fieldName = isStoryPoints ? 'remainingStoryPoints' : 'remainingHours';
        break;
      case 'removed':
        fieldName = isStoryPoints ? 'removedStoryPoints' : 'removedHours';
        break;
      case 'storyPointsAddedInBeginning':
      case 'hoursAddedInBeginning':
        fieldName = metricType;
        break;
      case 'storyPointsAddedAfterStart':
      case 'hoursAddedAfterStart':
        fieldName = metricType;
        break;
      default:
        return 0;
    }

    value = Number(metrics[fieldName]) || 0;
    return value;
  };

  const completed = getMetricValue({
    selectedValue,
    toggleType,
    selectedSprintData,
    selectedReleaseData,
    metricType: 'completed',
  });

  const committed = getMetricValue({
    selectedValue,
    toggleType,
    selectedSprintData,
    selectedReleaseData,
    metricType: 'committed',
  });

  let averageValue = 0;
  if (committed && committed > 0) {
    averageValue = (completed / committed) * 100;
  }

  const average = averageValue ? averageValue.toFixed(2) : '0.00';

  const getChangeColorForCountDown = (change) => {
    if (change === 0) {
      return rootStyles.getPropertyValue('--trisoled-color-tertiary').trim();
    } else if (change > 0 && change <= 5) {
      return rootStyles.getPropertyValue('--trisoled-color-secondary').trim();
    } else if (change > 5) {
      return rootStyles.getPropertyValue('--trisoled-color-primary').trim();
    }
    return rootStyles.getPropertyValue('--trisoled-color-tertiary').trim();
  };

  const processBlockedData = useMemo(() => {
    if (!spBlockedData || !Array.isArray(spBlockedData) || spBlockedData.length === 0) {
      return {
        blockedStoryPoints: 0,
        blockedStoryPointsNow: 0,
        blockedDurationHours: 0,
        blockedTrend: [],
      };
    }

    const blockedData = spBlockedData.find((item) => item?.getBlockedStoryPoints?.result);
    if (!blockedData || !blockedData.getBlockedStoryPoints) {
      return {
        blockedStoryPoints: 0,
        blockedStoryPointsNow: 0,
        blockedDurationHours: 0,
        blockedTrend: [],
      };
    }

    const blockedResult = blockedData?.getBlockedStoryPoints?.result || {};
    const blockedStoryPoints = blockedResult.numberOfBlockedStoryPoints || 0;
    const blockedStoryPointsNow = blockedResult.numberOfBlockedStoryPointsNow || 0;
    const blockedDurationHours = Math.round(
      blockedResult.averageDurationOfBlockedStoryPointsHours || 0,
    );
    const blockedTrend = Array.isArray(blockedResult.blockedStoryPointsTrendOverMultipleSprint)
      ? blockedResult.blockedStoryPointsTrendOverMultipleSprint
      : [];

    return {
      blockedStoryPoints,
      blockedStoryPointsNow,
      blockedDurationHours,
      blockedTrend,
    };
  }, [spBlockedData]);

  const deviationData = useMemo(() => {
    const blockedData = processBlockedData;
    const isSprintMode = selectedValue?.value?.toLowerCase() === APP_STRINGS.API_SPRINT;
    const isReleaseMode = selectedValue?.value?.toLowerCase() === APP_STRINGS.API_RELEASE;

    let dataSource = [];
    if (isSprintMode) {
      dataSource = selectedSprintData.length > 0 ? selectedSprintData : sprintsData;
    } else if (isReleaseMode) {
      dataSource = selectedReleaseData.length > 0 ? selectedReleaseData : releasesData;
    } else {
      dataSource = selectedSprintData.length > 0 ? selectedSprintData : sprintsData;
    }

    if (!dataSource || !Array.isArray(dataSource) || dataSource.length === 0) {
      return {
        labels: [],
        deviationValues: [],
        currentDeviation: 0,
        ...blockedData,
      };
    }

    const now = new Date();
    const filteredData = dataSource.filter((item) => {
      const itemDate = new Date(
        item?.startDate || item?.createdDate || item?.date || item?.sprintStartDate,
      );
      return !isNaN(itemDate.getTime()) && itemDate <= now;
    });

    const allSortedData = [...filteredData].sort((a, b) => {
      const dateA = new Date(a?.startDate || a?.createdDate || a?.date || a?.sprintStartDate || 0);
      const dateB = new Date(b?.startDate || b?.createdDate || b?.date || b?.sprintStartDate || 0);
      return dateA - dateB;
    });

    let selectedItem = isSprintMode ? selectedSprint : selectedRelease;
    let sortedData;

    if (selectedItem && selectedItem.id) {
      const selectedItemIndex = allSortedData.findIndex((item) => {
        return (
          item?.sprintId === selectedItem.id ||
          item?._id === selectedItem.id ||
          item?.releaseId === selectedItem.id
        );
      });

      if (selectedItemIndex !== -1) {
        const endIndex = selectedItemIndex + 1;
        const startIndex = Math.max(0, endIndex - 6);
        sortedData = allSortedData.slice(startIndex, endIndex);
      } else {
        sortedData = allSortedData.slice(-6);
      }
    } else {
      sortedData = allSortedData.slice(-6);
    }

    const labels = sortedData.map((item) => {
      if (isSprintMode) {
        return item?.name || item?.sprintName || `Sprint ${item?.sprintId || ''}`;
      } else {
        return item?.releaseName || item?.name || `Release ${item?.releaseId || ''}`;
      }
    });

    const deviationValues = sortedData.map((item) => {
      const metrics = item?.committedVsCompletedMetrics || item;

      if (toggleType === APP_STRINGS.STORY_POINTS) {
        const committed = metrics?.committedStoryPoints || 0;
        const completed = metrics?.completedStoryPoints || 0;
        return completed - committed;
      } else {
        const committedTickets = metrics?.committedTickets || 0;
        const completedTickets = metrics?.completedTickets || 0;
        return completedTickets - committedTickets;
      }
    });

    const currentDeviation =
      deviationValues.length > 0 ? deviationValues[deviationValues.length - 1] : 0;

    return {
      labels,
      deviationValues,
      currentDeviation,
      ...blockedData,
    };
  }, [
    selectedSprintData,
    selectedReleaseData,
    selectedValue,
    toggleType,
    processBlockedData,
    sprintsData,
    releasesData,
    selectedSprint,
    selectedRelease,
  ]);

  const isSprintMode = selectedValue?.value?.toLowerCase() === APP_STRINGS.API_SPRINT;
  const isReleaseMode = selectedValue?.value?.toLowerCase() === APP_STRINGS.API_RELEASE;

  const processTeamMemberData = useMemo(() => {
    if (!spByTeamMemberData || typeof spByTeamMemberData !== 'object') {
      return {
        teamMemberLabels: [],
        teamMemberCommitted: [],
        teamMemberCompleted: [],
      };
    }

    let teamMemberData = spByTeamMemberData;

    if (Array.isArray(spByTeamMemberData)) {
      const currentData = spByTeamMemberData.find((item) => item.SPByTeamMember);
      if (!currentData || !currentData.SPByTeamMember) {
        return {
          teamMemberLabels: [],
          teamMemberCommitted: [],
          teamMemberCompleted: [],
        };
      }
      teamMemberData = currentData.SPByTeamMember;
    } else if (spByTeamMemberData.SPByTeamMember) {
      teamMemberData = spByTeamMemberData.SPByTeamMember;
    }

    const teamMemberKeys = Object.keys(teamMemberData);
    if (teamMemberKeys.length === 0) {
      return {
        teamMemberLabels: [],
        teamMemberCommitted: [],
        teamMemberCompleted: [],
      };
    }

    const teamMemberLabels = teamMemberKeys;
    const teamMemberCommitted = teamMemberLabels.map(
      (member) => teamMemberData[member]?.committed || 0,
    );
    const teamMemberCompleted = teamMemberLabels.map(
      (member) => teamMemberData[member]?.completed || 0,
    );

    return {
      teamMemberLabels,
      teamMemberCommitted,
      teamMemberCompleted,
    };
  }, [spByTeamMemberData]);

  const processedData = useMemo(() => {
    const teamMemberData = processTeamMemberData;
    let dataSource = [];
    let selectedItem = null;

    if (isSprintMode) {
      dataSource = selectedSprintData.length > 0 ? selectedSprintData : sprintsData;
      selectedItem = selectedSprint;
    } else if (isReleaseMode) {
      dataSource = selectedReleaseData.length > 0 ? selectedReleaseData : releasesData;
      selectedItem = selectedRelease;
    } else {
      dataSource = selectedSprintData.length > 0 ? selectedSprintData : sprintsData;
      selectedItem = selectedSprint;
    }

    if (!dataSource || !Array.isArray(dataSource) || dataSource.length === 0) {
      return {
        labels: [],
        completedPercentages: [],
        committedPercentages: [],
        velocityData: [],
        committedData: [],
        completedData: [],
        gapData: [],
        initiallyCommittedData: [],
        finallyCommittedData: [],
        doneData: [],
        ...teamMemberData,
      };
    }

    const allSortedData = [...dataSource].sort((a, b) => {
      const dateA = new Date(a?.startDate || a?.createdDate || a?.date || a?.sprintStartDate || 0);
      const dateB = new Date(b?.startDate || b?.createdDate || b?.date || b?.sprintStartDate || 0);
      return dateA - dateB;
    });

    let sortedData;
    if (selectedItem && selectedItem.id) {
      const selectedItemIndex = allSortedData.findIndex((item) => {
        return (
          item?.sprintId === selectedItem.id ||
          item?._id === selectedItem.id ||
          item?.releaseId === selectedItem.id
        );
      });

      if (selectedItemIndex !== -1) {
        const endIndex = selectedItemIndex + 1;
        const startIndex = Math.max(0, endIndex - 6);
        sortedData = allSortedData.slice(startIndex, endIndex);
      } else {
        sortedData = allSortedData.slice(-6);
      }
    } else {
      sortedData = allSortedData.slice(-6);
    }

    const labels = sortedData.map((item) => {
      if (isSprintMode) {
        return item?.name || item?.sprintName || `Sprint ${item?.sprintId || ''}`;
      } else if (isReleaseMode) {
        return item?.releaseName || item?.name || `Release ${item?.releaseId || ''}`;
      }
      return item?.name || item?.sprintName || `Sprint ${item?.sprintId || ''}`;
    });

    const getMetrics = (item) => item?.committedVsCompletedMetrics || item || {};

    const completedPercentages = sortedData.map((item) => {
      const metrics = getMetrics(item);
      const committed = metrics?.committedStoryPoints || 0;
      const completed = metrics?.completedStoryPoints || 0;
      return committed > 0 ? Math.round((completed / committed) * 100) : 0;
    });

    const committedPercentages = sortedData.map((item) => {
      const metrics = getMetrics(item);
      const total = item?.totalStoryPoints || metrics?.totalStoryPoints || 0;
      const committed = metrics?.committedStoryPoints || 0;
      return total > 0 ? Math.round((committed / total) * 100) : 100;
    });

    const committedData = sortedData.map((item) => {
      const metrics = getMetrics(item);
      return metrics?.committedStoryPoints || 0;
    });

    const completedData = sortedData.map((item) => {
      const metrics = getMetrics(item);
      return metrics?.completedStoryPoints || 0;
    });

    const gapData = committedData.map((committed, index) =>
      Math.max(0, committed - completedData[index]),
    );

    const initiallyCommittedData = sortedData.map((item) => {
      const metrics = getMetrics(item);
      return metrics?.initialStoryPoints || metrics?.initiallyCommittedStoryPoints || 0;
    });

    const finallyCommittedData = sortedData.map((item) => {
      const metrics = getMetrics(item);
      return metrics?.committedStoryPoints || 0;
    });

    const doneData = sortedData.map((item) => {
      const metrics = getMetrics(item);
      return metrics?.completedStoryPoints || 0;
    });

    const velocityData = sortedData.map((item) => {
      return item?.velocity?.completed || item?.completedStoryPoints || 0;
    });

    const result = {
      labels,
      completedPercentages,
      committedPercentages,
      velocityData,
      committedData,
      completedData,
      gapData,
      initiallyCommittedData,
      finallyCommittedData,
      doneData,
      ...teamMemberData,
    };
    return result;
  }, [
    selectedSprintData,
    selectedReleaseData,
    selectedSprint,
    selectedRelease,
    selectedValue,
    isSprintMode,
    isReleaseMode,
    processTeamMemberData,
    sprintsData,
    releasesData,
  ]);

  const averageVelocity = (arr) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return 0;
    const validValues = arr.filter((val) => typeof val === 'number' && !isNaN(val));
    if (validValues.length === 0) return 0;
    return Math.round(validValues.reduce((sum, val) => sum + val, 0) / validValues.length);
  };

  const averageData = useMemo(() => {
    const avgInitiallyCommitted = averageVelocity(processedData.initiallyCommittedData);
    const avgFinallyCommitted = averageVelocity(processedData.finallyCommittedData);
    const avgDone = averageVelocity(processedData.doneData);
    const avgVelocity = averageVelocity(processedData.velocityData);
    const avgCommitted = averageVelocity(processedData.committedData);
    const avgCompleted = averageVelocity(processedData.completedData);
    const avgTeamMemberCommitted = averageVelocity(processedData.teamMemberCommitted);
    const avgTeamMemberCompleted = averageVelocity(processedData.teamMemberCompleted);

    return {
      avgInitiallyCommitted,
      avgFinallyCommitted,
      avgDone,
      avgVelocity,
      avgCommitted,
      avgCompleted,
      avgTeamMemberCommitted,
      avgTeamMemberCompleted,
    };
  }, [processedData]);

  useEffect(() => {
    if (selectedProject.id && getAllProjectList.length > 0) {
      const project = getAllProjectList.find((p) => p._id === selectedProject.id);
      const type = project?.estimation?.type || '';

      let selectedEstimationType = APP_STRINGS.STORY_POINTS;

      if (type) {
        selectedEstimationType = type.toLowerCase().includes(APP_STRINGS.SUBSTRING_STORY_POINT)
          ? APP_STRINGS.STORY_POINTS
          : APP_STRINGS.HOURS;
      }

      if (selectedValue?.value?.toLowerCase() === APP_STRINGS.API_SPRINT) {
        const sprintsForProject = jiraData?.sprintList?.filter(
          (sprint) => sprint.projectId === selectedProject.id,
        );

        const matchedSprint = sprintsForProject?.find((s) => s._id === selectedSprint?.id);
        const metrics = matchedSprint?.committedVsCompletedMetrics;

        if (metrics) {
          const storyPointFields = [
            'initialStoryPoints',
            'spilloverStoryPoints',
            'committedStoryPoints',
            'storyPointsAddedInBeginning',
            'storyPointsAddedAfterStart',
            'removedStoryPoints',
            'completedStoryPoints',
            'remainingStoryPoints',
          ];

          const hourFields = [
            'initialHours',
            'spilloverHours',
            'committedHours',
            'hoursAddedInBeginning',
            'hoursAddedAfterStart',
            'removedHours',
            'completedHours',
            'remainingHours',
          ];

          const hasStoryPointData = storyPointFields.some((field) => Number(metrics?.[field]) > 0);
          const hasHourData = hourFields.some((field) => Number(metrics?.[field]) > 0);

          if (hasStoryPointData) {
            selectedEstimationType = APP_STRINGS.STORY_POINTS;
          } else if (hasHourData) {
            selectedEstimationType = APP_STRINGS.HOURS;
          }
        }
      }

      setToggleType(selectedEstimationType || APP_STRINGS.STORY_POINTS);
    }
  }, [selectedProject.id, getAllProjectList, selectedValue?.value, jiraData, selectedSprint?.id]);

  const data = [
    {
      color: '#E1BEE7',
      label: `Initial committed ${toggleType}`,
      value: getMetricValue({
        selectedValue,
        toggleType,
        selectedSprintData: selectedSprintData,
        selectedReleaseData: selectedReleaseData,
        metricType: 'initial',
      }),
    },
    {
      color: '#cc8080',
      label: `Initial Spillover ${toggleType}`,
      value: getMetricValue({
        selectedValue,
        toggleType,
        selectedSprintData: selectedSprintData,
        selectedReleaseData: selectedReleaseData,
        metricType: 'spillover',
      }),
    },
    {
      color: '#28c76f',
      label: `Initial ${toggleType} Added During ${selectedValue?.value?.toLowerCase() === APP_STRINGS.API_RELEASE ? releaseLabel : sprintLabel}`,
      value: getMetricValue({
        selectedValue,
        toggleType,
        selectedSprintData: selectedSprintData,
        selectedReleaseData: selectedReleaseData,
        metricType:
          toggleType === APP_STRINGS.STORY_POINTS ? 'storyPointsAddedInBeginning' : 'hoursAddedInBeginning',
      }),
    },
    {
      color: '#7367f0',
      label: `Committed ${toggleType} as of Today`,
      value: getMetricValue({
        selectedValue,
        toggleType,
        selectedSprintData: selectedSprintData,
        selectedReleaseData: selectedReleaseData,
        metricType: 'committed',
      }),
    },
    {
      color: '#EFEBE9',
      label: `${toggleType} Added After ${selectedValue?.value?.toLowerCase() === APP_STRINGS.API_RELEASE ? releaseLabel : sprintLabel} Start`,
      value: getMetricValue({
        selectedValue,
        toggleType,
        selectedSprintData: selectedSprintData,
        selectedReleaseData: selectedReleaseData,
        metricType:
          toggleType === APP_STRINGS.STORY_POINTS ? 'storyPointsAddedAfterStart' : 'hoursAddedAfterStart',
      }),
    },
    {
      color: '#cc3131',
      label: `Removed ${toggleType}`,
      value: getMetricValue({
        selectedValue,
        toggleType,
        selectedSprintData: selectedSprintData,
        selectedReleaseData: selectedReleaseData,
        metricType: 'removed',
      }),
    },
    {
      color: '#ffff00B3',
      label: `Completed ${toggleType}`,
      value: getMetricValue({
        selectedValue,
        toggleType,
        selectedSprintData: selectedSprintData,
        selectedReleaseData: selectedReleaseData,
        metricType: 'completed',
      }),
    },
    {
      color: '#FFF9C4',
      label: `Remaining ${toggleType}`,
      value: getMetricValue({
        selectedValue,
        toggleType,
        selectedSprintData: selectedSprintData,
        selectedReleaseData: selectedReleaseData,
        metricType: 'remaining',
      }),
    },
  ];

  const currentDate = new Date();
  const parseDate = (dateString) => {
    if (!dateString) return null;
    if (dateString instanceof Date) return dateString;
    const [day, month, year] = dateString.split('/');
    return new Date(year, month - 1, day);
  };

  const getRemainingDays = () => {
    const endDate =
      selectedValue.value === APP_STRINGS.VALUE_RELEASE
        ? parseDate(selectedReleaseDate.releaseDate)
        : parseDate(selectedSprintEndDate.endDate);

    if (!endDate || isNaN(endDate.getTime())) {
      console.warn(
        'Invalid end date:',
        selectedValue.value === APP_STRINGS.VALUE_RELEASE
          ? selectedReleaseDate.releaseDate
          : selectedSprintEndDate.endDate,
      );
      return 0;
    }

    const timeDiff = endDate.getTime() - currentDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    return Math.max(0, daysDiff);
  };

  const remainingDays = getRemainingDays();

  const [selectedCommitted, setSelectedCommitted] = useState({
    label: 'Committed vs Completed',
    value: 'committed_vs_completed',
  });

  const handleCommittedSelect = (value) => {
    setSelectedCommitted(value);
  };

  const committedOptions = [
    {
      label: 'Committed vs Completed',
      value: 'committed_vs_completed',
    },
    {
      label: `Blocked ${toggleType} Trend Over Multiple ${selectedValueDisplay}`,
      value: 'blocked_stories_trend',
    },
    {
      label: `${toggleType} Committed VS Completed Trend`,
      value: 'story_points_trend',
    },
    {
      label: 'Committed VS Completed Gap Analysis',
      value: 'gap_analysis',
    },
    {
      label: 'Committed & Velocity Details',
      value: 'velocity_details',
    },
  ];

  const InfoTooltip = ({
    content,
    tooltipId,
    theme = 'dark',
    placement = 'bottom',
    offset = '15',
  }) => {
    const tooltipStyle = {
      backgroundColor: theme === 'dark' ? '#173A5A' : '#0D1621',
      borderStyle: 'solid',
      borderWidth: '1px',
      borderColor: '#224F78',
      color: 'white',
      zIndex: 9999,
      padding: '8px',
      borderRadius: '5px',
      maxWidth: '500px',
      whiteSpace: 'normal',
      position: 'absolute',
    };

    return (
      <>
        <span
          data-tooltip-id={tooltipId}
          data-tooltip-html={ReactDOMServer.renderToStaticMarkup(content)}
          data-tooltip-place={placement}
          data-tooltip-offset={offset}
          className="cursor-pointer"
        >
          <InformationCircleIcon className="h-5 w-5 text-gray-500" />
        </span>
        <ReactTooltip
          id={tooltipId}
          effect="solid"
          offset={1}
          float={false}
          allowHTML={true}
          arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
          wrapper="div"
          opacity={1}
          style={tooltipStyle}
        />
      </>
    );
  };

  InfoTooltip.propTypes = {
    content: PropTypes.node.isRequired,
    tooltipId: PropTypes.string.isRequired,
    theme: PropTypes.oneOf(['dark', 'light']),
    placement: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
    offset: PropTypes.string,
  };

  return (
    <>
      {layout === 'grid' ? (
        <div
          className="relative flex-shrink-0 hover:cursor-pointer bg-white dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-4 border border-[#D1E2F0] dark:border-[#25384F] h-80 hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md"
          style={{
            borderBottom: `solid 0.4vh ${getChangeColorForWidget(itemDetails.name, average)}`,
          }}
        >
          <div className="grid grid-cols-[36%_57%] gap-10">
            <div className="flex flex-col">
              <div className="flex flex-col gap-3 py-2">
                <div className="flex gap-2">
                  <h2 className={`text-lg font-semibold ${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                    {itemDetails.name}
                  </h2>
                  <div className="item-center">
                    <span
                      data-tooltip-id={`tooltip-${itemDetails.name}`}
                      data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                      data-tooltip-offset="15"
                      className="cursor-pointer"
                    >
                      <InformationCircleIcon className={`h-5 w-5 ${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'text-gray-500'}`} />
                    </span>
                    <ReactTooltip
                      id={`tooltip-${itemDetails.name}`}
                      effect="solid"
                      offset={1}
                      float={false}
                      allowHTML={true}
                      arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                      wrapper="div"
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
                <div className="w-auto">
                  <div className="flex items-center">
                    <div>
                      <span
                        data-tooltip-id={`tooltip-committed-${itemDetails.name}`}
                        data-tooltip-html={committed.toLocaleString()}
                        data-tooltip-offset="15"
                        className={`${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#0072BB]' : 'text-blue-400'} text-xl font-semibold cursor-pointer`}
                      >
                        {formatNumberWithSuffix(committed).formatted}
                      </span>
                      <ReactTooltip
                        id={`tooltip-committed-${itemDetails.name}`}
                        effect="solid"
                        offset={1}
                        float={false}
                        allowHTML={true}
                        arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                        wrapper="div"
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
                      <span className={`text-lg px-2 ${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'text-gray-100'}`}>vs</span>
                      <span
                        data-tooltip-id={`tooltip-completed-${itemDetails.name}`}
                        data-tooltip-html={completed.toLocaleString()}
                        data-tooltip-offset="15"
                        className={`${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#0072BB]' : 'text-blue-400'} text-xl font-semibold cursor-pointer`}
                      >
                        {formatNumberWithSuffix(completed).formatted}
                      </span>
                      <ReactTooltip
                        id={`tooltip-completed-${itemDetails.name}`}
                        effect="solid"
                        offset={1}
                        float={false}
                        allowHTML={true}
                        arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                        wrapper="div"
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
              </div>

              <div
                className="space-y-2 text-sm border-t dark:border-[#25384F] pt-6 mt-2"
                style={{ borderColor: theme === APP_STRINGS.THEME_LIGHT ? '#D1E2F0' : undefined }}
              >
                <div
                  className={`flex justify-between ${
                    theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'dark:text-gray-400'
                  }`}
                >
                  <span>{selectedValue?.value?.toLowerCase() === APP_STRINGS.API_RELEASE ? releaseLabel : sprintLabel} End Date</span>
                  <span className="flex justify-end w-20">
                    <span className={`${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'dark:text-gray-300'} text-left w-full`}>
                      {selectedSprintEndDate?.endDate || '23/05/2025'}
                    </span>
                  </span>
                </div>
                <div className={`flex justify-between ${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'dark:text-gray-400'}`}>
                  <span>Days To Release</span>
                  <span className="flex justify-end w-20">
                    <span className={`${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'dark:text-gray-300'}`}></span>
                    <span
                      className="text-left w-full"
                      style={{ color: getChangeColorForCountDown(remainingDays) }}
                    >
                      {remainingDays} Days
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-base">
              <div className="flex flex-col gap-2 justify-between">
                <div className="flex justify-between">
                  <div className={`bg-transparent dark:bg-[#242B34] border rounded-full p-0.5 flex justify-between ${theme === APP_STRINGS.THEME_LIGHT ? 'border-[#A6C3DC]' : 'border-[#101010]'}`}>
                    <button
                      onClick={() => setToggleType(APP_STRINGS.STORY_POINTS)}
                      className={`py-1 px-2 rounded-full text-xs font-semibold transition-all ${
                        toggleType === APP_STRINGS.STORY_POINTS
                          ? (theme === APP_STRINGS.THEME_LIGHT ? 'bg-[#24527A] text-white' : 'bg-[#066FD1] text-white')
                          : (theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'text-gray-400 hover:text-gray-300')
                      }`}
                    >
                      Story Points
                    </button>

                    <button
                      onClick={() => setToggleType('Tickets')}
                      className={`py-1 px-2 rounded-full text-xs font-semibold transition-all ${
                        toggleType === 'Tickets'
                          ? (theme === APP_STRINGS.THEME_LIGHT ? 'bg-[#24527A] text-white' : 'bg-[#066FD1] text-white')
                          : (theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'text-gray-400 hover:text-gray-300')
                      }`}
                    >
                      Tickets
                    </button>

                    <button
                      onClick={() => setToggleType(APP_STRINGS.HOURS)}
                      className={`py-1 px-2 rounded-full text-xs font-semibold transition-all ${
                        toggleType === APP_STRINGS.HOURS
                          ? (theme === APP_STRINGS.THEME_LIGHT ? 'bg-[#24527A] text-white' : 'bg-[#066FD1] text-white')
                          : (theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'text-gray-400 hover:text-gray-300')
                      }`}
                    >
                      Hours
                    </button>
                  </div>
                  {selectedCommitted.value === 'blocked_stories_trend' && (
                    <div className="flex items-end">
                      <div className="flex w-auto">
                        <div className={`bg-transparent dark:bg-[#242B34] border rounded-full p-0.5 flex ml-auto ${theme === APP_STRINGS.THEME_LIGHT ? 'border-[#A6C3DC]' : 'border-[#101010]'}`}>
                          <button
                            onClick={() => setToggleBlocked('Blocked')}
                            className={`py-1 px-2 rounded-full text-sm font-semibold transition-all ${
                              toggleBlocked === 'Blocked'
                                ? (theme === APP_STRINGS.THEME_LIGHT ? 'bg-[#24527A] text-white' : 'bg-[#066FD1] text-white')
                                : (theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'text-gray-400 hover:text-gray-300')
                            }`}
                          >
                            Blocked
                          </button>
                          <button
                            onClick={() => setToggleBlocked('Deviation')}
                            className={`py-1 px-2 rounded-full text-sm font-semibold transition-all ${
                              toggleBlocked === 'Deviation'
                                ? (theme === APP_STRINGS.THEME_LIGHT ? 'bg-[#24527A] text-white' : 'bg-[#066FD1] text-white')
                                : (theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'text-gray-400 hover:text-gray-300')
                            }`}
                          >
                            Deviation
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedCommitted.value === 'story_points_trend' && (
                    <div className="flex items-end">
                      <div className="flex w-auto">
                        <div className={`bg-transparent dark:bg-[#242B34] border rounded-full p-0.5 flex ml-auto ${theme === APP_STRINGS.THEME_LIGHT ? 'border-[#A6C3DC]' : 'border-[#101010]'}`}>
                          <button
                            onClick={() => setToggleSprintTeam(selectedValue?.value?.toLowerCase() === APP_STRINGS.API_RELEASE ? releaseLabel : sprintLabel)}
                            className={`py-1 px-2 rounded-full text-sm font-semibold transition-all ${
                              toggleSprintTeam === (selectedValue?.value?.toLowerCase() === APP_STRINGS.API_RELEASE ? releaseLabel : sprintLabel)
                                ? theme === APP_STRINGS.THEME_LIGHT
                                  ? 'bg-[#24527A] text-white'
                                  : 'bg-[#066FD1] text-white'
                                : theme === APP_STRINGS.THEME_LIGHT
                                ? 'text-[#24527A]'
                                : 'text-gray-400 hover:text-gray-300'
                            }`}
                          >
                            {selectedValue?.value?.toLowerCase() === APP_STRINGS.API_RELEASE ? releaseLabel : sprintLabel}
                          </button>
                          <button
                            onClick={() => setToggleSprintTeam('Team Member')}
                            className={`py-1 px-2 rounded-full text-sm font-semibold transition-all ${
                              toggleSprintTeam === 'Team Member'
                                ? (theme === APP_STRINGS.THEME_LIGHT ? 'bg-[#24527A] text-white' : 'bg-[#066FD1] text-white')
                                : (theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'text-gray-400 hover:text-gray-300')
                            }`}
                          >
                            Team Member
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex w-auto">
                  <DropdownButton
                    buttonLabel="Committed vs Completed"
                    options={committedOptions}
                    onSelect={handleCommittedSelect}
                    value={selectedCommitted}
                    placeholder="Committed vs Completed"
                    type="committedAndCompleted"
                    width="w-full"
                  />
                </div>
              </div>
              {selectedCommitted.value === 'committed_vs_completed' ? (
                <div className="flex flex-col gap-0.5 py-auto">
                  {toggleType === 'Tickets' ? (
                    ' '
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className={`${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>Completion Progress</span>
                        <span className={`${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'dark:text-gray-300'} text-sm flex justify-end w-16`}>
                          <span className="text-left w-full">{average}%</span>
                        </span>
                      </div>
                      {data.map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className={`${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>{item.label}</span>
                          <span className={`${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#0072BB]' : 'dark:text-gray-300'} text-sm flex justify-end w-16 font-semibold`}>
                            <Tooltip 
                              content={(item.value > 0 ? item.value : 0).toLocaleString()}
                              position="top"
                            >
                              <span className="text-left w-full">
                                {item.value > 0 ? formatNumberWithSuffix(item.value).formatted : '0'}
                              </span>
                            </Tooltip>
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ) : selectedCommitted.value === 'blocked_stories_trend' ? (
                <div>
                  {toggleType === APP_STRINGS.STORY_POINTS ? (
                    <>
                      {toggleBlocked === 'Blocked' ? (
                        <>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                              Currently Blocked {toggleType}
                              <InfoTooltip
                                content={getTooltipContent(`Currently Blocked ${toggleType}`)}
                                tooltipId={`tooltip-${itemDetails.name}-committed`}
                                theme={theme}
                              />
                            </span>
                            <Tooltip 
                              content={deviationData.blockedStoryPointsNow.toLocaleString()}
                              position="top"
                            >
                              <span className="text-[#202020] dark:text-gray-300 font-medium">
                                {formatNumberWithSuffix(deviationData.blockedStoryPointsNow).formatted}
                              </span>
                            </Tooltip>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                              Total Blocked {toggleType}
                              <InfoTooltip
                                content={getTooltipContent(`Total Blocked ${toggleType}`)}
                                tooltipId={`tooltip-${itemDetails.name}-committed`}
                                theme={theme}
                              />
                            </span>
                            <Tooltip 
                              content={deviationData.blockedStoryPoints.toLocaleString()}
                              position="top"
                            >
                              <span className="text-[#202020] dark:text-gray-300 font-medium">
                                {formatNumberWithSuffix(deviationData.blockedStoryPoints).formatted}
                              </span>
                            </Tooltip>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                              Average Duration Of Blocked {toggleType}
                              <InfoTooltip
                                content={getTooltipContent(
                                  `Average Duration Of Blocked ${toggleType}`,
                                )}
                                tooltipId={`tooltip-${itemDetails.name}-committed`}
                                theme={theme}
                              />
                            </span>
                            <Tooltip 
                              content={`${deviationData.blockedDurationHours.toLocaleString()} hours`}
                              position="top"
                            >
                              <span className="text-[#202020] dark:text-gray-300 font-medium">
                                {formatNumberWithSuffix(deviationData.blockedDurationHours).formatted} hrs
                              </span>
                            </Tooltip>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-[#626262] dark:text-gray-400 flex gap-1">
                              Average Blocked {toggleType} Multiple {selectedValue?.value?.toLowerCase() === APP_STRINGS.API_RELEASE ? releaseLabel : sprintLabel} Trend
                              <InfoTooltip
                                content={getTooltipContent(
                                  `Average Blocked ${toggleType} Multiple ${selectedValue?.value?.toLowerCase() === APP_STRINGS.API_RELEASE ? releaseLabel : sprintLabel} Trend`,
                                )}
                                tooltipId={`tooltip-${itemDetails.name}-committed`}
                                theme={theme}
                              />
                            </span>
                            <Tooltip 
                              content={`${(deviationData.blockedTrend?.length || 0).toLocaleString()} items`}
                              position="top"
                            >
                              <span className="text-[#202020] dark:text-gray-300 font-medium">
                                {formatNumberWithSuffix(deviationData.blockedTrend?.length || 0).formatted}
                              </span>
                            </Tooltip>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                              Deviation Between C & C {toggleType}
                              <InfoTooltip
                                content={getTooltipContent(`Deviation Between C & C ${toggleType}`)}
                                tooltipId={`tooltip-${itemDetails.name}-committed`}
                                theme={theme}
                              />
                            </span>
                            <Tooltip 
                              content={`${deviationData.currentDeviation > 0 ? '+' : ''}${deviationData.currentDeviation.toLocaleString()}`}
                              position="top"
                            >
                              <span className="text-[#202020] dark:text-gray-300 font-medium">
                                {deviationData.currentDeviation > 0 ? '+' : ''}
                                {formatNumberWithSuffix(deviationData.currentDeviation).formatted}
                              </span>
                            </Tooltip>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                              Average Deviation Trend Over multiple{' '}
                              {selectedValue?.value?.toLowerCase() === APP_STRINGS.API_RELEASE ? releaseLabel : sprintLabel}
                              <InfoTooltip
                                content={getTooltipContent(
                                  `Average Deviation Trend Over multiple ${
                                    selectedValue?.value?.toLowerCase() === APP_STRINGS.API_RELEASE ? releaseLabel : sprintLabel
                                  }`,
                                )}
                                tooltipId={`tooltip-${itemDetails.name}-committed`}
                                theme={theme}
                              />
                            </span>
                            <Tooltip 
                              content={deviationData.deviationValues?.length > 0
                                ? (
                                    deviationData.deviationValues.reduce(
                                      (sum, val) => sum + val,
                                      0,
                                    ) / deviationData.deviationValues.length
                                  ).toLocaleString()
                                : '0'}
                              position="top"
                            >
                              <span className="text-[#202020] dark:text-gray-300 font-medium">
                                {deviationData.deviationValues?.length > 0
                                  ? formatNumberWithSuffix(
                                      deviationData.deviationValues.reduce(
                                        (sum, val) => sum + val,
                                        0,
                                      ) / deviationData.deviationValues.length
                                    ).formatted
                                  : '0'}
                              </span>
                            </Tooltip>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    ' '
                  )}
                </div>
              ) : selectedCommitted.value === 'story_points_trend' ? (
                <div>
                  {toggleType === APP_STRINGS.STORY_POINTS ? (
                    <>
                      {toggleSprintTeam === (selectedValue?.value?.toLowerCase() === APP_STRINGS.API_RELEASE ? releaseLabel : sprintLabel) ? (
                        <>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                              Average Of Total {toggleType} Committed
                              <InfoTooltip
                                content={getTooltipContent(
                                  `Average Of Total ${toggleType} Committed`,
                                )}
                                tooltipId={`tooltip-${itemDetails.name}-committed`}
                                theme={theme}
                              />
                            </span>
                            <Tooltip 
                              content={averageData.avgCommitted.toLocaleString()}
                              position="top"
                            >
                              <span className="text-[#202020] dark:text-gray-300 font-medium">
                                {formatNumberWithSuffix(averageData.avgCommitted).formatted}
                              </span>
                            </Tooltip>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                              Average Of Total {toggleType} Completed
                              <InfoTooltip
                                content={getTooltipContent(
                                  `Average Of Total ${toggleType} Completed`,
                                )}
                                tooltipId={`tooltip-${itemDetails.name}-committed`}
                                theme={theme}
                              />
                            </span>
                            <Tooltip 
                              content={averageData.avgCompleted.toLocaleString()}
                              position="top"
                            >
                              <span className="text-[#202020] dark:text-gray-300 font-medium">
                                {formatNumberWithSuffix(averageData.avgCompleted).formatted}
                              </span>
                            </Tooltip>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                              Average Of Total {toggleType} Committed
                              <InfoTooltip
                                content={getTooltipContent(
                                  `Average Of Total ${toggleType} Committed`,
                                )}
                                tooltipId={`tooltip-${itemDetails.name}-committed`}
                                theme={theme}
                              />
                            </span>
                            <Tooltip 
                              content={averageData.avgTeamMemberCommitted.toLocaleString()}
                              position="top"
                            >
                              <span className="text-[#202020] dark:text-gray-300 font-medium">
                                {formatNumberWithSuffix(averageData.avgTeamMemberCommitted).formatted}
                              </span>
                            </Tooltip>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                              Average Of Total {toggleType} Completed
                              <InfoTooltip
                                content={getTooltipContent(
                                  `Average Of Total ${toggleType} Completed`,
                                )}
                                tooltipId={`tooltip-${itemDetails.name}-committed`}
                                theme={theme}
                              />
                            </span>
                            <Tooltip 
                              content={averageData.avgTeamMemberCompleted.toLocaleString()}
                              position="top"
                            >
                              <span className="text-[#202020] dark:text-gray-300 font-medium">
                                {formatNumberWithSuffix(averageData.avgTeamMemberCompleted).formatted}
                              </span>
                            </Tooltip>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    ' '
                  )}
                </div>
              ) : selectedCommitted.value === 'gap_analysis' ? (
                <div>
                  {toggleType === APP_STRINGS.STORY_POINTS ? (
                    <>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                          Average Committed
                          <InfoTooltip
                            content={getTooltipContent(`Average Committed`)}
                            tooltipId={`tooltip-${itemDetails.name}-committed`}
                            theme={theme}
                          />
                        </span>
                        <Tooltip 
                          content={averageData.avgFinallyCommitted.toLocaleString()}
                          position="top"
                        >
                          <span className="text-[#202020] dark:text-gray-300 font-medium">
                            {formatNumberWithSuffix(averageData.avgFinallyCommitted).formatted}
                          </span>
                        </Tooltip>
                      </div>

                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                          Average Completed
                          <InfoTooltip
                            content={getTooltipContent(`Average Completed`)}
                            tooltipId={`tooltip-${itemDetails.name}-committed`}
                            theme={theme}
                          />
                        </span>
                        <Tooltip 
                          content={averageData.avgDone.toLocaleString()}
                          position="top"
                        >
                          <span className="text-[#202020] dark:text-gray-300 font-medium">
                            {formatNumberWithSuffix(averageData.avgDone).formatted}
                          </span>
                        </Tooltip>
                      </div>

                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                          Average Gap
                          <InfoTooltip
                            content={getTooltipContent('Average Gap')}
                            tooltipId={`tooltip-${itemDetails.name}-committed`}
                            theme={theme}
                          />
                        </span>
                        <Tooltip 
                          content={(averageData.avgFinallyCommitted - averageData.avgDone).toLocaleString()}
                          position="top"
                        >
                          <span className="text-[#202020] dark:text-gray-300 font-medium">
                            {formatNumberWithSuffix(averageData.avgFinallyCommitted - averageData.avgDone).formatted}
                          </span>
                        </Tooltip>
                      </div>
                    </>
                  ) : (
                    ' '
                  )}
                </div>
              ) : selectedCommitted.value === 'velocity_details' ? (
                <div>
                  {toggleType === APP_STRINGS.STORY_POINTS ? (
                    <>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                          Average Initially Committed
                          <InfoTooltip
                            content={getTooltipContent('Average Initially Committed')}
                            tooltipId={`tooltip-${itemDetails.name}-initially-committed`}
                            theme={theme}
                          />
                        </span>
                        <Tooltip 
                          content={averageData.avgInitiallyCommitted.toLocaleString()}
                          position="top"
                        >
                          <span className="text-[#202020] dark:text-gray-300 font-medium">
                            {formatNumberWithSuffix(averageData.avgInitiallyCommitted).formatted}
                          </span>
                        </Tooltip>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                          Average Finally Committed
                          <InfoTooltip
                            content={getTooltipContent('Average Finally Committed')}
                            tooltipId={`tooltip-${itemDetails.name}-finally-committed`}
                            theme={theme}
                          />
                        </span>
                        <Tooltip 
                          content={averageData.avgFinallyCommitted.toLocaleString()}
                          position="top"
                        >
                          <span className="text-[#202020] dark:text-gray-300 font-medium">
                            {formatNumberWithSuffix(averageData.avgFinallyCommitted).formatted}
                          </span>
                        </Tooltip>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                          Average Done
                          <InfoTooltip
                            content={getTooltipContent('Average Done')}
                            tooltipId={`tooltip-${itemDetails.name}-done`}
                            theme={theme}
                          />
                        </span>
                        <Tooltip 
                          content={averageData.avgDone.toLocaleString()}
                          position="top"
                        >
                          <span className="text-[#202020] dark:text-gray-300 font-medium">
                            {formatNumberWithSuffix(averageData.avgDone).formatted}
                          </span>
                        </Tooltip>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400 flex gap-2">
                          Average Velocity
                          <InfoTooltip
                            content={getTooltipContent('Average Velocity')}
                            tooltipId={`tooltip-${itemDetails.name}-velocity`}
                            theme={theme}
                          />
                        </span>
                        <Tooltip 
                          content={averageData.avgVelocity.toLocaleString()}
                          position="top"
                        >
                          <span className="text-[#202020] dark:text-gray-300 font-medium">
                            {formatNumberWithSuffix(averageData.avgVelocity).formatted}
                          </span>
                        </Tooltip>
                      </div>
                    </>
                  ) : (
                    ' '
                  )}
                </div>
              ) : (
                ' '
              )}
            </div>
          </div>
        </div>
      ) : (
        <div 
          className="relative flex-shrink-0 hover:cursor-pointer bg-white dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-4 border border-[#D1E2F0] dark:border-[#25384F] hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md"
          style={{
            borderBottom: `solid 0.4vh ${getChangeColorForWidget(itemDetails.name, average)}`,
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className={`text-lg font-semibold ${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#0A2342]' : 'dark:text-gray-300'}`}>
                {itemDetails.name}
              </h2>
              <div className="item-center">
                <span
                  data-tooltip-id={`tooltip-${itemDetails.name}`}
                  data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                  data-tooltip-offset="15"
                  className="cursor-pointer"
                >
                  <InformationCircleIcon className={`h-6 w-6 ${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'text-gray-500'}`} />
                </span>
                <ReactTooltip
                  id={`tooltip-${itemDetails.name}`}
                  effect="solid"
                  offset={1}
                  float={false}
                  allowHTML={true}
                  arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                  wrapper="div"
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
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span
                  data-tooltip-id={`tooltip-committed-list-${itemDetails.name}`}
                  data-tooltip-html={committed.toLocaleString()}
                  data-tooltip-offset="15"
                  className={`${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#0072BB]' : 'text-blue-400'} text-xl font-semibold cursor-pointer`}
                >
                  {formatNumberWithSuffix(committed).formatted}
                </span>
                <ReactTooltip
                  id={`tooltip-committed-list-${itemDetails.name}`}
                  effect="solid"
                  offset={1}
                  float={false}
                  allowHTML={true}
                  arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                  wrapper="div"
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
                <span className={`text-lg px-2 ${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'text-gray-100'}`}>vs</span>
                <span
                  data-tooltip-id={`tooltip-completed-list-${itemDetails.name}`}
                  data-tooltip-html={completed.toLocaleString()}
                  data-tooltip-offset="15"
                  className={`${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#0072BB]' : 'text-blue-400'} text-xl font-semibold cursor-pointer`}
                >
                  {formatNumberWithSuffix(completed).formatted}
                </span>
                <ReactTooltip
                  id={`tooltip-completed-list-${itemDetails.name}`}
                  effect="solid"
                  offset={1}
                  float={false}
                  allowHTML={true}
                  arrowColor={theme === 'dark' ? '#173A5A' : '#0D1621'}
                  wrapper="div"
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
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>

            <div className="flex justify-between">
              <span className={`${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'text-gray-400'} text-sm`}>Completion Progress</span>
              <span className={`${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'dark:text-gray-300'} text-sm flex justify-end w-16`}>
                <span className="text-left w-full">{average}%</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

Dashboard.propTypes = {
  layout: PropTypes.string.isRequired,
  itemDetails: PropTypes.object.isRequired,
};

export default Dashboard;
