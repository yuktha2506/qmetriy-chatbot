import ReleaseDashboardService from '../services/releaseDashboardService.js';
import { Types } from 'mongoose';
import { redis } from '../../../server.js';
import cache from '../../../utils/cache.js';

class ReleaseDashboardController {
    async getReleaseDashboardData(req, res) {
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

            const cacheKey = cache.generateKey('releaseDashboard', {
                companyId,
                projectId,
                boardId,
                releaseId,
            });

            let cached = null;
            try {
                cached = await redis.get(cacheKey);
            } catch (err) {
                console.warn('Redis not available, skipping cache get:', err.message);
            }

            if (cached) {
                return res.status(200).json(JSON.parse(cached));
            }

            const data = await ReleaseDashboardService.getReleaseDashboardData(
                companyId,
                projectId,
                boardId,
                releaseId,
                tenantConnection
            );

            if (!data) {
                return res.status(404).json({
                    error: 'Release not found. Data may not have been calculated yet. Run sync to populate.',
                });
            }

            try {
                await redis.set(cacheKey, JSON.stringify(data), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }

            return res.status(200).json(data);
        } catch (error) {
            console.error('Error in release dashboard:', error);
            return res.status(500).json({ error: error.message });
        }
    }
}

export default new ReleaseDashboardController();
