import standupBurndownService from '../services/standupBurndownService';
import { BoardModel } from '../../project-management/jira/model';
import { Types } from 'mongoose';

class standupBurndownController {
  
    async getStandupBurndown(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Board = BoardModel(tenantConnection);
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId,developer:dev } = req.query;
            const developer = dev ;

            if (!sprintId && !releaseId) {
                return res.status(400).json({
                    message: 'Missing required query parameter: sprintId or releaseId',
                });
            }

            // Validate board
            const board = await Board.findOne({
                _id: new Types.ObjectId(boardId),
                companyId: new Types.ObjectId(companyId),
                projectId: new Types.ObjectId(projectId)
            }, { boardType: 1 });

            if (!board) {
                return res.status(404).json({ error: 'Board not found.' });
            }
    
            const response = await standupBurndownService.getStandupBurndown(companyId, projectId, boardId, sprintId, releaseId,developer, tenantConnection);
            
            if (response) {
                return res.status(200).json(response);
            } else {
                console.error('No burndown data found for the given parameters.');
                return res.status(404).json({ message: 'No burndown data found' });
            }
        } catch (error) {
            console.error('Error fetching burndown data:', error);
            return res.status(500).json({
                message: 'Failed to fetch burndown data',
                error: error.message,
            });
        }
    }
    
}
export default new standupBurndownController();
