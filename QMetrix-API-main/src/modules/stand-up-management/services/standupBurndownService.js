import BurndownCalculationService from '../../project-management/jira/services/burndownCalculationService.js';
import { SprintModel, JiraReleaseModel, BacklogIssueModel } from '../../project-management/jira/model.js';
import { Types } from 'mongoose';
import { redis } from '../../../server.js';
import cache from '../../../utils/cache.js';

class standupBurndownService {
    async getStandupBurndown(companyId, projectId, boardId, sprintId, releaseId, developer, connection) {
        try {
            const cacheKey = cache.generateKey('standupBurndown', {
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

            // Determine estimation type from sprint/release hours field
            let estimationType = 'storyPoints';
            const Sprint = SprintModel(connection);
            const JiraRelease = JiraReleaseModel(connection);
            
            if (sprintId) {
                const sprint = await Sprint.findOne({
                    _id: new Types.ObjectId(sprintId),
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId)
                }, { hours: 1 });
                
                if (sprint) {
                    estimationType = sprint.hours === true ? 'hours' : 'storyPoints';
                }
            } else if (releaseId) {
                const release = await JiraRelease.findOne({
                    _id: new Types.ObjectId(releaseId),
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId)
                }, { hours: 1 });
                
                if (release) {
                    estimationType = release.hours === true ? 'hours' : 'storyPoints';
                }
            }

            // Fetch burndown data from Sprint/Release collection using new API
            const burndownData = await BurndownCalculationService.getBurndownData(
                companyId,
                projectId,
                boardId,
                sprintId,
                releaseId,
                developer,
                connection
            );

            if (!burndownData || !burndownData.dailyData) {
                return {
                    burndownPercentage: 0,
                    originalEstimate: 0,
                    totalSpent: 0,
                    originalEstimateHrs: 0,
                    timeSpentHrs: 0,
                };
            }

            // Calculate burndown percentage and format response to match original format
            let totalOriginalEstimate = burndownData.totalOriginalEstimate || 0;
            let totalEffortSpent = burndownData.totalEffortSpent || 0;

            if (releaseId) {
                const JiraRelease = JiraReleaseModel(connection);
                const BacklogIssue = BacklogIssueModel(connection);

                const releaseObjectId = new Types.ObjectId(releaseId);
                const jiraRelease = await JiraRelease.findOne({
                    _id: releaseObjectId,
                    projectId: new Types.ObjectId(projectId),
                }).lean();

                if (jiraRelease && jiraRelease.releaseName) {
                    const backlogFilter = {
                        projectId: new Types.ObjectId(projectId),
                        companyId: new Types.ObjectId(companyId),
                        boardId: new Types.ObjectId(boardId),
                        fixVersion: jiraRelease.releaseName,
                    };

                    if (developer !== undefined) {
                        backlogFilter.assignee = developer === 'UnAssigned' ? null : developer;
                    }

                    const backlogBurndownData = await BacklogIssue.aggregate([
                        { $match: backlogFilter },
                        {
                            $sort: {
                                issueCreatedAt: -1,
                            },
                        },
                        {
                            $group: {
                                _id: '$issueId',
                                latestTicket: { $first: '$$ROOT' },
                            },
                        },
                        {
                            $replaceRoot: {
                                newRoot: '$latestTicket',
                            },
                        },
                        {
                            $group: {
                                _id: null,
                                totalStoryPoints: {
                                    $sum: {
                                        $cond: [{ $eq: ['$type.name', 'Story'] }, '$storyPoints', 0],
                                    },
                                },
                                totalStoryPointsClosed: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [{ $eq: ['$type.name', 'Story'] }, { $eq: ['$status.name', 'Closed'] }],
                                            },
                                            '$storyPoints',
                                            0,
                                        ],
                                    },
                                },
                                originalEstimateHrs: {
                                    $sum: '$originalEstimateHrs',
                                },
                                totalTimeSpentHrs: {
                                    $sum: '$timeSpentHrs',
                                },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                totalStoryPoints: 1,
                                totalStoryPointsClosed: 1,
                                originalEstimateHrs: 1,
                                totalTimeSpentHrs: 1,
                            },
                        },
                    ], { allowDiskUse: true });

                    const backlogData = backlogBurndownData[0] || {};

                    if (estimationType === 'hours') {
                        // For hours-based estimation, add backlog hours
                        totalOriginalEstimate = (totalOriginalEstimate || 0) + (backlogData.originalEstimateHrs || 0);
                        totalEffortSpent = (totalEffortSpent || 0) + (backlogData.totalTimeSpentHrs || 0);
                    }
                    // For story points-based estimation, don't add backlog data (just convert story points to hours later)
                }
            }

            const burndownPercentage = totalOriginalEstimate > 0
                ? parseFloat(((totalEffortSpent / totalOriginalEstimate) * 100).toFixed(2))
                : 0;

            // For hours-based, use totalEffortSpent as timeSpentHrs
            // For story points-based, convert to hours (assuming 8 hours per story point)
            const originalEstimateHrs = estimationType === 'hours' 
                ? totalOriginalEstimate 
                : parseFloat((totalOriginalEstimate * 8).toFixed(2));
            
            const timeSpentHrs = estimationType === 'hours'
                ? totalEffortSpent
                : parseFloat((totalEffortSpent * 8).toFixed(2));

            const burndownResult = {
                burndownPercentage,
                originalEstimate: parseFloat(totalOriginalEstimate.toFixed(2)),
                totalSpent: parseFloat(totalEffortSpent.toFixed(2)),
                originalEstimateHrs: parseFloat(originalEstimateHrs.toFixed(2)),
                timeSpentHrs: parseFloat(timeSpentHrs.toFixed(2)),
            };

            try {
                await redis.set(cacheKey, JSON.stringify(burndownResult), 'EX', 28000);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }

            return burndownResult;
        } catch (error) {
            console.error('Error fetching standup burndown:', error);
            throw new Error(`Failed to fetch standup burndown: ${error.message}`);
        }
    }
}

export default new standupBurndownService();
