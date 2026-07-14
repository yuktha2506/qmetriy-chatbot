/* eslint-disable indent */
import { PullRequestModel } from '../../github/model.js';
import { JiraReleaseModel, SprintModel, BoardModel } from '../../../project-management/jira/model.js';
import TotalMRService from '../services/totalMRService.js';
import { getSprintDates, getReleaseDates } from '../../common/scmHelper.js';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';
import { Types } from 'mongoose';

class TotalMRController {
    async getTotalMRs(req, res) {
        try {
            const { tenantConnection } = req;
            const { repo } = req.body;
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId } = req.query;

            const cacheKey = cache.generateKey('totalMRs', {
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
            let identifierType, startDate, endDate, lastSixSprintsIncludingSelected, lastSixReleasesIncludingSelected;
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
            const mergeRequests = await PullRequest.find(matchQuery);
            const releaseData = await JiraRelease.find({ companyId, projectId, status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] }, boardId: new Types.ObjectId(boardId) });
            const allMergeRequests = await PullRequest.find({ companyId, projectId, repo, boardId: new Types.ObjectId(boardId) });

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
                const selectedReleaseData = releaseData.find((release) => release._id.equals(releaseId));
                if (!selectedReleaseData) {
                    return res.status(404).json({ error: 'Release data not found' });
                }
                ({ startDate, endDate } = getReleaseDates(releaseData, releaseId));
                const sortedReleases = releaseData.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                const selectedReleaseIndex = sortedReleases.findIndex((release) => release._id.toString() === releaseId.toString());
                lastSixReleasesIncludingSelected = sortedReleases.slice(Math.max(0, selectedReleaseIndex - 5), selectedReleaseIndex + 1);
            }
            const [getTotalMergeRequestsCount, getTotalMergeRequestsPerSprintOrRelease, getTotalMergeRequestsByDev] = await Promise.allSettled([
                TotalMRService.getTotalMergeRequests(mergeRequests, startDate, endDate),
                TotalMRService.getTotalMergeRequestsPerSprintOrRelease(allMergeRequests, lastSixSprintsIncludingSelected, lastSixReleasesIncludingSelected, identifierType),
                TotalMRService.getTotalMergeRequestsByDev(mergeRequests, startDate, endDate),
            ]);
            const result = {
                getTotalPullRequests: getTotalMergeRequestsCount.status === 'fulfilled' ? getTotalMergeRequestsCount.value : 0,
                getTotalPullRequestsByDev: [],
                totalPullRequests: [],
            };

            if (getTotalMergeRequestsPerSprintOrRelease.status === 'fulfilled') {
                result.totalPullRequests = getTotalMergeRequestsPerSprintOrRelease.value.map((item) => ({
                    name: item.name,
                    count: Number(item.count).toFixed(2),
                }));
            }

            if (getTotalMergeRequestsByDev.status === 'fulfilled') {
                result.getTotalPullRequestsByDev = getTotalMergeRequestsByDev.value.map((dev) => ({
                    name: dev.dev,
                    count: Number(dev.count).toFixed(2),
                }));
            }
            if (getTotalMergeRequestsPerSprintOrRelease.status === 'rejected') {
                console.error('Failed to Fetch Open MR By Release');
            }
            if (getTotalMergeRequestsByDev.status === 'rejected') {
                console.error('Failed to Fetch open MR By Dev');
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

export default new TotalMRController();
