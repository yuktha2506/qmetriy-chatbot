// import { SprintIssueModel, JiraReleaseModel, SprintModel, BoardIssueModel, ProjectModel, BoardModel } from '../model.js';
// import { CXOModel } from '../../../cxo/model.js';
// import BugClassificationService from '../services/bugClassificationService';
// import { getStartAndEndDate } from '../../../../utils/commonFunctions.js';
// import { Types } from 'mongoose';
// import { redis } from '../../../../server.js';
// import cache from '../../../../utils/cache.js';

class BugClassificationController {
    async bugClassification(req, res) {
        try {
            return res.status(503).json({
                success: false,
                message: 'This API is temporarily terminated for performance reasons.',
            });
            /* Original implementation (temporarily disabled)
            const tenantConnection = req.tenantConnection;
            const Sprint = SprintModel(tenantConnection);
            const SprintIssue = SprintIssueModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const KanbanIssue = BoardIssueModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);
            const Cxo = CXOModel(tenantConnection);
            const { companyId, projectId, boardId } = req.params;
            const { releaseId, sprintId, developer } = req.query;
            const result = [];
            let selectedIssues = [];
            let selectedType = null;
            let identifierType, kanbanBoard;

            const cacheKey = cache.generateKey('bugClassification', {
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

            let matchCondition = {
                projectId: new Types.ObjectId(projectId),
                companyId: new Types.ObjectId(companyId),
                boardId: new Types.ObjectId(boardId),
            };
            if (sprintId) {
                selectedType = await Sprint.findOne({ _id: new Types.ObjectId(sprintId), projectId, companyId });
                if (!selectedType) {
                    return res.status(404).json({ error: 'Sprint not found.' });
                }
                if (selectedType.state.toLowerCase() === 'active') {
                    const { startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, tenantConnection);
                    const dateFormate = { $gte: startOfDay, $lt: endOfDay };
                    matchCondition.createdAt = dateFormate;
                }
                identifierType = 'sprintId';
                matchCondition.sprintId = new Types.ObjectId(sprintId);
            }
            if (releaseId) {
                selectedType = await JiraRelease.findOne({ _id: new Types.ObjectId(releaseId), projectId, companyId });
                if (!selectedType) {
                    return res.status(404).json({ error: 'Release not found.' });
                }
                identifierType = 'releaseId';
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
                matchCondition.fixVersion = { $regex: selectedType.releaseName, $options: 'i' };
            }

            // Add developer filter if provided
            if (developer && developer !== 'null' && developer !== 'UnAssigned') {
                matchCondition.assignee = developer;
            }

            const IssueModel = kanbanBoard ? KanbanIssue : SprintIssue;
            const allIssues = await IssueModel.aggregate([{ $match: matchCondition }, { $sort: { createdAt: -1 } }, { $group: { _id: '$issueId', latestTicket: { $first: '$$ROOT' } } }],
                { allowDiskUse: true }
            );

            matchCondition = { ...matchCondition, 'type.name': 'Bug' };
            selectedIssues = await IssueModel.aggregate([{ $match: matchCondition }, { $sort: { createdAt: -1 } }, { $group: { _id: '$issueId', latestTicket: { $first: '$$ROOT' } } }],
                { allowDiskUse: true }
            );

            const combinedScanData = await Cxo.aggregate(
                [
                    {
                        $match: {
                            companyId: new Types.ObjectId(companyId),
                            projectId: new Types.ObjectId(projectId),
                            ...(identifierType === 'sprintId' ? { sprintId: new Types.ObjectId(sprintId) } : { releaseVersion: { $regex: selectedType.releaseName, $options: 'i' } }),
                        },
                    },
                    { $sort: { createdAt: -1 } },
                    { $group: { _id: identifierType === 'sprintId' ? '$sprintId' : '$releaseVersion', latestData: { $first: '$$ROOT' } } },
                ],
                { allowDiskUse: true }
            );
            const sonarQubeData = combinedScanData.length > 0 ? combinedScanData[0].latestData.engineeringScoreObject?.developerScoreObject?.combinedScanData?.ncloc || null : null;

            const [bugRateValue, bugRateByLOCValue, bugRateBySprintsValue, bugClassificationByTypeValue, bugClassificationByPriorityValue, bugClassificationByDeveloperValue] =
                await Promise.allSettled([
                    BugClassificationService.bugRate(allIssues, selectedIssues),
                    BugClassificationService.bugRateByLOC(selectedIssues, sonarQubeData),
                    BugClassificationService.bugRateBySprintOrRelease(tenantConnection, companyId, projectId, identifierType, kanbanBoard, sprintId || releaseId),
                    BugClassificationService.bugClassificationByType(matchCondition, tenantConnection, kanbanBoard),
                    BugClassificationService.bugClassificationByPriority(matchCondition, tenantConnection, kanbanBoard),
                    BugClassificationService.bugClassificationByDeveloper(matchCondition, tenantConnection, kanbanBoard),
                ]);
            result.push({ bugRate: bugRateValue.status === 'fulfilled' ? bugRateValue.value : null });
            result.push({ bugRateByLOC: bugRateByLOCValue.status === 'fulfilled' ? bugRateByLOCValue.value : null });
            result.push({ bugRateBySprintOrRelease: bugRateBySprintsValue.status === 'fulfilled' ? bugRateBySprintsValue.value : null });
            result.push({ bugClassificationByType: bugClassificationByTypeValue.status === 'fulfilled' ? bugClassificationByTypeValue.value : null });
            result.push({ bugClassificationByPriority: bugClassificationByPriorityValue.status === 'fulfilled' ? bugClassificationByPriorityValue.value : null });
            result.push({ bugClassificationByDeveloper: bugClassificationByDeveloperValue.status === 'fulfilled' ? bugClassificationByDeveloperValue.value : null });

            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            return res.status(200).json(result);
            */
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: error.message });
        }
    }
}

export default new BugClassificationController();
