import SyncGithubService from '../github/services/syncGithubService';
import GitLabService from '../gitlab/services/syncGitlabService';
import { ConnectionModel } from '../../connection/model';
import syncAzureDevopsService from '../azureDevops/services/syncAzureDevopsService';
import syncBitbucketService from '../bitbucket/services/syncBitbucketService';
import {
    PROVIDER_NAME_GITHUB,
    PROVIDER_NAME_GITLAB,
    PROVIDER_NAME_BITBUCKET,
    PROVIDER_NAME_ADO,
} from '../../../utils/constants/providerConstants.js';

class SourceCodeManagementService {
    async syncSourceCodeManagementData(companyId, tenantConnection, changedType, projectId) {
        try {
            const Connection = ConnectionModel(tenantConnection);
            let res = null;
            const githubCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITHUB });
            if (githubCred) {
                res = await SyncGithubService.syncGithub(companyId, tenantConnection, changedType, projectId);
            }

            const gitlabCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITLAB });
            if (gitlabCred) {
                await GitLabService.syncGitLab(companyId, tenantConnection, changedType, projectId);
            }

            const bitbucketCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_BITBUCKET });
            if (bitbucketCred) {
                console.log('[SCM] Invoking Bitbucket sync', { companyId, projectId, changedType });
                await syncBitbucketService.syncBitbucket(companyId, tenantConnection, changedType, projectId);
                console.log('[SCM] Completed Bitbucket sync');
            }

            const azureDevOpsCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_ADO });
            if (azureDevOpsCred) {
                await syncAzureDevopsService.syncAzureDevOps(companyId, tenantConnection, changedType, projectId);
            }
            return res;
        } catch (error) {
            console.error('Error syncing source code management data:', error.message);
            throw error;
        }
    }
}

export default new SourceCodeManagementService();
