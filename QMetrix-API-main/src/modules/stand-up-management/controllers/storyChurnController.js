import { SprintModel, JiraReleaseModel } from '../../project-management/jira/model.js';
import { ConnectionModel } from '../../connection/model.js';
import { Types } from 'mongoose';
import storyChurnService from '../services/storyChurnService';
import { redis } from '../../../server.js';
import cache from '../../../utils/cache.js';
import {
    PROVIDER_NAME_JIRA,
    PROVIDER_NAME_AZURE_BOARDS,
    PROVIDER_NAME_GITLAB_ISSUES,
} from '../../../utils/constants/providerConstants.js';

class StoryChurnController {
    async storyChurn(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Sprint = SprintModel(tenantConnection);
            const Connection = ConnectionModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);

            const { companyId, projectId, boardId } = req.params;
            const { releaseId, sprintId, developer } = req.query;
            const standupPageRole = developer === 'null' || developer === undefined ? 'team' : developer;

            // Check connection type to determine if boardId is needed
            const cred = await Connection.findOne({ companyId, name: { $in: [PROVIDER_NAME_JIRA, PROVIDER_NAME_AZURE_BOARDS, PROVIDER_NAME_GITLAB_ISSUES] } });
            if (!cred) {
                return res.status(400).json({ error: 'Connection not found. Must be Jira, Azure Boards, or GitLab Issues.' });
            }

            // For GitLab Issues, boardId is not required
            const effectiveBoardId = cred?.name === PROVIDER_NAME_GITLAB_ISSUES ? null : boardId;
            if (!effectiveBoardId && cred?.name !== PROVIDER_NAME_GITLAB_ISSUES) {
                return res.status(400).json({ error: 'boardId is required for Jira and Azure Boards.' });
            }

            const cacheKey = cache.generateKey('storyChurn', {
                projectId,
                boardId: effectiveBoardId,
                companyId,
                sprintId,
                releaseId,
                developer: standupPageRole,
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

            let selectedType = null;
            if (sprintId) {
                const sprintQuery = { _id: new Types.ObjectId(sprintId), projectId, companyId };
                if (effectiveBoardId) {
                    sprintQuery.boardId = new Types.ObjectId(effectiveBoardId);
                }
                const sprintData = await Sprint.findOne(sprintQuery);
                if (!sprintData) {
                    return res.status(404).json({ error: 'Sprint not found.' });
                }
                selectedType = 'sprint';
            } else if (releaseId) {
                const releaseQuery = { _id: new Types.ObjectId(releaseId), projectId, companyId };
                if (effectiveBoardId) {
                    releaseQuery.boardId = new Types.ObjectId(effectiveBoardId);
                }
                const releaseData = await JiraRelease.findOne(releaseQuery);
                if (!releaseData) {
                    return res.status(404).json({ error: 'Release not found.' });
                }
                selectedType = 'release';
            } else {
                return res.status(400).json({ error: 'Either sprintId or releaseId must be provided.' });
            }
            const storyChurnResult = await storyChurnService.getStoryChurn(selectedType, sprintId, releaseId, projectId, effectiveBoardId, companyId, tenantConnection, standupPageRole);

            const result = { storyChurn: storyChurnResult };
            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 28000);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            return res.status(200).json(result);
        } catch (error) {
            console.error('StoryChurn controller error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async storyChurnExcludingBugs(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Sprint = SprintModel(tenantConnection);
            const Connection = ConnectionModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);

            const { companyId, projectId, boardId } = req.params;
            const { releaseId, sprintId, developer } = req.query;
            const standupPageRole = developer === 'null' || developer === undefined ? 'team' : developer;

            // Check connection type to determine if boardId is needed
            const cred = await Connection.findOne({ companyId, name: { $in: [PROVIDER_NAME_JIRA, PROVIDER_NAME_AZURE_BOARDS, PROVIDER_NAME_GITLAB_ISSUES] } });
            if (!cred) {
                return res.status(400).json({ error: 'Connection not found. Must be Jira, Azure Boards, or GitLab Issues.' });
            }

            // For GitLab Issues, boardId is not required
            const effectiveBoardId = cred?.name === PROVIDER_NAME_GITLAB_ISSUES ? null : boardId;
            if (!effectiveBoardId && cred?.name !== PROVIDER_NAME_GITLAB_ISSUES) {
                return res.status(400).json({ error: 'boardId is required for Jira and Azure Boards.' });
            }

            const cacheKey = cache.generateKey('storyChurnExcludingBugs', {
                projectId,
                boardId: effectiveBoardId,
                companyId,
                sprintId,
                releaseId,
                developer: standupPageRole,
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

            let selectedType = null;
            if (sprintId) {
                const sprintQuery = { _id: new Types.ObjectId(sprintId), projectId, companyId };
                if (effectiveBoardId) {
                    sprintQuery.boardId = new Types.ObjectId(effectiveBoardId);
                }
                const sprintData = await Sprint.findOne(sprintQuery);
                if (!sprintData) {
                    return res.status(404).json({ error: 'Sprint not found.' });
                }
                selectedType = 'sprint';
            } else if (releaseId) {
                const releaseQuery = { _id: new Types.ObjectId(releaseId), projectId, companyId };
                if (effectiveBoardId) {
                    releaseQuery.boardId = new Types.ObjectId(effectiveBoardId);
                }
                const releaseData = await JiraRelease.findOne(releaseQuery);
                if (!releaseData) {
                    return res.status(404).json({ error: 'Release not found.' });
                }
                selectedType = 'release';
            } else {
                return res.status(400).json({ error: 'Either sprintId or releaseId must be provided.' });
            }
            const storyChurnResult = await storyChurnService.getStoryChurnExcludingBugs(selectedType, sprintId, releaseId, projectId, effectiveBoardId, companyId, tenantConnection, standupPageRole);

            const result = { storyChurn: storyChurnResult };
            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 28000);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            return res.status(200).json(result);
        } catch (error) {
            console.error('StoryChurnExcludingBugs controller error:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

export default new StoryChurnController();
