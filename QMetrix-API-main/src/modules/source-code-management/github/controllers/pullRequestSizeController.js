import PullRequestSizeService from '../services/pullRequestSizeService';

class PullRequestSizeController {
    async getPRsSize(req, res) {
        try {
            const { tenantConnection } = req;
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId, developer } = req.query;
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
                developer,
                repo,
                tenantConnection,
            };
            const response = await PullRequestSizeService.getPullRequestSize(requestParams);
            res.status(200).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new PullRequestSizeController();
