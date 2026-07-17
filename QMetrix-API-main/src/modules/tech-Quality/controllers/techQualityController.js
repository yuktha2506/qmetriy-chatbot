import { Types } from 'mongoose';
import { getMonthsRangeTillCurrentMonth, getQuartersRangeTillCurrentQuarter, getToday, getYearsRangeTillCurrentYear } from '../../../utils/commonFunctions.js';
import { BoardIssueModel, BoardModel, ProjectModel, SprintIssueModel } from '../../project-management/jira/model.js';
import { DailyTechQualityModel, TechQualityModel } from '../model.js';
import defectEscapeRatioService from '../services/defectEscapeRatioService.js';
import defectAcceptanceRatioService from '../services/defectAcceptanceRatioService.js';
import timeToResolutionService from '../services/timeToResolutionService.js';
import { workTimeTypes, boardTypes, syncTypes, promiseStatuses } from '../../../utils/constants.js';
import techQualityService from '../services/techQualityService.js';
import bugRateService from '../services/bugRateService.js';
import techQualityCommonService from '../common/techQualityCommonService.js';
import cache from '../../../utils/cache.js';
import { redis } from '../../../server.js';

async function getIssuesInRange(issuesModel, { companyIdObj, projectIdObj, boardId, startDate, endDate }, type) {
    const matchStage = {
        companyId: companyIdObj,
        projectId: projectIdObj,
        ...(type === workTimeTypes.WORK_STARTED ? { workStartedAt: { $gte: startDate, $lte: endDate } } : { workCompletedAt: { $gte: startDate, $lte: endDate } }),
    };
    if (boardId !== null) {
        matchStage.boardId = boardId;
    } else {
        matchStage.boardId = { $in: [null] };
    }
    const tickets = await issuesModel.aggregate([
        { $match: matchStage },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$issueId', latestTicket: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$latestTicket' } },
    ]);
    return tickets;
}
async function processTechQualityPeriod({
    issueModel,
    TechQualityModel,
    companyIdObj,
    projectIdObj,
    projectKeyId,
    boardId,
    periodType, // 'month' | 'quarter' | 'year'
    periodName,
    startDate,
    endDate,
}) {
    const workStartedIssues = await getIssuesInRange(issueModel, { companyIdObj, projectIdObj, boardId, startDate, endDate }, workTimeTypes.WORK_STARTED);
    const workCompletedIssues = await getIssuesInRange(issueModel, { companyIdObj, projectIdObj, boardId, startDate, endDate }, workTimeTypes.WORK_COMPLETED);
    const projectStoryIssues = await issueModel.aggregate([
        {
            $match: {
                companyId: companyIdObj,
                projectId: projectIdObj,
                boardId: boardId,
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
            periodStartDate: startDate,
        },
        {
            $set: {
                companyId: companyIdObj,
                projectId: projectIdObj,
                boardId: boardId ?? null,
                projectKeyId,
                periodType,
                periodName,
                year: startDate.getFullYear(),
                periodStartDate: startDate,
                periodEndDate: endDate,
                totalTicketsStarted: workStartedIssues.length,
                techQuality: {
                    defectEscapeRatio: escapeRatio,
                    defectAcceptanceRatio: acceptanceRatio,
                    bugRate: bugRate,
                    timeToResolution: timeToResolution,
                },
            },
        },
        { upsert: true }
    );
}

class TechQualityController {
    async createTechQualityRecord(companyId, tenantConnection, changeTypeForTechQuality, projectId) {
        const SprintIssuesModel = SprintIssueModel(tenantConnection);
        const KanbanIssueModel = BoardIssueModel(tenantConnection);
        const TechQuality = TechQualityModel(tenantConnection);
        const DailyTechQuality = DailyTechQualityModel(tenantConnection);
        const BoardsModel = BoardModel(tenantConnection);
        const companyIdObj = new Types.ObjectId(companyId);
        const projectIdObj = new Types.ObjectId(projectId);
        const Project = ProjectModel(tenantConnection);
        const project = await Project.findOne({ companyId: companyIdObj, _id: projectIdObj }, { projectKeyId: 1, firstIssueCreatedAt: 1, boardType: 1 }).lean();
        if (project === null || project.projectKeyId === null) {
            return;
        }
        const projectKeyId = project.projectKeyId;
        const issueModel = project.boardType && project.boardType.toLowerCase() === boardTypes.KANBAN ? KanbanIssueModel : SprintIssuesModel;
        const selectedProjectBoards = await BoardsModel.find({ companyId: companyIdObj, projectId: projectIdObj }, { _id: 1, boardId: 1 }).lean();
        if (changeTypeForTechQuality === syncTypes.HARD) {
            if (!project.firstIssueCreatedAt) {
                return;
            }

            const previousMonthList = getMonthsRangeTillCurrentMonth(project.firstIssueCreatedAt);
            for (const month of previousMonthList) {
                for (const board of selectedProjectBoards) {
                    await processTechQualityPeriod({
                        issueModel,
                        TechQualityModel: TechQuality,
                        companyIdObj,
                        projectIdObj,
                        projectKeyId,
                        boardId: board._id,
                        periodType: 'month',
                        periodName: month.monthName,
                        startDate: new Date(month.startDate),
                        endDate: new Date(month.endDate),
                    });
                }
            }

            const previousQuatersList = getQuartersRangeTillCurrentQuarter(project.firstIssueCreatedAt);
            for (const quarter of previousQuatersList) {
                for (const board of selectedProjectBoards) {
                    await processTechQualityPeriod({
                        issueModel,
                        TechQualityModel: TechQuality,
                        companyIdObj,
                        projectIdObj,
                        projectKeyId,
                        boardId: board._id,
                        periodType: 'quarter',
                        periodName: quarter.periodName,
                        startDate: new Date(quarter.startDate),
                        endDate: new Date(quarter.endDate),
                    });
                }
            }

            const previousYearsList = getYearsRangeTillCurrentYear(project.firstIssueCreatedAt);
            for (const year of previousYearsList) {
                for (const board of selectedProjectBoards) {
                    await processTechQualityPeriod({
                        issueModel,
                        TechQualityModel: TechQuality,
                        companyIdObj,
                        projectIdObj,
                        projectKeyId,
                        boardId: board._id,
                        periodType: 'year',
                        periodName: year.periodName,
                        startDate: new Date(year.startDate),
                        endDate: new Date(year.endDate),
                    });
                }
            }
        }

        const { startOfDay, endOfDay } = await getToday();

        for (const boardId of selectedProjectBoards) {
            const workStartedIssues = await getIssuesInRange(
                issueModel,
                {
                    companyIdObj,
                    projectIdObj,
                    boardId: boardId._id,
                    startDate: startOfDay,
                    endDate: endOfDay,
                },
                workTimeTypes.WORK_STARTED
            );
            const workCompletedIssues = await getIssuesInRange(
                issueModel,
                {
                    companyIdObj,
                    projectIdObj,
                    boardId: boardId._id,
                    startDate: startOfDay,
                    endDate: endOfDay,
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

            if (defectEscapeRatioResult.status === promiseStatuses.REJECTED) {
                console.error('Defect escape ratio service failed:', defectEscapeRatioResult.reason);
            }
            if (defectAcceptanceRatioResult.status === promiseStatuses.REJECTED) {
                console.error('Defect acceptance ratio service failed:', defectAcceptanceRatioResult.reason);
            }
            if (bugRateResult.status === promiseStatuses.REJECTED) {
                console.error('Bug rate service failed:', bugRateResult.reason);
            }

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
            await DailyTechQuality.findOneAndUpdate(
                {
                    companyId: companyIdObj,
                    projectId: projectIdObj,
                    boardId: boardId ?? null,
                    dayStartDate: startOfDay,
                },
                {
                    $set: {
                        companyId: companyIdObj,
                        projectId: projectIdObj,
                        boardId: boardId ?? null,
                        projectKeyId,
                        dayStartDate: startOfDay,
                        dayEndDate: endOfDay,
                        techQuality: {
                            defectEscapeRatio: {
                                escapedDefects: defectEscapeRatioResult.status === promiseStatuses.FULFILLED ? defectEscapeRatioResult.value.escapedDefects : 0,
                                totalDefects: defectEscapeRatioResult.status === promiseStatuses.FULFILLED ? defectEscapeRatioResult.value.totalDefects : 0,
                                defectEscapeRatio: defectEscapeRatioResult.status === promiseStatuses.FULFILLED ? defectEscapeRatioResult.value.defectEscapeRatio : 0,
                            },
                            defectAcceptanceRatio: {
                                acceptedDefects: defectAcceptanceRatioResult.status === promiseStatuses.FULFILLED ? defectAcceptanceRatioResult.value.acceptedDefects : 0,
                                totalDefects: defectAcceptanceRatioResult.status === promiseStatuses.FULFILLED ? defectAcceptanceRatioResult.value.totalDefects : 0,
                                acceptanceRatio: defectAcceptanceRatioResult.status === promiseStatuses.FULFILLED ? defectAcceptanceRatioResult.value.acceptanceRatio : 0,
                            },
                            bugRate: {
                                bugsCreated: bugRateResult.status === promiseStatuses.FULFILLED ? bugRateResult.value.bugsCreated : 0,
                                closedStories: bugRateResult.status === promiseStatuses.FULFILLED ? bugRateResult.value.closedStories : 0,
                                bugRateValue: bugRateResult.status === promiseStatuses.FULFILLED ? bugRateResult.value.bugRateValue : 0,
                            },
                            timeToResolution: timeToResolution,
                        },
                    },
                },
                { upsert: true, new: true }
            );
        }

        //updating current month, quarter, year records
        await techQualityCommonService.updateCurrentPeriod({
            getIssuesInRange,
            issueModel,
            TechQualityModel: TechQuality,
            companyIdObj,
            projectIdObj,
            projectKeyId,
            selectedProjectBoards,
            periodList: getMonthsRangeTillCurrentMonth(project.firstIssueCreatedAt),
            periodType: 'month',
            getPeriodName: (period) => period.monthName,
        });

        await techQualityCommonService.updateCurrentPeriod({
            getIssuesInRange,
            issueModel,
            TechQualityModel: TechQuality,
            companyIdObj,
            projectIdObj,
            projectKeyId,
            selectedProjectBoards,
            periodList: getQuartersRangeTillCurrentQuarter(project.firstIssueCreatedAt),
            periodType: 'quarter',
            getPeriodName: (period) => period.periodName,
        });

        await techQualityCommonService.updateCurrentPeriod({
            getIssuesInRange,
            issueModel,
            TechQualityModel: TechQuality,
            companyIdObj,
            projectIdObj,
            projectKeyId,
            selectedProjectBoards,
            periodList: getYearsRangeTillCurrentYear(project.firstIssueCreatedAt),
            periodType: 'year',
            getPeriodName: (period) => period.periodName,
        });
    }

    async getTechQualityMetrics(req, res) {
        try {
            const { companyId, projectId, boardId } = req.params;
            const tenantConnection = req.tenantConnection;
    
            const cacheKey = cache.generateKey('techQuality', {
                projectId,
                companyId,
                boardId,
            });
            let cached = null;
            try {
                cached = await redis.get(cacheKey);
            } catch (err) {
                console.warn('Redis not available, skipping cache get:', err.message);
            }
            if (cached) {
                const data = JSON.parse(cached);
                return res.status(200).json(data);
            }
    
            const techQualtiy = await techQualityService.getTechQuality(tenantConnection, companyId, projectId, boardId);
            
            const responseData = { techQualtiy };
            try {
                await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            
            res.status(200).json(responseData);
        } catch (error) {
            console.error('Error in getTechQualityMetrics:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch tech quality metrics' });
        }
    }
}

export default new TechQualityController();
