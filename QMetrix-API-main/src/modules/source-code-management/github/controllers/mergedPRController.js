import { PullRequestModel } from '../model.js';
import { JiraReleaseModel, SprintModel, BoardModel } from '../../../project-management/jira/model.js';
import MergedPRService from '../services/mergedPRService.js';
import { getSprintDates, getReleaseDates } from '../../common/scmHelper.js';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';
import { Types } from 'mongoose';

class MergedPRController {
    async getMergedPRsWithoutReview(req, res) {
        try {
            const { tenantConnection } = req;
            const { repo } = req.body;
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId, developer: dev } = req.query;
            const developer = dev;

            const cacheKey = cache.generateKey('mergedPRsWithoutReview', {
                projectId,
                companyId,
                sprintId,
                releaseId,
                boardId,
                ...(developer ? { developer } : {}),
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

            if (dev !== undefined) {
                matchQuery.prCreatedBy = developer;
            }
            const [sprints, releases] = await Promise.all([
                Sprint.find({ companyId, projectId, state: { $in: ['active', 'closed'] }, boardId: new Types.ObjectId(boardId) }),
                JiraRelease.find({ companyId, projectId, status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] }, boardId: new Types.ObjectId(boardId) }),
            ]);
            const pullRequests = await PullRequest.find(matchQuery);
            const result = [];
            if (identifierType === 'sprintId') {
                ({ startDate, endDate } = getSprintDates(sprints, sprintId));
            } else {
                ({ startDate, endDate } = getReleaseDates(releases, releaseId));
            }

            const [getMergedPRsWithoutReviews, getPercentageMergedPRsNoReviews, getAvgTimeMergedPRsNoReviews, getAverageMergeTime, getHighRiskPRs] = await Promise.allSettled([
                MergedPRService.getMergedPRsWithoutReviews(pullRequests, startDate, endDate, tenantConnection, companyId),
                MergedPRService.getPercentageMergedPRsNoReviews(pullRequests, startDate, endDate, tenantConnection, companyId),
                MergedPRService.getAvgTimeMergedPRsNoReviews(pullRequests, startDate, endDate),
                MergedPRService.getAverageMergeTime(pullRequests, startDate, endDate),
                MergedPRService.getHighRiskPRs(pullRequests, startDate, endDate),
            ]);

            result.push({ getMergedPRsWithoutReviews: getMergedPRsWithoutReviews.status === 'fulfilled' ? getMergedPRsWithoutReviews.value : null });
            result.push({ getPercentageMergedPRsNoReviews: getPercentageMergedPRsNoReviews.status === 'fulfilled' ? getPercentageMergedPRsNoReviews.value : null });
            result.push({ getAvgTimeMergedPRsNoReviews: getAvgTimeMergedPRsNoReviews.status === 'fulfilled' ? getAvgTimeMergedPRsNoReviews.value : null });
            result.push({ getAverageMergeTimeWithReview: getAverageMergeTime.status === 'fulfilled' ? getAverageMergeTime.value : null });
            result.push({ getHighRiskPRs: getHighRiskPRs.status === 'fulfilled' ? getHighRiskPRs.value : null });

            if (getMergedPRsWithoutReviews.status === 'rejected') {
                console.error('Failed to Fetch Merged PRs without Reviews');
            }
            if (getPercentageMergedPRsNoReviews.status === 'rejected') {
                console.error('Failed to Fetch Percentage Merged PRs without Reviews');
            }
            if (getAvgTimeMergedPRsNoReviews.status === 'rejected') {
                console.error('Failed to Fetch Average Merged PRs without Reviews');
            }
            if (getAverageMergeTime.status === 'rejected') {
                console.error('Failed to Fetch Average Merge Time');
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

export default new MergedPRController();
