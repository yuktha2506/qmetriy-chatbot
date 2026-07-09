/* eslint-disable indent */
import { JiraReleaseModel, ProjectModel, SprintModel, BoardModel, SprintIssueModel } from '../model.js';
import { ConnectionModel } from '../../../connection/model.js';
import ProjectDataService from '../services/projectDataService.js';
import { getStartAndEndDate } from '../../../../utils/commonFunctions.js';
import { Types } from 'mongoose';
import { cryptoHandler } from '../../../../utils/commonFunctions.js';
import mongoose from 'mongoose';
import { PROVIDER_NAME_JIRA } from '../../../../utils/constants/providerConstants.js';
import { STATUS_ACTIVE } from '../../../../utils/constants/statusConstants.js';

class ProjectDataController {
    async getProjectList(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Project = ProjectModel(tenantConnection);
            const response = await Project.find();
            res.status(200).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getSprintList(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Sprint = SprintModel(tenantConnection);
            const { companyId, projectId, boardId } = req.params;
            const response = await Sprint.find(
                {
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                    boardId: new Types.ObjectId(boardId),
                },
                {
                    _id: 1, name: 1, state: 1, sprintId: 1, projectId: 1,
                    startDate: 1, endDate: 1, completeDate: 1, totalStoryPoints: 1,
                    committedVsCompletedMetrics: 1, velocity: 1, assignees: 1, hours: 1,
                }
            ).sort({ endDate: -1 });
            res.status(200).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getBoardList(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Board = BoardModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const { companyId, projectId } = req.params;
            const companyObjectId = new mongoose.Types.ObjectId(companyId);
            const projectObjectId = new mongoose.Types.ObjectId(projectId);
            const allBoards = await Board.find({ companyId: companyObjectId, projectId: projectObjectId });
            const project = await Project.findOne(
                {
                    companyId: companyObjectId,
                    _id: projectObjectId,
                },
                { boardId: 1 }
            );

            if (!project || !project.boardId) {
                return res.status(200).json(allBoards);
            }
            const matchingBoards = [];
            const remainingBoards = [];

            allBoards.forEach((board) => {
                if (board.boardId === project.boardId) {
                    matchingBoards.push(board);
                } else {
                    remainingBoards.push(board);
                }
            });
            const response = [...matchingBoards, ...remainingBoards];
            res.status(200).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getUserList(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);
            const { companyId, projectId } = req.params;
            const companyObjectId = new mongoose.Types.ObjectId(companyId);
            const projectObjectId = new mongoose.Types.ObjectId(projectId);
            const project = await Project.findOne({ companyId: companyObjectId, _id: projectObjectId }, { assignees: 1, projectTypeKey: 1, boardType: 1, _id: 1 });
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            let assignees = project.assignees || [];

            const isAzureProject = project.projectTypeKey === 'azure-project' || project.boardType === 'azure-board';
            if (isAzureProject && assignees.length === 0) {
                // Fallback to board assignees for Azure Boards
                const boards = await Board.find({ companyId: companyObjectId, projectId: projectObjectId }, { assignees: 1 }).lean();

                const uniqueMembers = new Map();
                for (const b of boards) {
                    for (const m of b.assignees || []) {
                        const key = m.accountId || m.emailAddress || m.displayName;
                        if (!key || uniqueMembers.has(key)) {
                            continue;
                        }
                        uniqueMembers.set(key, {
                            accountId: m.accountId || null,
                            displayName: m.displayName || m.emailAddress || 'Unknown',
                            emailAddress: m.emailAddress || null,
                            active: typeof m.active === 'boolean' ? m.active : true,
                        });
                    }
                }
                assignees = Array.from(uniqueMembers.values());

                // Fallback #2: if still empty, derive from sprint issues
                if (!assignees.length) {
                    const SprintIssue = SprintIssueModel(tenantConnection);
                    const names = await SprintIssue.distinct('assignee', {
                        companyId: companyObjectId,
                        projectId: projectObjectId,
                        assignee: { $ne: null },
                    });
                    assignees = names.map((n) => ({
                        accountId: null,
                        displayName: n,
                        emailAddress: null,
                        active: true,
                    }));
                }

                // Persist back to Project so subsequent calls and consumers get data
                if (assignees.length) {
                    await Project.updateOne({ _id: projectObjectId, companyId: companyObjectId }, { $set: { assignees } });
                }
            }

            res.status(200).json(assignees);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async sprintIssue(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Sprint = SprintModel(tenantConnection);
            const Connection = ConnectionModel(tenantConnection);
            const sprintId = req.params.sprintId;
            const sprint = await Sprint.findOne({ sprintId }, { companyId: 1 });
            const cred = await Connection.findOne({ companyId: sprint.companyId, name: PROVIDER_NAME_JIRA });
            if (!cred) {
                return { error: 'Jira connection not found for this company.' };
            }
            const decryptedPassword = cryptoHandler(cred.password, 'decrypt');
            const jiraConfig = { host: cred.host, username: cred.username, password: decryptedPassword };
            const response = await ProjectDataService.getSprintIssue(jiraConfig, sprintId);
            res.status(200).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getReleases(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const { companyId, projectId, boardId } = req.params;
            const releases = await ProjectDataService.getReleases(companyId, projectId, boardId, tenantConnection);

            return res.status(200).json(releases);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getTaskCount(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId } = req.query;
            const { startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, tenantConnection);
            const response = await ProjectDataService.getTaskCount(sprintId, projectId, companyId, releaseId, startOfDay, endOfDay, tenantConnection, boardId);
            res.status(201).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getStatusCount(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId } = req.query;
            const { startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, tenantConnection);
            const Connection = ConnectionModel(tenantConnection);
            const cred = await Connection.findOne({ companyId: companyId, name: PROVIDER_NAME_JIRA });
            const response = await ProjectDataService.getStatusCount(sprintId, projectId, companyId, releaseId, startOfDay, endOfDay, tenantConnection, cred, boardId);
            res.status(201).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getIssueCount(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId } = req.query;
            const { startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, tenantConnection);
            const Connection = ConnectionModel(tenantConnection);
            const cred = await Connection.findOne({ companyId: companyId, name: PROVIDER_NAME_JIRA });
            const response = await ProjectDataService.getIssueCount(sprintId, projectId, companyId, releaseId, startOfDay, endOfDay, tenantConnection, cred, boardId);
            res.status(201).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getDefectLeakageAnalysis(req, res) {
        try {
            const connection = req.tenantConnection;
            const Sprint = SprintModel(connection);
            const Project = ProjectModel(connection);
            const Release = JiraReleaseModel(connection);
            const Board = BoardModel(connection);
            const result = [];
            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId } = req.query;
            let identifierType, startOfDay, endOfDay;

            // Validate board exists and get board type
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

            let kanbanBoard;
            if (sprintId) {
                const sprintDetails = await Sprint.findOne({ _id: new Types.ObjectId(sprintId), projectId, boardId: new Types.ObjectId(boardId) });
                if (!sprintDetails) {
                    return res.status(404).json({ error: 'Sprint not found.' });
                }
                if (sprintDetails.state === STATUS_ACTIVE) {
                    ({ startOfDay, endOfDay } = await getStartAndEndDate(companyId, projectId, connection));
                }
                identifierType = 'sprint';
            } else if (releaseId) {
                const releaseData = await Release.findOne({ _id: new Types.ObjectId(releaseId), projectId, boardId: new Types.ObjectId(boardId) });
                if (!releaseData) {
                    return res.status(404).json({ error: 'release not found.' });
                }
                const project = await Project.findOne({ _id: new Types.ObjectId(projectId), companyId });

                if (board) {
                    if (board.boardType === 'kanban') {
                        kanbanBoard = project;
                    } else if (board.boardType === 'scrum' || board.boardType === 'simple') {
                        const sprintCount = await Sprint.countDocuments({ companyId, projectId });
                        if (sprintCount === 0) {
                            kanbanBoard = project;
                        }
                    }
                }
                identifierType = 'release';
            } else {
                console.error('Invalid idType: must be either "sprint" or "release"');
                return;
            }

            const [dlaSprintOrReleaseResult] = await Promise.allSettled([
                ProjectDataService.getDlaSprintOrRelease(companyId, projectId, boardId, kanbanBoard, connection, sprintId || releaseId, identifierType, startOfDay, endOfDay),
            ]);
            result.push({ dlaSprintOrRelease: dlaSprintOrReleaseResult.status === 'fulfilled' ? dlaSprintOrReleaseResult.value : null });
            return res.status(200).json(result);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: error.message });
        }
    }
}

export default new ProjectDataController();
