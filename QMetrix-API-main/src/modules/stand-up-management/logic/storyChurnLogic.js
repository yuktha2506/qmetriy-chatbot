function isBugIssueType(issueType) {
    if (!issueType) {return false;}
    const normalized = String(issueType).trim().toLowerCase();
    return normalized === 'bug' || normalized === 'bugs' || normalized === 'defect' || normalized === 'defects' || normalized === 'story defect' || normalized === 'story defects';
}

function isSubTaskIssueType(issueType) {
    if (!issueType) {return false;}
    const normalized = String(issueType).trim().toLowerCase();
    return (
        normalized === 'sub-task' ||
        normalized === 'subtask' ||
        normalized === 'sub task' ||
        normalized === 'subtasks'
    );
}

function buildChurnHelpers(boardDoc, members, standupPageRole) {
    const isAzure = (boardDoc?.boardType || '').toLowerCase() === 'azure-board';
    const mapType = (t) => (isAzure && String(t).toLowerCase() === 'story' ? 'User Story' : t);
    const norm = (s) => String(s || '').trim().toLowerCase();
    const simplifyName = (s) => norm(s).replace(/[_.]+/g, ' ').replace(/\s+/g, ' ');
    const deriveEmail = (raw) => {
        const str = String(raw || '').trim();
        if (/@/.test(str)) {return norm(str);}
        const parts = str.split(/\s+/);
        if (parts.length === 2 && parts[1].includes('.')) {return norm(`${parts[0]}@${parts[1]}`);}
        return null;
    };

    const resolveDev = (val) => {
        if (val === 'team') {return 'team';}
        const email = deriveEmail(val);
        if (email) {
            const hit = members.find((m) => norm(m.emailAddress) === email);
            if (hit?.displayName) {return hit.displayName;}
        }
        const hit2 = members.find((m) => simplifyName(m.displayName) === simplifyName(val));
        return hit2?.displayName || val;
    };

    const resolvedDev = resolveDev(standupPageRole);

    return { mapType, simplifyName, resolvedDev };
}

function computeChurnData(items, itemNameKey, churnKey, helpers, standupPageRole, excludeBugs = false) {
    const { mapType, simplifyName, resolvedDev } = helpers;

    const allIssueTypes = new Set();
    items.forEach(item => {
        const churnArr = item[churnKey];
        if (!Array.isArray(churnArr)) {return;}
        churnArr.forEach(churn => {
            if (
                churn.issueType &&
                !isSubTaskIssueType(churn.issueType) &&
                (!excludeBugs || !isBugIssueType(churn.issueType))
            ) {
                allIssueTypes.add(mapType(churn.issueType));
            }
        });
    });
    const issueTypes = Array.from(allIssueTypes);

    const overAllData = items.map(item => {
        const row = { label: item[itemNameKey] };
        issueTypes.forEach(type => (row[type] = 0));

        const churnArr = item[churnKey];
        if (!Array.isArray(churnArr)) {return row;}

        churnArr.forEach(churn => {
            if (!churn.issueType) {return;}
            if (isSubTaskIssueType(churn.issueType)) {return;}
            if (excludeBugs && isBugIssueType(churn.issueType)) {return;}

            let totalPlanned = 0, totalAdded = 0, totalRemoved = 0;

            if (Array.isArray(churn.developerChurn) && churn.developerChurn.length > 0) {
                if (standupPageRole === 'team') {
                    churn.developerChurn.forEach(dev => {
                        totalPlanned += dev.planned || 0;
                        totalAdded += dev.added || 0;
                        totalRemoved += dev.removed || 0;
                    });
                } else {
                    const devChurn = churn.developerChurn.find(dev => simplifyName(dev.developer) === simplifyName(resolvedDev));
                    if (devChurn) {
                        totalPlanned = devChurn.planned || 0;
                        totalAdded = devChurn.added || 0;
                        totalRemoved = devChurn.removed || 0;
                    }
                }
            } else if (standupPageRole === 'team') {
                totalPlanned = churn.planned || 0;
                totalAdded = churn.added || 0;
                totalRemoved = churn.removed || 0;
            }

            const rate = totalPlanned === 0 ? 0 : ((totalAdded + totalRemoved) / totalPlanned) * 100;
            row[mapType(churn.issueType)] = parseFloat(rate.toFixed(1));
        });

        return row;
    });

    const descendingItems = [...items].sort((a, b) => {
        const dateA = a.startDate || a.releaseDate;
        const dateB = b.startDate || b.releaseDate;
        return new Date(dateB) - new Date(dateA);
    });

    const tableData = descendingItems.map(item => {
        const churnMap = {};
        const churnArr = item[churnKey];
        if (!Array.isArray(churnArr)) {return { [itemNameKey === 'name' ? 'sprint' : 'release']: item[itemNameKey], churnData: [] };}

        churnArr.forEach(churn => {
            if (!churn.issueType) {return;}
            if (isSubTaskIssueType(churn.issueType)) {return;}
            if (excludeBugs && isBugIssueType(churn.issueType)) {return;}

            const issueType = mapType(churn.issueType);
            if (!churnMap[issueType]) {churnMap[issueType] = { planned: 0, added: 0, removed: 0 };}

            if (Array.isArray(churn.developerChurn) && churn.developerChurn.length > 0) {
                if (standupPageRole === 'team') {
                    churn.developerChurn.forEach(dev => {
                        churnMap[issueType].planned += dev.planned || 0;
                        churnMap[issueType].added += dev.added || 0;
                        churnMap[issueType].removed += dev.removed || 0;
                    });
                } else {
                    const devChurn = churn.developerChurn.find(dev => simplifyName(dev.developer) === simplifyName(resolvedDev));
                    if (devChurn) {
                        churnMap[issueType].planned += devChurn.planned || 0;
                        churnMap[issueType].added += devChurn.added || 0;
                        churnMap[issueType].removed += devChurn.removed || 0;
                    }
                }
            } else if (standupPageRole === 'team') {
                churnMap[issueType].planned += churn.planned || 0;
                churnMap[issueType].added += churn.added || 0;
                churnMap[issueType].removed += churn.removed || 0;
            }
        });

        const churnData = Object.entries(churnMap).map(([issueType, data]) => {
            const churnRate = data.planned === 0 ? 0 : ((data.added + data.removed) / data.planned) * 100;
            return {
                issueType,
                planned: data.planned,
                added: data.added,
                removed: data.removed,
                churnRate: parseFloat(churnRate.toFixed(1)),
            };
        });

        const labelKey = itemNameKey === 'name' ? 'sprint' : 'release';
        return { [labelKey]: item[itemNameKey], churnData };
    });

    return { overAllData, tableData };
}

export default async function storyChurnLogic({ ctx, builder, params }) {
    const { standupPageRole } = params;
    const role = (standupPageRole && typeof standupPageRole === 'string')
        ? standupPageRole.replace(/^['"]|['"]$/g, '')
        : 'team';

    const board = ctx.board;
    const members = board?.assignees || [];
    const helpers = buildChurnHelpers(board, members, role);

    if (builder.sprintId) {
        const sprints = await builder.getLastSixSprints();
        if (!sprints || sprints.length === 0) {return { storyChurn: { message: 'No sprints found' } };}
        return { storyChurn: computeChurnData(sprints, 'name', 'storyChurn', helpers, role) };
    } else if (builder.releaseId) {
        const releases = await builder.getLastSixReleases();
        if (!releases || releases.length === 0) {return { storyChurn: { message: 'No releases found' } };}
        return { storyChurn: computeChurnData(releases, 'releaseName', 'releaseChurn', helpers, role) };
    }

    return { storyChurn: null };
}

export { buildChurnHelpers, computeChurnData, isBugIssueType, isSubTaskIssueType };
