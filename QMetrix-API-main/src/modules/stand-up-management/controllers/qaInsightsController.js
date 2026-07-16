import qaInsightsService from '../services/qaInsightsService';

class QAInsights {
    async getBugs(req, res) {
        try {
            const { projectId, companyId, boardId } = req.params;
            const { sprintId, releaseId, developer: dev } = req.query;
            const tenantConnection = req.tenantConnection;

            const developer = (dev === 'UnAssigned' || dev === 'Unassigned') ? null : dev;

            const result = await qaInsightsService.getBugs(
                projectId,
                companyId,
                boardId,
                sprintId,
                releaseId,
                developer,
                tenantConnection
            );

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error fetching bugs:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    async getTests(req, res) {
        try {
            const { projectId, companyId, boardId } = req.params;
            const { sprintId, releaseId } = req.query;
            const tenantConnection = req.tenantConnection;

            const result = await qaInsightsService.getTests(
                projectId,
                companyId,
                boardId,
                sprintId,
                releaseId,
                tenantConnection
            );

            return res.status(200).json(result);
        } catch (error) {
            console.error('Error fetching tests:', error);
            return res.status(500).json({ error: error.message });
        }
    }
}

export default new QAInsights();
