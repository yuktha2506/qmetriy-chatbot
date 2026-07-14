import GitLabCycleTimeService from '../services/gitlabCycleTimeService';

class GitLabCycleTimeController {
    async getGitLabCycleTime(req, res) {
        try {
            const { tenantConnection } = req;
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId } = req.query;
            const { repo } = req.body;
            if (!repo || !companyId || !projectId) {
                return res.status(400).json({ error: 'Missing required parameters' });
            }
            const requestParams = {
                companyId,
                projectId,
                boardId,
                sprintId,
                releaseId,
                repo,
                tenantConnection,
            };
            const response = await GitLabCycleTimeService.getGitLabCycleTime(requestParams);
            res.status(200).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new GitLabCycleTimeController();
