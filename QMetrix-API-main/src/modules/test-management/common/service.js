import TestRailService from '../testrail/service';
import XrayService from '../xray/service.js';
import { ConnectionModel } from '../../connection/model';
import { ProjectModel } from '../../project-management/jira/model.js';

class TestManagementService {
    async syncTestManagementData(companyId, tenantConnection, projectId, syncType = 'hard') {
        try {
            const Connection = ConnectionModel(tenantConnection);

            const testRailCred = await Connection.findOne({ companyId, name: 'Testrail' });
            if (testRailCred) {
                await TestRailService.syncTestRail(companyId, tenantConnection, projectId, syncType);
                return { success: true, message: 'TestRail sync completed successfully.' };
            }

            const xrayCred = await Connection.findOne({ companyId, name: { $in: ['Xray Cloud'] } });
            if (xrayCred) {
                let projectKey = projectId;
                if (/^[0-9a-fA-F]{24}$/.test(String(projectId))) {
                    const Project = ProjectModel(tenantConnection);
                    const proj = await Project.findOne({ companyId, _id: projectId }, { key: 1 }).lean();
                    if (proj?.key) {
                        projectKey = proj.key;
                    }
                }
                await XrayService.syncXrayCloud(companyId, tenantConnection, projectKey, syncType);
                return { success: true, message: 'Xray sync completed successfully.' };
            }

            return { success: false, message: 'No TestRail or Xray credentials found.' };
        } catch (error) {
            console.error('Error during Test Management sync:', error.message);
            return { success: false, message: 'Test Management sync failed.', error: error.message };
        }
    }
}

export default new TestManagementService();
