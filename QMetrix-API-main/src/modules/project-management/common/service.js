import SyncJiraService from '../jira/services/syncJiraService';
import syncAzureBoardsService from '../azure-boards/services/syncAzureBoardsService';
import GithubIssuesService from '../github-issues/service';
import GitlabIssuesService from '../gitlab-management/services/gitlabIssuesService';
import { ConnectionModel } from '../../connection/model';
import {
    PROVIDER_NAME_JIRA,
    PROVIDER_NAME_AZURE_BOARDS,
    PROVIDER_NAME_AZUREBOARDS,
    PROVIDER_NAME_AZURE_BOARD,
    PROVIDER_NAME_GITHUB_ISSUES,
    PROVIDER_NAME_GITLAB_ISSUES,
} from '../../../utils/constants/providerConstants.js';

class SyncProjectManagementData {
    async syncProjectManagementData(companyId, tenantConnection, type, projectId) {
        try {
            const Connection = ConnectionModel(tenantConnection);
            const jiraCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_JIRA });
            let res = null;
            if (jiraCred) {
                res = await SyncJiraService.syncJira(companyId, tenantConnection, type, projectId);
            }

            const azureCred = await Connection.findOne({
                companyId,
                name: { $in: [PROVIDER_NAME_AZURE_BOARDS, PROVIDER_NAME_AZUREBOARDS, PROVIDER_NAME_AZURE_BOARD] },
            });
            if (azureCred) {
                console.log('Going to start Azure Boards Sync...');
                await syncAzureBoardsService.syncAzureBorads(companyId, tenantConnection, type, projectId);
            }

            const githubIssueCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITHUB_ISSUES });
            if (githubIssueCred) {
                await GithubIssuesService.syncGithubIssues(companyId, tenantConnection);
            }

            const gitlabIssueCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITLAB_ISSUES });
            if (gitlabIssueCred) {
                await GitlabIssuesService.syncGitLabIssues(companyId, tenantConnection, type, projectId);
            }
            return res;
        } catch (error) {
            console.error('Error Syncing Project Management Data..');
            throw error;
        }
    }
}

export default new SyncProjectManagementData();
