import { PullRequestModel } from '../../github/model.js';
import { JiraReleaseModel, SprintModel, BoardModel } from '../../../project-management/jira/model.js';
import MergedMRService from '../services/mergedMRService.js';
import { getSprintDates, getReleaseDates } from '../../common/scmHelper.js';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';
import { Types } from 'mongoose';
class MergedMRController {
    async getMergedMRsWithoutReview(req, res) {
        try {
            const { tenantConnection } = req;
            const { repo } = req.body;
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId } = req.query;
            const cacheKey = cache.generateKey('mergedMRsWithoutReview', {
                projectId,
                companyId,
                sprintId,
                releaseId,
                boardId,
            });
            let cached = null;
            try {
                cached = await redis.get(cacheKey);
            } catch (err) {
                console.warn('Redis not available, skipping cache get:', err.message);
            }
            if (cached) {
                const data = JSON.parse(cached);
                return res.status(200).json(data);
            }

            const Sprint = SprintModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const PullRequest = PullRequestModel(tenantConnection);
            const Board = BoardModel(tenantConnection);

            // Validate board exists
            const board = await Board.findOne(
                {
                    _id: new Types.ObjectId(boardId),
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                },
                { boardType: 1 }
            );

            if (!board) {
                return res.status(404).json({ error: 'Board not found.' });
            }

            if (!repo || !companyId || !projectId) {
                return res.status(400).json({ error: 'Missing required parameters' });
            }

            const matchQuery = { companyId, projectId, repo, boardId: new Types.ObjectId(boardId) };
            let identifierType, startDate, endDate;
            if (sprintId) {
                matchQuery.sprintId = sprintId;
                identifierType = 'sprintId';
            } else if (releaseId) {
                const releaseData = await JiraRelease.findOne({ companyId, projectId, _id: releaseId, boardId: new Types.ObjectId(boardId) });
                if (!releaseData) {
                    return res.status(404).json({ error: 'Release not found' });
                }
                matchQuery.fixVersion = releaseData.releaseName;
                identifierType = 'releaseId';
            } else {
                return res.status(400).json({ error: 'Invalid type: must be either "sprint" or "release"' });
            }
            const [sprints, releases] = await Promise.all([
                Sprint.find({ companyId, projectId, state: { $in: ['active', 'closed'] }, boardId: new Types.ObjectId(boardId) }),
                JiraRelease.find({ companyId, projectId, status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] }, boardId: new Types.ObjectId(boardId) }),
            ]);
            const pullRequests = await PullRequest.find(matchQuery);
            const result = [];
            if (identifierType === 'sprintId') {
                const sprintData = sprints.find((sprint) => sprint._id.equals(sprintId));
                if (!sprintData) {
                    return res.status(404).json({ error: 'Sprint not found' });
                }
                ({ startDate, endDate } = getSprintDates(sprints, sprintId));
            } else {
                const releaseData = releases.find((release) => release._id.equals(releaseId));
                if (!releaseData) {
                    return res.status(404).json({ error: 'Release data not found' });
                }
                ({ startDate, endDate } = getReleaseDates(releases, releaseId));
            }
            const [getMergedPRsWithoutReviews, getPercentageMergedPRsNoReviews, getAvgTimeMergedPRsNoReviews, getAverageMergeTime, getHighRiskMRs] = await Promise.allSettled([
                MergedMRService.getMergedMRsWithoutReviews(pullRequests, startDate, endDate, companyId, tenantConnection),
                MergedMRService.getPercentageMergedPRsNoReviews(pullRequests, startDate, endDate, companyId, tenantConnection),
                MergedMRService.getAvgTimeMergedPRsNoReviews(pullRequests, startDate, endDate),
                MergedMRService.getAverageMergeTimeWithReview(pullRequests, startDate, endDate),
                MergedMRService.getHighRiskMRs(pullRequests, startDate, endDate),
            ]);
            result.push({ getMergedPRsWithoutReviews: getMergedPRsWithoutReviews.status === 'fulfilled' ? getMergedPRsWithoutReviews.value : null });
            result.push({ getPercentageMergedPRsNoReviews: getPercentageMergedPRsNoReviews.status === 'fulfilled' ? getPercentageMergedPRsNoReviews.value : null });
            result.push({ getAvgTimeMergedPRsNoReviews: getAvgTimeMergedPRsNoReviews.status === 'fulfilled' ? getAvgTimeMergedPRsNoReviews.value : null });
            result.push({ getAverageMergeTimeWithReview: getAverageMergeTime.status === 'fulfilled' ? getAverageMergeTime.value : null });
            result.push({ getHighRiskPRs: getHighRiskMRs.status === 'fulfilled' ? getHighRiskMRs.value : null });

            if (getMergedPRsWithoutReviews.status === 'rejected') {
                console.error('Failed to Fetch Merged PRs without Reviews');
            }
            if (getPercentageMergedPRsNoReviews.status === 'rejected') {
                console.error('Failed to Fetch Percentage Merged PRs without Reviews');
            }
            if (getAvgTimeMergedPRsNoReviews.status === 'rejected') {
                console.error('Failed to Fetch Average Merged PRs without Reviews');
            }

            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new MergedMRController();
