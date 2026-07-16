import { Router } from 'express';
import tenantMiddleware from '../../middleware/tenantMiddleware.js';
import UserMiddleware from '../../middleware/user.js';
import JiraTableController from './controllers/jiraTable.js';
import StoryChurnController from './controllers/storyChurnController.js';
import JiraStatusByDevController from './controllers/jiraStatusByDev.js';
import standupBurndown from './controllers/standupBurndown.js';
import QAInsightsController from './controllers/qaInsightsController.js';
import QARefrenceController from './controllers/qARefrenceController.js';

class standUpRoutes {
    constructor() {
        this.router = Router();
        this.user = new UserMiddleware();
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/jiraData/:companyId/:projectId/:boardId', tenantMiddleware, JiraTableController.jiraData);
        this.router.get('/getStoryChurn/:companyId/:projectId/:boardId?', tenantMiddleware, StoryChurnController.storyChurn);
        this.router.get('/getStoryChurnExcludingBugs/:companyId/:projectId/:boardId?', tenantMiddleware, StoryChurnController.storyChurnExcludingBugs);
        this.router.get('/jira-status-by-dev/:companyId/:projectId/:boardId', tenantMiddleware, JiraStatusByDevController.getJiraStatusByDev);
        this.router.get('/getStandupBurndown/:companyId/:projectId/:boardId', tenantMiddleware, standupBurndown.getStandupBurndown);
        this.router.get('/qa-insights/bugs/:companyId/:projectId/:boardId', tenantMiddleware, QAInsightsController.getBugs);
        this.router.get('/qa-insights/tests/:companyId/:projectId/:boardId', tenantMiddleware, QAInsightsController.getTests);
        this.router.get('/getQARefrence/:companyId/:projectId/:boardId', tenantMiddleware, QARefrenceController.getQARefrence);
    }
}

export default new standUpRoutes().router;
