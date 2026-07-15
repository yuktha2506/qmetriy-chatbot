import { Types } from 'mongoose';
import { getSprintDates, getReleaseDates } from '../common/scmHelper.js';

function calculateAveragePrIterationTime(prData, isGitLab) {
    let total = 0;
    let count = 0;

    for (const pr of prData) {
        if (!pr.reviews || pr.reviews.length === 0) {continue;}
        if (!pr.commits || pr.commits.length === 0) {continue;}

        let eligibleReviews = pr.reviews;
        if (isGitLab) {
            eligibleReviews = pr.reviews.filter((r) => r.reviewState === 'manual');
        } else {
            eligibleReviews = pr.reviews.filter((r) => r.reviewerUsername !== pr.prCreatedBy);
        }

        const firstReview = eligibleReviews
            .sort((a, b) => new Date(a.reviewDate) - new Date(b.reviewDate))[0];

        if (!firstReview) {continue;}

        const firstReviewTime = new Date(firstReview.reviewDate).getTime();
        const sortedCommits = [...pr.commits].sort((a, b) => new Date(a.date) - new Date(b.date));
        const finalCommitTime = new Date(sortedCommits[sortedCommits.length - 1].date).getTime();

        if (firstReviewTime > finalCommitTime) {
            total += (firstReviewTime - finalCommitTime) / (1000 * 60 * 60);
            count++;
        }
    }

    return count > 0 ? (total / count).toFixed(1) : 0;
}

export default async function iterationTimeLogic({ ctx, params, shared }) {
    const { boardId, sprintId, releaseId } = params;
    const { allPullRequests, allSprints, allReleases } = shared;
    const isGitLab = shared.gitConnections?.gitProvider === 'gitlab';

    const boardObjId = boardId ? new Types.ObjectId(boardId) : null;

    const matchesBoard = (pr) => !boardObjId || (pr.boardId && new Types.ObjectId(pr.boardId).equals(boardObjId));
    const matchesSprint = (pr, sid) => {
        const prSprintIds = Array.isArray(pr.sprintId) ? pr.sprintId.map((s) => s?.toString?.() ?? String(s)) : [String(pr.sprintId)];
        return prSprintIds.includes(String(sid));
    };
    const matchesRelease = (pr, releaseName) => pr.fixVersion === releaseName;

    const filteredPRs = allPullRequests.filter((pr) => {
        if (!matchesBoard(pr)) {return false;}
        if (sprintId && !matchesSprint(pr, sprintId)) {return false;}
        if (releaseId && !matchesRelease(pr, ctx.selectedType?.releaseName)) {return false;}
        return true;
    });

    const AveragePRsIterationTime = calculateAveragePrIterationTime(filteredPRs, isGitLab);

    const byDev = {};
    for (const pr of filteredPRs) {
        const name = pr.prCreatedBy || 'Unknown';
        if (!byDev[name]) {byDev[name] = [];}
        byDev[name].push(pr);
    }
    const averagePRIterationTimeByDev = Object.entries(byDev).map(([name, prs]) => ({
        name,
        iterationTime: calculateAveragePrIterationTime(prs, isGitLab),
    }));

    const isSprint = !!sprintId;
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

    let averagePRIterationTimePerSprint;
    let averagePRIterationTimePerRelease;

    if (sprintId) {
        averagePRIterationTimePerSprint = lastSix.map((sprint) => {
            const sprintPRs = allPullRequests.filter((pr) => matchesBoard(pr) && matchesSprint(pr, sprint._id));
            let inRange = sprintPRs;
            if (!isGitLab) {
                const { startDate, endDate } = getSprintDates(allSprints, sprint._id);
                const pStart = new Date(startDate);
                const pEnd = new Date(endDate);
                inRange = sprintPRs.filter((pr) => {
                    const d = pr.prCreatedAt;
                    if (!d) {return false;}
                    const date = new Date(d);
                    return date >= pStart && date <= pEnd;
                });
            }
            return {
                sprint: sprint.name,
                iterationTime: calculateAveragePrIterationTime(inRange, isGitLab),
            };
        });
        averagePRIterationTimePerRelease = undefined;
    }

    if (releaseId) {
        averagePRIterationTimePerRelease = lastSix.map((release) => {
            const releasePRs = allPullRequests.filter((pr) => matchesBoard(pr) && matchesRelease(pr, release.releaseName));
            let inRange = releasePRs;
            if (!isGitLab) {
                const { startDate, endDate } = getReleaseDates(allReleases, release._id);
                const pStart = new Date(startDate);
                const pEnd = new Date(endDate);
                inRange = releasePRs.filter((pr) => {
                    const d = pr.prCreatedAt;
                    if (!d) {return false;}
                    const date = new Date(d);
                    return date >= pStart && date <= pEnd;
                });
            }
            return {
                release: release.releaseName,
                iterationTime: calculateAveragePrIterationTime(inRange, isGitLab),
            };
        });
        averagePRIterationTimePerSprint = undefined;
    }

    return {
        AveragePRsIterationTime,
        averagePRIterationTimeByDev,
        averagePRIterationTimePerSprint,
        averagePRIterationTimePerRelease,
    };
}
