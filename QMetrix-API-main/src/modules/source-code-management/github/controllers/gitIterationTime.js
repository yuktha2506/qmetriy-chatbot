import GitIterationTimeService from '../services/gitIterationTimeService';

class GitIterationTimeController {
    async getPRsIterationTime(req, res) {
        try {
            const { tenantConnection } = req;
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId } = req.query;
            const { repo } = req.body;
            if (!repo || !companyId || !projectId) {
                return res.status(400).json({ error: 'Missing required parameters' });
            }
            const response = await GitIterationTimeService.getAveragePRIterationTime(companyId, projectId, boardId, sprintId, releaseId, repo, tenantConnection);
            res.status(200).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new GitIterationTimeController();
