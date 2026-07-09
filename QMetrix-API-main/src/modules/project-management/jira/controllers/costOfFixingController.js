import { Types } from 'mongoose';
import { CompanyModel } from '../../../company/model';
import { JiraReleaseModel, ProjectModel, SprintModel, BoardModel } from '../model';
import connectionManager from '../../../../config/connectionManager';
import { getStartAndEndDate } from '../../../../utils/commonFunctions';
import costOfFixingService from '../services/costOfFixingService';
import { redis } from '../../../../server';
import cache from '../../../../utils/cache';
import { STATUS_ACTIVE } from '../../../../utils/constants/statusConstants.js';

class CostOfFixingController {
    async costOfFixingBug(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const { companyId, projectId, boardId } = req.params;
            const { releaseId, sprintId, developer } = req.query;
            const Sprint = SprintModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const Company = CompanyModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);

            const cacheKey = cache.generateKey('costOfFixing', {
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

            let kanbanBoard;

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
                label: { $regex: /^prod/i },
                'type.name': 'Bug',
            };
            const metaConnection = connectionManager.connectToMetaDB();
            const MetaCompany = CompanyModel(metaConnection);
            const { companyName } = await MetaCompany.findOne({ _id: new Types.ObjectId(companyId) }, { _id: 0, companyName: 1 });
            const companyDetails = (await Company.findOne({ companyName }, { _id: 0, storyPoints: 1 })) || {};

            if (sprintId) {
                const selectedType = await Sprint.findOne({ _id: new Types.ObjectId(sprintId), projectId, companyId });
                if (!selectedType) {
                    return res.status(404).json({ error: 'Sprint not found.' });
                }
                if (selectedType.state.toLowerCase() === STATUS_ACTIVE) {
                    const { startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, tenantConnection);
                    matchQuery.createdAt = { $gte: startOfDay, $lt: endOfDay };
                }
                matchQuery.sprintId = new Types.ObjectId(sprintId);
            }
            if (releaseId) {
                const selectedType = await JiraRelease.findOne({ _id: new Types.ObjectId(releaseId), projectId, companyId });
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
            }
            const costOfFixingprodResult = await costOfFixingService.costOfFixingProd(matchQuery, tenantConnection, companyDetails, kanbanBoard);

            const result = costOfFixingprodResult ? costOfFixingprodResult : [];
            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            return res.status(200).json(result);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
}

export default new CostOfFixingController();
