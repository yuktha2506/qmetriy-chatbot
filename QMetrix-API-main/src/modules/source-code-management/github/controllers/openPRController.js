/* eslint-disable indent */
import { PullRequestModel } from '../model.js';
import { JiraReleaseModel, SprintModel, BoardModel } from '../../../project-management/jira/model.js';
import OpenPRService from '../services/openPRService.js';
import { getSprintDates, getReleaseDates } from '../../common/scmHelper.js';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';
import { Types } from 'mongoose';

class OpenPRController {
    async getOpenPRs(req, res) {
        try {
            const { tenantConnection } = req;
            const { repo } = req.body;
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId, developer: dev } = req.query;
            const developer = dev;

            const cacheKey = cache.generateKey('openPRs', {
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

            const matchQuery = { companyId, projectId, repo, status: 'open', boardId: new Types.ObjectId(boardId) };
            const inProgressPullRequestsMatchQuery = { companyId, projectId, repo, status: 'in progress', boardId: new Types.ObjectId(boardId) };
            let identifierType, startDate, endDate;
            if (sprintId) {
                matchQuery.sprintId = sprintId;
                inProgressPullRequestsMatchQuery.sprintId = sprintId;
                identifierType = 'sprintId';
            } else if (releaseId) {
                const releaseData = await JiraRelease.findOne({ companyId, projectId, _id: releaseId, boardId: new Types.ObjectId(boardId) });
                if (!releaseData) {
                    return res.status(404).json({ error: 'Release not found' });
                }
                matchQuery.fixVersion = releaseData.releaseName;
                inProgressPullRequestsMatchQuery.fixVersion = releaseData.releaseName;
                identifierType = 'releaseId';
            } else {
                return res.status(400).json({ error: 'Invalid type: must be either "sprint" or "release"' });
            }

            if (dev !== undefined) {
                matchQuery.prCreatedBy = developer;
            }
            const sprints = await Sprint.find({ companyId, projectId, state: { $in: ['active', 'closed'] }, boardId: new Types.ObjectId(boardId) });

            const pullRequests = await PullRequest.find(matchQuery);
            const inProgresspullRequests = await PullRequest.find(inProgressPullRequestsMatchQuery);
            const releaseData = await JiraRelease.find({ companyId, projectId, status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] }, boardId: new Types.ObjectId(boardId) });

            if (identifierType === 'sprintId') {
                ({ startDate, endDate } = getSprintDates(sprints, sprintId));
            } else {
                ({ startDate, endDate } = getReleaseDates(releaseData, releaseId));
            }
            const [
                getOpenPullRequestsBySprintOrRelease,
                getOpenPullRequestsPerSprintOrRelease,
                getOpenPullRequestsSprintTrend,
                getOpenPullRequestsByDev,
                getInProgressPullRequests,
                getPRsLackOfApproval,
                getPullRequestsWithMergeConflicts,
                getOpenReviewedAndUnreviewedPrs,
            ] = await Promise.allSettled([
                OpenPRService.getOpenPullRequestsBySprintOrRelease(pullRequests, endDate),
                OpenPRService.getOpenPullRequestsPerSprintOrRelease(pullRequests, sprints, releaseData, identifierType, sprintId || releaseId),
                OpenPRService.getOpenPullRequestsSprintTrend(pullRequests, sprints, releaseData, identifierType),
                OpenPRService.getOpenPullRequestsByDev(pullRequests, startDate, endDate),
                OpenPRService.getInProgressPullRequests(inProgresspullRequests, startDate, endDate),
                OpenPRService.getPRsLackOfApproval(pullRequests, startDate, endDate),
                OpenPRService.getPullRequestsWithMergeConflicts(pullRequests, startDate, endDate),
                OpenPRService.getOpenReviewedAndUnreviewedPrs(pullRequests, endDate),
            ]);
            const formattedResult = {
                openPullRequestsCount: getOpenPullRequestsBySprintOrRelease.status === 'fulfilled' ? getOpenPullRequestsBySprintOrRelease.value : 0,
                openPullRequests:
                    getOpenPullRequestsPerSprintOrRelease.status === 'fulfilled'
                        ? Object.entries(getOpenPullRequestsPerSprintOrRelease.value).map(([name, count]) => ({
                              name,
                              count: parseFloat(count), // Ensure count is a number
                          }))
                        : null,

                totalOpenPullRequestsByDev: getOpenPullRequestsByDev.status === 'fulfilled' ? getOpenPullRequestsByDev.value : null,
                getOpenReviewedAndUnreviewedPrs: getOpenReviewedAndUnreviewedPrs.status === 'fulfilled' ? getOpenReviewedAndUnreviewedPrs.value : null,
            };

            if (getOpenPullRequestsBySprintOrRelease.status === 'rejected') {
                console.error('Failed to Fetch Open PR By Release');
            }
            if (getOpenPullRequestsPerSprintOrRelease.status === 'rejected') {
                console.error('Failed to Fetch Open PRs per sprint');
            }
            if (getOpenPullRequestsSprintTrend.status === 'rejected') {
                console.error('Failed to Fetch PR Sprint Trend');
            }
            if (getOpenPullRequestsByDev.status === 'rejected') {
                console.error('Failed to Fetch open PR By Dev');
            }
            if (getInProgressPullRequests.status === 'rejected') {
                console.error('Failed to Fetch PR Due to Lack of Approvals');
            }
            if (getPRsLackOfApproval.status === 'rejected') {
                console.error('Failed to Fetch PR Due to Lack of Approvals');
            }
            if (getPullRequestsWithMergeConflicts.status === 'rejected') {
                console.error('Failed to Fetch PR With Merge Conflicts');
            }
            if (getOpenReviewedAndUnreviewedPrs.status === 'rejected') {
                console.error('Failed to Fetch open reveiwed and unreviewed prs');
            }
            const result = formattedResult;

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

export default new OpenPRController();
