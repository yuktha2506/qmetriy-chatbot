/* eslint-disable indent */
import { PullRequestModel } from '../model.js';
import { JiraReleaseModel, SprintModel, BoardModel } from '../../../project-management/jira/model.js';
import ClosedPRService from '../services/closedPRService.js';
import { getSprintDates, getReleaseDates } from '../../common/scmHelper.js';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';
import { Types } from 'mongoose';

class ClosedPRController {
    async getClosedPRs(req, res) {
        try {
            const { tenantConnection } = req;
            const { repo } = req.body;
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId } = req.query;

            const cacheKey = cache.generateKey('closedPrs', {
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

            const matchQuery = { companyId, projectId, repo, status: 'closed', boardId: new Types.ObjectId(boardId) };
            let identifierType, startDate, endDate;
            if (sprintId) {
                matchQuery.sprintId = sprintId;
                identifierType = 'sprintId';
            } else if (releaseId) {
                const releaseData = await JiraRelease.findOne({ companyId, projectId, _id: releaseId, boardId: new Types.ObjectId(boardId) });
                if (!releaseData) {
                    return res.status(404).json({ error: 'Release data not found' });
                }
                matchQuery.fixVersion = releaseData.releaseName;
                identifierType = 'releaseId';
            } else {
                return res.status(400).json({ error: 'Invalid Type: must be either "sprint" or "release"' });
            }

            const [pullRequests, sprints, releases, bySprintOrReleasePullRequests] = await Promise.all([
                PullRequest.find(matchQuery),
                Sprint.find({ companyId, projectId, state: { $in: ['active', 'closed'] }, boardId: new Types.ObjectId(boardId) }),
                JiraRelease.find({ companyId, projectId, status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] }, boardId: new Types.ObjectId(boardId) }),
                PullRequest.find({ companyId, projectId, boardId: new Types.ObjectId(boardId) }),
            ]);

            if (identifierType === 'sprintId') {
                ({ startDate, endDate } = getSprintDates(sprints, sprintId));
            } else {
                ({ startDate, endDate } = getReleaseDates(releases, releaseId));
            }

            const [getClosedPullRequestsBySprintOrRelease, getClosedPullRequestsPerSprintOrRelease, getClosedPullRequestsByDev] = await Promise.allSettled([
                ClosedPRService.getClosedPullRequestsBySprintOrRelease(pullRequests, startDate, endDate),
                ClosedPRService.getClosedPullRequestsPerSprintOrRelease(bySprintOrReleasePullRequests, sprints, releases, identifierType, sprintId || releaseId, repo),
                ClosedPRService.getClosedPullRequestsByDev(pullRequests, startDate, endDate),
            ]);

            const result = {
                closedPullRequestsCount: getClosedPullRequestsBySprintOrRelease.status === 'fulfilled' ? getClosedPullRequestsBySprintOrRelease.value : 0,
                totalClosedPullRequestByDev:
                    getClosedPullRequestsByDev.status === 'fulfilled'
                        ? getClosedPullRequestsByDev.value.map((dev) => ({
                              name: dev.dev,
                              count: dev.count,
                          }))
                        : [],
                closedPullRequests:
                    getClosedPullRequestsPerSprintOrRelease.status === 'fulfilled'
                        ? getClosedPullRequestsPerSprintOrRelease.value.map((val) => ({
                              name: val.name,
                              count: parseFloat(val.count).toFixed(2),
                          }))
                        : [],
            };
            if (getClosedPullRequestsBySprintOrRelease.status === 'rejected') {
                console.error('Failed to Fetch Closed PR per sprint');
            }
            if (getClosedPullRequestsPerSprintOrRelease.status === 'rejected') {
                console.error('Failed to Fetch Closed PR By Sprint');
            }
            if (getClosedPullRequestsByDev.status === 'rejected') {
                console.error('Failed to Fetch Closed PR By Dev');
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

export default new ClosedPRController();
