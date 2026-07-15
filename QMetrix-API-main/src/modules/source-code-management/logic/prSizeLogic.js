import { Types } from 'mongoose';
import { getSprintDates, getReleaseDates } from '../common/scmHelper.js';

export default async function prSizeLogic({ ctx, params, shared }) {
    const { boardId, sprintId, releaseId } = params;
    const { allPullRequests, gitConnections, allSprints, allReleases } = shared;

    const isGitLab = gitConnections?.gitProvider === 'gitlab';
    const dateField = isGitLab ? 'prMergedAt' : 'prClosedAt';
    const openStatus = isGitLab ? 'opened' : 'open';
    const closedStatus = isGitLab ? 'merged' : 'closed';

    const boardObjId = boardId ? new Types.ObjectId(boardId) : null;

    let identifierType, startDate, endDate;

    if (sprintId) {
        identifierType = 'sprintId';
    } else if (releaseId) {
        if (!ctx.selectedType?.releaseName) {return null;}
        identifierType = 'releaseId';
    } else {
        return null;
    }

    const sprintObjId = sprintId ? new Types.ObjectId(sprintId) : null;
    const releaseObjId = releaseId ? new Types.ObjectId(releaseId) : null;

    if (identifierType === 'sprintId') {
        ({ startDate, endDate } = getSprintDates(allSprints, sprintObjId));
    } else {
        ({ startDate, endDate } = getReleaseDates(allReleases, releaseObjId));
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const matchesBoard = (pr) => !boardObjId || !pr.boardId || new Types.ObjectId(pr.boardId).equals(boardObjId);
    const matchesSprint = (pr, sid) => {
        const prSprintIds = Array.isArray(pr.sprintId) ? pr.sprintId.map((s) => s?.toString?.() ?? String(s)) : [String(pr.sprintId)];
        return prSprintIds.includes(String(sid));
    };
    const matchesRelease = (pr, releaseName) => pr.fixVersion === releaseName;

    const inDateRange = (pr) => {
        if (pr.status === openStatus) {
            const d = pr.prCreatedAt;
            if (!d) {return false;}
            const date = new Date(d);
            return date >= start && date <= end;
        }
        if (pr.status === closedStatus) {
            const d = pr[dateField];
            if (!d) {return false;}
            const date = new Date(d);
            return date >= start && date <= end;
        }
        return false;
    };

    const currentPeriodPRs = allPullRequests.filter((pr) => {
        if (!matchesBoard(pr)) {return false;}
        if (sprintId && !matchesSprint(pr, sprintId)) {return false;}
        if (releaseId && !matchesRelease(pr, ctx.selectedType.releaseName)) {return false;}
        return inDateRange(pr);
    });

    const pullRequestSize = currentPeriodPRs.reduce(
        (sum, pr) => sum + (pr.linesAdded || 0) + (pr.linesDeleted || 0),
        0
    );

    const isSprint = identifierType === 'sprintId';
    const items = isSprint ? allSprints : allReleases;
    const sortedItems = isSprint
        ? [...items].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
        : [...items].sort((a, b) => new Date(a.releaseDate || a.startDate) - new Date(b.releaseDate || b.startDate));

    const selectedIdx = sortedItems.findIndex((s) =>
        isSprint ? s._id.toString() === String(sprintId) : s._id.toString() === String(releaseId)
    );
    const lastSix = selectedIdx >= 0
        ? sortedItems.slice(Math.max(0, selectedIdx - 5), selectedIdx + 1)
        : sortedItems.slice(-6);

    const averagePRSizePerPeriod = {};
    for (const item of lastSix) {
        const { startDate: pStart, endDate: pEnd } = isSprint
            ? getSprintDates(allSprints, item._id)
            : getReleaseDates(allReleases, item._id);
        const pStartDate = new Date(pStart);
        const pEndDate = new Date(pEnd);

        const periodPRs = allPullRequests.filter((pr) => {
            if (!matchesBoard(pr)) {return false;}
            if (isSprint && !matchesSprint(pr, item._id)) {return false;}
            if (!isSprint && !matchesRelease(pr, item.releaseName)) {return false;}
            if (isGitLab && isSprint) {return pr.status === openStatus || pr.status === closedStatus;}
            if (pr.status === openStatus) {
                const d = pr.prCreatedAt;
                if (!d) {return false;}
                const date = new Date(d);
                return date >= pStartDate && date <= pEndDate;
            }
            if (pr.status === closedStatus) {
                const d = pr[dateField];
                if (!d) {return false;}
                const date = new Date(d);
                return date >= pStartDate && date <= pEndDate;
            }
            return false;
        });

        const totalSize = periodPRs.reduce((s, pr) => s + (pr.linesAdded || 0) + (pr.linesDeleted || 0), 0);
        const avgSize = periodPRs.length > 0 ? Math.round(totalSize / periodPRs.length) : 0;
        const name = isSprint ? item.name : item.releaseName;
        averagePRSizePerPeriod[name] = avgSize;
    }

    const averagePRSizeByDeveloper = [];
    const byDev = {};
    for (const pr of currentPeriodPRs) {
        const dev = pr.prCreatedBy || 'Unknown';
        if (!byDev[dev]) {byDev[dev] = { total: 0, count: 0 };}
        byDev[dev].total += (pr.linesAdded || 0) + (pr.linesDeleted || 0);
        byDev[dev].count++;
    }
    for (const [dev, { total, count }] of Object.entries(byDev)) {
        averagePRSizeByDeveloper.push({ dev, averagePRSize: Math.round(total / count) });
    }

    const resultKey = isSprint ? 'averagePRSizePerSprint' : 'averagePRSizePerRelease';
    return {
        pullRequestSize,
        [resultKey]: averagePRSizePerPeriod,
        averagePRSizeByDeveloper,
    };
}
