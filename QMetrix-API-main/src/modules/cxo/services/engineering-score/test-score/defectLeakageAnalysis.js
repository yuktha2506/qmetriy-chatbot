import { SprintIssueModel, BoardIssueModel, ProjectModel, SprintModel } from '../../../../project-management/jira/model.js';
import { getStartAndEndDate } from '../../../../../utils/commonFunctions.js';
import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { STATUS_ACTIVE } from '../../../../../utils/constants/statusConstants.js';

class DefectLeakageAnalysisService {
    async getDla(companyId, projectId, keyId, idType, connection, boardId = null) {
        try {
            const SprintIssue = SprintIssueModel(connection);
            const KanbanIssue = BoardIssueModel(connection);
            const Sprint = SprintModel(connection);
            const Project = ProjectModel(connection);
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
                if (sprintDetails.state === STATUS_ACTIVE) {
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
                console.error('Invalid idType: must be either "sprint" or "release"');
                return;
            }
            const IssueModel = kanbanBoard ? KanbanIssue : SprintIssue;
            const result = await IssueModel.aggregate([
                { $match: matchQuery },
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
                        totalBugCount: { $sum: 1 },
                        prodBugs: {
                            $sum: {
                                $cond: {
                                    if: {
                                        $gt: [
                                            {
                                                $size: {
                                                    $filter: {
                                                        input: '$label',
                                                        as: 'label',
                                                        cond: { $regexMatch: { input: '$$label', regex: '^prod$', options: 'i' } },
                                                    },
                                                },
                                            },
                                            0,
                                        ],
                                    },
                                    then: 1,
                                    else: 0,
                                },
                            },
                        },
                        uatBugs: {
                            $sum: {
                                $cond: {
                                    if: {
                                        $gt: [
                                            {
                                                $size: {
                                                    $filter: {
                                                        input: '$label',
                                                        as: 'label',
                                                        cond: { $regexMatch: { input: '$$label', regex: '^uat$', options: 'i' } },
                                                    },
                                                },
                                            },
                                            0,
                                        ],
                                    },
                                    then: 1,
                                    else: 0,
                                },
                            },
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        totalBugCount: 1,
                        prodBugs: 1,
                        uatBugs: 1,
                        escapedDefects: { $add: ['$prodBugs', '$uatBugs'] },
                        dla: {
                            $multiply: [
                                {
                                    $cond: {
                                        if: { $gt: ['$totalBugCount', 0] },
                                        then: { $divide: [{ $add: ['$prodBugs', '$uatBugs'] }, '$totalBugCount'] },
                                        else: 0,
                                    },
                                },
                                100,
                            ],
                        },
                    },
                },
            ], { allowDiskUse: true });
            if (result.length > 0) {
                result[0].dla = parseFloat(result[0].dla.toFixed(2));
            }
            return result.length > 0 ? result[0] : { totalBugCount: 0, prodBugs: 0, uatBugs: 0, escapedDefects: 0, dla: 0 };
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}

export default new DefectLeakageAnalysisService();
