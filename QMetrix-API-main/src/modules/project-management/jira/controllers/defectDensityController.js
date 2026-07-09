import { JiraReleaseModel, ProjectModel, SprintModel, BoardModel } from '../model.js';
import { CXOModel } from '../../../cxo/model.js';
import { Types } from 'mongoose';
import DefectDensityService from '../services/defectDensityService.js';
import { getStartAndEndDate } from '../../../../utils/commonFunctions.js';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { STATUS_ACTIVE } from '../../../../utils/constants/statusConstants.js';

class DefectDensityController {
    async defectDensity(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Sprint = SprintModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const Cxo = CXOModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);
            const { companyId, projectId, boardId } = req.params;
            const { releaseId, sprintId, developer } = req.query;

            const cacheKey = cache.generateKey('defectDensity', {
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

            const result = [];
            let identifierType, selectedType, sonarQubeData, kanbanBoard, activeSprint;
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

            if (sprintId) {
                selectedType = await Sprint.findOne({ _id: new Types.ObjectId(sprintId), projectId, companyId });
                if (!selectedType) {
                    return res.status(404).json({ error: 'Sprint not found.' });
                }
                if (selectedType.state.toLowerCase() === STATUS_ACTIVE) {
                    ({ startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, tenantConnection));
                    activeSprint = true;
                }
                identifierType = 'sprintId';
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
            }
            const matchCondition = {
                companyId: new Types.ObjectId(companyId),
                projectId: new Types.ObjectId(projectId),
                ...(identifierType === 'sprintId' ? { sprintId: new Types.ObjectId(sprintId) } : { releaseVersion: { $regex: selectedType.releaseName, $options: 'i' } }),
            };

            // Add developer filter if provided
            if (developer && developer !== 'null' && developer !== 'UnAssigned') {
                matchCondition.developer = developer;
            }

            const combinedScanData = await Cxo.aggregate([
                {
                    $match: matchCondition,
                },
                { $sort: { createdAt: -1 } },
                { $group: { _id: identifierType === 'sprintId' ? '$sprintId' : '$releaseVersion', latestData: { $first: '$$ROOT' } } },
            ], { allowDiskUse: true });
            if (!combinedScanData) {
                return res.status(404).json({ error: 'SonarQube data is missing or not available for the project.' });
            } else {
                sonarQubeData = combinedScanData.length > 0 ? combinedScanData[0].latestData.engineeringScoreObject?.developerScoreObject?.combinedScanData?.ncloc : null;
            }

            const [defectDensityValue, defectDensityBySprintOrReleaseValue] = await Promise.allSettled([
                DefectDensityService.defectDensity(tenantConnection, companyId, projectId, sprintId, selectedType, identifierType, sonarQubeData, kanbanBoard, activeSprint, startOfDay, endOfDay),
                DefectDensityService.defectDensityBySprintOrRelease(
                    tenantConnection,
                    companyId,
                    projectId,
                    boardId,
                    sonarQubeData,
                    identifierType,
                    kanbanBoard,
                    identifierType === 'sprintId' ? sprintId : selectedType.releaseName
                ),
            ]);

            result.push({ defectDensity: defectDensityValue.status === 'fulfilled' ? defectDensityValue.value : null });
            result.push({ defectDensityBySprintOrRelease: defectDensityBySprintOrReleaseValue.status === 'fulfilled' ? defectDensityBySprintOrReleaseValue.value : null });
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

export default new DefectDensityController();
