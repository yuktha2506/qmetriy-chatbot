import custumFieldServices from '../services/custumFieldServices.js';
import { ConnectionModel } from '../../../connection/model.js';
import { cryptoHandler } from '../../../../utils/commonFunctions.js';
import { PROVIDER_NAME_JIRA } from '../../../../utils/constants/providerConstants.js';

class custumFieldController {

    async addNewFeature(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Connection = ConnectionModel(tenantConnection);
            const { companyId, projectId } = req.params;
            const cred = await Connection.findOne({ companyId: companyId, name: PROVIDER_NAME_JIRA });
            if (!cred) {
                return { error: 'Jira connection not found for this company.' };
            }
            const decryptedPassword = cryptoHandler(cred.password, 'decrypt');
            const jiraConfig = { host: cred.host, username: cred.username, password: decryptedPassword };
            const response = await custumFieldServices.addNewFeature(jiraConfig, companyId, projectId, tenantConnection);
            res.status(200).json({ success: true, message: 'Sprint issues added successfully', data: response });
        } catch (error) {
            console.error('Error adding sprint issues:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

export default new custumFieldController();
