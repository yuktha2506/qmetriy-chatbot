import TestRailService from './service.js';
import { ConnectionModel } from '../../connection/model.js';
import { cryptoHandler } from '../../../utils/commonFunctions.js';

class TestRailController {
    async fetchTestRailData(req, res) {
        const companyId = req.params.companyId;
        const { projectId } = req.query;
        const tenantConnection = req.tenantConnection;

        try {
            if (!projectId) {
                return res.status(400).json({
                    success: false,
                    error: 'Project ID is required',
                });
            }

            const Connection = ConnectionModel(tenantConnection);
            const cred = await Connection.findOne({ companyId, name: 'Testrail' });
            if (!cred) {
                console.error('TestRail credentials not found');
                return res.status(404).json({
                    success: false,
                    error: 'TestRail credentials not found',
                });
            }
            // Full sync including projects, milestones (with test case metrics), and runs
            await TestRailService.syncTestRail(companyId, tenantConnection, projectId);

            res.status(200).json({
                success: true,
                message: 'TestRail data synced successfully',
                companyId,
            });
        } catch (error) {
            console.error('Error updating TestRail projects:', error);
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    async fetchTestRailRuns(req, res) {
        const { companyId, projectId } = req.params;
        const { tenantConnection } = req;

        try {
            const Connection = ConnectionModel(tenantConnection);
            const cred = await Connection.findOne({
                companyId: companyId,
                name: 'Testrail',
            });
            if (!cred) {
                console.error('TestRail credentials not found for the company.');
                return res.status(404).json({ error: 'TestRail credentials not found' });
            }
            const decryptedPassword = cryptoHandler(cred.password, 'decrypt');
            const testrailConfig = { host: cred.host, username: cred.username, password: decryptedPassword };
            if (!projectId) {
                console.error('Project ID is required but not provided.');
                return res.status(400).json({ error: 'Project ID is required but not provided' });
            }
            const runsResponse = testrailConfig.host && projectId ? await TestRailService.fetchRuns(testrailConfig, projectId) : [];

            const runs = Array.isArray(runsResponse)
                ? runsResponse.map((run) => ({
                    companyId: companyId,
                    runId: run.id,
                    suiteId: run.suite_id,
                    name: run.name,
                    description: run.description || 'No description provided',
                    isCompleted: run.is_completed,
                    passedCount: run.passed_count,
                    failedCount: run.failed_count,
                    untestedCount: run.untested_count,
                    retestCount: run.retest_count,
                    projectId: run.project_id,
                    url: run.url,
                }))
                : [];
            res.status(200).json(runs);
        } catch (error) {
            console.error('Error fetching runs:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async fetchTestRailUsers(req, res) {
        const { companyId } = req.params;
        const { tenantConnection } = req;

        try {
            const Connection = ConnectionModel(tenantConnection);
            const cred = await Connection.findOne({
                companyId: companyId,
                name: 'Testrail',
            });

            if (!cred) {
                console.error('TestRail credentials not found for the company.');
                return res.status(404).json({ error: 'TestRail credentials not found' });
            }

            const decryptedPassword = cryptoHandler(cred.password, 'decrypt');
            const testrailConfig = {
                host: cred.host,
                username: cred.username,
                password: decryptedPassword,
            };

            const users = await TestRailService.fetchUsers(testrailConfig);

            const formattedUsers = users.map((user) => ({
                id: user.id,
                name: user.name,
                email: user.email,
                isActive: user.is_active,
                role: user.role,
                roleId: user.role_id,
                groupIds: user.group_ids,
            }));

            res.status(200).json(formattedUsers);
        } catch (error) {
            console.error('Error fetching TestRail users:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

export default new TestRailController();
