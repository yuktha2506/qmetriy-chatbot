import { Types } from 'mongoose';
import { getSprintDates, getReleaseDates } from '../common/scmHelper.js';
import {
    RELEASE_STATUS_RELEASED,
    RELEASE_STATUS_UNRELEASED,
    STATUS_ACTIVE,
    STATUS_CLOSED,
} from '../../../utils/constants/statusConstants.js';

export default async function standupMergedPRsLogic({ ctx, builder, params }) {
    const { companyId, projectId, boardId, sprintId, releaseId, developer } = params;

    const [allPullRequests, lastSixSprints, lastSixReleases, gitConnections] = await Promise.all([
        builder.getAllPullRequests(),
        builder.getLastSixSprints(),
        builder.getLastSixReleases(),
        builder.getGitConnections(),
    ]);

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
        if (pr.boardId && !new Types.ObjectId(pr.boardId).equals(boardObjId)) {return false;}
        if (sprintId) {
            const prSprintIds = Array.isArray(pr.sprintId) ? pr.sprintId.map(String) : [String(pr.sprintId)];
            if (!prSprintIds.includes(String(sprintId))) {return false;}
        } else if (releaseId) {
            if (pr.fixVersion !== ctx.selectedType.releaseName) {return false;}
        }
        if (developer) {
            if (pr.prCreatedBy !== developer) {return false;}
        }
        return true;
    });

    const sprints = lastSixSprints.length > 0 ? lastSixSprints :
        await builder.Sprint.find({
            companyId, projectId,
            state: { $in: [STATUS_ACTIVE, STATUS_CLOSED] },
            boardId: boardObjId,
        }).lean();

    const releases = lastSixReleases.length > 0 ? lastSixReleases :
        await builder.JiraRelease.find({
            companyId, projectId,
            status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] },
            boardId: boardObjId,
        }).lean();

    if (identifierType === 'sprintId') {
        ({ startDate, endDate } = getSprintDates(sprints, sprintId));
    } else {
        ({ startDate, endDate } = getReleaseDates(releases, releaseId));
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const { gitHubCred } = gitConnections;
    const host = gitHubCred?.host || null;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    let totalMerged = 0;
    let mergedWithReview = 0;
    let mergedWithoutReview = 0;
    let unreviewedLastWeek = 0;

    filteredPRs.forEach(({ prMergedAt, reviews }) => {
        if (prMergedAt) {
            const mergedAt = new Date(prMergedAt);
            if (mergedAt >= start && mergedAt <= end) {
                totalMerged++;
                if (!reviews || reviews.length === 0) {
                    mergedWithoutReview++;
                    if (mergedAt >= oneWeekAgo) {unreviewedLastWeek++;}
                } else {
                    mergedWithReview++;
                }
            }
        }
    });

    const lastWeekPercentage = mergedWithoutReview > 0
        ? ((unreviewedLastWeek / mergedWithoutReview) * 100).toFixed(1) : '0';
    const percentage = totalMerged > 0
        ? ((mergedWithoutReview / totalMerged) * 100).toFixed(1) : '0';

    const mergedPRsWithoutReviewTimeFiltered = filteredPRs.filter(pr => {
        if (pr.prMergedAt && pr.prCreatedAt) {
            const mergedAt = new Date(pr.prMergedAt);
            return mergedAt >= start && mergedAt <= end && (!pr.reviews || pr.reviews.length === 0);
        }
        return false;
    });

    let avgTimeNoReviews = '0 hrs 00m';
    if (mergedPRsWithoutReviewTimeFiltered.length > 0) {
        const totalTime = mergedPRsWithoutReviewTimeFiltered.reduce((acc, { prCreatedAt, prMergedAt }) => {
            return acc + (new Date(prMergedAt) - new Date(prCreatedAt));
        }, 0);
        const avgMs = totalTime / mergedPRsWithoutReviewTimeFiltered.length;
        const avgHrs = Math.floor(avgMs / (1000 * 60 * 60));
        const avgMin = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));
        avgTimeNoReviews = avgHrs > 0 ? `${avgHrs} hrs ${avgMin}m` : `${avgMin}m`;
    }

    const mergedWithReviewPRs = filteredPRs.filter(pr =>
        pr.merged === 'true' && pr.prCreatedAt && pr.prMergedAt &&
        new Date(pr.prMergedAt) >= start && new Date(pr.prMergedAt) <= end &&
        pr.reviews && pr.reviews.length > 0
    );

    let avgMergeTimeWithReview = '0 hrs 00m';
    if (mergedWithReviewPRs.length > 0) {
        const totalMs = mergedWithReviewPRs.reduce((total, { prCreatedAt, prMergedAt }) => {
            return total + (new Date(prMergedAt) - new Date(prCreatedAt));
        }, 0);
        const avgMs = totalMs / mergedWithReviewPRs.length;
        const avgHrs = Math.floor(avgMs / (1000 * 60 * 60));
        const avgMin = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));
        avgMergeTimeWithReview = avgHrs > 0 ? `${avgHrs} hrs ${avgMin}m` : `${avgMin}m`;
    }

    const mergedPRsInRange = filteredPRs.filter(pr =>
        pr.prMergedAt && new Date(pr.prMergedAt) >= start && new Date(pr.prMergedAt) <= end
    );

    const highRiskPRs = mergedPRsInRange.map(pr => {
        const risks = [];
        const riskDetails = {};

        const totalLinesChanged = (pr.linesAdded || 0) + (pr.linesDeleted || 0);
        if (totalLinesChanged > 200) { risks.push('large_size'); riskDetails.linesChanged = totalLinesChanged; }
        if ((pr.filesChanged || 0) > 20) { risks.push('many_files'); riskDetails.filesChanged = pr.filesChanged; }
        if (!pr.reviews || pr.reviews.length === 0) {risks.push('no_reviews');}
        if (pr.prCreatedBy === pr.prMergedBy) {risks.push('self_merged');}
        if (pr.missingTests?.hasMissingTests === true) {risks.push('missing_tests');}
        if (pr.hasSensitiveChanges === true || (pr.sensitiveFiles && pr.sensitiveFiles.length > 0)) {
            risks.push('sensitive_changes');
            if (pr.sensitiveFiles?.length > 0) {riskDetails.sensitiveFiles = pr.sensitiveFiles;}
        }

        return {
            prNumber: pr.prNumber, title: pr.title, repo: pr.repo,
            mergedAt: pr.prMergedAt, author: pr.prCreatedBy, mergedBy: pr.prMergedBy,
            risks, riskDetails, riskScore: risks.length,
            linesAdded: pr.linesAdded, linesDeleted: pr.linesDeleted, filesChanged: pr.filesChanged,
        };
    }).sort((a, b) => b.riskScore - a.riskScore);

    const highRiskCount = highRiskPRs.filter(pr => pr.riskScore > 0).length;
    const highRiskPercentage = mergedPRsInRange.length > 0
        ? ((highRiskCount / mergedPRsInRange.length) * 100).toFixed(1) : '0';

    const riskFactorCounts = { large_size: 0, many_files: 0, no_reviews: 0, self_merged: 0, missing_tests: 0, sensitive_changes: 0 };
    const riskFactorPRs = { large_size: [], many_files: [], no_reviews: [], self_merged: [], missing_tests: [], sensitive_changes: [] };

    highRiskPRs.forEach(pr => {
        pr.risks.forEach(risk => {
            if (riskFactorCounts[risk] !== undefined) {
                riskFactorCounts[risk]++;
                const currentDateIST = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);
                const mergedAtIST = new Date(new Date(pr.mergedAt).getTime() + 5.5 * 60 * 60 * 1000);
                const dateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
                const daysAgo = Math.floor((dateOnly(currentDateIST) - dateOnly(mergedAtIST)) / (1000 * 60 * 60 * 24));
                const prInfo = { prNumber: pr.prNumber, title: pr.title, daysAgo, repo: pr.repo };
                if (risk === 'sensitive_changes' && pr.riskDetails.sensitiveFiles) {
                    prInfo.sensitiveFiles = pr.riskDetails.sensitiveFiles;
                }
                riskFactorPRs[risk].push(prInfo);
            }
        });
    });

    const mergedPRDetails = mergedPRsInRange.map(pr => {
        const currentDateIST = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);
        const mergedAtIST = new Date(new Date(pr.prMergedAt).getTime() + 5.5 * 60 * 60 * 1000);
        const dateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const daysAgo = Math.floor((dateOnly(currentDateIST) - dateOnly(mergedAtIST)) / (1000 * 60 * 60 * 24));
        return { prNumber: pr.prNumber, title: pr.title, daysAgo, repo: pr.repo };
    });

    return [
        {
            getMergedPRsWithoutReviews: {
                host, totalMergedPRs: totalMerged, mergedWithReviewPrs: mergedWithReview,
                mergedWithoutReview, unreviewedLastWeek,
                lastWeekUnreviewedPercentage: `${lastWeekPercentage}`,
            },
        },
        { getPercentageMergedPRsNoReviews: percentage },
        { getAvgTimeMergedPRsNoReviews: avgTimeNoReviews },
        { getAverageMergeTimeWithReview: { AverageTimeToMerge: avgMergeTimeWithReview } },
        { getHighRiskPRs: { totalMergedPRs: mergedPRsInRange.length, highRiskCount, highRiskPercentage, riskFactorCounts, riskFactorPRs, mergedPRDetails } },
    ];
}
