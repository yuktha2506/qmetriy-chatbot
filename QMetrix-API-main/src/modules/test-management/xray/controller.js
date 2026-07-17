import XrayService from './service.js';

class XrayController {
    async sync(req, res) {
        const { companyId } = req.params;
        const { projectKey, syncType } = req.query;
        const { tenantConnection } = req;
        try {
            if (!projectKey) {
                return res.status(400).json({ success: false, error: 'projectKey is required' });
            }
            const result = await XrayService.syncXrayCloud(companyId, tenantConnection, projectKey, syncType || 'hard');
            return res.status(200).json({ success: true, ...result });
        } catch (e) {
            console.error('[Xray Sync] Error:', e.message);
            return res.status(500).json({ success: false, error: e.message });
        }
    }
}

export default new XrayController();
