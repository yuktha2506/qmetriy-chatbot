import { Router } from 'express';
import TestRailController from './controller.js';
import UserMiddleware from '../../../middleware/user.js';
import tenantMiddleware from '../../../middleware/tenantMiddleware.js';

class TestRailRoutes {
    constructor() {
        this.router = Router();
        this.user = new UserMiddleware();
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/testProjects/:companyId', tenantMiddleware, TestRailController.fetchTestRailData);
        this.router.get('/testRuns/:companyId/:projectId', tenantMiddleware, TestRailController.fetchTestRailRuns);
        this.router.get('/users/:companyId', tenantMiddleware, TestRailController.fetchTestRailUsers);
    }
}

export default new TestRailRoutes().router;
