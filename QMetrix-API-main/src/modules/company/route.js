import { Router } from 'express';
import { addCompany, syncCompanyData, getAllOrgs } from './controller';
import UserMiddleware from '../../middleware/user.js';
import CompanyMiddleware from '../../middleware/company.js';
import tenantMiddleware from '../../middleware/tenantMiddleware.js';

class CompanyRoutes {
    constructor() {
        this.router = Router();
        this.user = new UserMiddleware();
        this.company = new CompanyMiddleware();
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.post('/add', this.company.checkExistingCompany, addCompany);
        this.router.get('/syncCompanyData/:companyId', tenantMiddleware, syncCompanyData);
        this.router.get('/getAllOrgs/:companyId', getAllOrgs);
    }
}

export default new CompanyRoutes().router;
