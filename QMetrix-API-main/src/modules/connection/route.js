import { Router } from 'express';
import connectionController from './controller';
import UserMiddleware from '../../middleware/user.js';
import tenantMiddleware from '../../middleware/tenantMiddleware.js';
class ConnectionRoutes {
    constructor() {
        this.router = Router();
        this.user = new UserMiddleware();
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.post('/add/:companyId', tenantMiddleware, connectionController.addConnection);
    }
}

export default new ConnectionRoutes().router;
