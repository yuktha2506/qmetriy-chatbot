import mongoose from 'mongoose';
import { SprintIssueModel, BoardIssueModel, ProjectModel, SprintModel, JiraReleaseModel } from '../../../project-management/jira/model.js';
import { getStartAndEndDate } from '../../../../utils/commonFunctions.js';
import ProjectDataService from '../../../project-management/jira/services/projectDataService.js';
import { Types } from 'mongoose';
import { STATUS_ACTIVE } from '../../../../utils/constants/statusConstants.js';

class SprintIssuesReadiness {
    async getSprintIssuesReadiness(companyId, projectId, keyId, idType, connection, boardId = null) {
        try {
            const SprintIssue = SprintIssueModel(connection);
            const KanbanIssue = BoardIssueModel(connection);
            const Sprint = SprintModel(connection);
            const Project = ProjectModel(connection);
            const matchQuery = {
                projectId: new mongoose.Types.ObjectId(projectId),
                companyId: new mongoose.Types.ObjectId(companyId),
            };
            
            // Add boardId to match query if provided
            if (boardId) {
                matchQuery.boardId = new mongoose.Types.ObjectId(boardId);
            } else {
                console.warn('SprintIssuesReadiness: No boardId provided, using project-level data');
            }
            
            let kanbanBoard;
            if (idType === 'sprint') {
                const sprintDetails = await Sprint.findOne({ _id: new mongoose.Types.ObjectId(keyId), projectId });
                matchQuery.sprintId = new mongoose.Types.ObjectId(keyId);
                if (sprintDetails?.state === STATUS_ACTIVE) {
                    const { startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, connection);
                    matchQuery.createdAt = { $gte: startOfDay, $lt: endOfDay };
                }
            } else if (idType === 'release') {
                const sprintCount = await Sprint.countDocuments({
                    projectId: new Types.ObjectId(projectId),
                    companyId: new Types.ObjectId(companyId),
                });

                if (sprintCount === 0) {
                    kanbanBoard = await Project.findOne({
                        _id: new Types.ObjectId(projectId),
                        companyId: new Types.ObjectId(companyId),
                        $or: [{ boardType: 'kanban' }, { boardType: 'simple' }, { boardType: 'scrum' }],
                    });
                }
                matchQuery.fixVersion = { $regex: keyId, $options: 'i' };
            } else {
                console.error('Invalid idType: must be either "sprint" or "release"');
                return;
            }
            const IssueModel = kanbanBoard ? KanbanIssue : SprintIssue;
            const result = await IssueModel.aggregate([
                {
                    $match: matchQuery,
                },
                {
                    $sort: {
                        createdAt: -1,
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
                        _id: '$type.name',
                        closedCount: {
                            $sum: {
                                $cond: [{ $in: [{ $toLower: '$status.name' }, ['closed', 'done']] }, 1, 0],
                            },
                        },
                        totalCount: { $sum: 1 },
                    },
                },
                {
                    $addFields: {
                        readiness: {
                            $cond: [{ $gt: ['$totalCount', 0] }, { $multiply: [{ $divide: ['$closedCount', '$totalCount'] }, 100] }, 0],
                        },
                    },
                },
                {
                    $group: {
                        _id: null,
                        averageReadiness: { $avg: '$readiness' },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        averageReadiness: '$averageReadiness',
                    },
                },
            ], { allowDiskUse: true });

            if (result.length > 0) {
                result[0].averageReadiness = parseFloat(result[0].averageReadiness.toFixed(2));
            }
            return result.length > 0 ? result[0] : { averageReadiness: 0 };
        } catch (error) {
            console.error(`Error calculating sprint issues readiness for  ${idType}:`, error);
            throw new Error(`Failed to calculate readiness: ${error.message}`);
        }
    }
    async getIssues(companyId, projectId, keyId, idType, tenantConnection, boardId = null) {
        const Sprint = SprintModel(tenantConnection);
        const JiraRelease = JiraReleaseModel(tenantConnection);
        let response;
        let startOfDay, endOfDay;

        if (idType === 'sprint') {
            const sprint = await Sprint.findOne({ _id: new mongoose.Types.ObjectId(keyId), projectId });
            if (sprint.state === STATUS_ACTIVE) {
                ({ startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, tenantConnection));
            }
            response = await ProjectDataService.getStatusCount(sprint._id, projectId, companyId, null, startOfDay, endOfDay, tenantConnection, null, boardId);
        } else if (idType === 'release') {
            const { _id } = await JiraRelease.findOne({ releaseName: keyId, projectId });
            response = await ProjectDataService.getStatusCount(null, projectId, companyId, _id, startOfDay, endOfDay, tenantConnection, null, boardId);
        } else {
            console.error('Invalid idType: must be either "sprint" or "release"');
            return;
        }

        const types = ['Bug', 'Task', 'Epic', 'Story'];
        const result = {};

        types.forEach((type) => {
            const item = response.find((d) => d.name === type);
            const open = item ? (item.open ?? 0) : 0;
            const close = item ? (item.close ?? 0) : 0;
            const total = open + close;
            result[type.toLowerCase() + 's'] = total === 0 ? null : parseFloat(((close / total) * 100).toFixed(2));
        });
        return result;
    }
}

export default new SprintIssuesReadiness();
