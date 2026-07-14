import { JiraReleaseModel, SprintModel } from '../../../project-management/jira/model';
import { PullRequestModel } from '../../github/model';
import { getSprintDates, getReleaseDates } from '../../common/scmHelper.js';
import { Types } from 'mongoose';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';

class GitLabApprovalRateService {
    async getGitLabApprovalRate(requestParams) {
        try {
            const { companyId, projectId, boardId, sprintId, releaseId, repo, tenantConnection } = requestParams;

            const cacheKey = cache.generateKey('gitLabApprovalRate', {
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
            let identifierType, startDate, endDate;
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
            }
            const sprintQuery = { companyId, projectId, state: { $in: ['active', 'closed'] } };
            if (boardId) {
                sprintQuery.boardId = new Types.ObjectId(boardId);
            }
            const allSprints = await Sprint.find(sprintQuery);
            const releaseQuery = { companyId, projectId, status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] } };
            if (boardId) {
                releaseQuery.boardId = new Types.ObjectId(boardId);
            }
            const allReleases = await JiraRelease.find(releaseQuery);
            if (identifierType === 'sprintId') {
                ({ startDate, endDate } = getSprintDates(allSprints, sprintId));
            } else {
                ({ startDate, endDate } = getReleaseDates(allReleases, releaseId));
            }
            const mergeRequests = await MergeRequest.find(matchQuery);
            const allMergeRequestsQuery = { companyId, projectId, repo };
            if (boardId) {
                allMergeRequestsQuery.boardId = new Types.ObjectId(boardId);
            }
            const allMergeRequests = await MergeRequest.find(allMergeRequestsQuery);
            const totalMRsSubmitted = mergeRequests.length;
            const totalMRsMerged = mergeRequests.filter((mr) => mr.merged === 'merged' && new Date(mr.prMergedAt) >= new Date(startDate) && new Date(mr.prMergedAt) <= new Date(endDate)).length;
            const unroundedApprovalRate = totalMRsSubmitted > 0 ? (totalMRsMerged / totalMRsSubmitted) * 100 : 0;
            const approvalRate = Math.round(Number(unroundedApprovalRate) || 0);
            const approvalRatePerSprint = [];
            if (sprintId) {
                const sortedSprints = allSprints.sort((a, b) => a.startDate - b.startDate);
                const selectedSprint = sortedSprints.find((sprint) => sprint._id.equals(sprintId));
                if (!selectedSprint) {
                    throw new Error('Selected sprint not found');
                }
                const selectedSprintIndex = sortedSprints.findIndex((sprint) => sprint._id.equals(sprintId));
                const Sprints = sortedSprints.slice(Math.max(0, selectedSprintIndex - 5), selectedSprintIndex + 1);
                for (const sprint of Sprints) {
                    const sprintMRs = allMergeRequests.filter((mr) => mr.sprintId.includes(sprint._id));
                    const totalSprintMRsSubmitted = sprintMRs.length;
                    const totalSprintMRsMerged = sprintMRs.filter(
                        (mr) => mr.merged === 'merged' && new Date(mr.prMergedAt) >= new Date(startDate) && new Date(mr.prMergedAt) <= new Date(endDate)
                    ).length;
                    approvalRatePerSprint.push({
                        sprint: sprint.name,
                        approvalRate: totalSprintMRsSubmitted > 0 ? Math.round((totalSprintMRsMerged / totalSprintMRsSubmitted) * 100) : 0,
                    });
                }
            }
            const approvalRatePerRelease = [];
            if (releaseId) {
                const sortedReleases = allReleases.sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
                const selectedRelease = sortedReleases.find((release) => release._id.equals(releaseId));
                if (!selectedRelease) {
                    throw new Error('Selected release not found');
                }
                const selectedReleaseIndex = sortedReleases.findIndex((release) => release._id.equals(releaseId));
                const Releases = sortedReleases.slice(Math.max(0, selectedReleaseIndex - 5), selectedReleaseIndex + 1);
                for (const release of Releases) {
                    const releaseMRs = allMergeRequests.filter((mr) => mr.fixVersion === release.releaseName);
                    const totalReleaseMRsSubmitted = releaseMRs.length;
                    const totalReleaseMRsMerged = releaseMRs.filter(
                        (mr) => mr.merged === 'merged' && new Date(mr.prMergedAt) >= new Date(startDate) && new Date(mr.prMergedAt) <= new Date(endDate)
                    ).length;
                    approvalRatePerRelease.push({
                        release: release.releaseName,
                        approvalRate: totalReleaseMRsSubmitted > 0 ? Math.round((totalReleaseMRsMerged / totalReleaseMRsSubmitted) * 100) : 0,
                    });
                }
            }
            const approvalRateByDev = {};
            for (const mr of mergeRequests) {
                const developer = mr.prCreatedBy;
                if (!approvalRateByDev[developer]) {
                    approvalRateByDev[developer] = { totalSubmitted: 0, totalMerged: 0 };
                }
                approvalRateByDev[developer].totalSubmitted++;
                if (mr.merged === 'merged' && new Date(mr.prMergedAt) >= new Date(startDate) && new Date(mr.prMergedAt) <= new Date(endDate)) {
                    approvalRateByDev[developer].totalMerged++;
                }
            }
            const formattedApprovalRateByDev = Object.entries(approvalRateByDev).map(([name, { totalSubmitted, totalMerged }]) => {
                const approvalRate = totalSubmitted > 0 ? Math.round((totalMerged / totalSubmitted) * 100) : 0;
                return { name, approvalRate };
            });
            const result = {
                approvalRate,
                approvalRateByDev: formattedApprovalRateByDev,
            };
            if (sprintId) {
                result.approvalRatePerSprint = approvalRatePerSprint;
            }
            if (releaseId) {
                result.approvalRatePerRelease = approvalRatePerRelease;
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

export default new GitLabApprovalRateService();
