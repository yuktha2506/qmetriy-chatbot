import SyncAzureBoardsService from '../services/syncAzureBoardsService.js';
import { ProjectModel, BoardModel } from '../../jira/model.js';

class SyncAzureBoardsController {
    async syncAzureBoards(req, res) {
        try {
            const { companyId } = req.params;
            const { type = 'light', projectId = null } = req.query || {};
            const tenantConnection = req.tenantConnection;
            const response = await SyncAzureBoardsService.syncAzureBorads(companyId, tenantConnection, type || 'light', projectId && projectId !== 'null' ? projectId : null);
            res.status(201).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getProjectList(req, res) {
        try {
            const { companyId } = req.params;
            const tenantConnection = req.tenantConnection;
            const Project = ProjectModel(tenantConnection);
            const projects = await Project.find({ companyId, projectTypeKey: 'azure-project' }, { name: 1, projectKeyId: 1, boardId: 1, boardType: 1, boards: 1 }).lean();
            res.status(200).json({ projects, total: projects.length });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getBoardList(req, res) {
        try {
            const { companyId, projectId } = req.params;
            const tenantConnection = req.tenantConnection;
            const Board = BoardModel(tenantConnection);
            const boards = await Board.find({ companyId, projectId }, { boardId: 1, boardName: 1, boardType: 1, boardLocation: 1 }).lean();
            res.status(200).json({ boards, total: boards.length });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new SyncAzureBoardsController();
