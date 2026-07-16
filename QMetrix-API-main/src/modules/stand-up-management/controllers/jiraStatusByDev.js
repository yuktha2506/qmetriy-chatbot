import { ProjectModel, SprintIssueModel, JiraReleaseModel,BoardIssueModel, SprintModel, BoardModel, BacklogIssueModel } from '../../project-management/jira/model';
import { ConnectionModel } from '../../connection/model';
import { Types } from 'mongoose';
import { getStartAndEndDate } from '../../../utils/commonFunctions';
import {
    PROVIDER_NAME_JIRA,
    PROVIDER_NAME_AZURE_BOARDS,
    PROVIDER_NAME_GITLAB_ISSUES,
} from '../../../utils/constants/providerConstants';
import { STATUS_ACTIVE } from '../../../utils/constants/statusConstants.js';

class JiraStatusByDev {
    async getJiraStatusByDev(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Connection = ConnectionModel(tenantConnection);
            const sprintIssue = SprintIssueModel(tenantConnection);
            const kandbanIssue = BoardIssueModel(tenantConnection);
            const JiraReleases = JiraReleaseModel(tenantConnection);
            const Sprint = SprintModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);
            const BacklogIssue = BacklogIssueModel(tenantConnection);
            const { projectId, companyId, boardId } = req.params;
            const { sprintId, releaseId, developer: dev } = req.query;

            const developer = (dev === 'UnAssigned' || dev === 'Unassigned') ? null : dev;

            const cred = await Connection.findOne({ companyId, name: { $in: [PROVIDER_NAME_JIRA, PROVIDER_NAME_AZURE_BOARDS, PROVIDER_NAME_GITLAB_ISSUES] } });
            const projects = await Project.find({ companyId: companyId, _id: projectId });

            const workflowStatuses = projects[0]?.workflowStatuses || [];
            const orderedStatuses = workflowStatuses.sort((a, b) => a.order - b.order).flatMap((item) => item.statuses);
            
            if (!cred) {
                return res.status(400).json({ error: 'Jira connection not found.' });
            }

            // Validate board
            const board = await Board.findOne({
                _id: new Types.ObjectId(boardId),
                companyId: new Types.ObjectId(companyId),
                projectId: new Types.ObjectId(projectId)
            }, { boardType: 1 });

            if (!board) {
                return res.status(404).json({ error: 'Board not found.' });
            }

            const bt = (board?.boardType || '').toLowerCase();
            let useBoardIssues =
                bt === 'kanban' || bt === 'gitlab-board' || bt === 'simple';
            if (!useBoardIssues && bt === 'scrum') {
                const sprintCountOnBoard = await Sprint.countDocuments({
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                    boardId: board._id,
                });
                useBoardIssues = sprintCountOnBoard === 0;
            }
            const filter = { 
                projectId: new Types.ObjectId(projectId), 
                companyId: new Types.ObjectId(companyId)
            };
            
            // Handle unassigned filtering - match all variations
            if (developer === null) {
                // Match all unassigned variations: null, 'Unassigned', 'UnAssigned', empty string, or missing field
                filter.assignee = { 
                    $in: [null, 'Unassigned', 'UnAssigned', ''] 
                };
            } else {
                filter.assignee = developer;
            }
            
            if (cred?.name !== PROVIDER_NAME_GITLAB_ISSUES) {
                filter.boardId = new Types.ObjectId(boardId);
            }

            if (releaseId) {
                const release = await JiraReleases.findOne({ _id: releaseId, companyId });
                if (!release) {
                    console.error('Release not found');
                }
                filter.fixVersion = release.releaseName;
            } else if (sprintId) {
                const selectedType = await Sprint.findOne({ companyId, projectId, _id: sprintId });
                if (selectedType.state.toLowerCase() === STATUS_ACTIVE) {
                    const { startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, tenantConnection);
                    filter.createdAt = { $gte: startOfDay, $lt: endOfDay };
                }
                filter.sprintId = { $in: [new Types.ObjectId(sprintId)] };
            } else {
                return res.status(400).json({ error: 'Either Sprint ID or Release ID is required.' });
            }
            const IssueModel = useBoardIssues ? kandbanIssue : sprintIssue;
            const issues = await IssueModel.aggregate([
                { $match: filter },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: '$issueId',
                        latestTicket: { $first: '$$ROOT' },
                    },
                },
                { $replaceRoot: { newRoot: '$latestTicket' } },
            ], { allowDiskUse: true });
            if (releaseId) {
                const backlogFilter = {
                    projectId: new Types.ObjectId(projectId),
                    companyId: new Types.ObjectId(companyId),
                    boardId: new Types.ObjectId(boardId),
                    fixVersion: filter.fixVersion,
                };
                if (dev !== undefined) {
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

                // Add BacklogIssue results to existing issues
                issues.push(...backlogIssues);
                const latestIssueMap = new Map();
                issues.forEach((issue) => {
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
                issues.length = 0;
                issues.push(...Array.from(latestIssueMap.values()));
            }
            const normalizeStatus = (s) =>
                String(s || '')
                    .trim()
                    .toLowerCase()
                    .replace(/[\s_-]+/g, ' ');

            const displayByNorm = new Map();
            orderedStatuses.forEach((s) => {
                const norm = normalizeStatus(s);
                if (norm && !displayByNorm.has(norm)) {
                    displayByNorm.set(norm, s);
                }
            });

            const statusCountsByNorm = issues.reduce((acc, item) => {
                let statusName = 'Unknown';

                // For GitLab Issues, check labels first to match workflow statuses
                if (cred?.name === PROVIDER_NAME_GITLAB_ISSUES) {
                    const labels = Array.isArray(item.label) ? item.label : [];
                    const matchingLabel = labels.find((label) => displayByNorm.has(normalizeStatus(label)));
                    if (matchingLabel) {
                        statusName = displayByNorm.get(normalizeStatus(matchingLabel)) || String(matchingLabel);
                    } else {
                        statusName = String(item.status?.name) || 'Unknown';
                    }
                } else {
                    // Jira / Azure Boards
                    statusName = String(item.status?.name) || 'Unknown';
                }

                const norm = normalizeStatus(statusName || 'Unknown') || 'unknown';
                if (!displayByNorm.has(norm)) {
                    displayByNorm.set(norm, statusName || 'Unknown');
                }
                acc[norm] = (acc[norm] || 0) + 1;
                return acc;
            }, {});
            //we can use this if we want to show all the status even the count is 0 and the workflow status order only
            // const sortedStatusCounts = Object.fromEntries(orderedStatuses.filter((status) => statusCounts[status] !== undefined).map((status) => [status, statusCounts[status] ?? 0]));
            const sortedStatusCounts = {};
            orderedStatuses.forEach((status) => {
                const norm = normalizeStatus(status);
                const label = displayByNorm.get(norm) || status;
                if (!(label in sortedStatusCounts)) {
                    sortedStatusCounts[label] = statusCountsByNorm[norm] ?? 0;
                }
            });

            Object.keys(statusCountsByNorm).forEach((norm) => {
                const label = displayByNorm.get(norm) || norm;
                if (!(label in sortedStatusCounts)) {
                    sortedStatusCounts[label] = statusCountsByNorm[norm];
                }
            });
            const finalStatusCounts = Object.fromEntries(Object.entries(sortedStatusCounts).filter(([, count]) => count > 0));
            return res.status(200).json(finalStatusCounts);
        } catch (error) {
            console.error('Error fetching Jira data:', error);
            return res.status(500).json({ error: error.message });
        }
    }
}
export default new JiraStatusByDev();
