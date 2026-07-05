import { Router } from 'express';
import tenantMiddleware from '../../middleware/tenantMiddleware.js';
import DashboardController from './controllers/dashboardController.js';

class AnalyticsRoutes {
    constructor() {
        this.router = Router();
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get(
            '/getProjectManagementData/:companyId/:projectId/:boardId',
            tenantMiddleware,
            DashboardController.getProjectManagementData
        );

        this.router.get(
            '/getStandupData/:companyId/:projectId/:boardId',
            tenantMiddleware,
            DashboardController.getStandupData
        );

        this.router.get(
            '/getGitData/:companyId/:projectId/:boardId',
            tenantMiddleware,
            DashboardController.getGitData
        );

        this.router.get(
            '/getCXOData/:companyId/:projectId/:boardId',
            tenantMiddleware,
            DashboardController.getCXOData
        );
    }
}

export default new AnalyticsRoutes().router;
