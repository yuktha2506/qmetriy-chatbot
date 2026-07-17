import { Router } from 'express';
import XrayController from './controller.js';
import tenantMiddleware from '../../../middleware/tenantMiddleware.js';

class XrayRoutes {
    constructor() {
        this.router = Router();
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.get('/sync/:companyId', tenantMiddleware, XrayController.sync);
    }
}

export default new XrayRoutes().router;
