import connectionManager from '../../config/connectionManager.js';
import { CompanyModel } from './model.js';
import CompanyService from './service.js';
import { linkedCompanies } from '../../utils/trigent_linkedCompanies.js';
import { Types } from 'mongoose';

export const addCompany = async (req, res) => {
    try {
        const { companyName, host } = req.body;

        if (!companyName) {
            return res.status(400).json({ message: 'companyName is required.' });
        }

        const metaConnection = connectionManager.connectToMetaDB();
        const MetaCompany = CompanyModel(metaConnection);

        const existingCompany = await MetaCompany.findOne({ companyName });
        if (existingCompany) {
            return res.status(400).json({ message: 'Company already exists.' });
        }
        const databaseUri = `${process.env.TENANT_DB}/${companyName}?tls=true&retryWrites=false`;

        const newCompany = await MetaCompany.create({
            companyName,
            host,
            databaseUri,
            isActive: true,
        });

        const tenantConnection = connectionManager.getTenantConnection(companyName, databaseUri);
        const TenantCompany = CompanyModel(tenantConnection);

        await TenantCompany.create({
            companyName,
            host,
            databaseUri,
            isActive: true,
        });

        res.status(201).json({
            message: 'Company registered successfully.',
            company: newCompany,
        });
    } catch (error) {
        console.error('Error registering company:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};

export const getAllOrgs = async (req, res) => {
    try {
        const metaConnection = connectionManager.connectToMetaDB();
        const MetaCompany = CompanyModel(metaConnection);
        const { companyId } = req.params;

        // Validate companyId - check if it's null, undefined, or the string "null"
        if (!companyId || companyId === 'null' || companyId === 'undefined') {
            return res.status(400).json({ message: 'Invalid companyId parameter' });
        }

        // Validate that companyId is a valid ObjectId format
        if (!Types.ObjectId.isValid(companyId)) {
            return res.status(400).json({ message: 'Invalid companyId format' });
        }

        const company = await MetaCompany.findOne({ _id: companyId });
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        const { companyName } = company;

        const allOrgs = [];

        if (companyName === 'Trigent' || companyName === 'Trinav') {
            for (const linkedCompany of linkedCompanies) {
                const linked = await MetaCompany.findOne({ companyName: linkedCompany });
                if (linked) {
                    allOrgs.push({ companyName: linked.companyName, _id: linked._id });
                }
            }
        }

        return res.status(200).json(allOrgs);
    } catch (error) {
        console.error('Error fetching orgs:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    }
};

export const syncCompanyData = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { failedOnly, projectId } = req.query;
        const tenantConnection = req.tenantConnection;
        const syncCurrent = !!projectId;
        const response = await CompanyService.syncCompanyData(companyId, tenantConnection, failedOnly, syncCurrent, projectId);
        res.status(201).json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
