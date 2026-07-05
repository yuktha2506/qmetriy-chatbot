import { Types } from 'mongoose';
import { BoardIssueModel, ProjectModel, SprintIssueModel, SprintModel } from '../../../../project-management/jira/model';
import { getStartAndEndDate } from '../../../../../utils/commonFunctions';
import { STATUS_ACTIVE } from '../../../../../utils/constants/statusConstants.js';

class DefectsDensityService {
    async defectDensity(companyId, projectId, keyId, idType, connection, boardId = null) {
        try {
            const SprintIssue = await SprintIssueModel(connection);
            const KanbanIssue = BoardIssueModel(connection);
            const Sprint = SprintModel(connection);
            const Project = ProjectModel(connection);
            let selectedType, kanbanBoard;

            const matchQuery = {
                projectId: new Types.ObjectId(projectId),
                companyId: new Types.ObjectId(companyId),
                'type.name': 'Bug',
            };
            
            // Add boardId to match query if provided
            if (boardId) {
                matchQuery.boardId = new Types.ObjectId(boardId);
            }

            if (idType === 'sprint') {
                selectedType = await Sprint.findOne({ _id: keyId, projectId, companyId });
                if (selectedType.state.toLowerCase() === STATUS_ACTIVE) {
                    const { startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, connection);
                    matchQuery.createdAt = { $gte: startOfDay, $lt: endOfDay };
                }
                matchQuery.sprintId = new Types.ObjectId(keyId);
            }
            if (idType === 'release') {
                matchQuery.fixVersion = { $regex: keyId, $options: 'i' };
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
            }

            const testingProject = await Project.findOne({ _id: new Types.ObjectId(projectId) });
            const sonarQubeData = testingProject?.combinedScanData?.ncloc ?? 0;

            const IssueModel = kanbanBoard ? KanbanIssue : SprintIssue;
            const finalResult = await IssueModel.aggregate([
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
                    $replaceRoot: { newRoot: '$latestTicket' },
                },
                {
                    $match: {
                        label: {
                            $elemMatch: {
                                $regex: '^(prod.*|uat.*|pro.*)$',
                                $options: 'i',
                            },
                        },
                    },
                },
            ], { allowDiskUse: true });
            const totalDefects = finalResult.length || 0;
            const ncloc = sonarQubeData ?? 0;
            const density = ncloc > 0 ? ((totalDefects / ncloc) * 1000).toFixed(2) : 0;
            return {
                totalBugs: totalDefects,
                ncloc,
                density,
            };
        } catch (error) {
            console.error('Error calculating Defect Density:', error);
            throw error;
        }
    }
}

export default new DefectsDensityService();
