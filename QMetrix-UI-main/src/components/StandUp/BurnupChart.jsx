import { useMemo } from 'react';
import PropTypes from 'prop-types'; 
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import { generateDateRange } from '../../utils/burndownUtils';
import { CustomBurnupTooltip } from '../Common/ToolTip';
import DropdownButton from '../Common/DropDown';
import { targetPoints } from '../../constants';
import TooltipIcon from '../../utils/TooltipIcon';

function generateDateRangeAllDays(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function isWeekend(dateStr) {
  const [year, month, dayNum] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, dayNum);
  return d.getDay() === 0 || d.getDay() === 6;
}

function buildWorkingDayIdeal(dateRange, idealTarget) {
  const workingDayCount = dateRange.filter((d) => !isWeekend(d)).length;
  const dailyIncrement = workingDayCount > 0 ? idealTarget / workingDayCount : 0;
  let cumulative = 0;
  const idealMap = {};
  dateRange.forEach((date) => {
    if (!isWeekend(date)) {
      cumulative += dailyIncrement;
    }
    idealMap[date] = parseFloat(cumulative.toFixed(2));
  });

  return idealMap;
}

function processBurnupData({
  actualStory,
  dailyBurnup,
  showAddedWork,
  burnupModePoints,
  selectedDeveloper,
  initialEffortByDevMemo,
  initialStoryPoint,
  initialHours,
  spilloverStoryPoints,
  spilloverHours,
  lastLoggedDate,
  targetPoints: targetPointsConst,
}) {
  const { actualStoryPoints = [], mode = 'sprint' } = actualStory || {};

  if (!actualStoryPoints?.length && dailyBurnup?.length > 0) {
    const firstItem = dailyBurnup[0];
    const lastItem = dailyBurnup[dailyBurnup.length - 1];
    const startDate = firstItem?.startDateEndDate?.startDate || firstItem?.issueCreatedAt?.split('T')[0];
    const endDate = lastItem?.startDateEndDate?.endDate || lastItem?.issueCreatedAt?.split('T')[0];

    if (!startDate || !endDate) return [];
    const dateRange = generateDateRangeAllDays(startDate, endDate);

    const addedWorkData = dateRange.reduce((acc, date) => {
      acc[date] = { points: 0, hours: 0 };
      return acc;
    }, {});

    dailyBurnup.forEach((item) => {
      const creationDate = item.issueCreatedAt != null ? String(item.issueCreatedAt).split('T')[0] : null;
      if (!creationDate) return;
      if (!addedWorkData[creationDate]) addedWorkData[creationDate] = { points: 0, hours: 0 };
      addedWorkData[creationDate].hours += Number.parseFloat(item.hoursAdded) || 0;
      addedWorkData[creationDate].points += Number.parseInt(item.storyPointsAdded, 10) || 0;
    });

    const actualWorkData = dateRange.reduce((acc, date) => {
      acc[date] = { points: 0, hours: 0 };
      return acc;
    }, {});
    const actualWorkDataFromInitial = dateRange.reduce((acc, date) => {
      acc[date] = { points: 0, hours: 0 };
      return acc;
    }, {});
    const actualWorkDataFromAdded = dateRange.reduce((acc, date) => {
      acc[date] = { points: 0, hours: 0 };
      return acc;
    }, {});
    const hasIdealFromApi = dailyBurnup[0].idealLineSP !== undefined || dailyBurnup[0].idealLineHrs !== undefined;
    const idealByDate = {};
    if (hasIdealFromApi) {
      dailyBurnup.forEach((item) => {
        const d = item.issueCreatedAt != null ? String(item.issueCreatedAt).split('T')[0] : null;
        if (d) idealByDate[d] = item;
      });
    }
    dailyBurnup.forEach((item) => {
      const creationDate = item.issueCreatedAt != null ? String(item.issueCreatedAt).split('T')[0] : null;
      if (!creationDate) return;
      if (!actualWorkData[creationDate]) actualWorkData[creationDate] = { points: 0, hours: 0 };
      actualWorkData[creationDate].hours += Number.parseFloat(item.hoursDone) || 0;
      actualWorkData[creationDate].points += Number.parseInt(item.storyPointsDone, 10) || 0;
      if (item.storyPointsDoneFromInitialScope !== undefined || item.hoursDoneFromInitialScope !== undefined) {
        if (!actualWorkDataFromInitial[creationDate]) actualWorkDataFromInitial[creationDate] = { points: 0, hours: 0 };
        actualWorkDataFromInitial[creationDate].points += Number.parseInt(item.storyPointsDoneFromInitialScope, 10) || 0;
        actualWorkDataFromInitial[creationDate].hours += Number.parseFloat(item.hoursDoneFromInitialScope) || 0;
      }
      if (item.storyPointsDoneFromAddedScope !== undefined || item.hoursDoneFromAddedScope !== undefined) {
        if (!actualWorkDataFromAdded[creationDate]) actualWorkDataFromAdded[creationDate] = { points: 0, hours: 0 };
        actualWorkDataFromAdded[creationDate].points += Number.parseInt(item.storyPointsDoneFromAddedScope, 10) || 0;
        actualWorkDataFromAdded[creationDate].hours += Number.parseFloat(item.hoursDoneFromAddedScope) || 0;
      }
    });

    const addedWorkByDate = {};
    const removedWorkByDate = {};
    const addedNewTicketsByDate = {};
    const estimationUpdatedByDate = {};
    const estimationIncreasedByDate = {};
    const estimationDecreasedByDate = {};
    const removedFromSprintByDate = {};
    const readdedToSprintByDate = {};
    const cumulativeWithEpicByDate = {};
    const cumulativeWithoutAddedByDate = {};
    const reopenedByDate = {};
    if (dailyBurnup.length) {
      dailyBurnup.forEach((item) => {
        const creationDate = item.issueCreatedAt?.split('T')[0];
        if (creationDate) {
          if (item.completedWorkCumulativeSP !== undefined || item.completedWorkCumulativeHrs !== undefined) {
            cumulativeWithoutAddedByDate[creationDate] = {
              points: Number(item.completedWorkCumulativeSP) || 0,
              hours: Number(item.completedWorkCumulativeHrs) || 0,
            };
          }
          if (item.storyPointsReopened || item.hoursReopened) {
            reopenedByDate[creationDate] = {
              sp: Number(item.storyPointsReopened) || 0,
              hrs: Number(item.hoursReopened) || 0,
            };
          }
          if (item.storyPointsRemovedFromSprint || item.hoursRemovedFromSprint) {
            if (!removedFromSprintByDate[creationDate]) {
              removedFromSprintByDate[creationDate] = { sp: 0, hrs: 0 };
            }
            removedFromSprintByDate[creationDate].sp += Number(item.storyPointsRemovedFromSprint) || 0;
            removedFromSprintByDate[creationDate].hrs += Number(item.hoursRemovedFromSprint) || 0;
          }
          if (item.storyPointsReaddedToSprint || item.hoursReaddedToSprint) {
            if (!readdedToSprintByDate[creationDate]) {
              readdedToSprintByDate[creationDate] = { sp: 0, hrs: 0 };
            }
            readdedToSprintByDate[creationDate].sp += Number(item.storyPointsReaddedToSprint) || 0;
            readdedToSprintByDate[creationDate].hrs += Number(item.hoursReaddedToSprint) || 0;
          }
          if (showAddedWork) {
            if (!addedWorkByDate[creationDate]) {
              addedWorkByDate[creationDate] = { storyPointsAdded: 0, hoursAdded: 0 };
            }
            addedWorkByDate[creationDate].storyPointsAdded += Number.parseInt(item.storyPointsAdded) || 0;
            addedWorkByDate[creationDate].hoursAdded += Number.parseFloat(item.hoursAdded) || 0;
            if (!addedNewTicketsByDate[creationDate]) {
              addedNewTicketsByDate[creationDate] = { sp: 0, hrs: 0 };
            }
            addedNewTicketsByDate[creationDate].sp += Number(item.storyPointsAddedNewTickets) || 0;
            addedNewTicketsByDate[creationDate].hrs += Number(item.hoursAddedNewTickets) || 0;
            if (!estimationUpdatedByDate[creationDate]) {
              estimationUpdatedByDate[creationDate] = { sp: 0, hrs: 0 };
            }
            estimationUpdatedByDate[creationDate].sp += Number(item.estimationUpdatedSP) || 0;
            estimationUpdatedByDate[creationDate].hrs += Number(item.estimationUpdatedHrs) || 0;
            if (!estimationIncreasedByDate[creationDate]) {
              estimationIncreasedByDate[creationDate] = { sp: 0, hrs: 0 };
            }
            estimationIncreasedByDate[creationDate].sp += Number(item.estimationIncreasedSP) || 0;
            estimationIncreasedByDate[creationDate].hrs += Number(item.estimationIncreasedHrs) || 0;
            if (!estimationDecreasedByDate[creationDate]) {
              estimationDecreasedByDate[creationDate] = { sp: 0, hrs: 0 };
            }
            estimationDecreasedByDate[creationDate].sp += Number(item.estimationDecreasedSP) || 0;
            estimationDecreasedByDate[creationDate].hrs += Number(item.estimationDecreasedHrs) || 0;
            if (item.storyPointsRemoved !== undefined || item.hoursRemoved !== undefined) {
              if (!removedWorkByDate[creationDate]) removedWorkByDate[creationDate] = { storyPointsRemoved: 0, hoursRemoved: 0 };
              removedWorkByDate[creationDate].storyPointsRemoved += Number(item.storyPointsRemoved) || 0;
              removedWorkByDate[creationDate].hoursRemoved += Number(item.hoursRemoved) || 0;
            }
            if (item.completedWorkCumulativeSPWithEpic !== undefined || item.completedWorkCumulativeHrsWithEpic !== undefined) {
              cumulativeWithEpicByDate[creationDate] = {
                points: Number(item.completedWorkCumulativeSPWithEpic) || 0,
                hours: Number(item.completedWorkCumulativeHrsWithEpic) || 0,
              };
            }
          }
        }
      });
    }

    let baseTotal = burnupModePoints ? initialStoryPoint : initialHours;
    if (selectedDeveloper && Array.isArray(initialEffortByDevMemo) && initialEffortByDevMemo.length > 0) {
      const devEffort = initialEffortByDevMemo.find(
        (dev) => dev.assignee?.toLowerCase() === selectedDeveloper?.toLowerCase(),
      );
      if (devEffort) {
        baseTotal = burnupModePoints ? (devEffort.initialStoryPoints ?? 0) : (devEffort.initialOriginalEstimateHrs ?? 0);
      } else {
        baseTotal = 0;
      }
    }

    const lastBurnupDay = dailyBurnup?.[dailyBurnup.length - 1];
    const idealTarget = lastBurnupDay
      ? (burnupModePoints ? (Number(lastBurnupDay.idealLineSP) || 0) : (Number(lastBurnupDay.idealLineHrs) || 0))
      : (burnupModePoints ? baseTotal + (Number(spilloverStoryPoints) || 0) : baseTotal + (Number(spilloverHours) || 0));

    let displayDates = dateRange.length > 15 ? dateRange.filter((_, index) => index % 2 === 0) : dateRange;
    if (dateRange.length > 0 && !displayDates.includes(dateRange[dateRange.length - 1])) {
      displayDates.push(dateRange[dateRange.length - 1]);
    }

    const cumulativeActualMap = {};
    const cumulativeFromInitialMap = {};
    const cumulativeFromAddedMap = {};
    let hoursDoneCumulative = 0;
    let pointsDoneCumulative = 0;
    let pointsFromInitialCumulative = 0;
    let hoursFromInitialCumulative = 0;
    let pointsFromAddedCumulative = 0;
    let hoursFromAddedCumulative = 0;
    dateRange.forEach((date) => {
      hoursDoneCumulative += actualWorkData[date]?.hours || 0;
      pointsDoneCumulative += actualWorkData[date]?.points || 0;
      cumulativeActualMap[date] = { points: pointsDoneCumulative, hours: hoursDoneCumulative };
      pointsFromInitialCumulative += actualWorkDataFromInitial[date]?.points || 0;
      hoursFromInitialCumulative += actualWorkDataFromInitial[date]?.hours || 0;
      cumulativeFromInitialMap[date] = { points: pointsFromInitialCumulative, hours: hoursFromInitialCumulative };
      pointsFromAddedCumulative += actualWorkDataFromAdded[date]?.points || 0;
      hoursFromAddedCumulative += actualWorkDataFromAdded[date]?.hours || 0;
      cumulativeFromAddedMap[date] = { points: pointsFromAddedCumulative, hours: hoursFromAddedCumulative };
    });
    const hasFromInitialData = Object.keys(actualWorkDataFromInitial).some((d) => (actualWorkDataFromInitial[d]?.points || 0) + (actualWorkDataFromInitial[d]?.hours || 0) > 0);

    const idealMap = buildWorkingDayIdeal(dateRange, idealTarget);

    const result = displayDates.map((date) => {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      const shouldShowNull =
        new Date(date) > new Date(todayString) ||
        (lastLoggedDate && new Date(date) > new Date(lastLoggedDate));
      const hasCumulativeWithoutAdded = Object.keys(cumulativeWithoutAddedByDate).length > 0;
      const apiDay = idealByDate[date];
      const weekend = isWeekend(date);

      let actual;
      const roundedIdeal = idealMap[date] ?? 0;

      if (showAddedWork && hasIdealFromApi && apiDay) {
        const scopeValue = burnupModePoints ? apiDay.idealLineSP : apiDay.idealLineHrs;
        actual = shouldShowNull ? null : (typeof scopeValue === 'number' && !Number.isNaN(scopeValue) ? scopeValue : 0);
      } else if (showAddedWork) {
        actual = shouldShowNull ? null : 0;
      } else {
        const cumulativeActual = hasCumulativeWithoutAdded && cumulativeWithoutAddedByDate[date]
          ? cumulativeWithoutAddedByDate[date]
          : (hasFromInitialData ? cumulativeFromInitialMap[date] : cumulativeActualMap[date]);
        actual = shouldShowNull
          ? null
          : burnupModePoints ? (cumulativeActual?.points ?? 0) : (cumulativeActual?.hours ?? 0);
      }

      let workAdded = 0;
      if (showAddedWork && addedWorkByDate[date]) {
        workAdded = burnupModePoints ? addedWorkByDate[date].storyPointsAdded : addedWorkByDate[date].hoursAdded;
      }
      const workRemoved = (showAddedWork && removedWorkByDate[date])
        ? (burnupModePoints ? removedWorkByDate[date].storyPointsRemoved : removedWorkByDate[date].hoursRemoved)
        : 0;
      const workAddedNewTickets = (showAddedWork && addedNewTicketsByDate[date])
        ? (burnupModePoints ? addedNewTicketsByDate[date].sp : addedNewTicketsByDate[date].hrs)
        : 0;
      const estimationUpdated = (showAddedWork && estimationUpdatedByDate[date])
        ? (burnupModePoints ? estimationUpdatedByDate[date].sp : estimationUpdatedByDate[date].hrs)
        : 0;
      const estimationIncreased = (showAddedWork && estimationIncreasedByDate[date])
        ? (burnupModePoints ? estimationIncreasedByDate[date].sp : estimationIncreasedByDate[date].hrs)
        : 0;
      const estimationDecreased = (showAddedWork && estimationDecreasedByDate[date])
        ? (burnupModePoints ? estimationDecreasedByDate[date].sp : estimationDecreasedByDate[date].hrs)
        : 0;
      const workRemovedFromSprint = removedFromSprintByDate[date]
        ? (burnupModePoints ? removedFromSprintByDate[date].sp : removedFromSprintByDate[date].hrs)
        : 0;
      const issueReaddedToSprint = readdedToSprintByDate[date]
        ? (burnupModePoints ? readdedToSprintByDate[date].sp : readdedToSprintByDate[date].hrs)
        : 0;
      const issueReopened = reopenedByDate[date]
        ? (burnupModePoints ? reopenedByDate[date].sp : reopenedByDate[date].hrs)
        : 0;
      const [, month, day] = date.split('-');
      return {
        day: `${month}/${day}`,
        date,
        ideal: roundedIdeal,
        actual,
        isWeekend: weekend,
        workAdded,
        workRemoved,
        workAddedNewTickets,
        estimationUpdated,
        estimationIncreased,
        estimationDecreased,
        workRemovedFromSprint,
        issueReaddedToSprint,
        issueReopened,
      };
    });

    return result;
  }

  if (!actualStoryPoints?.length) return [];

  let baseTotal;
  if (selectedDeveloper && Array.isArray(initialEffortByDevMemo) && initialEffortByDevMemo.length > 0) {
    const devEffort = initialEffortByDevMemo.find(
      (dev) => dev.assignee?.toLowerCase() === selectedDeveloper?.toLowerCase(),
    );
    if (devEffort) {
      baseTotal = burnupModePoints ? (devEffort.initialStoryPoints ?? 0) : (devEffort.initialOriginalEstimateHrs ?? 0);
    } else {
      baseTotal = 0;
    }
  } else {
    baseTotal = burnupModePoints ? initialStoryPoint : initialHours;
  }

  const lastBurnupDay = dailyBurnup?.[dailyBurnup.length - 1];
  const idealTarget = lastBurnupDay
    ? (burnupModePoints ? (Number(lastBurnupDay.idealLineSP) || 0) : (Number(lastBurnupDay.idealLineHrs) || 0))
    : (burnupModePoints ? baseTotal + (Number(spilloverStoryPoints) || 0) : baseTotal + (Number(spilloverHours) || 0));

  const { startDate, endDate } = actualStoryPoints[0]?.startDateEndDate || {};
  if (!startDate || !endDate) return [];
  const dateRange = generateDateRangeAllDays(startDate, endDate);

  const actualWorkData = dateRange.reduce((acc, date) => {
    acc[date] = { points: 0, hours: 0 };
    return acc;
  }, {});
  const actualWorkDataFromInitial = dateRange.reduce((acc, date) => {
    acc[date] = { points: 0, hours: 0 };
    return acc;
  }, {});
  const actualWorkDataFromAdded = dateRange.reduce((acc, date) => {
    acc[date] = { points: 0, hours: 0 };
    return acc;
  }, {});

  const hasIdealFromApi = dailyBurnup?.length > 0 && (dailyBurnup[0].idealLineSP !== undefined || dailyBurnup[0].idealLineHrs !== undefined);
  const idealByDate = {};
  if (hasIdealFromApi) {
    dailyBurnup.forEach((item) => {
      const d = item.issueCreatedAt != null ? String(item.issueCreatedAt).split('T')[0] : null;
      if (d) idealByDate[d] = item;
    });
  }

  if (dailyBurnup?.length > 0) {
    dailyBurnup.forEach((item) => {
      const creationDate = item.issueCreatedAt != null ? String(item.issueCreatedAt).split('T')[0] : null;
      if (!creationDate) return;
      if (!actualWorkData[creationDate]) actualWorkData[creationDate] = { points: 0, hours: 0 };
      actualWorkData[creationDate].points += Number.parseInt(item.storyPointsDone, 10) || 0;
      actualWorkData[creationDate].hours += Number.parseFloat(item.hoursDone) || 0;
      if (item.storyPointsDoneFromInitialScope !== undefined || item.hoursDoneFromInitialScope !== undefined) {
        if (!actualWorkDataFromInitial[creationDate]) actualWorkDataFromInitial[creationDate] = { points: 0, hours: 0 };
        actualWorkDataFromInitial[creationDate].points += Number.parseInt(item.storyPointsDoneFromInitialScope, 10) || 0;
        actualWorkDataFromInitial[creationDate].hours += Number.parseFloat(item.hoursDoneFromInitialScope) || 0;
      }
      if (item.storyPointsDoneFromAddedScope !== undefined || item.hoursDoneFromAddedScope !== undefined) {
        if (!actualWorkDataFromAdded[creationDate]) actualWorkDataFromAdded[creationDate] = { points: 0, hours: 0 };
        actualWorkDataFromAdded[creationDate].points += Number.parseInt(item.storyPointsDoneFromAddedScope, 10) || 0;
        actualWorkDataFromAdded[creationDate].hours += Number.parseFloat(item.hoursDoneFromAddedScope) || 0;
      }
    });
  } else {
    actualStoryPoints.forEach((story) => {
      const updateDate = story.issueUpdatedAt?.split('T')[0];
      if (updateDate && actualWorkData[updateDate]) {
        actualWorkData[updateDate].points += Number.parseInt(story.storyPoints, 10) || 0;
        actualWorkData[updateDate].hours += Number.parseFloat(story.timeSpentHrs) || 0;
      }
    });
  }

  const addedWorkByDate = {};
  const removedWorkByDate = {};
  const addedNewTicketsByDate = {};
  const estimationUpdatedByDate = {};
  const estimationIncreasedByDate = {};
  const estimationDecreasedByDate = {};
  const removedFromSprintByDate = {};
  const readdedToSprintByDate = {};
  const cumulativeWithEpicByDate = {};
  const cumulativeWithoutAddedByDate = {};
  const reopenedByDate = {};
  if (dailyBurnup?.length) {
    dailyBurnup.forEach((item) => {
      const creationDate = item.issueCreatedAt?.split('T')[0];
      if (creationDate) {
        if (item.completedWorkCumulativeSP !== undefined || item.completedWorkCumulativeHrs !== undefined) {
          cumulativeWithoutAddedByDate[creationDate] = {
            points: Number(item.completedWorkCumulativeSP) || 0,
            hours: Number(item.completedWorkCumulativeHrs) || 0,
          };
        }
        if (item.storyPointsReopened || item.hoursReopened) {
          reopenedByDate[creationDate] = {
            sp: Number(item.storyPointsReopened) || 0,
            hrs: Number(item.hoursReopened) || 0,
          };
        }
        if (item.storyPointsRemovedFromSprint || item.hoursRemovedFromSprint) {
          if (!removedFromSprintByDate[creationDate]) {
            removedFromSprintByDate[creationDate] = { sp: 0, hrs: 0 };
          }
          removedFromSprintByDate[creationDate].sp += Number(item.storyPointsRemovedFromSprint) || 0;
          removedFromSprintByDate[creationDate].hrs += Number(item.hoursRemovedFromSprint) || 0;
        }
        if (item.storyPointsReaddedToSprint || item.hoursReaddedToSprint) {
          if (!readdedToSprintByDate[creationDate]) {
            readdedToSprintByDate[creationDate] = { sp: 0, hrs: 0 };
          }
          readdedToSprintByDate[creationDate].sp += Number(item.storyPointsReaddedToSprint) || 0;
          readdedToSprintByDate[creationDate].hrs += Number(item.hoursReaddedToSprint) || 0;
        }
        if (showAddedWork) {
          if (!addedWorkByDate[creationDate]) {
            addedWorkByDate[creationDate] = { storyPointsAdded: 0, hoursAdded: 0 };
          }
          addedWorkByDate[creationDate].storyPointsAdded += Number(item.storyPointsAdded) || 0;
          addedWorkByDate[creationDate].hoursAdded += Number(item.hoursAdded) || 0;
          if (!addedNewTicketsByDate[creationDate]) {
            addedNewTicketsByDate[creationDate] = { sp: 0, hrs: 0 };
          }
          addedNewTicketsByDate[creationDate].sp += Number(item.storyPointsAddedNewTickets) || 0;
          addedNewTicketsByDate[creationDate].hrs += Number(item.hoursAddedNewTickets) || 0;
          if (!estimationUpdatedByDate[creationDate]) {
            estimationUpdatedByDate[creationDate] = { sp: 0, hrs: 0 };
          }
          estimationUpdatedByDate[creationDate].sp += Number(item.estimationUpdatedSP) || 0;
          estimationUpdatedByDate[creationDate].hrs += Number(item.estimationUpdatedHrs) || 0;
          if (!estimationIncreasedByDate[creationDate]) {
            estimationIncreasedByDate[creationDate] = { sp: 0, hrs: 0 };
          }
          estimationIncreasedByDate[creationDate].sp += Number(item.estimationIncreasedSP) || 0;
          estimationIncreasedByDate[creationDate].hrs += Number(item.estimationIncreasedHrs) || 0;
          if (!estimationDecreasedByDate[creationDate]) {
            estimationDecreasedByDate[creationDate] = { sp: 0, hrs: 0 };
          }
          estimationDecreasedByDate[creationDate].sp += Number(item.estimationDecreasedSP) || 0;
          estimationDecreasedByDate[creationDate].hrs += Number(item.estimationDecreasedHrs) || 0;
          if (item.storyPointsRemoved !== undefined || item.hoursRemoved !== undefined) {
            if (!removedWorkByDate[creationDate]) {
              removedWorkByDate[creationDate] = { storyPointsRemoved: 0, hoursRemoved: 0 };
            }
            removedWorkByDate[creationDate].storyPointsRemoved += Number(item.storyPointsRemoved) || 0;
            removedWorkByDate[creationDate].hoursRemoved += Number(item.hoursRemoved) || 0;
          }
          if (item.completedWorkCumulativeSPWithEpic !== undefined || item.completedWorkCumulativeHrsWithEpic !== undefined) {
            cumulativeWithEpicByDate[creationDate] = {
              points: Number(item.completedWorkCumulativeSPWithEpic) || 0,
              hours: Number(item.completedWorkCumulativeHrsWithEpic) || 0,
            };
          }
        }
      }
    });
  }

  let displayDates = [];
  const workingDates = generateDateRange(startDate, endDate);

  if (mode === 'release') {
    const totalDays = workingDates.length;
    const dynamicInterval = Math.max(1, Math.ceil(totalDays / (targetPointsConst ?? targetPoints)));
    const start = new Date(workingDates[0]);
    displayDates = workingDates.filter((date) => {
      const curr = new Date(date);
      const diffDays = Math.floor((curr - start) / (1000 * 60 * 60 * 24));
      return diffDays % dynamicInterval === 0;
    });
    const lastDate = workingDates[workingDates.length - 1];
    if (!displayDates.includes(lastDate)) displayDates.push(lastDate);
  } else {
    if (mode === 'sprint') {
      displayDates = dateRange.length > 15
        ? dateRange.filter((_, index) => index % 2 === 0)
        : dateRange;
      const lastDate = dateRange[dateRange.length - 1];
      if (dateRange.length > 15 && !displayDates.includes(lastDate)) displayDates.push(lastDate);
    }
  }

  const cumulativeMap = {};
  const cumulativeFromInitialMap = {};
  const cumulativeFromAddedMap = {};
  let pointsCumulative = 0;
  let hoursCumulative = 0;
  let pointsFromInitialCumulative = 0;
  let hoursFromInitialCumulative = 0;
  let pointsFromAddedCumulative = 0;
  let hoursFromAddedCumulative = 0;
  dateRange.forEach((date) => {
    pointsCumulative += actualWorkData[date]?.points || 0;
    hoursCumulative += actualWorkData[date]?.hours || 0;
    cumulativeMap[date] = { points: pointsCumulative, hours: hoursCumulative };
    pointsFromInitialCumulative += actualWorkDataFromInitial[date]?.points || 0;
    hoursFromInitialCumulative += actualWorkDataFromInitial[date]?.hours || 0;
    cumulativeFromInitialMap[date] = { points: pointsFromInitialCumulative, hours: hoursFromInitialCumulative };
    pointsFromAddedCumulative += actualWorkDataFromAdded[date]?.points || 0;
    hoursFromAddedCumulative += actualWorkDataFromAdded[date]?.hours || 0;
    cumulativeFromAddedMap[date] = { points: pointsFromAddedCumulative, hours: hoursFromAddedCumulative };
  });

  const hasFromInitialData = Object.keys(actualWorkDataFromInitial).some((d) => (actualWorkDataFromInitial[d]?.points || 0) + (actualWorkDataFromInitial[d]?.hours || 0) > 0);

  const idealMap = buildWorkingDayIdeal(dateRange, idealTarget);

  const result = displayDates.map((date) => {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    const shouldShowNull =
      new Date(date) > new Date(todayString) ||
      (lastLoggedDate && new Date(date) > new Date(lastLoggedDate));
    const hasCumulativeWithoutAdded = Object.keys(cumulativeWithoutAddedByDate).length > 0;
    const apiDay = idealByDate[date];
    const weekend = isWeekend(date);

    let actual;
    const roundedIdeal = idealMap[date] ?? 0;

    if (showAddedWork && hasIdealFromApi && apiDay) {
      const scopeValue = burnupModePoints ? apiDay.idealLineSP : apiDay.idealLineHrs;
      actual = shouldShowNull ? null : (typeof scopeValue === 'number' && !Number.isNaN(scopeValue) ? scopeValue : 0);
    } else if (showAddedWork) {
      actual = shouldShowNull ? null : 0;
    } else {
      const cumulativeActual = hasCumulativeWithoutAdded && cumulativeWithoutAddedByDate[date]
        ? cumulativeWithoutAddedByDate[date]
        : (hasFromInitialData ? cumulativeFromInitialMap[date] : cumulativeMap[date]);
      actual = shouldShowNull
        ? null
        : burnupModePoints ? (cumulativeActual?.points ?? 0) : (cumulativeActual?.hours ?? 0);
    }

    let workAdded = 0;
    let workRemoved = 0;
    if (showAddedWork && addedWorkByDate[date]) {
      workAdded = burnupModePoints ? addedWorkByDate[date].storyPointsAdded : addedWorkByDate[date].hoursAdded;
    }
    if (showAddedWork && removedWorkByDate[date]) {
      workRemoved = burnupModePoints ? removedWorkByDate[date].storyPointsRemoved : removedWorkByDate[date].hoursRemoved;
    }
    const workAddedNewTickets = (showAddedWork && addedNewTicketsByDate[date])
      ? (burnupModePoints ? addedNewTicketsByDate[date].sp : addedNewTicketsByDate[date].hrs)
      : 0;
    const estimationUpdated = (showAddedWork && estimationUpdatedByDate[date])
      ? (burnupModePoints ? estimationUpdatedByDate[date].sp : estimationUpdatedByDate[date].hrs)
      : 0;
    const estimationIncreased = (showAddedWork && estimationIncreasedByDate[date])
      ? (burnupModePoints ? estimationIncreasedByDate[date].sp : estimationIncreasedByDate[date].hrs)
      : 0;
    const estimationDecreased = (showAddedWork && estimationDecreasedByDate[date])
      ? (burnupModePoints ? estimationDecreasedByDate[date].sp : estimationDecreasedByDate[date].hrs)
      : 0;
    const workRemovedFromSprint = removedFromSprintByDate[date]
      ? (burnupModePoints ? removedFromSprintByDate[date].sp : removedFromSprintByDate[date].hrs)
      : 0;
    const issueReaddedToSprint = readdedToSprintByDate[date]
      ? (burnupModePoints ? readdedToSprintByDate[date].sp : readdedToSprintByDate[date].hrs)
      : 0;
    const issueReopened = reopenedByDate[date]
      ? (burnupModePoints ? reopenedByDate[date].sp : reopenedByDate[date].hrs)
      : 0;
    const [, month, day] = date.split('-');
    return {
      day: `${month}/${day}`,
      date,
      ideal: roundedIdeal,
      actual,
      isWeekend: weekend,
      workAdded,
      workRemoved,
      workAddedNewTickets,
      estimationUpdated,
      estimationIncreased,
      estimationDecreased,
      workRemovedFromSprint,
      issueReaddedToSprint,
      issueReopened,
    };
  });

  return result;
}

const BurnupChart = ({
  dailyBurnup,
  actualStory,
  showAddedWork,
  onShowAddedWorkChange,
  burnupModePoints,
  onBurnupModePointsChange,
  pointsSourceType,
  initialStoryPoint,
  initialHours,
  selectedDeveloper,
  initialEffortByDevMemo,
  spilloverStoryPoints,
  spilloverHours,
  lastLoggedDate,
  theme,
  isHoursBasedProject = false,
}) => {
  const chartData = useMemo(
    () => {
      const data = processBurnupData({
        actualStory,
        dailyBurnup,
        showAddedWork,
        burnupModePoints,
        selectedDeveloper,
        initialEffortByDevMemo: initialEffortByDevMemo || [],
        initialStoryPoint: initialStoryPoint ?? 0,
        initialHours: initialHours ?? 0,
        spilloverStoryPoints,
        spilloverHours,
        lastLoggedDate,
        targetPoints: targetPoints,
      });
      if (data && data.length > 0) {
        return [
          { day: '', date: '', ideal: 0, actual: 0, isWeekend: false, workAdded: 0, workRemoved: 0 },
          ...data,
        ];
      }
      return data;
    },
    [
      actualStory,
      dailyBurnup,
      showAddedWork,
      burnupModePoints,
      selectedDeveloper,
      initialEffortByDevMemo,
      initialStoryPoint,
      initialHours,
      spilloverStoryPoints,
      spilloverHours,
      lastLoggedDate,
    ],
  );
  const pointsLabel = pointsSourceType === 'effort' ? 'Effort' : 'SP';

  const weekendBands = useMemo(() => {
    if (!chartData || chartData.length < 2) return [];
    const bands = [];
    let bandStart = null;
    let prevWorkingDay = null;
    for (let i = 1; i < chartData.length; i++) {
      const pt = chartData[i];
      if (pt.isWeekend) {
        if (bandStart === null) {
          bandStart = prevWorkingDay || pt.day;
        }
      } else {
        if (bandStart !== null) {
          bands.push({ x1: bandStart, x2: chartData[i - 1].day });
          bandStart = null;
        }
        prevWorkingDay = pt.day;
      }
    }
    if (bandStart !== null) {
      bands.push({ x1: bandStart, x2: chartData[chartData.length - 1].day });
    }
    return bands;
  }, [chartData]);

  return (
    <div className="p-0 bg-[#FFFFFF] basis-[300px] flex-grow dark:bg-[#182433] dark:text-[#C8C8C8] text-black rounded-[10px] shadow-[0_1px_20px_0_rgba(0,0,0,0.1)] dark:shadow-md border border-[#E5E5E5] dark:border-[#25384F] min-w-[340px] h-[297px] overflow-hidden">
      <div className="flex justify-between items-center px-2 pt-2">
        <div className="flex items-center gap-1 min-w-0">
          <h3 className="text-lg text-[#0A2342] dark:text-white shrink-0">Burnup</h3>
          <div className="relative group shrink-0">
            <TooltipIcon
              title="StandupBurnup"
              tooltip="Cumulative completed work vs. the ideal progress across <br /> the sprint timeline  (Can switch to added-work view)"
              theme={theme}
              placement="top-start"
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <DropdownButton
            placeholder="Select Mode"
            options={[
              { label: 'With added-work', value: 'With added-work' },
              { label: 'Without added-work', value: 'Without added-work' },
            ]}
            selectedOption={showAddedWork ? 'With added-work' : 'Without added-work'}
            onSelect={(option) => onShowAddedWorkChange(option.value === 'With added-work')}
            width="smd"
            height="xs"
            textSize="xs"
            type="default"
            showSearch={false}
          />
          <div className="inline-flex items-center bg-transparent dark:bg-[#242B34] rounded-full p-0.5 border border-[#E5E5E5] dark:border-[#101010]  ">
            <button
              type="button"
              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                burnupModePoints
                  ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                  : 'text-[#24527A] dark:text-gray-500'
              }`}
              onClick={() => onBurnupModePointsChange(true)}
              disabled={isHoursBasedProject}
            >
              {pointsLabel}
            </button>
            <button
              type="button"
              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                !burnupModePoints
                  ? 'dark:bg-[#066FD1] bg-[#24527A] text-white'
                  : 'text-[#24527A] dark:text-gray-500'
              }`}
              onClick={() => onBurnupModePointsChange(false)}
              disabled={!isHoursBasedProject}
            >
              Hrs
            </button>
          </div>
        </div>
      </div>
      <div
        className={`w-full h-[236px] overflow-x-auto scrollbar-track-transparent ${
          theme === 'light' ? 'scrollbar-super-thin-lightMode' : 'scrollbar-super-thin'
        }`}
      >
        <div className="min-w-[600px] h-[236px]">
          {chartData && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={236}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 30, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="5 5"
                  stroke={theme === 'light' ? '#BBCFE6' : '#2d3e52'}
                  horizontal
                  vertical
                />
                {weekendBands.map((band) => (
                  <ReferenceArea
                    key={`weekend-${band.x1}`}
                    x1={band.x1}
                    x2={band.x2}
                    fill={theme === 'light' ? '#E8EDF2' : '#1e2d3d'}
                    fillOpacity={0.6}
                    ifOverflow="extendDomain"
                  />
                ))}
                <XAxis
                  dataKey="day"
                  stroke={theme === 'light' ? '#24527A' : '#e1def5e6'}
                  tick={{ fontSize: '11px' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tickFormatter={(value, index) => (index === 0 ? '' : value)}
                />
                <YAxis
                  stroke={theme === 'light' ? '#24527A' : '#e1def5e6'}
                  tick={{ fontSize: '11px' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => (burnupModePoints ? Math.round(Number(value)) : Number(value).toFixed(1))}
                />
                <Tooltip
                  content={
                    <CustomBurnupTooltip
                      showAddedWork={showAddedWork}
                    />
                  }
                />
                <Line
                  type="linear"
                  dataKey="ideal"
                  stroke="#F59F12"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke={theme === 'light' ? '#0077E6' : '#066FD1'}
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div
        className={`flex justify-center items-center flex-wrap gap-x-4 gap-y-1 px-2 text-xs ${
          theme === 'light' ? 'text-[#24527A]' : 'text-[#A3B1C9]'
        }`}
      >
        <div className="flex items-center">
          <span
            className="w-3 h-3 rounded-full inline-block mr-2"
            style={{ backgroundColor: '#F59F12' }}
          />
          Ideal
        </div>
        <div className="flex items-center">
          <span
            className="w-3 h-3 rounded-full inline-block mr-2"
            style={{ backgroundColor: '#066FD1' }}
          />
          Actual
        </div>
      </div>
    </div>
  );
};

BurnupChart.propTypes = {
  dailyBurnup: PropTypes.array,
  actualStory: PropTypes.object,
  showAddedWork: PropTypes.bool,
  onShowAddedWorkChange: PropTypes.func.isRequired,
  burnupModePoints: PropTypes.bool,
  onBurnupModePointsChange: PropTypes.func.isRequired,
  pointsSourceType: PropTypes.string,
  initialStoryPoint: PropTypes.number,
  initialHours: PropTypes.number,
  selectedDeveloper: PropTypes.string,
  initialEffortByDevMemo: PropTypes.array,
  spilloverStoryPoints: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  spilloverHours: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  lastLoggedDate: PropTypes.string,
  theme: PropTypes.string,
  isHoursBasedProject: PropTypes.bool,
};

export default BurnupChart;
