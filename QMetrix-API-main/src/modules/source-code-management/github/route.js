import { Router } from 'express';
import ClosedPRController from './controllers/closedPRController.js';
import GithubDataController from './controllers/githubDataController.js';
import MergedPRController from './controllers/mergedPRController.js';
import OpenPRController from './controllers/openPRController.js';
import PullRequestSizeController from './controllers/pullRequestSizeController.js';
import TotalPRController from './controllers/totalPRController.js';
import UserMiddleware from '../../../middleware/user.js';
import GitCycleTimeController from './controllers/gitCycleTime.js';
import GitApprovalRateController from './controllers/gitApprovalRate.js';
import leadTimeController from './controllers/leadTimeController.js';
import GitIterationTimeController from './controllers/gitIterationTime.js';
import tenantMiddleware from '../../../middleware/tenantMiddleware.js';
import doraMetricController from './controllers/doraMetricController.js';

class GithubRoutes {
    constructor() {
        this.router = Router();
        this.user = new UserMiddleware();
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/getAllRepo/:companyId/:projectId/:boardId', tenantMiddleware, GithubDataController.getAllRepo);
        this.router.get('/getData/:companyId', tenantMiddleware, GithubDataController.getGithubDetails);
        this.router.post('/getClosedPRs/:companyId/:projectId/:boardId', tenantMiddleware, ClosedPRController.getClosedPRs);
        this.router.post('/getMergedPRsWithoutReview/:companyId/:projectId/:boardId', tenantMiddleware, MergedPRController.getMergedPRsWithoutReview);
        this.router.post('/getOpenPRs/:companyId/:projectId/:boardId', tenantMiddleware, OpenPRController.getOpenPRs);
        this.router.post('/getTotalPRs/:companyId/:projectId/:boardId', tenantMiddleware, TotalPRController.getTotalPRs);
        this.router.post('/getPRsSize/:companyId/:projectId/:boardId', tenantMiddleware, PullRequestSizeController.getPRsSize);
        this.router.post('/getGitCycleTime/:companyId/:projectId/:boardId', tenantMiddleware, GitCycleTimeController.getGitCycleTime);
        this.router.post('/getLeadTime/:companyId/:projectId/:boardId', tenantMiddleware, leadTimeController.getLeadTimeForChanges);
        this.router.post('/getApprovalRate/:companyId/:projectId/:boardId', tenantMiddleware, GitApprovalRateController.getApprovalRate);
        this.router.post('/getPRsIterationTime/:companyId/:projectId/:boardId', tenantMiddleware, GitIterationTimeController.getPRsIterationTime);
        this.router.get('/addDoraMetrics/:companyId', tenantMiddleware, doraMetricController.addDoraMetrics);
        this.router.get('/getDoraMetrics/:companyId/:projectId/:boardId', tenantMiddleware, doraMetricController.getDoraMetrics);
    }
}

export default new GithubRoutes().router;
