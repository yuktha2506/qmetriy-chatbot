import { Router } from 'express';
import BugClassificationController from './controllers/bugClassificationController.js';
import CapacityPlanningController from './controllers/capacityPlanningController.js';
import CycleMetricsController from './controllers/cycleMetricsController.js';
import DefectDensityController from './controllers/defectDensityController.js';
import IssueTypeController from './controllers/issueTypeController.js';
import ProjectDataController from './controllers/projectDataController.js';
import StoryPointsCompletedController from './controllers/storyPointsCompletedController.js';
import SyncJiraController from './controllers/syncJiraController.js';
import VelocityController from './controllers/velocityController.js';
import UserMiddleware from '../../../middleware/user.js';
import DefectRejectionRatioController from '../jira/controllers/defectRejectionRatioController.js';
import tenantMiddleware from '../../../middleware/tenantMiddleware.js';
import BurnDownChartController from './controllers/burndownChart.js';
import TimeToFixController from './controllers/timeToFixController.js';
import DefectRemovalEfficiencyController from './controllers/defectRemovalEfficiencyController.js';
import costOfFixingController from './controllers/costOfFixingController.js';
import BurnupChartController from './controllers/burnupChartController.js';
import UpdateSelectedAndHideProjectController from './controllers/updateSelectedAndHideProjectController.js';
import BurndownVelocityController from './controllers/burndownVelocityController.js';

class JiraRoutes {
    constructor() {
        this.router = Router();
        this.user = new UserMiddleware();
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/syncJira/:companyId', tenantMiddleware, SyncJiraController.syncJira);
        this.router.get('/getSyncStatus/:companyId', tenantMiddleware, SyncJiraController.syncJira);
        this.router.get('/getProjectList/:companyId', tenantMiddleware, ProjectDataController.getProjectList);
        this.router.get('/getSprintList/:companyId/:projectId/:boardId', tenantMiddleware, ProjectDataController.getSprintList);
        this.router.get('/getBoardList/:companyId/:projectId', tenantMiddleware, ProjectDataController.getBoardList);
        this.router.get('/getReleases/:companyId/:projectId/:boardId', tenantMiddleware, ProjectDataController.getReleases);
        this.router.get('/getTaskCount/:companyId/:projectId/:boardId', tenantMiddleware, ProjectDataController.getTaskCount);
        this.router.get('/getStatusCount/:companyId/:projectId/:boardId', tenantMiddleware, ProjectDataController.getStatusCount);
        this.router.get('/getIssueCount/:companyId/:projectId/:boardId', tenantMiddleware, ProjectDataController.getIssueCount);
        this.router.get('/getDefectLeakageAnalysis/:companyId/:projectId/:boardId', tenantMiddleware, ProjectDataController.getDefectLeakageAnalysis);
        this.router.get('/getSPCommittedVsCompleted/:companyId/:projectId/:boardId', tenantMiddleware, StoryPointsCompletedController.getSPCommittedVsCompleted);
        this.router.get('/getVelocity/:companyId/:projectId/:boardId', tenantMiddleware, VelocityController.getVelocity);
        this.router.get('/getIssueType/:companyId/:projectId/:boardId', tenantMiddleware, IssueTypeController.getIssueType);
        this.router.get('/getCycleTime/:companyId/:projectId/:boardId', tenantMiddleware, CycleMetricsController.cycleMetricsAnalysis);
        this.router.get('/getLastSynced/:companyId/:projectId', tenantMiddleware, SyncJiraController.getLastSynced);
        this.router.post('/addCapacity/:companyId', tenantMiddleware, CapacityPlanningController.addCapacity);
        this.router.get('/getCapacityAssigneeModalData/:companyId', tenantMiddleware, CapacityPlanningController.getCapacityAssigneeModalData);
        this.router.post('/addRoleRates/:companyId', tenantMiddleware, CapacityPlanningController.addRoleRates);
        this.router.post('/addStoryPoints/:companyId', tenantMiddleware, CapacityPlanningController.addStoryPoints);
        this.router.get('/getRoleRatesAndStoryPoints/:companyId', tenantMiddleware, CapacityPlanningController.getRoleRatesAndStoryPoints);
        this.router.get('/getBugClassification/:companyId/:projectId/:boardId', tenantMiddleware, BugClassificationController.bugClassification);
        this.router.get('/getDefectDensity/:companyId/:projectId/:boardId', tenantMiddleware, DefectDensityController.defectDensity);
        this.router.get('/getDefectRejection/:companyId/:projectId/:boardId', tenantMiddleware, DefectRejectionRatioController.defectRejection);
        this.router.get('/getSprintStoryPoints/:companyId/:projectId/:boardId', tenantMiddleware, BurnDownChartController.getSprintStoryPoints);
        this.router.get('/getDefectRemovalEfficiency/:companyId/:projectId/:boardId', tenantMiddleware, DefectRemovalEfficiencyController.defectRemovalEfficiency);
        this.router.get('/getBoardIssues/:companyId/:projectId', tenantMiddleware, SyncJiraController.getBoardIssues);
        // this.router.get('/syncPlannedAndReleaseData/:companyId', tenantMiddleware, SyncJiraController.syncPlannedAndReleaseData);
        this.router.get('/getTimeToFix/:companyId/:projectId/:boardId', tenantMiddleware, TimeToFixController.TimeToFix);
        this.router.get('/getBoardIssues/:companyId', tenantMiddleware, SyncJiraController.getBoardIssues);
        this.router.get('/costOfFixingDefects/:companyId/:projectId/:boardId', tenantMiddleware, costOfFixingController.costOfFixingBug);
        this.router.get('/getStoryPointData/:companyId/:projectId/:boardId', tenantMiddleware, StoryPointsCompletedController.getStoryPointData);
        this.router.get('/getSprintLength/:companyId/:projectId/:boardId', tenantMiddleware, CapacityPlanningController.getSprintLength);
        this.router.get('/getDailyBurnup/:companyId/:projectId/:boardId', tenantMiddleware, BurnupChartController.getDailyBurnup);
        this.router.get('/getDevAvailableHours/:companyId/:projectId', tenantMiddleware, CapacityPlanningController.getDevAvailableHours);
        this.router.get('/getSprintCompleteDate/:companyId/:projectId/:boardId/:sprintId', tenantMiddleware, SyncJiraController.getSprintCompleteDate);
        this.router.post('/updateSelectedProject/:companyId', tenantMiddleware, UpdateSelectedAndHideProjectController.updateSelectedProject);
        this.router.post('/updateHideProject/:companyId', tenantMiddleware, UpdateSelectedAndHideProjectController.updateHideProject);
        this.router.post('/addHolidayList/:companyId', tenantMiddleware, CapacityPlanningController.addHolidayList);
        this.router.get('/getHolidayList/:companyId', tenantMiddleware, CapacityPlanningController.getHolidayList);
        this.router.get('/getUserList/:companyId/:projectId', tenantMiddleware, ProjectDataController.getUserList);
        this.router.get('/getBurndownVelocity/:companyId/:projectId/:boardId', tenantMiddleware, BurndownVelocityController.getBurndownVelocity);
        this.router.get('/getBurndownData/:companyId/:projectId/:boardId', tenantMiddleware, BurnDownChartController.getBurndownData);
        this.router.get('/getReleaseBurndownData/:companyId/:projectId/:boardId', tenantMiddleware, BurnDownChartController.getReleaseBurndownData);
    }
}

export default new JiraRoutes().router;
