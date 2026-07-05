import connectionManager from '../config/connectionManager.js';
import { CompanyModel } from '../modules/company/model.js';
import { Types } from 'mongoose';

const tenantMiddleware= async (req, res, next) => {
    const { companyId } = req.params;
    const metaConnection = connectionManager.connectToMetaDB();
    const Company = CompanyModel(metaConnection);
    
    // Validate companyId - check if it's null, undefined, or the string "null"
    if (!companyId || companyId === 'null' || companyId === 'undefined') {
        return res.status(400).send('Company ID is required');
    }
    
    // Validate that companyId is a valid ObjectId format
    if (!Types.ObjectId.isValid(companyId)) {
        return res.status(400).send('Invalid companyId format');
    }
    
    try {
        const existingCompany = await Company.findOne({ _id: companyId });
        if (!existingCompany) {
            return res.status(404).send('Company not found');
        }
        req.companyId=existingCompany._id;
        const tenantConnection = connectionManager.getTenantConnection(existingCompany.companyName,existingCompany.databaseUri);
        req.tenantConnection = tenantConnection;

        // eslint-disable-next-line callback-return
        next();
    } catch (err) {
        // eslint-disable-next-line callback-return
        next(err);
    }
};

export default tenantMiddleware;
