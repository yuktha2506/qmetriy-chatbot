/* eslint-disable indent */
import { PullRequestModel } from '../../github/model.js';
import { JiraReleaseModel, SprintModel, BoardModel } from '../../../project-management/jira/model.js';
import { getSprintDates, getReleaseDates } from '../../common/scmHelper.js';
import ClosedMergeRequestService from '../services/closedMergeRequestService.js';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';
import { Types } from 'mongoose';

class ClosedMergeRequestController {
    async getClosedMergeRequests(req, res) {
        try {
            const { tenantConnection } = req;
            const { repo } = req.body;
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId } = req.query;

            const cacheKey = cache.generateKey('closedMergeRequests', {
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
            const MergeRequest = PullRequestModel(tenantConnection);
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
            const matchQuery = { companyId, projectId, repo, status: 'merged', boardId: new Types.ObjectId(boardId) };
            let identifierType, startDate, endDate, lastSixSprintsIncludingSelected, lastSixReleasesIncludingSelected;
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
            const [mergeRequests, sprints, releases, allMergeRequest] = await Promise.all([
                MergeRequest.find(matchQuery),
                Sprint.find({ companyId, projectId, state: { $in: ['active', 'closed'] }, boardId: new Types.ObjectId(boardId) }),
                JiraRelease.find({ companyId, projectId, status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] }, boardId: new Types.ObjectId(boardId) }),
                MergeRequest.find({ companyId, projectId, repo, status: 'merged', boardId: new Types.ObjectId(boardId) }),
            ]);

            if (identifierType === 'sprintId') {
                const sprintData = sprints.find((sprint) => sprint._id.equals(sprintId));
                if (!sprintData) {
                    return res.status(404).json({ error: 'Sprint not found' });
                }
                ({ startDate, endDate } = getSprintDates(sprints, sprintId));
                const sortedSprints = sprints.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                const selectedSprintIndex = sortedSprints.findIndex((sprint) => sprint._id.toString() === sprintId.toString());
                lastSixSprintsIncludingSelected = sortedSprints.slice(Math.max(0, selectedSprintIndex - 5), selectedSprintIndex + 1);
            } else {
                const releaseData = releases.find((release) => release._id.equals(releaseId));
                if (!releaseData) {
                    return res.status(404).json({ error: 'Release data not found' });
                }
                ({ startDate, endDate } = getReleaseDates(releases, releaseId));
                const sortedReleases = releases.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                const selectedReleaseIndex = sortedReleases.findIndex((release) => release._id.toString() === releaseId.toString());
                lastSixReleasesIncludingSelected = sortedReleases.slice(Math.max(0, selectedReleaseIndex - 5), selectedReleaseIndex + 1);
            }

            const [closedMergeRequestsCount, closedMergeRequestsByCategory, closedMergeRequestsByDev] = await Promise.allSettled([
                ClosedMergeRequestService.getClosedMergeRequestsCount(mergeRequests, startDate, endDate),
                ClosedMergeRequestService.closedMergeRequestsByCategory(allMergeRequest, lastSixSprintsIncludingSelected, lastSixReleasesIncludingSelected, identifierType),
                ClosedMergeRequestService.getClosedMergeRequestsByDev(mergeRequests, startDate, endDate),
            ]);
            const result = {
                closedPullRequestsCount: closedMergeRequestsCount.status === 'fulfilled' ? closedMergeRequestsCount.value : 0,
                totalClosedPullRequestByDev:
                    closedMergeRequestsByDev.status === 'fulfilled'
                        ? closedMergeRequestsByDev.value.map((dev) => ({
                              name: dev.dev,
                              count: dev.count,
                          }))
                        : [],
                closedPullRequests:
                    closedMergeRequestsByCategory.status === 'fulfilled'
                        ? closedMergeRequestsByCategory.value.map((val) => ({
                              name: val.name,
                              count: parseFloat(val.count).toFixed(2),
                          }))
                        : [],
            };
            if (closedMergeRequestsByCategory.status === 'rejected') {
                console.error('Failed to Fetch Closed Merge Request By Category');
            }
            if (closedMergeRequestsByDev.status === 'rejected') {
                console.error('Failed to Fetch Closed Merge Request By Dev');
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

export default new ClosedMergeRequestController();
