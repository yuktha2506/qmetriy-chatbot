import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { CXOModel } from '../model.js';
import { ProjectModel, JiraReleaseModel, SprintModel, SprintIssueModel, BoardIssueModel, BoardModel } from '../../project-management/jira/model.js';
import { getStartAndEndDate } from '../../../utils/commonFunctions.js';
import EngineeringScoreService from './engineering-score/engineeringScore.js';
import ReleaseReadinessService from './release-readiness/releaseReadiness.js';
import {
    defectDensityScore,
    cycleTimeScore,
    changeFailureRateScore,
    timeToFixScore,
    codeCoverageScore,
    staticCodeAnalysisScore,
    testCoverageScore,
    testAutomationScore,
    testCycleTimeScore,
    traceabilityScore,
    testingQualityScore,
    testingProductivityScore,
    automationTestingProductivityScore,
    dlaScore,
    deploymentFrequencyScore,
    meanTimeToRecoveryScore,
    leadTimeForChangesScore,
    tasksScore,
    storiesScore,
    epicsScore,
    bugsScore,
    burndownScore,
    automationTestResultScore,
    manualTestResultScore,
} from '../../../utils/scoreMapping.js';
import { DoraMetricsModel } from '../../source-code-management/github/model.js';
import cache from '../../../utils/cache.js';
import { redis } from '../../../server.js';
import { CLOSED_STATUSES, STATUS_ACTIVE, RELEASE_STATUS_RELEASED, STATUS_UNRELEASED } from '../../../utils/constants/statusConstants.js';
import { sub_task_type, epic_type } from '../../../utils/constants/custumFieldConstants.js';
class CxoService {
    getParentKey(ticket) {
        if (ticket.epic?.key) {return ticket.epic.key;}
        if (ticket.customFields?.parent) {return ticket.customFields.parent;}
        if (ticket.type?.name === sub_task_type && ticket.customFields?.parentKey) {
            return ticket.customFields.parentKey;
        }
        return null;
    }

    isParentTicket(ticket, allTickets) {
        return allTickets.some(t => {
            const type = (t.type?.name || '').toLowerCase();
            if (type === epic_type) {return false;}
            return this.getParentKey(t) === ticket.key;
        });
    }

    getChildrenTickets(parentKey, allTickets) {
        return allTickets.filter(t => {
            const type = (t.type?.name || '').toLowerCase();
            if (type === epic_type) {return false;}
            return this.getParentKey(t) === parentKey;
        });
    }

    isClosedToday(ticket, startOfToday, endOfToday) {
        if (!Array.isArray(ticket.statusChangeLog)) {return false;}

        return ticket.statusChangeLog.some(log => {
            if (!CLOSED_STATUSES.includes((log.to || '').toLowerCase())) {
                return false;
            }
            const changedAt = new Date(log.changedAt);
            return changedAt >= startOfToday && changedAt <= endOfToday;
        });
    }

    isStatusClosed(statusName) {
        return CLOSED_STATUSES.includes((statusName || '').toLowerCase());
    }

    async calculateVelocityMetrics(
        sprintId,
        releaseId,
        projectId,
        companyId,
        connection,
        boardId = null
    ) {
        try {
            const SprintIssue = SprintIssueModel(connection);
            const BoardIssue = BoardIssueModel(connection);
            const JiraRelease = JiraReleaseModel(connection);
            const Board = BoardModel(connection);
            const Sprint = SprintModel(connection);

            let isKanban = false;
            if (boardId) {
                const board = await Board.findOne(
                    { _id: boardId, companyId, projectId },
                    { boardType: 1 }
                );
                isKanban = board?.boardType?.toLowerCase() === 'kanban';
            }

            const IssueModel = isKanban ? BoardIssue : SprintIssue;

            let useHours = false;
            let release = null;

            const now = new Date();
            const startOfToday = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                0, 0, 0, 0
            );
            const endOfToday = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                23, 59, 59, 999
            );

            const matchQuery = { companyId, projectId };
            if (boardId) { matchQuery.boardId = boardId; }

            if (sprintId) {
                const sprint = await Sprint.findOne(
                    { _id: sprintId, companyId, projectId },
                    { hours: 1, state: 1 }
                );
                useHours = sprint?.hours === true;
                matchQuery.sprintId = { $in: [sprintId] };

                // Active sprint: only tickets synced on last sync day (latest only)
                if (sprint?.state?.toLowerCase() === STATUS_ACTIVE) {
                    const { startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, connection);
                    if (startOfDay !== null && endOfDay !== null) {
                        matchQuery.createdAt = { $gte: startOfDay, $lt: endOfDay };
                    }
                }
            } else if (releaseId) {
                release = await JiraRelease.findOne(
                    { _id: releaseId, companyId, projectId },
                    { hours: 1, releaseName: 1 }
                );
                useHours = release?.hours === true;
                if (release?.releaseName) {
                    matchQuery.fixVersion = release.releaseName;
                }
            }

            // Normalize match for aggregate (ObjectId where needed)
            const aggMatch = {
                companyId: Types.ObjectId.isValid(companyId) ? (companyId instanceof Types.ObjectId ? companyId : new Types.ObjectId(companyId)) : companyId,
                projectId: Types.ObjectId.isValid(projectId) ? (projectId instanceof Types.ObjectId ? projectId : new Types.ObjectId(projectId)) : projectId,
            };
            if (matchQuery.boardId) {
                aggMatch.boardId = matchQuery.boardId instanceof Types.ObjectId ? matchQuery.boardId : new Types.ObjectId(matchQuery.boardId);
            }
            if (matchQuery.sprintId) {
                aggMatch.sprintId = { $in: matchQuery.sprintId.$in.map((id) => (id instanceof Types.ObjectId ? id : new Types.ObjectId(id))) };
            }
            if (matchQuery.fixVersion) {
                aggMatch.fixVersion = matchQuery.fixVersion;
            }
            if (matchQuery.createdAt) {
                aggMatch.createdAt = matchQuery.createdAt;
            }

            // Latest ticket per issue only (same pattern as jiraTable / burndown)
            const allTickets = await IssueModel.aggregate([
                { $match: aggMatch },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: '$issueId',
                        latestTicket: { $first: '$$ROOT' },
                    },
                },
                { $replaceRoot: { newRoot: '$latestTicket' } },
            ]);

            const todayClosedMap = new Map();
            for (const ticket of allTickets) {
                const type = (ticket.type?.name || '').toLowerCase();
                if (type === epic_type) { continue; }

                if (
                    this.isClosedToday(ticket, startOfToday, endOfToday) &&
                    this.isStatusClosed(ticket.status?.name)
                ) {
                    todayClosedMap.set(ticket.key, ticket);
                }
            }

            const todayClosedTickets = Array.from(todayClosedMap.values());

            let completedStoryPoints = 0;
            let completedHours = 0;

            // Flat sum: no parent/child; exclude only epic
            if (useHours) {
                for (const ticket of todayClosedTickets) {
                    const type = (ticket.type?.name || '').toLowerCase();
                    if (type === epic_type) { continue; }
                    completedHours += ticket.originalEstimateHrs || 0;
                }
            } else {
                for (const ticket of todayClosedTickets) {
                    const type = (ticket.type?.name || '').toLowerCase();
                    if (type === epic_type) { continue; }
                    completedStoryPoints += ticket.storyPoints || 0;
                }
            }

            return {
                completedStoryPoints: +completedStoryPoints.toFixed(2),
                completedHours: +completedHours.toFixed(2)
            };

        } catch (error) {
            console.error('Velocity calculation failed:', error);
            return {
                completedStoryPoints: 0,
                completedHours: 0
            };
        }
    }

    async createCXO(companyId, connection, type, projectId) {
        const CXO = CXOModel(connection);
        const Project = ProjectModel(connection);
        const Board = BoardModel(connection);

        try {
            const projectBoards = await Board.find({
                companyId: new mongoose.Types.ObjectId(companyId),
                projectId: new mongoose.Types.ObjectId(projectId),
            });

            if (projectBoards.length === 0) {
                console.warn(`No boards found for project ${projectId}, falling back to project-level processing`);

                return await this.createCXOProjectLevel(companyId, connection, type, projectId);
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const cxoOperations = [];

            for (const board of projectBoards) {
                let projectReleases = [];
                const boardCxoOperations = [];
                let sprintPipeline, releasePipeline;

                try {
                    sprintPipeline = [
                        { $match: { companyId: new mongoose.Types.ObjectId(companyId), _id: new mongoose.Types.ObjectId(projectId) } },
                        {
                            $lookup: {
                                from: 'sprints',
                                localField: '_id',
                                foreignField: 'projectId',
                                as: 'allSprints',
                            },
                        },
                        {
                            $addFields: {
                                sprints: {
                                    $filter: {
                                        input: '$allSprints',
                                        cond: { $eq: ['$$this.boardId', board._id] },
                                    },
                                },
                            },
                        },
                        { $unwind: '$sprints' },
                    ];

                    releasePipeline = [
                        { $match: { companyId: new mongoose.Types.ObjectId(companyId), _id: new mongoose.Types.ObjectId(projectId) } },
                        {
                            $lookup: {
                                from: 'jirareleases',
                                localField: '_id',
                                foreignField: 'projectId',
                                as: 'allReleases',
                            },
                        },
                        {
                            $addFields: {
                                jirareleases: {
                                    $filter: {
                                        input: '$allReleases',
                                        cond: { $eq: ['$$this.boardId', board._id] },
                                    },
                                },
                            },
                        },
                        { $unwind: '$jirareleases' },
                    ];
                } catch (error) {
                    console.warn('Modern aggregation syntax not supported, using fallback approach');
                    sprintPipeline = [
                        { $match: { companyId: new mongoose.Types.ObjectId(companyId), _id: new mongoose.Types.ObjectId(projectId) } },
                        {
                            $lookup: {
                                from: 'sprints',
                                localField: '_id',
                                foreignField: 'projectId',
                                as: 'sprints',
                            },
                        },
                        { $unwind: '$sprints' },
                        { $match: { 'sprints.boardId': board._id } },
                    ];

                    releasePipeline = [
                        { $match: { companyId: new mongoose.Types.ObjectId(companyId), _id: new mongoose.Types.ObjectId(projectId) } },
                        {
                            $lookup: {
                                from: 'jirareleases',
                                localField: '_id',
                                foreignField: 'projectId',
                                as: 'jirareleases',
                            },
                        },
                        { $unwind: '$jirareleases' },
                        { $match: { 'jirareleases.boardId': board._id } },
                    ];
                }

                if (type === 'light') {
                    sprintPipeline.push({ $match: { 'sprints.state': STATUS_ACTIVE } });
                    releasePipeline.push({ $match: { 'jirareleases.status': STATUS_UNRELEASED } });

                    const threeDaysAgo = new Date(today);
                    threeDaysAgo.setDate(today.getDate() - 3);
                    const fiveDaysAgo = new Date(today);
                    fiveDaysAgo.setDate(today.getDate() - 5);

                    let recentlyClosedReleasePipeline;
                    try {
                        recentlyClosedReleasePipeline = [
                            { $match: { companyId: new mongoose.Types.ObjectId(companyId), _id: new mongoose.Types.ObjectId(projectId) } },
                            {
                                $lookup: {
                                    from: 'jirareleases',
                                    localField: '_id',
                                    foreignField: 'projectId',
                                    as: 'allReleases',
                                },
                            },
                            {
                                $addFields: {
                                    jirareleases: {
                                        $filter: {
                                            input: '$allReleases',
                                            cond: {
                                                $and: [
                                                    { $eq: ['$$this.boardId', board._id] },
                                                    { $eq: ['$$this.status', RELEASE_STATUS_RELEASED] },
                                                    { $gte: ['$$this.releaseDate', fiveDaysAgo] },
                                                    { $lte: ['$$this.releaseDate', today] },
                                                ],
                                            },
                                        },
                                    },
                                },
                            },
                            { $unwind: '$jirareleases' },
                            { $sort: { 'jirareleases.releaseDate': -1 } },
                            {
                                $group: {
                                    _id: '$_id',
                                    projectKeyId: { $first: '$projectKeyId' },
                                    jirareleases: { $first: '$jirareleases' },
                                    sonarQubeScanReport: { $first: '$sonarQubeScanReport' },
                                    combinedScanData: { $first: '$combinedScanData' },
                                },
                            },
                        ];
                    } catch (error) {
                        recentlyClosedReleasePipeline = [
                            { $match: { companyId: new mongoose.Types.ObjectId(companyId), _id: new mongoose.Types.ObjectId(projectId) } },
                            {
                                $lookup: {
                                    from: 'jirareleases',
                                    localField: '_id',
                                    foreignField: 'projectId',
                                    as: 'jirareleases',
                                },
                            },
                            { $unwind: '$jirareleases' },
                            {
                                $match: {
                                    'jirareleases.boardId': board._id,
                                    'jirareleases.status': RELEASE_STATUS_RELEASED,
                                    'jirareleases.releaseDate': { $gte: fiveDaysAgo, $lte: today },
                                },
                            },
                            { $sort: { 'jirareleases.releaseDate': -1 } },
                            {
                                $group: {
                                    _id: '$_id',
                                    projectKeyId: { $first: '$projectKeyId' },
                                    jirareleases: { $first: '$jirareleases' },
                                    sonarQubeScanReport: { $first: '$sonarQubeScanReport' },
                                    combinedScanData: { $first: '$combinedScanData' },
                                },
                            },
                        ];
                    }

                    let latestUnreleasedReleasePipeline;
                    try {
                        latestUnreleasedReleasePipeline = [
                            { $match: { companyId: new mongoose.Types.ObjectId(companyId), _id: new mongoose.Types.ObjectId(projectId) } },
                            {
                                $lookup: {
                                    from: 'jirareleases',
                                    localField: '_id',
                                    foreignField: 'projectId',
                                    as: 'allReleases',
                                },
                            },
                            {
                                $addFields: {
                                    jirareleases: {
                                        $filter: {
                                            input: '$allReleases',
                                            cond: {
                                                $and: [
                                                    { $eq: ['$$this.boardId', board._id] },
                                                    { $eq: ['$$this.status', 'Unreleased'] },
                                                    { $gte: ['$$this.startDate', threeDaysAgo] },
                                                    { $ne: ['$$this.startDate', null] },
                                                    { $exists: ['$$this.startDate', true] },
                                                ],
                                            },
                                        },
                                    },
                                },
                            },
                            { $unwind: '$jirareleases' },
                            {
                                $match: {
                                    $or: [{ 'jirareleases.releaseDate': { $exists: false } }, { 'jirareleases.releaseDate': null }, { 'jirareleases.releaseDate': { $gte: threeDaysAgo } }],
                                },
                            },
                            { $sort: { 'jirareleases.releaseDate': -1 } },
                            {
                                $group: {
                                    _id: '$_id',
                                    projectKeyId: { $first: '$projectKeyId' },
                                    jirareleases: { $first: '$jirareleases' },
                                    sonarQubeScanReport: { $first: '$sonarQubeScanReport' },
                                    combinedScanData: { $first: '$combinedScanData' },
                                },
                            },
                        ];
                    } catch (error) {
                        latestUnreleasedReleasePipeline = [
                            { $match: { companyId: new mongoose.Types.ObjectId(companyId), _id: new mongoose.Types.ObjectId(projectId) } },
                            {
                                $lookup: {
                                    from: 'jirareleases',
                                    localField: '_id',
                                    foreignField: 'projectId',
                                    as: 'jirareleases',
                                },
                            },
                            { $unwind: '$jirareleases' },
                            {
                                $match: {
                                    'jirareleases.boardId': board._id,
                                    'jirareleases.status': 'Unreleased',
                                    'jirareleases.startDate': { $exists: true, $ne: null, $gte: threeDaysAgo },
                                    $or: [{ 'jirareleases.releaseDate': { $exists: false } }, { 'jirareleases.releaseDate': null }, { 'jirareleases.releaseDate': { $gte: threeDaysAgo } }],
                                },
                            },
                            { $sort: { 'jirareleases.releaseDate': -1 } },
                            {
                                $group: {
                                    _id: '$_id',
                                    projectKeyId: { $first: '$projectKeyId' },
                                    jirareleases: { $first: '$jirareleases' },
                                    sonarQubeScanReport: { $first: '$sonarQubeScanReport' },
                                    combinedScanData: { $first: '$combinedScanData' },
                                },
                            },
                        ];
                    }

                    const [recentlyClosedResults, latestUnreleasedResults] = await Promise.allSettled([
                        Project.aggregate(recentlyClosedReleasePipeline, { allowDiskUse: true }),
                        Project.aggregate(latestUnreleasedReleasePipeline, { allowDiskUse: true }),
                    ]);

                    const allReleaseResults = [
                        ...(recentlyClosedResults.status === 'fulfilled' ? recentlyClosedResults.value : []),
                        ...(latestUnreleasedResults.status === 'fulfilled' ? latestUnreleasedResults.value : []),
                    ];

                    const uniqueReleaseResults = allReleaseResults.filter((release, index, self) => index === self.findIndex((r) => r.jirareleases.releaseName === release.jirareleases.releaseName));

                    projectReleases = uniqueReleaseResults;
                }

                const [sprintResults, releaseResults] = await Promise.allSettled([Project.aggregate(sprintPipeline, { allowDiskUse: true }), 
                    Project.aggregate(releasePipeline, { allowDiskUse: true })]);

                if (sprintResults.status === 'rejected') {
                    console.error(`Sprint aggregation failed for board ${board.boardName}:`, sprintResults.reason);
                }
                if (releaseResults.status === 'rejected') {
                    console.error(`Release aggregation failed for board ${board.boardName}:`, releaseResults.reason);
                }

                const projectSprints = sprintResults.status === 'fulfilled' ? sprintResults.value : [];
                projectReleases = releaseResults.status === 'fulfilled' ? releaseResults.value : [];

                const addCXOOperation = async (projectId, key, keyId, projectKeyId, sonarQubeScanReport, combinedScanData, boardObjectId, boardNumberId) => {
                    try {
                        const idType = key === 'sprintId' ? 'sprint' : 'release';

                        const sprintIdForVelocity = key === 'sprintId' ? keyId : null;
                        const releaseIdForVelocity = key === 'releaseVersion' ? null : (key === 'sprintId' ? null : keyId);
                        
                        let actualReleaseId = null;
                        if (key === 'releaseVersion') {
                            const JiraRelease = JiraReleaseModel(connection);
                            const releaseData = await JiraRelease.findOne({
                                releaseName: keyId,
                                projectId: projectId,
                                companyId: companyId,
                                boardId: boardObjectId,
                            });
                            if (releaseData) {
                                actualReleaseId = releaseData._id.toString();
                            }
                        }

                        const [readinessResult, engineeringResult, velocityMetrics] = await Promise.allSettled([
                            ReleaseReadinessService.getReleaseReadiness(companyId, projectId, keyId, idType, connection, boardObjectId),
                            EngineeringScoreService.getEngineeringScore(companyId, projectId, keyId, idType, connection, boardNumberId),
                            this.calculateVelocityMetrics(sprintIdForVelocity, actualReleaseId || releaseIdForVelocity, projectId, companyId, connection, boardObjectId),
                        ]);

                        if (readinessResult.status === 'rejected') {
                            console.error('Release readiness service failed:', readinessResult.reason);
                        }
                        if (engineeringResult.status === 'rejected') {
                            console.error('Engineering score service failed:', engineeringResult.reason);
                        }
                        if (velocityMetrics.status === 'rejected') {
                            console.error('Velocity metrics calculation failed:', velocityMetrics.reason);
                        }

                        const releaseReadinessScore = readinessResult.status === 'fulfilled' ? readinessResult.value : null;
                        const engineeringScore = engineeringResult.status === 'fulfilled' ? engineeringResult.value : null;
                        const velocity = velocityMetrics.status === 'fulfilled' ? velocityMetrics.value : {
                            completedHours: 0,
                            completedStoryPoints: 0
                        };

                        boardCxoOperations.push({
                            updateOne: {
                                filter: {
                                    projectId,
                                    companyId,
                                    boardId: boardObjectId,
                                    [key]: keyId,
                                    createdAt: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
                                },
                                update: {
                                    $set: {
                                        projectKeyId,
                                        boardId: boardObjectId,
                                        releaseReadinessObject: {
                                            tasks: releaseReadinessScore?.issues?.tasks,
                                            stories: releaseReadinessScore?.issues?.storys,
                                            bugs: releaseReadinessScore?.issues?.bugs,
                                            epics: releaseReadinessScore?.issues?.epics,
                                            testCoverage: releaseReadinessScore?.testCoverage || 0,
                                            burndown: {
                                                burndownPercentage: releaseReadinessScore?.burndown?.burndownPercentage,
                                                originalEstimate: releaseReadinessScore?.burndown?.totalStoryPoints,
                                                totalSpent: releaseReadinessScore?.burndown?.totalStoryPointsClosed,
                                                originalEstimateHrs: releaseReadinessScore?.burndownHrs?.totalOriginalEstimateHrs,
                                                timeSpentHrs: releaseReadinessScore?.burndownHrs?.totalTimeSpentHrs,
                                                burndownHrsPercentage: releaseReadinessScore?.burndownHrs?.burndownHrsPercent,
                                                completedHours: velocity.completedHours,
                                                completedStoryPoints: velocity.completedStoryPoints,
                                            },
                                            manualTestResult: releaseReadinessScore?.manualTestResult,
                                            automationTestResult: releaseReadinessScore?.automationTestResult,
                                        },
                                        engineeringScoreObject: {
                                            engineeringScore: engineeringScore?.engineeringScore?.toFixed(2),
                                            developerScoreObject: {
                                                developerScore: engineeringScore?.developerScore?.developerscore?.toFixed(2),
                                                releaseCycleTime: engineeringScore?.developerScore?.releaseCycleTime || 0,
                                                timeToFix: {
                                                    averageTimeToFix: engineeringScore?.developerScore?.timeToFix?.averageTTF || 0,
                                                    totalResolvedBugs: engineeringScore?.developerScore?.timeToFix?.resolvedCount || 0,
                                                    totalTimeSpent: engineeringScore?.developerScore?.timeToFix?.totalTimeToFix || 0,
                                                },
                                                codeCoverage: engineeringScore?.developerScore?.codeCoverage || 93.71,
                                                staticCodeAnalysis: engineeringScore?.developerScore?.staticCodeAnalysis || 0,
                                                cycleTime: {
                                                    totalCycleTime: engineeringScore?.developerScore?.cycleTime?.cycleTime || 0,
                                                    totalTimeSpent: engineeringScore?.developerScore?.cycleTime?.totalTimeSpent || 0,
                                                    numberOfIssues: engineeringScore?.developerScore?.cycleTime?.completedStoriesCount || 0,
                                                },
                                                defectDensity: {
                                                    totalBugs: engineeringScore?.developerScore?.defectDensity?.totalBugs,
                                                    ncloc: engineeringScore?.developerScore?.defectDensity?.ncloc,
                                                    density: engineeringScore?.developerScore?.defectDensity?.density,
                                                },
                                                sonarQubeScanReport: sonarQubeScanReport || [],
                                                combinedScanData: combinedScanData || {},
                                            },
                                            testScoreObject: {
                                                testScore: typeof engineeringScore?.testScore?.testscore === 'number' ? engineeringScore.testScore.testscore.toFixed(2) : null,
                                                testCoverage: engineeringScore?.testScore?.testCoverage || 70.27,
                                                testAutomation: engineeringScore?.testScore?.testAutomation || 0,
                                                testCycleTime: engineeringScore?.testScore?.testCycleTime || 0,
                                                traceability: engineeringScore?.testScore?.traceability || 0,
                                                testingQuality: {
                                                    totalBugs: engineeringScore?.testScore?.testingQuality?.totalBugs || 0,
                                                    lowPriorityBugs: engineeringScore?.testScore?.testingQuality?.lowPriorityBugs || 0,
                                                    testingquality: engineeringScore?.testScore?.testingQuality?.testingquality || 0,
                                                },
                                                testingProductivity: engineeringScore?.testScore?.testingProductivity ?? {
                                                    executedTestCases: 0,
                                                    teamSize: 0,
                                                    productivityPercentage: 0,
                                                    passed: 0,
                                                    failed: 0,
                                                    blocked: 0,
                                                    untested: 0,
                                                    retest: 0,
                                                },
                                                automationTestingProductivity: engineeringScore?.testScore?.automationTestingProductivity ?? {
                                                    executedTestCases: 0,
                                                    teamSize: 0,
                                                    productivityPercentage: 0,
                                                    passed: 0,
                                                    failed: 0,
                                                    blocked: 0,
                                                    untested: 0,
                                                    retest: 0,
                                                },
                                                dlaObject: {
                                                    totalBugs: engineeringScore?.testScore?.defectLeakageAnalysis?.totalBugCount,
                                                    prodBugs: engineeringScore?.testScore?.defectLeakageAnalysis?.prodBugs,
                                                    uatBugs: engineeringScore?.testScore?.defectLeakageAnalysis?.uatBugs,
                                                    escapedBugs: engineeringScore?.testScore?.defectLeakageAnalysis?.escapedDefects,
                                                    dla: engineeringScore?.testScore?.defectLeakageAnalysis?.dla,
                                                },
                                                defectEscapeRatio: engineeringScore?.testScore?.defectEscapeRatio?.issueSummary?.prodBugCount || 0,
                                            },
                                            operationScoreObject: {
                                                operationScore: engineeringScore?.operationScoreObject?.operationScore || 0,
                                                deploymentFrequencyScore: engineeringScore?.operationScoreObject?.deploymentFrequencyScore || 0,
                                                meanTimeToRecovery: engineeringScore?.operationScoreObject?.meanTimeToRecovery || 0,
                                                changeFailureRate:
                                                    engineeringScore?.operationScoreObject?.changeFailureRateScore
                                                    ?? engineeringScore?.operationScoreObject?.changeFailureRate
                                                    ?? 0,
                                                leadTimeForChangesScore: engineeringScore?.operationScoreObject?.leadTimeForChangesScore || 0,
                                            },
                                        },
                                    },
                                },
                                upsert: true,
                            },
                        });
                    } catch (error) {
                        console.error(`Error in addCXOOperation for ${key} ${keyId} in board ${board.boardName}:`, error);
                        throw error;
                    }
                };

                for (const projectSprint of projectSprints) {
                    const {
                        _id: projectId,
                        sprints: { _id: sprintId },
                        projectKeyId,
                        sonarQubeScanReport,
                        combinedScanData,
                    } = projectSprint;

                    await addCXOOperation(projectId, 'sprintId', sprintId, projectKeyId, sonarQubeScanReport, combinedScanData, board._id, board.boardId);
                }

                // Process releases for this board
                for (const projectRelease of projectReleases) {
                    const {
                        _id: projectId,
                        jirareleases: { releaseName: releaseVersion },
                        projectKeyId,
                        sonarQubeScanReport,
                        combinedScanData,
                    } = projectRelease;

                    await addCXOOperation(projectId, 'releaseVersion', releaseVersion, projectKeyId, sonarQubeScanReport, combinedScanData, board._id, board.boardId);
                }

                // Execute CXO operations for this board
                if (boardCxoOperations.length > 0) {
                    try {
                        await CXO.bulkWrite(boardCxoOperations);
                        cxoOperations.push(...boardCxoOperations);
                    } catch (bulkWriteError) {
                        console.error(`Bulk write operations failed for board ${board.boardName}:`, bulkWriteError);
                        throw bulkWriteError;
                    }
                } else {
                    console.warn(`No CXO operations to execute for board ${board.boardName}`);
                }

                // Update CXO scores for sprints in this board
                if (projectSprints.length > 0) {
                    for (const projectSprint of projectSprints) {
                        const {
                            _id: projectId,
                            sprints: { _id: sprintId },
                        } = projectSprint;

                        try {
                            await this.updateCXOScores(companyId, projectId, sprintId, null, null, board._id, connection);
                        } catch (error) {
                            console.error(`Failed to update sprint scores for ${sprintId} in board ${board.boardName}:`, error);
                            console.warn(`Continuing with other boards after error in board ${board.boardName}`);
                        }
                    }
                } else {
                    console.warn(`No sprints found for board ${board.boardName}, skipping sprint score updates`);
                }

                if (projectReleases.length > 0) {
                    for (const projectRelease of projectReleases) {
                        const {
                            _id: projectId,
                            jirareleases: { releaseName: releaseVersion },
                        } = projectRelease;

                        try {
                            const JiraRelease = JiraReleaseModel(connection);

                            const releaseData = await JiraRelease.findOne({
                                releaseName: releaseVersion,
                                projectId: projectId,
                                companyId: companyId,
                                boardId: board._id,
                            });

                            if (!releaseData) {
                                console.warn(`Release data not found for: ${releaseVersion} in board ${board.boardName}, skipping`);
                                continue;
                            }

                            const releaseId = releaseData._id;

                            await this.updateCXOScores(companyId, projectId, null, releaseId, null, board._id, connection);
                        } catch (error) {
                            console.error(`Failed to update release scores for ${releaseVersion} in board ${board.boardName}:`, error);
                            console.warn(`Continuing with other boards after error in board ${board.boardName}`);
                        }
                    }
                } else {
                    console.warn(`No releases found for board ${board.boardName}, skipping release score updates`);
                }
            }

            return { response: `${cxoOperations.length} CXO records created/updated successfully across ${projectBoards.length} boards` };
        } catch (error) {
            console.error('Error in createCXO main try-catch:', error);
            console.error('Error stack:', error.stack);
            throw new Error(`Failed to create/update CXO: ${error.message}`);
        }
    }

    async createCXOProjectLevel(companyId, connection, type, projectId) {
        const CXO = CXOModel(connection);
        const Project = ProjectModel(connection);

        try {
            let projectReleases = [];
            const sprintPipeline = [
                { $match: { companyId: new mongoose.Types.ObjectId(companyId), _id: new mongoose.Types.ObjectId(projectId) } },
                {
                    $lookup: {
                        from: 'sprints',
                        localField: '_id',
                        foreignField: 'projectId',
                        as: 'sprints',
                    },
                },
                { $unwind: '$sprints' },
            ];

            const releasePipeline = [
                { $match: { companyId: new mongoose.Types.ObjectId(companyId), _id: new mongoose.Types.ObjectId(projectId) } },
                {
                    $lookup: {
                        from: 'jirareleases',
                        localField: '_id',
                        foreignField: 'projectId',
                        as: 'jirareleases',
                    },
                },
                { $unwind: '$jirareleases' },
            ];

            if (type === 'light') {
                sprintPipeline.push({ $match: { 'sprints.state': STATUS_ACTIVE } });

                const today = new Date();
                const threeDaysAgo = new Date(today);
                threeDaysAgo.setDate(today.getDate() - 3);
                const fiveDaysAgo = new Date(today);
                fiveDaysAgo.setDate(today.getDate() - 5);

                const recentlyClosedReleasePipeline = [
                    { $match: { companyId: new mongoose.Types.ObjectId(companyId), _id: new mongoose.Types.ObjectId(projectId) } },
                    {
                        $lookup: {
                            from: 'jirareleases',
                            localField: '_id',
                            foreignField: 'projectId',
                            as: 'jirareleases',
                        },
                    },
                    { $unwind: '$jirareleases' },
                    {
                        $match: {
                            'jirareleases.status': RELEASE_STATUS_RELEASED,
                            'jirareleases.releaseDate': { $gte: fiveDaysAgo, $lte: today },
                        },
                    },
                    { $sort: { 'jirareleases.releaseDate': -1 } },
                    {
                        $group: {
                            _id: '$_id',
                            projectKeyId: { $first: '$projectKeyId' },
                            jirareleases: { $first: '$jirareleases' },
                            sonarQubeScanReport: { $first: '$sonarQubeScanReport' },
                            combinedScanData: { $first: '$combinedScanData' },
                        },
                    },
                ];

                const latestUnreleasedReleasePipeline = [
                    { $match: { companyId: new mongoose.Types.ObjectId(companyId), _id: new mongoose.Types.ObjectId(projectId) } },
                    {
                        $lookup: {
                            from: 'jirareleases',
                            localField: '_id',
                            foreignField: 'projectId',
                            as: 'jirareleases',
                        },
                    },
                    { $unwind: '$jirareleases' },
                    {
                        $match: {
                            'jirareleases.status': 'Unreleased',
                            'jirareleases.startDate': { $exists: true, $ne: null, $gte: threeDaysAgo },
                            $or: [{ 'jirareleases.releaseDate': { $exists: false } }, { 'jirareleases.releaseDate': null }, { 'jirareleases.releaseDate': { $gte: threeDaysAgo } }],
                        },
                    },
                    { $sort: { 'jirareleases.releaseDate': -1 } },
                    {
                        $group: {
                            _id: '$_id',
                            projectKeyId: { $first: '$projectKeyId' },
                            jirareleases: { $first: '$jirareleases' },
                            sonarQubeScanReport: { $first: '$sonarQubeScanReport' },
                            combinedScanData: { $first: '$combinedScanData' },
                        },
                    },
                ];

                const [recentlyClosedResults, latestUnreleasedResults] = await Promise.allSettled([
                    Project.aggregate(recentlyClosedReleasePipeline, { allowDiskUse: true }),
                    Project.aggregate(latestUnreleasedReleasePipeline, { allowDiskUse: true }),
                ]);

                const allReleaseResults = [
                    ...(recentlyClosedResults.status === 'fulfilled' ? recentlyClosedResults.value : []),
                    ...(latestUnreleasedResults.status === 'fulfilled' ? latestUnreleasedResults.value : []),
                ];

                const uniqueReleaseResults = allReleaseResults.filter((release, index, self) => index === self.findIndex((r) => r.jirareleases.releaseName === release.jirareleases.releaseName));

                projectReleases = uniqueReleaseResults;
            }

            const [sprintResults, releaseResults] = await Promise.allSettled([Project.aggregate(sprintPipeline, { allowDiskUse: true }), Project.aggregate(releasePipeline, { allowDiskUse: true })]);

            if (sprintResults.status === 'rejected') {
                console.error('Sprint aggregation failed:', sprintResults.reason);
            }
            if (releaseResults.status === 'rejected') {
                console.error('Release aggregation failed:', releaseResults.reason);
            }

            const projectSprints = sprintResults.status === 'fulfilled' ? sprintResults.value : [];
            projectReleases = releaseResults.status === 'fulfilled' ? releaseResults.value : [];

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const cxoOperations = [];

            const addCXOOperation = async (projectId, key, keyId, projectKeyId, sonarQubeScanReport, combinedScanData) => {
                try {
                    const idType = key === 'sprintId' ? 'sprint' : 'release';

                    const sprintIdForVelocity = key === 'sprintId' ? keyId : null;
                    const releaseIdForVelocity = key === 'releaseVersion' ? null : (key === 'sprintId' ? null : keyId);
                    
                    let actualReleaseId = null;
                    if (key === 'releaseVersion') {
                        const JiraRelease = JiraReleaseModel(connection);
                        const releaseData = await JiraRelease.findOne({
                            releaseName: keyId,
                            projectId: projectId,
                            companyId: companyId,
                        });
                        if (releaseData) {
                            actualReleaseId = releaseData._id.toString();
                        }
                    }

                    const [readinessResult, engineeringResult, velocityMetrics] = await Promise.allSettled([
                        ReleaseReadinessService.getReleaseReadiness(companyId, projectId, keyId, idType, connection, null),
                        EngineeringScoreService.getEngineeringScore(companyId, projectId, keyId, idType, connection),
                        this.calculateVelocityMetrics(sprintIdForVelocity, actualReleaseId || releaseIdForVelocity, projectId, companyId, connection, null),
                    ]);

                    if (readinessResult.status === 'rejected') {
                        console.error('Release readiness service failed:', readinessResult.reason);
                    }
                    if (engineeringResult.status === 'rejected') {
                        console.error('Engineering score service failed:', engineeringResult.reason);
                    }
                    if (velocityMetrics.status === 'rejected') {
                        console.error('Velocity metrics calculation failed:', velocityMetrics.reason);
                    }

                    const releaseReadinessScore = readinessResult.status === 'fulfilled' ? readinessResult.value : null;
                    const engineeringScore = engineeringResult.status === 'fulfilled' ? engineeringResult.value : null;
                    const velocity = velocityMetrics.status === 'fulfilled' ? velocityMetrics.value : {
                        completedHours: 0,
                        completedStoryPoints: 0
                    };

                    cxoOperations.push({
                        updateOne: {
                            filter: {
                                projectId,
                                companyId,
                                [key]: keyId,
                                createdAt: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
                            },
                            update: {
                                $set: {
                                    projectKeyId,
                                    releaseReadinessObject: {
                                        tasks: releaseReadinessScore?.issues?.tasks,
                                        stories: releaseReadinessScore?.issues?.storys,
                                        bugs: releaseReadinessScore?.issues?.bugs,
                                        epics: releaseReadinessScore?.issues?.epics,
                                        testCoverage: releaseReadinessScore?.testCoverage || 0,
                                        burndown: {
                                            burndownPercentage: releaseReadinessScore?.burndown?.burndownPercentage,
                                            originalEstimate: releaseReadinessScore?.burndown?.totalStoryPoints,
                                            totalSpent: releaseReadinessScore?.burndown?.totalStoryPointsClosed,
                                            originalEstimateHrs: releaseReadinessScore?.burndownHrs?.totalOriginalEstimateHrs,
                                            timeSpentHrs: releaseReadinessScore?.burndownHrs?.totalTimeSpentHrs,
                                            burndownHrsPercentage: releaseReadinessScore?.burndownHrs?.burndownHrsPercent,
                                            completedHours: velocity.completedHours,
                                            completedStoryPoints: velocity.completedStoryPoints,
                                        },
                                        manualTestResult: releaseReadinessScore?.manualTestResult,
                                        automationTestResult: releaseReadinessScore?.automationTestResult,
                                    },
                                    engineeringScoreObject: {
                                        engineeringScore: engineeringScore?.engineeringScore?.toFixed(2),
                                        developerScoreObject: {
                                            developerScore: engineeringScore?.developerScore?.developerscore?.toFixed(2),
                                            releaseCycleTime: engineeringScore?.developerScore?.releaseCycleTime || 0,
                                            timeToFix: {
                                                averageTimeToFix: engineeringScore?.developerScore?.timeToFix?.averageTTF || 0,
                                                totalResolvedBugs: engineeringScore?.developerScore?.timeToFix?.resolvedCount || 0,
                                                totalTimeSpent: engineeringScore?.developerScore?.timeToFix?.totalTimeToFix || 0,
                                            },
                                            codeCoverage: engineeringScore?.developerScore?.codeCoverage || 93.71,
                                            staticCodeAnalysis: engineeringScore?.developerScore?.staticCodeAnalysis || 0,
                                            cycleTime: {
                                                totalCycleTime: engineeringScore?.developerScore?.cycleTime?.cycleTime || 0,
                                                totalTimeSpent: engineeringScore?.developerScore?.cycleTime?.totalTimeSpent || 0,
                                                numberOfIssues: engineeringScore?.developerScore?.cycleTime?.completedStoriesCount || 0,
                                            },
                                            defectDensity: {
                                                totalBugs: engineeringScore?.developerScore?.defectDensity?.totalBugs,
                                                ncloc: engineeringScore?.developerScore?.defectDensity?.ncloc,
                                                density: engineeringScore?.developerScore?.defectDensity?.density,
                                            },
                                            sonarQubeScanReport: sonarQubeScanReport || [],
                                            combinedScanData: combinedScanData || {},
                                        },
                                        testScoreObject: {
                                            testScore: typeof engineeringScore?.testScore?.testscore === 'number' ? engineeringScore.testScore.testscore.toFixed(2) : null,
                                            testCoverage: engineeringScore?.testScore?.testCoverage || 70.27,
                                            testAutomation: engineeringScore?.testScore?.testAutomation || 0,
                                            testCycleTime: engineeringScore?.testScore?.testCycleTime || 0,
                                            traceability: engineeringScore?.testScore?.traceability || 0,
                                            testingQuality: {
                                                totalBugs: engineeringScore?.testScore?.testingQuality?.totalBugs || 0,
                                                lowPriorityBugs: engineeringScore?.testScore?.testingQuality?.lowPriorityBugs || 0,
                                                testingquality: engineeringScore?.testScore?.testingQuality?.testingquality || 0,
                                            },
                                            testingProductivity: engineeringScore?.testScore?.testingProductivity ?? {
                                                executedTestCases: 0,
                                                teamSize: 0,
                                                productivityPercentage: 0,
                                                passed: 0,
                                                failed: 0,
                                                blocked: 0,
                                                untested: 0,
                                                retest: 0,
                                            },
                                            automationTestingProductivity: engineeringScore?.testScore?.automationTestingProductivity ?? {
                                                executedTestCases: 0,
                                                teamSize: 0,
                                                productivityPercentage: 0,
                                                passed: 0,
                                                failed: 0,
                                                blocked: 0,
                                                untested: 0,
                                                retest: 0,
                                            },
                                            dlaObject: {
                                                totalBugs: engineeringScore?.testScore?.defectLeakageAnalysis?.totalBugCount,
                                                prodBugs: engineeringScore?.testScore?.defectLeakageAnalysis?.prodBugs,
                                                uatBugs: engineeringScore?.testScore?.defectLeakageAnalysis?.uatBugs,
                                                escapedBugs: engineeringScore?.testScore?.defectLeakageAnalysis?.escapedDefects,
                                                dla: engineeringScore?.testScore?.defectLeakageAnalysis?.dla,
                                            },
                                            defectEscapeRatio: engineeringScore?.testScore?.defectEscapeRatio?.issueSummary?.prodBugCount || 0,
                                        },
                                        operationScoreObject: {
                                            operationScore: engineeringScore?.operationScoreObject?.operationScore || 0,
                                            deploymentFrequencyScore: engineeringScore?.operationScoreObject?.deploymentFrequencyScore || 0,
                                            meanTimeToRecovery: engineeringScore?.operationScoreObject?.meanTimeToRecovery || 0,
                                            changeFailureRate:
                                                engineeringScore?.operationScoreObject?.changeFailureRateScore
                                                ?? engineeringScore?.operationScoreObject?.changeFailureRate
                                                ?? 0,
                                            leadTimeForChangesScore: engineeringScore?.operationScoreObject?.leadTimeForChangesScore || 0,
                                        },
                                    },
                                },
                            },
                            upsert: true,
                        },
                    });
                } catch (error) {
                    console.error(`Error in addCXOOperation for ${key} ${keyId}:`, error);
                    throw error;
                }
            };

            for (const projectSprint of projectSprints) {
                const {
                    _id: projectId,
                    sprints: { _id: sprintId },
                    projectKeyId,
                    sonarQubeScanReport,
                    combinedScanData,
                } = projectSprint;

                await addCXOOperation(projectId, 'sprintId', sprintId, projectKeyId, sonarQubeScanReport, combinedScanData);
            }

            for (const projectRelease of projectReleases) {
                const {
                    _id: projectId,
                    jirareleases: { releaseName: releaseVersion },
                    projectKeyId,
                    sonarQubeScanReport,
                    combinedScanData,
                } = projectRelease;

                await addCXOOperation(projectId, 'releaseVersion', releaseVersion, projectKeyId, sonarQubeScanReport, combinedScanData);
            }

            if (cxoOperations.length > 0) {
                try {
                    await CXO.bulkWrite(cxoOperations);
                } catch (bulkWriteError) {
                    console.error('Bulk write operations failed:', bulkWriteError);
                    throw bulkWriteError;
                }
            }

            for (const projectSprint of projectSprints) {
                const {
                    _id: projectId,
                    sprints: { _id: sprintId },
                } = projectSprint;

                try {
                    await this.updateCXOScores(companyId, projectId, sprintId, null, null, null, connection);
                } catch (error) {
                    console.error(`Failed to update sprint scores for ${sprintId}:`, error);
                    return { status: 'error', message: error.message, statusCode: error.statusCode || 500 };
                }
            }

            for (const projectRelease of projectReleases) {
                const {
                    _id: projectId,
                    jirareleases: { releaseName: releaseVersion },
                } = projectRelease;

                try {
                    const JiraRelease = JiraReleaseModel(connection);

                    const releaseData = await JiraRelease.findOne({
                        releaseName: releaseVersion,
                        projectId: projectId,
                        companyId: companyId,
                    });

                    if (!releaseData) {
                        throw new Error(`Release data not found for: ${releaseVersion}`);
                    }

                    const releaseId = releaseData._id;

                    await this.updateCXOScores(companyId, projectId, null, releaseId, null, null, connection);
                } catch (error) {
                    console.error(`Failed to update release scores for ${releaseVersion}:`, error);
                    return { status: 'error', message: error.message, statusCode: error.statusCode || 500 };
                }
            }

            return { response: `${cxoOperations.length} CXO records created/updated successfully (project-level)` };
        } catch (error) {
            console.error('Error in createCXOProjectLevel:', error);
            console.error('Error stack:', error.stack);
            throw new Error(`Failed to create/update CXO: ${error.message}`);
        }
    }

    async getCXO(companyId, projectId, boardId, sprintId, releaseId, connection) {
        try {
            const cacheKey = cache.generateKey('getCXO', {
                projectId,
                companyId,
                sprintId,
                releaseId,
                boardId,
            });
            let cached = null;
            try {
                cached = await redis.get(cacheKey);
            } catch (err) {
                console.warn('Redis not available, skipping cache get:', err.message);
            }
            if (cached) {
                return JSON.parse(cached);
            }
            const CXO = CXOModel(connection);
            const JiraRelease = JiraReleaseModel(connection);
            const Sprint = SprintModel(connection);
            let response = null;

            // Build query with optional boardId
            const baseQuery = { companyId, projectId };
            if (boardId) {
                baseQuery.boardId = boardId;
            }

            if (sprintId) {
                response = await CXO.find({ ...baseQuery, sprintId })
                    .sort({ createdAt: -1 })
                    .limit(1);
            } else if (releaseId) {
                const releaseQuery = { companyId, projectId, _id: releaseId };
                if (boardId) {
                    releaseQuery.boardId = boardId;
                }
                const releaseData = await JiraRelease.findOne(releaseQuery);
                response = await CXO.find({
                    ...baseQuery,
                    releaseVersion: releaseData?.releaseName,
                })
                    .sort({ createdAt: -1 })
                    .limit(1);
            } else {
                console.error('Sprint or release not defined');
            }
            let savedCXO = null;
            if (Array.isArray(response) && response.length > 0) {
                savedCXO = response[0];
            }

            const sprints = await Sprint.find({ companyId, projectId, boardId });
            if (!projectId) {
                console.error('No project found for this company.');
            }
            if (sprints.length === 0) {
                console.error('No sprints found for this project.');
            }
            const result = { savedCXO, ...response };
            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            return result;
        } catch (error) {
            console.error('Error in Service:', error);
            return null;
        }
    }

    async updateCXOScores(companyId, projectId, sprintId, releaseId, repoName, boardId, connection) {
        try {
            const CXO = CXOModel(connection);
            const JiraRelease = JiraReleaseModel(connection);
            const Project = ProjectModel(connection);
            const DoraMetric = DoraMetricsModel(connection);

            let response, doraMetricData;

            const project = await Project.findOne({ _id: projectId, companyId });
            if (!project || !project.metricContribution) {
                throw new Error('Project or metric contribution not found');
            }
            const { metricContribution } = project;

            if (sprintId) {
                response = await CXO.find({ companyId, projectId, boardId, sprintId }).sort({ createdAt: -1 }).limit(1);
                if (response.length === 0) {
                    response = await CXO.find({ companyId, projectId, sprintId }).sort({ createdAt: -1 }).limit(1);
                }
                
                if (repoName !== null) {
                    doraMetricData = await DoraMetric.find({ companyId, projectId, boardId, sprintId, repoName }).sort({ createdAt: -1 }).limit(1);
                    if (doraMetricData.length === 0) {
                        doraMetricData = await DoraMetric.find({ companyId, projectId, sprintId, repoName }).sort({ createdAt: -1 }).limit(1);
                    }
                } else {
                    doraMetricData = await DoraMetric.find({ companyId, projectId, boardId, sprintId }).sort({ createdAt: -1 }).limit(1);
                    if (doraMetricData.length === 0) {
                        doraMetricData = await DoraMetric.find({ companyId, projectId, sprintId }).sort({ createdAt: -1 }).limit(1);
                    }
                }
            } else if (releaseId) {
                const releaseQuery = { companyId, projectId, _id: releaseId };
                if (boardId) {
                    releaseQuery.boardId = boardId;
                }
                const releaseData = await JiraRelease.findOne(releaseQuery);
                if (!releaseData) {
                    const fallbackReleaseData = await JiraRelease.findOne({ companyId, projectId, _id: releaseId });
                    if (!fallbackReleaseData) {
                        throw new Error('Release not found');
                    }
                    response = await CXO.find({ companyId, projectId, releaseVersion: fallbackReleaseData.releaseName }).sort({ createdAt: -1 }).limit(1);
                } else {
                    response = await CXO.find({ companyId, projectId, boardId, releaseVersion: releaseData.releaseName }).sort({ createdAt: -1 }).limit(1);
                    if (response.length === 0) {
                        response = await CXO.find({ companyId, projectId, releaseVersion: releaseData.releaseName }).sort({ createdAt: -1 }).limit(1);
                    }
                }
                if (repoName !== null) {
                    doraMetricData = await DoraMetric.find({ companyId, projectId, boardId, releaseId, repoName }).sort({ createdAt: -1 }).limit(1);
                    if (doraMetricData.length === 0) {
                        doraMetricData = await DoraMetric.find({ companyId, projectId, releaseId, repoName }).sort({ createdAt: -1 }).limit(1);
                    }
                } else {
                    doraMetricData = await DoraMetric.find({ companyId, projectId, boardId, releaseId }).sort({ createdAt: -1 }).limit(1);
                    if (doraMetricData.length === 0) {
                        doraMetricData = await DoraMetric.find({ companyId, projectId, releaseId }).sort({ createdAt: -1 }).limit(1);
                    }
                }
            } else {
                throw new Error('Sprint and release not defined');
            }

            const savedCXO = response[0];

            if (!savedCXO) {
                console.warn(`No CXO record found for companyId: ${companyId}, projectId: ${projectId}, boardId: ${boardId}, sprintId: ${sprintId}, releaseId: ${releaseId}`);
                return { message: 'No CXO record found for the given parameters' };
            }

            if (boardId && !savedCXO.boardId) {
                await CXO.updateOne({ _id: savedCXO._id }, { $set: { boardId: boardId } });
                savedCXO.boardId = boardId;
            }

            let metrics = {};
            if (doraMetricData.length) {
                metrics = doraMetricData[0].metrics;
            }

            const { engineeringScoreObject, releaseReadinessObject } = savedCXO;
            const { developerScoreObject, testScoreObject } = engineeringScoreObject;

            const developerScoreMetrics = {
                defectDensity: defectDensityScore(developerScoreObject.defectDensity.density),
                cycleTime: cycleTimeScore(developerScoreObject.cycleTime.totalCycleTime),
                timeToFixBug: timeToFixScore(developerScoreObject.timeToFix.averageTimeToFix),
                codeCoverage: codeCoverageScore(developerScoreObject.codeCoverage),
                staticCodeAnalysis: staticCodeAnalysisScore(developerScoreObject.combinedScanData.staticCodeAnalysisScore),
            };

            const testScoreMetrics = {
                testCoverage: testCoverageScore(testScoreObject.testCoverage),
                testAutomation: testAutomationScore(testScoreObject.testAutomation),
                testCycleTime: testCycleTimeScore(testScoreObject.testCycleTime),
                traceability: traceabilityScore(testScoreObject.traceability),
                testingQuality: testingQualityScore(testScoreObject.testingQuality.testingquality),
                testingProductivity: testingProductivityScore(testScoreObject.testingProductivity?.productivityPercentage ?? 0),
                automationTestingProductivity: automationTestingProductivityScore(testScoreObject.automationTestingProductivity?.productivityPercentage ?? 0),
                dla: dlaScore(testScoreObject.dlaObject.dla),
            };

            const operationScoreMetrics = {
                deploymentFrequency: deploymentFrequencyScore(metrics?.deploymentFrequency?.avgDeploymentsPerDay),
                meanTimeToRecovery: meanTimeToRecoveryScore(metrics?.mttr?.mttr),
                changeFailureRate: changeFailureRateScore(metrics?.changeFailureRate?.changeFailureRate),
                leadTimeForChanges: leadTimeForChangesScore(metrics?.leadTime),
            };
            const engineeringScoreLevelOneMetrics = {
                developerScore: engineeringScoreObject?.developerScoreObject?.developerScore || 0,
                testScore: engineeringScoreObject?.testScoreObject?.testScore || 0,
                operationScore: engineeringScoreObject?.operationScoreObject?.operationScore || 0,
            };
            const releaseReadinessScoreMetrics = {
                tasks: tasksScore(releaseReadinessObject.tasks),
                stories: storiesScore(releaseReadinessObject.stories),
                bugs: bugsScore(releaseReadinessObject.bugs),
                epics: epicsScore(releaseReadinessObject.epics),
                burndown: burndownScore(
                    releaseReadinessObject.burndown.burndownPercentage === 0 ? releaseReadinessObject.burndown.burndownHrsPercentage : releaseReadinessObject.burndown.burndownPercentage
                ),
                automationTestResult: automationTestResultScore(releaseReadinessObject.automationTestResult.percentage),
                manualTestResult: manualTestResultScore(releaseReadinessObject.manualTestResult.percentage),
                testCoverage: testCoverageScore(releaseReadinessObject.testCoverage),
            };

            function calculateWeightedScore(metrics, contribution) {
                if (typeof contribution.toObject === 'function') {
                    contribution = contribution.toObject();
                }
                let total = 0;
                for (const key in contribution) {
                    if (metrics[key] !== undefined && contribution[key] >= 0) {
                        total += metrics[key] * (contribution[key] / 100);
                    }
                }
                return total;
            }

            const developerScore = calculateWeightedScore(developerScoreMetrics, metricContribution.engineeringScore.developerScore);
            const testScore = calculateWeightedScore(testScoreMetrics, metricContribution.engineeringScore.testScore);
            const operationScore = calculateWeightedScore(operationScoreMetrics, metricContribution.engineeringScore.operationScore);
            const releaseReadinessScore = calculateWeightedScore(releaseReadinessScoreMetrics, metricContribution.releaseReadiness);
            const engineeringScore = calculateWeightedScore(engineeringScoreLevelOneMetrics, metricContribution.engineeringScore.engineeringScoreLevelOne);
            savedCXO.engineeringScoreObject.developerScoreObject.developerScore = Math.round(developerScore);
            savedCXO.engineeringScoreObject.testScoreObject.testScore = Math.round(testScore);
            savedCXO.engineeringScoreObject.operationScoreObject.operationScore = Math.round(operationScore);
            savedCXO.engineeringScoreObject.engineeringScore = Math.round(engineeringScore);
            releaseReadinessObject.releaseReadiness = Math.round(releaseReadinessScore);

            await CXO.updateOne({ _id: savedCXO._id }, { $set: { engineeringScoreObject: savedCXO.engineeringScoreObject, releaseReadinessObject: releaseReadinessObject } });
            return { savedCXO };
        } catch (error) {
            console.error('Error in updateCXOScores:', error);
            throw error; 
        }
    }
    async getTrendData(matchQuery, reqCount, connection) {
        try {
            const SprintIssue = SprintIssueModel(connection);
            const KanbanIssue = BoardIssueModel(connection);
            const Project = ProjectModel(connection);
            const projectData = await Project.findOne({ _id: matchQuery.projectId });
            const isKanban = projectData?.boardType === 'kanban';

            const IssueModel = isKanban ? KanbanIssue : SprintIssue;
            const pastDates = [...Array(Number(reqCount))].map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - i);
                return date.toISOString().split('T')[0];
            });

            const aggregationPipeline = [
                { $match: matchQuery },
                {
                    $addFields: {
                        formattedDate: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    },
                },
                { $match: { formattedDate: { $in: pastDates } } },
                {
                    $group: {
                        _id: { date: '$formattedDate', type: '$type.name' },
                        count: { $sum: 1 },
                    },
                },
                {
                    $group: {
                        _id: '$_id.date',
                        releaseReadiness: { $push: { name: '$_id.type', count: '$count' } },
                        projectId: { $first: '$projectId' },
                    },
                },
                {
                    $lookup: {
                        from: 'cxos',
                        localField: 'projectId',
                        foreignField: 'projectId',
                        as: 'allCxoData',
                    },
                },
                {
                    $addFields: {
                        cxoData: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: '$allCxoData',
                                        cond: {
                                            // $and: [{ $eq: [{ $dateToString: { format: '%Y-%m-%d', date: '$$this.createdAt' } }, '$_id'] }, { $eq: ['$$this.projectId', matchQuery.projectId] }],
                                            $eq: [{ $dateToString: { format: '%Y-%m-%d', date: '$$this.createdAt' } }, '$_id'],
                                        },
                                    },
                                },
                                as: 'cxo',
                                in: {
                                    dev: {
                                        averageTimeToFix: '$$cxo.engineeringScoreObject.developerScoreObject.timeToFix.averageTimeToFix',
                                        totalCycleTime: '$$cxo.engineeringScoreObject.developerScoreObject.cycleTime.totalCycleTime',
                                        density: '$$cxo.engineeringScoreObject.developerScoreObject.defectDensity.density',
                                        staticCodeAnalysisScore: '$$cxo.engineeringScoreObject.developerScoreObject.combinedScanData.staticCodeAnalysisScore',
                                    },
                                    test: {
                                        testingQuality: '$$cxo.engineeringScoreObject.testScoreObject.testingQuality.testingquality',
                                        defectEscapeRatio: '$$cxo.engineeringScoreObject.testScoreObject.defectEscapeRatio',
                                    },
                                },
                            },
                        },
                    },
                },
                {
                    $addFields: {
                        dev: {
                            $ifNull: [{ $arrayElemAt: ['$cxoData.dev', 0] }, { averageTimeToFix: 0, totalCycleTime: 0, density: 0, staticCodeAnalysisScore: 0 }],
                        },
                        test: {
                            $ifNull: [{ $arrayElemAt: ['$cxoData.test', 0] }, { testingQuality: 0, defectEscapeRatio: 0 }],
                        },
                    },
                },
                { $sort: { _id: -1 } },
                { $project: { _id: 0, date: '$_id', releaseReadiness: 1, dev: 1, test: 1 } },
            ];

            return await IssueModel.aggregate(aggregationPipeline, { allowDiskUse: true });
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}
export default new CxoService();
