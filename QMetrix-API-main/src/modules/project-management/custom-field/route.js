import { Router } from 'express';
import tenantMiddleware from '../../../middleware/tenantMiddleware';
import UserMiddleware from '../../../middleware/user';
import custumFieldController from './controllers/custumFieldController';

class custumFieldRoutes {
    constructor() {
        this.router = Router();
        this.user = new UserMiddleware();
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/addNewFeature/:companyId/:projectId', tenantMiddleware, custumFieldController.addNewFeature);
    }
}

export default new custumFieldRoutes().router;
