import { JiraReleaseModel, SprintModel, SprintIssueModel, BoardIssueModel, ProjectModel, BoardModel } from '../model.js';
import { Types } from 'mongoose';
import DefectRejectionRatioService from '../services/defectRejectionRatioService.js';
import { getStartAndEndDate } from '../../../../utils/commonFunctions.js';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { STATUS_ACTIVE } from '../../../../utils/constants/statusConstants.js';

class DefectRejectionRatioController {
    async defectRejection(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Sprint = SprintModel(tenantConnection);
            const SprintIssue = SprintIssueModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const KanbanIssue = BoardIssueModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);
            const { companyId, projectId, boardId } = req.params;
            const { releaseId, sprintId, developer } = req.query;
            const result = [];

            const cacheKey = cache.generateKey('defectRejection', {
                projectId,
                companyId,
                sprintId,
                releaseId,
                boardId,
                developer,
            });
            let cached = null;
            try {
                cached = await redis.get(cacheKey);
            } catch (err) {
                console.warn('Redis not available, skipping cache get:', err.message);
            }
            if (cached) {
                const data = JSON.parse(cached);
                return res.status(200).json(data);
            }

            let selectedIssues = [];
            let selectedType = null;
            let identifierType, kanbanBoard;

            // Validate board exists and get board type
            const board = await Board.findOne(
                {
                    _id: new Types.ObjectId(boardId),
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                },
                { boardType: 1 }
            );

            if (!board) {
                return res.status(404).json({ error: 'Board not found.' });
            }

            const matchQuery = {
                projectId: new Types.ObjectId(projectId),
                companyId: new Types.ObjectId(companyId),
                boardId: new Types.ObjectId(boardId),
                'type.name': 'Bug',
            };
            if (sprintId) {
                selectedType = await Sprint.findOne({ _id: new Types.ObjectId(sprintId), projectId, companyId });
                if (!selectedType) {
                    return res.status(404).json({ error: 'Sprint not found.' });
                }
                if (selectedType.state.toLowerCase() === STATUS_ACTIVE) {
                    const { startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, tenantConnection);
                    matchQuery.createdAt = { $gte: startOfDay, $lt: endOfDay };
                }
                matchQuery.sprintId = new Types.ObjectId(sprintId);
                identifierType = 'sprintId';
            }
            if (releaseId) {
                selectedType = await JiraRelease.findOne({
                    _id: new Types.ObjectId(releaseId),
                    projectId,
                    companyId,
                });
                if (!selectedType) {
                    return res.status(404).json({ error: 'Release not found.' });
                }
                const project = await Project.findOne({ _id: new Types.ObjectId(projectId), companyId });

                if (board) {
                    if (board.boardType === 'kanban') {
                        kanbanBoard = project;
                    } else if (board.boardType === 'scrum' || board.boardType === 'simple') {
                        const sprintCount = await Sprint.countDocuments({ companyId, projectId });
                        if (sprintCount === 0) {
                            kanbanBoard = project;
                        }
                    }
                }
                matchQuery.fixVersion = { $regex: selectedType.releaseName, $options: 'i' };
                identifierType = 'releaseId';
            }
            const IssueModel = kanbanBoard ? KanbanIssue : SprintIssue;
            selectedIssues = await IssueModel.aggregate([{ $match: matchQuery }, { $sort: { createdAt: -1 } }, { $group: { _id: '$issueId', latestTicket: { $first: '$$ROOT' } } }],
                { allowDiskUse: true });
            const [defectRejectionValue, defectRejectionRateBySprintsValue, defectRejectedByDeveloperValue, defectRejectionClassificationValue] = await Promise.allSettled([
                DefectRejectionRatioService.defectRejectedRate(selectedIssues, matchQuery, tenantConnection, kanbanBoard),
                DefectRejectionRatioService.defectRejectionBySprintOrRelease(companyId, projectId, boardId, tenantConnection, identifierType, kanbanBoard, sprintId || releaseId),
                DefectRejectionRatioService.defectRejectedByDeveloper(matchQuery, tenantConnection, kanbanBoard),
                DefectRejectionRatioService.defectRejectionClassification(matchQuery, tenantConnection, kanbanBoard),
            ]);

            result.push({
                defectRejectedRate: defectRejectionValue.status === 'fulfilled' ? defectRejectionValue.value : null,
            });
            result.push({
                defectRejectionBySprintOrRelease: defectRejectionRateBySprintsValue.status === 'fulfilled' ? defectRejectionRateBySprintsValue : null,
            });
            result.push({
                defectRejectedByDeveloper: defectRejectedByDeveloperValue.status === 'fulfilled' ? defectRejectedByDeveloperValue.value : null,
            });
            result.push({
                defectRejectionClassification: defectRejectionClassificationValue.status === 'fulfilled' ? defectRejectionClassificationValue.value : null,
            });
            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            return res.status(200).json(result);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: error.message });
        }
    }
}

export default new DefectRejectionRatioController();
