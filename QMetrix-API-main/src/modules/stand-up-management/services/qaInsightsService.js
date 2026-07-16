/* eslint-disable eqeqeq */
import { SprintIssueModel, JiraReleaseModel, BoardIssueModel, SprintModel, BoardModel, BacklogIssueModel } from '../../project-management/jira/model';
import { ConnectionModel } from '../../connection/model';
import { Types } from 'mongoose';
import { getStartAndEndDate } from '../../../utils/commonFunctions';
import { redis } from '../../../server.js';
import cache from '../../../utils/cache.js';
import { TestRailMilestoneModel } from '../../test-management/testrail/model';
import { XrayExecutionModel } from '../../test-management/xray/model.js';
import { PROVIDER_NAME_JIRA, PROVIDER_NAME_GITLAB_ISSUES } from '../../../utils/constants/providerConstants.js';
import { STATUS_ACTIVE } from '../../../utils/constants/statusConstants.js';

class QAInsightsService {
    async getBugs(projectId, companyId, boardId, sprintId, releaseId, developer, tenantConnection) {
        try {
            const cacheKey = cache.generateKey('getBugs', {
                projectId,
                companyId,
                boardId,
                sprintId,
                releaseId,
                developer,
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
            const Connection = ConnectionModel(tenantConnection);
            const sprintIssue = SprintIssueModel(tenantConnection);
            const kandbanIssue = BoardIssueModel(tenantConnection);
            const JiraReleases = JiraReleaseModel(tenantConnection);
            const Sprint = SprintModel(tenantConnection);
            const Board = BoardModel(tenantConnection);

            const cred = await Connection.findOne({ companyId, name: { $in: [PROVIDER_NAME_JIRA, PROVIDER_NAME_GITLAB_ISSUES] } });
            if (!cred) {
                throw new Error('Jira or GitLab Issues connection not found.');
            }

            const board = await this.validateBoard(Board, boardId, companyId, projectId);
            const isKanban = board?.boardType.toLowerCase() === 'kanban' || board?.boardType.toLowerCase() === 'gitlab-board';

            const filter = this.buildBugFilter(projectId, companyId, developer);
            let releaseName = null;

            if (releaseId) {
                releaseName = await this.addReleaseFilter(JiraReleases, filter, releaseId, companyId);
            } else if (sprintId) {
                await this.addSprintFilter(Sprint, filter, sprintId, companyId, projectId, tenantConnection);
            } else {
                throw new Error('Either Sprint ID or Release ID is required.');
            }

            const IssueModel = isKanban ? kandbanIssue : sprintIssue;
            const bugs = await this.fetchBugs(IssueModel, filter);
            if (releaseId) {
                const BacklogIssue = BacklogIssueModel(tenantConnection);
                const backlogFilter = {
                    projectId: new Types.ObjectId(projectId),
                    companyId: new Types.ObjectId(companyId),
                    boardId: new Types.ObjectId(boardId),
                    fixVersion: releaseName,
                    'type.name': 'Bug',
                };

                if (developer && developer !== 'UnAssigned') {
                    backlogFilter.assignee = developer;
                }

                const backlogBugs = await BacklogIssue.aggregate([
                    { $match: backlogFilter },
                    { $sort: { issueCreatedAt: -1 } },
                    {
                        $group: {
                            _id: '$issueId',
                            latestTicket: { $first: '$$ROOT' },
                        },
                    },
                    { $replaceRoot: { newRoot: '$latestTicket' } },
                ], { allowDiskUse: true });

                // Add BacklogIssue results to existing bugs
                bugs.push(...backlogBugs);
            }

            // Deduplicate bugs by issueId, keeping the latest one (same pattern as jiraTable)
            const latestIssueMap = new Map();
            bugs.forEach((issue) => {
                const issueDate = issue.createdAt || issue.issueCreatedAt;
                if (issue.issueId) {
                    const existingIssue = latestIssueMap.get(issue.issueId);
                    if (!existingIssue) {
                        latestIssueMap.set(issue.issueId, issue);
                    } else {
                        const existingDate = existingIssue.createdAt || existingIssue.issueCreatedAt;
                        if (issueDate && existingDate && new Date(issueDate) > new Date(existingDate)) {
                            latestIssueMap.set(issue.issueId, issue);
                        }
                    }
                }
            });
            bugs.length = 0;
            bugs.push(...Array.from(latestIssueMap.values()));

            const bugAnalysis = this.analyzeBugs(bugs);

            try {
                await redis.set(cacheKey, JSON.stringify(bugAnalysis), 'EX', 28000);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }

            return bugAnalysis;
        } catch (error) {
            console.error('Error in getBugs service:', error);
            throw error;
        }
    }

    async validateBoard(Board, boardId, companyId, projectId) {
        const board = await Board.findOne({
            _id: new Types.ObjectId(boardId),
            companyId: new Types.ObjectId(companyId),
            projectId: new Types.ObjectId(projectId)
        }, { boardType: 1 });

        if (!board) {
            throw new Error('Board not found.');
        }

        return board;
    }

    buildBugFilter(projectId, companyId, developer) {
        const filter = { 
            projectId: new Types.ObjectId(projectId), 
            companyId: new Types.ObjectId(companyId), 
            'type.name': 'Bug'
        };

        if (developer === null) {
            filter.assignee = { 
                $in: [null, 'Unassigned', 'UnAssigned', ''] 
            };
        } else if (developer) {
            filter.assignee = developer;
        }

        return filter;
    }

    async addReleaseFilter(JiraReleases, filter, releaseId, companyId) {
        const release = await JiraReleases.findOne({ _id: releaseId, companyId });
        if (!release) {
            throw new Error('Release not found');
        }
        filter.fixVersion = release.releaseName;
        return release.releaseName;
    }

    async addSprintFilter(Sprint, filter, sprintId, companyId, projectId, tenantConnection) {
        const selectedType = await Sprint.findOne({ companyId, projectId, _id: sprintId });
        if (selectedType.state.toLowerCase() === STATUS_ACTIVE) {
            const { startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, tenantConnection);
            filter.createdAt = { $gte: startOfDay, $lt: endOfDay };
        }
        filter.sprintId = { $in: [new Types.ObjectId(sprintId)] };
    }

    async fetchBugs(IssueModel, filter) {
        return await IssueModel.aggregate([
            { $match: filter },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$issueId',
                    latestTicket: { $first: '$$ROOT' },
                },
            },
            { $replaceRoot: { newRoot: '$latestTicket' } },
        ], { allowDiskUse: true });
    }

    analyzeBugs(bugs) {
        const totalBugs = bugs.length;
        const closedBugs = this.getClosedBugs(bugs);
        const openBugs = totalBugs - closedBugs;

        const manualBugs = this.getManualTestingBugs(bugs);
        const automationBugs = this.getAutomationTestingBugs(bugs);
        const productionBugs = this.getProductionBugs(bugs);

        const manualSegregation = this.categorizeByPriority(manualBugs);
        const automationSegregation = this.categorizeByPriority(automationBugs);
        const productionSegregation = this.categorizeByPriority(productionBugs);

        const totalSegregation = manualSegregation.total + automationSegregation.total + productionSegregation.total;

        return {
            issueCount: {
                total: totalBugs,
                open: openBugs,
                closed: closedBugs
            },
            segregationBy: {
                total: totalSegregation,
                manual: manualSegregation,
                automation: automationSegregation,
                production: productionSegregation
            }
        };
    }

    getClosedBugs(bugs) {
        return bugs.filter(bug => {
            const statusName = bug.status?.name?.toLowerCase();
            const closedStatuses = ['done', 'resolved', 'closed', 'completed', 'verified'];
            return closedStatuses.includes(statusName);
        }).length;
    }

    getManualTestingBugs(bugs) {
        return bugs.filter(bug => {
            const summary = bug.summary?.toLowerCase() || '';
            
            // Check for UAT in labels (all possible ways)
            const hasUAT = bug.label?.some(label => {
                const lowerLabel = label.toLowerCase();
                return lowerLabel.includes('uat') || 
                       lowerLabel.includes('uat bug') ||
                       lowerLabel.includes('uat-bug') ||
                       lowerLabel.includes('uat_bug') ||
                       lowerLabel.includes('uatbug') ||
                       lowerLabel === 'uat';
            });

            // If bug has UAT, check for manual keywords
            if (hasUAT) {
                // Check labels for manual keywords
                const hasManualLabel = bug.label?.some(label => {
                    const lowerLabel = label.toLowerCase();
                    return lowerLabel.includes('man') || 
                           lowerLabel.includes('manual') || 
                           lowerLabel.includes('qa');
                });

                if (hasManualLabel) {
                    return true;
                }

                // Check summary for manual keywords
                const hasManualKeywords = summary.includes('man') || 
                                        summary.includes('manual') ||
                                        summary.includes('qa');

                return hasManualKeywords;
            }

            // Original logic: if no UAT, check for manual keywords directly
            const hasManualLabel = bug.label?.some(label => 
                label.toLowerCase().includes('man') || 
                label.toLowerCase().includes('manual') || 
                label.toLowerCase().includes('qa')
            );

            if (hasManualLabel) {
                return true;
            }

            const hasManualKeywords = summary.includes('man') || 
                                    summary.includes('manual') ||
                                    summary.includes('qa');

            return hasManualKeywords;
        });
    }

    getAutomationTestingBugs(bugs) {
        return bugs.filter(bug => {
            const summary = bug.summary?.toLowerCase() || '';
            
            // Check for UAT in labels (all possible ways)
            const hasUAT = bug.label?.some(label => {
                const lowerLabel = label.toLowerCase();
                return lowerLabel.includes('uat') || 
                       lowerLabel.includes('uat bug') ||
                       lowerLabel.includes('uat-bug') ||
                       lowerLabel.includes('uat_bug') ||
                       lowerLabel.includes('uatbug') ||
                       lowerLabel === 'uat';
            });

            // If bug has UAT, check for automation keywords
            if (hasUAT) {
                // Check labels for automation keywords
                const hasAutomationLabel = bug.label?.some(label => {
                    const lowerLabel = label.toLowerCase();
                    return lowerLabel.includes('auto') || 
                           lowerLabel.includes('automation');
                });

                if (hasAutomationLabel) {
                    return true;
                }

                // Check summary for automation keywords
                const hasAutomationKeywords = summary.includes('auto') || 
                                            summary.includes('automation');

                return hasAutomationKeywords;
            }

            // Original logic: if no UAT, check for automation keywords directly
            const hasAutomationLabel = bug.label?.some(label => 
                label.toLowerCase().includes('auto') || 
                label.toLowerCase().includes('automation')
            );

            if (hasAutomationLabel) {
                return true;
            }

            const hasAutomationKeywords = summary.includes('auto') || 
                                        summary.includes('automation');

            return hasAutomationKeywords;
        });
    }

    getProductionBugs(bugs) {
        return bugs.filter(bug => {
            const hasProductionLabel = bug.label?.some(label => 
                label.toLowerCase().includes('prod') || 
                label.toLowerCase().includes('production')
            );

            if (hasProductionLabel) {
                return true;
            }

            const summary = bug.summary?.toLowerCase() || '';
            const hasProductionKeywords = summary.includes('prod') || 
                                        summary.includes('production');

            return hasProductionKeywords;
        });
    }

    categorizeByPriority(bugList) {
        return {
            total: bugList.length,
            critical: bugList.filter(bug => bug.priority?.toLowerCase() === 'highest' || bug.priority?.toLowerCase() === 'critical').length,
            major: bugList.filter(bug => bug.priority?.toLowerCase() === 'high' || bug.priority?.toLowerCase() === 'major').length,
            medium: bugList.filter(bug => bug.priority?.toLowerCase() === 'medium').length,
            minor: bugList.filter(bug => bug.priority?.toLowerCase() === 'low' || bug.priority?.toLowerCase() === 'minor').length,
            invalid: bugList.filter(bug => {
                const customFields = bug.customFieldsByName || {};
                const bugRootCause = customFields['Bug Root Cause'];
                return customFields['Is the bug Valid'] === 'No' || 
                       (typeof bugRootCause === 'string' && bugRootCause.toLowerCase().includes('invalid'));
            }).length
        };
    }

    async getTests(projectId, companyId, boardId, sprintId, releaseId, tenantConnection) {
        try {
            const cacheKey = cache.generateKey('getTests', {
                projectId,
                companyId,
                boardId,
                sprintId,
                releaseId,
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

            const Board = BoardModel(tenantConnection);
            const TestRailMilestone = TestRailMilestoneModel(tenantConnection);
            const XrayExecution = XrayExecutionModel(tenantConnection);

            await this.validateBoard(Board, boardId, companyId, projectId);

            const buildBaseFilter = (additionalFilter = {}) => {
                const baseFilter = {
                    companyId: new Types.ObjectId(companyId),
                    jiraProjectId: new Types.ObjectId(projectId),
                    boardId: new Types.ObjectId(boardId),
                    ...additionalFilter,
                };
                return baseFilter;
            };

            // Try TestRail first
            let testMilestones = await this.fetchTestRailData(TestRailMilestone, buildBaseFilter, sprintId, releaseId);
            
            // If no TestRail data, try Xray
            if (!testMilestones || testMilestones.length === 0) {
                testMilestones = await this.fetchXrayData(XrayExecution, buildBaseFilter, sprintId, releaseId);
            }

            if (!testMilestones || testMilestones.length === 0) {
                return {
                    manualMetrics: {
                        new: 0,
                        executed: 0,
                        passPercent: 0,
                    },
                    automationMetrics: {
                        new: 0,
                        executed: 0,
                        passPercent: 0,
                    },
                    coverage: {
                        automatedCases: 0,
                        regression: 0,
                    },
                };
            }

            const result = this.analyzeTests(testMilestones);

            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 28000);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }

            return result;
        } catch (error) {
            console.error('Error in getTests service:', error);
            throw error;
        }
    }

    async fetchTestRailData(TestRailMilestone, buildBaseFilter, sprintId, releaseId) {
        let testMilestones = [];

        if (sprintId) {
            const milestoneFilter = buildBaseFilter({
                sprintId: new Types.ObjectId(sprintId),
            });
            
            // Use aggregation to get latest milestone per milestoneId (deduplicate)
            testMilestones = await TestRailMilestone.aggregate([
                { $match: milestoneFilter },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: '$milestoneId',
                        latestMilestone: { $first: '$$ROOT' },
                    },
                },
                { $replaceRoot: { newRoot: '$latestMilestone' } },
            ], { allowDiskUse: true });

            const milestoneIds = new Set(testMilestones.map((m) => m.milestoneId).filter(Boolean));
            const processedParentIds = new Set();

            for (const milestone of [...testMilestones]) {
                if (!milestone.parentId || milestone.parentId === null || milestone.parentId === undefined) {
                    if (milestone.milestoneId && !processedParentIds.has(milestone.milestoneId)) {
                        processedParentIds.add(milestone.milestoneId);

                        const subMilestoneFilter = buildBaseFilter({
                            parentId: milestone.milestoneId,
                        });

                        // Also deduplicate sub-milestones
                        const subMilestones = await TestRailMilestone.aggregate([
                            { $match: subMilestoneFilter },
                            { $sort: { createdAt: -1 } },
                            {
                                $group: {
                                    _id: '$milestoneId',
                                    latestMilestone: { $first: '$$ROOT' },
                                },
                            },
                            { $replaceRoot: { newRoot: '$latestMilestone' } },
                        ], { allowDiskUse: true });

                        if (subMilestones && subMilestones.length > 0) {
                            subMilestones.forEach((sub) => {
                                if (sub.milestoneId && !milestoneIds.has(sub.milestoneId)) {
                                    testMilestones.push(sub);
                                    milestoneIds.add(sub.milestoneId);
                                }
                            });
                        }
                    }
                }
            }
        } else if (releaseId) {
            const milestoneFilter = buildBaseFilter({
                releaseId: new Types.ObjectId(releaseId),
            });

            const parentIdConditions = [{ parentId: null }, { parentId: { $exists: false } }];

            if (milestoneFilter.$or) {
                milestoneFilter.$and = [{ $or: milestoneFilter.$or }, { $or: parentIdConditions }];
                delete milestoneFilter.$or;
            } else {
                milestoneFilter.$or = parentIdConditions;
            }

            // Use aggregation to get latest milestone per milestoneId (deduplicate)
            testMilestones = await TestRailMilestone.aggregate([
                { $match: milestoneFilter },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: '$milestoneId',
                        latestMilestone: { $first: '$$ROOT' },
                    },
                },
                { $replaceRoot: { newRoot: '$latestMilestone' } },
            ], { allowDiskUse: true });

            const milestoneIds = new Set(testMilestones.map((m) => m.milestoneId).filter(Boolean));
            const processedParentIds = new Set();

            for (const milestone of testMilestones) {
                if (milestone.milestoneId && !processedParentIds.has(milestone.milestoneId)) {
                    processedParentIds.add(milestone.milestoneId);
                    const subMilestoneFilter = buildBaseFilter({
                        parentId: milestone.milestoneId,
                    });

                    // Also deduplicate sub-milestones
                    const subMilestones = await TestRailMilestone.aggregate([
                        { $match: subMilestoneFilter },
                        { $sort: { createdAt: -1 } },
                        {
                            $group: {
                                _id: '$milestoneId',
                                latestMilestone: { $first: '$$ROOT' },
                            },
                        },
                        { $replaceRoot: { newRoot: '$latestMilestone' } },
                    ], { allowDiskUse: true });

                    if (subMilestones && subMilestones.length > 0) {
                        subMilestones.forEach((sub) => {
                            if (sub.milestoneId && !milestoneIds.has(sub.milestoneId)) {
                                testMilestones.push(sub);
                                milestoneIds.add(sub.milestoneId);
                            }
                        });
                    }
                }
            }
        } else {
            throw new Error('Either Sprint ID or Release ID is required.');
        }

        return testMilestones;
    }

    async fetchXrayData(XrayExecution, buildBaseFilter, sprintId, releaseId) {
        const filter = buildBaseFilter();

        if (sprintId) {
            filter.sprintId = new Types.ObjectId(sprintId);
        } else if (releaseId) {
            filter.releaseId = new Types.ObjectId(releaseId);
        } else {
            throw new Error('Either Sprint ID or Release ID is required.');
        }

        // Fetch Xray executions (similar structure to TestRail milestones)
        const xrayExecutions = await XrayExecution.aggregate([
            { $match: filter },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$testExecKey',
                    latestExecution: { $first: '$$ROOT' },
                },
            },
            { $replaceRoot: { newRoot: '$latestExecution' } },
        ], { allowDiskUse: true });
        
        return xrayExecutions;
    }

    analyzeTests(testMilestones) {
        const allManualRuns = [];
        const allAutomationRuns = [];

        testMilestones.forEach(milestone => {
            if (Array.isArray(milestone.manualRuns)) {
                allManualRuns.push(...milestone.manualRuns);
            }
            if (Array.isArray(milestone.automationRuns)) {
                allAutomationRuns.push(...milestone.automationRuns);
            }
        });

        const manualMetrics = this.calculateTestMetrics(allManualRuns, 'manual');

        const automationMetrics = this.calculateTestMetrics(allAutomationRuns, 'automation');

        const coverageMetrics = this.calculateCoverageMetrics(testMilestones);

        return {
            manualMetrics,
            automationMetrics,
            coverage: coverageMetrics,
        };
    }

    calculateTestMetrics(runs, type) {
        if (!runs || runs.length === 0) {
            return {
                new: 0,
                executed: 0,
                passPercent: 0,
            };
        }

        let newCount = 0;
        runs.forEach(run => {
            if (run.testCaseMetrics && run.testCaseMetrics.newlyAddedCasesCount) {
                newCount += run.testCaseMetrics.newlyAddedCasesCount;
            }
        });

        let executed = 0;
        let passed = 0;
        let totalPassPercentage = 0;
        let runsWithPercentage = 0;

        runs.forEach(run => {
            const runExecuted = (run.passed_count || 0) + 
                               (run.failed_count || 0) + 
                               (run.retest_count || 0) + 
                               (run.blocked_count || 0);
            executed += runExecuted;
            passed += run.passed_count || 0;
            
            if (type === 'manual' && run.manual_percentage != null) {
                totalPassPercentage += run.manual_percentage;
                runsWithPercentage++;
            } else if (type === 'automation' && run.automation_percentage != null) {
                totalPassPercentage += run.automation_percentage;
                runsWithPercentage++;
            } else if (run.pass_percentage != null) {
                totalPassPercentage += run.pass_percentage;
                runsWithPercentage++;
            }
        });

        let passPercent = 0;
        if (runsWithPercentage > 0) {
            passPercent = Math.round(totalPassPercentage / runsWithPercentage);
        } else if (executed > 0) {
            passPercent = Math.round((passed / executed) * 100);
        }

        return {
            new: newCount,
            executed,
            passPercent,
        };
    }

    calculateCoverageMetrics(testMilestones) {
        let automatedCases = 0;
        let regressionCases = 0;

        testMilestones.forEach(milestone => {
            if (Array.isArray(milestone.manualRuns)) {
                milestone.manualRuns.forEach(run => {
                    if (run.testCaseMetrics && run.testCaseMetrics.automatedCasesCount) {
                        automatedCases += run.testCaseMetrics.automatedCasesCount;
                    }

                    const runName = (run.name || '').toLowerCase();
                    if (runName.includes('regression')) {
                        const totalInRun = (run.passed_count || 0) + 
                                          (run.failed_count || 0) + 
                                          (run.untested_count || 0) + 
                                          (run.blocked_count || 0) + 
                                          (run.retest_count || 0);
                        regressionCases += totalInRun;
                    }
                });
            }

            if (Array.isArray(milestone.automationRuns)) {
                milestone.automationRuns.forEach(run => {
                    if (run.testCaseMetrics && run.testCaseMetrics.automatedCasesCount) {
                        automatedCases += run.testCaseMetrics.automatedCasesCount;
                    }

                    const runName = (run.name || '').toLowerCase();
                    if (runName.includes('regression')) {
                        const totalInRun = (run.passed_count || 0) + 
                                          (run.failed_count || 0) + 
                                          (run.untested_count || 0) + 
                                          (run.blocked_count || 0) + 
                                          (run.retest_count || 0);
                        regressionCases += totalInRun;
                    }
                });
            }
        });

        return {
            automatedCases,
            regression: regressionCases,
        };
    }
}

export default new QAInsightsService();
