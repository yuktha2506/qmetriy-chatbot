import { Router } from 'express';
import tenantMiddleware from '../../../middleware/tenantMiddleware.js';
import SyncAzureBoardsController from './controllers/syncAzureBoardsController.js';
// Reuse existing Jira DB-read controllers (they query generic models)
import BugClassificationController from '../jira/controllers/bugClassificationController.js';
import CapacityPlanningController from '../jira/controllers/capacityPlanningController.js';
import CycleMetricsController from '../jira/controllers/cycleMetricsController.js';
import DefectDensityController from '../jira/controllers/defectDensityController.js';
import IssueTypeController from '../jira/controllers/issueTypeController.js';
import ProjectDataController from '../jira/controllers/projectDataController.js';
import StoryPointsCompletedController from '../jira/controllers/storyPointsCompletedController.js';
import VelocityController from '../jira/controllers/velocityController.js';
import DefectRejectionRatioController from '../jira/controllers/defectRejectionRatioController.js';
import BurnDownChartController from '../jira/controllers/burndownChart.js';
import TimeToFixController from '../jira/controllers/timeToFixController.js';
import DefectRemovalEfficiencyController from '../jira/controllers/defectRemovalEfficiencyController.js';
import costOfFixingController from '../jira/controllers/costOfFixingController.js';
import BurnupChartController from '../jira/controllers/burnupChartController.js';

class AzureBoardsRoutes {
    constructor() {
        this.router = Router();
        this.initializeRoutes();
    }

    initializeRoutes() {
        // Sync
        this.router.get('/syncAzureBoards/:companyId', tenantMiddleware, SyncAzureBoardsController.syncAzureBoards);

        // Project/Board/Sprint catalogs (reuse Jira controllers which query DB generically)
        this.router.get('/getProjectList/:companyId', tenantMiddleware, ProjectDataController.getProjectList);
        this.router.get('/getBoardList/:companyId/:projectId', tenantMiddleware, ProjectDataController.getBoardList);
        this.router.get('/getSprintList/:companyId/:projectId/:boardId', tenantMiddleware, ProjectDataController.getSprintList);

        // Metrics (read-only; rely on generic models)
        this.router.get('/getVelocity/:companyId/:projectId/:boardId', tenantMiddleware, VelocityController.getVelocity);
        this.router.get('/getCycleTime/:companyId/:projectId/:boardId', tenantMiddleware, CycleMetricsController.cycleMetricsAnalysis);
        this.router.get('/getIssueType/:companyId/:projectId/:boardId', tenantMiddleware, IssueTypeController.getIssueType);
        this.router.get('/getStatusCount/:companyId/:projectId/:boardId', tenantMiddleware, ProjectDataController.getStatusCount);
        this.router.get('/getTaskCount/:companyId/:projectId/:boardId', tenantMiddleware, ProjectDataController.getTaskCount);
        this.router.get('/getDefectDensity/:companyId/:projectId/:boardId', tenantMiddleware, DefectDensityController.defectDensity);
        this.router.get('/getDefectRejection/:companyId/:projectId/:boardId', tenantMiddleware, DefectRejectionRatioController.defectRejection);
        this.router.get('/getDefectRemovalEfficiency/:companyId/:projectId/:boardId', tenantMiddleware, DefectRemovalEfficiencyController.defectRemovalEfficiency);
        this.router.get('/getTimeToFix/:companyId/:projectId/:boardId', tenantMiddleware, TimeToFixController.TimeToFix);
        this.router.get('/costOfFixingDefects/:companyId/:projectId/:boardId', tenantMiddleware, costOfFixingController.costOfFixingBug);

        // Burn (iteration) metrics
        this.router.get('/getSprintStoryPoints/:companyId/:projectId/:boardId', tenantMiddleware, BurnDownChartController.getSprintStoryPoints);
        this.router.get('/getSPCommittedVsCompleted/:companyId/:projectId/:boardId', tenantMiddleware, StoryPointsCompletedController.getSPCommittedVsCompleted);
        this.router.get('/getStoryPointData/:companyId/:projectId/:boardId', tenantMiddleware, StoryPointsCompletedController.getStoryPointData);
        this.router.get('/getDailyBurnup/:companyId/:projectId/:boardId', tenantMiddleware, BurnupChartController.getDailyBurnup);

        // Classification
        this.router.get('/getBugClassification/:companyId/:projectId/:boardId', tenantMiddleware, BugClassificationController.bugClassification);

        // Capacity planning
        this.router.post('/addCapacity/:companyId', tenantMiddleware, CapacityPlanningController.addCapacity);
        this.router.post('/addRoleRates/:companyId', tenantMiddleware, CapacityPlanningController.addRoleRates);
        this.router.post('/addStoryPoints/:companyId', tenantMiddleware, CapacityPlanningController.addStoryPoints);
        this.router.get('/getRoleRatesAndStoryPoints/:companyId', tenantMiddleware, CapacityPlanningController.getRoleRatesAndStoryPoints);
    }
}

export default new AzureBoardsRoutes().router;
