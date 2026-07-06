import mongoose from 'mongoose';
import { SprintIssueModel, BoardIssueModel, ProjectModel, SprintModel } from '../../../../project-management/jira/model.js';
import { getStartAndEndDate } from '../../../../../utils/commonFunctions.js';
import { Types } from 'mongoose';
import { STATUS_ACTIVE } from '../../../../../utils/constants/statusConstants.js';

class TestingQualityService {
    async getTestinQuality(companyId, projectId, keyId, idType, connection, boardId = null) {
        try {
            const SprintIssue = SprintIssueModel(connection);
            const KanbanIssue = BoardIssueModel(connection);
            const Project = ProjectModel(connection);
            const Sprint = SprintModel(connection);
            const matchQuery = {
                projectId: new mongoose.Types.ObjectId(projectId),
                companyId: new mongoose.Types.ObjectId(companyId),
                'type.name': 'Bug',
            };
            
            // Add boardId to match query if provided
            if (boardId) {
                matchQuery.boardId = new mongoose.Types.ObjectId(boardId);
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
                    companyId: new Types.ObjectId(companyId)
                });

                if (sprintCount === 0) {
                    kanbanBoard = await Project.findOne({
                        _id: new Types.ObjectId(projectId),
                        companyId: new Types.ObjectId(companyId),
                        $or: [
                            { boardType: 'kanban' },
                            { boardType: 'simple' },
                            { boardType: 'scrum' }
                        ]
                    });
                }
                matchQuery.fixVersion = { $regex: keyId, $options: 'i' };
            } else {
                console.error('sprint or release not defined');
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
                        _id: null,
                        totalBugs: { $sum: 1 },
                        lowPriorityBugs: {
                            $sum: {
                                $cond: [
                                    {
                                        $in: [{ $toLower: '$priority' }, ['invalid', 'p4', 'lowest']],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        totalBugs: 1,
                        lowPriorityBugs: 1,
                        testingquality: {
                            $cond: [{ $gt: ['$totalBugs', 0] }, { $multiply: [{ $divide: ['$lowPriorityBugs', '$totalBugs'] }, 100] }, 0],
                        },
                    },
                },
            ], { allowDiskUse: true });
            return result.length > 0 ? result[0] : { totalBugs: 0, lowPriorityBugs: 0, testingquality: 0 };
        } catch (error) {
            console.error(`Error calculating developer score for ${idType}:`, error);
            throw new Error(`Failed to calculate developer score for ${idType}: ${error.message}`);
        }
    }
}

export default new TestingQualityService();
