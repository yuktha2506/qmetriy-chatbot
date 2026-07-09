import { SprintIssueModel, JiraReleaseModel, BoardIssueModel, ProjectModel, SprintModel, BoardModel, BacklogIssueModel } from '../model.js';
import IssueTypeService from '../services/issueTypeService.js';
import { Types } from 'mongoose';
import { ConnectionModel } from '../../../connection/model.js';
import { getStartAndEndDate } from '../../../../utils/commonFunctions.js';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import {
    PROVIDER_NAME_JIRA,
    PROVIDER_NAME_AZURE_BOARDS,
    PROVIDER_NAME_GITLAB_ISSUES,
} from '../../../../utils/constants/providerConstants.js';
import { STATUS_ACTIVE } from '../../../../utils/constants/statusConstants.js';

class IssueTypeController {
    async getIssueType(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const SprintIssue = SprintIssueModel(tenantConnection);
            const Connection = ConnectionModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const KanbanIssue = BoardIssueModel(tenantConnection);
            const Sprint = SprintModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);
            const BacklogIssue = BacklogIssueModel(tenantConnection);
            const result = [];
            const { companyId, projectId, boardId } = req.params;
            const { releaseId, sprintId, developer } = req.query;
            const cred = await Connection.findOne({ companyId, name: { $in: [PROVIDER_NAME_JIRA, PROVIDER_NAME_AZURE_BOARDS, PROVIDER_NAME_GITLAB_ISSUES] } });

            const cacheKey = cache.generateKey('issueType', {
                projectId,
                companyId,
                boardId,
                sprintId,
                releaseId,
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

            // Validate board
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

            let selectedType, kanbanBoard;
            const projectDoc = await Project.findOne({ _id: new Types.ObjectId(projectId), companyId }).lean();
            const matchQuery = {
                projectId: new Types.ObjectId(projectId),
                companyId: new Types.ObjectId(companyId),
            };
            if (cred?.name !== PROVIDER_NAME_GITLAB_ISSUES) {
                matchQuery.boardId = new Types.ObjectId(boardId);
            }
            if (sprintId) {
                const sprintQuery = {
                    _id: new Types.ObjectId(sprintId),
                    projectId,
                    companyId,
                };
                if (cred?.name !== PROVIDER_NAME_GITLAB_ISSUES) {
                    sprintQuery.boardId = new Types.ObjectId(boardId);
                }
                selectedType = await Sprint.findOne(sprintQuery);
                if (!selectedType) {
                    return res.status(404).json({ error: 'Sprint not found.' });
                }
                if (selectedType.state === STATUS_ACTIVE) {
                    const { startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, tenantConnection);
                    matchQuery.createdAt = { $gte: startOfDay, $lt: endOfDay };
                }
                matchQuery.sprintId = new Types.ObjectId(sprintId);
            } else if (releaseId) {
                const releaseQuery = {
                    _id: new Types.ObjectId(releaseId),
                    projectId,
                    companyId,
                };
                if (cred?.name !== PROVIDER_NAME_GITLAB_ISSUES) {
                    releaseQuery.boardId = new Types.ObjectId(boardId);
                }
                selectedType = await JiraRelease.findOne(releaseQuery);
                if (!selectedType) {
                    return res.status(404).json({ error: 'Release not found.' });
                }

                if (board) {
                    if (board?.boardType.toLowerCase() === 'kanban' || board?.boardType.toLowerCase() === 'gitlab-board') {
                        kanbanBoard = projectDoc;
                    } else if (board.boardType.toLowerCase() === 'scrum' || board.boardType.toLowerCase() === 'simple') {
                        const sprintCountQuery = {
                            companyId,
                            projectId,
                        };
                        if (cred?.name !== PROVIDER_NAME_GITLAB_ISSUES) {
                            sprintCountQuery.boardId = new Types.ObjectId(boardId);
                        }
                        const sprintCount = await Sprint.countDocuments(sprintCountQuery);
                        if (sprintCount === 0) {
                            kanbanBoard = projectDoc;
                        }
                    }
                }
                matchQuery.fixVersion = { $regex: selectedType.releaseName, $options: 'i' };
            } else {
                return res.status(400).json({ error: 'Either sprintId or release must be provided.' });
            }

            // Add developer filter if provided
            if (developer && developer !== 'null' && developer !== 'UnAssigned') {
                matchQuery.assignee = developer;
            }

            const IssueModel = kanbanBoard ? KanbanIssue : SprintIssue;
            const selectedIssues = await IssueModel.aggregate([
                { $match: matchQuery },
                { $sort: { createdAt: -1 } },
                { $group: { _id: '$issueId', latestTicket: { $first: '$$ROOT' } } },
                { $replaceRoot: { newRoot: '$latestTicket' } },
            ], { allowDiskUse: true });
            if (releaseId) {
                const backlogFilter = {
                    projectId: new Types.ObjectId(projectId),
                    companyId: new Types.ObjectId(companyId),
                    boardId: new Types.ObjectId(boardId),
                    fixVersion: selectedType.releaseName,
                };
                if (developer && developer !== 'null' && developer !== 'UnAssigned') {
                    backlogFilter.assignee = developer;
                }

                const backlogIssues = await BacklogIssue.aggregate([
                    { $match: backlogFilter },
                    { $sort: { issueCreatedAt: -1 } },
                    {
                        $group: {
                            _id: '$issueId',
                            latestTicket: { $first: '$$ROOT' },
                        },
                    },
                    { $replaceRoot: { newRoot: '$latestTicket' } },
                ], { allowDiskUse: true });

                // Add BacklogIssue results to existing selectedIssues
                selectedIssues.push(...backlogIssues);
            }

            // Deduplicate issues by issueId, keeping the latest one (same pattern as jiraTable)
            const latestIssueMap = new Map();
            selectedIssues.forEach((issue) => {
                const issueDate = issue.createdAt || issue.issueCreatedAt;
                if (issue.issueId) {
                    const existingIssue = latestIssueMap.get(issue.issueId);
                    if (!existingIssue) {
                        latestIssueMap.set(issue.issueId, issue);
                    } else {
                        const existingDate = existingIssue.createdAt || existingIssue.issueCreatedAt;
                        if (issueDate && existingDate && new Date(issueDate) > new Date(existingDate)) {
                            latestIssueMap.set(issue.issueId, issue);
                        }
                    }
                }
            });
            selectedIssues.length = 0;
            selectedIssues.push(...Array.from(latestIssueMap.values()));

            const workflowStatuses = projectDoc?.workflowStatuses || [];
            const orderedStatuses = workflowStatuses.sort((a, b) => a.order - b.order).flatMap((item) => item.statuses);

            const [openIssues, openIssuesPerTeamMember, statusDistribution, getPriorityWise] = await Promise.allSettled([
                IssueTypeService.getOpenIssues(selectedIssues),
                IssueTypeService.getOpenIssuesPerTeamMember(selectedIssues),
                IssueTypeService.getStatusDistribution(selectedIssues, orderedStatuses, cred),
                IssueTypeService.getPriorityWise(selectedIssues),
            ]);

            result.push({ openIssues: openIssues.status === 'fulfilled' ? openIssues.value : null });
            result.push({ openIssuesPerTeamMember: openIssuesPerTeamMember.status === 'fulfilled' ? openIssuesPerTeamMember.value : null });
            result.push({ statusDistribution: statusDistribution.status === 'fulfilled' ? statusDistribution.value : null });
            result.push({ getPriorityWise: getPriorityWise.status === 'fulfilled' ? getPriorityWise.value : null });

            if (openIssues.status === 'rejected') {
                console.error('Error Fetching OpenIssues');
            }
            if (openIssuesPerTeamMember.status === 'rejected') {
                console.error('Error Fetching OpenIssues Per Team Member');
            }
            if (statusDistribution.status === 'rejected') {
                console.error('Error Fetching status distribution');
            }
            if (getPriorityWise.status === 'rejected') {
                console.error('Error Fetching status distribution');
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
}

export default new IssueTypeController();
