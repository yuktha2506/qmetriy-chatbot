import { Types } from 'mongoose';
import { getSprintDates, getReleaseDates } from '../common/scmHelper.js';

export default async function totalPRsLogic({ ctx, params, shared }) {
    const { boardId, sprintId, releaseId } = params;
    const { allPullRequests, allSprints, allReleases } = shared;

    const isGitLab = shared.gitConnections?.gitProvider === 'gitlab';
    const closedStatus = isGitLab ? 'merged' : 'closed';
    const openStatus = isGitLab ? 'opened' : 'open';
    const dateField = isGitLab ? 'prMergedAt' : 'prClosedAt';

    const boardObjId = new Types.ObjectId(boardId);

    let identifierType, startDate, endDate;

    if (sprintId) {
        identifierType = 'sprintId';
    } else if (releaseId) {
        if (!ctx.selectedType?.releaseName) {return null;}
        identifierType = 'releaseId';
    } else {
        return null;
    }

    const filterByBoardAndPeriod = (pr, sprintIdVal, releaseIdVal, releaseName) => {
        if (pr.boardId && !new Types.ObjectId(pr.boardId).equals(boardObjId)) {return false;}
        if (sprintIdVal) {
            const prSprintIds = Array.isArray(pr.sprintId) ? pr.sprintId.map(String) : [String(pr.sprintId)];
            if (!prSprintIds.includes(String(sprintIdVal))) {return false;}
        } else if (releaseName) {
            if (pr.fixVersion !== releaseName) {return false;}
        }
        return true;
    };

    const filteredPRs = allPullRequests.filter(pr =>
        filterByBoardAndPeriod(pr, sprintId, releaseId, ctx.selectedType?.releaseName)
    );

    const sprintObjId = sprintId ? new Types.ObjectId(sprintId) : null;
    const releaseObjId = releaseId ? new Types.ObjectId(releaseId) : null;

    if (identifierType === 'sprintId') {
        ({ startDate, endDate } = getSprintDates(allSprints, sprintObjId));
    } else {
        ({ startDate, endDate } = getReleaseDates(allReleases, releaseObjId));
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const openPRsInPeriod = filteredPRs.filter(pr => {
        if (pr.status !== openStatus) {return false;}
        const created = new Date(pr.prCreatedAt);
        if (isGitLab) {return created >= start && created <= end;}
        return created <= end;
    });
    const closedPRsInPeriod = filteredPRs.filter(pr => {
        if (pr.status !== closedStatus) {return false;}
        const d = pr[dateField];
        if (!d) {return false;}
        const date = new Date(d);
        return date >= start && date <= end;
    });

    const getTotalPullRequests = openPRsInPeriod.length + closedPRsInPeriod.length;

    const byDevMap = {};
    openPRsInPeriod.forEach(pr => {
        const name = pr.prCreatedBy || 'Unknown';
        if (!byDevMap[name]) {byDevMap[name] = 0;}
        byDevMap[name]++;
    });
    closedPRsInPeriod.forEach(pr => {
        const name = pr.prCreatedBy || 'Unknown';
        if (!byDevMap[name]) {byDevMap[name] = 0;}
        byDevMap[name]++;
    });

    const getTotalPullRequestsByDev = Object.entries(byDevMap)
        .map(([name, count]) => ({ name, count: Number(count).toFixed(2) }));

    const items = identifierType === 'sprintId' ? allSprints : allReleases;
    const isSprint = identifierType === 'sprintId';
    const selectedId = sprintId || releaseId;

    const sortedItems = isSprint
        ? [...items].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
        : [...items].sort((a, b) => new Date(a.releaseDate || a.startDate) - new Date(b.releaseDate || b.startDate));

    const selectedIdx = sortedItems.findIndex(s => s._id.toString() === String(selectedId));

    const lastSix = selectedIdx >= 0
        ? sortedItems.slice(Math.max(0, selectedIdx - 5), selectedIdx + 1)
        : sortedItems.slice(-6);

    const totalPullRequests = lastSix.map(item => {
        const { startDate: periodStart, endDate: periodEnd } = isSprint
            ? getSprintDates(allSprints, item._id)
            : getReleaseDates(allReleases, item._id);
        const pStart = new Date(periodStart);
        const pEnd = new Date(periodEnd);
        const name = isSprint ? item.name : item.releaseName;

        const periodFiltered = filteredPRs.filter(pr => {
            if (isSprint) {
                const prSprintIds = Array.isArray(pr.sprintId) ? pr.sprintId.map(String) : [String(pr.sprintId)];
                if (!prSprintIds.includes(String(item._id))) {return false;}
            } else {
                if (pr.fixVersion !== item.releaseName) {return false;}
            }
            return true;
        });

        const openCount = periodFiltered.filter(pr => {
            if (pr.status !== openStatus) {return false;}
            const created = new Date(pr.prCreatedAt);
            if (isGitLab) {return created >= pStart && created <= pEnd;}
            return created <= pEnd;
        }).length;
        const closedCount = periodFiltered.filter(pr => {
            if (pr.status !== closedStatus) {return false;}
            const d = pr[dateField];
            if (!d) {return false;}
            const date = new Date(d);
            return date >= pStart && date <= pEnd;
        }).length;

        const count = openCount + closedCount;
        return { name, count: Number(count).toFixed(2) };
    });

    return {
        getTotalPullRequests,
        getTotalPullRequestsByDev,
        totalPullRequests,
    };
}
