import { JiraReleaseModel, SprintModel } from '../../../project-management/jira/model';
import { PullRequestModel } from '../../github/model';
import { Types } from 'mongoose';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';

class GitLabIterationTimeService {
    async calculateAverageMrIterationTime(prData) {
        let totalIterationTime = 0;
        let count = 0;

        prData.forEach((pr) => {
            const userReviews = pr.reviews.filter((review) => review.reviewState === 'manual');
            const sortedCommits = pr.commits.sort((a, b) => new Date(a.date) - new Date(b.date));
            if (userReviews.length > 0) {
                userReviews.sort((a, b) => new Date(a.reviewDate) - new Date(b.reviewDate));
                const firstReviewTime = new Date(userReviews[0].reviewDate).getTime();
                const finalCommitTime = sortedCommits.length > 0 ? sortedCommits[sortedCommits.length - 1].date : null;
                if (firstReviewTime > finalCommitTime) {
                    totalIterationTime += (firstReviewTime - finalCommitTime) / (1000 * 60 * 60);
                    count++;
                }
            }
        });

        return count > 0 ? (totalIterationTime / count).toFixed(1) : 0;
    }

    async getAverageMRIterationTime(requestParams) {
        try {
            const { companyId, projectId, boardId, sprintId, releaseId, repo, tenantConnection } = requestParams;
            const cacheKey = cache.generateKey('gitLabAverageMRIterationTime', {
                projectId,
                companyId,
                boardId,
                sprintId,
                releaseId,
                repo,
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

            const averagePRIterationTimePerSprint = [];

            if (sprintId) {
                const sprintQuery = { companyId, projectId, state: { $in: ['active', 'closed'] } };
                if (boardId) {
                    sprintQuery.boardId = new Types.ObjectId(boardId);
                }
                const allSprints = await Sprint.find(sprintQuery);
                const sortedSprints = allSprints.sort((a, b) => a.startDate - b.startDate);
                const selectedSprint = sortedSprints.find((sprint) => sprint._id.equals(sprintId));

                if (!selectedSprint) {
                    throw new Error('Selected sprint not found');
                }

                const selectedSprintIndex = sortedSprints.findIndex((sprint) => sprint._id.equals(sprintId));
                const Sprints = sortedSprints.slice(Math.max(0, selectedSprintIndex - 5), selectedSprintIndex + 1);

                for (const sprint of Sprints) {
                    const sprintPRs = allPullRequests.filter((pr) => pr.sprintId.includes(sprint._id));
                    const sprintIterationTime = await this.calculateAverageMrIterationTime(sprintPRs);

                    averagePRIterationTimePerSprint.push({
                        sprint: sprint.name,
                        iterationTime: sprintIterationTime,
                    });
                }
            }

            const averagePRIterationTimePerRelease = [];

            if (releaseId) {
                const releaseQuery = { companyId, projectId, status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] } };
                if (boardId) {
                    releaseQuery.boardId = new Types.ObjectId(boardId);
                }
                const allReleases = await JiraRelease.find(releaseQuery);
                const sortedReleases = allReleases.sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
                const selectedRelease = sortedReleases.find((release) => release._id.equals(releaseId));

                if (!selectedRelease) {
                    throw new Error('Selected release not found');
                }

                const selectedReleaseIndex = sortedReleases.findIndex((release) => release._id.equals(releaseId));
                const Releases = sortedReleases.slice(Math.max(0, selectedReleaseIndex - 5), selectedReleaseIndex + 1);

                for (const release of Releases) {
                    const releasePRs = allPullRequests.filter((pr) => pr.fixVersion === release.releaseName);
                    const releaseIterationTime = await this.calculateAverageMrIterationTime(releasePRs);

                    averagePRIterationTimePerRelease.push({
                        release: release.releaseName,
                        iterationTime: releaseIterationTime,
                    });
                }
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
                prIterationTimeByDeveloper[developer] = await this.calculateAverageMrIterationTime(prDataByDeveloper[developer]);
            }
            const averagePRIterationTimeByDev = Object.entries(prIterationTimeByDeveloper).map(([name, iterationTime]) => ({
                name,
                iterationTime,
            }));

            const result = {
                AveragePRsIterationTime: await this.calculateAverageMrIterationTime(pullRequests),
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
            }
            catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            return result;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}

export default new GitLabIterationTimeService();
