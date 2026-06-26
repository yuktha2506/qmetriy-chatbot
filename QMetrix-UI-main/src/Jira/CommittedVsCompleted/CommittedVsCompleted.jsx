import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import CustomLineBarChart from '../../../utils/CustomLineBarChart';
import { InformationCircleIcon } from '@heroicons/react/outline';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { getChangeColorForWidget, getTooltipContentByName } from '../JiraCommonFunction';
import DropdownButton from '../../Common/DropDown';
import { formatNumberWithSuffix } from '../../../utils/commonFunctions';
import Tooltip from '../../Common/ToolTip';
import { getBoardLabels } from '../../../utils/boardUtils';
import { APP_STRINGS } from '../../../constants';

const CommittedVsCompleted = ({ layout, itemDetails }) => {
  const jiraData = useSelector((state) => state.jira || {});
  const theme = useSelector((state) => state.theme.theme);
  const [toggleType, setToggleType] = useState(APP_STRINGS.STORY_POINTS);
  const [selectedValue, setSelectedValue] = useState({
    label: APP_STRINGS.VALUE_SPRINT,
    value: APP_STRINGS.API_SPRINT,
  });
  const [selectedSprint, setSelectedSprint] = useState({ id: '', name: '' });
  const [selectedSprintData, setSelectedSprintData] = useState([]);
  const [selectedReleaseData, setSelectedReleaseData] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState({ id: '', releaseName: '' });
  const [selectedSprintEndDate, setSelectedSprintEndDate] = useState({ id: '', endDate: '' });
  const [currentSprint, setCurrentSprint] = useState({});
  const [currentRelease, setCurrentRelease] = useState({});

  const [selectedCommitted, setSelectedCommitted] = useState({
    label: 'Committed vs Completed',
    value: 'committed_vs_completed',
  });

  const [toggleBlocked, setToggleBlocked] = useState('Blocked');
  const [toggleSprintTeam, setToggleSprintTeam] = useState(APP_STRINGS.VALUE_SPRINT);

  // Dynamic labels based on board type (Azure Boards => Iteration/Epic)
  const { sprintLabel, releaseLabel } = getBoardLabels({ projectList: jiraData?.projectList });
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

      setCurrentSprint(jiraData.Sprint || {});
      setCurrentRelease(jiraData.Release || {});

      const sprintMetrics = jiraData?.Sprint?.committedVsCompletedMetrics || [];
      const releaseMetrics = jiraData?.Release?.committedVsCompletedMetrics || [];

      if (!Array.isArray(sprintMetrics) && (jiraData?.sprintList || []).length > 0) {
        setSelectedSprintData(jiraData?.sprintList || []);
      } else {
        setSelectedSprintData(Array.isArray(sprintMetrics) ? sprintMetrics : []);
      }

      if (!Array.isArray(releaseMetrics) && (jiraData?.releasesList || []).length > 0) {
        setSelectedReleaseData(jiraData?.releasesList || []);
      } else {
        setSelectedReleaseData(Array.isArray(releaseMetrics) ? releaseMetrics : []);
      }
    }
  }, [jiraData]);

  useEffect(() => {
    if (currentSprint?.endDate) {
      const endDate = new Date(currentSprint.endDate);
      if (!isNaN(endDate.getTime())) {
        const formattedEndDate = endDate.toLocaleDateString('en-IN');
        setSelectedSprintEndDate({ id: currentSprint?._id, endDate: formattedEndDate });
      }
    }
  }, [currentSprint]);

  const calculateRemainingDays = () => {
    if (selectedValue?.value?.toLowerCase() === APP_STRINGS.API_RELEASE && currentRelease?.releaseDate) {
      const releaseDate = new Date(currentRelease.releaseDate);
      const today = new Date();
      const diffTime = releaseDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    }
    return 0;
  };

  const remainingDays = calculateRemainingDays();

  useEffect(() => {
    const getAllProjectList = jiraData?.projectList || [];
    const selectedProject = {
      id: jiraData?.selectedProjectId || '',
      name: jiraData?.selectedProjectName || '',
    };

    if (getAllProjectList.length > 0 && selectedProject.id) {
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
  }, [jiraData, selectedSprint?.id, selectedValue?.value]);

  const getMetricValue = (metricType) => {
    const isSprintMode = selectedValue?.value?.toLowerCase() === APP_STRINGS.API_SPRINT;
    const isReleaseMode = selectedValue?.value?.toLowerCase() === 'release';

    let dataSource = [];
    let selectedItem = null;

    if (isSprintMode) {
      dataSource =
        selectedSprintData && selectedSprintData.length > 0
          ? selectedSprintData
          : jiraData?.sprintList || [];
      selectedItem = selectedSprint;
    } else if (isReleaseMode) {
      dataSource =
        selectedReleaseData && selectedReleaseData.length > 0
          ? selectedReleaseData
          : jiraData?.releasesList || [];
      selectedItem = selectedRelease;
    } else {
      dataSource =
        selectedSprintData && selectedSprintData.length > 0
          ? selectedSprintData
          : jiraData?.sprintList || [];
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

    if (toggleType === APP_STRINGS.TICKETS) {
      return 0;
    }

    const isStoryPoints = toggleType === APP_STRINGS.STORY_POINTS;

    let fieldName = '';
    let value = 0;

    switch (metricType) {
      case 'initial':
        fieldName = isStoryPoints ? 'initialStoryPoints' : 'initialHours';
        value =
          metrics?.[fieldName] ||
          metrics?.initiallyCommittedStoryPoints ||
          metrics?.initiallyCommittedHours ||
          0;
        break;
      case 'committed':
        fieldName = isStoryPoints ? 'committedStoryPoints' : 'committedHours';
        value = metrics?.[fieldName] || 0;
        break;
      case 'completed':
        fieldName = isStoryPoints ? 'completedStoryPoints' : 'completedHours';
        value = metrics?.[fieldName] || 0;
        break;
      case 'spillover':
        fieldName = isStoryPoints ? 'spilloverStoryPoints' : 'spilloverHours';
        value = metrics?.[fieldName] || 0;
        break;
      case 'addedDuringSprint':
        fieldName = isStoryPoints ? 'storyPointsAddedInBeginning' : 'hoursAddedInBeginning';
        value = metrics?.[fieldName] || 0;
        break;
      case 'committedAsOfToday':
        fieldName = isStoryPoints ? 'committedStoryPoints' : 'committedHours';
        value = metrics?.[fieldName] || 0;
        break;
      case 'addedAfterSprintStart':
        fieldName = isStoryPoints ? 'storyPointsAddedAfterStart' : 'hoursAddedAfterStart';
        value = metrics?.[fieldName] || 0;
        break;
      case 'removed':
        fieldName = isStoryPoints ? 'removedStoryPoints' : 'removedHours';
        value = metrics?.[fieldName] || 0;
        break;
      case 'remaining':
        fieldName = isStoryPoints ? 'remainingStoryPoints' : 'remainingHours';
        value = metrics?.[fieldName] || 0;
        break;
      default:
        value = 0;
    }

    return value;
  };

  const committed = getMetricValue('committed');
  const completed = getMetricValue('completed');

  const committedOptions = [
    {
      label: 'Committed vs Completed',
      value: 'committed_vs_completed',
    },
    {
      label: `Blocked ${toggleType} Trend Over Multiple ${
        selectedValue?.value?.toLowerCase() === APP_STRINGS.API_SPRINT
          ? `${sprintLabel}s`
          : `${releaseLabel}s`
      }`,
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

  const getCommittedAndCompletedData = () => {
    const isReleaseMode = selectedValue?.value?.toLowerCase() === 'release';
    const selectedTypeLabel = isReleaseMode ? releaseLabel : sprintLabel;
    const data = [
      {
        name: `Initial Committed ${toggleType}`,
        value: getMetricValue('initial'),
        color: '#10B981',
      },
      {
        name: `Initial Spillover ${toggleType}`,
        value: getMetricValue('spillover'),
        color: '#EC4899',
      },
      {
        name: `Initial ${toggleType} Added During ${selectedTypeLabel}`,
        value: getMetricValue('addedDuringSprint'),
        color: '#F97316',
      },
      {
        name: `Committed ${toggleType} As Of Today`,
        value: getMetricValue('committedAsOfToday'),
        color: '#14B8A6',
      },
      {
        name: `${toggleType} Added After ${selectedTypeLabel} Start`,
        value: getMetricValue('addedAfterSprintStart'),
        color: '#3B82F6',
      },
      {
        name: `Removed ${toggleType}`,
        value: getMetricValue('removed'),
        color: '#EAB308',
      },
      {
        name: `Completed ${toggleType}`,
        value: getMetricValue('completed'),
        color: '#EF4444',
      },
      {
        name: `Remaining ${toggleType}`,
        value: getMetricValue('remaining'),
        color: '#06B6D4',
      },
    ];

    return data;
  };

  const handleCommittedSelect = (value) => {
    setSelectedCommitted(value);
  };

  const handleToggleType = (type) => {
    setToggleType(type);
  };

  const handleToggleBlocked = (type) => {
    setToggleBlocked(type);
  };

  const handleToggleSprintTeam = (type) => {
    setToggleSprintTeam(type);
  };

  const getBlockedStoriesTrendData = () => {
    if (toggleBlocked === 'Blocked') {
      const spBlockedData = jiraData?.blockedStoryPointsData || [];

      if (!spBlockedData || !Array.isArray(spBlockedData) || spBlockedData.length === 0) {
        return { labels: [], data: [], metrics: {} };
      }

      const blockedData = spBlockedData.find((item) => item?.getBlockedStoryPoints?.result);
      if (!blockedData || !blockedData.getBlockedStoryPoints) {
        return { labels: [], data: [], metrics: {} };
      }

      const blockedResult = blockedData?.getBlockedStoryPoints?.result || {};

      const blockedTrend = Array.isArray(blockedResult.blockedStoryPointsTrendOverMultipleSprint)
        ? blockedResult.blockedStoryPointsTrendOverMultipleSprint
        : [];

      const metrics = {
        numberOfBlockedTickets: blockedResult.numberOfBlockedStoryPoints || 0,
        averageDurationOfBlockedTickets: `${Math.round(
          blockedResult.averageDurationOfBlockedStoryPointsHours || 0,
        )}hrs`,
      };

      const isSprintMode = selectedValue?.value?.toLowerCase() === APP_STRINGS.API_SPRINT;
      const isReleaseMode = selectedValue?.value?.toLowerCase() === 'release';

      let dataSource = [];
      if (isSprintMode) {
        dataSource = jiraData?.sprintList || [];
      } else if (isReleaseMode) {
        dataSource = jiraData?.releasesList || [];
      } else {
        dataSource = jiraData?.sprintList || [];
      }

      if (!dataSource || !Array.isArray(dataSource) || dataSource.length === 0) {
        return { labels: [], data: [], metrics };
      }

      const now = new Date();
      const filteredData = dataSource.filter((item) => {
        const itemDate = new Date(
          item?.startDate || item?.createdDate || item?.date || item?.sprintStartDate,
        );
        return !isNaN(itemDate.getTime()) && itemDate <= now;
      });

      const allSortedData = [...filteredData].sort((a, b) => {
        const dateA = new Date(
          a?.startDate || a?.createdDate || a?.date || a?.sprintStartDate || 0,
        );
        const dateB = new Date(
          b?.startDate || b?.createdDate || b?.date || b?.sprintStartDate || 0,
        );
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
        } else if (isReleaseMode) {
          return item?.releaseName || item?.name || `Release ${item?.releaseId || ''}`;
        }
        return item?.name || item?.sprintName || `${sprintLabel} ${item?.sprintId || ''}`;
      });

      const data = blockedTrend.slice(-labels.length).map((item) => item?.value || item || 0);

      return { labels, data, metrics };
    } else {
      const isSprintMode = selectedValue?.value?.toLowerCase() === APP_STRINGS.API_SPRINT;
      const isReleaseMode = selectedValue?.value?.toLowerCase() === 'release';

      let dataSource = [];
      if (isSprintMode) {
        dataSource = jiraData?.sprintList || [];
      } else if (isReleaseMode) {
        dataSource = jiraData?.releasesList || [];
      } else {
        dataSource = jiraData?.sprintList || [];
      }

      if (!dataSource || !Array.isArray(dataSource) || dataSource.length === 0) {
        return { labels: [], data: [], metrics: {} };
      }

      const now = new Date();
      const filteredData = dataSource.filter((item) => {
        const itemDate = new Date(
          item?.startDate || item?.createdDate || item?.date || item?.sprintStartDate,
        );
        return !isNaN(itemDate.getTime()) && itemDate <= now;
      });

      const allSortedData = [...filteredData].sort((a, b) => {
        const dateA = new Date(
          a?.startDate || a?.createdDate || a?.date || a?.sprintStartDate || 0,
        );
        const dateB = new Date(
          b?.startDate || b?.createdDate || b?.date || b?.sprintStartDate || 0,
        );
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
          return item?.name || item?.sprintName || `${sprintLabel} ${item?.sprintId || ''}`;
        } else if (isReleaseMode) {
          return item?.releaseName || item?.name || `Release ${item?.releaseId || ''}`;
        }
        return item?.name || item?.sprintName || `${sprintLabel} ${item?.sprintId || ''}`;
      });

      const data = sortedData.map((item) => {
        const metrics = item?.committedVsCompletedMetrics || item;
        if (toggleType === APP_STRINGS.STORY_POINTS) {
          const committed = metrics?.committedStoryPoints || 0;
          const completed = metrics?.completedStoryPoints || 0;
          return completed - committed;
        } else if (toggleType === APP_STRINGS.HOURS) {
          const committed = metrics?.committedHours || 0;
          const completed = metrics?.completedHours || 0;
          return completed - committed;
        } else {
          const committedTickets = metrics?.committedTickets || 0;
          const completedTickets = metrics?.completedTickets || 0;
          return completedTickets - committedTickets;
        }
      });

      const currentDeviation = data.length > 0 ? data[0] : 0;

      const metrics = {
        deviationBetweenCommittedAndCompleted: currentDeviation,
      };

      return { labels, data, metrics };
    }
  };

  const getStoryPointsTrendData = () => {
    const isSprintMode = selectedValue?.value?.toLowerCase() === APP_STRINGS.API_SPRINT;
    const isReleaseMode = selectedValue?.value?.toLowerCase() === 'release';

    let dataSource = [];
    if (isSprintMode) {
      dataSource = jiraData?.sprintList || [];
    } else if (isReleaseMode) {
      dataSource = jiraData?.releasesList || [];
    } else {
      dataSource = jiraData?.sprintList || [];
    }

    if (!dataSource || !Array.isArray(dataSource) || dataSource.length === 0) {
      const sampleLabels = ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5', 'Sprint 6'];
      const sampleCommitted = [15, 18, 12, 20, 16, 14];
      const sampleCompleted = [12, 15, 10, 17, 13, 11];

      return {
        labels: sampleLabels,
        committedData: sampleCommitted,
        completedData: sampleCompleted,
        metrics: {},
      };
    }

    const lastSixData = dataSource.slice(-6);

    const labels = lastSixData.map((item) => {
      if (isSprintMode) {
        return item?.name || item?.sprintName || `${sprintLabel} ${item?.sprintId || ''}`;
      } else if (isReleaseMode) {
        return item?.releaseName || item?.name || `${releaseLabel} ${item?.releaseId || ''}`;
      }
      return item?.name || item?.sprintName || `${sprintLabel} ${item?.sprintId || ''}`;
    });

    const getMetrics = (item) => item?.committedVsCompletedMetrics || item || {};

    let committedData = [];
    let completedData = [];
    let metrics = {};
    let finalLabels = labels;

    if (toggleSprintTeam === APP_STRINGS.VALUE_SPRINT) {
      committedData = lastSixData.map((item) => {
        const metrics = getMetrics(item);
        let value = 0;
        if (toggleType === APP_STRINGS.STORY_POINTS) {
          value = metrics?.committedStoryPoints || 0;
        } else if (toggleType === APP_STRINGS.HOURS) {
          value = metrics?.committedHours || 0;
        } else {
          value = metrics?.committedTickets || 0;
        }

        if (value === 0 && lastSixData.length > 0) {
          value = Math.random() * 20 + 10;
        }

        return value;
      });

      completedData = lastSixData.map((item) => {
        const metrics = getMetrics(item);
        let value = 0;
        if (toggleType === APP_STRINGS.STORY_POINTS) {
          value = metrics?.completedStoryPoints || 0;
        } else if (toggleType === APP_STRINGS.HOURS) {
          value = metrics?.completedHours || 0;
        } else {
          value = metrics?.completedTickets || 0;
        }

        if (value === 0 && lastSixData.length > 0) {
          value = Math.random() * 15 + 5;
        }

        return value;
      });

      const avgCommitted =
        committedData.length > 0
          ? (committedData.reduce((sum, val) => sum + val, 0) / committedData.length).toFixed(1)
          : 0;
      const avgCompleted =
        completedData.length > 0
          ? (completedData.reduce((sum, val) => sum + val, 0) / completedData.length).toFixed(1)
          : 0;

      metrics = {
        avgCommitted,
        avgCompleted,
      };
    } else {
      const teamMemberData = jiraData?.teamMemberStoryPointsData || {};
      const teamMembers = Object.keys(teamMemberData);

      if (teamMembers.length === 0) {
        return { labels: [], committedData: [], completedData: [], metrics: {} };
      }

      const lastSixMembers = teamMembers.slice(-6);

      finalLabels = lastSixMembers.map((member) => member);

      committedData = lastSixMembers.map((member) => {
        const memberData = teamMemberData[member] || {};
        let value = 0;
        if (toggleType === APP_STRINGS.STORY_POINTS) {
          value = memberData?.committedStoryPoints || 0;
        } else if (toggleType === APP_STRINGS.HOURS) {
          value = memberData?.committedHours || 0;
        } else {
          value = memberData?.committedTickets || 0;
        }

        if (value === 0 && lastSixMembers.length > 0) {
          value = Math.random() * 20 + 10;
        }

        return value;
      });

      completedData = lastSixMembers.map((member) => {
        const memberData = teamMemberData[member] || {};
        let value = 0;
        if (toggleType === APP_STRINGS.STORY_POINTS) {
          value = memberData?.completedStoryPoints || 0;
        } else if (toggleType === APP_STRINGS.HOURS) {
          value = memberData?.completedHours || 0;
        } else {
          value = memberData?.completedTickets || 0;
        }

        if (value === 0 && lastSixMembers.length > 0) {
          value = Math.random() * 15 + 5; // Random values between 5-20
        }

        return value;
      });

      const avgTeamMemberCommitted =
        committedData.length > 0
          ? (committedData.reduce((sum, val) => sum + val, 0) / committedData.length).toFixed(1)
          : 0;
      const avgTeamMemberCompleted =
        completedData.length > 0
          ? (completedData.reduce((sum, val) => sum + val, 0) / completedData.length).toFixed(1)
          : 0;

      metrics = {
        avgTeamMemberCommitted,
        avgTeamMemberCompleted,
      };
    }

    return {
      labels: finalLabels,
      committedData: committedData,
      completedData: completedData,
      metrics,
    };
  };

  const getGapAnalysisData = () => {
    const isSprintMode = selectedValue?.value?.toLowerCase() === APP_STRINGS.API_SPRINT;
    const isReleaseMode = selectedValue?.value?.toLowerCase() === 'release';

    let dataSource = [];
    if (isSprintMode) {
      dataSource = jiraData?.sprintList || [];
    } else if (isReleaseMode) {
      dataSource = jiraData?.releasesList || [];
    } else {
      dataSource = jiraData?.sprintList || [];
    }

    if (!dataSource || !Array.isArray(dataSource) || dataSource.length === 0) {
      return [];
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

    const getMetrics = (item) => item?.committedVsCompletedMetrics || item || {};

    const colors = {
      committed: '#3B82F6',
      completed: '#10B981',
      gap: '#F59E0B',
    };

    return sortedData.map((item) => {
      const metrics = getMetrics(item);
      const name = isSprintMode
        ? item?.name || item?.sprintName || `Sprint ${item?.sprintId || ''}`
        : item?.releaseName || item?.name || `Release ${item?.releaseId || ''}`;

      let committed = 0;
      let completed = 0;

      if (toggleType === APP_STRINGS.STORY_POINTS) {
        committed = metrics?.committedStoryPoints || 0;
        completed = metrics?.completedStoryPoints || 0;
      } else if (toggleType === APP_STRINGS.HOURS) {
        committed = metrics?.committedHours || 0;
        completed = metrics?.completedHours || 0;
      } else {
        committed = metrics?.committedTickets || 0;
        completed = metrics?.completedTickets || 0;
      }

      const gap = Math.max(0, committed - completed);

      return {
        name,
        committed,
        completed,
        gap,
        committedColor: colors.committed,
        completedColor: colors.completed,
        gapColor: colors.gap,
      };
    });
  };

  const getGapAnalysisChartData = () => {
    return getGapAnalysisData();
  };
  const getVelocityDetailsData = () => {
    const isSprintMode = selectedValue?.value?.toLowerCase() === APP_STRINGS.API_SPRINT;
    const isReleaseMode = selectedValue?.value?.toLowerCase() === 'release';

    let dataSource = [];
    if (isSprintMode) {
      dataSource = jiraData?.sprintList || [];
    } else if (isReleaseMode) {
      dataSource = jiraData?.releasesList || [];
    } else {
      dataSource = jiraData?.sprintList || [];
    }

    if (!dataSource || !Array.isArray(dataSource) || dataSource.length === 0) {
      return [];
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

    const getMetrics = (item) => item?.committedVsCompletedMetrics || item || {};

    const colors = {
      initiallyCommitted: '#8B5CF6',
      finallyCommitted: '#3B82F6',
      done: '#10B981',
      velocity: '#F97316',
    };

    return sortedData.map((item) => {
      const metrics = getMetrics(item);
      const name = isSprintMode
        ? item?.name || item?.sprintName || `Sprint ${item?.sprintId || ''}`
        : item?.releaseName || item?.name || `Release ${item?.releaseId || ''}`;

      let initiallyCommitted = 0;
      let finallyCommitted = 0;
      let done = 0;
      let velocity = 0;

      if (toggleType === APP_STRINGS.STORY_POINTS) {
        initiallyCommitted =
          metrics?.initialStoryPoints || metrics?.initiallyCommittedStoryPoints || 0;
        finallyCommitted = metrics?.committedStoryPoints || 0;
        done = metrics?.completedStoryPoints || 0;
        velocity = item?.velocity?.completed || metrics?.completedStoryPoints || 0;
      } else if (toggleType === APP_STRINGS.HOURS) {
        initiallyCommitted = metrics?.initialHours || 0;
        finallyCommitted = metrics?.committedHours || 0;
        done = metrics?.completedHours || 0;
        velocity = item?.velocity?.completedHours || metrics?.completedHours || 0;
      } else {
        initiallyCommitted = metrics?.initialTickets || 0;
        finallyCommitted = metrics?.committedTickets || 0;
        done = metrics?.completedTickets || 0;
        velocity = item?.velocity?.completedTickets || metrics?.completedTickets || 0;
      }

      return {
        name,
        initiallyCommitted,
        finallyCommitted,
        done,
        velocity,
        initiallyCommittedColor: colors.initiallyCommitted,
        finallyCommittedColor: colors.finallyCommitted,
        doneColor: colors.done,
        velocityColor: colors.velocity,
      };
    });
  };

  const getVelocityDetailsChartData = () => {
    return getVelocityDetailsData();
  };

  return (
    <>
      {layout === 'grid' ? (
        <div
          className="relative flex-shrink-0 hover:cursor-pointer bg-white dark:bg-[#182433] text-[#626262] dark:text-[#C8C8C8] rounded-[10px] p-4 border border-[#D1E2F0] dark:border-[#25384F] h-80 hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md"
          style={{
            borderBottom: `solid 0.4vh ${getChangeColorForWidget(
              itemDetails.name,
              itemDetails.value || 0,
            )}`,
          }}
        >
          <div className="grid grid-cols-[36%_57%] gap-10">
            <div className="flex flex-col">
              <div className="flex flex-col gap-3 py-2">
                <div className="flex gap-2">
                  <h2 className="text-[#202020] dark:text-gray-300 text-lg font-medium">
                    {itemDetails.name}
                  </h2>
                </div>
                <div className="w-auto">
                  <div className="flex items-center">
                    <div>
                      <span className="text-blue-400 text-xl font-semibold">{committed}</span>
                      <span className="text-lg px-2 text-gray-100">vs</span>
                      <span className="text-blue-400 text-xl font-semibold">{completed}</span>
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

              <div className="space-y-2 text-sm border-t border-[#D1E2F0] dark:border-[#25384F] pt-6 mt-2">
                <div className="flex justify-between text-gray-400">
                  <span>
                    {selectedValue?.value?.toLowerCase() === 'release' ? releaseLabel : sprintLabel}{' '}
                    End Date
                  </span>
                  <span className="flex justify-end w-20">
                    <span className="text-gray-300 text-left w-full">
                      {selectedSprintEndDate?.endDate || 'N/A'}
                    </span>
                  </span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Days To {releaseLabel}</span>
                  <span className="flex justify-end w-20">
                    <span className="text-gray-300"></span>
                    <span className="text-left w-full">{remainingDays} Days</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-base">
              <div className="flex flex-col gap-2 justify-between">
                <div className="flex justify-between">
                  <div className="bg-transparent dark:bg-[#242B34] border border-[#D1E2F0] dark:border-[#101010] rounded-full p-0.5 flex justify-between">
                    <button
                      onClick={() => handleToggleType(APP_STRINGS.STORY_POINTS)}
                      className={`py-1 px-2 rounded-full text-xs font-medium transition-colors ${
                        toggleType === APP_STRINGS.STORY_POINTS
                          ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {APP_STRINGS.STORY_POINTS}
                    </button>

                    <button
                      onClick={() => handleToggleType(APP_STRINGS.HOURS)}
                      className={`py-1 px-2 rounded-full text-xs font-medium transition-colors ${
                        toggleType === APP_STRINGS.HOURS
                          ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {APP_STRINGS.HOURS}
                    </button>

                    <button
                      onClick={() => handleToggleType(APP_STRINGS.TICKETS)}
                      className={`py-1 px-2 rounded-full text-xs font-medium transition-colors ${
                        toggleType === APP_STRINGS.TICKETS
                          ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {APP_STRINGS.TICKETS}
                    </button>
                  </div>
                </div>
                <div className="flex w-auto">
                  <select
                    className="w-full p-2 border border-[#D1E2F0] dark:border-[#25384F] rounded bg-white dark:bg-[#182433] text-[#202020] dark:text-gray-300 text-sm"
                    value={selectedCommitted.value}
                    onChange={(e) =>
                      handleCommittedSelect({
                        value: e.target.value,
                        label: e.target.options[e.target.selectedIndex].text,
                      })
                    }
                  >
                    {committedOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {selectedCommitted.value === 'committed_vs_completed' ? (
                <div className="flex flex-col gap-0.5 py-auto">
                  {toggleType === APP_STRINGS.TICKETS ? (
                    ' '
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-[#626262] dark:text text-sm">
                          Completion Progress
                        </span>
                        <span className="text-[#202020] dark:text-gray-300 text-sm flex justify-end w-16">
                          <span className="text-left w-full">
                            {committed > 0 ? Math.round((completed / committed) * 100) : 0}%
                          </span>
                        </span>
                      </div>
                      {getCommittedAndCompletedData().map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-[#626262] dark:text-gray-400 text-sm">
                            {item.name}
                          </span>
                          <span className="text-[#202020] dark:text-gray-300 text-sm flex justify-end w-16">
                            <Tooltip
                              content={(item.value > 0 ? item.value : 0).toLocaleString()}
                              position="top"
                            >
                              <span className="text-left w-full">
                                {item.value > 0
                                  ? formatNumberWithSuffix(item.value).formatted
                                  : '0'}
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
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400">
                          Currently Blocked {toggleType}
                        </span>
                        <span className="text-[#202020] dark:text-gray-300 font-semibold">0</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400">
                          Total Blocked {toggleType}
                        </span>
                        <span className="text-[#202020] dark:text-gray-300 font-semibold">0</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400">
                          Average Duration Of Blocked {toggleType}
                        </span>
                        <span className="text-[#202020] dark:text-gray-300 font-semibold">
                          0 hrs
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400">
                          Average Blocked {toggleType} Multiple {selectedValue.value} Trend
                        </span>
                        <span className="text-[#202020] dark:text-gray-300 font-semibold">0</span>
                      </div>
                    </>
                  ) : (
                    ' '
                  )}
                </div>
              ) : selectedCommitted.value === 'story_points_trend' ? (
                <div>
                  {toggleType === APP_STRINGS.STORY_POINTS ? (
                    <>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400">
                          Average Of Total {toggleType} Committed
                        </span>
                        <span className="text-[#202020] dark:text-gray-300 font-semibold">0</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400">
                          Average Of Total {toggleType} Completed
                        </span>
                        <span className="text-[#202020] dark:text-gray-300 font-semibold">0</span>
                      </div>
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
                        <span className="text-[#626262] dark:text-gray-400">Average Committed</span>
                        <span className="text-[#202020] dark:text-gray-300 font-semibold text-left min-w-[50px]">
                          {(() => {
                            const data = getGapAnalysisData();
                            const avg =
                              data.length > 0
                                ? Math.round(
                                    data.reduce((sum, item) => sum + item.committed, 0) /
                                      data.length,
                                  )
                                : 0;
                            return avg;
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400">Average Completed</span>
                        <span className="text-[#202020] dark:text-gray-300 font-semibold text-left min-w-[50px]">
                          {(() => {
                            const data = getGapAnalysisData();
                            const avg =
                              data.length > 0
                                ? Math.round(
                                    data.reduce((sum, item) => sum + item.completed, 0) /
                                      data.length,
                                  )
                                : 0;
                            return avg;
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400">Average Gap</span>
                        <span className="text-[#202020] dark:text-gray-300 font-semibold text-left min-w-[50px]">
                          {(() => {
                            const data = getGapAnalysisData();
                            const avg =
                              data.length > 0
                                ? Math.round(
                                    data.reduce((sum, item) => sum + item.gap, 0) / data.length,
                                  )
                                : 0;
                            return avg;
                          })()}
                        </span>
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
                        <span className="text-[#626262] dark:text-gray-400">
                          Average Initially Committed
                        </span>
                        <span className="text-[#202020] dark:text-gray-300 font-semibold">
                          {(() => {
                            const data = getVelocityDetailsData();
                            const avg =
                              data.length > 0
                                ? Math.round(
                                    data.reduce((sum, item) => sum + item.initiallyCommitted, 0) /
                                      data.length,
                                  )
                                : 0;
                            return avg;
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400">
                          Average Finally Committed
                        </span>
                        <span className="text-[#202020] dark:text-gray-300 font-semibold">
                          {(() => {
                            const data = getVelocityDetailsData();
                            const avg =
                              data.length > 0
                                ? Math.round(
                                    data.reduce((sum, item) => sum + item.finallyCommitted, 0) /
                                      data.length,
                                  )
                                : 0;
                            return avg;
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400">Average Done</span>
                        <span className="text-[#202020] dark:text-gray-300 font-semibold text-left min-w-[50px]">
                          {(() => {
                            const data = getVelocityDetailsData();
                            const avg =
                              data.length > 0
                                ? Math.round(
                                    data.reduce((sum, item) => sum + item.done, 0) / data.length,
                                  )
                                : 0;
                            return avg;
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-[#626262] dark:text-gray-400">Average Velocity</span>
                        <span className="text-[#202020] dark:text-gray-300 font-semibold text-left min-w-[50px]">
                          {(() => {
                            const data = getVelocityDetailsData();
                            const avg =
                              data.length > 0
                                ? Math.round(
                                    data.reduce((sum, item) => sum + item.velocity, 0) /
                                      data.length,
                                  )
                                : 0;
                            return avg;
                          })()}
                        </span>
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
        <div className="w-full">
          <div className="grid grid-cols-12 gap-6 items-start">
            <div className="col-span-4">
              <div
                className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-lg p-4 dark:shadow-lg shadow-[0_1px_20px_rgba(0,0,0,0.1)] h-80"
                style={{
                  borderBottom: `solid 0.4vh ${getChangeColorForWidget(
                    itemDetails.name,
                    itemDetails.value || 0,
                  )}`,
                }}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h2
                        className={`text-lg font-semibold ${
                          theme === APP_STRINGS.THEME_LIGHT ? 'text-[#0A2342]' : 'dark:text-gray-300'
                        }`}
                      >
                        {itemDetails.name}
                      </h2>
                      <span
                        data-tooltip-id={`tooltip-committed-vs-completed`}
                        data-tooltip-html={getTooltipContentByName(itemDetails.name)}
                        data-tooltip-place="bottom"
                        data-tooltip-offset="15"
                        className="cursor-pointer"
                      >
                        <InformationCircleIcon
                          className={`h-5 w-5 ${
                            theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'text-gray-500'
                          }`}
                        />
                      </span>
                      <ReactTooltip
                        id={`tooltip-committed-vs-completed`}
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
                          borderColor: '#224F78',
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
                    <div className="flex items-center">
                      <span
                        className={`text-xl font-semibold mr-2 ${
                          theme === APP_STRINGS.THEME_LIGHT ? 'text-[#0072BB]' : 'text-blue-400'
                        }`}
                      >
                        <span
                          data-tooltip-id={`tooltip-committed-${itemDetails.name}`}
                          data-tooltip-html={committed.toLocaleString()}
                          data-tooltip-offset="15"
                          className="cursor-pointer"
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
                        <span className={`${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : ''} mx-2`}>
                          vs
                        </span>
                        <span
                          data-tooltip-id={`tooltip-completed-${itemDetails.name}`}
                          data-tooltip-html={completed.toLocaleString()}
                          data-tooltip-offset="15"
                          className="cursor-pointer"
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

                  {/* Header line */}
                  <div className="border-b border-[#D1E2F0] dark:border-[#25384F] mb-4"></div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span
                        className={`text-sm ${
                          theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'dark:text-gray-400'
                        }`}
                      >
                        {selectedValue?.value?.toLowerCase() === 'release'
                          ? releaseLabel
                          : sprintLabel}{' '}
                        End Date
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          theme === APP_STRINGS.THEME_LIGHT ? 'text-[#0072BB]' : 'dark:text-gray-300'
                        }`}
                      >
                        {selectedSprintEndDate?.endDate || 'N/A'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span
                        className={`text-sm ${
                          theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'dark:text-gray-400'
                        }`}
                      >
                        Days To {releaseLabel}
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          theme === APP_STRINGS.THEME_LIGHT ? 'text-[#0072BB]' : 'dark:text-gray-300'
                        }`}
                      >
                        {remainingDays} Days
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-8">
              <div className="bg-white dark:bg-[#182433] border border-[#D1E2F0] dark:border-[#25384F] rounded-[10px] pt-4 px-6 pb-6 hover:shadow-[0_1px_10px_0_#0C709C4D] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md h-80">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-xl font-semibold ${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#0A2342]' : 'dark:text-white'}`}>
                      C vs C
                    </h2>
                    <div className="flex items-center gap-4">
                      <div className="bg-transparent dark:bg-[#242B34] border border-[#D1E2F0] dark:border-[#101010] rounded-full p-0.5 flex justify-between">
                        <button
                          onClick={() => handleToggleType(APP_STRINGS.STORY_POINTS)}
                          className={`py-1 px-2 rounded-full text-xs font-medium transition-colors ${
                            toggleType === APP_STRINGS.STORY_POINTS
                              ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                              : 'text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {APP_STRINGS.STORY_POINTS}
                        </button>

                        <button
                          onClick={() => handleToggleType(APP_STRINGS.TICKETS)}
                          className={`py-1 px-2 rounded-full text-xs font-medium transition-colors ${
                            toggleType === APP_STRINGS.TICKETS
                              ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                              : 'text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {APP_STRINGS.TICKETS}
                        </button>

                        <button
                          onClick={() => handleToggleType(APP_STRINGS.HOURS)}
                          className={`py-1 px-2 rounded-full text-xs font-medium transition-colors ${
                            toggleType === APP_STRINGS.HOURS
                              ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                              : 'text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {APP_STRINGS.HOURS}
                        </button>
                      </div>

                      {selectedCommitted.value === 'story_points_trend' && (
                        <div className="bg-transparent dark:bg-[#242B34] border border-[#D1E2F0] dark:border-[#101010] rounded-full p-0.5 flex">
                          <button
                            onClick={() => handleToggleSprintTeam(APP_STRINGS.VALUE_SPRINT)}
                            className={`py-1 px-2 rounded-full text-xs font-medium transition-colors ${
                              toggleSprintTeam === APP_STRINGS.VALUE_SPRINT
                                ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                                : 'text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            Sprint
                          </button>
                          <button
                            onClick={() => handleToggleSprintTeam('Team Member')}
                            className={`py-1 px-2 rounded-full text-xs font-medium transition-colors ${
                              toggleSprintTeam === 'Team Member'
                                ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                                : 'text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            Team Member
                          </button>
                        </div>
                      )}

                      {selectedCommitted.value === 'blocked_stories_trend' && (
                        <div className="bg-transparent dark:bg-[#242B34] border border-[#D1E2F0] dark:border-[#101010] rounded-full p-0.5 flex">
                          <button
                            onClick={() => handleToggleBlocked('Blocked')}
                            className={`py-1 px-2 rounded-full text-xs font-medium transition-colors ${
                              toggleBlocked === 'Blocked'
                                ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                                : 'text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            Blocked
                          </button>
                          <button
                            onClick={() => handleToggleBlocked('Deviation')}
                            className={`py-1 px-2 rounded-full text-xs font-medium transition-colors ${
                              toggleBlocked === 'Deviation'
                                ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                                : 'text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            Deviation
                          </button>
                        </div>
                      )}

                      <DropdownButton
                        buttonLabel={selectedCommitted?.label || 'Select Chart'}
                        options={committedOptions}
                        onSelect={handleCommittedSelect}
                        selectedOption={selectedCommitted?.label}
                        value={selectedCommitted}
                        placeholder="Select Chart"
                        type="committedChart"
                        width="lgx"
                      />
                    </div>
                  </div>

                  {/* Chart Content - Horizontal Bar Chart */}
                  <div className="flex-1">
                    {selectedCommitted.value === 'committed_vs_completed' && (
                      <div className="space-y-2.5 pl-8 pb-4">
                        {getCommittedAndCompletedData().map((item, index) => {
                          // Calculate bar width based on the maximum value
                          const maxValue = Math.max(
                            ...getCommittedAndCompletedData().map((d) => d.value),
                            1,
                          );
                          const percentage = (item.value / maxValue) * 100;

                          return (
                            <div key={index} className="flex items-center gap-3">
                              <div className="flex items-center gap-2.5 flex-1">
                                <span className={`${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#24527A]' : 'dark:text-gray-300'} text-[12px] font-normal min-w-[240px] text-right`}>
                                  {item.name}
                                </span>
                                <div
                                  className="h-1.5 rounded-full transition-all"
                                  style={{
                                    backgroundColor: item.color,
                                    width: `${percentage * 0.45}%`,
                                    minWidth: item.value > 0 ? '25px' : '0px',
                                    maxWidth: '280px',
                                  }}
                                ></div>
                              </div>
                              <span className={`${theme === APP_STRINGS.THEME_LIGHT ? 'text-[#0072BB] font-semibold' : 'dark:text-white'} text-[12px] font-normal min-w-[50px] text-left`}>
                                <Tooltip 
                                  content={(item.value > 0 ? item.value : 0).toLocaleString()}
                                  position="top"
                                >
                                  <span className="cursor-pointer">
                                    {item.value > 0
                                      ? formatNumberWithSuffix(item.value).formatted
                                      : '0'}
                                  </span>
                                </Tooltip>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {selectedCommitted.value === 'blocked_stories_trend' &&
                      toggleType === APP_STRINGS.STORY_POINTS && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            {toggleBlocked === 'Blocked' ? (
                              <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                  <span className="text-[#626262] dark:text-gray-400 text-sm">
                                    Number Of Blocked Tickets
                                  </span>
                                  <span className="text-[#202020] dark:text-gray-300 text-sm font-medium">
                                    {getBlockedStoriesTrendData().metrics.numberOfBlockedTickets ||
                                      0}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[#626262] dark:text-gray-400 text-sm">
                                    Average Duration Of Blocked Tickets
                                  </span>
                                  <span className="text-[#202020] dark:text-gray-300 text-sm font-medium">
                                    {getBlockedStoriesTrendData().metrics
                                      .averageDurationOfBlockedTickets || '0hrs'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-[#626262] dark:text-gray-400 text-sm">
                                  Deviation Between Committed & Completed Tickets
                                </span>
                                <span className="text-[#202020] dark:text-gray-300 text-sm font-medium">
                                  {getBlockedStoriesTrendData().metrics
                                    .deviationBetweenCommittedAndCompleted || 0}
                                </span>
                              </div>
                            )}
                          </div>

                         <div className="h-48">
                           {(() => {
                             const blockedData = getBlockedStoriesTrendData();
                             const chartData = blockedData.labels.map((label, index) => ({
                               name: label,
                               value: blockedData.data[index] || 0,
                               color: '#3b82f6',
                             }));
                             
                             return (
                               <CustomLineBarChart
                                 type="blockedStoriesTrend"
                                 data={chartData}
                                 showLine={true}
                                 showBar={false}
                                 legendLabel={toggleBlocked}
                               />
                             );
                           })()}
                         </div>
                       </div>
                     )}

                    {selectedCommitted.value === 'story_points_trend' &&
                      toggleType === APP_STRINGS.STORY_POINTS && (
                        <div className="space-y-4">
                          <div className="h-48">
                            {(() => {
                              const trendData = getStoryPointsTrendData();
                              const chartData = trendData.labels.map((label, index) => ({
                                name: label,
                                committed: trendData.committedData[index] || 0,
                                completed: trendData.completedData[index] || 0,
                                committedColor: '#3b82f6',
                                completedColor: '#10b981',
                              }));

                              return (
                                <CustomLineBarChart
                                  type="storyPointsTrend"
                                  data={chartData}
                                  showLine={true}
                                  showBar={false}
                                />
                              );
                            })()}
                          </div>
                        </div>
                      )}

                    {selectedCommitted.value === 'gap_analysis' &&
                      toggleType === APP_STRINGS.STORY_POINTS && (
                        <div className="space-y-4">
                          <div className="h-48">
                            {(() => {
                              const gapData = getGapAnalysisChartData();

                              if (gapData.length === 0) {
                                return (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <div className="text-center">
                                      <div className="text-gray-400 dark:text-gray-500 mb-3 flex justify-center">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="17"
                                          height="17"
                                          viewBox="0 0 17 17"
                                          fill="none"
                                          className="w-10 h-10"
                                        >
                                          <path
                                            d="M6.5 4.5C6.77614 4.5 7 4.27614 7 4C7 3.72386 6.77614 3.5 6.5 3.5C6.22386 3.5 6 3.72386 6 4C6 4.27614 6.22386 4.5 6.5 4.5Z"
                                            fill="currentColor"
                                          />
                                          <path
                                            d="M6.5 8.5C6.77614 8.5 7 8.27614 7 8C7 7.72386 6.77614 7.5 6.5 7.5C6.22386 7.5 6 7.72386 6 8C6 8.27614 6.22386 8.5 6.5 8.5Z"
                                            fill="currentColor"
                                          />
                                          <path
                                            d="M6.5 12.5C6.77614 12.5 7 12.2761 7 12C7 11.7239 6.77614 11.5 6.5 11.5C6.22386 11.5 6 11.7239 6 12C6 12.2761 6.22386 12.5 6.5 12.5Z"
                                            fill="currentColor"
                                          />
                                          <path
                                            d="M10.7495 2.54297H3.87014C3.4871 2.54297 3.23226 2.90382 3.3195 3.27668L4.11151 6.65123C4.16958 6.9001 4.39283 7.07407 4.64718 7.07407H11.5265C11.9095 7.07407 12.1643 6.71322 12.0771 6.34036L11.285 2.96581C11.2269 2.71694 11.0037 2.54297 10.7495 2.54297Z"
                                            stroke="currentColor"
                                            strokeWidth="0.79955"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                          <path
                                            d="M12.9157 12.5312L11.5273 13.9196M11.5273 12.5312L12.9157 13.9196"
                                            stroke="currentColor"
                                            strokeWidth="0.79955"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                          <path
                                            d="M12.2214 15.4429C13.4483 15.4429 14.4429 14.4483 14.4429 13.2214C14.4429 11.9946 13.4483 11 12.2214 11C10.9946 11 10 11.9946 10 13.2214C10 14.4483 10.9946 15.4429 12.2214 15.4429Z"
                                            stroke="currentColor"
                                            strokeWidth="0.79955"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                          <path
                                            d="M14.9948 15.9987L13.8008 14.8047"
                                            stroke="currentColor"
                                            strokeWidth="0.79955"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </div>
                                      <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                                        No data available for this view
                                      </p>
                                      <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                                        Try selecting different filters or check back later
                                      </p>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <CustomLineBarChart
                                  type="gapAnalysis"
                                  data={gapData}
                                  showLine={false}
                                  showBar={true}
                                />
                              );
                            })()}
                          </div>
                        </div>
                      )}

                    {selectedCommitted.value === 'velocity_details' &&
                      toggleType === APP_STRINGS.STORY_POINTS && (
                        <div className="space-y-4">
                          <div className="h-52">
                            {(() => {
                              const velocityData = getVelocityDetailsChartData();

                              if (velocityData.length === 0) {
                                return (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <div className="text-center">
                                      <div className="text-gray-400 dark:text-gray-500 mb-3 flex justify-center">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="17"
                                          height="17"
                                          viewBox="0 0 17 17"
                                          fill="none"
                                          className="w-10 h-10"
                                        >
                                          <path
                                            d="M6.5 4.5C6.77614 4.5 7 4.27614 7 4C7 3.72386 6.77614 3.5 6.5 3.5C6.22386 3.5 6 3.72386 6 4C6 4.27614 6.22386 4.5 6.5 4.5Z"
                                            fill="currentColor"
                                          />
                                          <path
                                            d="M6.5 8.5C6.77614 8.5 7 8.27614 7 8C7 7.72386 6.77614 7.5 6.5 7.5C6.22386 7.5 6 7.72386 6 8C6 8.27614 6.22386 8.5 6.5 8.5Z"
                                            fill="currentColor"
                                          />
                                          <path
                                            d="M6.5 12.5C6.77614 12.5 7 12.2761 7 12C7 11.7239 6.77614 11.5 6.5 11.5C6.22386 11.5 6 11.7239 6 12C6 12.2761 6.22386 12.5 6.5 12.5Z"
                                            fill="currentColor"
                                          />
                                          <path
                                            d="M10.7495 2.54297H3.87014C3.4871 2.54297 3.23226 2.90382 3.3195 3.27668L4.11151 6.65123C4.16958 6.9001 4.39283 7.07407 4.64718 7.07407H11.5265C11.9095 7.07407 12.1643 6.71322 12.0771 6.34036L11.285 2.96581C11.2269 2.71694 11.0037 2.54297 10.7495 2.54297Z"
                                            stroke="currentColor"
                                            strokeWidth="0.79955"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                          <path
                                            d="M12.9157 12.5312L11.5273 13.9196M11.5273 12.5312L12.9157 13.9196"
                                            stroke="currentColor"
                                            strokeWidth="0.79955"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                          <path
                                            d="M12.2214 15.4429C13.4483 15.4429 14.4429 14.4483 14.4429 13.2214C14.4429 11.9946 13.4483 11 12.2214 11C10.9946 11 10 11.9946 10 13.2214C10 14.4483 10.9946 15.4429 12.2214 15.4429Z"
                                            stroke="currentColor"
                                            strokeWidth="0.79955"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                          <path
                                            d="M14.9948 15.9987L13.8008 14.8047"
                                            stroke="currentColor"
                                            strokeWidth="0.79955"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </div>
                                      <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                                        No data available for this view
                                      </p>
                                      <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                                        Try selecting different filters or check back later
                                      </p>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <CustomLineBarChart
                                  type="velocityDetails"
                                  data={velocityData}
                                  showLine={true}
                                  showBar={true}
                                />
                              );
                            })()}
                          </div>
                        </div>
                      )}

                    {(toggleType === APP_STRINGS.HOURS || toggleType === APP_STRINGS.TICKETS) &&
                      selectedCommitted.value !== 'committed_vs_completed' && (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <div className="text-gray-400 dark:text-gray-500 mb-3 flex justify-center">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="17"
                                height="17"
                                viewBox="0 0 17 17"
                                fill="none"
                                className="w-10 h-10"
                              >
                                <path
                                  d="M6.5 4.5C6.77614 4.5 7 4.27614 7 4C7 3.72386 6.77614 3.5 6.5 3.5C6.22386 3.5 6 3.72386 6 4C6 4.27614 6.22386 4.5 6.5 4.5Z"
                                  fill="currentColor"
                                />
                                <path
                                  d="M6.5 8.5C6.77614 8.5 7 8.27614 7 8C7 7.72386 6.77614 7.5 6.5 7.5C6.22386 7.5 6 7.72386 6 8C6 8.27614 6.22386 8.5 6.5 8.5Z"
                                  fill="currentColor"
                                />
                                <path
                                  d="M6.5 12.5C6.77614 12.5 7 12.2761 7 12C7 11.7239 6.77614 11.5 6.5 11.5C6.22386 11.5 6 11.7239 6 12C6 12.2761 6.22386 12.5 6.5 12.5Z"
                                  fill="currentColor"
                                />
                                <path
                                  d="M10.7495 2.54297H3.87014C3.4871 2.54297 3.23226 2.90382 3.3195 3.27668L4.11151 6.65123C4.16958 6.9001 4.39283 7.07407 4.64718 7.07407H11.5265C11.9095 7.07407 12.1643 6.71322 12.0771 6.34036L11.285 2.96581C11.2269 2.71694 11.0037 2.54297 10.7495 2.54297Z"
                                  stroke="currentColor"
                                  strokeWidth="0.79955"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M12.9157 12.5312L11.5273 13.9196M11.5273 12.5312L12.9157 13.9196"
                                  stroke="currentColor"
                                  strokeWidth="0.79955"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M12.2214 15.4429C13.4483 15.4429 14.4429 14.4483 14.4429 13.2214C14.4429 11.9946 13.4483 11 12.2214 11C10.9946 11 10 11.9946 10 13.2214C10 14.4483 10.9946 15.4429 12.2214 15.4429Z"
                                  stroke="currentColor"
                                  strokeWidth="0.79955"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M14.9948 15.9987L13.8008 14.8047"
                                  stroke="currentColor"
                                  strokeWidth="0.79955"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                              No data available for this view
                            </p>
                            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                              Try selecting different filters or check back later
                            </p>
                          </div>
                        </div>
                      )}

                    {selectedCommitted.value !== 'committed_vs_completed' &&
                      selectedCommitted.value !== 'blocked_stories_trend' &&
                      selectedCommitted.value !== 'story_points_trend' &&
                      selectedCommitted.value !== 'gap_analysis' &&
                      selectedCommitted.value !== 'velocity_details' && (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-[#626262] dark:text-gray-400 text-sm">
                            {selectedCommitted.label} - Coming soon
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

CommittedVsCompleted.propTypes = {
  layout: PropTypes.string.isRequired,
  itemDetails: PropTypes.object.isRequired,
};

export default CommittedVsCompleted;
