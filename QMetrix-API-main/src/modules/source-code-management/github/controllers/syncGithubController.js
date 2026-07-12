import { ConnectionModel } from '../../../connection/model.js';
import SyncGithubService from '../services/syncGithubService.js';
import { cryptoHandler } from '../../../../utils/commonFunctions.js';
import { PROVIDER_NAME_GITHUB } from '../../../../utils/constants/providerConstants.js';

class SyncGithubController {
    async syncGithub(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Connection = ConnectionModel(tenantConnection);
            const companyId = req.params.companyId;
            const cred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITHUB });
            if (!cred) {
                return res.status(404).json({ error: 'Github credentials not found' });
            }
            const decryptedPassword = cryptoHandler(cred.password, 'decrypt');
            const githubConfig = { host: cred.host, username: cred.username, password: decryptedPassword };
            const response = await SyncGithubService.syncGithub(githubConfig, companyId, tenantConnection);
            res.status(201).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new SyncGithubController();
