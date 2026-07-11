import { Router } from 'express';
import tenantMiddleware from '../../middleware/tenantMiddleware.js';
import ReleaseDashboardController from './controllers/releaseDashboardController.js';

class ReleaseDashboardRoutes {
    constructor() {
        this.router = Router();
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get(
            '/releaseData/:companyId/:projectId/:boardId',
            tenantMiddleware,
            ReleaseDashboardController.getReleaseDashboardData
        );
    }
}

export default new ReleaseDashboardRoutes().router;
