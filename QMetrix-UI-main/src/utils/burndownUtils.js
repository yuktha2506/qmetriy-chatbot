import { targetPoints } from '../constants';

export const generateDateRange = (startDate, endDate) => {
  const dates = [];
  const currentDate = new Date(startDate);
  const lastDate = new Date(endDate);

  while (currentDate <= lastDate) {
    const dayOfWeek = currentDate.getDay();
    // Exclude weekends (Saturday = 6, Sunday = 0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(currentDate.toISOString().split('T')[0]);
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
};

export const processBurndownData = ({
  burndowndata,
  actualStory,
  isStoryPoints,
  jiraData,
  selectedDeveloper = null,
  getCapacity = 0,
  lastLoggedDate = null,
}) => {
  if (!burndowndata || !actualStory?.actualStoryPoints?.length) return [];

  const { actualStoryPoints = [], mode = 'sprint' } = actualStory;
  const totalWork = isStoryPoints
    ? burndowndata?.originalEstimate
    : burndowndata?.originalEstimateHrs;
  const { startDate, endDate } = actualStoryPoints[0]?.startDateEndDate || {};

  if (!startDate || !endDate) return [];

  const workingDates = generateDateRange(startDate, endDate);
  const processedData = workingDates.reduce((acc, date) => {
    acc[date] = { points: 0, hours: 0 };
    return acc;
  }, {});

  // Track work by date - actualStoryPoints contains entries from worklogs and closed tickets
  // Worklog entries: timeSpentHrs > 0, issueUpdatedAt = worklog date (when work was done)
  // Closed ticket entries: storyPoints > 0, timeSpentHrs = 0, issueUpdatedAt = close date
  // CRITICAL: For closed tickets, we need to use worklogs to show progression, not close dates

  // First pass: collect ALL entries and analyze
  const worklogEntries = [];
  const closedTicketEntries = [];
  let totalClosedPoints = 0;
  let totalWorklogHours = 0;

  actualStoryPoints.forEach((curr) => {
    const updateDate = curr.issueUpdatedAt?.split('T')[0];
    const points = Number.parseInt(curr.storyPoints, 10) || 0;
    const hours = Number.parseFloat(curr.timeSpentHrs) || 0;

    if (hours > 0) {
      // This is a worklog entry - shows when work was actually done
      worklogEntries.push({ date: updateDate, hours, points });
      totalWorklogHours += hours;
    } else if (points > 0) {
      // This is a closed ticket entry - shows when ticket was closed
      // NOTE: Closed tickets should have worklogs, but if they don't, we'll handle it
      closedTicketEntries.push({ date: updateDate, points });
      totalClosedPoints += points;
    }
  });


  // For story points mode: ALWAYS prioritize worklogs for progression
  if (isStoryPoints) {
    if (worklogEntries.length > 0 && totalWorklogHours > 0) {
      // We have worklogs - use them to show progression
      // Distribute closed story points proportionally based on worklog hours
      worklogEntries.forEach((entry) => {
        const date = entry.date;
        if (date && processedData[date]) {
          // Calculate proportion of total work done on this date
          const proportion = entry.hours / totalWorklogHours;
          // Distribute ALL closed story points proportionally
          const distributedPoints = totalClosedPoints * proportion;
          processedData[date].points += distributedPoints;
          processedData[date].hours += entry.hours;
        } else if (date) {
          // Date is outside sprint range - add to nearest date or first date
          const firstDate = workingDates[0];
          if (processedData[firstDate]) {
            const proportion = entry.hours / totalWorklogHours;
            const distributedPoints = totalClosedPoints * proportion;
            processedData[firstDate].points += distributedPoints;
          }
        }
      });
    } else if (closedTicketEntries.length > 0) {
      // NO WORKLOGS - Closed tickets exist but no worklogs
      // Need to create a downward progression showing work being done over time
      console.warn(
        '⚠️ No worklogs found for closed tickets - distributing progressively to show burndown',
      );

      // Group closed tickets by their close date
      const closedByDate = {};
      closedTicketEntries.forEach((entry) => {
        const date = entry.date;
        if (!closedByDate[date]) {
          closedByDate[date] = 0;
        }
        closedByDate[date] += entry.points;
      });

      // Get unique close dates sorted
      const sortedCloseDates = Object.keys(closedByDate).sort((a, b) => new Date(a) - new Date(b));

      // Strategy: Distribute work progressively from sprint start to close date
      // For each ticket, distribute its points across days from start to close date
      // This creates a natural downward progression
      sortedCloseDates.forEach((closeDate) => {
        const points = closedByDate[closeDate];
        const closeDateIndex = workingDates.indexOf(closeDate);

        if (closeDateIndex >= 0 && processedData[closeDate]) {
          // Ticket closed within sprint - distribute work from start to close date
          // Use progressive distribution: more work early, less later
          const daysToClose = closeDateIndex + 1;
          let remainingPoints = points;
          const distribution = [];

          for (let i = 0; i < daysToClose; i++) {
            const date = workingDates[i];
            if (processedData[date]) {
              // Calculate weight: more work in early days (decreasing weight)
              const progress = i / (daysToClose - 1); // 0 to 1
              const weight = 1 - progress * 0.6; // Start at 1.0, end at 0.4

              // Distribute points based on weight
              const pointsForDay = (points * weight) / daysToClose;
              processedData[date].points += pointsForDay;
              remainingPoints -= pointsForDay;

              distribution.push({
                date,
                dayIndex: i,
                progress,
                weight: weight.toFixed(3),
                pointsForDay: pointsForDay.toFixed(3),
                cumulativePoints: processedData[date].points.toFixed(3),
              });
            }
          }


          // Adjust to ensure total points match (handle rounding)
          if (Math.abs(remainingPoints) > 0.01) {
            const lastDate = workingDates[closeDateIndex];
            if (processedData[lastDate]) {
              processedData[lastDate].points += remainingPoints;
            }
          }
        } else {
          // Close date is outside sprint or not found - distribute across entire sprint
          // Use progressive distribution: more work early, less later
          const totalDays = workingDates.length;
          let remainingPoints = points;
          const distribution = [];

          workingDates.forEach((date, index) => {
            if (processedData[date]) {
              // Calculate weight: more work in early days
              const progress = index / (totalDays - 1); // 0 to 1
              const weight = 1 - progress * 0.6; // Start at 1.0, end at 0.4

              // Distribute points based on weight
              const pointsForDay = (points * weight) / totalDays;
              processedData[date].points += pointsForDay;
              remainingPoints -= pointsForDay;

              if (index < 3 || index >= totalDays - 3) {
                distribution.push({
                  date,
                  dayIndex: index,
                  progress: progress.toFixed(3),
                  weight: weight.toFixed(3),
                  pointsForDay: pointsForDay.toFixed(3),
                  cumulativePoints: processedData[date].points.toFixed(3),
                });
              }
            }
          });


          // Adjust last day to account for rounding
          if (Math.abs(remainingPoints) > 0.01 && workingDates.length > 0) {
            const lastDate = workingDates[workingDates.length - 1];
            if (processedData[lastDate]) {
              processedData[lastDate].points += remainingPoints;
            }
          }
        }
      });
    }
  } else {
    // Hours mode: use worklog hours directly
    worklogEntries.forEach((entry) => {
      const date = entry.date;
      if (date && processedData[date]) {
        processedData[date].hours += entry.hours;
      } else if (date) {
        // Date outside sprint range - add to first date
        const firstDate = workingDates[0];
        if (processedData[firstDate]) {
          processedData[firstDate].hours += entry.hours;
        }
      }
    });

    // If no worklogs but tickets are closed, we can't accurately show hours progression
    // But we should still show something
    if (worklogEntries.length === 0 && closedTicketEntries.length > 0) {
      console.warn('⚠️ No worklogs in hours mode - cannot show accurate progression');
    }
  }

  // Calculate cumulative work spent and remaining work
  // Start with total work on first date
  if (workingDates.length > 0) {
    const firstDate = workingDates[0];
    processedData[firstDate].remaining = totalWork;
  }

  // Calculate remaining work for each date based on cumulative work spent
  let cumulativeWorkSpent = 0;
  const actualLineData = [];

  for (let i = 0; i < workingDates.length; i++) {
    const date = workingDates[i];
    const value = isStoryPoints
      ? processedData[date]?.points || 0
      : processedData[date]?.hours || 0;

    // Accumulate work spent over time (work done on this date)
    cumulativeWorkSpent += value;

    // Remaining work = total - cumulative spent
    // This shows how much work is left after work done up to this date
    const remaining = Math.max(0, totalWork - cumulativeWorkSpent);
    processedData[date].remaining = remaining;

    // Track for console log (sample first few, middle, and last few)
    if (i < 3 || i === Math.floor(workingDates.length / 2) || i >= workingDates.length - 3) {
      actualLineData.push({
        date,
        dayIndex: i,
        workDoneToday: value.toFixed(3),
        cumulativeWorkSpent: cumulativeWorkSpent.toFixed(3),
        remaining: remaining.toFixed(3),
      });
    }
  }


  let displayDates = [];

  if (mode === 'release') {
    const totalDays = workingDates.length;
    const dynamicInterval = Math.max(1, Math.ceil(totalDays / targetPoints));
    const start = new Date(workingDates[0]);

    displayDates = workingDates.filter((date) => {
      const curr = new Date(date);
      const diffDays = Math.floor((curr - start) / (1000 * 60 * 60 * 24));
      return diffDays % dynamicInterval === 0;
    });

    const lastDate = workingDates[workingDates.length - 1];
    if (!displayDates.includes(lastDate)) {
      displayDates.push(lastDate);
    }
  } else {
    if (mode === 'sprint') {
      if (workingDates.length > 15) {
        displayDates = workingDates.filter((_, index) => index % 2 === 0);
        const lastDate = workingDates[workingDates.length - 1];
        if (!displayDates.includes(lastDate)) {
          displayDates.push(lastDate);
        }
      } else {
        displayDates = workingDates;
      }
    }
  }

  // Calculate ideal line based on full date range, not just display dates
  // This ensures a straight line even when display dates are skipped
  const totalSegments = workingDates.length - 1 || 1;
  const perStep = totalWork / totalSegments;

  const idealLine = displayDates.map((date) => {
    // Find the position of this date in the full workingDates array
    const dateIndex = workingDates.indexOf(date);

    // If date not found or is the last date, return 0
    if (dateIndex === -1 || dateIndex === workingDates.length - 1) {
      return 0;
    }

    // Calculate ideal value based on position in full date range
    const idealValue = totalWork - dateIndex * perStep;
    return Number.parseFloat(Math.max(0, idealValue).toFixed(2));
  });

  const currentData = jiraData?.Sprint ?? jiraData?.Release;
  const assigneesList = currentData?.assignees || [];
  const isHoursMode = currentData?.hours ?? false;
  const shouldShowCapacity = isStoryPoints !== isHoursMode;
  const allNetAvailableZeroOrMissing = assigneesList.every(
    (item) =>
      item.netAvailableCapacity === undefined ||
      item.netAvailableCapacity === null ||
      item.netAvailableCapacity === 0,
  );

  const baseCapacity = selectedDeveloper
    ? (() => {
      const dev = assigneesList.find((a) => a.assignee === selectedDeveloper);
      if (!dev) return 0;
      return allNetAvailableZeroOrMissing
        ? Number(dev.availableHours || 0)
        : Number(dev.netAvailableCapacity || 0);
    })()
    : getCapacity;

  // Calculate capacity line based on full date range for straight line
  const totalSegmentsCapacity = workingDates.length - 1 || 1;
  const perStepCapacity = baseCapacity / totalSegmentsCapacity;
  let capacityLine = [];

  if (shouldShowCapacity) {
    capacityLine = displayDates.map((date) => {
      // Find the position of this date in the full workingDates array
      const dateIndex = workingDates.indexOf(date);

      // If date not found or is the last date, return 0
      if (dateIndex === -1 || dateIndex === workingDates.length - 1) {
        return 0;
      }

      // Calculate capacity value based on position in full date range
      const capacityValue = baseCapacity - dateIndex * perStepCapacity;
      return Number.parseFloat(Math.max(0, capacityValue).toFixed(2));
    });
  }

  const chartData = displayDates.map((date, index) => {
    const [, month, day] = date.split('-');

    // Get today's date in YYYY-MM-DD format for consistent comparison
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    // Check if date is after today OR after lastLoggedDate
    const shouldShowNull =
      new Date(date) > new Date(todayString) ||
      (lastLoggedDate && new Date(date) > new Date(lastLoggedDate));

    const actual = shouldShowNull ? null : processedData[date]?.remaining ?? null;

    return {
      day: `${month}/${day}`,
      ideal: idealLine[index],
      actual,
      capacity: shouldShowCapacity ? capacityLine[index] : null,
    };
  });

  // Final summary log showing the actual line data that will be rendered

  return chartData;
};

export const processNewBurndownData = ({
  burndownData,
  isStoryPoints,
  jiraData,
  selectedDeveloper = null,
  getCapacity = 0,
  lastLoggedDate = null,
}) => {

  if (
    !burndownData ||
    !burndownData.dailyData ||
    !Array.isArray(burndownData.dailyData) ||
    burndownData.dailyData.length === 0
  ) {
    return [];
  }

  const { dailyData, startDate, endDate, mode = 'sprint' } = burndownData;


  if (!startDate || !endDate) {
    return [];
  }

  const workingDates = dailyData
    .map((item) => item?.date)
    .filter((date) => {
      if (!date) return false;
      const dayOfWeek = new Date(date).getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6;
    });

  if (workingDates.length === 0) return [];

  let displayDates = [];

  if (mode === 'release') {
    const totalDays = workingDates.length;
    const dynamicInterval = Math.max(1, Math.ceil(totalDays / targetPoints));
    const start = new Date(workingDates[0]);

    displayDates = workingDates.filter((date) => {
      const curr = new Date(date);
      const diffDays = Math.floor((curr - start) / (1000 * 60 * 60 * 24));
      return diffDays % dynamicInterval === 0;
    });

    const lastDate = workingDates[workingDates.length - 1];
    if (!displayDates.includes(lastDate)) {
      displayDates.push(lastDate);
    }
  } else {
    if (workingDates.length > 15) {
      displayDates = workingDates.filter((_, index) => index % 2 === 0);
      const lastDate = workingDates[workingDates.length - 1];
      if (!displayDates.includes(lastDate)) {
        displayDates.push(lastDate);
      }
    } else {
      displayDates = workingDates;
    }
  }

  const dailyDataMap = new Map();
  dailyData.forEach((item) => {
    if (item?.date) {
      dailyDataMap.set(item.date, item);
    }
  });

  // Log actual line data from API - show ALL dates

  const currentData = jiraData?.Sprint ?? jiraData?.Release;
  const assigneesList = currentData?.assignees || [];
  const isHoursMode = currentData?.hours ?? false;
  const shouldShowCapacity = isStoryPoints !== isHoursMode;
  const allNetAvailableZeroOrMissing = assigneesList.every(
    (item) =>
      item.netAvailableCapacity === undefined ||
      item.netAvailableCapacity === null ||
      item.netAvailableCapacity === 0,
  );

  const baseCapacity = selectedDeveloper
    ? (() => {
      const dev = assigneesList.find((a) => a.assignee === selectedDeveloper);
      if (!dev) return 0;
      return allNetAvailableZeroOrMissing
        ? Number(dev.availableHours || 0)
        : Number(dev.netAvailableCapacity || 0);
    })()
    : getCapacity;

  // Calculate capacity line based on full date range for straight line
  const totalSegmentsCapacity = workingDates.length - 1 || 1;
  const perStepCapacity = baseCapacity / totalSegmentsCapacity;
  let capacityLine = [];

  if (shouldShowCapacity) {
    capacityLine = displayDates.map((date) => {
      // Find the position of this date in the full workingDates array
      const dateIndex = workingDates.indexOf(date);

      // If date not found or is the last date, return 0
      if (dateIndex === -1 || dateIndex === workingDates.length - 1) {
        return 0;
      }

      // Calculate capacity value based on position in full date range
      const capacityValue = baseCapacity - dateIndex * perStepCapacity;
      return Number.parseFloat(Math.max(0, capacityValue).toFixed(2));
    });
  }

  let developerOriginalEstimate = null;
  let developerDailyEffort = new Map();
  let developerDataExists = false;

  if (selectedDeveloper) {
    const dayWithDevData = dailyData.find(
      (day) =>
        day?.date &&
        day.developerData &&
        day.developerData.some((dev) => dev.developer === selectedDeveloper),
    );
    if (dayWithDevData && dayWithDevData.developerData) {
      const devData = dayWithDevData.developerData.find(
        (dev) => dev.developer === selectedDeveloper,
      );
      if (devData) {
        developerOriginalEstimate = devData.originalEstimate || 0;
        developerDataExists = true;
      }
    }

    dailyData.forEach((day) => {
      if (day?.date && day.developerData) {
        const devData = day.developerData.find((dev) => dev.developer === selectedDeveloper);
        if (devData) {
          developerDailyEffort.set(day.date, devData.effortSpent || 0);
        }
      }
    });
  }

  const today = new Date();
  const todayString = today.toISOString().split('T')[0];

  const result = displayDates
    .filter((date) => date)
    .map((date) => {
      if (!date) return null;

      const dateParts = date.split('-');
      if (dateParts.length < 3) return null;

      const [, month, day] = dateParts;
      const dailyItem = dailyDataMap.get(date);

      const shouldShowNull =
        new Date(date) > new Date(todayString) ||
        (lastLoggedDate && new Date(date) > new Date(lastLoggedDate));

      let actual = null;
      let ideal = 0;

      // Use developer-specific data if developer is selected AND developer data exists
      // (even if originalEstimate is 0)
      if (
        selectedDeveloper &&
        developerDataExists &&
        developerOriginalEstimate !== null
      ) {
        const developerCumulativeEffort = developerDailyEffort.get(date) || 0;
        actual = shouldShowNull
          ? null
          : Math.max(0, developerOriginalEstimate - developerCumulativeEffort);

        // Calculate ideal line based on full date range for straight line
        const totalSegmentsDev = workingDates.length - 1 || 1;
        const perStepDev = developerOriginalEstimate / totalSegmentsDev;
        const dateIndexInFullRange = workingDates.indexOf(date);

        // Ensure the last point is exactly 0
        if (dateIndexInFullRange === -1 || dateIndexInFullRange === workingDates.length - 1) {
          ideal = 0;
        } else {
          const idealValue = developerOriginalEstimate - dateIndexInFullRange * perStepDev;
          ideal = Number.parseFloat(Math.max(0, idealValue).toFixed(2));
        }
      } else if (selectedDeveloper && !developerDataExists) {
        actual = shouldShowNull ? null : 0;
        ideal = 0;
      } else {
        actual = shouldShowNull ? null : dailyItem?.actualLine ?? null;
        // Always recalculate ideal line based on working days for straight line
        // This ensures consistency even when API uses calendar days
        const totalSegmentsApi = workingDates.length - 1 || 1;
        const totalWorkApi = dailyItem?.totalOriginalEstimate || 0;
        const perStepApi = totalWorkApi / totalSegmentsApi;
        const dateIndexInFullRange = workingDates.indexOf(date);
        const isLastDate = dateIndexInFullRange === workingDates.length - 1;

        // Ensure ideal line reaches 0 at the end date
        if (dateIndexInFullRange === -1 || isLastDate) {
          ideal = 0;
        } else {
          // Calculate based on position in working days range for straight line
          const idealValue = totalWorkApi - dateIndexInFullRange * perStepApi;
          ideal = Number.parseFloat(Math.max(0, idealValue).toFixed(2));
        }

        // Note: API handles setting actual line to 0 only when all tickets are closed
        // UI should trust API calculation - don't force to 0 on last date
        // If actual line shows remaining points, that means not all tickets are closed

        // Log actual line values for debugging
        if (
          displayDates.indexOf(date) < 3 ||
          displayDates.indexOf(date) >= displayDates.length - 3
        ) {
          //log actual line values for debugging
        }
      }

      return {
        day: `${month}/${day}`,
        ideal,
        actual,
        capacity: shouldShowCapacity ? capacityLine[displayDates.indexOf(date)] : null,
      };
    })
    .filter((item) => item !== null);

if (result.length > 0) {
  const first = result[0];

  result.unshift({
    day: first.day,          
    ideal: first.ideal,     
    actual: first.ideal,     
    capacity: first.capacity
  });
}
  return result;
};

export const processReleaseBurndownData = (burndownData) => {
  if (!burndownData || !burndownData.sprintBreakdown || !Array.isArray(burndownData.sprintBreakdown)) {
    return [];
  }

  const { originalEstimateAtStart = 0, completed = 0, sprintBreakdown = [], workForecast: rawWorkForecast } = burndownData;
  // Support both camelCase and snake_case from API
  const workForecast = rawWorkForecast
    ? {
        sprintsRemaining: Number(rawWorkForecast.sprintsRemaining ?? rawWorkForecast.sprints_remaining ?? 0),
        averageVelocity: Number(rawWorkForecast.averageVelocity ?? rawWorkForecast.average_velocity ?? 0),
        remainingWork: Number(rawWorkForecast.remainingWork ?? rawWorkForecast.remaining_work ?? 0),
      }
    : null;
  const chartData = [];
  const workCompletedAtStart = completed || 0;

  chartData.push({
    sprintName: 'Original estimate at start of version',
    dateRange: null,
    state: 'initial',
    workCompleted: workCompletedAtStart,
    workAdded: 0,
    workRemoved: 0,
    workRemaining: 0,
    workForecast: 0,
    atStartOfSprint: originalEstimateAtStart,
    addedToVersion: 0,
    removedFromVersion: 0,
    completed: workCompletedAtStart,
    remaining: originalEstimateAtStart - workCompletedAtStart,
  });

  sprintBreakdown.forEach((sprint) => {
    const {
      sprintName,
      sprintStartDate,
      sprintEndDate,
      state,
      atStartOfSprint,
      addedToVersion,
      removedFromVersion,
      completed,
      remaining,
    } = sprint;

    const startDate = sprintStartDate?.$date 
      ? new Date(sprintStartDate.$date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : sprintStartDate
      ? new Date(sprintStartDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : null;
    const endDate = sprintEndDate?.$date
      ? new Date(sprintEndDate.$date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : sprintEndDate
      ? new Date(sprintEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : null;
    const dateRange = startDate && endDate ? `${startDate} - ${endDate}` : null;

    chartData.push({
      sprintName: state === 'active' ? `${sprintName} (active)` : sprintName,
      dateRange,
      state,
      workCompleted: completed || 0,
      workRemaining: remaining || 0,
      workAdded: addedToVersion || 0,
      workRemoved: removedFromVersion || 0,
      workForecast: 0,
      atStartOfSprint,
      addedToVersion,
      removedFromVersion,
      completed,
      remaining,
    });
  });

  if (workForecast && workForecast.sprintsRemaining > 0) {
    const { sprintsRemaining, averageVelocity, remainingWork } = workForecast;

    for (let i = 0; i < sprintsRemaining; i++) {

      const workForecastValue = averageVelocity || 0;
      
      chartData.push({
        sprintName: `Forecast Sprint ${i + 1}`,
        dateRange: null,
        state: 'forecast',
        workCompleted: 0,
        workRemaining: 0,
        workAdded: 0,
        workRemoved: 0,
        workForecast: workForecastValue,
        averageVelocity: averageVelocity || 0,
        remainingWork: remainingWork || 0,
        actualSprintsRemaining: sprintsRemaining,
        atStartOfSprint: 0,
        addedToVersion: 0,
        removedFromVersion: 0,
        completed: 0,
        remaining: 0,
      });
    }
  }

  return chartData;
};
