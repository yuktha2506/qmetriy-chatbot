import { Router } from 'express';
import tenantMiddleware from '../../middleware/tenantMiddleware.js';
import UserMiddleware from '../../middleware/user.js';
import techQualityController from './controllers/techQualityController.js';

class TechQualityRoutes {
    constructor() {
        this.router = Router();
        this.user = new UserMiddleware();
        this.initializeRoutes();
    }
    initializeRoutes() {
        this.router.get('/getTechQualityMetrics/:companyId/:projectId/:boardId', tenantMiddleware, techQualityController.getTechQualityMetrics);
    }
}

export default new TechQualityRoutes().router;
