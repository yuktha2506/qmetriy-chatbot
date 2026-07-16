import { Types } from 'mongoose';
import { TestRailMilestoneModel } from '../../test-management/testrail/model.js';
import { XrayExecutionModel } from '../../test-management/xray/model.js';
import cache from '../../../utils/cache.js';
import { redis } from '../../../server.js';
class QARefrenceService {
    async getQARefrenceData(companyId, projectId, boardId, sprintId, releaseId, connection) {
        try {
            const cacheKey = cache.generateKey('qaRefrence', {
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

            const TestRailMilestone = TestRailMilestoneModel(connection);
            const XrayExecution = XrayExecutionModel(connection);

            const buildBaseFilter = (additionalFilter = {}) => {
                const baseFilter = {
                    companyId: new Types.ObjectId(companyId),
                    jiraProjectId: new Types.ObjectId(projectId),
                    ...additionalFilter,
                };

                if (boardId) {
                    baseFilter.$or = [{ boardId: new Types.ObjectId(boardId) }, { boardId: null }, { boardId: { $exists: false } }];
                }

                return baseFilter;
            };

            // Try TestRail first
            let milestones = await this.fetchTestRailMilestones(TestRailMilestone, buildBaseFilter, sprintId, releaseId);
            
            // If no TestRail data, try Xray
            if (!milestones || milestones.length === 0) {
                milestones = await this.fetchXrayExecutions(XrayExecution, buildBaseFilter, sprintId, releaseId);
            }

            if (!milestones || milestones.length === 0) {
                return null;
            }

            // Calculate metrics (works for both TestRail and Xray)
            let totalReferences = 0;
            let casesWithReferences = 0;
            let casesWithoutReferences = 0;
            let automatedCasesCount = 0;
            let testsToBeAutomatedCount = 0;
            const uniqueRefs = new Set();

            for (const milestone of milestones) {
                const hasExecutionMetrics = !!milestone.testCaseMetrics;
                // Use execution-level testCaseMetrics if available (Xray)
                if (hasExecutionMetrics) {
                    totalReferences += milestone.testCaseMetrics.references || 0;
                    casesWithReferences += milestone.testCaseMetrics.casesWithReferences || 0;
                    casesWithoutReferences += milestone.testCaseMetrics.casesWithoutReferences || 0;
                    automatedCasesCount += milestone.testCaseMetrics.automatedCasesCount || 0;
                    testsToBeAutomatedCount += milestone.testCaseMetrics.testsToBeAutomatedCount || 0;
                } else if (milestone.totalReferences) {
                    // Use execution-level totalReferences only when testCaseMetrics isn't present
                    totalReferences += milestone.totalReferences;
                }

                if (milestone.manualRuns && Array.isArray(milestone.manualRuns)) {
                    for (const run of milestone.manualRuns) {
                        if (run.testCaseMetrics && !hasExecutionMetrics) {
                            totalReferences += run.testCaseMetrics.references || 0;
                            casesWithReferences += run.testCaseMetrics.casesWithReferences || 0;
                            casesWithoutReferences += run.testCaseMetrics.casesWithoutReferences || 0;
                            automatedCasesCount += run.testCaseMetrics.automatedCasesCount || 0;
                            testsToBeAutomatedCount += run.testCaseMetrics.testsToBeAutomatedCount || 0;
                        }

                        // Handle refs (TestRail) or storyKey (Xray)
                        const refs = run.refs || run.storyKey;
                        if (refs) {
                            const refsArray = refs
                                .split(',')
                                .map((ref) => ref.trim())
                                .filter((ref) => ref);
                            refsArray.forEach((ref) => uniqueRefs.add(ref));
                        }
                    }
                }

                if (milestone.automationRuns && Array.isArray(milestone.automationRuns)) {
                    for (const run of milestone.automationRuns) {
                        if (run.testCaseMetrics && !hasExecutionMetrics) {
                            totalReferences += run.testCaseMetrics.references || 0;
                            casesWithReferences += run.testCaseMetrics.casesWithReferences || 0;
                            casesWithoutReferences += run.testCaseMetrics.casesWithoutReferences || 0;
                            automatedCasesCount += run.testCaseMetrics.automatedCasesCount || 0;
                            testsToBeAutomatedCount += run.testCaseMetrics.testsToBeAutomatedCount || 0;
                        }

                        // Handle refs (TestRail) or storyKey (Xray)
                        const refs = run.refs || run.storyKey;
                        if (refs) {
                            const refsArray = refs
                                .split(',')
                                .map((ref) => ref.trim())
                                .filter((ref) => ref);
                            refsArray.forEach((ref) => uniqueRefs.add(ref));
                        }
                    }
                }
            }

            if (totalReferences === 0 && uniqueRefs.size > 0) {
                totalReferences = uniqueRefs.size;
            }
            const totalTestCases = casesWithReferences + casesWithoutReferences;
            const coveredPercentage = totalTestCases > 0 ? Math.round((casesWithReferences / totalTestCases) * 100) : 0;
            const notCoveredPercentage = 100 - coveredPercentage;
            const response = {
                referenceCoverage: {
                    covered: coveredPercentage,
                    notCovered: notCoveredPercentage,
                },
                referenceAndTestCases: {
                    references: totalReferences,
                    casesWithReferences: casesWithReferences,
                    casesWithoutReferences: casesWithoutReferences,
                    testToBeAutomated: testsToBeAutomatedCount,
                    automated: automatedCasesCount,
                },
            };

            try {
                await redis.setex(cacheKey, 3600, JSON.stringify(response));
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }

            return response;
        } catch (error) {
            console.error('Error in getQARefrenceData:', error);
            throw error;
        }
    }

    async fetchTestRailMilestones(TestRailMilestone, buildBaseFilter, sprintId, releaseId) {
        const filter = buildBaseFilter();
        let milestones = [];

        if (sprintId) {
            filter.sprintId = new Types.ObjectId(sprintId);
            
            milestones = await TestRailMilestone.aggregate([
                { $match: filter },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: '$milestoneId',
                        latestMilestone: { $first: '$$ROOT' },
                    },
                },
                { $replaceRoot: { newRoot: '$latestMilestone' } },
            ], { allowDiskUse: true });

            if (!milestones || milestones.length === 0) {
                return [];
            }

            const milestoneIds = new Set(milestones.map((m) => m.milestoneId).filter(Boolean));
            const processedParentIds = new Set();

            for (const milestone of [...milestones]) {
                if (!milestone.parentId || milestone.parentId === null || milestone.parentId === undefined) {
                    if (milestone.milestoneId && !processedParentIds.has(milestone.milestoneId)) {
                        processedParentIds.add(milestone.milestoneId);

                        const subMilestoneFilter = buildBaseFilter({
                            parentId: milestone.milestoneId,
                        });

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
                                    milestones.push(sub);
                                    milestoneIds.add(sub.milestoneId);
                                }
                            });
                        }
                    }
                }
            }
        } else if (releaseId) {
            filter.releaseId = new Types.ObjectId(releaseId);

            const parentIdConditions = [{ parentId: null }, { parentId: { $exists: false } }];

            if (filter.$or) {
                filter.$and = [{ $or: filter.$or }, { $or: parentIdConditions }];
                delete filter.$or;
            } else {
                filter.$or = parentIdConditions;
            }

            milestones = await TestRailMilestone.aggregate([
                { $match: filter },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: '$milestoneId',
                        latestMilestone: { $first: '$$ROOT' },
                    },
                },
                { $replaceRoot: { newRoot: '$latestMilestone' } },
            ], { allowDiskUse: true });

            if (!milestones || milestones.length === 0) {
                return [];
            }

            const milestoneIds = new Set(milestones.map((m) => m.milestoneId).filter(Boolean));
            const processedParentIds = new Set();

            for (const milestone of milestones) {
                if (milestone.milestoneId && !processedParentIds.has(milestone.milestoneId)) {
                    processedParentIds.add(milestone.milestoneId);

                    const subMilestoneFilter = buildBaseFilter({
                        parentId: milestone.milestoneId,
                    });

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
                                milestones.push(sub);
                                milestoneIds.add(sub.milestoneId);
                            }
                        });
                    }
                }
            }
        }

        return milestones;
    }

    async fetchXrayExecutions(XrayExecution, buildBaseFilter, sprintId, releaseId) {
        const filter = buildBaseFilter();

        if (sprintId) {
            filter.sprintId = new Types.ObjectId(sprintId);
        } else if (releaseId) {
            filter.releaseId = new Types.ObjectId(releaseId);
        } else {
            return [];
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
}

export default new QARefrenceService();
