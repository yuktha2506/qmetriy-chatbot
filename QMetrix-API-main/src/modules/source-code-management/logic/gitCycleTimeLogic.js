import { Types } from 'mongoose';
import { getSprintDates, getReleaseDates } from '../common/scmHelper.js';

export default async function gitCycleTimeLogic({ ctx, params, shared }) {
    const { boardId, sprintId, releaseId } = params;
    const { allPullRequests, gitConnections, allSprints, allReleases } = shared;

    const isGitLab = gitConnections?.gitProvider === 'gitlab';
    const dateField = 'prClosedAt';

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
    const filteredPRs = allPullRequests.filter((pr) => {
        if (!pr.commits || !Array.isArray(pr.commits) || pr.commits.length === 0) {return false;}
        if (!matchesBoard(pr)) {return false;}
        if (sprintId && !matchesSprint(pr, sprintId)) {return false;}
        if (releaseId && !matchesRelease(pr, ctx.selectedType.releaseName)) {return false;}
        return true;
    });

    const calculateCycleTime = (prs, pStart, pEnd) => {
        const pStartDate = new Date(pStart);
        const pEndDate = new Date(pEnd);
        let totalDays = 0;
        for (const pr of prs) {
            const d = pr[dateField];
            if (!d) {continue;}
            const date = new Date(d);
            if (date < pStartDate || date >= pEndDate) {continue;}
            if (!pr.commits || pr.commits.length === 0) {continue;}
            const sortedCommits = [...pr.commits].sort((a, b) => new Date(a.date) - new Date(b.date));
            const firstCommitTime = new Date(sortedCommits[0].date).getTime();
            const mergeTime = pr.prMergedAt ? new Date(pr.prMergedAt).getTime() : 0;
            if (mergeTime > firstCommitTime) {
                totalDays += (mergeTime - firstCommitTime) / (1000 * 60 * 60 * 24);
            }
        }
        const totalPRs = prs.length;
        const prsMerged = prs.filter((pr) => pr.prMergedAt).length;
        const prsOpen = prs.filter((pr) => !pr.prMergedAt).length;
        const cycleTime = Math.max(0, Math.round(totalDays / (totalPRs || 1)));
        return { cycleTime, prsMerged, prsOpen };
    };

    const getFirstReviewDate = (pr) => {
        if (!pr.reviews || pr.reviews.length === 0) {return null;}
        if (isGitLab) {
            const manualReviews = pr.reviews.filter((r) => r.reviewState === 'manual');
            if (manualReviews.length === 0) {return null;}
            const sorted = [...manualReviews].sort((a, b) => new Date(a.reviewDate) - new Date(b.reviewDate));
            return new Date(sorted[0].reviewDate).getTime();
        }
        return new Date(pr.reviews[0].reviewDate).getTime();
    };

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

    const cycleTimePerSprintOrRelease = lastSix.map((period) => {
        const periodPRs = allPullRequests.filter((pr) => {
            if (!pr.commits || !Array.isArray(pr.commits) || pr.commits.length === 0) {return false;}
            if (!matchesBoard(pr)) {return false;}
            if (isSprint && !matchesSprint(pr, period._id)) {return false;}
            if (!isSprint && !matchesRelease(pr, period.releaseName)) {return false;}
            return true;
        });
        const { startDate: pStart, endDate: pEnd } = isSprint
            ? getSprintDates(allSprints, period._id)
            : getReleaseDates(allReleases, period._id);
        const cycleData = calculateCycleTime(periodPRs, pStart, pEnd);
        const name = isSprint ? period.name : period.releaseName;
        return { name, ...cycleData };
    });

    const cycleTimeByDev = [];
    const byDev = {};
    for (const pr of filteredPRs) {
        const d = pr[dateField];
        if (!d) {continue;}
        const date = new Date(d);
        if (date < start || date >= end) {continue;}
        const dev = pr.prCreatedBy || 'Unknown';
        if (!pr.commits || pr.commits.length === 0) {continue;}
        const devSortedCommits = [...pr.commits].sort((a, b) => new Date(a.date) - new Date(b.date));
        const firstCommitTime = new Date(devSortedCommits[0].date).getTime();
        const mergeTime = pr.prMergedAt ? new Date(pr.prMergedAt).getTime() : 0;
        if (mergeTime <= firstCommitTime) {continue;}
        const days = (mergeTime - firstCommitTime) / (1000 * 60 * 60 * 24);
        if (!byDev[dev]) {byDev[dev] = { totalDays: 0, count: 0 };}
        byDev[dev].totalDays += days;
        byDev[dev].count++;
    }
    for (const [name, { totalDays, count }] of Object.entries(byDev)) {
        cycleTimeByDev.push({ name, cycleTime: Math.max(0, Math.round(totalDays / count)) });
    }

    const cycleTimeData = calculateCycleTime(filteredPRs, startDate, endDate);

    let codingTime = 0;
    let pickupTime = 0;
    let reviewTime = 0;

    for (const pr of filteredPRs) {
        if (pr.commits && pr.commits.length > 0) {
            const ctSorted = [...pr.commits].sort((a, b) => new Date(a.date) - new Date(b.date));
            const firstCommitTime = new Date(ctSorted[0].date).getTime();
            const prCreatedTime = new Date(pr.prCreatedAt).getTime();
            codingTime += (prCreatedTime - firstCommitTime) / (1000 * 60 * 60);
        }
    }
    for (const pr of filteredPRs) {
        const firstReviewTime = getFirstReviewDate(pr);
        if (firstReviewTime !== null) {
            const prCreatedTime = new Date(pr.prCreatedAt).getTime();
            pickupTime += (firstReviewTime - prCreatedTime) / (1000 * 60 * 60);
        }
    }
    for (const pr of filteredPRs) {
        const firstReviewTime = getFirstReviewDate(pr);
        if (firstReviewTime !== null && pr.prMergedAt) {
            const mergedTime = new Date(pr.prMergedAt).getTime();
            reviewTime += (mergedTime - firstReviewTime) / (1000 * 60 * 60);
        }
    }

    const detailedCycleTimeMetrics = {
        cycleTime: cycleTimeData.cycleTime,
        codingTime: Math.round(codingTime),
        pickupTime: Math.round(pickupTime),
        reviewTime: Math.round(reviewTime),
    };

    return {
        cycleTimePerSprintOrRelease,
        cycleTimeByDev,
        detailedCycleTimeMetrics,
    };
}
