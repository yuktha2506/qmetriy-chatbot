import QARefrenceService from '../services/qARefrenceService.js';
import { BoardModel } from '../../project-management/jira/model.js';
import { Types } from 'mongoose';

class QARefrenceController {
    async getQARefrence(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Board = BoardModel(tenantConnection);
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId } = req.query;

            if (!boardId) {
                return res.status(400).json({
                    message: 'Missing required path parameter: boardId',
                });
            }

            if (!sprintId && !releaseId) {
                return res.status(400).json({
                    message: 'Missing required query parameter: sprintId or releaseId',
                });
            }

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

            const response = await QARefrenceService.getQARefrenceData(companyId, projectId, boardId, sprintId, releaseId, tenantConnection);

            if (response) {
                return res.status(200).json(response);
            } else {
                console.error('No QA Reference data found for the given parameters.');
                return res.status(404).json({ message: 'No QA Reference data found' });
            }
        } catch (error) {
            console.error('Error fetching QA Reference data:', error);
            return res.status(500).json({
                message: 'Failed to fetch QA Reference data',
                error: error.message,
            });
        }
    }
}

export default new QARefrenceController();
