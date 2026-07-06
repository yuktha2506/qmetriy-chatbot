import mongoose from 'mongoose';
import { SprintIssueModel, BoardIssueModel, ProjectModel, SprintModel } from '../../../project-management/jira/model.js';
import { Types } from 'mongoose';
import { STATUS_ACTIVE } from '../../../../utils/constants/statusConstants.js';

class BurndownService {
    /**
     * Get parent issue key from epic or parent field
     */
    getParentKey(ticket) {
        if (ticket.epic?.key) {
            return ticket.epic.key;
        }
        if (ticket.customFields?.parent) {
            return ticket.customFields.parent;
        }
        if (ticket.type?.name === 'Sub-task' && ticket.customFields?.parentKey) {
            return ticket.customFields.parentKey;
        }
        return null;
    }

    /**
     * Check if ticket is a parent (has children)
     */
    isParentTicket(ticket, allTickets) {
        const ticketKey = ticket.key;
        return allTickets.some(t => {
            const parentKey = this.getParentKey(t);
            return parentKey === ticketKey;
        });
    }

    /**
     * Get children tickets for a parent
     */
    getChildrenTickets(parentKey, allTickets) {
        return allTickets.filter(ticket => {
            const parentKeyOfTicket = this.getParentKey(ticket);
            return parentKeyOfTicket === parentKey;
        });
    }

    /**
     * Calculate story points for a ticket considering parent-child relationship
     */
    calculateTicketStoryPoints(ticket, allTickets) {
        const isParent = this.isParentTicket(ticket, allTickets);
        
        if (isParent) {
            const children = this.getChildrenTickets(ticket.key, allTickets);
            if (children.length > 0) {
                return children.reduce((sum, child) => sum + (child.storyPoints || 0), 0);
            }
        }
        
        // If not parent or no children (orphan), use ticket's own story points
        // Consider all issue types, not just Story
        return ticket.storyPoints || 0;
    }

    /**
     * Calculate closed story points for a ticket considering parent-child relationship
     */
    calculateTicketClosedStoryPoints(ticket, allTickets) {
        const isParent = this.isParentTicket(ticket, allTickets);
        
        if (isParent) {
            const children = this.getChildrenTickets(ticket.key, allTickets);
            if (children.length > 0) {
                return children.reduce((sum, child) => {
                    const isClosed = ['Closed', 'Done'].includes(child?.status?.name);
                    return sum + (isClosed ? (child.storyPoints || 0) : 0);
                }, 0);
            }
        }
        
        // If not parent or no children (orphan), use ticket's own closed story points
        const isClosed = ['Closed', 'Done'].includes(ticket?.status?.name);
        return isClosed ? (ticket.storyPoints || 0) : 0;
    }

    async getBurndown(companyId, projectId, keyId, idType, connection, boardId = null) {
        try {
            const SprintIssue = SprintIssueModel(connection);
            const KanbanIssue = BoardIssueModel(connection);
            const Sprint = SprintModel(connection);
            const Project = ProjectModel(connection);
            const matchQuery = {
                projectId: new mongoose.Types.ObjectId(projectId),
                companyId: new mongoose.Types.ObjectId(companyId),
            };

            // Add boardId to match query if provided
            if (boardId) {
                matchQuery.boardId = new mongoose.Types.ObjectId(boardId);
            }
            let kanbanBoard;
            if (idType === 'sprint') {
                const sprintDetails = await Sprint.findOne({ _id: new mongoose.Types.ObjectId(keyId), projectId });
                matchQuery.sprintId = new mongoose.Types.ObjectId(keyId);
                if (sprintDetails.state === STATUS_ACTIVE) {
                    const today = new Date();
                    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
                    matchQuery.createdAt = { $gte: startOfDay, $lt: endOfDay };
                }
            } else if (idType === 'release') {
                const sprintCount = await Sprint.countDocuments({
                    projectId: new Types.ObjectId(projectId),
                    companyId: new Types.ObjectId(companyId),
                });

                if (sprintCount === 0) {
                    kanbanBoard = await Project.findOne({
                        _id: new Types.ObjectId(projectId),
                        companyId: new Types.ObjectId(companyId),
                        $or: [{ boardType: 'kanban' }, { boardType: 'simple' }, { boardType: 'scrum' }],
                    });
                }
                matchQuery.fixVersion = { $regex: keyId, $options: 'i' };
            } else {
                console.error('sprint or release not defined');
                return;
            }
            const IssueModel = kanbanBoard ? KanbanIssue : SprintIssue;
            
            // Get all tickets first
            const allTickets = await IssueModel.aggregate([
                { $match: matchQuery },
                {
                    $sort: {
                        createdAt: -1,
                    },
                },
                {
                    $group: {
                        _id: '$issueId',
                        latestTicket: { $first: '$$ROOT' },
                    },
                },
                {
                    $replaceRoot: {
                        newRoot: '$latestTicket',
                    },
                },
            ], { allowDiskUse: true });

            // Filter out child tickets (only keep parent tickets and orphan tickets)
            const parentTickets = allTickets.filter(ticket => {
                const parentKey = this.getParentKey(ticket);
                if (!parentKey) {
                    return true; // Orphan ticket (no parent)
                }
                // Only include if parent doesn't exist in allTickets (orphan parent)
                return !allTickets.some(t => t.key === parentKey);
            });

            // Calculate totals considering parent-child relationships
            let totalStoryPoints = 0;
            let totalStoryPointsClosed = 0;

            for (const ticket of parentTickets) {
                totalStoryPoints += this.calculateTicketStoryPoints(ticket, allTickets);
                totalStoryPointsClosed += this.calculateTicketClosedStoryPoints(ticket, allTickets);
            }

            const burndownPercentage = totalStoryPoints > 0
                ? parseFloat(((totalStoryPointsClosed / totalStoryPoints) * 100).toFixed(2))
                : 0;

            const originalEstimateHrs = parseFloat((totalStoryPoints * 8).toFixed(2));
            const totalTimeSpentHrs = parseFloat((totalStoryPointsClosed * 8).toFixed(2));

            return {
                totalStoryPoints: parseFloat(totalStoryPoints.toFixed(2)),
                totalStoryPointsClosed: parseFloat(totalStoryPointsClosed.toFixed(2)),
                burndownPercentage,
                originalEstimateHrs,
                totalTimeSpentHrs
            };
        } catch (error) {
            console.error(`Error calculating burndown for  ${idType}:`, error);
            throw new Error(`Failed to calculate burndown for  ${idType}: ${error.message}`);
        }
    }
}

export default new BurndownService();
