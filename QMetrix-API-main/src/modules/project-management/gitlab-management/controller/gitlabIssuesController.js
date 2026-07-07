import { ProjectModel } from '../../jira/model.js';
import GitLabIssuesService from '../services/gitlabIssuesService.js';

class GitLabIssuesController {
    async syncGitLabIssues(req, res) {
        try {
            const { companyId } = req.params;
            const { type = 'light', projectId = null } = req.query || {};
            const tenantConnection = req.tenantConnection;
            const response = await GitLabIssuesService.syncGitLabIssues(companyId, tenantConnection, type || 'light', projectId && projectId !== 'null' ? projectId : null);
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
            const projects = await Project.find(
                { companyId, projectTypeKey: 'gitlab-project' },
                { name: 1, projectKeyId: 1, boardId: 1, boardType: 1, boards: 1, key: 1, self: 1 }
            ).lean();
            res.status(200).json({ projects, total: projects.length });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new GitLabIssuesController();
