import { Types } from 'mongoose';
import { STATUS_ACTIVE, STATUS_CLOSED } from '../../../utils/constants/statusConstants.js';
import {
    PROVIDER_NAME_JIRA,
    PROVIDER_NAME_GITLAB_ISSUES,
    PROVIDER_NAME_AZURE_BOARDS,
    PROVIDER_NAME_AZUREBOARDS,
    PROVIDER_NAME_AZURE_BOARD,
} from '../../../utils/constants/providerConstants.js';
import { buildPrTitleIssueKeyPattern } from '../../source-code-management/utils/extractJiraIssueKeyFromPrTitle.js';
import { normalizeDeveloperQueryParam } from '../../../utils/commonFunctions.js';
import { ASSIGNEE_UNASSIGNED_MATCH } from '../../../utils/constants.js';

const normalizeStatusKey = (status) =>
    String(status || '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, ' ');

const buildCanonicalStatusMap = (orderedStatuses = []) => {
    const map = new Map();
    orderedStatuses.forEach((status) => {
        const key = normalizeStatusKey(status);
        if (key && !map.has(key)) {
            map.set(key, status);
        }
    });
    return map;
};

function deduplicateIssues(issues) {
    const latestIssueMap = new Map();
    issues.forEach(issue => {
        const issueDate = issue.createdAt || issue.issueCreatedAt;
        if (issue.issueId) {
            const existing = latestIssueMap.get(issue.issueId);
            if (!existing) {
                latestIssueMap.set(issue.issueId, issue);
            } else {
                const existingDate = existing.createdAt || existing.issueCreatedAt;
                if (issueDate && existingDate && new Date(issueDate) > new Date(existingDate)) {
                    latestIssueMap.set(issue.issueId, issue);
                }
            }
        }
    });
    return Array.from(latestIssueMap.values());
}

export default async function jiraTableLogic({ ctx, builder, params }) {
    const { companyId, projectId, boardId, sprintId, releaseId } = params;
    const developer = normalizeDeveloperQueryParam(params.developer);
    const connection = ctx.connection;

    const filter = {
        projectId: new Types.ObjectId(projectId),
        companyId: new Types.ObjectId(companyId),
    };

    if (connection?.name !== PROVIDER_NAME_GITLAB_ISSUES) {
        filter.boardId = new Types.ObjectId(boardId);
    }

    if (developer !== undefined) {
        if (developer === null || developer === 'unassigned') {
            Object.assign(filter, ASSIGNEE_UNASSIGNED_MATCH);
        } else if (developer) {
            filter.assignee = developer;
        }
    }

    if (releaseId) {
        if (!ctx.selectedType?.releaseName) {return { sourceManagement: 'NA', issues: [], PRsData: [] };}
        filter.fixVersion = ctx.selectedType.releaseName;
    } else if (sprintId) {
        if (ctx.activeSprint && ctx.startOfDay) {
            filter.createdAt = { $gte: ctx.startOfDay, $lt: ctx.endOfDay };
        }
        filter.sprintId = new Types.ObjectId(sprintId);
    } else {
        return { sourceManagement: 'NA', issues: [], PRsData: [] };
    }

    let issues = await ctx.IssueModel.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$issueId', latestTicket: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$latestTicket' } },
    ], { allowDiskUse: true });

    if (releaseId) {
        const backlogExtraFilter = {};
        if (developer !== undefined) {
            if (developer === null) {
                Object.assign(backlogExtraFilter, ASSIGNEE_UNASSIGNED_MATCH);
            } else if (developer) {
                backlogExtraFilter.assignee = developer;
            }
        }
        const backlogIssues = await builder.getBacklogIssues(backlogExtraFilter);
        issues.push(...backlogIssues);
        issues = deduplicateIssues(issues);
    }

    const [gitConnections, pullRequests, sprintsData] = await Promise.all([
        builder.getGitConnections(),
        builder.getAllPullRequests(),
        builder.getAllBoardSprints(),
    ]);

    const { gitProvider } = gitConnections;

    const projectDoc = ctx.project;
    const isAzureProject = (projectDoc?.projectTypeKey || '').toLowerCase() === 'azure-project' ||
        (projectDoc?.boardType || '').toLowerCase().includes('azure');
    const workflowStatuses = projectDoc?.workflowStatuses || [];
    const orderedStatuses = workflowStatuses
        .sort((a, b) => a.order - b.order)
        .flatMap((item) => item.statuses);
    const canonicalStatusMap = buildCanonicalStatusMap(orderedStatuses);
    const getCanonicalStatus = (rawStatus) => {
        const key = normalizeStatusKey(rawStatus);
        return key && canonicalStatusMap.has(key) ? canonicalStatusMap.get(key) : rawStatus;
    };

    let WORKITEM_BASE_URL = '';
    const jiraCred = connection?.name === PROVIDER_NAME_JIRA ? connection : null;
    const gitLabIssuesCred = connection?.name === PROVIDER_NAME_GITLAB_ISSUES ? connection : null;

    if (isAzureProject) {
        const azureCred = await builder.Connection.findOne(
            { companyId, name: { $in: [PROVIDER_NAME_AZURE_BOARDS, PROVIDER_NAME_AZUREBOARDS, PROVIDER_NAME_AZURE_BOARD] } },
            { host: 1 }
        ).lean();
        WORKITEM_BASE_URL = azureCred
            ? `${azureCred.host}/${encodeURIComponent(projectDoc?.name || '')}/_workitems/edit/`
            : '';
    } else if (gitLabIssuesCred) {
        WORKITEM_BASE_URL = `${gitLabIssuesCred.host}/browse/`;
    } else if (jiraCred) {
        WORKITEM_BASE_URL = `${jiraCred.host}/browse/`;
    } else {
        const fallbackCred = await builder.Connection.findOne(
            { companyId, name: PROVIDER_NAME_JIRA }, { host: 1 }
        ).lean();
        WORKITEM_BASE_URL = fallbackCred ? `${fallbackCred.host}/browse/` : '';
    }

    const repoLinks = projectDoc?.repos || [];

    const setSprintOutcome = (issueSprintIds) => {
        const ticketIds = (issueSprintIds || []).map(id => id.toString());
        const matchedSprints = sprintsData
            .filter(sprint => ticketIds.includes(sprint._id.toString()))
            .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        const sprintNames = matchedSprints.map(sprint => sprint.name);
        const hasActive = matchedSprints.some(sprint => sprint.state === STATUS_ACTIVE);
        const hasClosed = matchedSprints.some(sprint => sprint.state === STATUS_CLOSED);
        return { spilledOver: hasActive && hasClosed, sprintNames };
    };

    const formattedIssues = issues.map(issue => {
        const prDetails = [];
        const daysOpenList = [];
        let blockedBy = 'NA';

        if (gitProvider) {
            const issueKeyPattern = buildPrTitleIssueKeyPattern(issue.key);
            const matchingPRs = pullRequests
                .filter(pr => pr.title?.match(issueKeyPattern))
                .sort((a, b) => new Date(b.prCreatedAt) - new Date(a.prCreatedAt));

            matchingPRs.forEach(matchingPR => {
                const matchedRepoUrl = repoLinks.find(link => link.endsWith(matchingPR.repo)) || '';
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
                    ? new Date(matchingPR.prClosedAt || matchingPR.prMergedAt) : null;
                const diffInMs = merged ? merged - created : new Date() - created;
                const daysOpen = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
                daysOpenList.push(daysOpen);

                prDetails.push({
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
                });
            });

            blockedBy = Array.isArray(issue.blockedBy) && issue.blockedBy.length > 0
                ? issue.blockedBy.map(key => ({ key, url: `${WORKITEM_BASE_URL}${key}` }))
                : 'NA';
        }

        const sprintOutcome = setSprintOutcome(issue.sprintId || []);

        return {
            key: issue.key || 'NA',
            summary: issue.summary || 'NA',
            duedate: issue.duedate || 'NA',
            assignee: issue.assignee,
            priority: issue.priority || 'NA',
            status: getCanonicalStatus(issue.status?.name || 'NA'),
            blockedBy,
            pullRequests: prDetails.length > 0 ? prDetails : 'NA',
            jiraUrl: `${WORKITEM_BASE_URL}${issue.key}`,
            storyPoints: issue.storyPoints || 'NA',
            sprintOutcome: sprintOutcome || 'NA',
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
        };
    });

    const allMatchingPRs = formattedIssues.flatMap(issue =>
        Array.isArray(issue.pullRequests) ? issue.pullRequests : []
    );

    const prsByRepo = {};
    for (const pr of allMatchingPRs) {
        const repo = pr.repo || 'NA';
        if (!prsByRepo[repo]) {prsByRepo[repo] = [];}
        prsByRepo[repo].push(pr);
    }

    const normalizeName = (name) => name?.toLowerCase().replace(/[^a-z]/gi, '').trim() || '';
    const isNearbyMatch = (jiraName, gitName) => {
        if (!jiraName || !gitName) {return false;}
        const normJira = normalizeName(jiraName);
        const normGit = normalizeName(gitName);
        if (!normJira || !normGit) {return false;}
        if (normJira.includes(normGit) || normGit.includes(normJira)) {return true;}
        return normJira.slice(0, 3) === normGit.slice(0, 3);
    };

    const PRsData = Object.entries(prsByRepo).map(([repo, prs]) => {
        const filteredPRs = developer ? prs.filter(pr => isNearbyMatch(developer, pr.prCreatedBy)) : prs;
        const isMergedPR = (pr) => {
            const mergedVal = pr.merged?.toString().toLowerCase();
            return mergedVal === 'true' || mergedVal === 'merged';
        };

        const mergedReviewed = filteredPRs.filter(pr =>
            isMergedPR(pr) && Array.isArray(pr.prReviews) && pr.prReviews.length > 0
        );
        const totalMerged = filteredPRs.filter(isMergedPR).length;
        const openReviewed = filteredPRs.filter(pr =>
            ['open', 'opened'].includes(pr.prStatus?.toLowerCase()) &&
            Array.isArray(pr.prReviews) && pr.prReviews.length > 0
        ).length;
        const openUnreviewed = filteredPRs.filter(pr =>
            ['open', 'opened'].includes(pr.prStatus?.toLowerCase()) &&
            (!Array.isArray(pr.prReviews) || pr.prReviews.length === 0)
        ).length;
        const closedPRs = filteredPRs.filter(pr => {
            return pr.prStatus?.toLowerCase() === 'closed' && !isMergedPR(pr);
        }).length;
        const totalPRs = filteredPRs.length;

        let avgTime = '0 hrs 00m';
        if (mergedReviewed.length > 0) {
            const calculateWorkingHours = (start, end) => {
                let totalHours = 0;
                const startDate = new Date(start);
                const endDate = new Date(end);
                const current = new Date(startDate);
                while (current < endDate) {
                    const day = current.getDay();
                    if (day !== 0 && day !== 6) {totalHours += 9;}
                    current.setDate(current.getDate() + 1);
                }
                return totalHours;
            };

            const totalTimeHrs = mergedReviewed.reduce((sum, pr) => {
                return sum + calculateWorkingHours(new Date(pr.prCreatedAt), new Date(pr.prMergedAt));
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

    return {
        sourceManagement: gitProvider === 'github' ? 'GitHub'
            : gitProvider === 'gitlab' ? 'GitLab'
                : gitProvider === 'azure' ? 'Azure DevOps'
                    : gitProvider === 'bitbucket' ? 'Bitbucket' : 'NA',
        issues: formattedIssues,
        PRsData,
    };
}
