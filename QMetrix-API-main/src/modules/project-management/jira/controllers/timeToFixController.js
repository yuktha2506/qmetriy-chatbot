// import { JiraReleaseModel, SprintModel, ProjectModel, BoardModel } from '../model.js';
// import timeToFixService from '../services/timeToFixService.js';
// import { getStartAndEndDate } from '../../../../utils/commonFunctions.js';
// import { Types } from 'mongoose';
// import { redis } from '../../../../server.js';
// import cache from '../../../../utils/cache.js';

class TimeToFixController {
    async TimeToFix(req, res) {
        try {
            return res.status(503).json({
                success: false,
                message: 'This API is temporarily terminated for performance reasons.',
            });
            /* Original implementation (temporarily disabled)
            const tenantConnection = req.tenantConnection;
            const Sprint = SprintModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);
            const { companyId, projectId, boardId } = req.params;
            const { releaseId, sprintId, developer } = req.query;
            const result = [];

            const cacheKey = cache.generateKey('timeToFix', {
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

            let selectedType = null;
            let identifierType;
            let kanbanBoard;
            let startOfDay, endOfDay;

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
                'status.name': { $in: ['Closed', 'Done'] },
            };

            const matchQueryProdBug = {
                projectId: new Types.ObjectId(projectId),
                companyId: new Types.ObjectId(companyId),
                boardId: new Types.ObjectId(boardId),
                'type.name': 'Bug',
                'status.name': { $in: ['Closed', 'Done'] },
                $and: [{ label: { $exists: true, $ne: null } }, { label: { $elemMatch: { $regex: '^prod', $options: 'i' } } }],
            };

            if (sprintId) {
                selectedType = await Sprint.findOne({ _id: new Types.ObjectId(sprintId), projectId, companyId });
                if (!selectedType) {
                    return res.status(404).json({ error: 'Sprint not found.' });
                }
                matchQuery.sprintId = new Types.ObjectId(sprintId);
                matchQueryProdBug.sprintId = new Types.ObjectId(sprintId);
                if (selectedType.state.toLowerCase() === 'active') {
                    ({ startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, tenantConnection));
                    matchQuery.createdAt = { $gte: startOfDay, $lt: endOfDay };
                    matchQueryProdBug.createdAt = { $gte: startOfDay, $lt: endOfDay };
                }
                identifierType = 'sprintId';
            }

            if (releaseId) {
                selectedType = await JiraRelease.findOne({ _id: new Types.ObjectId(releaseId), projectId, companyId });
                if (!selectedType) {
                    return res.status(404).json({ error: 'Release not found.' });
                }
                matchQuery.fixVersion = { $regex: selectedType?.releaseName, $options: 'i' };
                matchQueryProdBug.fixVersion = { $regex: selectedType?.releaseName, $options: 'i' };
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
            }

            const [ttfSprintOrReleaseValue, ttfByPriority, ttfByType, ttfByDeveloper] = await Promise.allSettled([
                timeToFixService.ttfBySprintOrRelease(tenantConnection, companyId, projectId, startOfDay, endOfDay, identifierType, kanbanBoard, sprintId || releaseId),
                timeToFixService.ttfByPriority(matchQueryProdBug, tenantConnection, kanbanBoard),
                timeToFixService.ttfByType(matchQuery, tenantConnection, kanbanBoard),
                timeToFixService.ttfByDeveloper(matchQueryProdBug, tenantConnection, kanbanBoard),
            ]);

            result.push({ ttfBySprintOrRelease: ttfSprintOrReleaseValue.status === 'fulfilled' ? ttfSprintOrReleaseValue.value : null });
            result.push({ ttfByPriorityWise: ttfByPriority.status === 'fulfilled' ? ttfByPriority.value : null });
            result.push({ ttfByType: ttfByType.status === 'fulfilled' ? ttfByType.value : null });
            result.push({ ttfByDeveloper: ttfByDeveloper.status === 'fulfilled' ? ttfByDeveloper.value : null });

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

export default new TimeToFixController();
