import { SprintIssueModel, BoardIssueModel, ProjectModel, SprintModel } from '../../../../project-management/jira/model.js';
import { getStartAndEndDate } from '../../../../../utils/commonFunctions.js';
import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { STATUS_ACTIVE } from '../../../../../utils/constants/statusConstants.js';

class TimeToFixService {
    async getTimeToFix(companyId, projectId, keyId, idType, connection, boardId = null) {
        try {
            const SprintIssue = SprintIssueModel(connection);
            const KanbanIssue = BoardIssueModel(connection);
            const Project = ProjectModel(connection);
            const Sprint = SprintModel(connection);
            const matchQuery = {
                projectId: new mongoose.Types.ObjectId(projectId),
                companyId: new mongoose.Types.ObjectId(companyId),
            };
            
            // Add boardId to match query if provided
            if (boardId) {
                matchQuery.boardId = new mongoose.Types.ObjectId(boardId);
            }
            let kanbanBoard;
            if (idType === 'sprint') {
                const sprintDetails = await Sprint.findOne({ _id: new mongoose.Types.ObjectId(keyId), projectId });
                matchQuery.sprintId = keyId;
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
            const sprintIssues = await IssueModel.aggregate([
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
            ], { allowDiskUse: true });

            let totalTTF = 0;
            let resolvedCount = 0;

            for (const sprintIssue of sprintIssues) {
                if (
                    sprintIssue.status &&
                    (sprintIssue.status.name.toLowerCase() === 'closed' || sprintIssue.status.name.toLowerCase() === 'done') &&
                    sprintIssue.type &&
                    sprintIssue.type.name.toLowerCase() === 'bug'&&
                    sprintIssue.label &&
                    sprintIssue.label.some(label => label.toLowerCase().startsWith('prod'))
                ) {
                    resolvedCount++;

                    const createdAt = new Date(sprintIssue.issueCreatedAt);
                    const closedAt = new Date(sprintIssue.issueUpdatedAt);
                    const ttf = (closedAt - createdAt) / (1000 * 60 * 60 * 24);
                    totalTTF += ttf;
                }
            }
            const totalTimeToFix = totalTTF.toFixed(2);
            const averageTTF = resolvedCount > 0 ? (totalTTF / resolvedCount).toFixed(2) : 0;
            return { totalTimeToFix, resolvedCount, averageTTF };
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}

export default new TimeToFixService();
