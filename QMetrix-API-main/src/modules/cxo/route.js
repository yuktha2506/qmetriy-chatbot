import { Router } from 'express';
import tenantMiddleware from '../../middleware/tenantMiddleware';
import cxoController from './controllers/cxoController';

class CXORoutes {
    constructor() {
        this.router = Router();
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/getCXO/:companyId/:projectId/:boardId', tenantMiddleware, cxoController.getCXO);
        this.router.get('/getCXOtrends/:companyId/:projectId/:count', tenantMiddleware, cxoController.getCXOtrends);
        this.router.post('/editWeightage/:companyId/:projectId/:boardId/:title', tenantMiddleware, cxoController.editWeightage);
        this.router.get('/updateCXOScores/:companyId/:projectId', tenantMiddleware, cxoController.updateCXOScores);
        this.router.get('/getTrendData/:companyId/:projectId/:reqCount', tenantMiddleware, cxoController.getTrendsData);
    }
}

export default new CXORoutes().router;
