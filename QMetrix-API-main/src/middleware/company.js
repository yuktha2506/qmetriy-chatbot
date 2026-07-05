import 'dotenv/config';
import connectionManager from '../config/connectionManager';
import { CompanyModel } from '../modules/company/model';

class CompanyMiddleware {
    async checkExistingCompany(req, res, next) {
        try {
            const metaConnection = connectionManager.connectToMetaDB();
            const MetaCompany = CompanyModel(metaConnection);
            const { host } = req.body;
            const data = await MetaCompany.findOne({ host });
            if (data) {
                res.status(200).json(data);
            } else {
                // eslint-disable-next-line callback-return
                next();
            }
        } catch (err) {
            res.send(err.message);
        }
    }
}

export default CompanyMiddleware;
