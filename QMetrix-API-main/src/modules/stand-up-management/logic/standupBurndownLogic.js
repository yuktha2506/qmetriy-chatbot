import { Types } from 'mongoose';

export default async function standupBurndownLogic({ ctx, builder, params }) {
    const { companyId, projectId, boardId, sprintId, releaseId, developer } = params;
    const selectedType = ctx.selectedType;

    let estimationType = 'storyPoints';

    if (sprintId && selectedType) {
        estimationType = selectedType.hours === true ? 'hours' : 'storyPoints';
    } else if (releaseId && selectedType) {
        estimationType = selectedType.hours === true ? 'hours' : 'storyPoints';
    }

    let burndownData = null;
    if (sprintId) {
        if (selectedType?.burndownData) {
            burndownData = selectedType.burndownData;
        }
    } else if (releaseId) {
        if (selectedType?.burndownData?.dailyData) {
            burndownData = selectedType.burndownData;
        }
    }

    if (!burndownData || !burndownData.dailyData) {
        return {
            burndownPercentage: 0,
            originalEstimate: 0,
            totalSpent: 0,
            originalEstimateHrs: 0,
            timeSpentHrs: 0,
        };
    }

    let totalOriginalEstimate = burndownData.totalOriginalEstimate || 0;
    let totalEffortSpent = burndownData.totalEffortSpent || 0;
    const projectDoc = ctx.project;
    const isAzureProject = (projectDoc?.projectTypeKey || '').toLowerCase() === 'azure-project'
        || (projectDoc?.boardType || '').toLowerCase().includes('azure');
    const doneStatuses = isAzureProject ? ['closed', 'done', 'completed', 'resolved'] : ['closed', 'done'];

    if (releaseId && ctx.selectedType?.releaseName) {
        const backlogFilter = {
            projectId: new Types.ObjectId(projectId),
            companyId: new Types.ObjectId(companyId),
            boardId: new Types.ObjectId(boardId),
            fixVersion: ctx.selectedType.releaseName,
        };

        if (developer !== undefined) {
            backlogFilter.assignee = developer === 'UnAssigned' ? null : developer;
        }

        const backlogBurndownData = await builder.BacklogIssue.aggregate([
            { $match: backlogFilter },
            { $sort: { issueCreatedAt: -1 } },
            { $group: { _id: '$issueId', latestTicket: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$latestTicket' } },
            {
                $group: {
                    _id: null,
                    totalStoryPoints: {
                        $sum: { $cond: [{ $eq: ['$type.name', 'Story'] }, '$storyPoints', 0] },
                    },
                    totalStoryPointsClosed: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$type.name', 'Story'] },
                                        { $in: [{ $toLower: '$status.name' }, doneStatuses] },
                                    ],
                                },
                                '$storyPoints', 0,
                            ],
                        },
                    },
                    originalEstimateHrs: { $sum: '$originalEstimateHrs' },
                    totalTimeSpentHrs: { $sum: '$timeSpentHrs' },
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
            totalOriginalEstimate = (totalOriginalEstimate || 0) + (backlogData.originalEstimateHrs || 0);
            totalEffortSpent = (totalEffortSpent || 0) + (backlogData.totalTimeSpentHrs || 0);
        }
    }

    const burndownPercentage = totalOriginalEstimate > 0
        ? parseFloat(((totalEffortSpent / totalOriginalEstimate) * 100).toFixed(2))
        : 0;

    const originalEstimateHrs = estimationType === 'hours'
        ? totalOriginalEstimate
        : parseFloat((totalOriginalEstimate * 8).toFixed(2));

    const timeSpentHrs = estimationType === 'hours'
        ? totalEffortSpent
        : parseFloat((totalEffortSpent * 8).toFixed(2));

    return {
        burndownPercentage,
        originalEstimate: parseFloat(totalOriginalEstimate.toFixed(2)),
        totalSpent: parseFloat(totalEffortSpent.toFixed(2)),
        originalEstimateHrs: parseFloat(originalEstimateHrs.toFixed(2)),
        timeSpentHrs: parseFloat(timeSpentHrs.toFixed(2)),
    };
}
