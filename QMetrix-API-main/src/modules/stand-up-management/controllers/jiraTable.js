import { ProjectModel, SprintIssueModel, JiraReleaseModel, BoardIssueModel, SprintModel, BoardModel, BacklogIssueModel } from '../../project-management/jira/model';
import { Types } from 'mongoose';
import { PullRequestModel } from '../../source-code-management/github/model';
import { ConnectionModel } from '../../connection/model';
import { getStartAndEndDate } from '../../../utils/commonFunctions';
import { redis } from '../../../server';
import cache from '../../../utils/cache';
import { STATUS_ACTIVE, STATUS_CLOSED } from '../../../utils/constants/statusConstants';
import {
    PROVIDER_NAME_JIRA,
    PROVIDER_NAME_GITHUB,
    PROVIDER_NAME_GITLAB,
    PROVIDER_NAME_ADO,
    PROVIDER_NAME_BITBUCKET,
    PROVIDER_NAME_GITLAB_ISSUES,
    PROVIDER_NAME_AZURE_BOARDS,
    PROVIDER_NAME_AZUREBOARDS,
    PROVIDER_NAME_AZURE_BOARD,
} from '../../../utils/constants/providerConstants';
import { buildPrTitleIssueKeyPattern } from '../../source-code-management/utils/extractJiraIssueKeyFromPrTitle';

class JiraTableController {
    async jiraData(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const PullRequest = PullRequestModel(tenantConnection);
            const Connection = ConnectionModel(tenantConnection);
            const JiraReleases = JiraReleaseModel(tenantConnection);
            const Sprint = SprintModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);
            const BacklogIssue = BacklogIssueModel(tenantConnection);

            const { projectId, companyId, boardId } = req.params;
            const { sprintId, releaseId, developer: dev } = req.query;

            const developer = (dev === 'UnAssigned' || dev === 'Unassigned') ? null : dev;
            const cacheKey = cache.generateKey('jiraData', {
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

            const cred = await Connection.findOne({ companyId, name: { $in: [PROVIDER_NAME_JIRA, PROVIDER_NAME_AZURE_BOARDS, PROVIDER_NAME_GITLAB_ISSUES] } });
            if (!cred) {
                return res.status(400).json({ error: 'Jira connection not found.' });
            }

            const gitHubCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITHUB });
            const gitLabCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITLAB });
            const gitAzureCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_ADO });
            const bitbucketCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_BITBUCKET });
            const gitProvider = gitHubCred ? 'github' : gitLabCred ? 'gitlab' : gitAzureCred ? 'azure' : bitbucketCred ? 'bitbucket' : null;
            if (!gitProvider) {
                console.warn('No GitHub, GitLab,Azure DevOps or Bitbucke connection found for this company.');
            }

            let WORKITEM_BASE_URL = '';

            const filter = {
                projectId: new Types.ObjectId(projectId),
                companyId: new Types.ObjectId(companyId),
            };

            // Only include boardId in filter if not GitLab Issues
            if (cred?.name !== PROVIDER_NAME_GITLAB_ISSUES) {
                filter.boardId = new Types.ObjectId(boardId);
            }
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

            let useBoardIssueCollection = false;
            const boardTypeLower = (board.boardType || '').toLowerCase();
            if (boardTypeLower === 'kanban' || boardTypeLower === 'gitlab-board' || boardTypeLower === 'simple') {
                useBoardIssueCollection = true;
            } else if (boardTypeLower === 'scrum') {
                const sprintCountOnBoard = await Sprint.countDocuments({
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                    boardId: board._id,
                });
                useBoardIssueCollection = sprintCountOnBoard === 0;
            }

            if (dev !== undefined) {
                if (developer === null) {
                    // Match all unassigned variations: null, 'Unassigned', 'UnAssigned', empty string, or missing field
                    filter.assignee = { 
                        $in: [null, 'Unassigned', 'UnAssigned', ''] 
                    };
                } else {
                    filter.assignee = developer;
                }
            }

            const projectDoc = await Project.findOne({ _id: new Types.ObjectId(projectId), companyId }).lean();

            if (releaseId) {
                const release = await JiraReleases.findOne({ _id: releaseId, companyId, projectId });
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
                filter.sprintId = new Types.ObjectId(sprintId);
            } else {
                return res.status(400).json({ error: 'Either Sprint ID or Release ID is required.' });
            }

            const IssueModel = cred?.name === PROVIDER_NAME_GITLAB_ISSUES
                ? BoardIssueModel(tenantConnection)
                : useBoardIssueCollection
                    ? BoardIssueModel(tenantConnection)
                    : SprintIssueModel(tenantConnection);

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
                issues.push(...backlogIssues);
                // Deduplicate issues by issueId, keeping the latest one (same pattern as churn calculation)
                const latestIssueMap = new Map();
                issues.forEach((issue) => {
                    // Use createdAt if available (mongoose timestamp), otherwise fall back to issueCreatedAt
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
            const isAzureProject = (projectDoc?.projectTypeKey || '').toLowerCase() === 'azure-project' || (projectDoc?.boardType || '').toLowerCase().includes('azure');
            const jiraCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_JIRA });
            const gitLabIssuesCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITLAB_ISSUES });
            const azureCred = await Connection.findOne({ companyId, name: { $in: [PROVIDER_NAME_AZURE_BOARDS, PROVIDER_NAME_AZUREBOARDS, PROVIDER_NAME_AZURE_BOARD] } });
            if (!jiraCred && !azureCred && !gitLabIssuesCred) {
                return res.status(400).json({ error: 'No project management connection found.' });
            }
            if (isAzureProject) {
                if (!azureCred) {
                    return res.status(400).json({ error: 'Azure Boards connection not found.' });
                }
                WORKITEM_BASE_URL = `${azureCred.host}/${encodeURIComponent(projectDoc?.name || '')}/_workitems/edit/`;
            } else if (gitLabIssuesCred) {
                WORKITEM_BASE_URL = `${gitLabIssuesCred.host}/browse/`;
            } else {
                WORKITEM_BASE_URL = `${jiraCred.host}/browse/`;
            }
            const pullRequests = await PullRequest.find({
                projectId: new Types.ObjectId(projectId),
                companyId: new Types.ObjectId(companyId),
                boardId: new Types.ObjectId(boardId),
            }).lean();
            const repoLinks = projectDoc?.repos || [];

            const sprintsData = await Sprint.aggregate([
                { $match: { companyId: new Types.ObjectId(companyId), projectId: new Types.ObjectId(projectId), boardId: new Types.ObjectId(boardId) } },
                { $project: { _id: { $toString: '$_id' }, name: 1, state: 1, startDate: 1 } }
            ]);
            const setSprintoutcome = (issue) => {
                const ticketIds = issue.map(id => id.toString());
                const matchedSprints = sprintsData
                    .filter(sprint => ticketIds.includes(sprint._id.toString()))
                    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
                const sprintNames = matchedSprints.map(sprint => sprint.name);
                const hasActive = matchedSprints.some(sprint => sprint.state === STATUS_ACTIVE);
                const hasClosed = matchedSprints.some(sprint => sprint.state === STATUS_CLOSED);
                const spilledOver = hasActive && hasClosed;
                return {
                    spilledOver,
                    sprintNames
                };
            };
            const formattedIssues = await Promise.all(
                issues.map(async (issue) => {
                    const prDetails = [];
                    const daysOpenList = [];
                    let blockedBy = 'NA';
                    if (gitProvider) {
                        const issueKeyPattern = buildPrTitleIssueKeyPattern(issue.key);
                        const matchingPRs = pullRequests.filter((pr) => {
                            const match = pr.title?.match(issueKeyPattern);
                            return !!match;
                        });

                        if (matchingPRs.length > 0) {
                            matchingPRs.sort((a, b) => new Date(b.prCreatedAt) - new Date(a.prCreatedAt));

                            prDetails.push(
                                ...matchingPRs.map((matchingPR) => {
                                    const matchedRepoUrl = repoLinks.find((link) => link.endsWith(matchingPR.repo)) || '';
                                    let prUrl;
                                    switch (gitProvider) {
                                    case 'gitlab':
                                        prUrl = `${matchedRepoUrl}/-/merge_requests/${matchingPR.prNumber}`;
                                        break;
                                    case 'azure':
                                        prUrl = `${matchedRepoUrl}/pullrequest/${matchingPR.prNumber}`;
                                        break;
                                    case 'bitbucket':
                                        prUrl = `${matchedRepoUrl}/pull-requests/${matchingPR.prNumber}`;
                                        break;
                                    case 'github':
                                    default:
                                        prUrl = `${matchedRepoUrl}/pull/${matchingPR.prNumber}`;
                                        break;
                                    }

                                    const created = new Date(matchingPR.prCreatedAt);
                                    const merged = matchingPR.prClosedAt || matchingPR.prMergedAt
                                        ? new Date(matchingPR.prClosedAt || matchingPR.prMergedAt)
                                        : null;
                                    const diffInMs = merged ? merged - created : new Date() - created;
                                    const daysOpen = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
                                    daysOpenList.push(daysOpen);

                                    return {
                                        prNumber: `#${matchingPR.prNumber}`,
                                        filesChanged: matchingPR.filesChanged || 0,
                                        branchName: matchingPR.branchName || 'NA',
                                        prTitle: matchingPR.title || 'NA',
                                        prCreatedBy: matchingPR.prCreatedBy || 'NA',
                                        prStatus: matchingPR.status || 'NA',
                                        prReviews: matchingPR.reviews || 'NA',
                                        repo: matchingPR.repo || 'NA',
                                        merged: matchingPR.merged || 'NA',
                                        prCreatedAt: matchingPR.prCreatedAt || 'NA',
                                        prMergedAt: matchingPR.prMergedAt || 'NA',
                                        prClosedAt: matchingPR.prClosedAt || 'NA',
                                        prUrl,
                                        daysOpen,
                                    };
                                })
                            );
                        }

                        // Only Jira has blockedBy keys stored today; Azure path shows NA until populated
                        blockedBy = Array.isArray(issue.blockedBy) && issue.blockedBy.length > 0 ? issue.blockedBy.map((key) => ({ key, url: `${WORKITEM_BASE_URL}${key}` })) : 'NA';
                    }
                    const sprintOutcome = setSprintoutcome(issue.sprintId || []);

                    return {
                        key: issue.key || 'NA',
                        summary: issue.summary || 'NA',
                        duedate: issue.duedate || 'NA',
                        assignee: issue.assignee,
                        priority: issue.priority || 'NA',
                        status: issue.status?.name || 'NA',
                        blockedBy,
                        pullRequests: prDetails.length > 0 ? prDetails : 'NA',
                        jiraUrl: `${WORKITEM_BASE_URL}${issue.key}`,
                        storyPoints: issue.storyPoints || 'NA',
                        sprintOutcome : sprintOutcome || 'NA',
                        cycleTime: issue.cycleTimeSpent || 'NA',
                        backflowRate: issue.backflowRate || 0,
                        type: issue?.type?.name || 'NA',
                        developer: Array.isArray(issue.developer) ? issue.developer.find(Boolean) : issue.developer || 'Unassigned',
                        epic: issue?.epic?.summary || 'NA',
                        originalEstimate: issue?.originalEstimateHrs || 'NA',
                        timeSpent: issue?.timeSpentHrs || 0,
                        labels: Array.isArray(issue.label) && issue.label.length > 0 ? issue.label.join(',') : 'NA',
                        customFields: issue.customFields || {},
                        customFieldsByName: issue.customFieldsByName || {},
                        severity: issue.severity ?? null,
                    };
                })
            );
            const allMatchingPRs = formattedIssues.flatMap((issue) => (Array.isArray(issue.pullRequests) ? issue.pullRequests : []));
            const prsByRepo = {};

            for (const pr of allMatchingPRs) {
                const repo = pr.repo || 'NA';
                if (!prsByRepo[repo]) {
                    prsByRepo[repo] = [];
                }
                prsByRepo[repo].push(pr);
            }
            const normalizeName = (name) =>
                name
                    ?.toLowerCase()
                    .replace(/[^a-z]/gi, '')
                    .trim() || '';

            const isNearbyMatch = (jiraName, gitName) => {
                if (!jiraName || !gitName) {
                    return false;
                }
                const normJira = normalizeName(jiraName);
                const normGit = normalizeName(gitName);
                if (!normJira || !normGit) {
                    return false;
                }
                if (normJira.includes(normGit) || normGit.includes(normJira)) {
                    return true;
                }
                return normJira.slice(0, 3) === normGit.slice(0, 3);
            };
            const PRsData = Object.entries(prsByRepo).map(([repo, prs]) => {
                const filteredPRs = developer ? prs.filter((pr) => isNearbyMatch(developer, pr.prCreatedBy)) : prs;
                const isMergedPR = (pr) => {
                    const mergedVal = pr.merged?.toString().toLowerCase();
                    return mergedVal === 'true' || mergedVal === 'merged';
                };

                const mergedReviewed = filteredPRs.filter((pr) => isMergedPR(pr) && Array.isArray(pr.prReviews) && pr.prReviews.length > 0);
                const totalMerged = filteredPRs.filter(isMergedPR).length;
                const openReviewed = filteredPRs.filter((pr) => ['open', 'opened'].includes(pr.prStatus?.toLowerCase()) && Array.isArray(pr.prReviews) && pr.prReviews.length > 0).length;
                const openUnreviewed = filteredPRs.filter((pr) => ['open', 'opened'].includes(pr.prStatus?.toLowerCase()) && (!Array.isArray(pr.prReviews) || pr.prReviews.length === 0)).length;
                const closedPRs = filteredPRs.filter((pr) => {
                    const isClosed = pr.prStatus?.toLowerCase() === 'closed';
                    return isClosed && !isMergedPR(pr);
                }).length;
                const totalPRs = filteredPRs.length;

                let avgTime = '0 hrs 00m';
                if (mergedReviewed.length > 0) {
                    function calculateWorkingHours(start, end) {
                        let totalHours = 0;
                        const startDate = new Date(start);
                        const endDate = new Date(end);
                        const current = new Date(startDate);

                        while (current < endDate) {
                            const day = current.getDay();
                            if (day !== 0 && day !== 6) {
                                totalHours += 9;
                            }
                            current.setDate(current.getDate() + 1);
                        }

                        return totalHours;
                    }

                    const totalTimeHrs = mergedReviewed.reduce((sum, pr) => {
                        const created = new Date(pr.prCreatedAt);
                        const merged = new Date(pr.prMergedAt);
                        return sum + calculateWorkingHours(created, merged);
                    }, 0);

                    const avgHours = Math.floor(totalTimeHrs / mergedReviewed.length);
                    const avgMinutes = Math.round(((totalTimeHrs / mergedReviewed.length) % 1) * 60);
                    avgTime = avgHours > 0 ? `${avgHours} hrs ${avgMinutes}m` : `${avgMinutes}m`;
                }

                return {
                    repo,
                    averageTimeToMergeForReviewedPRs: avgTime,
                    totalMergedPRs: totalMerged,
                    openReviewedPRs: openReviewed,
                    openUnreviewedPRs: openUnreviewed,
                    closedPrs: closedPRs,
                    totalPrs: totalPRs,
                };
            });
            const result = {
                sourceManagement:
                    gitProvider === 'github' ? 'GitHub' : gitProvider === 'gitlab' ? 'GitLab' : gitProvider === 'azure' ? 'Azure DevOps' : gitProvider === 'bitbucket' ? 'Bitbucket' : 'NA',
                issues: formattedIssues,
                PRsData,
            };
            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            return res.status(200).json(result);
        } catch (error) {
            console.error('Error fetching Jira data:', error);
            return res.status(500).json({ error: error.message });
        }
    }
}

export default new JiraTableController();
