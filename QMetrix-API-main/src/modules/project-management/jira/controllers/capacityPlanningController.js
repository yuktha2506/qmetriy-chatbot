import CapacityPlanningService from '../services/capacityPlanningService.js';
import { CompanyModel } from '../../../company/model.js';
import connectionManager from '../../../../config/connectionManager.js';
import { SprintModel, JiraReleaseModel, BoardModel } from '../model.js';
import { Types } from 'mongoose';
class CapacityPlanningController {
    async addCapacity(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const data = req.body;
            const response = await CapacityPlanningService.addCapacity(tenantConnection, data);
            res.status(201).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getCapacityAssigneeModalData(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const { sprintId, releaseId } = req.query;
            const data = await CapacityPlanningService.getCapacityAssigneeModalRows(tenantConnection, {
                sprintId,
                releaseId,
            });
            return res.status(200).json(data);
        } catch (error) {
            const msg = error.message || 'Failed to load capacity assignee list';
            const status = msg.includes('not found') ? 404 : 400;
            return res.status(status).json({ error: msg });
        }
    }
    async addRoleRates(req, res) {
        try {
            const { companyId } = req.params;
            const tenantConnection = req.tenantConnection;
            const metaConnection = connectionManager.connectToMetaDB();
            const MetaCompany = CompanyModel(metaConnection);
            const metaCompany = await MetaCompany.findOne({ _id: companyId });
            if (!metaCompany) {
                return res.status(404).json({ error: 'Company not found' });
            }
            const data = req.body;
            const response = await CapacityPlanningService.addRoleRates(tenantConnection, metaCompany.companyName, data);
            res.status(201).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getRoleRatesAndStoryPoints(req, res) {
        try {
            const { companyId } = req.params;
            const tenantConnection = req.tenantConnection;
            const metaConnection = connectionManager.connectToMetaDB();
            const Company = CompanyModel(metaConnection);
            const metaCompany = await Company.findOne({ _id: companyId });
            if (!metaCompany) {
                return res.status(404).json({ error: 'Company not found' });
            }
            const tenantCompany = CompanyModel(tenantConnection);
            let companyData = await tenantCompany.findOne({ companyName: metaCompany.companyName });
            if (!companyData) {
                companyData = await tenantCompany.findOne({ isActive: true });
            }
            return res.status(200).json({
                roleRates: companyData?.roleRates || [],
                storyPoints: companyData?.storyPoints || [],
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async addStoryPoints(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const { data } = req.body;
            const response = await CapacityPlanningService.addStoryPoints(tenantConnection, data);
            res.status(201).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getSprintLength(req, res) {
        try {
            const connection = req.tenantConnection;
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId } = req.query;
            const Sprint = SprintModel(connection);
            const JiraRelease = JiraReleaseModel(connection);
            const Board = BoardModel(connection);

            // Validate board exists
            const board = await Board.findOne(
                {
                    _id: new Types.ObjectId(boardId),
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                },
                { boardType: 1 }
            );

            if (!board) {
                return res.status(404).json({ error: 'Board not found.' });
            }

            let totalDays = 0;

            const calcWorkingDays = (start, end) => {
                if (!start || !end) {
                    return 0;
                }
                const s = new Date(start);
                s.setHours(0, 0, 0, 0);
                const e = new Date(end);
                e.setHours(0, 0, 0, 0);
                let count = 0;
                const cur = new Date(s);
                while (cur <= e) {
                    const d = cur.getDay();
                    if (d !== 0 && d !== 6) {
                        count++;
                    }
                    cur.setDate(cur.getDate() + 1);
                }
                return count;
            };

            if (sprintId) {
                const sprint = await Sprint.findOne({
                    _id: new Types.ObjectId(sprintId),
                    companyId,
                    projectId,
                    boardId: new Types.ObjectId(boardId),
                });
                if (sprint) {
                    totalDays = sprint.totalDays || calcWorkingDays(sprint.startDate, sprint.endDate);
                }
            } else if (releaseId) {
                const release = await JiraRelease.findOne({
                    _id: new Types.ObjectId(releaseId),
                    companyId,
                    projectId,
                    boardId: new Types.ObjectId(boardId),
                });

                if (release) {
                    totalDays = release.totalDays || calcWorkingDays(release.startDate, release.releaseDate);
                }
            }
            return res.json({ sprintLengthInDays: totalDays });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: error.message });
        }
    }
    async getDevAvailableHours(req, res) {
        try {
            const connection = req.tenantConnection;
            const { companyId, projectId } = req.params;
            const { sprintId, releaseId, developer } = req.query;

            if (!developer) {
                return res.json({
                    availableHours: 0,
                });
            }

            const Sprint = SprintModel(connection);
            const JiraRelease = JiraReleaseModel(connection);

            let document = null;

            if (sprintId) {
                document = await Sprint.findOne({
                    _id: new Types.ObjectId(sprintId),
                    companyId,
                    projectId,
                });
            } else if (releaseId) {
                document = await JiraRelease.findOne({
                    _id: new Types.ObjectId(releaseId),
                    companyId,
                    projectId,
                });
            } else {
                return res.status(400).json({ error: 'Either sprintId or releaseId must be provided.' });
            }
            const foundAssignee = document.assignees?.find((item) => item.assignee === developer);

            return res.json({
                availableHours: foundAssignee.availableHours || 0,
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: error.message });
        }
    }

    async addHolidayList(req, res) {
        try {
            const { companyId } = req.params;
            const tenantConnection = req.tenantConnection;
            const metaConnection = connectionManager.connectToMetaDB();
            const MetaCompany = CompanyModel(metaConnection);
            const metaCompany = await MetaCompany.findOne({ _id: companyId });
            if (!metaCompany) {
                return res.status(404).json({ error: 'Company not found' });
            }
            const data = req.body;
            const response = await CapacityPlanningService.addHolidayList(tenantConnection, metaCompany.companyName, data);
            res.status(201).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getHolidayList(req, res) {
        try {
            const { companyId } = req.params;
            const tenantConnection = req.tenantConnection;
            const metaConnection = connectionManager.connectToMetaDB();
            const Company = CompanyModel(metaConnection);
            const metaCompany = await Company.findOne({ _id: companyId });
            if (!metaCompany) {
                return res.status(404).json({ error: 'Company not found' });
            }
            const tenantCompany = CompanyModel(tenantConnection);
            let companyData = await tenantCompany.findOne({ companyName: metaCompany.companyName });
            if (!companyData) {
                companyData = await tenantCompany.findOne({ isActive: true });
            }

            return res.status(200).json({
                holidayList: companyData?.holidayList || [],
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new CapacityPlanningController();
