import { Types } from 'mongoose';
import { PROVIDER_NAME_GITLAB_ISSUES } from '../../../utils/constants/providerConstants.js';
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

export default async function jiraStatusByDevLogic({ ctx, builder, params }) {
    const { companyId, projectId, boardId, sprintId, releaseId, developer } = params;
    const dev = params.developer;
    const connection = ctx.connection;
    const project = ctx.project;

    const workflowStatuses = project?.workflowStatuses || [];
    const orderedStatuses = workflowStatuses
        .sort((a, b) => a.order - b.order)
        .flatMap(item => item.statuses);

    const filter = {
        projectId: new Types.ObjectId(projectId),
        companyId: new Types.ObjectId(companyId),
    };

    if (developer !== undefined) {
        if (developer === null || developer === 'unassigned' ) {
            Object.assign(filter, ASSIGNEE_UNASSIGNED_MATCH);
        } else if (developer) {
            filter.assignee = developer;
        }
    }

    if (connection?.name !== PROVIDER_NAME_GITLAB_ISSUES) {
        filter.boardId = new Types.ObjectId(boardId);
    }

    if (releaseId) {
        if (!ctx.selectedType?.releaseName) {return {};}
        filter.fixVersion = ctx.selectedType.releaseName;
    } else if (sprintId) {
        if (ctx.activeSprint && ctx.startOfDay) {
            filter.createdAt = { $gte: ctx.startOfDay, $lt: ctx.endOfDay };
        }
        filter.sprintId = { $in: [new Types.ObjectId(sprintId)] };
    } else {
        return {};
    }

    let issues = await ctx.IssueModel.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$issueId', latestTicket: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$latestTicket' } },
        { $project: { issueId: 1, status: 1, label: 1, createdAt: 1, issueCreatedAt: 1 } },
    ], { allowDiskUse: true });

    if (releaseId) {
        const backlogExtraFilter = {};
        if (dev !== undefined && dev !== null && dev !== 'null' && dev !== 'undefined') {
            backlogExtraFilter.assignee = developer;
        }
        const backlogIssues = await builder.getBacklogIssues(backlogExtraFilter);
        issues.push(...backlogIssues);
        issues = deduplicateIssues(issues);
    }

    const canonicalStatusMap = buildCanonicalStatusMap(orderedStatuses);
    const statusDisplayByKey = {};
    const statusCounts = issues.reduce((acc, item) => {
        let statusName = 'Unknown';

        if (connection?.name === PROVIDER_NAME_GITLAB_ISSUES) {
            const labels = Array.isArray(item.label) ? item.label : [];
            const matchingStatus = labels.find(label => orderedStatuses.includes(String(label)));
            statusName = matchingStatus ? String(matchingStatus) : (String(item.status?.name) || 'Unknown');
        } else {
            statusName = String(item.status?.name) || 'Unknown';
        }

        const statusKey = normalizeStatusKey(statusName);
        if (!statusKey || statusName === 'Unknown') {
            return acc;
        }
        if (!statusDisplayByKey[statusKey]) {
            statusDisplayByKey[statusKey] = canonicalStatusMap.get(statusKey) || statusName;
        }
        acc[statusKey] = (acc[statusKey] || 0) + 1;
        return acc;
    }, {});

    const sortedStatusCounts = {};
    const usedKeys = new Set();
    orderedStatuses.forEach(status => {
        const key = normalizeStatusKey(status);
        if (!key || usedKeys.has(key)) {
            return;
        }
        sortedStatusCounts[status] = statusCounts[key] ?? 0;
        usedKeys.add(key);
    });

    Object.keys(statusCounts).forEach(key => {
        if (!usedKeys.has(key)) {
            sortedStatusCounts[statusDisplayByKey[key] || key] = statusCounts[key];
        }
    });

    return Object.fromEntries(
        Object.entries(sortedStatusCounts).filter(([, count]) => count > 0)
    );
}
