import { Router } from 'express';
import tenantMiddleware from '../../../middleware/tenantMiddleware.js';
import GitLabIssuesController from './controller/gitlabIssuesController.js';
import ProjectDataController from '../jira/controllers/projectDataController.js';

class GitLabManagementRoutes {
    constructor() {
        this.router = Router();
        this.initializeRoutes();
    }

    initializeRoutes() {
        // Sync
        this.router.get('/syncGitLabIssues/:companyId', tenantMiddleware, GitLabIssuesController.syncGitLabIssues);
        
        // Project catalog
        this.router.get('/getProjectList/:companyId', tenantMiddleware, GitLabIssuesController.getProjectList);
        
        // Board/Milestone catalogs (reuse Jira controllers which query DB generically)
        this.router.get('/getBoardList/:companyId/:projectId', tenantMiddleware, ProjectDataController.getBoardList);
        this.router.get('/getSprintList/:companyId/:projectId/:boardId', tenantMiddleware, ProjectDataController.getSprintList);
    }
}

export default new GitLabManagementRoutes().router;
