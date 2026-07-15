import { Types } from 'mongoose';
import { getSprintDates, getReleaseDates } from '../common/scmHelper.js';

export default async function openPRsLogic({ ctx, params, shared }) {
    const { boardId, sprintId, releaseId, developer } = params;
    const { allPullRequests, allSprints, allReleases } = shared;

    const isGitLab = shared.gitConnections?.gitProvider === 'gitlab';
    const openStatus = isGitLab ? 'opened' : 'open';

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
        if (pr.status !== openStatus) {return false;}
        if (pr.boardId && !new Types.ObjectId(pr.boardId).equals(boardObjId)) {return false;}
        if (sprintId) {
            const prSprintIds = Array.isArray(pr.sprintId) ? pr.sprintId.map(String) : [String(pr.sprintId)];
            if (!prSprintIds.includes(String(sprintId))) {return false;}
        } else if (releaseId) {
            if (pr.fixVersion !== ctx.selectedType.releaseName) {return false;}
        }
        if (developer && pr.prCreatedBy !== developer) {return false;}
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

    const inOpenDateRange = (pr) => {
        const created = new Date(pr.prCreatedAt);
        if (isGitLab) {return created >= start && created <= end;}
        return created < end;
    };

    const openPullRequestsCount = filteredPRs.filter(pr => inOpenDateRange(pr)).length;

    const totalOpenPullRequestsByDev = filteredPRs
        .filter(pr => inOpenDateRange(pr))
        .reduce((acc, pr) => {
            const name = pr.prCreatedBy || 'Unknown';
            if (!acc[name]) {acc[name] = 0;}
            acc[name]++;
            return acc;
        }, {});

    const totalOpenPullRequestsByDevArray = Object.entries(totalOpenPullRequestsByDev)
        .map(([name, count]) => ({ name, count }));

    let reviewedPRs = 0;
    let unreviewedPRs = 0;
    filteredPRs.forEach(({ reviews, prCreatedAt }) => {
        if (new Date(prCreatedAt) < end) {
            if (reviews && reviews.length > 0) {
                reviewedPRs++;
            } else {
                unreviewedPRs++;
            }
        }
    });

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

    const allOpenPRsForBoard = allPullRequests.filter(pr => {
        if (pr.status !== openStatus) {return false;}
        if (pr.boardId && !new Types.ObjectId(pr.boardId).equals(boardObjId)) {return false;}
        if (developer && pr.prCreatedBy !== developer) {return false;}
        return true;
    });

    const openPullRequests = lastSix.map(item => {
        const name = isSprint ? item.name : item.releaseName;
        const { startDate: pStart, endDate: pEnd } = isSprint
            ? getSprintDates(allSprints, item._id)
            : getReleaseDates(allReleases, item._id);
        const periodStart = new Date(pStart);
        const periodEnd = new Date(pEnd);
        let count = 0;
        if (isSprint) {
            const sprintIdStr = String(item._id);
            count = allOpenPRsForBoard.filter(pr => {
                const prIds = Array.isArray(pr.sprintId) ? pr.sprintId.map(String) : [String(pr.sprintId)];
                if (!prIds.includes(sprintIdStr)) {return false;}
                if (isGitLab) {
                    const created = new Date(pr.prCreatedAt);
                    return created >= periodStart && created <= periodEnd;
                }
                return true;
            }).length;
        } else {
            count = allOpenPRsForBoard.filter(pr => {
                if (pr.fixVersion !== item.releaseName) {return false;}
                if (isGitLab) {
                    const created = new Date(pr.prCreatedAt);
                    return created >= periodStart && created <= periodEnd;
                }
                return true;
            }).length;
        }
        return { name, count: parseFloat(count) };
    });

    return {
        openPullRequestsCount,
        openPullRequests,
        totalOpenPullRequestsByDev: totalOpenPullRequestsByDevArray,
        getOpenReviewedAndUnreviewedPrs: {
            OpenPrs: {
                UnreviewedPRs: unreviewedPRs,
                ReviewedPRs: reviewedPRs,
            },
        },
    };
}
