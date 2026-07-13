import { Router } from 'express';
import SyncGitLabController from './controllers/syncGitLabController.js';
import GitlabDataController from './controllers/gitlabDataController.js';
import ClosedMergeRequestController from './controllers/closedMergeRequestController.js';
import OpenMergeRequestController from './controllers/openMergeRequestController.js';
import MergedMRController from './controllers/mergedMRController.js';
import GitLabApprovalRateController from './controllers/gitlabApprovalRate.js';
import GitLabIterationTimeController from './controllers/gitlabIterationTime.js';
import MergeRequestSizeController from './controllers/mergeRequestSizeController.js';
import TotalMRController from './controllers/totalMRController.js';
import GitLabCycleTimeController from './controllers/gitlabCycleTime.js';
import tenantMiddleware from '../../../middleware/tenantMiddleware.js';
import UserMiddleware from '../../../middleware/user.js';

class GitLabRoutes {
    constructor() {
        this.router = Router();
        this.user = new UserMiddleware();
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/getAllGitLabRepo/:companyId/:projectId/:boardId', tenantMiddleware, GitlabDataController.getAllGitLabRepo);
        this.router.get('/syncGitLab/:companyId', tenantMiddleware, SyncGitLabController.syncGitLab);
        this.router.post('/getClosedMergeRequest/:companyId/:projectId/:boardId', tenantMiddleware, ClosedMergeRequestController.getClosedMergeRequests);
        this.router.post('/getOpenMergeRequest/:companyId/:projectId/:boardId', tenantMiddleware, OpenMergeRequestController.getOpenMergeRequest);
        this.router.post('/getMergedMRsWithoutReview/:companyId/:projectId/:boardId', tenantMiddleware, MergedMRController.getMergedMRsWithoutReview);
        this.router.post('/getMRsApprovalRate/:companyId/:projectId/:boardId', tenantMiddleware, GitLabApprovalRateController.getGitLabApprovalRate);
        this.router.post('/getMRsIterationTime/:companyId/:projectId/:boardId', tenantMiddleware, GitLabIterationTimeController.getMRsIterationTime);
        this.router.post('/getMRsSize/:companyId/:projectId/:boardId', tenantMiddleware, MergeRequestSizeController.getMRsSize);
        this.router.post('/getTotalMRs/:companyId/:projectId/:boardId', tenantMiddleware, TotalMRController.getTotalMRs);
        this.router.post('/getGitLabCycleTime/:companyId/:projectId/:boardId', tenantMiddleware, GitLabCycleTimeController.getGitLabCycleTime);
    }
}

export default new GitLabRoutes().router;
