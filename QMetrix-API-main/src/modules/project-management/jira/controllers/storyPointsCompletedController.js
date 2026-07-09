import { SprintIssueModel, JiraReleaseModel, SprintModel, BoardIssueModel, ProjectModel, BoardModel } from '../model.js';
import { ConnectionModel } from '../../../connection/model.js';
import { Types } from 'mongoose';
import storyPointsCompletedService from '../services/storyPointsCompletedService.js';
import { getStartAndEndDate } from '../../../../utils/commonFunctions.js';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { PROVIDER_NAME_JIRA } from '../../../../utils/constants/providerConstants.js';
import { STATUS_ACTIVE } from '../../../../utils/constants/statusConstants.js';

class StoryPointsCompletedController {
    async getSPCommittedVsCompleted(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Sprint = SprintModel(tenantConnection);
            const SprintIssue = SprintIssueModel(tenantConnection);
            const Connection = ConnectionModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const KanbanIssue = BoardIssueModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);

            const result = [];
            const { companyId, projectId, boardId } = req.params;
            const { releaseId, sprintId } = req.query;

            const cacheKey = cache.generateKey('committedVsCompleted', {
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

            let selectedIssues = [];
            let selectedType = null;
            let kanbanBoard;
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

            const jiracred = await Connection.findOne({ companyId: companyId, name: PROVIDER_NAME_JIRA });
            if (!jiracred) {
                return res.status(404).json({ error: 'Jira credentials not found.' });
            }

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
            } else if (releaseId) {
                selectedType = await JiraRelease.findOne({ _id: new Types.ObjectId(releaseId), projectId, companyId });
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
            } else {
                return res.status(400).json({ error: 'Either sprintId or release must be provided.' });
            }
            const IssueModel = kanbanBoard ? KanbanIssue : SprintIssue;

            selectedIssues = await IssueModel.aggregate([
                { $match: matchQuery },
                { $sort: { createdAt: -1 } },
                { $group: { _id: '$issueId', latestTicket: { $first: '$$ROOT' } } },
                { $replaceRoot: { newRoot: '$latestTicket' } },
            ], { allowDiskUse: true });

            if (selectedIssues.length === 0) {
                const type = sprintId ? 'sprint' : 'release';
                return res.status(404).json({ error: `No issues found for this ${type}.` });
            }

            const issueId = selectedIssues[0].issueId;

            const [avgCycleTimeResult, spByTeamMemberResult, storyPointsResult, sprintIssueReleaseDateResult, committedAndCompletedResult, gettotalIssuesResult] = await Promise.allSettled([
                storyPointsCompletedService.getAverageCycleTime(selectedIssues),
                storyPointsCompletedService.getSPByTeamMember(selectedIssues, selectedType),
                storyPointsCompletedService.getStoryPoint(selectedType, selectedIssues),
                storyPointsCompletedService.getReleasesDate(jiracred, issueId),
                storyPointsCompletedService.getCommittedAndCompleted(selectedIssues, selectedType),
                storyPointsCompletedService.getTotalIssues(selectedIssues),
            ]);

            result.push({ AvgCycleTime: avgCycleTimeResult.status === 'fulfilled' ? avgCycleTimeResult.value.AverageCycleTime : null });
            result.push({ SPByTeamMember: spByTeamMemberResult.status === 'fulfilled' ? spByTeamMemberResult.value.result : null });
            result.push({ storyPoints: storyPointsResult.status === 'fulfilled' ? storyPointsResult.value : null });
            result.push({ SprintIssueReleaseDate: sprintIssueReleaseDateResult.status === 'fulfilled' ? sprintIssueReleaseDateResult?.value?.fields?.fixVersions?.[0]?.releaseDate : null });
            result.push({ CommittedAndCompleted: committedAndCompletedResult.status === 'fulfilled' ? committedAndCompletedResult.value.CommittedAndCompleted : null });
            result.push({ gettotalIssues: gettotalIssuesResult.status === 'fulfilled' ? gettotalIssuesResult.value : null });

            if (avgCycleTimeResult.status === 'rejected') {
                console.error('Error fetching average cycle time:', avgCycleTimeResult.reason);
            }
            if (spByTeamMemberResult.status === 'rejected') {
                console.error('Error fetching story points by team member:', spByTeamMemberResult.reason);
            }
            if (storyPointsResult.status === 'rejected') {
                console.error('Error fetching story points:', storyPointsResult.reason);
            }
            if (sprintIssueReleaseDateResult.status === 'rejected') {
                console.error('Error fetching sprint issue release date:', sprintIssueReleaseDateResult.reason);
            }
            if (committedAndCompletedResult.status === 'rejected') {
                console.error('Error fetching committed and completed tasks:', committedAndCompletedResult.reason);
            }
            if (gettotalIssuesResult.status === 'rejected') {
                console.error('Error fetching committed and completed tasks:', gettotalIssuesResult.reason);
            }

            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            return res.status(200).json(result);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    async getStoryPointData(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Sprint = SprintModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);

            const { companyId, projectId, boardId } = req.params;
            const { releaseId, sprintId } = req.query;

            const project = await Project.findOne({ _id: new Types.ObjectId(projectId) }, { boardType: 1 });
            if (!project) {
                return res.status(404).json({ error: 'Project not found.' });
            }
            const board = await Board.findOne(
                {
                    _id: new Types.ObjectId(boardId),
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                },
                { boardType: 1 }
            );

            const isKanban = board?.boardType.toLowerCase() === 'kanban';
            let selectedType = null;

            if (releaseId) {
                selectedType = await JiraRelease.findOne(
                    { _id: new Types.ObjectId(releaseId), projectId, companyId, boardId: new Types.ObjectId(boardId) },
                    { _id: 1, releaseName: 1, startDate: 1, committedVsCompletedMetrics: 1 }
                );
                if (!selectedType) {
                    return res.status(404).json({ error: 'Release not found.' });
                }
            } else if (!isKanban && sprintId) {
                selectedType = await Sprint.findOne(
                    { _id: new Types.ObjectId(sprintId), projectId, companyId, boardId: new Types.ObjectId(boardId) },
                    { _id: 1, name: 1, startDate: 1, committedVsCompletedMetrics: 1, boardId: 1 }
                );
                if (!selectedType) {
                    return res.status(404).json({ error: 'Sprint not found.' });
                }
            }

            const Model = isKanban || releaseId ? JiraRelease : Sprint;
            const nameField = isKanban || releaseId ? 'releaseName' : 'name';

            const lastSixData = await Model.find(
                { companyId, projectId, boardId: new Types.ObjectId(boardId), state: { $ne: 'future' } },
                { [nameField]: 1, committedVsCompletedMetrics: 1, startDate: 1, boardId: 1 }
            )
                .sort({ startDate: 1 })
                .lean()
                .then((allRecords) => {
                    if (!selectedType) {
                        return allRecords.slice(-5);
                    }

                    const selectedIndex = allRecords.findIndex((r) => r._id.equals(selectedType._id));
                    if (selectedIndex === -1) {
                        return [];
                    }
                    return allRecords.slice(Math.max(0, selectedIndex - 4), selectedIndex + 1);
                });
                
            return res.status(200).json({
                lastFiveData: lastSixData.map((data) => ({
                    name: data[nameField],
                    committedVsCompletedMetrics: data.committedVsCompletedMetrics,
                })),
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: error.message });
        }
    }
}

export default new StoryPointsCompletedController();
