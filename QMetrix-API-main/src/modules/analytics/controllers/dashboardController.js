import DashboardContextBuilder from '../services/dashboardContextBuilder.js';
import * as standupLogic from '../../stand-up-management/logic/index.js';
import * as scmLogic from '../../source-code-management/logic/index.js';
import * as testMgmtLogic from '../../test-management/logic/index.js';
import * as jiraLogic from '../../project-management/jira/logic/index.js';
import * as cxoLogic from '../../cxo/logic/index.js';
import { Types } from 'mongoose';
import { redis } from '../../../server.js';
import cache from '../../../utils/cache.js';
import { getStartAndEndDate } from '../../../utils/commonFunctions.js';
import { SPRINT_TYPE, release_Type } from '../../../utils/constants/custumFieldConstants.js';
import {
    STATUS_ACTIVE,
    STATUS_CLOSED,
    RELEASE_STATUS_RELEASED,
    RELEASE_STATUS_UNRELEASED,
} from '../../../utils/constants/statusConstants.js';

class DashboardController {
    async getProjectManagementData(req, res) {
        try {
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId, developer: dev, sections, estimationType } = req.query;
            const developer = (dev === 'UnAssigned' || dev === 'Unassigned') ? null : dev;
            const standupPageRole = (!dev || dev === 'null' || dev === 'undefined') ? 'team' : dev;

            const masterCacheKey = cache.generateKey('projectManagement', {
                companyId, projectId, boardId, sprintId, releaseId, developer, estimationType,
            });
            const requestedSections = sections ? new Set(sections.split(',')) : null;
            try {
                const cached = await redis.get(masterCacheKey);
                if (cached) {
                    let parsed = JSON.parse(cached);
                    if (requestedSections) {
                        const filtered = {};
                        for (const s of requestedSections) {
                            if (s in parsed) { filtered[s] = parsed[s]; }
                        }
                        parsed = filtered;
                    }
                    return res.status(200).json(parsed);
                }
            } catch (e) { /* Redis unavailable */ }

            const builder = new DashboardContextBuilder(req.tenantConnection, {
                companyId, projectId, boardId, sprintId, releaseId, developer,
            });

            let ctx;
            try {
                ctx = await builder.build();
            } catch (buildError) {
                if (buildError.status) { return res.status(buildError.status).json({ error: buildError.message }); }
                throw buildError;
            }

            const matchQueries = builder.getMatchQueryMap();
            const serviceOpts = {
                board: ctx.board, selectedType: ctx.selectedType, IssueModel: ctx.IssueModel,
                connection: ctx.connection, Sprint: builder.Sprint, JiraRelease: builder.JiraRelease,
                startOfDay: ctx.startOfDay, endOfDay: ctx.endOfDay,
            };
            const shouldCompute = (name) => !requestedSections || requestedSections.has(name);

            let alwaysStartOfDay = ctx.startOfDay;
            let alwaysEndOfDay = ctx.endOfDay;
            if (!alwaysStartOfDay && (shouldCompute('taskCount') || shouldCompute('statusCount'))) {
                try {
                    const dates = await getStartAndEndDate(companyId, projectId, ctx.conn);
                    alwaysStartOfDay = dates.startOfDay;
                    alwaysEndOfDay = dates.endOfDay;
                } catch (e) { /* continue without dates */ }
            }

            const needsAllIssues = shouldCompute('velocity') || shouldCompute('spCommittedVsCompleted')
                || shouldCompute('dailyBurnup') || shouldCompute('bugClassification')
                || shouldCompute('taskCount') || shouldCompute('statusCount');
            const needsBugIssues = shouldCompute('defectRejection') || shouldCompute('defectRemovalEfficiency')
                || shouldCompute('bugClassification') || shouldCompute('defectDensity')
                || shouldCompute('timeToFix') || shouldCompute('costOfFixing')
                || shouldCompute('qaInsightsBugs');
            const needsSonarQube = shouldCompute('defectDensity') || shouldCompute('bugClassification');
            const needsCompanyDetails = shouldCompute('costOfFixing');
            const needsLastSix = shouldCompute('velocity') || shouldCompute('cycleTime')
                || shouldCompute('defectDensity') || shouldCompute('defectRejection')
                || shouldCompute('timeToFix') || shouldCompute('bugClassification')
                || shouldCompute('defectLeakage') || shouldCompute('defectRemovalEfficiency')
                || shouldCompute('storyChurn');

            const [allIssues, bugIssues, sonarQubeData, companyDetails, lastSixSprints, lastSixReleases] = await Promise.all([
                needsAllIssues ? builder.getDeduplicatedIssues() : Promise.resolve(null),
                needsBugIssues ? builder.getDeduplicatedBugIssues() : Promise.resolve(null),
                needsSonarQube ? builder.getSonarQubeData() : Promise.resolve(null),
                needsCompanyDetails ? builder.getCompanyDetails() : Promise.resolve(null),
                needsLastSix && sprintId ? builder.getLastSixSprints() : Promise.resolve([]),
                needsLastSix && releaseId ? builder.getLastSixReleases() : Promise.resolve([]),
            ]);

            const params = { companyId, projectId, boardId, sprintId, releaseId, developer, estimationType, standupPageRole };
            const shared = { allIssues, bugIssues, sonarQubeData, companyDetails, alwaysStartOfDay, alwaysEndOfDay, lastSixSprints, lastSixReleases };
            const args = { ctx, builder, params, matchQueries, serviceOpts, shared };

            const tasks = {};

            if (shouldCompute('velocity')) { tasks.velocity = jiraLogic.velocityLogic(args); }
            if (shouldCompute('taskCount')) { tasks.taskCount = jiraLogic.taskCountLogic(args); }
            if (shouldCompute('statusCount')) { tasks.statusCount = jiraLogic.statusCountLogic(args); }
            if (shouldCompute('defectDensity')) { tasks.defectDensity = jiraLogic.defectDensityLogic(args); }
            if (shouldCompute('spCommittedVsCompleted')) { tasks.spCommittedVsCompleted = jiraLogic.spCommittedLogic(args); }
            if (shouldCompute('bugClassification')) { tasks.bugClassification = jiraLogic.bugClassificationLogic(args); }
            if (shouldCompute('defectRejection')) { tasks.defectRejection = jiraLogic.defectRejectionLogic(args); }
            if (shouldCompute('defectRemovalEfficiency')) { tasks.defectRemovalEfficiency = jiraLogic.defectRemovalLogic(args); }
            if (shouldCompute('timeToFix')) { tasks.timeToFix = jiraLogic.timeToFixLogic(args); }
            if (shouldCompute('cycleTime')) { tasks.cycleTime = jiraLogic.cycleTimeLogic(args); }

            let _burndownPromise = null;
            const getBurndownOnce = () => {
                if (!_burndownPromise) { _burndownPromise = jiraLogic.burndownLogic(args); }
                return _burndownPromise;
            };
            if (shouldCompute('burndownData')) { tasks.burndownData = getBurndownOnce(); }
            if (shouldCompute('actualStoryPoints')) {
                tasks.actualStoryPoints = (async () => {
                    const result = await getBurndownOnce();
                    if (!result) { return null; }
                    return { ...result, actualStoryPoints: result.actualStoryPoints || [], mode: result.mode || (sprintId ? SPRINT_TYPE : release_Type) };
                })();
            }

            if (shouldCompute('burndownVelocity')) { tasks.burndownVelocity = jiraLogic.burndownVelocityLogic(args); }
            if (shouldCompute('dailyBurnup')) { tasks.dailyBurnup = jiraLogic.burnupProgressLogic(args); }
            if (shouldCompute('defectLeakage')) { tasks.defectLeakage = jiraLogic.defectLeakageLogic(args); }
            if (shouldCompute('costOfFixing')) { tasks.costOfFixing = jiraLogic.costOfFixingLogic(args); }
            if (shouldCompute('storyChurn')) { tasks.storyChurn = jiraLogic.pmStoryChurnLogic(args); }
            if (shouldCompute('sprintLength')) { tasks.sprintLength = jiraLogic.sprintLengthLogic(args); }
            if (shouldCompute('qaInsightsBugs')) { tasks.qaInsightsBugs = jiraLogic.pmQaInsightsBugsLogic(args); }
            if (shouldCompute('qaInsightsTests')) { tasks.qaInsightsTests = jiraLogic.pmQaInsightsTestsLogic(args); }
            if (shouldCompute('qaReference')) { tasks.qaReference = jiraLogic.pmQaReferenceLogic(args); }
            if (shouldCompute('storyPointData')) { tasks.storyPointData = jiraLogic.storyPointDataLogic(args); }
            if (shouldCompute('availableHours')) { tasks.availableHours = jiraLogic.availableHoursLogic(args); }
            if (shouldCompute('sprintCompleteDate')) { tasks.sprintCompleteDate = jiraLogic.sprintCompleteDateLogic(args); }
            if (shouldCompute('userList')) { tasks.userList = jiraLogic.userListLogic(args); }

            const keys = Object.keys(tasks);
            const results = await Promise.allSettled(Object.values(tasks));
            const dashboardData = {};
            keys.forEach((key, i) => {
                dashboardData[key] = results[i].status === 'fulfilled' ? results[i].value : null;
            });

            if (!requestedSections) {
                try { await redis.set(masterCacheKey, JSON.stringify(dashboardData), 'EX', 28800); } catch (e) { /* Redis unavailable */ }
            }

            return res.status(200).json(dashboardData);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    async getStandupData(req, res) {
        try {
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId, developer: dev, sections } = req.query;
            const developer = (dev === 'UnAssigned' || dev === 'Unassigned') ? null : dev;
            const standupPageRole = (!dev || dev === 'null' || dev === 'undefined') ? 'team' : dev;

            const masterCacheKey = cache.generateKey('standupDashboard', {
                v: 2,
                companyId, projectId, boardId, sprintId, releaseId, developer,
            });
            const requestedSections = sections ? new Set(sections.split(',')) : null;
            try {
                const cached = await redis.get(masterCacheKey);
                if (cached) {
                    let parsed = JSON.parse(cached);
                    if (requestedSections) {
                        const filtered = {};
                        for (const s of requestedSections) {
                            if (s in parsed) { filtered[s] = parsed[s]; }
                        }
                        parsed = filtered;
                    }
                    return res.status(200).json(parsed);
                }
            } catch (e) { /* Redis unavailable */ }

            const builder = new DashboardContextBuilder(req.tenantConnection, {
                companyId, projectId, boardId, sprintId, releaseId, developer,
            });

            let ctx;
            try {
                ctx = await builder.build();
            } catch (buildError) {
                if (buildError.status) { return res.status(buildError.status).json({ error: buildError.message }); }
                throw buildError;
            }

            const matchQueries = builder.getMatchQueryMap();
            const shouldCompute = (name) => !requestedSections || requestedSections.has(name);

            const params = { companyId, projectId, boardId, sprintId, releaseId, developer, standupPageRole };
            const args = { ctx, builder, params, matchQueries };

            const tasks = {};

            if (shouldCompute('jiraData')) { tasks.jiraData = standupLogic.jiraTableLogic(args); }
            if (shouldCompute('storyChurn')) { tasks.storyChurn = standupLogic.storyChurnLogic(args); }
            if (shouldCompute('storyChurnExcludingBugs')) { tasks.storyChurnExcludingBugs = standupLogic.storyChurnExcludingBugsLogic(args); }
            if (shouldCompute('jiraStatusByDev')) { tasks.jiraStatusByDev = standupLogic.jiraStatusByDevLogic(args); }
            if (shouldCompute('standupBurndown')) { tasks.standupBurndown = standupLogic.standupBurndownLogic(args); }
            if (shouldCompute('openPRs')) { tasks.openPRs = scmLogic.standupOpenPRsLogic(args); }
            if (shouldCompute('mergedWithoutReview')) { tasks.mergedWithoutReview = scmLogic.standupMergedPRsLogic(args); }
            if (shouldCompute('qaInsightsBugs')) { tasks.qaInsightsBugs = testMgmtLogic.qaInsightsBugsLogic(args); }
            if (shouldCompute('qaInsightsTests')) { tasks.qaInsightsTests = testMgmtLogic.qaInsightsTestsLogic(args); }
            if (shouldCompute('qaReference')) { tasks.qaReference = testMgmtLogic.qaReferenceLogic(args); }
            if (shouldCompute('lastSynced')) { tasks.lastSynced = jiraLogic.lastSyncedLogic(args); }
            if (shouldCompute('roleRatesAndStoryPoints')) { tasks.roleRatesAndStoryPoints = jiraLogic.roleRatesLogic(args); }
            if (shouldCompute('boardList')) { tasks.boardList = jiraLogic.boardListLogic(args); }
            if (shouldCompute('dailyBurnup')) { tasks.dailyBurnup = jiraLogic.dailyBurnupLogic(args); }

            const keys = Object.keys(tasks);
            const results = await Promise.allSettled(Object.values(tasks));
            const standupData = {};
            keys.forEach((key, i) => {
                standupData[key] = results[i].status === 'fulfilled' ? results[i].value : null;
            });

            if (!requestedSections) {
                try { await redis.set(masterCacheKey, JSON.stringify(standupData), 'EX', 28800); } catch (e) { /* Redis unavailable */ }
            }

            return res.status(200).json(standupData);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    async getGitData(req, res) {
        try {
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId, developer: dev, repo, sections } = req.query;
            const developer = (dev === 'UnAssigned' || dev === 'Unassigned') ? null : dev;

            const masterCacheKey = cache.generateKey('gitDashboard', {
                companyId, projectId, boardId, sprintId, releaseId, developer, repo,
            });
            const requestedSections = sections ? new Set(sections.split(',')) : null;
            try {
                const cached = await redis.get(masterCacheKey);
                if (cached) {
                    let parsed = JSON.parse(cached);
                    if (requestedSections) {
                        const filtered = {};
                        for (const s of requestedSections) {
                            if (s in parsed) { filtered[s] = parsed[s]; }
                        }
                        parsed = filtered;
                    }
                    return res.status(200).json(parsed);
                }
            } catch (e) { /* Redis unavailable */ }

            const builder = new DashboardContextBuilder(req.tenantConnection, {
                companyId, projectId, boardId, sprintId, releaseId, developer,
            });

            let ctx;
            try {
                ctx = await builder.build();
            } catch (buildError) {
                if (buildError.status) { return res.status(buildError.status).json({ error: buildError.message }); }
                throw buildError;
            }
            const shouldCompute = (name) => !requestedSections || requestedSections.has(name);

            const boardObjId = new Types.ObjectId(boardId);
            const prQuery = { projectId, companyId };
            if (repo) { prQuery.repo = repo; }

            const [allPullRequests, gitConnections, allSprints, allReleases] = await Promise.all([
                builder.PullRequest.find(prQuery, {
                    title: 1, prId: 1, prNumber: 1, prCreatedAt: 1, prClosedAt: 1, prMergedAt: 1,
                    prCreatedBy: 1, prMergedBy: 1, status: 1, merged: 1, repo: 1,
                    branchName: 1, reviews: 1, filesChanged: 1, linesAdded: 1, linesDeleted: 1,
                    mergeable: 1, sprintId: 1, fixVersion: 1, boardId: 1,
                    hasSensitiveChanges: 1, sensitiveFiles: 1, missingTests: 1,
                    commits: 1,
                }).lean(),
                builder.getGitConnections(),
                builder.Sprint.find({
                    companyId, projectId, boardId: boardObjId,
                    state: { $in: [STATUS_ACTIVE, STATUS_CLOSED] },
                }, { name: 1, startDate: 1, endDate: 1, state: 1, releases: 1 }).lean(),
                builder.JiraRelease.find({
                    companyId, projectId, boardId: boardObjId,
                    status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] },
                }, { releaseName: 1, startDate: 1, releaseDate: 1, status: 1 }).lean(),
            ]);

            const params = { companyId, projectId, boardId, sprintId, releaseId, developer, repo };
            const shared = { allPullRequests, gitConnections, allSprints, allReleases };
            const args = { ctx, builder, params, shared };

            const tasks = {};

            if (shouldCompute('closedPRs')) { tasks.closedPRs = scmLogic.closedPRsLogic(args); }
            if (shouldCompute('openPRs')) { tasks.openPRs = scmLogic.openPRsLogic(args); }
            if (shouldCompute('totalPRs')) { tasks.totalPRs = scmLogic.totalPRsLogic(args); }
            if (shouldCompute('mergedWithoutReview')) { tasks.mergedWithoutReview = scmLogic.mergedWithoutReviewLogic(args); }
            if (shouldCompute('prSize')) { tasks.prSize = scmLogic.prSizeLogic(args); }
            if (shouldCompute('gitCycleTime')) { tasks.gitCycleTime = scmLogic.gitCycleTimeLogic(args); }
            if (shouldCompute('approvalRate')) { tasks.approvalRate = scmLogic.approvalRateLogic(args); }
            if (shouldCompute('iterationTime')) { tasks.iterationTime = scmLogic.iterationTimeLogic(args); }
            if (shouldCompute('leadTime')) { tasks.leadTime = scmLogic.leadTimeLogic(args); }
            if (shouldCompute('doraMetrics')) { tasks.doraMetrics = scmLogic.doraMetricsLogic(args); }

            const keys = Object.keys(tasks);
            const results = await Promise.allSettled(Object.values(tasks));
            const gitData = {};
            keys.forEach((key, i) => {
                gitData[key] = results[i].status === 'fulfilled' ? results[i].value : null;
            });

            if (!requestedSections) {
                try { await redis.set(masterCacheKey, JSON.stringify(gitData), 'EX', 28800); } catch (e) { /* Redis unavailable */ }
            }

            return res.status(200).json(gitData);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    async getCXOData(req, res) {
        try {
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId, pageValue, sections } = req.query;

            const masterCacheKey = cache.generateKey('cxoDashboard', {
                companyId, projectId, boardId, sprintId, releaseId, pageValue,
            });
            const requestedSections = sections ? new Set(sections.split(',')) : null;
            try {
                const cached = await redis.get(masterCacheKey);
                if (cached) {
                    let parsed = JSON.parse(cached);
                    if (requestedSections) {
                        const filtered = {};
                        for (const s of requestedSections) {
                            if (s in parsed) { filtered[s] = parsed[s]; }
                        }
                        parsed = filtered;
                    }
                    return res.status(200).json(parsed);
                }
            } catch (e) { /* Redis unavailable */ }

            const builder = new DashboardContextBuilder(req.tenantConnection, {
                companyId, projectId, boardId, sprintId, releaseId, developer: null,
            });

            let ctx;
            try {
                ctx = await builder.build();
            } catch (buildError) {
                if (buildError.status) { return res.status(buildError.status).json({ error: buildError.message }); }
                throw buildError;
            }
            const shouldCompute = (name) => !requestedSections || requestedSections.has(name);

            let releaseData = null;
            if (releaseId && ctx.selectedType) {
                releaseData = ctx.selectedType;
            }

            const params = { companyId, projectId, boardId, sprintId, releaseId, pageValue };
            const shared = { releaseData };
            const args = { ctx, builder, params, shared };

            const tasks = {};

            if (shouldCompute('cxoData')) { tasks.cxoData = cxoLogic.cxoDataLogic(args); }
            if (shouldCompute('cxoTrends')) { tasks.cxoTrends = cxoLogic.cxoTrendsLogic(args); }

            const keys = Object.keys(tasks);
            const results = await Promise.allSettled(Object.values(tasks));
            const cxoData = {};
            keys.forEach((key, i) => {
                cxoData[key] = results[i].status === 'fulfilled' ? results[i].value : null;
            });

            if (!requestedSections) {
                try { await redis.set(masterCacheKey, JSON.stringify(cxoData), 'EX', 28800); } catch (e) { /* Redis unavailable */ }
            }

            return res.status(200).json(cxoData);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
}

export default new DashboardController();
