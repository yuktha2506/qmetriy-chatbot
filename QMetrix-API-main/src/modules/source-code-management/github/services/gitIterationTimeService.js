import { JiraReleaseModel, SprintModel } from '../../../project-management/jira/model';
import { PullRequestModel } from '../model';
import { getSprintDates, getReleaseDates } from '../../common/scmHelper';
import { Types } from 'mongoose';
import { redis } from '../../../../server';
import cache from '../../../../utils/cache';
import { RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';

class GitIterationTimeService {
    async calculateAveragePrIterationTime(prData) {
        let totalIterationTime = 0;
        let count = 0;

        prData.forEach((pr) => {
            if (pr.reviews.length > 0) {
                const firstReview = pr.reviews.filter((review) => review.reviewerUsername !== pr.prCreatedBy).sort((a, b) => new Date(a.reviewDate) - new Date(b.reviewDate))[0];
                if (firstReview) {
                    const firstReviewTime = new Date(firstReview.reviewDate).getTime();
                    const finalCommitTime = new Date(pr.commits[pr.commits.length - 1].date).getTime();
                    if (firstReviewTime > finalCommitTime) {
                        totalIterationTime += (firstReviewTime - finalCommitTime) / (1000 * 60 * 60);
                        count++;
                    }
                }
            }
        });

        return count > 0 ? (totalIterationTime / count).toFixed(1) : 0;
    }

    async getAveragePRIterationTime(companyId, projectId, boardId, sprintId, releaseId, repo, tenantConnection) {
        try {
            const cacheKey = cache.generateKey('averagePRIterationTime', {
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

            const matchQuery = { companyId, projectId, repo };
            if (boardId) {
                matchQuery.boardId = new Types.ObjectId(boardId);
            }

            if (sprintId) {
                matchQuery.sprintId = sprintId;
            } else if (releaseId) {
                const releaseDataQuery = { companyId, projectId, _id: releaseId };
                if (boardId) {
                    releaseDataQuery.boardId = new Types.ObjectId(boardId);
                }
                const releaseData = await JiraRelease.findOne(releaseDataQuery);
                if (!releaseData) {
                    throw new Error('Release data not found');
                }
                matchQuery.fixVersion = releaseData.releaseName;
            }

            const pullRequests = await PullRequest.find(matchQuery);
            const allPullRequestsQuery = { companyId, projectId, repo };
            if (boardId) {
                allPullRequestsQuery.boardId = new Types.ObjectId(boardId);
            }
            const allPullRequests = await PullRequest.find(allPullRequestsQuery);
            let startDate, endDate;
            let averagePRIterationTimePerSprint = [];

            if (sprintId) {
                const sprintQuery = { companyId, projectId };
                if (boardId) {
                    sprintQuery.boardId = new Types.ObjectId(boardId);
                }
                const allSprints = await Sprint.find(sprintQuery);
                const sortedSprints = allSprints.sort((a, b) => a.startDate - b.startDate);
                const selectedSprint = sortedSprints.find((sprint) => sprint._id.equals(sprintId));
                if (!selectedSprint) {
                    throw new Error('Selected sprint not found');
                }
                const sprintMatchQuery = {
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                    startDate: { $lte: new Date(selectedSprint.startDate) },
                };
                if (boardId) {
                    sprintMatchQuery.boardId = new Types.ObjectId(boardId);
                }
                const Sprints = await Sprint.aggregate([
                    {
                        $match: sprintMatchQuery,
                    },
                    { $sort: { startDate: -1 } },
                    { $limit: 6 },
                    { $sort: { startDate: 1 } },
                ], { allowDiskUse: true });

                averagePRIterationTimePerSprint = await Promise.all(
                    Sprints.map(async (sprint) => {
                        ({ startDate, endDate } = getSprintDates(allSprints, sprint._id));
                        const sprintPRs = allPullRequests.filter((pr) => pr.sprintId.includes(sprint._id));
                        const filterPrs = sprintPRs.filter((pr) => {
                            const prDate = new Date(pr.createdAt);
                            return prDate >= new Date(startDate) && prDate <= new Date(endDate);
                        });
                        const sprintIterationTime = await this.calculateAveragePrIterationTime(filterPrs);

                        return {
                            sprint: sprint.name,
                            iterationTime: sprintIterationTime,
                        };
                    })
                );
            }

            let averagePRIterationTimePerRelease = [];
            if (releaseId) {
                const releaseQuery = { companyId, projectId, status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] } };
                if (boardId) {
                    releaseQuery.boardId = new Types.ObjectId(boardId);
                }
                const releaseData = await JiraRelease.find(releaseQuery, { releaseName: 1, startDate: 1, endDate: 1, status: 1 });
                const selectedReleaseDataQuery = { companyId, projectId, _id: releaseId };
                if (boardId) {
                    selectedReleaseDataQuery.boardId = new Types.ObjectId(boardId);
                }
                const selectedReleaseData = await JiraRelease.findOne(selectedReleaseDataQuery, { startDate: 1, releaseName: 1 });
                if (!selectedReleaseData) {
                    throw new Error('Release data not found');
                }
                matchQuery.fixVersion = selectedReleaseData.releaseName;
                const releaseMatchQuery = {
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                    startDate: { $lte: new Date(selectedReleaseData.startDate) },
                };
                if (boardId) {
                    releaseMatchQuery.boardId = new Types.ObjectId(boardId);
                }
                const Releases = await JiraRelease.aggregate([
                    {
                        $match: releaseMatchQuery,
                    },
                    { $sort: { startDate: -1 } },
                    { $limit: 6 },
                    { $sort: { startDate: 1 } },
                ], { allowDiskUse: true });
                averagePRIterationTimePerRelease = await Promise.all(
                    Releases.map(async (release) => {
                        const { startDate, endDate } = getReleaseDates(releaseData, release._id);
                        const releasePRs = allPullRequests.filter((pr) => pr.fixVersion === release.releaseName);
                        const filterReleasePrs = releasePRs.filter((pr) => {
                            const prDate = new Date(pr.createdAt);
                            return prDate >= new Date(startDate) && prDate <= new Date(endDate);
                        });
                        const releaseIterationTime = await this.calculateAveragePrIterationTime(filterReleasePrs);

                        return {
                            release: release.releaseName,
                            iterationTime: releaseIterationTime,
                        };
                    })
                );
            }
            
            const prDataByDeveloper = {};

            for (const pr of pullRequests) {
                const developer = pr.prCreatedBy;
                if (!prDataByDeveloper[developer]) {
                    prDataByDeveloper[developer] = [];
                }
                prDataByDeveloper[developer].push(pr);
            }

            const prIterationTimeByDeveloper = {};

            for (const developer in prDataByDeveloper) {
                prIterationTimeByDeveloper[developer] = await this.calculateAveragePrIterationTime(prDataByDeveloper[developer]);
            }
            const averagePRIterationTimeByDev = Object.entries(prIterationTimeByDeveloper).map(([name, iterationTime]) => ({
                name,
                iterationTime,
            }));

            const result = {
                AveragePRsIterationTime: await this.calculateAveragePrIterationTime(pullRequests),
                averagePRIterationTimeByDev: averagePRIterationTimeByDev,
                averagePRIterationTimePerSprint: undefined,
                averagePRIterationTimePerRelease: undefined,
            };

            if (sprintId) {
                result.averagePRIterationTimePerSprint = averagePRIterationTimePerSprint;
            }

            if (releaseId) {
                result.averagePRIterationTimePerRelease = averagePRIterationTimePerRelease;
            }

            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            return result;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}

export default new GitIterationTimeService();
