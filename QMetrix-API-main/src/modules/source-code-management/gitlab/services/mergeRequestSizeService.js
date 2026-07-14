/* eslint-disable no-constant-condition */
import { PullRequestModel } from '../../github/model.js';
import { JiraReleaseModel, SprintModel } from '../../../project-management/jira/model.js';
import { getSprintDates, getReleaseDates } from '../../common/scmHelper.js';
import { Types } from 'mongoose';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';

class MergeRequestSizeService {
    async getMergeRequestSize(requestParams) {
        try {
            const { companyId, projectId, boardId, sprintId, releaseId, repo, tenantConnection } = requestParams;
            const cacheKey = cache.generateKey('mergeRequestSize', {
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
                const data = JSON.parse(cached);
                return data;
            }
            const Sprint = SprintModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const MergeRequest = PullRequestModel(tenantConnection);
            const matchQuery = { companyId, projectId, repo };
            if (boardId) {
                matchQuery.boardId = new Types.ObjectId(boardId);
            }
            let identifierType, startDate, endDate, lastSixSprintsIncludingSelected, lastSixReleasesIncludingSelected;
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
            const mergeRequests = await MergeRequest.find(matchQuery);
            const mergeRequestsSummaryQuery = { companyId, projectId, repo };
            if (boardId) {
                mergeRequestsSummaryQuery.boardId = new Types.ObjectId(boardId);
            }
            const mergeRequestsSummary = await MergeRequest.find(mergeRequestsSummaryQuery);
            const releaseQuery = { companyId, projectId, status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] } };
            if (boardId) {
                releaseQuery.boardId = new Types.ObjectId(boardId);
            }
            const allReleaseDetails = await JiraRelease.find(releaseQuery);
            if (identifierType === 'sprintId') {
                const sprintData = allSprintDetails.find((sprint) => sprint._id.equals(sprintId));
                if (!sprintData) {
                    return res.status(404).json({ error: 'Sprint not found' });
                }
                ({ startDate, endDate } = getSprintDates(allSprintDetails, sprintId));
                const sortedSprints = allSprintDetails.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                const selectedSprintIndex = sortedSprints.findIndex((sprint) => sprint._id.toString() === sprintId.toString());
                lastSixSprintsIncludingSelected = sortedSprints.slice(Math.max(0, selectedSprintIndex - 5), selectedSprintIndex + 1);
            } else {
                const selectedReleaseData = allReleaseDetails.find((release) => release._id.equals(releaseId));
                if (!selectedReleaseData) {
                    return res.status(404).json({ error: 'Release data not found' });
                }
                ({ startDate, endDate } = getReleaseDates(allReleaseDetails, releaseId));
                const sortedReleases = allReleaseDetails.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                const selectedReleaseIndex = sortedReleases.findIndex((release) => release._id.toString() === releaseId.toString());
                lastSixReleasesIncludingSelected = sortedReleases.slice(Math.max(0, selectedReleaseIndex - 5), selectedReleaseIndex + 1);
            }
            const filteredPullRequests = mergeRequests.filter((pr) => {
                if (pr.status === 'opened') {
                    const prCreatedAt = new Date(pr.prCreatedAt);
                    return prCreatedAt >= startDate && prCreatedAt <= endDate;
                } else if (pr.status === 'merged') {
                    const prClosedAt = new Date(pr.prMergedAt);
                    return prClosedAt >= startDate && prClosedAt <= endDate;
                }
                return false;
            });
            const mergeRequestSize = filteredPullRequests.reduce((totalSize, mr) => {
                return totalSize + (mr.linesAdded || 0) + (mr.linesDeleted || 0);
            }, 0);
            const [getAverageMRSizePerSprint, getAverageMRSizeByDev] = await Promise.allSettled([
                this.getAverageMRSize(mergeRequestsSummary, lastSixSprintsIncludingSelected, lastSixReleasesIncludingSelected, identifierType, sprintId || releaseId ),
                this.getAverageMRSizeByDev(mergeRequests, startDate, endDate),
            ]);
            result.push({ getAverageMRSize: getAverageMRSizePerSprint.status === 'fulfilled' ? getAverageMRSizePerSprint.value : null });
            result.push({ getAverageMRSizeByDev: getAverageMRSizeByDev.status === 'fulfilled' ? getAverageMRSizeByDev.value : null });
            const averageMRSize = result[0].getAverageMRSize;
            const averageMRSizeByDev = result[1].getAverageMRSizeByDev;
            const resultKey = identifierType === 'sprintId' ? 'averagePRSizePerSprint' : 'averagePRSizePerRelease';
            const res = {
                pullRequestSize: mergeRequestSize,
                [resultKey]: averageMRSize,
                averagePRSizeByDeveloper: averageMRSizeByDev,
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
    async getAverageMRSize(mergeRequests, sprints, releaseData, identifierType, selectedSprintOrRelease) {
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
                const sortedReleases = [...releaseData].sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
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

            const sprintPullRequestSizes = items.map((item) => {
                let startDate, endDate;
    
                if (isSprint) {
                    const { startDate: s, endDate: e } = getSprintDates(sprints, item._id);
                    startDate = s;
                    endDate = e;
                } else {
                    const { startDate: s, endDate: e } = getReleaseDates(releaseData, item._id);
                    startDate = s;
                    endDate = e;
                }
                const filteredMergeRequests = mergeRequests.filter((mr) => {
                    if (mr.status === 'opened') {
                        const prCreatedAt = new Date(mr.prCreatedAt);
                        return (isSprint && item._id === mr.sprintId) || (!isSprint && item.releaseName === mr.fixVersion && prCreatedAt >= startDate && prCreatedAt <= endDate);
                    } else if (mr.status === 'merged') {
                        const prClosedAt = new Date(mr.prMergedAt);
                        return (isSprint && item._id === mr.sprintId) || (!isSprint && item.releaseName === mr.fixVersion && prClosedAt >= startDate && prClosedAt <= endDate);
                    }
                    return false;
                });
                const totalSize = filteredMergeRequests.reduce((total, mr) => {
                    return total + (mr.linesAdded || 0) + (mr.linesDeleted || 0);
                }, 0);

                const averageSize = filteredMergeRequests.length > 0 ? (totalSize / filteredMergeRequests.length).toFixed(1) : '0';
                return {
                    name: isSprint ? item.name : item.releaseName,
                    averageSize: Math.round(averageSize),
                };
            });

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
            console.error('Error fetching average MR sizes:', error);
            throw error;
        }
    }
    async getAverageMRSizeByDev(mergeRequests, startDate, endDate) {
        try {
            const openByDev = mergeRequests
                .filter((pr) => {
                    if (pr.status === 'opened') {
                        const prCreatedAt = new Date(pr.prCreatedAt);
                        return prCreatedAt >= startDate && prCreatedAt <= endDate;
                    } else if (pr.status === 'merged') {
                        const prClosedAt = new Date(pr.prMergedAt);
                        return prClosedAt >= startDate && prClosedAt <= endDate;
                    }
                    return false;
                })
                .reduce((acc, mr) => {
                    const dev = mr.prCreatedBy;
                    const mergeRequestSize = mr.linesAdded + mr.linesDeleted;
                    if (!acc[dev]) {
                        acc[dev] = { totalSize: 0, prCount: 0 };
                    }
                    acc[dev].totalSize += mergeRequestSize;
                    acc[dev].prCount++;
                    return acc;
                }, {});
            const result = Object.entries(openByDev).map(([dev, { totalSize, prCount }]) => ({
                dev,
                averageMRSize: Math.round(totalSize / prCount),
            }));
            return result;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}

export default new MergeRequestSizeService();
