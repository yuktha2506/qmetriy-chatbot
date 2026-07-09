import { SprintIssueModel, JiraReleaseModel, SprintModel, BoardIssueModel, ProjectModel, BoardModel } from '../model.js';
import { Types } from 'mongoose';
import { getStartAndEndDate } from '../../../../utils/commonFunctions.js';
import VelocityService from '../services/velocityService.js';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { STATUS_ACTIVE } from '../../../../utils/constants/statusConstants.js';

class VelocityController {
    async getVelocity(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Sprint = SprintModel(tenantConnection);
            const SprintIssue = SprintIssueModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const KanbanIssue = BoardIssueModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);

            const { companyId, projectId, boardId } = req.params;
            const { releaseId, sprintId, estimationType = 'storyPoints' } = req.query;
            const allowed = new Set(['storyPoints', 'hours', 'count']);
            if (!allowed.has(estimationType)) {
                return res.status(400).json({ error: 'Invalid estimationType' });
            }

            // Validate ObjectIds
            if (!Types.ObjectId.isValid(companyId)) {
                return res.status(400).json({ error: 'Invalid companyId' });
            }
            if (!Types.ObjectId.isValid(projectId)) {
                return res.status(400).json({ error: 'Invalid projectId' });
            }
            if (!Types.ObjectId.isValid(boardId)) {
                return res.status(400).json({ error: 'Invalid boardId' });
            }
            if (releaseId && !Types.ObjectId.isValid(releaseId)) {
                return res.status(400).json({ error: 'Invalid releaseId' });
            }
            if (sprintId && !Types.ObjectId.isValid(sprintId)) {
                return res.status(400).json({ error: 'Invalid sprintId' });
            }

            let selectedType = null;

            const cacheKey = cache.generateKey('velocity', {
                projectId,
                companyId,
                sprintId,
                releaseId,
                boardId,
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

            const matchQuery = {
                projectId: new Types.ObjectId(projectId),
                companyId: new Types.ObjectId(companyId),
                boardId: new Types.ObjectId(boardId),
            };

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

            let isKanban;
            if (releaseId) {
                selectedType = await JiraRelease.findOne({ _id: new Types.ObjectId(releaseId), projectId, companyId, boardId: new Types.ObjectId(boardId) });
                if (!selectedType) {
                    return res.status(404).json({ error: 'Release not found.' });
                }
                const project = await Project.findOne({ _id: new Types.ObjectId(projectId), companyId });

                if (board) {
                    if (board.boardType === 'kanban') {
                        isKanban = project;
                    } else if (board.boardType === 'scrum' || board.boardType === 'simple') {
                        const sprintCount = await Sprint.countDocuments({ companyId, projectId });
                        if (sprintCount === 0) {
                            isKanban = project;
                        }
                    }
                }
                matchQuery.fixVersion = { $regex: selectedType.releaseName, $options: 'i' };
            }

            if (sprintId) {
                selectedType = await Sprint.findOne({ _id: new Types.ObjectId(sprintId), projectId, companyId, boardId: new Types.ObjectId(boardId) });
                if (!selectedType) {
                    return res.status(404).json({ error: 'Sprint not found.' });
                }
                if (selectedType.state.toLowerCase() === STATUS_ACTIVE) {
                    const { startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, tenantConnection);
                    matchQuery.createdAt = { $gte: startOfDay, $lt: endOfDay };
                }
                matchQuery.sprintId = new Types.ObjectId(sprintId);
            }

            const IssueModel = isKanban ? KanbanIssue : SprintIssue;

            const selectedIssues = await IssueModel.aggregate([
                { $match: matchQuery },
                { $sort: { createdAt: -1 } },
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
                    $project: { assignee: 1, status: 1, storyPoints: 1,type:1, originalEstimateHrs:1 }                }
            ], { allowDiskUse: true });
            const [velocity, avgVelocity, velocityPerMember] = await Promise.all([
                VelocityService.getVelocity(sprintId, releaseId, projectId, companyId, tenantConnection, isKanban, estimationType),
                VelocityService.getAverageVelocity(sprintId, releaseId, projectId, companyId, tenantConnection, isKanban, estimationType, Sprint, JiraRelease),
                VelocityService.getVelocityPerMember(selectedIssues, estimationType),
            ]);

            const lastSixData = releaseId
                ? await JiraRelease.find({ companyId, projectId, boardId: new Types.ObjectId(boardId) }, { releaseName: 1, velocity: 1 })
                    .sort({ startDate: 1 })
                    .lean()
                    .then((allReleases) => {
                        const releaseObjectId = new Types.ObjectId(releaseId);
                        const selectedIndex = allReleases.findIndex((r) => r._id.equals(releaseObjectId));
                        if (selectedIndex === -1) {
                            return [];
                        }
                        return allReleases.slice(Math.max(0, selectedIndex - 5), selectedIndex + 1);
                    })
                : sprintId
                    ? await Sprint.find({ companyId, projectId, boardId: new Types.ObjectId(boardId) })
                        .sort({ startDate: 1 })
                        .lean()
                        .then((allSprints) => {
                            const sprintObjectId = new Types.ObjectId(sprintId);
                            const selectedIndex = allSprints.findIndex((s) => s._id.equals(sprintObjectId));
                            if (selectedIndex === -1) {
                                return [];
                            }
                            return allSprints.slice(Math.max(0, selectedIndex - 5), selectedIndex + 1);
                        })
                    : [];

            const result = {
                velocity,
                avgVelocity,
                velocityPerMember,
                lastSixData: lastSixData.map((data) => ({ name: data.name || data.releaseName, velocity: data.velocity })),
            };
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

export default new VelocityController();
