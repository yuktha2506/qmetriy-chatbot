import { SprintModel, JiraReleaseModel, BoardModel } from '../model.js';
import { Types } from 'mongoose';
import burndownVelocityService from '../services/burndownVelocityService.js';

class BurndownVelocityController {
    async getBurndownVelocity(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId, type = 'storyPoints' } = req.query;

            if (!companyId || !projectId || !boardId) {
                return res.status(400).json({ error: 'companyId, projectId, and boardId are required' });
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

            if (!sprintId && !releaseId) {
                return res.status(400).json({ error: 'Either sprintId or releaseId must be provided' });
            }

            if (sprintId && !Types.ObjectId.isValid(sprintId)) {
                return res.status(400).json({ error: 'Invalid sprintId' });
            }

            if (releaseId && !Types.ObjectId.isValid(releaseId)) {
                return res.status(400).json({ error: 'Invalid releaseId' });
            }

            const allowedTypes = ['storyPoints', 'hours'];
            const estimationType = type.toLowerCase() === 'hours' ? 'hours' : 'storyPoints';
            if (!allowedTypes.includes(estimationType)) {
                return res.status(400).json({ error: 'Invalid type. Must be "storyPoints" or "hours"' });
            }

            const Board = BoardModel(tenantConnection);
            const board = await Board.findOne({
                _id: new Types.ObjectId(boardId),
                companyId: new Types.ObjectId(companyId),
                projectId: new Types.ObjectId(projectId)
            });
            if (!board) {
                return res.status(404).json({ error: 'Board not found' });
            }

            if (sprintId) {
                const Sprint = SprintModel(tenantConnection);
                const sprint = await Sprint.findOne({
                    _id: new Types.ObjectId(sprintId),
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                    boardId: new Types.ObjectId(boardId)
                });
                if (!sprint) {
                    return res.status(404).json({ error: 'Sprint not found' });
                }
            } else if (releaseId) {
                const JiraRelease = JiraReleaseModel(tenantConnection);
                const release = await JiraRelease.findOne({
                    _id: new Types.ObjectId(releaseId),
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                    boardId: new Types.ObjectId(boardId)
                });
                if (!release) {
                    return res.status(404).json({ error: 'Release not found' });
                }
            }

            const result = await burndownVelocityService.getBurndownVelocity(
                sprintId || null,
                releaseId || null,
                projectId,
                companyId,
                tenantConnection,
                estimationType,
                boardId
            );

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error getting burndown velocity:', error);
            return res.status(500).json({ error: error.message || 'Internal server error' });
        }
    }
}

export default new BurndownVelocityController();
