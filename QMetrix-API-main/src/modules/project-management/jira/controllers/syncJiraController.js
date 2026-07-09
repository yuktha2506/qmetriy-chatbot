import SyncJiraService from '../services/syncJiraService';
import { ConnectionModel } from '../../../connection/model.js';
import { cryptoHandler } from '../../../../utils/commonFunctions.js';
import { SprintModel, BoardModel } from '../model.js';
import { ProjectModel } from '../model.js';
import { Types } from 'mongoose';
import { PROVIDER_NAME_JIRA } from '../../../../utils/constants/providerConstants.js';
import { STATUS_CLOSED } from '../../../../utils/constants/statusConstants.js';

class SyncJiraController {
    async syncJira(req, res) {
        try {
            const { companyId } = req.params;
            const tenantConnection = req.tenantConnection;
            const response = await SyncJiraService.syncJira(companyId, tenantConnection);
            res.status(201).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getLastSynced(req, res) {
        try {
            const { companyId, projectId } = req.params;
            const tenantConnection = req.tenantConnection;

            if (projectId) {
                const Project = ProjectModel(tenantConnection);
                const project = await Project.findOne(
                    {
                        _id: projectId,
                        companyId: companyId,
                    },
                    {
                        _id: 1,
                        name: 1,
                        lastSynced: 1,
                        syncStatus: 1,
                    }
                );

                if (!project) {
                    return res.status(404).json({
                        error: 'Project not found',
                        lastSynced: null,
                        syncStatus: false,
                    });
                }

                return res.status(200).json({
                    lastSynced: project.lastSynced,
                    syncStatus: project.syncStatus,
                    projectId: projectId,
                    projectName: project.name,
                });
            } else {
                const { ProjectModel } = await import('../model.js');
                const Project = ProjectModel(tenantConnection);
                const projects = await Project.find(
                    {
                        companyId: companyId,
                        isSelected: true,
                    },
                    {
                        _id: 1,
                        name: 1,
                        lastSynced: 1,
                        syncStatus: 1,
                    }
                );

                const projectSyncData = projects.map((project) => ({
                    projectId: project._id,
                    projectName: project.name,
                    lastSynced: project.lastSynced,
                    syncStatus: project.syncStatus,
                }));

                return res.status(200).json({
                    projects: projectSyncData,
                    totalProjects: projects.length,
                });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getBoardProjectList(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Connection = ConnectionModel(tenantConnection);
            const { companyId } = req.params;
            const cred = await Connection.findOne({ companyId: companyId, name: PROVIDER_NAME_JIRA });
            if (!cred) {
                return res.status(404).json({ error: 'Jira credentials not found.' });
            }
            const decryptedPassword = cryptoHandler(cred.password, 'decrypt');
            const jiraConfig = { host: cred.host, username: cred.username, password: decryptedPassword };
            const response = await SyncJiraService.boardProjects(jiraConfig, companyId, tenantConnection);
            res.status(200).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getBoardIssues(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Connection = ConnectionModel(tenantConnection);
            const { companyId } = req.params;
            const cred = await Connection.findOne({ companyId: companyId, name: PROVIDER_NAME_JIRA });
            if (!cred) {
                return res.status(404).json({ error: 'Jira credentials not found' });
            }
            const decryptedPassword = cryptoHandler(cred.password, 'decrypt');
            const jiraConfig = { host: cred.host, username: cred.username, password: decryptedPassword };
            const response = await SyncJiraService.boardIssues(jiraConfig, companyId, tenantConnection);
            res.status(200).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // async syncPlannedAndReleaseData(req, res) {
    //     try {
    //         const { tenantConnection } = req;
    //         const { companyId } = req.params;
    //         const result = await SyncJiraService.syncPlannedAndReleaseData(tenantConnection, companyId);
    //         return res.status(200).json({ ...result });
    //     } catch (error) {
    //         console.error(error);
    //         return res.status(500).json({ error: error.message });
    //     }
    // }
    async getSprintCompleteDate(req, res) {
        try {
            const { companyId, projectId, boardId, sprintId } = req.params;
            const tenantConnection = req.tenantConnection;

            if (!tenantConnection) {
                return res.status(400).json({ error: 'Missing tenant connection' });
            }

            const Sprint = SprintModel(tenantConnection);
            const Board = BoardModel(tenantConnection);

            // Validate board exists
            const board = await Board.findOne(
                {
                    _id: new Types.ObjectId(boardId),
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                },
                { boardType: 1 }
            );

            if (!board) {
                return res.status(404).json({ error: 'Board not found.' });
            }

            const sprint = await Sprint.findOne(
                {
                    _id: new Types.ObjectId(sprintId),
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                    boardId: new Types.ObjectId(boardId),
                    state: STATUS_CLOSED,
                },
                {
                    name: 1,
                    completeDate: 1,
                }
            );

            if (!sprint) {
                return res.status(404).json({ error: '' });
            }

            return res.status(200).json(sprint);
        } catch (error) {
            console.error('Error in getSprintCompleteDate:', error);
            res.status(500).json({ error: 'Failed to fetch sprint completeDate' });
        }
    }
}

export default new SyncJiraController();
