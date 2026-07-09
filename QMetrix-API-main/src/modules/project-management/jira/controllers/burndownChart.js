import BurndownCalculationService from '../services/burndownCalculationService';
import { SprintModel, JiraReleaseModel } from '../model.js';
import { Types } from 'mongoose';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';

class BurnDownChartController {
    async getSprintStoryPoints(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const { companyId, projectId, boardId } = req.params;
            const { releaseId, sprintId, developer: dev, estimationType: queryEstimationType } = req.query;
            const developer = dev;

            if (!sprintId && !releaseId) {
                return res.status(400).json({ error: 'Either sprintId or releaseId must be provided.' });
            }

            let estimationType = queryEstimationType;
            
            if (sprintId) {
                const Sprint = SprintModel(tenantConnection);
                const sprint = await Sprint.findOne({
                    _id: new Types.ObjectId(sprintId),
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId)
                }, { hours: 1 });
                
                if (sprint) {
                    if (!estimationType) {
                        estimationType = sprint.hours === true ? 'hours' : 'storyPoints';
                    }
                } else {
                    estimationType = estimationType || 'storyPoints';
                }
            } else if (releaseId) {
                const JiraRelease = JiraReleaseModel(tenantConnection);
                const release = await JiraRelease.findOne({
                    _id: new Types.ObjectId(releaseId),
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId)
                }, { hours: 1 });
                
                if (release) {
                    if (!estimationType) {
                        estimationType = release.hours === true ? 'hours' : 'storyPoints';
                    }
                } else {
                    estimationType = estimationType || 'storyPoints';
                }
            } else {
                estimationType = estimationType || 'storyPoints';
            }

            const cacheKey = cache.generateKey('sprintStoryPoints', {
                projectId,
                companyId,
                sprintId,
                releaseId,
                developer,
                boardId,
                estimationType,
            });

            let cached = null;
            try {
                cached = await redis.get(cacheKey);
            } catch (err) {
                console.warn('Redis not available, skipping cache get:', err.message);
            }
            
            if (cached) {
                const data = JSON.parse(cached);
                if (!Array.isArray(data.actualStoryPoints)) {
                    data.actualStoryPoints = data.actualStoryPoints || [];
                }
                if (data.mode === null) {data.mode = sprintId ? 'sprint' : 'release';}
                return res.status(200).json(data);
            }

            const burndownData = await BurndownCalculationService.getBurndownData(
                companyId,
                projectId,
                boardId,
                sprintId,
                releaseId,
                null,
                tenantConnection
            );

            if (!burndownData) {
                return res.status(404).json({
                    error: 'Burndown data not found. Data may not have been calculated yet. Run sync to populate.',
                });
            }

            const response = {
                ...burndownData,
                actualStoryPoints: burndownData.actualStoryPoints || [],
                mode: burndownData.mode || (sprintId ? 'sprint' : 'release'),
            };

            try {
                await redis.set(cacheKey, JSON.stringify(response), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }

            return res.status(200).json(response);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: error.message });
        }
    }

    async getBurndownData(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const { companyId, projectId, boardId } = req.params;
            const { releaseId, sprintId } = req.query;

            if (!sprintId && !releaseId) {
                return res.status(400).json({ error: 'Either sprintId or releaseId must be provided.' });
            }

            if (!Types.ObjectId.isValid(companyId)) {
                return res.status(400).json({ error: 'Invalid companyId' });
            }
            if (!Types.ObjectId.isValid(projectId)) {
                return res.status(400).json({ error: 'Invalid projectId' });
            }
            if (!Types.ObjectId.isValid(boardId)) {
                return res.status(400).json({ error: 'Invalid boardId' });
            }
            if (sprintId && !Types.ObjectId.isValid(sprintId)) {
                return res.status(400).json({ error: 'Invalid sprintId' });
            }
            if (releaseId && !Types.ObjectId.isValid(releaseId)) {
                return res.status(400).json({ error: 'Invalid releaseId' });
            }

            const burndownData = await BurndownCalculationService.getBurndownData(
                companyId,
                projectId,
                boardId,
                sprintId,
                releaseId,
                null, 
                tenantConnection
            );

            if (!burndownData) {
                return res.status(404).json({ 
                    error: 'Burndown data not found. Data may not have been calculated yet.' 
                });
            }

            return res.status(200).json(burndownData);
        } catch (error) {
            console.error('Error fetching burndown data:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    async getReleaseBurndownData(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const { companyId, projectId, boardId } = req.params;
            const { releaseId } = req.query;

            if (!releaseId) {
                return res.status(400).json({ error: 'releaseId must be provided.' });
            }

            if (!Types.ObjectId.isValid(companyId)) {
                return res.status(400).json({ error: 'Invalid companyId' });
            }
            if (!Types.ObjectId.isValid(projectId)) {
                return res.status(400).json({ error: 'Invalid projectId' });
            }
            if (!Types.ObjectId.isValid(boardId)) {
                return res.status(400).json({ error: 'Invalid boardId' });
            }
            if (!Types.ObjectId.isValid(releaseId)) {
                return res.status(400).json({ error: 'Invalid releaseId' });
            }

            const releaseBurndownData = await BurndownCalculationService.getReleaseBurndownData(
                companyId,
                projectId,
                boardId,
                releaseId,
                tenantConnection
            );

            if (!releaseBurndownData) {
                return res.status(404).json({
                    error: 'Release burndown data not found. Data may not have been calculated yet.',
                });
            }

            return res.status(200).json(releaseBurndownData);
        } catch (error) {
            console.error('Error fetching release burndown data:', error);
            return res.status(500).json({ error: error.message });
        }
    }
}

export default new BurnDownChartController();
