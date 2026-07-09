import CycleMetricsService from '../services/cycleMetricsService.js';
import { SprintModel, JiraReleaseModel, BoardModel } from '../model.js';
import { Types } from 'mongoose';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';

class CycleMetricsController {
    async cycleMetricsAnalysis(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Sprint = SprintModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const Board = BoardModel(tenantConnection);

            const { companyId, projectId, boardId } = req.params;
            const { releaseId, sprintId, developer } = req.query;

            const cacheKey = cache.generateKey('cycleMetricsAnalysis', {
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
            let identifierType = null;

            // Validate board exists
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

            if (sprintId) {
                selectedType = await Sprint.findOne({
                    _id: new Types.ObjectId(sprintId),
                    projectId,
                    companyId,
                    boardId: new Types.ObjectId(boardId),
                });

                if (!selectedType) {
                    return res.status(404).json({ error: 'Sprint not found.' });
                }

                identifierType = 'sprintId';
            }

            if (releaseId) {
                selectedType = await JiraRelease.findOne({
                    _id: new Types.ObjectId(releaseId),
                    projectId,
                    companyId,
                    boardId: new Types.ObjectId(boardId),
                });

                if (!selectedType) {
                    return res.status(404).json({ error: 'Release not found.' });
                }

                identifierType = 'releaseId';
            }

            try {
                const cycleTimeValue = await CycleMetricsService.getCycleTime(tenantConnection, companyId, projectId, boardId, sprintId || releaseId, identifierType);

                const cycleTimeByDeveloperValue = await CycleMetricsService.getCycleTimeByDeveloper(tenantConnection, companyId, projectId, sprintId || releaseId, identifierType);

                const result = {
                    cycleTime: cycleTimeValue,
                    cycleTimeByDeveloper: cycleTimeByDeveloperValue,
                };
                try {
                    await redis.set(cacheKey, JSON.stringify(result), 'EX', 28800);
                } catch (err) {
                    console.warn('Redis not available, skipping cache set:', err.message);
                }
                return res.status(200).json(result);
            } catch (serviceError) {
                console.error('Service Error:', serviceError);
                return res.status(500).json({
                    error: 'Error in cycle metrics service',
                    details: serviceError.message,
                });
            }
        } catch (error) {
            console.error('Cycle Metrics Analysis Error:', error);
            return res.status(500).json({
                error: 'Internal server error',
                details: error.message,
            });
        }
    }
}

export default new CycleMetricsController();
