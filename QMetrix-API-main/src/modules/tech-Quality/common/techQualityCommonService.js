import defectEscapeRatioService from '../services/defectEscapeRatioService.js';
import defectAcceptanceRatioService from '../services/defectAcceptanceRatioService.js';
import bugRateService from '../services/bugRateService.js';
import { workTimeTypes, promiseStatuses } from '../../../utils/constants.js';
import timeToResolutionService from '../services/timeToResolutionService.js';

//Update current period (month/quarter/year) for all boards
async function updateCurrentPeriod({
    getIssuesInRange,
    issueModel,
    TechQualityModel,
    companyIdObj,
    projectIdObj,
    projectKeyId,
    selectedProjectBoards,
    periodList,
    periodType,
    getPeriodName
}) {
    if (periodList.length === 0) {
        return;
    }

    const currentPeriod = periodList[periodList.length - 1];
    const periodStart = new Date(currentPeriod.startDate);
    const periodEnd = new Date(currentPeriod.endDate);

    for (const boardId of selectedProjectBoards) {
        const workStartedIssues = await getIssuesInRange(
            issueModel,
            {
                companyIdObj,
                projectIdObj,
                boardId: boardId._id,
                startDate: periodStart,
                endDate: periodEnd,
            },
            workTimeTypes.WORK_STARTED
        );
        const workCompletedIssues = await getIssuesInRange(
            issueModel,
            {
                companyIdObj,
                projectIdObj,
                boardId: boardId._id,
                startDate: periodStart,
                endDate: periodEnd,
            },
            workTimeTypes.WORK_COMPLETED
        );
        const projectStoryIssues = await issueModel.aggregate([
            {
                $match: {
                    companyId: companyIdObj,
                    projectId: projectIdObj,
                    boardId: boardId._id,
                    key: { $exists: true, $ne: null },
                    'type.name': { $exists: true, $regex: /^story$/i },
                },
            },
            { $sort: { createdAt: -1 } },
            { $group: { _id: '$issueId', latestTicket: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$latestTicket' } },
            { $project: { key: 1 } },
        ]);

        const [defectEscapeRatioResult, defectAcceptanceRatioResult, bugRateResult, timeToResolutionResult] = await Promise.allSettled([
            defectEscapeRatioService.calculateDefectEscapeRatio(workStartedIssues),
            defectAcceptanceRatioService.calculateDefectAcceptanceRatio(workStartedIssues),
            bugRateService.calculateBugRate(workStartedIssues, workCompletedIssues, projectStoryIssues),
            timeToResolutionService.calculateTimeToResolution(workCompletedIssues),
        ]);

        const escapeRatio = defectEscapeRatioResult.status === promiseStatuses.FULFILLED ? defectEscapeRatioResult.value : { escapedDefects: 0, totalDefects: 0, defectEscapeRatio: 0 };

        const acceptanceRatio = defectAcceptanceRatioResult.status === promiseStatuses.FULFILLED ? defectAcceptanceRatioResult.value : { acceptedDefects: 0, totalDefects: 0, acceptanceRatio: 0 };

        const bugRate = bugRateResult.status === promiseStatuses.FULFILLED ? bugRateResult.value : { bugsCreated: 0, closedStories: 0, bugRateValue: 0 };

        const timeToResolution =
            timeToResolutionResult.status === promiseStatuses.FULFILLED
                ? timeToResolutionResult.value
                : {
                    overall: { resolvedBugs: 0, avgResolutionDays: 0, totalResolutionDays: 0 },
                    bySeverity: {
                        critical: { resolvedBugs: 0, avgResolutionDays: 0, totalResolutionDays: 0 },
                        high: { resolvedBugs: 0, avgResolutionDays: 0, totalResolutionDays: 0 },
                        medium: { resolvedBugs: 0, avgResolutionDays: 0, totalResolutionDays: 0 },
                        low: { resolvedBugs: 0, avgResolutionDays: 0, totalResolutionDays: 0 },
                    },
                };

        await TechQualityModel.findOneAndUpdate(
            {
                companyId: companyIdObj,
                projectId: projectIdObj,
                boardId: boardId ?? null,
                periodType,
                periodStartDate: periodStart,
            },
            {
                $set: {
                    companyId: companyIdObj,
                    projectId: projectIdObj,
                    boardId: boardId ?? null,
                    projectKeyId,
                    periodType,
                    periodName: getPeriodName(currentPeriod),
                    year: currentPeriod.year,
                    periodStartDate: periodStart,
                    periodEndDate: periodEnd,
                    totalTicketsStarted: workStartedIssues.length,
                    techQuality: {
                        defectEscapeRatio: escapeRatio,
                        defectAcceptanceRatio: acceptanceRatio,
                        bugRate: bugRate,
                        timeToResolution: timeToResolution,
                    },
                },
            },
            { upsert: true, new: true }
        );
    }
}

export default {
    updateCurrentPeriod,
};
