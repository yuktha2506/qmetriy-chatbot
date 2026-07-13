import { JiraReleaseModel, SprintModel } from '../../../project-management/jira/model';
import { PullRequestModel } from '../model';
import { getSprintDates, getReleaseDates } from '../../common/scmHelper';
import { Types } from 'mongoose';
import { redis } from '../../../../server';
import cache from '../../../../utils/cache';
import { RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';

class GitApprovalRateService {
    async getGitApprovalRate(companyId, projectId, boardId, sprintId, releaseId, repo, tenantConnection) {
        try {
            const cacheKey = cache.generateKey('gitApprovalRate', {
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
            const allPullRequestsQuery = { companyId, projectId, repo };
            if (boardId) {
                allPullRequestsQuery.boardId = new Types.ObjectId(boardId);
            }
            const allPullRequests = await PullRequest.find(allPullRequestsQuery);
            const matchQuery = { companyId, projectId, repo };
            if (boardId) {
                matchQuery.boardId = new Types.ObjectId(boardId);
            }
            let startDate, endDate;
            const approvalRatePerSprint = [];
            if (sprintId) {
                const sprintQuery = { companyId, projectId, state: { $in: ['active', 'closed'] } };
                if (boardId) {
                    sprintQuery.boardId = new Types.ObjectId(boardId);
                }
                const sprints = await Sprint.find(sprintQuery);
                matchQuery.sprintId = sprintId;
                ({ startDate, endDate } = getSprintDates(sprints, sprintId));
                const selectedSprintQuery = { companyId, projectId, _id: sprintId };
                if (boardId) {
                    selectedSprintQuery.boardId = new Types.ObjectId(boardId);
                }
                const selectedSprint = await Sprint.findOne(selectedSprintQuery, { startDate: 1 });
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
                for (const sprint of Sprints) {
                    const sprintPRs = allPullRequests.filter((pr) => pr.sprintId.includes(sprint._id));
                    ({ startDate, endDate } = getSprintDates(sprints, sprint._id));
                    const totalSprintPRsSubmitted = sprintPRs.length;
                    const totalSprintPRsMerged = sprintPRs.filter((pr) => pr.merged === 'true' && pr.prClosedAt >= new Date(startDate) && pr.prClosedAt < new Date(endDate)).length;
                    approvalRatePerSprint.push({
                        sprint: sprint.name,
                        approvalRate: totalSprintPRsSubmitted > 0 ? Math.round((totalSprintPRsMerged / totalSprintPRsSubmitted) * 100) : 0,
                    });
                }
            }
            const approvalRatePerRelease = [];
            if (releaseId) {
                const releaseQuery = { companyId, projectId, status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] } };
                if (boardId) {
                    releaseQuery.boardId = new Types.ObjectId(boardId);
                }
                const releases = await JiraRelease.find(releaseQuery);
                const releaseDataQuery = { companyId, projectId, _id: releaseId };
                if (boardId) {
                    releaseDataQuery.boardId = new Types.ObjectId(boardId);
                }
                const releaseData = await JiraRelease.findOne(releaseDataQuery, { startDate: 1, releaseName: 1 });
                if (!releaseData) {
                    throw new Error('Release data not found');
                }
                ({ startDate, endDate } = getReleaseDates(releases, releaseId));
                matchQuery.fixVersion = releaseData.releaseName;
                const releaseMatchQuery = {
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                    startDate: { $lte: new Date(releaseData.startDate) },
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
                for (const release of Releases) {
                    const releasePRs = allPullRequests.filter((pr) => pr.fixVersion === release.releaseName);
                    ({ startDate, endDate } = getReleaseDates(releases, release._id));
                    const totalReleasePRsSubmitted = releasePRs.length;
                    const totalReleasePRsMerged = releasePRs.filter((pr) => pr.merged === 'true' && pr.prClosedAt >= new Date(startDate) && pr.prClosedAt < new Date(endDate)).length;
                    approvalRatePerRelease.push({
                        release: release.releaseName,
                        approvalRate: totalReleasePRsSubmitted > 0 ? Math.round((totalReleasePRsMerged / totalReleasePRsSubmitted) * 100) : 0,
                    });
                }
            }
            const pullRequests = await PullRequest.find(matchQuery);
            const totalPRsSubmitted = pullRequests.length;
            const totalPRsMerged = pullRequests.filter((pr) => pr.merged === 'true' && pr.prClosedAt >= new Date(startDate) && pr.prClosedAt < new Date(endDate)).length;
            const unroundedApprovalRate = totalPRsSubmitted > 0 ? (totalPRsMerged / totalPRsSubmitted) * 100 : 0;
            const approvalRate = Math.round(Number(unroundedApprovalRate) || 0);
            const approvalRateByDev = {};
            for (const pr of pullRequests) {
                const developer = pr.prCreatedBy;
                if (!approvalRateByDev[developer]) {
                    approvalRateByDev[developer] = { totalSubmitted: 0, totalMerged: 0 };
                }
                approvalRateByDev[developer].totalSubmitted++;
                if (pr.merged === 'true' && pr.prClosedAt >= new Date(startDate) && pr.prClosedAt < new Date(endDate)) {
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

export default new GitApprovalRateService();
