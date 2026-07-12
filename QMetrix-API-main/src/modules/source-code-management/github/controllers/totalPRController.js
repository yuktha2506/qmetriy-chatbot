import { PullRequestModel } from '../model.js';
import { JiraReleaseModel, SprintModel, BoardModel } from '../../../project-management/jira/model.js';
import TotalPRService from '../services/totalPRService.js';
import { getSprintDates, getReleaseDates } from '../../common/scmHelper.js';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';
import { Types } from 'mongoose';

class TotalPRController {
    async getTotalPRs(req, res) {
        try {
            const { tenantConnection } = req;
            const { repo } = req.body;
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId, developer } = req.query;

            const cacheKey = cache.generateKey('totalPRs', {
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
            const sprints = await Sprint.find({ companyId, projectId, state: { $in: ['active', 'closed'] }, boardId: new Types.ObjectId(boardId) });
            const pullRequests = await PullRequest.find(matchQuery);
            const releaseData = await JiraRelease.find({ companyId, projectId, status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] }, boardId: new Types.ObjectId(boardId) });

            if (identifierType === 'sprintId') {
                ({ startDate, endDate } = getSprintDates(sprints, sprintId));
            } else {
                ({ startDate, endDate } = getReleaseDates(releaseData, releaseId));
            }
            const [getTotalPullRequestsPerSprintOrRelease, getTotalPullRequestsSprintOrReleaseTrend, getTotalPullRequestsByDev, getTotalPullRequests] = await Promise.allSettled([
                TotalPRService.getTotalPullRequestsPerSprintOrRelease(pullRequests, sprints, releaseData, identifierType, sprintId || releaseId),
                TotalPRService.getTotalPullRequestsSprintOrReleaseTrend(pullRequests, sprints, releaseData, identifierType),
                TotalPRService.getTotalPullRequestsByDev(pullRequests, startDate, endDate),
                TotalPRService.getTotalPullRequests(pullRequests, startDate, endDate),
            ]);
            const result = {
                getTotalPullRequests: getTotalPullRequests.status === 'fulfilled' ? getTotalPullRequests.value : 0,
                getTotalPullRequestsByDev: [],
                totalPullRequests: [],
            };

            if (getTotalPullRequestsPerSprintOrRelease.status === 'fulfilled') {
                result.totalPullRequests = getTotalPullRequestsPerSprintOrRelease.value.map((item) => ({
                    name: item.name,
                    count: Number(item.count).toFixed(2),
                }));
            }

            if (getTotalPullRequestsByDev.status === 'fulfilled') {
                result.getTotalPullRequestsByDev = getTotalPullRequestsByDev.value.map((dev) => ({
                    name: dev.dev,
                    count: Number(dev.count).toFixed(2),
                }));
            }
            if (getTotalPullRequestsPerSprintOrRelease.status === 'rejected') {
                console.error('Failed to Fetch Open PR By Release');
            }
            if (getTotalPullRequestsSprintOrReleaseTrend.status === 'rejected') {
                console.error('Failed to Fetch Open PRs per sprint');
            }
            if (getTotalPullRequestsByDev.status === 'rejected') {
                console.error('Failed to Fetch open PR By Dev');
            }
            if (getTotalPullRequests.status === 'rejected') {
                console.error('Failed to Fetch PR Due to Lack of Approvals');
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

export default new TotalPRController();
