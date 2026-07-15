import { Types } from 'mongoose';
import { getSprintDates, getReleaseDates } from '../common/scmHelper.js';

export default async function closedPRsLogic({ ctx, params, shared }) {
    const { boardId, sprintId, releaseId } = params;
    const { allPullRequests, allSprints, allReleases } = shared;

    const isGitLab = shared.gitConnections?.gitProvider === 'gitlab';
    const closedStatus = isGitLab ? 'merged' : 'closed';
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

    const filteredPRs = allPullRequests.filter(pr => {
        if (pr.status !== closedStatus) {return false;}
        if (pr.boardId && !new Types.ObjectId(pr.boardId).equals(boardObjId)) {return false;}
        if (sprintId) {
            const prSprintIds = Array.isArray(pr.sprintId) ? pr.sprintId.map(String) : [String(pr.sprintId)];
            if (!prSprintIds.includes(String(sprintId))) {return false;}
        } else if (releaseId) {
            if (pr.fixVersion !== ctx.selectedType.releaseName) {return false;}
        }
        return true;
    });

    const sprintObjId = sprintId ? new Types.ObjectId(sprintId) : null;
    const releaseObjId = releaseId ? new Types.ObjectId(releaseId) : null;

    if (identifierType === 'sprintId') {
        ({ startDate, endDate } = getSprintDates(allSprints, sprintObjId));
    } else {
        ({ startDate, endDate } = getReleaseDates(allReleases, releaseObjId));
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const closedInRange = filteredPRs.filter(pr => {
        const d = pr[dateField];
        if (!d) {return false;}
        const date = new Date(d);
        return date >= start && date <= end;
    });

    const closedPullRequestsCount = closedInRange.length;

    const totalClosedPullRequestByDev = closedInRange.reduce((acc, pr) => {
        const name = pr.prCreatedBy || 'Unknown';
        if (!acc[name]) {acc[name] = 0;}
        acc[name]++;
        return acc;
    }, {});

    const totalClosedPullRequestByDevArray = Object.entries(totalClosedPullRequestByDev)
        .map(([name, count]) => ({ name, count }));

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

    const allClosedPRsForBoard = allPullRequests.filter(pr => {
        if (pr.status !== closedStatus) {return false;}
        if (pr.boardId && !new Types.ObjectId(pr.boardId).equals(boardObjId)) {return false;}
        return true;
    });

    const closedPullRequests = lastSix.map(item => {
        const { startDate: periodStart, endDate: periodEnd } = isSprint
            ? getSprintDates(allSprints, item._id)
            : getReleaseDates(allReleases, item._id);
        const pStart = new Date(periodStart);
        const pEnd = new Date(periodEnd);
        const name = isSprint ? item.name : item.releaseName;
        const periodFiltered = allClosedPRsForBoard.filter(pr => {
            if (isSprint) {
                const prSprintIds = Array.isArray(pr.sprintId) ? pr.sprintId.map(String) : [String(pr.sprintId)];
                if (!prSprintIds.includes(String(item._id))) {return false;}
            } else {
                if (pr.fixVersion !== item.releaseName) {return false;}
            }
            return true;
        });
        const count = periodFiltered.filter(pr => {
            const d = pr[dateField];
            if (!d) {return false;}
            const date = new Date(d);
            return date >= pStart && date <= pEnd;
        }).length;
        return { name, count: parseFloat(count).toFixed(2) };
    });

    return {
        closedPullRequestsCount,
        totalClosedPullRequestByDev: totalClosedPullRequestByDevArray,
        closedPullRequests,
    };
}
