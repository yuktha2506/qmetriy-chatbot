import UpdateSelectedAndHideProjectService from '../services/updateSelectedAndHideProjectService';

class UpdateSelectedAndHideProjectController {
    async updateSelectedProject(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const data = req.body;
            const { companyId } = req.params;
            const response = await UpdateSelectedAndHideProjectService.updateSelectedProject(tenantConnection, companyId, data);
            res.status(201).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateHideProject(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const data = req.body;
            const { companyId } = req.params;
            const response = await UpdateSelectedAndHideProjectService.updateHideProject(tenantConnection, companyId, data);
            res.status(201).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
export default new UpdateSelectedAndHideProjectController();
