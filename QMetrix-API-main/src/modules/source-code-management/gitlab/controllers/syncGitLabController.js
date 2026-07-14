import { ConnectionModel } from '../../../connection/model.js';
import SyncGitLabService from '../services/syncGitlabService.js';
import { cryptoHandler } from '../../../../utils/commonFunctions.js';
import { PROVIDER_NAME_GITLAB } from '../../../../utils/constants/providerConstants.js';

class SyncGitLabController {
    async syncGitLab(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Connection = ConnectionModel(tenantConnection);
            const companyId = req.params.companyId;
            const cred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITLAB });
            if (!cred) {
                return res.status(404).json({ error: 'GitLab credentials not found' });
            }
            const decryptedPassword = cryptoHandler(cred.password, 'decrypt');
            const gitLabConfig = { host: cred.host, username: cred.username, password: decryptedPassword };
            const response = await SyncGitLabService.syncGitLab(gitLabConfig, companyId, tenantConnection);
            res.status(201).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new SyncGitLabController();
