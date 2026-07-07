/* eslint-disable max-len */
/* eslint-disable indent */
import axios from 'axios';
import { ProjectModel, BoardModel, SprintModel, SprintIssueModel, JiraReleaseModel, BoardIssueModel } from '../../jira/model.js';
import { ConnectionModel } from '../../../connection/model.js';
import { cryptoHandler, getToday, calculateIsAccepted } from '../../../../utils/commonFunctions.js';
import { Types } from 'mongoose';
import { CompanyModel } from '../../../company/model.js';
import connectionManager from '../../../../config/connectionManager.js';
import burndownVelocityService from '../../jira/services/burndownVelocityService.js';
import burndownCalculationService from '../../jira/services/burndownCalculationService.js';
import { GITLAB_API_BASE_URL, PROVIDER_NAME_GITLAB_ISSUES } from '../../../../utils/constants/providerConstants.js';
import {
    STATUS_ACTIVE,
    STATUS_CLOSED,
    MILESTONE_STATUS_ACTIVE,
    MILESTONE_STATUS_CLOSED,
    MILESTONE_STATUS_FUTURE,
    RELEASE_STATUS_RELEASED,
    RELEASE_STATUS_UNRELEASED,
    ALL_RELEASE_STATUSES,
} from '../../../../utils/constants/statusConstants.js';
import{ epic_type,sub_task_type } from '../../../../utils/constants/custumFieldConstants.js';

class GitLabIssuesService {
    async syncGitLabIssues(companyId, tenantConnection, type = 'light', projectId = null) {
        try {
            const Connection = ConnectionModel(tenantConnection);
            const cred = await Connection.findOne({ companyId, name: { $in: [PROVIDER_NAME_GITLAB_ISSUES] } });

            if (!cred) {
                return { warning: 'GitLab Issues connection not found for this company. Sync skipped.' };
            }

            const decryptedToken = cryptoHandler(cred.password, 'decrypt');
            const gitlabConfig = {
                password: decryptedToken,
                username: cred.username || '',
            };
            const apiBase = GITLAB_API_BASE_URL;

            const response = {
                fetchCustomField: null,
                syncGitLabProjectData: null,
                syncMilestones: null,
                syncProjectIssues: null,
                addUser: null,
            };

            // Fetch custom fields first (similar to Jira)
            try {
                await this.getCustomFields(companyId, gitlabConfig, apiBase, tenantConnection);
                response.fetchCustomField = { status: 'success' };
            } catch (error) {
                response.fetchCustomField = { status: 'error', message: error.message };
                throw error;
            }

            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);

            // Fetch all GitLab projects from database
            let projects = [];
            try {
                const query = { companyId, projectTypeKey: 'gitlab-project' };
                if (projectId) {
                    const projectObjectId = Types.ObjectId.isValid(projectId) ? new Types.ObjectId(projectId) : null;
                    if (projectObjectId) {
                        const selected = await Project.findOne({ companyId, _id: projectObjectId }).lean();
                        if (selected) {
                            query.projectKeyId = selected.projectKeyId;
                        }
                    }
                }
                projects = await Project.find(query).lean();
            } catch (e) {
                projects = [];
            }

            // Process each project
            for (const projectDoc of projects) {
                const projectKeyId = projectDoc.projectKeyId;
                const projectPath = encodeURIComponent(projectDoc.key || projectDoc.name);
                const projectIdForApi = projectDoc.projectKeyId || projectPath;
                try {
                    // Fetch boards for this project from GitLab API
                    let gitlabBoards = [];
                    try {
                        // Try with project ID first
                        const boardsResp = await this.retryWithDelay(() =>
                            this.gitlabGet(`${apiBase}/projects/${projectIdForApi}/boards`, gitlabConfig)
                        );
                        gitlabBoards = boardsResp.data || [];
                    } catch (idError) {
                        // If 403 or other error with ID, try with path
                        if (idError.response?.status === 403 || idError.response?.status === 404) {
                            try {
                                const boardsResp = await this.retryWithDelay(() =>
                                    this.gitlabGet(`${apiBase}/projects/${projectPath}/boards`, gitlabConfig)
                                );
                                gitlabBoards = boardsResp.data || [];
                            } catch (pathError) {
                                // If still 403, boards might not be accessible
                                if (pathError.response?.status === 403) {
                                    console.warn('[GitLab Issues] Boards not accessible (403)', {
                                        project: projectDoc.name,
                                        projectKeyId,
                                    });
                                    gitlabBoards = [];
                                } else {
                                    throw pathError;
                                }
                            }
                        } else {
                            throw idError;
                        }
                    }

                    const boardsData = [];

                    if (gitlabBoards.length > 0) {
                        // Process all boards for this project
                        for (const gitlabBoard of gitlabBoards) {
                            const boardId = this.toNumericId(gitlabBoard.id);
                            const boardName = gitlabBoard.name || 'Default Board';

                            // Fetch board lists (columns) to get workflow statuses
                            let workflowStatuses = [];
                            try {
                                let listsResp;
                                try {
                                    listsResp = await this.retryWithDelay(() =>
                                        this.gitlabGet(`${apiBase}/projects/${projectIdForApi}/boards/${gitlabBoard.id}/lists`, gitlabConfig)
                                    );
                                } catch (idError) {
                                    if (idError.response?.status === 403 || idError.response?.status === 404) {
                                        listsResp = await this.retryWithDelay(() =>
                                            this.gitlabGet(`${apiBase}/projects/${projectPath}/boards/${gitlabBoard.id}/lists`, gitlabConfig)
                                        );
                                    } else {
                                        throw idError;
                                    }
                                }
                                const lists = listsResp.data || [];
                                workflowStatuses = lists.map((list, index) => ({
                                    order: index + 1,
                                    name: list.label?.name || list.name || `List ${index + 1}`,
                                    statuses: [list.label?.name || list.name || `List ${index + 1}`],
                                }));
                            } catch (listError) {
                                workflowStatuses = [];
                            }

                            boardsData.push({
                                boardId: boardId,
                                boardName: boardName,
                                boardType: 'gitlab-board',
                                boardSelf: gitlabBoard.id ? `${apiBase}/projects/${projectIdForApi}/boards/${gitlabBoard.id}` : null,
                                gitlabBoardId: gitlabBoard.id, // Store original GitLab board ID for API calls
                                isPrivate: false,
                                workflowStatuses: workflowStatuses,
                                boardLocation: {
                                    projectId: projectKeyId,
                                    projectName: projectDoc.name,
                                    projectKey: projectDoc.key,
                                    projectTypeKey: 'gitlab-project',
                                    avatarURI: null,
                                    displayName: boardName,
                                    name: boardName,
                                },
                            });
                        }
                    }

                    // Ensure there is at least one board entry
                    if (!boardsData.length) {
                        const fallbackBoardId = this.toNumericId(`${projectKeyId}:default`);
                        boardsData.push({
                            boardId: fallbackBoardId,
                            boardName: `${projectDoc.name} (default)`,
                            boardType: 'gitlab-board',
                            boardSelf: null,
                            gitlabBoardId: null, // Fallback boards don't have a GitLab board ID
                            isPrivate: false,
                            workflowStatuses: [],
                            boardLocation: {
                                projectId: projectKeyId,
                                projectName: projectDoc.name,
                                projectKey: projectDoc.key,
                                projectTypeKey: 'gitlab-project',
                                avatarURI: null,
                                displayName: projectDoc.name,
                                name: projectDoc.name,
                            },
                        });
                    }

                    // Update Project with boards data
                    const primaryBoard = boardsData[0];
                    await Project.updateOne(
                        { projectKeyId, companyId },
                        {
                            $set: {
                                boardId: primaryBoard ? primaryBoard.boardId : 0 - Number(projectKeyId),
                                boardType: 'gitlab-board',
                                workflowStatuses: primaryBoard ? primaryBoard.workflowStatuses || [] : [],
                                boards: boardsData,
                            },
                        }
                    );

                    // Ensure Board documents exist and are linked to this project
                    const projectDocUpdated = await Project.findOne({ companyId, projectKeyId });
                    if (projectDocUpdated) {
                        for (const b of boardsData) {
                            await Board.updateOne(
                                {
                                    companyId,
                                    projectId: projectDocUpdated._id,
                                    projectKeyId,
                                    boardId: b.boardId,
                                },
                                {
                                    $set: {
                                        companyId,
                                        projectId: projectDocUpdated._id,
                                        projectKeyId,
                                        boardId: b.boardId,
                                        boardName: b.boardName,
                                        boardType: b.boardType,
                                        boardSelf: b.boardSelf,
                                        isPrivate: b.isPrivate,
                                        boardLocation: b.boardLocation,
                                    },
                                },
                                { upsert: true }
                            );
                        }
                    }

                    // Sync milestones (similar to Azure Boards iterations)
                    try {
                        await this.addMilestonesForProject(apiBase, gitlabConfig, tenantConnection, companyId, projectDocUpdated?._id, projectIdForApi, projectPath, projectDoc.name);
                        response.syncMilestones = { status: 'success' };
                    } catch (e) {
                        response.syncMilestones = { status: 'error', message: e.message };
                    }

                    // Sync project issues
                    try {
                        await this.syncProjectIssuesForProject(apiBase, gitlabConfig, tenantConnection, companyId, projectDocUpdated?._id, projectIdForApi, projectPath, projectKeyId, boardsData, projectDoc.name, type);
                        response.syncProjectIssues = { status: 'success' };
                    } catch (e) {
                        response.syncProjectIssues = { status: 'error', message: e.message };
                    }

                    response.syncGitLabProjectData = { status: 'success' };
                } catch (error) {
                    console.error('[GitLab Issues] Error processing project', {
                        project: projectDoc.name,
                        projectKeyId,
                        error: error.message,
                    });
                    response.syncGitLabProjectData = { status: 'partial', message: error.message };
                }
            }

            // Users (project members)
            try {
                await this.addUser(apiBase, gitlabConfig, companyId, tenantConnection, projectId);
                response.addUser = { status: 'success' };
            } catch (e) {
                response.addUser = { status: 'error', message: e.message };
            }

            // Churn data map calculation
            try {
                await this.churnDataMap(companyId, tenantConnection, type, projectId);
                response.churnDataMap = { status: 'success' };
            } catch (error) {
                response.churnDataMap = { status: 'error', message: error.message };
                throw error;
            }

            // Milestone metrics calculation (committedVsCompletedMetrics)
            try {
                await this.syncMilestoneMetrics(companyId, tenantConnection, type, projectId);
                response.syncMilestoneMetrics = { status: 'success' };
            } catch (error) {
                response.syncMilestoneMetrics = { status: 'error', message: error.message };
                throw error;
            }

            // Burndown velocity calculation
            try {
                await this.calculateBurndownVelocity(tenantConnection, companyId, projectId, type);
                response.calculateBurndownVelocity = { status: 'success' };
            } catch (error) {
                response.calculateBurndownVelocity = { status: 'error', message: error.message };
                throw error;
            }

            return { ...response, status: 'success', projectsProcessed: projects.length };
        } catch (error) {
            console.error('[GitLab Issues] Error syncing GitLab Issues data..', error.message);
            throw error;
        }
    }

    // Helper methods
    gitlabGet(url, gitlabConfig, params = {}) {
        // Use Bearer Token authentication as per GitLab API
        const config = {
            headers: {
                Authorization: `Bearer ${gitlabConfig.password}`, // Token used as Bearer token
            },
            params,
        };

        return axios.get(url, config);
    }

    async retryWithDelay(fn, retries = 2, delay = 1000) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt < retries) {
                    await new Promise((resolve) => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }
    }

    extractAllFields(issue) {
        // Extract all fields from the GitLab issue object
        // Normalize values similar to Jira's extractCustomFields
        const normalizeValue = (value) => {
            // eslint-disable-next-line eqeqeq
            if (value == null) {
                return null;
            }

            if (value && typeof value === 'object' && 'name' in value && 'id' in value) {
                return {
                    id: value.id ?? null,
                    name: value.name ?? null,
                    ...(value.username ? { username: value.username } : {}),
                    ...(value.email ? { email: value.email } : {}),
                    ...(value.title ? { title: value.title } : {}),
                };
            }

            if (Array.isArray(value)) {
                return value.map((v) => normalizeValue(v)).filter((v) => v !== undefined);
            }

            if (typeof value === 'object') {
                const out = {};
                for (const [k, v] of Object.entries(value)) {
                    out[k] = normalizeValue(v);
                }
                return out;
            }

            return value;
        };

        const allFields = {};
        const allFieldsByName = {};

        // Extract all fields from the issue object
        for (const [key, value] of Object.entries(issue || {})) {
            const normalizedValue = normalizeValue(value);
            allFields[key] = normalizedValue;
            
            // Create a human-readable name for customFieldsByName
            const fieldName = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
            allFieldsByName[fieldName] = normalizedValue;
        }

        return {
            byId: allFields,
            byName: allFieldsByName,
        };
    }

    toNumericId(value) {
        if (typeof value === 'number') {
            return value;
        }
        const str = String(value || '');
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0; // 32-bit int
        }
        return Math.abs(hash);
    }

    async getCustomFields(companyId, gitlabConfig, apiBase, tenantConnection) {
        try {
            // GitLab doesn't have a direct fields endpoint like Jira
            // We'll fetch a sample issue from any project to extract available fields dynamically
            const Project = ProjectModel(tenantConnection);
            const projects = await Project.find({ companyId, projectTypeKey: 'gitlab-project' }).lean();
            
            if (!projects || projects.length === 0) {
                throw new Error('No GitLab projects found. Cannot fetch custom fields without a sample issue.');
            }

            // Try each project until we find one with issues
            for (const project of projects) {
                try {
                    const projectIdForApi = project.projectKeyId || encodeURIComponent(project.key || project.name);
                    
                    // Try with project ID first
                    let issuesResp;
                    try {
                        issuesResp = await this.retryWithDelay(() =>
                            this.gitlabGet(`${apiBase}/projects/${projectIdForApi}/issues`, gitlabConfig, {
                                page: 1,
                                per_page: 1,
                                state: 'all', // Get both opened and closed issues
                            })
                        );
                    } catch (idError) {
                        // If 403 or 404 with ID, try with path
                        if (idError.response?.status === 403 || idError.response?.status === 404) {
                            const projectPath = encodeURIComponent(project.key || project.name);
                            issuesResp = await this.retryWithDelay(() =>
                                this.gitlabGet(`${apiBase}/projects/${projectPath}/issues`, gitlabConfig, {
                                    page: 1,
                                    per_page: 1,
                                    state: 'all',
                                })
                            );
                        } else {
                            throw idError;
                        }
                    }
                    
                    if (issuesResp.data && issuesResp.data.length > 0) {
                        const sampleIssue = issuesResp.data[0];
                        
                        // Extract all keys from the issue object dynamically
                        const customFields = Object.keys(sampleIssue).map((key) => ({
                            key: key,
                            name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
                        }));
                        
                        const metaConnection = connectionManager.connectToMetaDB();
                        const MetaCompany = CompanyModel(metaConnection);
                        const company = await MetaCompany.findOneAndUpdate(
                            { _id: companyId },
                            { $set: { customFields } },
                            { new: true, upsert: false }
                        );

                        if (!company) {
                            throw new Error('Company not found in meta database');
                        }

                        return customFields;
                    }
                } catch (projectError) {
                    // Continue to next project if this one fails
                    continue;
                }
            }

            // If we've tried all projects and none have issues
            throw new Error('No issues found in any GitLab project. Cannot determine available fields without a sample issue.');
        } catch (error) {
            throw new Error(`Failed to fetch custom fields: ${error.message}`);
        }
    }

    /**
     * Fetch and update milestone assignees with story points and allocated hours
     * This is the GitLab equivalent of fetchUserStoryPoints from syncJiraService.js
     * Updates assignees milestone-wise (milestones = releases in GitLab)
     * 
     * @param {Array} issuesData - Array of BoardIssue or SprintIssue documents for the milestone
     * @param {Object} connection - Database connection
     * @param {String} keyId - Milestone (Release) _id
     * @param {Array} previousAssigneeResults - Assignees from previous milestone (for copying when milestone starts today)
     * @returns {Object} - Object with formattedResult and didUpdate flag
     */
    async fetchMilestoneAssignees(issuesData, connection, keyId, previousAssigneeResults) {
        try {
            const JiraRelease = JiraReleaseModel(connection);
            const result = {};

            // Group issues by projectKey (projectId)
            const issuesByProject = {};
            for (const issue of issuesData) {
                const projectKey = issue.projectId || '';
                if (!issuesByProject[projectKey]) {
                    issuesByProject[projectKey] = [];
                }
                issuesByProject[projectKey].push(issue);
            }

            // Process each project group
            for (const [projectKey, issues] of Object.entries(issuesByProject)) {
                // Determine estimation mode: use originalEstimateHrs if present and no storyPoints
                const hasHours = issues.some((issue) => (issue.originalEstimateHrs ?? 0) > 0);
                const hasStoryPoints = issues.some((issue) => (issue.storyPoints ?? 0) > 0);                
                const usesOriginalEstimate = hasHours && !hasStoryPoints;

                result[projectKey] = {
                    hours: usesOriginalEstimate,
                };

                // Group by assignee and calculate allocatedHours/storyPoints
                for (const issue of issues) {
                    const assignee = issue.assignee || 'UnAssigned';
                    const storyPoints = issue.storyPoints || 0;
                    const originalEstimateHrs = issue.originalEstimateHrs || 0;

                    if (!result[projectKey][assignee]) {
                        // Initialize assignee with all required fields matching fetchUserStoryPoints
                        result[projectKey][assignee] = {
                            assignee,
                            storyPoints: 0,
                            allocatedHours: 0,
                            availableHours: 0,
                            role: '',
                            billingRate: 0,
                            holiday: 0,
                            leaves: 0,
                            netAvailableCapacity: 0,
                        };
                    }

                    // Calculate allocatedHours based on estimation mode (matching fetchUserStoryPoints logic)
                    if (usesOriginalEstimate) {
                        result[projectKey][assignee].allocatedHours += originalEstimateHrs;
                    } else {
                        result[projectKey][assignee].storyPoints += storyPoints;
                        result[projectKey][assignee].allocatedHours += storyPoints;
                    }
                }
            }
            if (Array.isArray(previousAssigneeResults) && previousAssigneeResults.length > 0) {
                for (const prev of previousAssigneeResults) {
                    const assigneeName = prev.assignee;
                    if (!assigneeName) { continue; }
                    for (const projectKey of Object.keys(result)) {
                        if (!result[projectKey][assigneeName]) {
                            result[projectKey][assigneeName] = {
                                assignee: assigneeName,
                                storyPoints: 0,
                                allocatedHours: 0,
                                availableHours: prev.availableHours || 0,
                                role: prev.role || '',
                                billingRate: prev.billingRate || 0,
                                holiday: 0,
                                leaves: 0,
                                netAvailableCapacity: prev.netAvailableCapacity || 0,
                            };
                        } else {
                            const current = result[projectKey][assigneeName];
                            if (!current.role) { current.role = prev.role || ''; }
                            if (!current.billingRate) { current.billingRate = prev.billingRate || 0; }
                            if (!current.availableHours) { current.availableHours = prev.availableHours || 0; }
                            if (!current.allocationType) { current.allocationType = prev.allocationType; }
                            if (!current.netAvailableCapacity) { current.netAvailableCapacity = prev.netAvailableCapacity || 0; }
                        }
                    }
                }
            }

            // Format result to match fetchUserStoryPoints output structure
            const formattedResult = Object.entries(result).map(([projectKey, assigneesMap]) => {
                const { hours, ...assigneesData } = assigneesMap;
                return {
                    projectKey,
                    hours,
                    assignees: Object.values(assigneesData),
                };
            });

            const Model = JiraRelease;
            const existingDoc = await Model.findById(keyId);
            const shouldDoInitialWrite = !existingDoc?.assigneeCopiedForToday;
            const originalAssignees = existingDoc?.assignees || [];

            // Merge assignee data BEFORE initial write to preserve existing values
            for (const projectData of formattedResult) {
                if (existingDoc && Array.isArray(existingDoc.assignees)) {
                    for (const newAssignee of projectData.assignees) {
                        const original = originalAssignees.find((a) => a.assignee === newAssignee.assignee);
                        let assigneesData = {};
                        if (Array.isArray(previousAssigneeResults)) {
                            assigneesData = previousAssigneeResults.find((a) => a.assignee === newAssignee.assignee) || {};
                        }

                        // Merge fields with priority: previousAssigneeResults > original > defaults
                        if (original) {
                            newAssignee.availableHours = assigneesData?.availableHours ?? original.availableHours ?? newAssignee.availableHours ?? 0;
                            newAssignee.role = assigneesData?.role ?? original.role ?? newAssignee.role ?? '';
                            newAssignee.billingRate = assigneesData?.billingRate ?? original.billingRate ?? newAssignee.billingRate ?? 0;
                            newAssignee.allocationType = assigneesData?.allocationType ?? original.allocationType ?? newAssignee.allocationType;
                            newAssignee.netAvailableCapacity = assigneesData?.netAvailableCapacity ?? original.netAvailableCapacity ?? newAssignee.netAvailableCapacity ?? 0;
                            newAssignee.holiday = original.holiday ?? newAssignee.holiday ?? 0;
                            newAssignee.leaves = original.leaves ?? newAssignee.leaves ?? 0;
                        } else if (assigneesData && Object.keys(assigneesData).length > 0) {
                            // If no original but we have previous assignee data, use that
                            newAssignee.availableHours = assigneesData.availableHours ?? newAssignee.availableHours ?? 0;
                            newAssignee.role = assigneesData.role ?? newAssignee.role ?? '';
                            newAssignee.billingRate = assigneesData.billingRate ?? newAssignee.billingRate ?? 0;
                            newAssignee.allocationType = assigneesData.allocationType ?? newAssignee.allocationType;
                            newAssignee.netAvailableCapacity = assigneesData.netAvailableCapacity ?? newAssignee.netAvailableCapacity ?? 0;
                            newAssignee.holiday = assigneesData.holiday ?? newAssignee.holiday ?? 0;
                            newAssignee.leaves = assigneesData.leaves ?? newAssignee.leaves ?? 0;
                        }
                    }
                }
            }

            // Do initial write if needed (matching fetchUserStoryPoints logic)
            // Now this write will have merged data, not just defaults
            if (shouldDoInitialWrite && formattedResult.length > 0) {
                const before = formattedResult[0];
                await Model.updateOne({ _id: keyId }, { $set: { assignees: before.assignees, hours: before.hours } });
            }

            // Get updated document after initial write
            const updatedAfter = await Model.findById(keyId);
            let didUpdate = false;

            // Merge assignee data with existing/original/previous assignees (matching fetchUserStoryPoints logic)
            for (const projectData of formattedResult) {
                if (updatedAfter && Array.isArray(updatedAfter.assignees)) {
                    for (const newAssignee of projectData.assignees) {
                        const existing = updatedAfter.assignees.find((a) => a.assignee === newAssignee.assignee);
                        const original = originalAssignees.find((a) => a.assignee === newAssignee.assignee);
                        let assigneesData = {};
                        if (Array.isArray(previousAssigneeResults)) {
                            assigneesData = previousAssigneeResults.find((a) => a.assignee === newAssignee.assignee) || {};
                        }

                        // Merge fields with priority: previousAssigneeResults > existing > original
                        // Use existing (current DB state) over original (snapshot at start) to preserve user updates
                        if (existing) {
                            // Prioritize existing (current DB state) which has user's latest updates
                            newAssignee.availableHours = assigneesData?.availableHours ?? existing.availableHours ?? original?.availableHours ?? 0;
                            newAssignee.role = assigneesData?.role ?? existing.role ?? original?.role ?? '';
                            newAssignee.billingRate = assigneesData?.billingRate ?? existing.billingRate ?? original?.billingRate ?? 0;
                            newAssignee.allocationType = assigneesData?.allocationType ?? existing.allocationType ?? original?.allocationType;
                            newAssignee.netAvailableCapacity = assigneesData?.netAvailableCapacity ?? existing.netAvailableCapacity ?? original?.netAvailableCapacity ?? 0;
                            newAssignee.holiday = existing.holiday ?? original?.holiday ?? 0;
                            newAssignee.leaves = existing.leaves ?? original?.leaves ?? 0;
                        } else if (original) {
                            newAssignee.availableHours = assigneesData?.availableHours ?? original.availableHours ?? 0;
                            newAssignee.role = assigneesData?.role ?? original.role ?? '';
                            newAssignee.billingRate = assigneesData?.billingRate ?? original.billingRate ?? 0;
                            newAssignee.allocationType = assigneesData?.allocationType ?? original.allocationType;
                            newAssignee.netAvailableCapacity = assigneesData?.netAvailableCapacity ?? original.netAvailableCapacity ?? 0;
                            newAssignee.holiday = original.holiday ?? 0;
                            newAssignee.leaves = original.leaves ?? 0;
                        }
                    }
                }
                // Update milestone with merged assignees
                const res = await Model.updateOne({ _id: keyId }, { $set: { assignees: projectData.assignees, hours: projectData.hours } });

                if (res?.acknowledged && (res.modifiedCount > 0 || res.matchedCount > 0)) {
                    didUpdate = true;
                }
            }

            return { formattedResult, didUpdate };
        } catch (error) {
            console.error('[GitLab Issues] Error in fetchMilestoneAssignees:', error);
            throw error;
        }
    }

    /**
     * Calculate allocatedHours for assignees from issues, matching fetchUserStoryPoints logic from syncJiraService.js
     * @deprecated This function is kept for backward compatibility but fetchMilestoneAssignees should be used instead
     * @param {Array} issuesData - Array of BoardIssue documents
     * @param {Array} existingAssignees - Existing assignees from the release (to preserve metadata)
     * @returns {Object} - Object with assignees array and hours boolean
     */
    calculateAllocatedHoursFromIssues(issuesData, existingAssignees = []) {
        const result = {};
        
        // Group issues by projectKey (using projectId as key)
        const issuesByProject = {};
        for (const issue of issuesData) {
            const projectKey = issue.projectId?.toString() || '';
            if (!issuesByProject[projectKey]) {
                issuesByProject[projectKey] = [];
            }
            issuesByProject[projectKey].push(issue);
        }

        for (const [projectKey, issues] of Object.entries(issuesByProject)) {
            // Determine estimation mode: use originalEstimateHrs if present and no storyPoints
            const hasHours = issues.some((issue) => (issue.originalEstimateHrs ?? 0) > 0);
            const hasStoryPoints = issues.some((issue) => (issue.storyPoints ?? 0) > 0);
            const usesOriginalEstimate = hasHours && !hasStoryPoints;

            result[projectKey] = {
                hours: usesOriginalEstimate,
            };

            // Group by assignee and calculate allocatedHours
            for (const issue of issues) {
                const assignee = issue.assignee || 'UnAssigned';
                const storyPoints = issue.storyPoints || 0;
                const originalEstimateHrs = issue.originalEstimateHrs || 0;
                const issueType = issue.type?.name || '';

                if (!result[projectKey][assignee]) {
                    // Initialize assignee with defaults matching fetchUserStoryPoints
                    const existingAssignee = existingAssignees.find((a) => a.assignee === assignee);
                    result[projectKey][assignee] = {
                        assignee,
                        storyPoints: 0,
                        allocatedHours: 0,
                        availableHours: existingAssignee?.availableHours ?? 0,
                        role: existingAssignee?.role ?? '',
                        billingRate: existingAssignee?.billingRate ?? 0,
                        holiday: existingAssignee?.holiday ?? 0,
                        leaves: existingAssignee?.leaves ?? 0,
                        netAvailableCapacity: existingAssignee?.netAvailableCapacity ?? 0,
                        allocationType: existingAssignee?.allocationType,
                    };
                }

                // Calculate allocatedHours based on estimation mode
                if (usesOriginalEstimate) {
                    result[projectKey][assignee].allocatedHours += originalEstimateHrs;
                } else if (issueType === 'Story') {
                    result[projectKey][assignee].storyPoints += storyPoints;
                    result[projectKey][assignee].allocatedHours += storyPoints;
                }
            }
        }

        // Format result to match fetchUserStoryPoints output
        const formattedResult = Object.entries(result).map(([projectKey, assigneesMap]) => {
            const { hours, ...assigneesData } = assigneesMap;
            return {
                projectKey,
                hours,
                assignees: Object.values(assigneesData),
            };
        });

        return formattedResult.length > 0 ? formattedResult[0] : { projectKey: '', hours: false, assignees: [] };
    }

    async addMilestonesForProject(apiBase, gitlabConfig, connection, companyId, projectId, projectIdForApi, projectPath, projectName) {
        // NOTE: Project model mapping:
        // - Iteration (GitLab) = Sprint (in our model)
        // - Milestone (GitLab) = Release (in our model)
        // This function stores GitLab milestones into the Release collection
        
        const JiraRelease = JiraReleaseModel(connection);
        const Board = BoardModel(connection);
        let insertedAny = false;

        // Get the primary board ObjectId for this project (required by Release schema)
        // Releases require a boardId, so we use the project's primary board
        const boards = await Board.find({ companyId, projectId });
        const primaryBoard = boards.length > 0 ? boards[0] : null;
        const primaryBoardObjectId = primaryBoard ? primaryBoard._id : null;

        if (!primaryBoardObjectId) {
            return;
        }

        // Fetch project members to store as milestone assignees
        let projectMembers = [];
        try {
            let projectMembersResp;
            try {
                const url = `${apiBase}/projects/${projectIdForApi}/members/all`;
                projectMembersResp = await this.retryWithDelay(() =>
                    this.gitlabGet(url, gitlabConfig)
                );
            } catch (idError) {
                if (idError.response?.status === 403 || idError.response?.status === 404) {
                    const fallbackUrl = `${apiBase}/projects/${projectPath}/members/all`;
                    projectMembersResp = await this.retryWithDelay(() =>
                        this.gitlabGet(fallbackUrl, gitlabConfig)
                    );
                } else {
                    // Log error but continue - assignees are optional
                    console.log('[GitLab Issues][milestones] Error fetching project members, continuing without assignees', {
                        error: idError?.message,
                        status: idError?.response?.status,
                    });
                }
            }
            
            if (projectMembersResp?.data) {
                const rawProjectMembers = projectMembersResp.data || [];
                // Map project members to Release assignees format
                // Match the exact structure from fetchUserStoryPoints in syncJiraService.js
                projectMembers = rawProjectMembers
                    .filter(m => m.state === STATUS_ACTIVE) // Only include active members
                    .map((m) => ({
                        assignee: m.name || m.username || m.email || String(m.id || ''),
                        storyPoints: 0,
                        allocatedHours: 0,
                        availableHours: 0,
                        role: '',
                        billingRate: 0,
                        holiday: 0,
                        leaves: 0,
                        netAvailableCapacity: 0,
                        // allocationType is not set initially, only preserved from existing/original/previous assignees
                    }));
            }
        } catch (e) {
            // Log error but continue - assignees are optional
            console.log('[GitLab Issues][milestones] Error fetching project members for assignees, continuing without assignees', {
                projectName,
                error: e?.message,
            });
        }

        // Fetch milestones from GitLab API
        try {
            let milestonesResp;
            try {
                milestonesResp = await this.retryWithDelay(() =>
                    this.gitlabGet(`${apiBase}/projects/${projectIdForApi}/milestones`, gitlabConfig, { state: 'all' })
                );
            } catch (idError) {
                if (idError.response?.status === 403 || idError.response?.status === 404) {
                    milestonesResp = await this.retryWithDelay(() =>
                        this.gitlabGet(`${apiBase}/projects/${projectPath}/milestones`, gitlabConfig, { state: 'all' })
                    );
                } else {
                    throw idError;
                }
            }

            const milestones = milestonesResp.data || [];

            // Process milestones for the project (milestones are project-level, stored as Releases)
            // Map GitLab milestone fields to Release model fields:
            // - milestone.title/name → releaseName
            // - milestone.start_date → startDate
            // - milestone.due_date → releaseDate
            // - milestone.state → status
            // - milestone.expired → overdue
            const bulkOps = milestones.map((milestone) => {
                const releaseName = milestone.title || milestone.name || '';
                const startDate = milestone.start_date ? new Date(milestone.start_date) : null;
                const releaseDate = milestone.due_date ? new Date(milestone.due_date) : null;
                
                // Map GitLab expired field to Release overdue field
                const overdue = milestone.expired === true || milestone.expired === 'true' || false;

                // Determine status: active, closed, or future
                // Map GitLab milestone state to Release status
                let status = milestone.state || MILESTONE_STATUS_FUTURE;
                if (status === MILESTONE_STATUS_ACTIVE) {
                    status = MILESTONE_STATUS_ACTIVE;
                } else if (status === MILESTONE_STATUS_CLOSED) {
                    status = MILESTONE_STATUS_CLOSED;
                } else {
                    // If no state but has dates, determine based on dates
                    if (startDate && releaseDate) {
                        const now = new Date();
                        if (startDate <= now && now <= releaseDate) {
                            status = MILESTONE_STATUS_ACTIVE;
                        } else if (releaseDate < now) {
                            status = MILESTONE_STATUS_CLOSED;
                        } else {
                            status = MILESTONE_STATUS_FUTURE;
                        }
                    } else {
                        status = MILESTONE_STATUS_FUTURE;
                    }
                }

                // Use releaseName, projectId, and boardId as unique identifier
                // (Release model doesn't have a numeric ID field like Sprint's sprintId)
                // Note: gitlabMilestoneId is not in Release schema, but we use releaseName for uniqueness
                // NOTE: Do NOT include assignees in bulk write to preserve existing assignee data
                // Assignees will be handled separately by fetchMilestoneAssignees (similar to syncJiraService)
                const updateData = {
                    companyId,
                    projectId,
                    boardId: primaryBoardObjectId, // Required by Release schema
                    releaseName: releaseName, // GitLab milestone title/name
                    startDate: startDate || new Date(), // Required by Release schema, use milestone start_date or current date as fallback
                    releaseDate: releaseDate || new Date(), // Required by Release schema, use milestone due_date or current date as fallback
                    status: status, // Map GitLab milestone state to Release status
                    overdue: overdue, // Map GitLab milestone expired field to Release overdue field
                };
                
                return {
                    updateOne: {
                        filter: { 
                            companyId, 
                            projectId, 
                            boardId: primaryBoardObjectId,
                            releaseName: releaseName
                        },
                        update: {
                            $set: updateData,
                        },
                        upsert: true,
                    },
                };
            });

            if (bulkOps.length) {
                await JiraRelease.bulkWrite(bulkOps);
                insertedAny = true;
                
                // Calculate allocatedHours from issues for each milestone (matching fetchUserStoryPoints logic)
                const BoardIssue = BoardIssueModel(connection);
                for (const milestone of milestones) {
                    try {
                        const releaseName = milestone.title || milestone.name || '';
                        if (!releaseName) {continue;}

                        // Fetch existing release to get current assignees
                        const existingRelease = await JiraRelease.findOne({
                            companyId,
                            projectId,
                            boardId: primaryBoardObjectId,
                            releaseName: releaseName,
                        }).lean();

                        // For new releases (no existing assignees), initialize with projectMembers
                        // This preserves the behavior of setting initial assignees while not resetting existing ones
                        if (!existingRelease?.assignees || existingRelease.assignees.length === 0) {
                            if (projectMembers.length > 0) {
                                await JiraRelease.updateOne(
                                    {
                                        companyId,
                                        projectId,
                                        boardId: primaryBoardObjectId,
                                        releaseName: releaseName,
                                    },
                                    {
                                        $set: {
                                            assignees: projectMembers,
                                        },
                                    }
                                );
                            }
                        }

                        // Fetch all BoardIssue documents for this milestone (fixVersion matches releaseName)
                        const milestoneIssues = await BoardIssue.find({
                            companyId,
                            projectId,
                            boardId: primaryBoardObjectId,
                            fixVersion: releaseName,
                        }).lean();

                        if (milestoneIssues.length > 0) {
                            // Calculate allocatedHours using the same logic as fetchUserStoryPoints
                            const existingAssignees = existingRelease?.assignees || [];
                            const calculatedData = this.calculateAllocatedHoursFromIssues(milestoneIssues, existingAssignees);

                            if (calculatedData.assignees && calculatedData.assignees.length > 0) {
                                // Create a map of calculated assignees by assignee name
                                const calculatedAssigneesMap = new Map();
                                calculatedData.assignees.forEach((a) => {
                                    calculatedAssigneesMap.set(a.assignee, a);
                                });

                                // Merge calculated assignees with existing ones to preserve metadata
                                // Start with calculated assignees (from issues), then merge in existing metadata
                                const updatedAssignees = calculatedData.assignees.map((newAssignee) => {
                                    const existing = existingAssignees.find((a) => a.assignee === newAssignee.assignee);
                                    
                                    if (existing) {
                                        // Preserve metadata from existing assignee (matching fetchUserStoryPoints logic)
                                        newAssignee.availableHours = existing.availableHours ?? newAssignee.availableHours ?? 0;
                                        newAssignee.role = existing.role ?? newAssignee.role ?? '';
                                        newAssignee.billingRate = existing.billingRate ?? newAssignee.billingRate ?? 0;
                                        newAssignee.allocationType = existing.allocationType ?? newAssignee.allocationType;
                                        newAssignee.netAvailableCapacity = existing.netAvailableCapacity ?? newAssignee.netAvailableCapacity ?? 0;
                                        newAssignee.holiday = existing.holiday ?? newAssignee.holiday ?? 0;
                                        newAssignee.leaves = existing.leaves ?? newAssignee.leaves ?? 0;
                                    }

                                    return newAssignee;
                                });

                                // Add any existing assignees that weren't in the calculated list (from issues)
                                // These are project members who don't have issues assigned yet
                                existingAssignees.forEach((existingAssignee) => {
                                    if (!calculatedAssigneesMap.has(existingAssignee.assignee)) {
                                        // Keep existing assignee but reset allocatedHours to 0 if it wasn't calculated
                                        updatedAssignees.push({
                                            ...existingAssignee,
                                            allocatedHours: 0,
                                            storyPoints: 0,
                                        });
                                    }
                                });

                                // Update release with calculated assignees and hours flag
                                await JiraRelease.updateOne(
                                    {
                                        companyId,
                                        projectId,
                                        boardId: primaryBoardObjectId,
                                        releaseName: releaseName,
                                    },
                                    {
                                        $set: {
                                            assignees: updatedAssignees,
                                            hours: calculatedData.hours || false,
                                        },
                                    }
                                );
                            }
                        } else {
                            // No issues found, but keep existing assignees structure if it exists
                            // This preserves projectMembers that were set initially
                            if (existingRelease?.assignees && existingRelease.assignees.length > 0) {
                                console.log('[GitLab Issues][milestones] No issues found for milestone, keeping existing assignees', {
                                    releaseName,
                                    existingAssigneesCount: existingRelease.assignees.length,
                                });
                            }
                        }
                    } catch (e) {
                        // Log error but continue processing other milestones
                        console.log('[GitLab Issues][milestones] Error calculating allocatedHours for milestone', {
                            milestoneTitle: milestone.title || milestone.name,
                            error: e?.message,
                        });
                    }
                }
            }
        } catch (e) {
            console.log('[GitLab Issues][milestones] Fetch failed', {
                projectName: projectName,
                status: e?.response?.status,
                message: e?.message,
            });
        }

        if (!insertedAny) {
            console.log('[GitLab Issues][milestones] No milestones inserted for project', { projectName });
        }
    }

    async syncProjectIssuesForProject(apiBase, gitlabConfig, connection, companyId, projectId, projectIdForApi, projectPath, projectKeyId, boardsData, projectName, type) {
        // NOTE: Project model mapping:
        // - Iteration (GitLab) = Sprint (in our model) → stored in SprintIssue
        // - Milestone (GitLab) = Release (in our model) → stored in BoardIssue
        // This function routes milestone issues to BoardIssue and iteration issues to SprintIssue
        
        const SprintIssue = SprintIssueModel(connection);
        const BoardIssue = BoardIssueModel(connection);
        const JiraRelease = JiraReleaseModel(connection);
        const Board = BoardModel(connection);

        // Map numeric boardId → Board ObjectId for this project
        const boardMap = new Map();
        const boards = await Board.find({ companyId, projectId });
        for (const b of boards) {
            boardMap.set(b.boardId, b._id);
        }

        // Get primary board for issues without specific board assignment
        const primaryBoard = boardsData[0];
        const primaryBoardObjectId = primaryBoard ? boardMap.get(primaryBoard.boardId) || null : null;

        // Calculate today's date range for createdAt filter (matching Jira pattern)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            let allIssues = [];
            let activeReleaseId = null;
            let activeReleaseBoardId = null;
            let mostRecentPastReleaseForLight = null;

            if (type === 'light') {
                // Find active release from JiraRelease collection (milestones are now releases)
                const activeRelease = await JiraRelease.findOne({ 
                    companyId, 
                    projectId, 
                    status: MILESTONE_STATUS_ACTIVE 
                }).lean();

                if (!activeRelease) {
                    return;
                }

                mostRecentPastReleaseForLight = await JiraRelease.findOne({
                    companyId,
                    projectId,
                    status: { $in: [MILESTONE_STATUS_CLOSED, RELEASE_STATUS_RELEASED] },
                    releaseDate: { $exists: true, $ne: null },
                })
                    .sort({ releaseDate: -1 })
                    .lean();

                // Store the active release's _id and boardId for direct use
                activeReleaseId = activeRelease._id;
                activeReleaseBoardId = activeRelease.boardId || primaryBoardObjectId;

                // Fetch issues only for the active milestone/release
                let page = 1;
                const perPage = 100;
                let hasMore = true;

                while (hasMore) {
                    let issuesResp;
                    try {
                        issuesResp = await this.retryWithDelay(() =>
                            this.gitlabGet(`${apiBase}/projects/${projectIdForApi}/issues`, gitlabConfig, {
                                page,
                                per_page: perPage,
                                state: 'all',
                                milestone: activeRelease.releaseName, // Filter by active release name
                            })
                        );
                    } catch (idError) {
                        if (idError.response?.status === 403 || idError.response?.status === 404) {
                            issuesResp = await this.retryWithDelay(() =>
                                this.gitlabGet(`${apiBase}/projects/${projectPath}/issues`, gitlabConfig, {
                                    page,
                                    per_page: perPage,
                                    state: 'all',
                                    milestone: activeRelease.releaseName,
                                })
                            );
                        } else {
                            throw idError;
                        }
                    }

                    const issues = issuesResp.data || [];
                    allIssues = allIssues.concat(issues);

                    const totalPages = parseInt(issuesResp.headers['x-total-pages'] || '1', 10);
                    hasMore = page < totalPages && issues.length === perPage;
                    page++;
                }

                if (
                    mostRecentPastReleaseForLight?.releaseName &&
                    mostRecentPastReleaseForLight.releaseName !== activeRelease.releaseName
                ) {
                    page = 1;
                    hasMore = true;
                    while (hasMore) {
                        let issuesResp;
                        try {
                            issuesResp = await this.retryWithDelay(() =>
                                this.gitlabGet(`${apiBase}/projects/${projectIdForApi}/issues`, gitlabConfig, {
                                    page,
                                    per_page: perPage,
                                    state: 'all',
                                    milestone: mostRecentPastReleaseForLight.releaseName,
                                })
                            );
                        } catch (idError) {
                            if (idError.response?.status === 403 || idError.response?.status === 404) {
                                issuesResp = await this.retryWithDelay(() =>
                                    this.gitlabGet(`${apiBase}/projects/${projectPath}/issues`, gitlabConfig, {
                                        page,
                                        per_page: perPage,
                                        state: 'all',
                                        milestone: mostRecentPastReleaseForLight.releaseName,
                                    })
                                );
                            } else {
                                throw idError;
                            }
                        }

                        const issues = issuesResp.data || [];
                        allIssues = allIssues.concat(issues);

                        const totalPages = parseInt(issuesResp.headers['x-total-pages'] || '1', 10);
                        hasMore = page < totalPages && issues.length === perPage;
                        page++;
                    }
                }
            } else {
                let page = 1;
                const perPage = 100;
                let hasMore = true;

                while (hasMore) {
                    let issuesResp;
                    try {
                        issuesResp = await this.retryWithDelay(() =>
                            this.gitlabGet(`${apiBase}/projects/${projectIdForApi}/issues`, gitlabConfig, {
                                page,
                                per_page: perPage,
                                state: 'all', // Get all issues (opened and closed)
                            })
                        );
                    } catch (idError) {
                        if (idError.response?.status === 403 || idError.response?.status === 404) {
                            issuesResp = await this.retryWithDelay(() =>
                                this.gitlabGet(`${apiBase}/projects/${projectPath}/issues`, gitlabConfig, {
                                    page,
                                    per_page: perPage,
                                    state: 'all',
                                })
                            );
                        } else {
                            throw idError;
                        }
                    }

                    const issues = issuesResp.data || [];
                    allIssues = allIssues.concat(issues);

                    const totalPages = parseInt(issuesResp.headers['x-total-pages'] || '1', 10);
                    hasMore = page < totalPages && issues.length === perPage;
                    page++;
                }
            }

            if (!allIssues.length) {
                return;
            }

            // Get all releases (milestones) for this project to map issue milestones
            const releases = await JiraRelease.find({ companyId, projectId }).lean();
            const releaseMap = new Map(); // releaseName -> Release _id
            const releaseIdsList = []; // For debugging
            
            for (const r of releases) {
                if (r.releaseName) {
                    releaseMap.set(r.releaseName, r._id);
                    releaseIdsList.push({ releaseName: r.releaseName, releaseId: r._id });
                }
            }

            // Determine which issues to process based on sync type
            let issuesToProcess = [];
            if (type === 'light') {
                // Light sync: Only issues with milestones (releases)
                issuesToProcess = allIssues.filter((issue) => issue.milestone && issue.milestone.id);
            } else {
                // Hard sync: ALL issues regardless of milestone/iteration
                issuesToProcess = allIssues;
            }

            if (issuesToProcess.length) {
                // Separate issues into milestone-related (BoardIssue) and iteration-related (SprintIssue)
                const boardIssueOps = [];
                const sprintIssueOps = [];
                
                for (const issue of issuesToProcess) {
                    const issueIid = issue.iid || issue.id;
                    const hasMilestone = issue.milestone && issue.milestone.id;
                    const hasIteration = issue.iteration_id || issue.iteration; // Check for iteration field
                    
                    // Handle assignee - GitLab can have single assignee or assignees array
                    let assignee = null;
                    if (issue.assignees && Array.isArray(issue.assignees) && issue.assignees.length > 0) {
                        assignee = issue.assignees[0].name || issue.assignees[0].username || null;
                    } else if (issue.assignee) {
                        assignee = issue.assignee.name || issue.assignee.username || null;
                    }

                    const labels = Array.isArray(issue.labels) ? issue.labels : [];
                    const status = issue.state || 'opened';
                    
                    // Map GitLab issue weight to storyPoints
                    // GitLab uses 'weight' field to represent story points/effort estimation
                    const storyPoints = issue.weight ? Number(issue.weight) : 0;

                    // Fetch statusChangeLog from GitLab resource state events
                    let statusChangeLog = [];
                    try {
                        let resourceStateEventsResp;
                        try {
                            resourceStateEventsResp = await this.retryWithDelay(() =>
                                this.gitlabGet(`${apiBase}/projects/${projectIdForApi}/issues/${issueIid}/resource_state_events`, gitlabConfig)
                            );
                        } catch (idError) {
                            if (idError.response?.status === 403 || idError.response?.status === 404) {
                                resourceStateEventsResp = await this.retryWithDelay(() =>
                                    this.gitlabGet(`${apiBase}/projects/${projectPath}/issues/${issueIid}/resource_state_events`, gitlabConfig)
                                );
                            } else {
                                throw idError;
                            }
                        }

                        const resourceStateEvents = resourceStateEventsResp.data || [];
                        // Map resource state events to statusChangeLog format
                        // GitLab resource state events track state changes (opened/closed/reopened)
                        // Sort events by created_at to process in chronological order
                        const sortedEvents = [...resourceStateEvents]
                            .filter((event) => event.state) // Only events with state changes
                            .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
                        
                        statusChangeLog = sortedEvents.map((event, index) => {
                            // Determine the "from" state:
                            // - For the first event, use 'opened' as default (issue starts as opened)
                            // - For subsequent events, use the previous event's state
                            const fromState = index === 0 
                                ? (event.previous_state || 'opened')
                                : (sortedEvents[index - 1].state || 'opened');
                            const toState = event.state || 'opened';
                            
                            return {
                                changedAt: new Date(event.created_at || event.updated_at),
                                from: fromState,
                                to: toState,
                            };
                        });
                    } catch (error) {
                        console.error(`[GitLab Issues][projectIssues] Error fetching resource state events for issue ${issueIid}:`, error.message);
                        // Continue without statusChangeLog if fetch fails
                    }

                    // Extract all fields from the issue object
                    let customFields = {};
                    let customFieldsByName = {};
                    try {
                        ({ byId: customFields, byName: customFieldsByName } = this.extractAllFields(issue));
                    } catch (error) {
                        console.error(`[GitLab Issues][projectIssues] Error extracting all fields for issue ${issueIid}:`, error.message);
                        // Fallback to basic fields if extraction fails
                        customFields = {
                            description: issue.description || '',
                            web_url: issue.web_url || '',
                            gitlab_issue_id: issue.id,
                            gitlab_iid: issue.iid,
                            milestone_id: issue.milestone?.id || null,
                            milestone_title: issue.milestone?.title || '',
                            iteration_id: issue.iteration_id || null,
                            weight: issue.weight || null,
                        };
                        customFieldsByName = {
                            description: issue.description || '',
                            web_url: issue.web_url || '',
                            gitlab_issue_id: issue.id,
                            gitlab_iid: issue.iid,
                            milestone_id: issue.milestone?.id || null,
                            milestone_title: issue.milestone?.title || '',
                            iteration_id: issue.iteration_id || null,
                            weight: issue.weight || null,
                        };
                    }

                    // Process milestone-related issues → BoardIssue (Releases)
                    if (hasMilestone) {
                        let releaseObjectId = null;
                        let boardObjectId = primaryBoardObjectId;
                        
                        if (type === 'light') {
                            const milestoneTitle = issue.milestone.title || issue.milestone.name;
                            if (
                                mostRecentPastReleaseForLight &&
                                milestoneTitle === mostRecentPastReleaseForLight.releaseName
                            ) {
                                releaseObjectId = mostRecentPastReleaseForLight._id;
                                boardObjectId = mostRecentPastReleaseForLight.boardId || primaryBoardObjectId;
                            } else {
                                releaseObjectId = activeReleaseId;
                                boardObjectId = activeReleaseBoardId;
                            }
                        } else {
                            // Hard sync: Find release by milestone name
                            const milestoneName = issue.milestone.title || issue.milestone.name;
                            releaseObjectId = releaseMap.get(milestoneName);
                            
                            if (releaseObjectId) {
                                // Matching Release found in database
                                const matchedRelease = releases.find(r => r._id.toString() === releaseObjectId.toString());
                                boardObjectId = matchedRelease && matchedRelease.boardId ? matchedRelease.boardId : primaryBoardObjectId;
                            } else {
                                // Milestone exists in GitLab but not in our Release collection
                                releaseObjectId = null;
                            }
                        }

                        // Get existing BoardIssue to merge statusChangeLog
                        const existingBoardIssue = await BoardIssue.findOne({
                            companyId,
                            projectId,
                            boardId: boardObjectId,
                            issueId: issueIid,
                        }).lean();

                        // Merge with existing statusChangeLog
                        const allStatusLogs = [...(existingBoardIssue?.statusChangeLog || []), ...statusChangeLog];
                        const uniqueStatusChangeLog = Array.from(
                            new Map(allStatusLogs.map((log) => [log.changedAt.toISOString(), log])).values()
                        );
                        uniqueStatusChangeLog.sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));

                        const issueType = issue.type || 'Issue';
                        
                        // Calculate isAccepted flag for Bug-type issues
                        const isAcceptedResult = calculateIsAccepted(
                            { name: issueType },
                            { name: status },
                            labels,
                            customFieldsByName,
                            [] // Comments not fetched
                        );
                        
                        let isAccepted = null;
                        if (isAcceptedResult !== null) {
                            isAccepted = isAcceptedResult.isAccepted;
                        }

                        // Build BoardIssue operation (for milestone/release issues)
                        const boardIssueOp = {
                            updateOne: {
                                filter: {
                                    companyId,
                                    projectId,
                                    boardId: boardObjectId,
                                    issueId: issueIid,
                                    createdAt: {
                                        $gte: today,
                                        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
                                    },
                                },
                                update: {
                                    $set: {
                                        companyId,
                                        projectId,
                                        boardId: boardObjectId,
                                        issueId: issueIid,
                                        key: String(issueIid),
                                        summary: issue.title || '',
                                        type: { name: issueType },
                                        status: { name: status },
                                        assignee: assignee,
                                        issueCreatedAt: issue.created_at ? new Date(issue.created_at) : null,
                                        issueUpdatedAt: issue.updated_at ? new Date(issue.updated_at) : null,
                                        projectKeyId,
                                        label: labels,
                                        duedate: issue.due_date ? new Date(issue.due_date) : null,
                                        fixVersion: issue.milestone?.title || issue.milestone?.name || '', // Store milestone name as fixVersion
                                        storyPoints: storyPoints, // Map GitLab weight to storyPoints
                                        customFields,
                                        customFieldsByName,
                                        statusChangeLog: uniqueStatusChangeLog,
                                        isAccepted,
                                    },
                                    $setOnInsert: {
                                        createdAt: today,
                                    },
                                },
                                upsert: true,
                            },
                        };
                        
                        boardIssueOps.push(boardIssueOp);
                    }

                    // Process iteration-related issues → SprintIssue (Sprints)
                    if (hasIteration) {
                        const sprintObjectId = null;
                        let boardObjectId = primaryBoardObjectId;
                        
                        // Note: Map iteration to sprint based on your iteration sync logic
                        // For now, this is a placeholder - you may need to sync iterations separately
                        // and create a mapping similar to milestoneMap
                        
                        if (sprintObjectId) {
                            boardObjectId = primaryBoardObjectId; // Use primary board for sprint issues

                            // Get existing SprintIssue to merge statusChangeLog
                            const existingSprintIssue = await SprintIssue.findOne({
                                companyId,
                                projectId,
                                sprintId: sprintObjectId,
                                issueId: issueIid,
                            }).lean();

                            // Merge with existing statusChangeLog
                            const allStatusLogs = [...(existingSprintIssue?.statusChangeLog || []), ...statusChangeLog];
                            const uniqueStatusChangeLog = Array.from(
                                new Map(allStatusLogs.map((log) => [log.changedAt.toISOString(), log])).values()
                            );
                            uniqueStatusChangeLog.sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));

                            const issueType = issue.type || 'Issue';
                            
                            // Calculate isAccepted flag for Bug-type issues
                            const isAcceptedResult = calculateIsAccepted(
                                { name: issueType },
                                { name: status },
                                labels,
                                customFieldsByName,
                                [] // Comments not fetched
                            );
                            
                            let isAccepted = null;
                            if (isAcceptedResult !== null) {
                                isAccepted = isAcceptedResult.isAccepted;
                            }

                            // Build SprintIssue operation (for iteration/sprint issues)
                            const sprintIssueOp = {
                                updateOne: {
                                    filter: {
                                        companyId,
                                        projectId,
                                        sprintId: sprintObjectId,
                                        issueId: issueIid,
                                    },
                                    update: {
                                        $set: {
                                            companyId,
                                            projectId,
                                            sprintId: sprintObjectId,
                                            boardId: boardObjectId,
                                            issueId: issueIid,
                                            key: String(issueIid),
                                            summary: issue.title || '',
                                            type: { name: issueType },
                                            status: { name: status },
                                            assignee: assignee,
                                            issueCreatedAt: issue.created_at ? new Date(issue.created_at) : null,
                                            issueUpdatedAt: issue.updated_at ? new Date(issue.updated_at) : null,
                                            projectKeyId,
                                            label: labels,
                                            duedate: issue.due_date ? new Date(issue.due_date) : null,
                                            storyPoints: storyPoints, // Map GitLab weight to storyPoints
                                            customFields,
                                            customFieldsByName,
                                            statusChangeLog: uniqueStatusChangeLog,
                                            isAccepted,
                                        },
                                    },
                                    upsert: true,
                                },
                            };
                            
                            sprintIssueOps.push(sprintIssueOp);
                        } else {
                            console.log('hasIteration - False');
                            
                        }
                    }
                }

                // Bulk write milestone issues to BoardIssue
                if (boardIssueOps.length) {
                    await BoardIssue.bulkWrite(boardIssueOps, { ordered: false });
                }

                // Bulk write iteration issues to SprintIssue
                if (sprintIssueOps.length) {
                    await SprintIssue.bulkWrite(sprintIssueOps, { ordered: false });
                }
            }

        } catch (e) {
            console.log('[GitLab Issues][projectIssues] Sync failed', {
                projectName,
                status: e?.response?.status,
                message: e?.message,
            });
            throw e;
        }
    }

    async addUser(apiBase, gitlabConfig, companyId, connection, projectId) {
        const Project = ProjectModel(connection);
        const Board = BoardModel(connection);
        const projects = await Project.find({
            companyId,
            projectTypeKey: 'gitlab-project',
            ...(projectId && Types.ObjectId.isValid(projectId) ? { _id: new Types.ObjectId(projectId) } : {}),
        });        
        for (const proj of projects) {
            try {
                const projectIdForApi = proj.projectKeyId || encodeURIComponent(proj.key || proj.name);
                const projectPath = encodeURIComponent(proj.key || proj.name);
                
                // Step 1: Fetch project members and update Project collection (similar to Jira)
                let projectMembersResp;
                try {
                    const url = `${apiBase}/projects/${projectIdForApi}/members/all`;
                    projectMembersResp = await this.retryWithDelay(() =>
                        this.gitlabGet(url, gitlabConfig)
                    );
                } catch (idError) {
                    if (idError.response?.status === 403 || idError.response?.status === 404) {
                        const fallbackUrl = `${apiBase}/projects/${projectPath}/members/all`;
                        projectMembersResp = await this.retryWithDelay(() =>
                            this.gitlabGet(fallbackUrl, gitlabConfig)
                        );
                    } else {
                        throw idError;
                    }
                }
                
                const rawProjectMembers = projectMembersResp.data || [];
                const projectAssignees = rawProjectMembers.map((m) => ({
                    accountId: String(m.id || ''),
                    displayName: m.name || m.username || '',
                    emailAddress: m.email || m.username || '',
                    active: m.state === STATUS_ACTIVE,
                }));
                
                // Update Project collection with assignees (similar to Jira)
                await Project.updateOne({ _id: proj._id }, { $set: { assignees: projectAssignees } }, { upsert: true });
                // Step 2: Update Board-level assignees (existing logic)
                const boards = await Board.find({ companyId, projectId: proj._id });
                for (const b of boards) {
                    try {
                        // Try with project ID first, fallback to path
                        let membersResp;
                        try {
                            const url = `${apiBase}/projects/${projectIdForApi}/members/all`;
                            membersResp = await this.retryWithDelay(() =>
                                this.gitlabGet(url, gitlabConfig)
                            );
                        } catch (idError) {
                            if (idError.response?.status === 403 || idError.response?.status === 404) {
                                const fallbackUrl = `${apiBase}/projects/${projectPath}/members/all`;
                                membersResp = await this.retryWithDelay(() =>
                                    this.gitlabGet(fallbackUrl, gitlabConfig)
                                );
                            } else {
                                throw idError;
                            }
                        }
                        
                        const rawMembers = membersResp.data || [];
                        const members = rawMembers.map((m) => ({
                            accountId: String(m.id || ''),
                            displayName: m.name || m.username || '',
                            emailAddress: m.email || m.username || '',
                            active: m.state === STATUS_ACTIVE,
                        }));
                        
                        await Board.updateOne({ _id: b._id }, { $set: { assignees: members } });
                    } catch (e) {
                        // ignore per board
                        console.log('[GitLab Issues][addUser] Error fetching members for board', {
                            boardName: b.boardName,
                            boardId: b.boardId,
                            error: e?.message,
                            status: e?.response?.status,
                            statusText: e?.response?.statusText,
                        });
                    }
                }
            } catch (e) {
                // ignore per project
                console.log('[GitLab Issues][addUser] Error processing project', {
                    project: proj.name,
                    projectKeyId: proj.projectKeyId,
                    error: e?.message,
                    status: e?.response?.status,
                });
            }
        }
    }

    async churnDataMap(companyId, tenantConnection, type, projectId) {
        try {
            const Sprint = SprintModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const results = [];
            const res = [];

            // Get projects - project -> Sprint (no board filtering)
            const projectFilter = { 
                companyId,
                projectTypeKey: 'gitlab-project'
            };
            if (projectId && Types.ObjectId.isValid(projectId)) {
                projectFilter._id = new Types.ObjectId(projectId);
            }
            const projects = await Project.find(projectFilter).lean();

            if (projects.length === 0) {
                return [];
            }
            // Process each project -> Sprint (no board filtering)
            for (const proj of projects) {
                if (type === 'light') {
                    const today = new Date();
                    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
                    const startOfDayBeforeYesterday = new Date(startOfToday);
                    startOfDayBeforeYesterday.setDate(startOfDayBeforeYesterday.getDate() - 2);

                    // Get active sprints for this project
                    const activeSprints = await Sprint.find({
                        companyId: typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId,
                        projectId: proj._id,
                        state: MILESTONE_STATUS_ACTIVE,
                    }).select('_id name projectId startDate completeDate state');

                    const newSprintStartedToday = await Sprint.findOne({
                        companyId: typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId,
                        projectId: proj._id,
                        state: MILESTONE_STATUS_ACTIVE,
                        startDate: { $gte: startOfToday, $lt: endOfToday },
                    }).select('_id projectId startDate');

                    const sprintsToProcess = [...activeSprints];

                    if (newSprintStartedToday) {
                        const latestClosedSprint = await Sprint.findOne({
                            companyId: typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId,
                            projectId: proj._id,
                            state: MILESTONE_STATUS_CLOSED,
                            completeDate: { $gte: startOfDayBeforeYesterday, $lte: today },
                        })
                            .sort({ completeDate: -1 })
                            .select('_id name projectId completeDate');

                        if (latestClosedSprint) {
                            sprintsToProcess.push(latestClosedSprint);
                        }
                    }

                    const latestSprintByEndDate = await Sprint.findOne({
                        companyId: typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId,
                        projectId: proj._id,
                        state: { $in: [MILESTONE_STATUS_CLOSED, STATUS_CLOSED] },
                        endDate: { $exists: true, $ne: null },
                    })
                        .sort({ endDate: -1 })
                        .lean();

                    if (
                        latestSprintByEndDate &&
                        !sprintsToProcess.some((s) => s._id.toString() === latestSprintByEndDate._id.toString())
                    ) {
                        sprintsToProcess.push(latestSprintByEndDate);
                    }

                    for (const sprint of sprintsToProcess) {
                        const churnData = await this.calculateSprintStoryChurn(companyId, tenantConnection, sprint._id, sprint.projectId);
                        if (churnData && !churnData.message) {
                            results.push(churnData);
                            await Sprint.findByIdAndUpdate(sprint._id, { $set: { storyChurn: churnData } });
                        }
                    }

                    // Process releases for this project
                    const threeDaysAgo = new Date(today);
                    threeDaysAgo.setDate(today.getDate() - 3);
                    const fiveDaysAgo = new Date(today);
                    fiveDaysAgo.setDate(today.getDate() - 5);

                    const [recentlyClosedReleases, latestUnreleasedReleases] = await Promise.all([
                        // Recently closed releases (within 5 days)
                        JiraRelease.find({
                            companyId: typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId,
                            projectId: proj._id,
                            status: RELEASE_STATUS_RELEASED,
                            releaseDate: { $gte: fiveDaysAgo, $lte: today },
                        })
                            .select('_id releaseName projectId')
                            .sort({ releaseDate: -1 })
                            .lean(),
                        // Latest unreleased releases (started within 3 days)
                        JiraRelease.find({
                            companyId: typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId,
                            projectId: proj._id,
                            status: MILESTONE_STATUS_ACTIVE,
                            // startDate: { $exists: true, $ne: null, $gte: threeDaysAgo },
                            // $or: [{ releaseDate: { $exists: false } }, { releaseDate: null }, { releaseDate: { $gte: threeDaysAgo } }],
                        })
                            .select('_id releaseName projectId')
                            .sort({ releaseDate: -1 })
                            .lean(),
                    ]);

                    // Combine both arrays and remove duplicates based on _id
                    const allReleases = [...recentlyClosedReleases, ...latestUnreleasedReleases];
                    const pendingFixVersions = allReleases.filter((release, index, self) => index === self.findIndex((r) => r._id.toString() === release._id.toString()));

                    const latestReleaseByReleaseDate = await JiraRelease.findOne({
                        companyId: typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId,
                        projectId: proj._id,
                        status: { $in: [MILESTONE_STATUS_CLOSED, RELEASE_STATUS_RELEASED] },
                        releaseDate: { $exists: true, $ne: null },
                    })
                        .sort({ releaseDate: -1 })
                        .select('_id releaseName projectId')
                        .lean();

                    if (
                        latestReleaseByReleaseDate &&
                        !pendingFixVersions.some((r) => r._id.toString() === latestReleaseByReleaseDate._id.toString())
                    ) {
                        pendingFixVersions.push(latestReleaseByReleaseDate);
                    }

                    if (pendingFixVersions.length) {
                        for (const version of pendingFixVersions) {
                            const churnData = await this.calculateReleaseStoryChurn(companyId, tenantConnection, version._id, version.projectId);
                            if (churnData && !churnData.message) {
                                res.push(churnData);
                                await JiraRelease.findByIdAndUpdate(version._id, { $set: { releaseChurn: churnData } });
                            }
                        }
                    }
                } else if (type === 'hard') {
                    // Process all sprints for this project
                    const allSprints = await Sprint.find({
                        companyId: typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId,
                        projectId: proj._id,
                        state: { $in: [MILESTONE_STATUS_ACTIVE, MILESTONE_STATUS_CLOSED] },
                    }).select('_id name projectId');

                    for (const sprint of allSprints) {
                        const churnData = await this.calculateSprintStoryChurn(companyId, tenantConnection, sprint._id, sprint.projectId);
                        if (churnData && !churnData.message) {
                            results.push(churnData);
                            await Sprint.findByIdAndUpdate(sprint._id, { $set: { storyChurn: churnData } });
                        }
                    }

                    // Process all releases for this project
                    // Note: GitLab milestones are stored with status 'active', 'closed', or 'future'
                    // Include both GitLab statuses and Jira statuses for backward compatibility
                    const pendingFixVersions = await JiraRelease.find({
                        companyId: typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId,
                        projectId: proj._id,
                        status: { $in: ALL_RELEASE_STATUSES },
                    }).select('_id releaseName projectId');

                    if (pendingFixVersions.length) {
                        for (const version of pendingFixVersions) {
                            const churnData = await this.calculateReleaseStoryChurn(companyId, tenantConnection, version._id, version.projectId );
                            if (churnData && !churnData.message) {
                                res.push(churnData);
                                await JiraRelease.findByIdAndUpdate(version._id, { $set: { releaseChurn: churnData } });
                            }
                        }
                    }
                }
            }
            return results;
        } catch (error) {
            console.error('[GitLab Issues] Story churn calculation error:', error);
            throw error;
        }
    }

    async calculateSprintStoryChurn(companyId, tenantConnection, selectedSprintId, projectId) {
        try {
            const Sprint = SprintModel(tenantConnection);
            const SprintIssue = SprintIssueModel(tenantConnection);

            const companyObjId = typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId;
            const sprintObjId = typeof selectedSprintId === 'string' ? new Types.ObjectId(selectedSprintId) : selectedSprintId;
            const selectedSprintDoc = await Sprint.findOne({
                _id: sprintObjId,
                companyId: companyObjId,
            })
                .select('startDate sprintId endDate state projectId name')
                .lean();

            if (!selectedSprintDoc) {
                console.warn(`[GitLab Issues] Selected sprint not found: sprintId=${selectedSprintId}, companyId=${companyId}`);
                return { message: 'Selected sprint not found in DB' };
            }

            const projectObjId = projectId ? (typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId) : selectedSprintDoc.projectId;
            
            // Get all issues for this sprint - no past sprint logic needed for GitLab
            const matchQuery = {
                companyId: companyObjId,
                projectId: projectObjId,
                sprintId: sprintObjId, // Direct sprintId match
            };

            const selectedIssues = await SprintIssue.aggregate([
                { $match: matchQuery },
                { $sort: { issueId: 1, createdAt: -1 } },
                {
                    $group: {
                        _id: '$issueId',
                        latestIssue: { $first: '$$ROOT' },
                    },
                },
                { $replaceRoot: { newRoot: '$latestIssue' } },
            ], { allowDiskUse: true });

            const latestIssueMap = new Map();
            selectedIssues.forEach((issue) => {
                if (issue.issueId && (!latestIssueMap.has(issue.issueId) || new Date(issue.createdAt) > new Date(latestIssueMap.get(issue.issueId).createdAt))) {
                    latestIssueMap.set(issue.issueId, issue);
                }
            });

            const sprintIssues = Array.from(latestIssueMap.values());
            const groupedByType = {};
            for (const issue of sprintIssues) {
                const issueType = issue.type?.name || 'Unknown';
                if (!groupedByType[issueType]) {
                    groupedByType[issueType] = [];
                }
                groupedByType[issueType].push(issue);
            }

            const churnResults = [];
            for (const [issueType, issues] of Object.entries(groupedByType)) {
                const churn = this.calculateChurnForSprint(selectedSprintDoc.sprintId, selectedSprintDoc, issues, issueType);
                churnResults.push(churn);
            }

            const validatedChurnResults = churnResults
                .map((item) => {
                    if (!item.issueType || typeof item.issueType !== 'string') {
                        console.warn(`[GitLab Issues] Invalid issueType for churn result: ${JSON.stringify(item)}`);
                        return null;
                    }
                    return {
                        issueType: item.issueType,
                        planned: Number(item.planned) || 0,
                        added: Number(item.added) || 0,
                        removed: Number(item.removed) || 0,
                        churnRate: Number(item.churnRate) || 0,
                        developerChurn: (item.developerChurn || []).map((dev) => ({
                            developer: dev.developer || 'UnAssigned',
                            planned: Number(dev.planned) || 0,
                            added: Number(dev.added) || 0,
                            removed: Number(dev.removed) || 0,
                            churnRate: Number(dev.churnRate) || 0,
                        })),
                    };
                })
                .filter((item) => item !== null);
            return validatedChurnResults;
        } catch (error) {
            console.error('[GitLab Issues] Error in calculateSprintStoryChurn:', error);
            throw error;
        }
    }

    async calculateReleaseStoryChurn(companyId, tenantConnection, selectedId, projectId) {
        try {
            const SprintIssue = SprintIssueModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const BoardIssue = BoardIssueModel(tenantConnection);
            const companyObjId = typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId;
            const objId = typeof selectedId === 'string' ? new Types.ObjectId(selectedId) : selectedId;
            const releaseObjId = objId;
            const selectedReleaseDoc = await JiraRelease.findOne({
                _id: releaseObjId,
                companyId: companyObjId,
            })
                .select('startDate status projectId releaseName releaseDate boardId')
                .lean();
            if (!selectedReleaseDoc) {
                console.warn(`[GitLab Issues] Selected release not found: releaseId=${selectedId}, companyId=${companyId}`);
                return { message: 'Selected release not found in DB' };
            }
            const projectObjId = projectId ? (typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId) : selectedReleaseDoc.projectId;
            // For GitLab, we don't filter by boardId - project -> Sprint only
            const projectData = await Project.findOne({ _id: projectObjId });
            
            // Build query for sprint count - no boardId filtering for GitLab
            const sprintCountQuery = {
                companyId: companyObjId,
                projectId: projectObjId,
            };
            
            const sprintCount = await SprintModel(tenantConnection).countDocuments(sprintCountQuery);
            // const isKanban = projectData?.boardType === 'kanban';
            const isKanban = projectData?.boardType === 'kanban' || projectData?.boardType === 'gitlab-board' || ((projectData?.boardType === 'scrum' || projectData?.boardType === 'simple') && sprintCount === 0);
            const IssueModel = isKanban ? BoardIssue : SprintIssue;
            
            // Build query for past releases - no boardId filtering for GitLab
            // Note: GitLab milestones are stored with status 'active', 'closed', or 'future'
            // Include both GitLab statuses and Jira statuses for backward compatibility
            const pastReleasesQuery = {
                projectId: projectObjId,
                companyId: companyObjId,
                startDate: { $lte: selectedReleaseDoc.startDate },
                status: { $in: ALL_RELEASE_STATUSES },
            };
            
            const pastReleases = await JiraRelease.find(pastReleasesQuery)
                .sort({ startDate: -1 })
                .select('releaseName startDate endDate boardId')
                .lean();

            // Fallback: if no past releases, calculate churn for current release only
            let fixVersions;
            if (!pastReleases.length) {
                console.warn(`[GitLab Issues] No past releases found for projectId=${projectObjId}, companyId=${companyId}. Calculating churn for current release only.`);
                fixVersions = [selectedReleaseDoc.releaseName];
            } else {
                fixVersions = pastReleases.map((s) => s.releaseName);
            }
            
            // Build match query with boardId filtering
            const matchQuery = {
                $and: [
                    {
                        $or: [{ fixVersion: { $in: fixVersions } }, { 'releaseChangeLog.toReleaseId': { $in: fixVersions } }, { 'releaseChangeLog.fromReleaseId': { $in: fixVersions } }],
                    },
                    { companyId: companyObjId },
                ],
            };

            // No boardId filtering for GitLab - project -> Sprint only

            const selectedIssues = await IssueModel.aggregate([
                { $match: matchQuery },
                { $sort: { issueId: 1, createdAt: -1 } },
                {
                    $group: {
                        _id: '$issueId',
                        latestIssue: { $first: '$$ROOT' },
                    },
                },
                { $replaceRoot: { newRoot: '$latestIssue' } },
            ], { allowDiskUse: true });
            const latestIssueMap = new Map();
            selectedIssues.forEach((issue) => {
                if (issue.issueId && (!latestIssueMap.has(issue.issueId) || new Date(issue.createdAt) > new Date(latestIssueMap.get(issue.issueId).createdAt))) {
                    latestIssueMap.set(issue.issueId, issue);
                }
            });
            const sprintIssues = Array.from(latestIssueMap.values()).filter(
                (issue) => issue?.fixVersion === selectedReleaseDoc?.releaseName || this.isIssueInRelease(issue, selectedReleaseDoc.releaseName)
            );
            const groupedByType = {};
            for (const issue of sprintIssues) {
                const issueType = issue.type?.name || 'Unknown';
                if (!groupedByType[issueType]) {
                    groupedByType[issueType] = [];
                }
                groupedByType[issueType].push(issue);
            }
            const churnResults = [];
            for (const [issueType, issues] of Object.entries(groupedByType)) {
                const churn = this.calculateChurnForRelease(selectedReleaseDoc.releaseName, selectedReleaseDoc, issues, issueType);
                churnResults.push(churn);
            }
            const validatedChurnResults = churnResults
                .map((item) => {
                    if (!item.issueType || typeof item.issueType !== 'string') {
                        console.warn(`[GitLab Issues] Invalid issueType for churn result: ${JSON.stringify(item)}`);
                        return null;
                    }
                    return {
                        issueType: item.issueType,
                        planned: Number(item.planned) || 0,
                        added: Number(item.added) || 0,
                        removed: Number(item.removed) || 0,
                        churnRate: Number(item.churnRate) || 0,
                        developerChurn: (item.developerChurn || []).map((dev) => ({
                            developer: dev.developer || 'UnAssigned',
                            planned: Number(dev.planned) || 0,
                            added: Number(dev.added) || 0,
                            removed: Number(dev.removed) || 0,
                            churnRate: Number(dev.churnRate) || 0,
                        })),
                    };
                })
                .filter((item) => item !== null);

            return validatedChurnResults;
        } catch (error) {
            console.error('[GitLab Issues] Error in calculateReleaseStoryChurn:', error);
            throw error;
        }
    }

    isIssueInSprint(issue, sprintId) {
        if (!issue.sprintChangeLog || !issue.sprintChangeLog.length) {
            return false;
        }

        const relevantChanges = issue.sprintChangeLog.filter((change) => {
            const toSprintIds = change.toSprintId ? change.toSprintId.split(', ').map((id) => id.trim()) : [];
            const fromSprintIds = change.fromSprintId ? change.fromSprintId.split(', ').map((id) => id.trim()) : [];
            return toSprintIds.includes(sprintId.toString()) || fromSprintIds.includes(sprintId.toString());
        });

        if (!relevantChanges.length) {
            return false;
        }

        if (relevantChanges.length > 1) {
            relevantChanges.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }

        const latestChange = relevantChanges[0];
        const toSprintIds = latestChange.toSprintId ? latestChange.toSprintId.split(', ').map((id) => id.trim()) : [];
        return toSprintIds.includes(sprintId.toString());
    }

    isIssueInRelease(issue, releaseName) {
        if (!issue.releaseChangeLog || !issue.releaseChangeLog.length) {
            return false;
        }

        const relevantChanges = issue.releaseChangeLog.filter((change) => {
            return (change.toReleaseString && change.toReleaseString === releaseName) || (change.fromReleaseString && change.fromReleaseString === releaseName);
        });

        if (!relevantChanges.length) {
            return issue.fixVersion === releaseName;
        }

        if (relevantChanges.length > 1) {
            relevantChanges.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }

        const latestChange = relevantChanges[0];
        return latestChange.toReleaseString && latestChange.toReleaseString === releaseName;
    }

    calculateChurnForSprint(sprintId, sprintInfo, sprintIssues, issueType) {
        try {
            let planned = 0,
                added = 0;
            const removed = 0;
            const developerData = {};
            const sprintStart = sprintInfo.startDate ? new Date(sprintInfo.startDate) : null;

            sprintIssues.forEach((issue) => {
                const assignee = typeof issue.assignee === 'string' ? issue.assignee : issue.assignee?.displayName || issue.assignee?.name || 'UnAssigned';

                if (!developerData[assignee]) {
                    developerData[assignee] = { planned: 0, added: 0, removed: 0 };
                }

                // Simple logic: if issue was created before sprint start, it's planned; otherwise added
                const issueCreatedAt = issue.issueCreatedAt ? new Date(issue.issueCreatedAt) : null;
                
                if (sprintStart && issueCreatedAt) {
                    if (issueCreatedAt <= sprintStart) {
                        planned++;
                        developerData[assignee].planned++;
                    } else {
                        added++;
                        developerData[assignee].added++;
                    }
                } else {
                    // If we don't have dates, treat as planned
                    planned++;
                    developerData[assignee].planned++;
                }
            });

            const churnRate = planned > 0 ? ((added + removed) / planned) * 100 : 0;

            const developerChurn = Object.keys(developerData).map((dev) => {
                const data = developerData[dev];
                const devChurnRate = data.planned > 0 ? ((data.added + data.removed) / data.planned) * 100 : 0;
                return {
                    developer: dev,
                    planned: data.planned,
                    added: data.added,
                    removed: data.removed,
                    churnRate: parseFloat(devChurnRate.toFixed(1)),
                };
            });

            return {
                sprintId,
                issueType,
                planned,
                added,
                removed,
                churnRate: parseFloat(churnRate.toFixed(1)),
                developerChurn,
            };
        } catch (err) {
            console.error('[GitLab Issues] Error in calculateChurnForSprint:', err);
            throw err;
        }
    }

    calculateChurnForRelease(releaseName, releaseInfo, releaseIssues, issueType) {
        try {
            let planned = 0,
                added = 0,
                removed = 0;
            const developerData = {};
            const releaseStart = new Date(releaseInfo.startDate);
            const oneDayAfterStart = new Date(releaseStart);
            oneDayAfterStart.setUTCHours(23, 59, 59, 999);
            const releaseDate = releaseInfo.releaseDate ? new Date(releaseInfo.releaseDate) : new Date();

            releaseIssues.forEach((issue) => {
                const assignee = typeof issue.assignee === 'string' ? issue.assignee : issue.assignee?.displayName || issue.assignee?.name || 'UnAssigned';

                if (!developerData[assignee]) {
                    developerData[assignee] = { planned: 0, added: 0, removed: 0 };
                }

                const { wasPlanned, wasAdded, wasRemoved } = this.analyzeReleaseChanges(issue, releaseName, releaseStart, releaseDate, oneDayAfterStart);

                if (wasPlanned) {
                    planned++;
                    developerData[assignee].planned++;
                }
                if (wasAdded) {
                    added++;
                    developerData[assignee].added++;
                }
                if (wasRemoved) {
                    removed++;
                    developerData[assignee].removed++;
                }
            });

            const churnRate = planned > 0 ? ((added + removed) / planned) * 100 : 0;

            const developerChurn = Object.entries(developerData).map(([dev, data]) => {
                const churn = data.planned > 0 ? ((data.added + data.removed) / data.planned) * 100 : 0;
                return {
                    developer: dev,
                    planned: data.planned,
                    added: data.added,
                    removed: data.removed,
                    churnRate: parseFloat(churn.toFixed(1)),
                };
            });

            return {
                releaseName,
                issueType,
                planned,
                added,
                removed,
                churnRate: parseFloat(churnRate.toFixed(1)),
                developerChurn,
            };
        } catch (err) {
            console.error('[GitLab Issues] Error in calculateChurnForRelease:', err);
            throw err;
        }
    }

    analyzeSprintChanges(issue, sprintId, sprintStartDate, sprintEndDate, oneDayAfterStart) {
        try {
            let wasPlanned = false;
            let wasAdded = false;
            let wasRemoved = false;

            const isCurrentlyInSprintField = issue.sprint?.id === sprintId;

            const changes = Array.isArray(issue.sprintChangeLog) ? [...issue.sprintChangeLog] : [];
            if (changes.length > 1) {
                changes.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            }

            let isCurrentlyInSprintDerived = isCurrentlyInSprintField;
            if (changes.length) {
                const lastForThisSprint = [...changes].reverse().find((ch) => {
                    const fromIds = ch.fromSprintId ? ch.fromSprintId.split(',').map((s) => s.trim()) : [];
                    const toIds = ch.toSprintId ? ch.toSprintId.split(',').map((s) => s.trim()) : [];
                    return fromIds.includes(String(sprintId)) || toIds.includes(String(sprintId));
                });
                if (lastForThisSprint) {
                    const toIds = lastForThisSprint.toSprintId ? lastForThisSprint.toSprintId.split(',').map((s) => s.trim()) : [];
                    isCurrentlyInSprintDerived = toIds.includes(String(sprintId));
                }
            }

            const isCurrentlyInSprint = isCurrentlyInSprintDerived;

            if (isCurrentlyInSprint && new Date(issue.issueCreatedAt) > oneDayAfterStart) {
                return { wasPlanned: false, wasAdded: true, wasRemoved: false };
            }

            if (isCurrentlyInSprint && (!issue.sprintChangeLog || !issue.sprintChangeLog.length)) {
                return { wasPlanned: true, wasAdded: false, wasRemoved: false };
            }

            if (changes.length > 0) {
                const firstAddToSprint = changes.find((change) => {
                    const toSprintIds = change.toSprintId ? change.toSprintId.split(', ').map((id) => id.trim()) : [];
                    return toSprintIds.includes(String(sprintId));
                });

                const removalChanges = changes.filter((change) => {
                    const fromSprintIds = change.fromSprintId ? change.fromSprintId.split(', ').map((id) => id.trim()) : [];
                    const toSprintIds = change.toSprintId ? change.toSprintId.split(', ').map((id) => id.trim()) : [];
                    return fromSprintIds.includes(String(sprintId)) && !toSprintIds.includes(String(sprintId));
                });

                if (removalChanges.length > 0) {
                    wasRemoved = removalChanges.some((change) => {
                        const removalDate = new Date(change.timestamp);
                        return (!sprintStartDate || removalDate >= sprintStartDate) && (!sprintEndDate || removalDate <= sprintEndDate);
                    });
                }

                if (wasRemoved && !isCurrentlyInSprint) {
                    return { wasPlanned: false, wasAdded: false, wasRemoved: true };
                }

                if (firstAddToSprint) {
                    const addedTimestamp = new Date(firstAddToSprint.timestamp);
                    if (sprintStartDate && oneDayAfterStart) {
                        if (addedTimestamp <= oneDayAfterStart) {
                            wasPlanned = true;
                        } else {
                            wasAdded = true;
                        }
                    } else {
                        wasAdded = true;
                    }
                } else if (isCurrentlyInSprint) {
                    wasPlanned = true;
                }
            } else if (isCurrentlyInSprint) {
                wasPlanned = true;
            }

            return { wasPlanned, wasAdded, wasRemoved };
        } catch (error) {
            console.error('[GitLab Issues] Error in analyzeSprintChanges:', error);
            throw error;
        }
    }

    analyzeReleaseChanges(issue, releaseKey, releaseStartDate, releaseDate, oneDayAfterStart) {
        try {
            let wasPlanned = false;
            let wasAdded = false;
            let wasRemoved = false;

            const relKey = String(releaseKey).trim();

            const splitList = (s) =>
                s
                    ? s
                          .split(',')
                          .map((x) => x.trim())
                          .filter(Boolean)
                    : [];
            const hasRelease = (names, ids) => names.includes(relKey) || ids.includes(relKey);

            const isCurrentlyInReleaseField = issue.fixVersion && String(issue.fixVersion).trim() === relKey;

            const changes = Array.isArray(issue.releaseChangeLog) ? [...issue.releaseChangeLog] : [];
            if (changes.length > 1) {
                changes.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            }

            let isCurrentlyInReleaseDerived = isCurrentlyInReleaseField;
            if (changes.length) {
                const lastForThisRelease = [...changes].reverse().find((ch) => {
                    const fromNames = splitList(ch.fromReleaseString);
                    const toNames = splitList(ch.toReleaseString);
                    const fromIds = splitList(ch.fromReleaseId);
                    const toIds = splitList(ch.toReleaseId);
                    return hasRelease(fromNames, fromIds) || hasRelease(toNames, toIds);
                });

                if (lastForThisRelease) {
                    const toNames = splitList(lastForThisRelease.toReleaseString);
                    const toIds = splitList(lastForThisRelease.toReleaseId);
                    isCurrentlyInReleaseDerived = hasRelease(toNames, toIds);
                }
            }

            const isCurrentlyInRelease = isCurrentlyInReleaseDerived;

            if (isCurrentlyInRelease && oneDayAfterStart && new Date(issue.issueCreatedAt) > oneDayAfterStart) {
                return { wasPlanned: false, wasAdded: true, wasRemoved: false };
            }

            if (isCurrentlyInRelease && (!issue.releaseChangeLog || !issue.releaseChangeLog.length)) {
                return { wasPlanned: true, wasAdded: false, wasRemoved: false };
            }

            if (changes.length > 0) {
                const firstAddToRelease = changes.find((change) => {
                    const toNames = splitList(change.toReleaseString);
                    const toIds = splitList(change.toReleaseId);
                    return hasRelease(toNames, toIds);
                });

                const removalChanges = changes.filter((change) => {
                    const fromNames = splitList(change.fromReleaseString);
                    const fromIds = splitList(change.fromReleaseId);
                    const toNames = splitList(change.toReleaseString);
                    const toIds = splitList(change.toReleaseId);

                    return hasRelease(fromNames, fromIds) && !hasRelease(toNames, toIds);
                });

                if (removalChanges.length > 0) {
                    wasRemoved = removalChanges.some((change) => {
                        const removalDate = new Date(change.timestamp);
                        return (!releaseStartDate || removalDate >= releaseStartDate) && (!releaseDate || removalDate <= releaseDate);
                    });
                }

                if (wasRemoved && !isCurrentlyInRelease) {
                    return { wasPlanned: false, wasAdded: false, wasRemoved: true };
                }

                if (firstAddToRelease) {
                    const addedTimestamp = new Date(firstAddToRelease.timestamp);

                    if (releaseStartDate && oneDayAfterStart) {
                        if (addedTimestamp <= oneDayAfterStart) {
                            wasPlanned = true;
                        } else {
                            wasAdded = true;
                        }
                    } else {
                        wasAdded = true;
                    }
                } else if (isCurrentlyInRelease) {
                    wasPlanned = true;
                }
            } else if (isCurrentlyInRelease) {
                wasPlanned = true;
            }

            return { wasPlanned, wasAdded, wasRemoved };
        } catch (error) {
            console.error('[GitLab Issues] Error in analyzeReleaseChanges:', error);
            throw error;
        }
    }

    /**
     * Get parent key from GitLab issue
     * GitLab issues may have parent references in customFields
     */
    getParentKey(issue) {
        if (issue.customFields?.parent) {
            return issue.customFields.parent;
        }
        if (issue.customFields?.parentKey) {
            return issue.customFields.parentKey;
        }
        // Check customFieldsByName as well
        if (issue.customFieldsByName?.parent) {
            return issue.customFieldsByName.parent;
        }
        if (issue.customFieldsByName?.parentKey) {
            return issue.customFieldsByName.parentKey;
        }
        return null;
    }

    /**
     * Check if issue is a parent (has children)
     */
    isParentIssue(issue, allIssues) {
        const issueKey = issue.key || issue.issueId?.toString();
        if (!issueKey) {
            return false;
        }
        // Check if any issue has this issue as parent
        // Exclude Epic-like issue types from being considered as children
        return allIssues.some(i => {
            const childType = (i.type?.name || '').toLowerCase();
            if (childType === epic_type || childType === sub_task_type) {
                return false;
            }
            
            const parentKey = this.getParentKey(i);
            return parentKey === issueKey || parentKey === issue.issueId?.toString();
        });
    }

    /**
     * Get children issues for a parent
     */
    getChildrenIssues(parentKey, allIssues) {
        return allIssues.filter(issue => {
            // Exclude Epic tickets from children
            const issueType = (issue.type?.name || '').toLowerCase();
            if (issueType === epic_type || issueType === sub_task_type) {
                return false;
            }
            
            const parentKeyOfIssue = this.getParentKey(issue);
            return parentKeyOfIssue === parentKey || parentKeyOfIssue === parentKey?.toString();
        });
    }

    /**
     * Calculate story points for a ticket considering parent-child relationship
     * If parent has children, use children's story points; otherwise use ticket's own
     */
    calculateTicketStoryPoints(issue, allIssues) {
        const isParent = this.isParentIssue(issue, allIssues);
        
        if (isParent) {
            const issueKey = issue.key || issue.issueId?.toString();
            const children = this.getChildrenIssues(issueKey, allIssues);
            if (children.length > 0) {
                return children.reduce((sum, child) => {
                    const isClosed = ['closed', 'done'].includes((child?.status?.name || child?.status || '').toLowerCase());
                    return sum + (isClosed ? (child.storyPoints || 0) : 0);
                }, 0);
            }
        }
        
        // If not parent or no children, use ticket's own story points (all issue types)
        const isClosed = ['closed', 'done'].includes((issue?.status?.name || issue?.status || '').toLowerCase());
        return isClosed ? (issue.storyPoints || 0) : 0;
    }

    /**
     * Calculate hours for a ticket considering parent-child relationship
     * If parent has children, use children's hours; otherwise use ticket's own
     */
    calculateTicketHours(issue, allIssues) {
        const isParent = this.isParentIssue(issue, allIssues);
        
        if (isParent) {
            const issueKey = issue.key || issue.issueId?.toString();
            const children = this.getChildrenIssues(issueKey, allIssues);
            if (children.length > 0) {
                return children.reduce((sum, child) => sum + (child.originalEstimateHrs || 0), 0);
            }
        }
        
        // If not parent or no children, use ticket's own hours (all issue types)
        return issue.originalEstimateHrs || 0;
    }

    /**
     * Calculate completed story points for a milestone/release
     */
    calculateCompletedStoryPointsForMilestone(issues, milestoneName) {
        // Filter to get only issues in this milestone
        const milestoneIssues = issues.filter(issue => issue.fixVersion === milestoneName);
        
        // Filter out child tickets (only process parent and orphan tickets)
        const parentOrOrphanIssues = milestoneIssues.filter(issue => {
            const parentKey = this.getParentKey(issue);
            if (!parentKey) {
                return true; // Orphan ticket (no parent)
            }
            // Only include if parent doesn't exist in milestoneIssues (orphan parent)
            return !milestoneIssues.some(i => {
                const iKey = i.key || i.issueId?.toString();
                const pKey = parentKey?.toString();
                return iKey === pKey;
            });
        });

        // Calculate completed story points considering all issue types and parent-child relationships
        let totalCompleted = 0;
        for (const issue of parentOrOrphanIssues) {
            const isClosed = ['closed', 'done'].includes((issue?.status?.name || issue?.status || '').toLowerCase());
            if (isClosed) {
                totalCompleted += this.calculateTicketStoryPoints(issue, milestoneIssues);
            }
        }
        
        return totalCompleted;
    }

    /**
     * Calculate completed hours for a milestone/release
     */
    calculateCompletedHoursForMilestone(issues, milestoneName) {
        // Filter to get only issues in this milestone
        const milestoneIssues = issues.filter(issue => issue.fixVersion === milestoneName);
        
        // Filter out child tickets (only process parent and orphan tickets)
        const parentOrOrphanIssues = milestoneIssues.filter(issue => {
            const parentKey = this.getParentKey(issue);
            if (!parentKey) {
                return true; // Orphan ticket (no parent)
            }
            // Only include if parent doesn't exist in milestoneIssues (orphan parent)
            return !milestoneIssues.some(i => {
                const iKey = i.key || i.issueId?.toString();
                const pKey = parentKey?.toString();
                return iKey === pKey;
            });
        });

        // Calculate completed hours considering all issue types and parent-child relationships
        let totalCompleted = 0;
        for (const issue of parentOrOrphanIssues) {
            const isClosed = ['closed', 'done'].includes((issue?.status?.name || issue?.status || '').toLowerCase());
            if (isClosed) {
                totalCompleted += this.calculateTicketHours(issue, milestoneIssues);
            }
        }
        
        return totalCompleted;
    }

    /**
     * Calculate initial and committed story points for a milestone/release
     */
    calculateInitialAndCommittedStoryPointsForMilestone(issues, milestoneName) {
        // Filter to get only issues in this milestone
        const milestoneIssues = issues.filter(issue => issue.fixVersion === milestoneName);
        
        // Filter out child tickets (only process parent and orphan tickets)
        // EXCLUDE Epic issue types completely
        const parentOrOrphanIssues = milestoneIssues.filter(issue => {
            // EXCLUDE Epic issue types
            const issueType = (issue.type?.name || '').toLowerCase();
            if (issueType === 'epic'|| issueType === 'sub-task') {
                return false; // Exclude Epic tickets
            }
            
            const parentKey = this.getParentKey(issue);
            if (!parentKey) {
                return true; // Orphan ticket (no parent)
            }
            // Only include if parent doesn't exist in milestoneIssues (orphan parent)
            return !milestoneIssues.some(i => {
                const iKey = i.key || i.issueId?.toString();
                const pKey = parentKey?.toString();
                return iKey === pKey;
            });
        });

        // Calculate committed story points considering all issue types and parent-child relationships
        let totalCommitted = 0;
        for (const issue of parentOrOrphanIssues) {
            totalCommitted += this.calculateTicketEstimateForCommitted(issue, milestoneIssues, 'storyPoints');
        }
        
        return totalCommitted;
    }

    /**
     * Calculate initial and committed hours for a milestone/release
     */
    calculateInitialAndCommittedHoursForMilestone(issues, milestoneName) {
        // Filter to get only issues in this milestone
        const milestoneIssues = issues.filter(issue => issue.fixVersion === milestoneName);
        
        // Filter out child tickets (only process parent and orphan tickets)
        // EXCLUDE Epic issue types completely
        const parentOrOrphanIssues = milestoneIssues.filter(issue => {
            // EXCLUDE Epic issue types
            const issueType = (issue.type?.name || '').toLowerCase();
            if (issueType === 'epic'|| issueType === 'sub-task') {
                return false; // Exclude Epic tickets
            }
            
            const parentKey = this.getParentKey(issue);
            if (!parentKey) {
                return true; // Orphan ticket (no parent)
            }
            // Only include if parent doesn't exist in milestoneIssues (orphan parent)
            return !milestoneIssues.some(i => {
                const iKey = i.key || i.issueId?.toString();
                const pKey = parentKey?.toString();
                return iKey === pKey;
            });
        });

        // Calculate committed hours considering all issue types and parent-child relationships
        let totalCommitted = 0;
        for (const issue of parentOrOrphanIssues) {
            totalCommitted += this.calculateTicketEstimateForCommitted(issue, milestoneIssues, 'hours');
        }
        
        return totalCommitted;
    }

    /**
     * Calculate estimate for committed (not filtered by closed status)
     * If parent has children, use children's estimates; otherwise use ticket's own
     */
    calculateTicketEstimateForCommitted(issue, allIssues, estimationType = 'storyPoints') {
        const isParent = this.isParentIssue(issue, allIssues);
        
        if (isParent) {
            const issueKey = issue.key || issue.issueId?.toString();
            const children = this.getChildrenIssues(issueKey, allIssues);
            if (children.length > 0) {
                return children.reduce((sum, child) => {
                    if (estimationType === 'storyPoints') {
                        return sum + (child.storyPoints || 0);
                    } else {
                        return sum + (child.originalEstimateHrs || 0);
                    }
                }, 0);
            }
        }
        
        // If not parent or no children, use ticket's own estimate (all issue types)
        if (estimationType === 'storyPoints') {
            return issue.storyPoints || 0;
        } else {
            return issue.originalEstimateHrs || 0;
        }
    }

    /**
     * Calculate initial original estimate hours for a milestone/release
     */
    calculateInitialOriginalEstimateHrsForMilestone(issues, milestoneName) {
        return issues
            .filter((issue) => {
                return issue.fixVersion === milestoneName;
            })
            .reduce((total, issue) => total + (issue.originalEstimateHrs || 0), 0);
    }

    /**
     * Calculate initial story points by developer for a milestone/release
     */
    calculateInitialStoryPointsByDevMilestone(issues, milestoneName) {
        return issues
            .filter((issue) => {
                return issue.fixVersion === milestoneName && issue.type?.name === 'Story';
            })
            .reduce((acc, issue) => {
                const assignee = typeof issue.assignee === 'string' ? issue.assignee : (issue.assignee?.displayName || issue.assignee?.name || 'UnAssigned');
                const points = issue.storyPoints || 0;
                if (!acc[assignee]) {
                    acc[assignee] = 0;
                }
                acc[assignee] += points;
                return acc;
            }, {});
    }

    /**
     * Calculate initial original estimate hours by developer for a milestone/release
     */
    calculateInitialOriginalEstimateHrsByDevMilestone(issues, milestoneName) {
        return issues
            .filter((issue) => {
                return issue.fixVersion === milestoneName;
            })
            .reduce((acc, issue) => {
                const assignee = typeof issue.assignee === 'string' ? issue.assignee : (issue.assignee?.displayName || issue.assignee?.name || 'UnAssigned');
                const estimate = issue.originalEstimateHrs || 0;
                if (!acc[assignee]) {
                    acc[assignee] = 0;
                }
                acc[assignee] += estimate;
                return acc;
            }, {});
    }

    /**
     * Generate update data for committedVsCompletedMetrics
     */
    async generateUpdateData(
        committedStoryPoints,
        completedStoryPoints,
        initialStoryPoints,
        startDate,
        type,
        initialOriginalEstimateHrs,
        initialStoryPointsByDev,
        initialOriginalEstimateHrsByDev,
        committedHours,
        completedHours,
        initialHours
    ) {
        const today = new Date();
        const todayDate = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
        const formattedStartDate = startDate ? `${startDate.getFullYear()}-${startDate.getMonth() + 1}-${startDate.getDate()}` : null;

        let updateData = {
            'committedVsCompletedMetrics.completedStoryPoints': parseFloat(completedStoryPoints.toFixed(2)),
            'committedVsCompletedMetrics.completedHours': parseFloat(completedHours.toFixed(2)),
            'committedVsCompletedMetrics.remainingStoryPoints': parseFloat((committedStoryPoints - completedStoryPoints).toFixed(2)),
            'committedVsCompletedMetrics.remainingHours': parseFloat((committedHours - completedHours).toFixed(2)),
            'committedVsCompletedMetrics.committedStoryPoints': parseFloat(committedStoryPoints.toFixed(2)),
            'committedVsCompletedMetrics.committedHours': parseFloat(committedHours.toFixed(2)),
            'committedVsCompletedMetrics.storyPointsAddedAfterStart': 0,
            'committedVsCompletedMetrics.hoursAddedAfterStart': 0,
            'committedVsCompletedMetrics.removedStoryPoints': 0,
            'committedVsCompletedMetrics.removedHours': 0,
        };
        if (type === 'hard' || formattedStartDate === todayDate) {
            const idealBurnupByDev = [];
            const pointsByDev = initialStoryPointsByDev || {};
            const estimateHrsByDev = initialOriginalEstimateHrsByDev || {};
            const allAssignees = new Set([...Object.keys(pointsByDev), ...Object.keys(estimateHrsByDev)]);
            allAssignees.forEach((assignee) => {
                idealBurnupByDev.push({
                    assignee: assignee || '',
                    initialStoryPoints: parseFloat((pointsByDev[assignee] || 0).toFixed(2)),
                    initialOriginalEstimateHrs: parseFloat((estimateHrsByDev[assignee] || 0).toFixed(2)),
                });
            });
            updateData = {
                ...updateData,
                'committedVsCompletedMetrics.initialStoryPoints': parseFloat(initialStoryPoints.toFixed(2)),
                'committedVsCompletedMetrics.initialHours': parseFloat(initialHours.toFixed(2)),
                'committedVsCompletedMetrics.spilloverStoryPoints': 0,
                'committedVsCompletedMetrics.spilloverHours': 0,
                'committedVsCompletedMetrics.storyPointsAddedInBeginning': 0,
                'committedVsCompletedMetrics.hoursAddedInBeginning': 0,
                'committedVsCompletedMetrics.initialOriginalEstimateHrs': parseFloat(initialOriginalEstimateHrs.toFixed(2)),
                idealBurnupByDev: idealBurnupByDev,
            };
        } else {
            updateData = {
                ...updateData,
            };
        }

        return updateData;
    }

    /**
     * Calculate spillover points common for milestones/releases
     */
    async calculateSpillOverPointsCommon({ id, projectId, companyId, boardId, Model, type }) {
        const query = {
            companyId,
            projectId,
        };
        
        // Add boardId to query if provided
        if (boardId) {
            query.boardId = boardId;
        }
        
        const collectionData = await Model.find(query);

        const sortedData = collectionData.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        const selectedIndex = sortedData.findIndex((item) => item._id.toString() === id.toString());
        const selectedItem = sortedData[selectedIndex] || null;
        const previousItem = selectedIndex > 0 ? sortedData[selectedIndex - 1] : null;

        let remainingStoryPoints = 0;
        let remainingHours = 0;
        if (previousItem && ((type?.toLowerCase() === 'sprint' && previousItem.state?.toLowerCase() === 'closed') || (type?.toLowerCase() === 'release' || type?.toLowerCase() === 'milestone') && (previousItem.status?.toLowerCase() === 'released' || previousItem.status?.toLowerCase() === 'closed'))) {
            const updatedPreviousItem = await Model.findById(previousItem._id);
            remainingStoryPoints = updatedPreviousItem?.committedVsCompletedMetrics?.remainingStoryPoints ?? 0;
            remainingHours = updatedPreviousItem?.committedVsCompletedMetrics?.remainingHours ?? 0;
        }
        const initialStoryPoints = selectedItem?.committedVsCompletedMetrics?.initialStoryPoints ?? 0;
        const initialHours = selectedItem?.committedVsCompletedMetrics?.initialHours ?? 0;
        return { initialStoryPoints, remainingStoryPoints, initialHours, remainingHours };
    }

    /**
     * Sync milestone metrics (committedVsCompletedMetrics) for GitLab milestones
     * This replicates the logic from syncJiraService.js for releases
     */
    async syncMilestoneMetrics(companyId, tenantConnection, type, projectId) {
        try {
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const SprintIssue = SprintIssueModel(tenantConnection);
            const BoardIssue = BoardIssueModel(tenantConnection);
            const { startOfDay, endOfDay } = await getToday();

            // Get projects - project -> Milestone (no board filtering for GitLab)
            const projectFilter = { 
                companyId,
                projectTypeKey: 'gitlab-project'
            };
            if (projectId && Types.ObjectId.isValid(projectId)) {
                projectFilter._id = new Types.ObjectId(projectId);
            }
            const projects = await Project.find(projectFilter).lean();

            if (projects.length === 0) {
                return;
            }

            // Process each project
            for (const proj of projects) {
                try {
                    let filteredMilestones = [];
                    
                    if (type === 'hard') {
                        // Hard sync: Get all milestones
                        filteredMilestones = await JiraRelease.find({ 
                            companyId, 
                            projectId: proj._id
                        }).lean();
                    } else {
                        // Light sync: Get recently closed and active milestones
                        const today = new Date();
                        // const { startOfToday, endOfToday } = this.getISTTodayRange();
                        const threeDaysAgo = new Date(today);
                        threeDaysAgo.setDate(today.getDate() - 3);
                        const fiveDaysAgo = new Date(today);
                        fiveDaysAgo.setDate(today.getDate() - 5);

                        const [recentlyClosedMilestones, latestUnreleasedMilestones] = await Promise.all([
                            // Recently closed milestones (within 5 days)
                            JiraRelease.find({
                                companyId: typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId,
                                projectId: proj._id,
                                status: RELEASE_STATUS_RELEASED,
                                releaseDate: { $gte: fiveDaysAgo, $lte: today },
                            })
                                .select('_id releaseName projectId')
                                .sort({ releaseDate: -1 })
                                .lean(),
                            // Latest unreleased milestones (active)
                            JiraRelease.find({
                                companyId: typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId,
                                projectId: proj._id,
                                status: MILESTONE_STATUS_ACTIVE,
                            })
                                .select('_id releaseName projectId companyId')
                                .sort({ releaseDate: -1 })
                                .lean(),
                        ]);

                        const allMilestones = [...recentlyClosedMilestones, ...latestUnreleasedMilestones];
                        filteredMilestones = allMilestones.filter((milestone, index, self) => 
                            index === self.findIndex((m) => m._id.toString() === milestone._id.toString())
                        );

                        const latestMilestoneByReleaseDate = await JiraRelease.findOne({
                            companyId: typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId,
                            projectId: proj._id,
                            status: { $in: [MILESTONE_STATUS_CLOSED, RELEASE_STATUS_RELEASED] },
                            releaseDate: { $exists: true, $ne: null },
                        })
                            .sort({ releaseDate: -1 })
                            .select('_id releaseName projectId companyId')
                            .lean();

                        if (
                            latestMilestoneByReleaseDate &&
                            !filteredMilestones.some((m) => m._id.toString() === latestMilestoneByReleaseDate._id.toString())
                        ) {
                            filteredMilestones.push(latestMilestoneByReleaseDate);
                        }
                    }
                    // Process each milestone
                    for (const milestone of filteredMilestones) {
                        try {
                            const { projectId: milestoneProjectId, companyId: milestoneCompanyId, releaseName, _id, status } = milestone;
                            
                            // Get milestone start date for previousAssigneeResults logic (matching fetchStoryPoints from syncJiraService.js)
                            const milestoneDoc = await JiraRelease.findById(_id);
                            let milestoneStartDate = null;
                            if (milestoneDoc?.startDate && !isNaN(new Date(milestoneDoc.startDate))) {
                                milestoneStartDate = new Date(milestoneDoc.startDate).toISOString().split('T')[0];
                            }
                            const today = new Date().toISOString().split('T')[0];
                            
                            // Handle previousAssigneeResults when milestone starts today (matching fetchStoryPoints logic)
                            let previousAssigneeResults = false;
                            if (milestoneStartDate === today) {
                                if (!milestoneDoc?.assigneeCopiedForToday) {
                                    // Get previous milestone assignees (sorted by startDate)
                                    const milestonesData = await JiraRelease.aggregate([
                                        { 
                                            $match: { 
                                                projectId: milestoneProjectId, 
                                                companyId: new Types.ObjectId(milestoneCompanyId) 
                                            } 
                                        }, 
                                        { $sort: { startDate: 1 } }
                                    ], { allowDiskUse: true });
                                    const selectedIndex = milestonesData.findIndex((m) => m._id.toString() === _id.toString());
                                    const previousMilestone = selectedIndex > 0 ? milestonesData[selectedIndex - 1] : null;
                                    previousAssigneeResults = previousMilestone ? previousMilestone.assignees : [];
                                } else {
                                    previousAssigneeResults = [];
                                }
                            }
                            
                            // Determine if kanban or scrum (for GitLab, check project boardType)
                            const projectData = await Project.findOne({ _id: milestoneProjectId });
                            const Sprint = SprintModel(tenantConnection);
                            const sprintCount = await Sprint.countDocuments({
                                companyId: milestoneCompanyId,
                                projectId: milestoneProjectId,
                            });
                            const isKanban = projectData?.boardType === 'kanban' || projectData?.boardType === 'gitlab-board' || ((projectData?.boardType === 'scrum' || projectData?.boardType === 'simple') && sprintCount === 0);
                            const IssueModel = isKanban ? BoardIssue : SprintIssue;
                            
                            // Build match query
                            const matchQuery = {
                                projectId: milestoneProjectId,
                                companyId: milestoneCompanyId,
                                fixVersion: releaseName,
                            };
                            
                            if (type === 'hard') {
                                matchQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };
                            } else if (type === 'light') {
                                if (status === 'Released') {
                                    matchQuery.updatedAt = { $gte: startOfDay, $lte: endOfDay };
                                }
                            }
                            // Get all issues for this milestone (matching fetchStoryPoints logic)
                            let milestoneIssuesData = [];
                                // For scrum with sprints, use aggregate to get latest ticket per issueId
                                milestoneIssuesData = await IssueModel.aggregate([
                                    { $match: matchQuery },
                                    { $sort: { createdAt: -1 } },
                                    {
                                        $group: {
                                            _id: '$issueId',
                                            latestTicket: { $first: '$$ROOT' },
                                        },
                                    },
                                    { $replaceRoot: { newRoot: '$latestTicket' } },
                                ], { allowDiskUse: true });

                            // Update milestone assignees using fetchMilestoneAssignees (equivalent to fetchUserStoryPoints)
                            if (milestoneIssuesData.length > 0) {
                                const { didUpdate } = await this.fetchMilestoneAssignees(
                                    milestoneIssuesData, 
                                    tenantConnection, 
                                    _id, 
                                    previousAssigneeResults
                                );
                                if (milestoneStartDate === today && didUpdate && !milestoneDoc?.assigneeCopiedForToday) {
                                    await JiraRelease.updateOne({ _id: _id }, { $set: { assigneeCopiedForToday: true } });
                                }
                            }

                            // Calculate metrics (using milestoneIssuesData from above)
                            const initialStoryPoints = await this.calculateInitialAndCommittedStoryPointsForMilestone(milestoneIssuesData, releaseName);
                            const initialHours = await this.calculateInitialAndCommittedHoursForMilestone(milestoneIssuesData, releaseName);
                            const initialOriginalEstimateHrs = await this.calculateInitialOriginalEstimateHrsForMilestone(milestoneIssuesData, releaseName);
                            const committedStoryPoints = await this.calculateInitialAndCommittedStoryPointsForMilestone(milestoneIssuesData, releaseName);
                            const committedHours = await this.calculateInitialAndCommittedHoursForMilestone(milestoneIssuesData, releaseName);
                            const completedStoryPoints = await this.calculateCompletedStoryPointsForMilestone(milestoneIssuesData, releaseName);
                            const completedHours = await this.calculateCompletedHoursForMilestone(milestoneIssuesData, releaseName);
                            const initialStoryPointsByDev = await this.calculateInitialStoryPointsByDevMilestone(milestoneIssuesData, releaseName);
                            const initialOriginalEstimateHrsByDev = await this.calculateInitialOriginalEstimateHrsByDevMilestone(milestoneIssuesData, releaseName);

                            // Generate update data (milestoneDoc already fetched above)
                            const updateData = await this.generateUpdateData(
                                committedStoryPoints,
                                completedStoryPoints,
                                initialStoryPoints,
                                milestoneDoc?.startDate,
                                type,
                                initialOriginalEstimateHrs,
                                initialStoryPointsByDev,
                                initialOriginalEstimateHrsByDev,
                                committedHours,
                                completedHours,
                                initialHours
                            );

                            // Update milestone with metrics
                            await JiraRelease.findByIdAndUpdate(_id, { $set: updateData }, { new: true });

                            // Calculate spillover and added/removed metrics
                            const todayDateFormatted = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`;
                            const milestoneStartDateFormatted = milestoneDoc?.startDate ? `${milestoneDoc.startDate.getFullYear()}-${milestoneDoc.startDate.getMonth() + 1}-${milestoneDoc.startDate.getDate()}` : null;

                            if (type === 'hard' || milestoneStartDateFormatted === todayDateFormatted) {
                                const { initialStoryPoints: spilloverInitialSP, remainingStoryPoints, initialHours: spilloverInitialHrs, remainingHours } = await this.calculateSpillOverPointsCommon({
                                    id: _id,
                                    projectId: milestoneProjectId,
                                    companyId: milestoneCompanyId,
                                    boardId: milestoneDoc?.boardId,
                                    Model: JiraRelease,
                                    type: 'milestone'
                                });
                                const spillOverPoints = isNaN(remainingStoryPoints) ? 0 : remainingStoryPoints;
                                const spillOverHours = isNaN(remainingHours) ? 0 : remainingHours;
                                const storyPointsAddedInBeginning = Math.max(spilloverInitialSP - spillOverPoints, 0);
                                const hoursAddedInBeginning = Math.max(spilloverInitialHrs - spillOverHours, 0);

                                await JiraRelease.findByIdAndUpdate(_id, {
                                    'committedVsCompletedMetrics.spilloverStoryPoints': parseFloat(spillOverPoints.toFixed(2)),
                                    'committedVsCompletedMetrics.spilloverHours': parseFloat(spillOverHours.toFixed(2)),
                                    'committedVsCompletedMetrics.storyPointsAddedInBeginning': parseFloat(storyPointsAddedInBeginning.toFixed(2)),
                                    'committedVsCompletedMetrics.hoursAddedInBeginning': parseFloat(hoursAddedInBeginning.toFixed(2)),
                                });
                            }

                            // Calculate added/removed after start
                            const updatedMilestone = await JiraRelease.findById(_id);
                            const committedSP = Number(updatedMilestone?.committedVsCompletedMetrics?.committedStoryPoints) || 0;
                            const committedHrs = Number(updatedMilestone?.committedVsCompletedMetrics?.committedHours) || 0;
                            const initialSP = Number(updatedMilestone?.committedVsCompletedMetrics?.initialStoryPoints) || 0;
                            const initialHrs = Number(updatedMilestone?.committedVsCompletedMetrics?.initialHours) || 0;
                            
                            await JiraRelease.findByIdAndUpdate(_id, {
                                'committedVsCompletedMetrics.storyPointsAddedAfterStart': parseFloat((committedSP > initialSP ? committedSP - initialSP : 0).toFixed(2)),
                                'committedVsCompletedMetrics.hoursAddedAfterStart': parseFloat((committedHrs > initialHrs ? committedHrs - initialHrs : 0).toFixed(2)),
                                'committedVsCompletedMetrics.removedStoryPoints': parseFloat((committedSP < initialSP ? initialSP - committedSP : 0).toFixed(2)),
                                'committedVsCompletedMetrics.removedHours': parseFloat((committedHrs < initialHrs ? initialHrs - committedHrs : 0).toFixed(2)),
                            });
                        } catch (milestoneError) {
                            console.error(`[GitLab Issues] Error processing milestone ${milestone.releaseName}:`, milestoneError.message);
                        }
                    }
                } catch (projectError) {
                    console.error(`[GitLab Issues] Error processing project ${proj.name}:`, projectError.message);
                }
            }
        } catch (error) {
            console.error('[GitLab Issues] Error in syncMilestoneMetrics:', error);
            throw error;
        }
    }

    /**
     * Calculate burndown velocity for GitLab milestones (releases)
     * This is the GitLab equivalent of calculateBurndownVelocity from syncJiraService.js
     * Works with milestones (stored as JiraRelease) instead of sprints/releases
     * 
     * @param {Object} tenantConnection - Database connection
     * @param {String} companyId - Company ID
     * @param {String} projectId - Project ID (optional, if null processes all projects)
     * @param {String} type - Sync type ('light' or 'hard')
     * @returns {Object} - Success message
     */
    async calculateBurndownVelocity(tenantConnection, companyId, projectId, type) {
        try {
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);

            companyId = new Types.ObjectId(companyId);
            
            // Get projects - filter by GitLab project type
            const projectFilter = { 
                companyId,
                projectTypeKey: 'gitlab-project'
            };
            if (projectId && Types.ObjectId.isValid(projectId)) {
                projectFilter._id = new Types.ObjectId(projectId);
            }
            
            const projects = await Project.find(projectFilter).lean();

            if (projects.length === 0) {
                return { message: 'No GitLab projects found for burndown velocity calculation.' };
            }

            // Process each project
            for (const project of projects) {
                try {
                    // Get primary board for the project (milestones require boardId)
                    const boards = await Board.find({ companyId, projectId: project._id });
                    const primaryBoard = boards.length > 0 ? boards[0] : null;
                    
                    if (!primaryBoard) {
                        console.warn(`[GitLab Issues][calculateBurndownVelocity] No board found for project ${project._id}, skipping`);
                        continue;
                    }

                    let milestones = [];
                    
                    if (type === 'hard') {
                        // Hard sync: Calculate for all milestones
                        milestones = await JiraRelease.find({ 
                            companyId, 
                            projectId: project._id,
                            boardId: primaryBoard._id
                        }).lean();
                    } else {
                        // Light sync: Calculate only for active/unreleased milestones
                        const activeMilestones = await JiraRelease.find({ 
                            companyId, 
                            projectId: project._id,
                            boardId: primaryBoard._id,
                            status: { $in: [MILESTONE_STATUS_ACTIVE, RELEASE_STATUS_UNRELEASED] }
                        }).lean();

                        milestones = [...activeMilestones];

                        const latestMilestoneBurndown = await JiraRelease.findOne({
                            companyId,
                            projectId: project._id,
                            boardId: primaryBoard._id,
                            status: { $in: [MILESTONE_STATUS_CLOSED, RELEASE_STATUS_RELEASED] },
                            releaseDate: { $exists: true, $ne: null },
                        })
                            .sort({ releaseDate: -1 })
                            .lean();

                        if (
                            latestMilestoneBurndown &&
                            !milestones.some((m) => m._id.toString() === latestMilestoneBurndown._id.toString())
                        ) {
                            milestones.push(latestMilestoneBurndown);
                        }
                    }

                    // Process each milestone (release)
                    for (const milestone of milestones) {
                        try {
                            // Determine estimation type based on milestone.hours field
                            // hours: false = story points based (weight), hours: true = hours based
                            const estimationType = milestone.hours === true ? 'hours' : 'storyPoints';

                            // Calculate burndown velocity using the shared service
                            // Note: For GitLab, we only have releases (milestones), no sprints
                            await burndownVelocityService.calculateBurndownVelocity(
                                null, // sprintId - not applicable for GitLab milestones
                                milestone._id.toString(), // releaseId - milestone ID
                                project._id.toString(),
                                companyId.toString(),
                                tenantConnection,
                                estimationType
                            );

                            // Calculate and store burndown data in collection
                            // Only store the relevant type based on milestone.hours field
                            await burndownCalculationService.calculateAndStoreBurndown(
                                companyId.toString(),
                                project._id.toString(),
                                primaryBoard._id.toString(),
                                null, // sprintId - not applicable for GitLab milestones
                                milestone._id.toString(), // releaseId - milestone ID
                                null, // developer - not applicable
                                tenantConnection,
                                estimationType
                            );
                        } catch (milestoneError) {
                            console.error(`[GitLab Issues][calculateBurndownVelocity] Error calculating burndown for milestone ${milestone._id}:`, milestoneError.message);
                        }
                    }
                } catch (projectError) {
                    console.error(`[GitLab Issues][calculateBurndownVelocity] Error processing project ${project._id}:`, projectError.message);
                }
            }

            return { message: 'Burndown velocity calculated successfully for all GitLab milestones.' };
        } catch (error) {
            console.error('[GitLab Issues][calculateBurndownVelocity] Error in calculateBurndownVelocity:', error);
            throw new Error(error.message);
        }
    }

    /**
     * Get IST today range (similar to Jira service)
     */
    getISTTodayRange() {
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
        const now = new Date();
        const currentUTCTime = now.getTime();
        
        const currentISTTimestamp = currentUTCTime + IST_OFFSET_MS;
        const istDateObj = new Date(currentISTTimestamp);
        
        const istYear = istDateObj.getUTCFullYear();
        const istMonth = istDateObj.getUTCMonth();
        const istDay = istDateObj.getUTCDate();
        
        const utcMidnightForISTDate = Date.UTC(istYear, istMonth, istDay, 0, 0, 0, 0);
        const istMidnightUTC = utcMidnightForISTDate - IST_OFFSET_MS;
        const startOfToday = new Date(istMidnightUTC);
        
        const utcEndOfDayForISTDate = Date.UTC(istYear, istMonth, istDay, 23, 59, 59, 999);
        const istEndOfDayUTC = utcEndOfDayForISTDate - IST_OFFSET_MS;
        const endOfToday = new Date(istEndOfDayUTC);
        return { startOfToday, endOfToday };
    }
}

export default new GitLabIssuesService();
