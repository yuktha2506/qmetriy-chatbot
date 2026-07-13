import { PullRequestModel } from '../model.js';
import { JiraReleaseModel, SprintModel } from '../../../project-management/jira/model.js';
import { getSprintDates, getReleaseDates } from '../../common/scmHelper.js';
import { Types } from 'mongoose';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';

class PullRequestSizeService {
    async getPullRequestSize(requestParams) {
        try {
            const { companyId, projectId, boardId, sprintId, releaseId, repo, tenantConnection } = requestParams;

            const cacheKey = cache.generateKey('pullRequestSize', {
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
            let identifierType, startDate, endDate;
            const result = [];
            if (sprintId) {
                matchQuery.sprintId = sprintId;
                identifierType = 'sprintId';
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
                identifierType = 'releaseId';
            } else {
                throw new Error('Invalid type: must be either "sprint" or "release"');
            }
            const sprintQuery = { companyId, projectId, state: { $in: ['active', 'closed'] } };
            if (boardId) {
                sprintQuery.boardId = new Types.ObjectId(boardId);
            }
            const allSprintDetails = await Sprint.find(sprintQuery);
            const pullRequests = await PullRequest.find(matchQuery);
            const pullRequestsSummaryQuery = { companyId, projectId, repo };
            if (boardId) {
                pullRequestsSummaryQuery.boardId = new Types.ObjectId(boardId);
            }
            const pullRequestsSummary = await PullRequest.find(pullRequestsSummaryQuery);
            const releaseQuery = { companyId, projectId, status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] } };
            if (boardId) {
                releaseQuery.boardId = new Types.ObjectId(boardId);
            }
            const allReleaseDetails = await JiraRelease.find(releaseQuery);
            if (identifierType === 'sprintId') {
                const sprintData = allSprintDetails.find((sprint) => sprint._id.equals(sprintId));
                if (!sprintData) {
                    throw new Error('Sprint not found');
                }

                ({ startDate, endDate } = getSprintDates(allSprintDetails, sprintId));
            } else {
                const selectedReleaseData = allReleaseDetails.find((release) => release._id.equals(releaseId));
                if (!selectedReleaseData) {
                    throw new Error('Release data not found');
                }
                ({ startDate, endDate } = getReleaseDates(allReleaseDetails, releaseId));
            }
            const filteredPullRequests = pullRequests.filter((pr) => {
                if (pr.status === 'open') {
                    const prCreatedAt = new Date(pr.prCreatedAt);
                    return prCreatedAt >= startDate && prCreatedAt <= endDate;
                } else if (pr.status === 'closed') {
                    const prClosedAt = new Date(pr.prClosedAt);
                    return prClosedAt >= startDate && prClosedAt <= endDate;
                }
                return false;
            });
            const pullRequestSize = filteredPullRequests.reduce((totalSize, pr) => {
                return totalSize + (pr.linesAdded || 0) + (pr.linesDeleted || 0);
            }, 0);
            const resultKey = identifierType === 'sprintId' ? 'averagePRSizePerSprint' : 'averagePRSizePerRelease';
            const [getAveragePRSizePerSprint, getAveragePRSizeByDev] = await Promise.allSettled([
                this.getAveragePRSize(pullRequestsSummary, allSprintDetails, allReleaseDetails, identifierType, sprintId || releaseId),
                this.getAveragePRSizeByDev(pullRequests, startDate, endDate),
            ]);
            result.push({ getAveragePRSize: getAveragePRSizePerSprint.status === 'fulfilled' ? getAveragePRSizePerSprint.value : null });
            result.push({ getAveragePRSizeByDev: getAveragePRSizeByDev.status === 'fulfilled' ? getAveragePRSizeByDev.value : null });
            const averagePRSize = result[0].getAveragePRSize;
            const averagePRSizeByDev = result[1].getAveragePRSizeByDev;
            const res = {
                pullRequestSize: pullRequestSize,
                [resultKey]: averagePRSize,
                averagePRSizeByDeveloper: averagePRSizeByDev,
            };
            try {
                await redis.set(cacheKey, JSON.stringify(res), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            return res;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
    async getAveragePRSize(pullRequests, sprints, releases, identifierType, selectedSprintOrRelease) {
        try {
            const isSprint = identifierType === 'sprintId'; 
            let items = [];
        
            if (isSprint) {
                const sortedSprints = [...sprints].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                const selectedSprint = sortedSprints.find((sprint) => sprint._id.equals(selectedSprintOrRelease));
                if (!selectedSprint) {
                    throw new Error('Selected sprint not found');
                }
                const selectedSprintIndex = sortedSprints.findIndex((sprint) => sprint._id.equals(selectedSprintOrRelease));
            
                items = sortedSprints.slice(Math.max(0, selectedSprintIndex - 5), selectedSprintIndex + 1);
            } else {
                const sortedReleases = [...releases].sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
                const selectedRelease = sortedReleases.find((release) => release._id.equals(selectedSprintOrRelease));
                if (!selectedRelease) {
                    throw new Error('Selected release not found');
                }
                const selectedReleaseIndex = sortedReleases.findIndex((release) => release._id.equals(selectedSprintOrRelease));
                items = sortedReleases.slice(Math.max(0, selectedReleaseIndex - 5), selectedReleaseIndex + 1);
            }
    
            const result = items.map((item) => ({ 
                name: isSprint ? item.name : item.releaseName, 
                averageSize: 0, 
            })); 
    
            const sprintPullRequestSizes = await Promise.all(items.map(async (item) => {
                let startDate, endDate;
    
                if (isSprint) {
                    const { startDate: s, endDate: e } = getSprintDates(sprints, item._id);
                    startDate = s;
                    endDate = e;
                } else {
                    const { startDate: s, endDate: e } = getReleaseDates(releases, item._id);
                    startDate = s;
                    endDate = e;
                }
    
                const filteredPullRequests = pullRequests.filter((pr) => {
                    if (pr.status === 'open') {
                        const prCreatedAt = new Date(pr.prCreatedAt);
                        return prCreatedAt >= startDate && prCreatedAt <= endDate && (isSprint ? 
                            pr.sprintId.some(sprintIdObj => sprintIdObj.$oid === item._id.$oid) : pr.fixVersion === item.releaseName);
                    } else if (pr.status === 'closed') {
                        const prClosedAt = new Date(pr.prClosedAt);
                        return prClosedAt >= startDate && prClosedAt <= endDate && (isSprint ? 
                            pr.sprintId.some(sprintIdObj => sprintIdObj.$oid === item._id.$oid) : pr.fixVersion === item.releaseName);
                    }    
                    return false;
                });
    
                const totalSize = filteredPullRequests.reduce((totalSize, pr) => {
                    return totalSize + (pr.linesAdded || 0) + (pr.linesDeleted || 0);
                }, 0);
    
                const averageSize = filteredPullRequests.length > 0 ? Math.round(totalSize / filteredPullRequests.length) : 0;
                
                return {
                    name: isSprint ? item.name : item.releaseName,
                    averageSize,
                };
            }));
    
            sprintPullRequestSizes.forEach((prSize) => {
                const index = result.findIndex((r) => r.name === prSize.name);
                if (index !== -1) {
                    result[index].averageSize = prSize.averageSize;
                }
            });
    
            const formattedResult = result.reduce((acc, item) => {
                acc[item.name] = item.averageSize;
                return acc;
            }, {});
    
            return formattedResult;
        } catch (error) {
            console.error('Error fetching average PR sizes:', error);
            throw error;
        }
    }
    async getAveragePRSizeByDev(pullRequests, startDate, endDate) {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const openByDev = pullRequests
                .filter((pr) => {
                    if (pr.status === 'open') {
                        const prCreatedAt = new Date(pr.prCreatedAt);
                        return prCreatedAt >= start && prCreatedAt <= end;
                    } else if (pr.status === 'closed') {
                        const prClosedAt = new Date(pr.prClosedAt);
                        return prClosedAt >= start && prClosedAt <= end;
                    }
                    return false;
                })
                .reduce((acc, pr) => {
                    const dev = pr.prCreatedBy;
                    const pullRequestSize = pr.linesAdded + pr.linesDeleted;
                    if (!acc[dev]) {
                        acc[dev] = { totalSize: 0, prCount: 0 };
                    }
                    acc[dev].totalSize += pullRequestSize;
                    acc[dev].prCount++;
                    return acc;
                }, {});
            const result = Object.entries(openByDev).map(([dev, { totalSize, prCount }]) => ({
                dev,
                averagePRSize: Math.round(totalSize / prCount),
            }));
            return result;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}

export default new PullRequestSizeService();
