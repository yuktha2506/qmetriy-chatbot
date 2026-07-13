import { JiraReleaseModel, SprintModel } from '../../../project-management/jira/model';
import { PullRequestModel } from '../model';
import { getSprintDates, getReleaseDates } from '../../common/scmHelper';
import { Types } from 'mongoose';
import { redis } from '../../../../server';
import cache from '../../../../utils/cache';
import { RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';

class GitCycleTimeService {
    async getGitCycleTime(requestParams) {
        try {
            const { companyId, projectId, boardId, sprintId, releaseId, repo, tenantConnection } = requestParams;

            const cacheKey = cache.generateKey('gitCycleTime', {
                projectId,
                companyId,
                boardId,
                sprintId,
                releaseId,
            });
            let cached = null;
            try {
                cached = await redis.get(cacheKey);
            } catch (err) {
                console.warn('Redis not available, skipping cache get:', err.message);
            }
            if (cached) {
                return JSON.parse(cached);
            }
            const Sprint = SprintModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const PullRequest = PullRequestModel(tenantConnection);

            const sprintQuery = { companyId, projectId };
            if (boardId) {
                sprintQuery.boardId = new Types.ObjectId(boardId);
            }
            const allSprints = await Sprint.find(sprintQuery);
            const releaseQuery = {
                companyId,
                projectId,
                status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] },
            };
            if (boardId) {
                releaseQuery.boardId = new Types.ObjectId(boardId);
            }
            const allReleases = await JiraRelease.find(releaseQuery);
            const pullRequestQuery = {
                companyId,
                projectId,
                repo,
            };
            if (boardId) {
                pullRequestQuery.boardId = new Types.ObjectId(boardId);
            }
            const allPullRequests = await PullRequest.find(pullRequestQuery);

            const calculateCycleTime = (prs, startDate, endDate) => {
                const totalPRs = prs.length;
                const totalTimeInDays = prs.reduce((total, pr) => {
                    if (pr.commits && pr.commits.length > 0 && pr.prClosedAt >= new Date(startDate) && pr.prClosedAt < new Date(endDate)) {
                        const firstCommitTime = new Date(pr.commits[0].date).getTime();
                        const mergeTime = pr.prMergedAt ? new Date(pr.prMergedAt).getTime() : 0;
                        if (mergeTime && mergeTime > firstCommitTime) {
                            total += (mergeTime - firstCommitTime) / (1000 * 60 * 60 * 24);
                        }
                    }
                    return total;
                }, 0);

                return {
                    cycleTime: Math.max(0, Math.round(totalTimeInDays / totalPRs || 0)),
                    prsMerged: prs.filter((pr) => pr.prMergedAt).length,
                    prsOpen: prs.filter((pr) => !pr.prMergedAt).length,
                };
            };

            const calculateCycleTimeByDev = (prs, startDate, endDate) => {
                const cycleTimeByDev = {};

                for (const pr of prs) {
                    const developer = pr.prCreatedBy;
                    if (!cycleTimeByDev[developer]) {
                        cycleTimeByDev[developer] = {
                            totalPRs: 0,
                            totalTimeInDays: 0,
                        };
                    }

                    if (pr.commits && pr.commits.length > 0 && pr.prClosedAt >= new Date(startDate) && pr.prClosedAt < new Date(endDate)) {
                        const firstCommitTime = new Date(pr.commits[0].date).getTime();
                        const mergeTime = pr.prMergedAt ? new Date(pr.prMergedAt).getTime() : 0;

                        if (mergeTime && mergeTime > firstCommitTime) {
                            cycleTimeByDev[developer].totalTimeInDays += (mergeTime - firstCommitTime) / (1000 * 60 * 60 * 24);
                        }

                        cycleTimeByDev[developer].totalPRs++;
                    }
                }

                return Object.entries(cycleTimeByDev).map(([name, { totalPRs, totalTimeInDays }]) => ({
                    name,
                    cycleTime: Math.max(0, Math.round(totalTimeInDays / totalPRs || 0)),
                }));
            };

            const result = {
                cycleTimePerSprintOrRelease: null,
                cycleTimeByDev: [],
                detailedCycleTimeMetrics: {
                    cycleTime: 0,
                    codingTime: 0,
                    pickupTime: 0,
                    reviewTime: 0,
                },
            };

            if (sprintId) {
                const sortedSprints = allSprints.sort((a, b) => a.startDate - b.startDate);
                const selectedSprint = sortedSprints.find((sprint) => sprint._id.equals(sprintId));

                if (!selectedSprint) {
                    throw new Error('Selected sprint not found');
                }

                const selectedSprintIndex = sortedSprints.findIndex((sprint) => sprint._id.equals(sprintId));
                const historicalSprints = sortedSprints.slice(Math.max(0, selectedSprintIndex - 5), selectedSprintIndex + 1);

                result.cycleTimePerSprintOrRelease = historicalSprints.map((period) => {
                    const periodPRs = allPullRequests.filter((pr) => pr.sprintId.includes(period._id));
                    const { startDate, endDate } = getSprintDates(allSprints, period._id);
                    const cycleTimeData = calculateCycleTime(periodPRs, startDate, endDate);
                    return {
                        name: period.name,
                        ...cycleTimeData,
                    };
                });

                const selectedSprintPRs = allPullRequests.filter((pr) => pr.sprintId.includes(sprintId));
                result.cycleTimeByDev = calculateCycleTimeByDev(selectedSprintPRs, getSprintDates(allSprints, sprintId).startDate, getSprintDates(allSprints, sprintId).endDate);

                const cycleTimeData = calculateCycleTime(selectedSprintPRs, getSprintDates(allSprints, sprintId).startDate, getSprintDates(allSprints, sprintId).endDate);

                result.detailedCycleTimeMetrics = {
                    cycleTime: cycleTimeData.cycleTime,
                    codingTime: Math.round(
                        selectedSprintPRs.reduce((total, pr) => {
                            if (pr.commits && pr.commits.length > 0) {
                                const firstCommitTime = new Date(pr.commits[0].date).getTime();
                                const prCreatedTime = new Date(pr.prCreatedAt).getTime();
                                total += (prCreatedTime - firstCommitTime) / (1000 * 60 * 60);
                            }
                            return total;
                        }, 0)
                    ),
                    pickupTime: Math.round(
                        selectedSprintPRs.reduce((total, pr) => {
                            if (pr.reviews && pr.reviews.length > 0) {
                                const firstReviewTime = new Date(pr.reviews[0].reviewDate).getTime();
                                const prCreatedTime = new Date(pr.prCreatedAt).getTime();
                                total += (firstReviewTime - prCreatedTime) / (1000 * 60 * 60);
                            }
                            return total;
                        }, 0)
                    ),
                    reviewTime: Math.round(
                        selectedSprintPRs.reduce((total, pr) => {
                            if (pr.reviews && pr.reviews.length > 0 && pr.prMergedAt) {
                                const firstReviewTime = new Date(pr.reviews[0].reviewDate).getTime();
                                const mergedTime = new Date(pr.prMergedAt).getTime();
                                total += (mergedTime - firstReviewTime) / (1000 * 60 * 60);
                            }
                            return total;
                        }, 0)
                    ),
                };
            }

            if (releaseId) {
                const sortedReleases = allReleases.sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
                const selectedRelease = sortedReleases.find((release) => release._id.equals(releaseId));

                if (!selectedRelease) {
                    throw new Error('Selected release not found');
                }

                const selectedReleaseIndex = sortedReleases.findIndex((release) => release._id.equals(releaseId));
                const historicalReleases = sortedReleases.slice(Math.max(0, selectedReleaseIndex - 5), selectedReleaseIndex + 1);

                result.cycleTimePerSprintOrRelease = historicalReleases.map((period) => {
                    const periodPRs = allPullRequests.filter((pr) => pr.fixVersion === period.releaseName);
                    const { startDate, endDate } = getReleaseDates(allReleases, period._id);
                    const cycleTimeData = calculateCycleTime(periodPRs, startDate, endDate);
                    return {
                        name: period.releaseName,
                        ...cycleTimeData,
                    };
                });

                const selectedReleasePRs = allPullRequests.filter((pr) => pr.fixVersion === selectedRelease.releaseName);
                result.cycleTimeByDev = calculateCycleTimeByDev(selectedReleasePRs, getReleaseDates(allReleases, releaseId).startDate, getReleaseDates(allReleases, releaseId).endDate);

                const cycleTimeData = calculateCycleTime(selectedReleasePRs, getReleaseDates(allReleases, releaseId).startDate, getReleaseDates(allReleases, releaseId).endDate);

                result.detailedCycleTimeMetrics = {
                    cycleTime: cycleTimeData.cycleTime,
                    codingTime: Math.round(
                        selectedReleasePRs.reduce((total, pr) => {
                            if (pr.commits && pr.commits.length > 0) {
                                const firstCommitTime = new Date(pr.commits[0].date).getTime();
                                const prCreatedTime = new Date(pr.prCreatedAt).getTime();
                                total += (prCreatedTime - firstCommitTime) / (1000 * 60 * 60);
                            }
                            return total;
                        }, 0)
                    ),
                    pickupTime: Math.round(
                        selectedReleasePRs.reduce((total, pr) => {
                            if (pr.reviews && pr.reviews.length > 0) {
                                const firstReviewTime = new Date(pr.reviews[0].reviewDate).getTime();
                                const prCreatedTime = new Date(pr.prCreatedAt).getTime();
                                total += (firstReviewTime - prCreatedTime) / (1000 * 60 * 60);
                            }
                            return total;
                        }, 0)
                    ),
                    reviewTime: Math.round(
                        selectedReleasePRs.reduce((total, pr) => {
                            if (pr.reviews && pr.reviews.length > 0 && pr.prMergedAt) {
                                const firstReviewTime = new Date(pr.reviews[0].reviewDate).getTime();
                                const mergedTime = new Date(pr.prMergedAt).getTime();
                                total += (mergedTime - firstReviewTime) / (1000 * 60 * 60);
                            }
                            return total;
                        }, 0)
                    ),
                };
            }
            if (!sprintId && !releaseId) {
                throw new Error('Either sprintId or releaseId must be provided');
            }

            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            return result;
        } catch (error) {
            console.error('Error in getGitCycleTime:', error);
            throw error;
        }
    }
}

export default new GitCycleTimeService();
