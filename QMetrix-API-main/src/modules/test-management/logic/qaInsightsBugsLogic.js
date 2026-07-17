import { Types } from 'mongoose';
import { PROVIDER_NAME_GITLAB_ISSUES } from '../../../utils/constants/providerConstants.js';

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

function getClosedBugs(bugs) {
    return bugs.filter(bug => {
        const statusName = bug.status?.name?.toLowerCase();
        return ['done', 'resolved', 'closed', 'completed', 'verified'].includes(statusName);
    }).length;
}

function hasUATLabel(labels) {
    return labels?.some(label => {
        const l = label.toLowerCase();
        return l.includes('uat') || l === 'uat';
    });
}

function getManualTestingBugs(bugs) {
    return bugs.filter(bug => {
        const summary = bug.summary?.toLowerCase() || '';
        const hasUAT = hasUATLabel(bug.label);

        const checkManual = (labels, sum) => {
            const hasManualLabel = labels?.some(l => {
                const ll = l.toLowerCase();
                return ll.includes('man') || ll.includes('manual') || ll.includes('qa');
            });
            if (hasManualLabel) {return true;}
            return sum.includes('man') || sum.includes('manual') || sum.includes('qa');
        };

        if (hasUAT) {return checkManual(bug.label, summary);}
        return checkManual(bug.label, summary);
    });
}

function getAutomationTestingBugs(bugs) {
    return bugs.filter(bug => {
        const summary = bug.summary?.toLowerCase() || '';
        const hasUAT = hasUATLabel(bug.label);

        const checkAuto = (labels, sum) => {
            const hasAutoLabel = labels?.some(l => {
                const ll = l.toLowerCase();
                return ll.includes('auto') || ll.includes('automation');
            });
            if (hasAutoLabel) {return true;}
            return sum.includes('auto') || sum.includes('automation');
        };

        if (hasUAT) {return checkAuto(bug.label, summary);}
        return checkAuto(bug.label, summary);
    });
}

function getProductionBugs(bugs) {
    return bugs.filter(bug => {
        const hasProdLabel = bug.label?.some(l =>
            l.toLowerCase().includes('prod') || l.toLowerCase().includes('production')
        );
        if (hasProdLabel) {return true;}
        const summary = bug.summary?.toLowerCase() || '';
        return summary.includes('prod') || summary.includes('production');
    });
}

function categorizeByPriority(bugList) {
    return {
        total: bugList.length,
        critical: bugList.filter(b => b.priority?.toLowerCase() === 'highest' || b.priority?.toLowerCase() === 'critical').length,
        major: bugList.filter(b => b.priority?.toLowerCase() === 'high' || b.priority?.toLowerCase() === 'major').length,
        medium: bugList.filter(b => b.priority?.toLowerCase() === 'medium').length,
        minor: bugList.filter(b => b.priority?.toLowerCase() === 'low' || b.priority?.toLowerCase() === 'minor').length,
        invalid: bugList.filter(b => {
            const cf = b.customFieldsByName || {};
            const rootCause = cf['Bug Root Cause'];
            return cf['Is the bug Valid'] === 'No' ||
                (typeof rootCause === 'string' && rootCause.toLowerCase().includes('invalid'));
        }).length,
    };
}

export default async function qaInsightsBugsLogic({ ctx, builder, params }) {
    const { companyId, projectId, boardId, sprintId, releaseId, developer } = params;
    const connection = ctx.connection;

    const isKanban = ctx.board?.boardType?.toLowerCase() === 'kanban' ||
        ctx.board?.boardType?.toLowerCase() === 'gitlab-board';

    const filter = {
        projectId: new Types.ObjectId(projectId),
        companyId: new Types.ObjectId(companyId),
        'type.name': { $in: ['Bug', 'Story Defect', 'Story Defects', 'Defect'] },
    };

    if (boardId && connection?.name !== PROVIDER_NAME_GITLAB_ISSUES) {
        filter.boardId = new Types.ObjectId(boardId);
    }

    if (developer === null) {
        filter.assignee = { $in: [null, 'Unassigned', 'UnAssigned', ''] };
    } else if (developer) {
        filter.assignee = developer;
    }

    if (releaseId) {
        if (!ctx.selectedType?.releaseName) {
            return {
                issueCount: { total: 0, open: 0, closed: 0 },
                segregationBy: { total: 0, manual: { total: 0 }, automation: { total: 0 }, production: { total: 0 } },
            };
        }
        filter.fixVersion = ctx.selectedType.releaseName;
    } else if (sprintId) {
        if (ctx.activeSprint && ctx.startOfDay) {
            filter.createdAt = { $gte: ctx.startOfDay, $lt: ctx.endOfDay };
        }
        filter.sprintId = { $in: [new Types.ObjectId(sprintId)] };
    } else {
        return null;
    }

    const IssueModel = isKanban ? builder.KanbanIssue : builder.SprintIssue;

    let bugs = await IssueModel.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$issueId', latestTicket: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$latestTicket' } },
    ], { allowDiskUse: true });

    if (releaseId) {
        const backlogFilter = { 'type.name': { $in: ['Bug', 'Story Defect', 'Story Defects', 'Defect'] } };
        if (developer && developer !== 'UnAssigned') {
            backlogFilter.assignee = developer;
        }
        const backlogBugs = await builder.getBacklogIssues(backlogFilter);
        const filteredBacklogBugs = backlogBugs.filter((b) => ['Bug', 'Story Defect', 'Story Defects', 'Defect'].includes(b.type?.name));
        bugs.push(...filteredBacklogBugs);
    }

    bugs = deduplicateIssues(bugs);

    const totalBugs = bugs.length;
    const closedBugs = getClosedBugs(bugs);
    const openBugs = totalBugs - closedBugs;

    const manualBugs = getManualTestingBugs(bugs);
    const automationBugs = getAutomationTestingBugs(bugs);
    const productionBugs = getProductionBugs(bugs);

    const manualSegregation = categorizeByPriority(manualBugs);
    const automationSegregation = categorizeByPriority(automationBugs);
    const productionSegregation = categorizeByPriority(productionBugs);

    return {
        issueCount: { total: totalBugs, open: openBugs, closed: closedBugs },
        segregationBy: {
            total: manualSegregation.total + automationSegregation.total + productionSegregation.total,
            manual: manualSegregation,
            automation: automationSegregation,
            production: productionSegregation,
        },
    };
}
