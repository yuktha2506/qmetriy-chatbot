/* eslint-disable max-len */
/* eslint-disable indent */
import axios from 'axios';
import { ProjectModel, BoardIssueModel, SprintIssueModel, SprintModel, BoardModel } from '../../jira/model.js';
import { ConnectionModel } from '../../../connection/model.js';
import { cryptoHandler, getWorkTimeline, calculateIsAccepted, getProjectStartDateFromAzure } from '../../../../utils/commonFunctions.js';
import { Types } from 'mongoose';
import connectionManager from '../../../../config/connectionManager.js';
import { CompanyModel } from '../../../company/model.js';
import burndownCalculationService from '../../jira/services/burndownCalculationService.js';
import burnupCalculationService from '../../jira/services/burnupCalculationService.js';
import {
    TEMPLATE_SCRUM,
    TEMPLATE_AGILE,
    TEMPLATE_CMMI,
    TEMPLATE_BASIC,
    FIELD_EFFORT,
    FIELD_STORY_POINTS,
    FIELD_ORIGINAL_ESTIMATE,
    FIELD_REMAINING_WORK,
    FIELD_COMPLETED_WORK,
    CUSTOM_FIELD_EFFORT,
    CUSTOM_FIELD_STORY_POINTS,
    FIELD_PREFIX_CUSTOM,
} from '../../../../utils/constants/azureBoardsConstants.js';
import {
    PROVIDER_NAME_AZURE_BOARDS,
    PROVIDER_NAME_AZUREBOARDS,
    PROVIDER_NAME_AZURE_BOARD,
} from '../../../../utils/constants/providerConstants.js';

class SyncAzureBoardsService {
    findCustomEffortField(fields) {
        if (!fields || typeof fields !== 'object') {
            return null;
        }
        
        if (fields[CUSTOM_FIELD_STORY_POINTS] !== undefined && fields[CUSTOM_FIELD_STORY_POINTS] !== null) {
            return { fieldName: CUSTOM_FIELD_STORY_POINTS, value: fields[CUSTOM_FIELD_STORY_POINTS] };
        }
        if (fields[CUSTOM_FIELD_EFFORT] !== undefined && fields[CUSTOM_FIELD_EFFORT] !== null) {
            return { fieldName: CUSTOM_FIELD_EFFORT, value: fields[CUSTOM_FIELD_EFFORT] };
        }
        
        for (const [fieldName, value] of Object.entries(fields)) {
            if (fieldName.startsWith(FIELD_PREFIX_CUSTOM) && value !== undefined && value !== null) {
                const lowerFieldName = fieldName.toLowerCase();
                if (lowerFieldName.includes('storypoint') || lowerFieldName.includes('story_point')) {
                    return { fieldName, value };
                }
                if (lowerFieldName.includes('effort') && !lowerFieldName.includes('remaining') && !lowerFieldName.includes('completed')) {
                    return { fieldName, value };
                }
            }
        }
        
        return null;
    }

    // Normalize Azure Work Item type names to our canonical display names
    normalizeWorkItemType(raw) {
        const name = String(raw || '').trim();
        const l = name.toLowerCase();
        if (l === 'product backlog item' || l === 'pbi' || l === 'issue') {
            return 'User Story';
        }
        return name || '';
    }

    calculateStoryPoints(fields, templateName) {

        const getPointsSourceType = (refName) => {
            if (!refName) {return null;}
            const lower = String(refName).toLowerCase();
            if (lower.includes('storypoints') || lower.includes('story_point') || lower.includes('story points')) {
                return 'storyPoints';
            }
            if (
                lower.includes('effort') ||
                lower.includes('originalestimate') ||
                lower.includes('remainingwork') ||
                lower.includes('completedwork')
            ) {
                return 'effort';
            }
            return 'effort';
        };

        if (!templateName || typeof templateName !== 'string') {
            const storyPoints = Number(fields[FIELD_STORY_POINTS] || 0);
            return {
                storyPoints,
                pointsSourceType: getPointsSourceType(FIELD_STORY_POINTS),
                pointsSourceRefName: FIELD_STORY_POINTS,
            };
        }

        const template = templateName.toLowerCase().trim();
        let storyPoints = 0;
        let refNameUsed = null;
        let rawValue = null;

        if (template === TEMPLATE_SCRUM) {
            rawValue = fields[FIELD_EFFORT];
            storyPoints = Number(rawValue || 0);
            refNameUsed = FIELD_EFFORT;
        } else if (template === TEMPLATE_AGILE) {
            rawValue = fields[FIELD_STORY_POINTS];
            storyPoints = Number(rawValue || 0);
            refNameUsed = FIELD_STORY_POINTS;
        } else if (template === TEMPLATE_CMMI) {
            rawValue = fields[FIELD_ORIGINAL_ESTIMATE];
            const originalEstimate = Number(rawValue || 0);
            storyPoints = originalEstimate > 10000 ? originalEstimate / 3600 : originalEstimate;
            refNameUsed = FIELD_ORIGINAL_ESTIMATE;
        } 
        else if (template === TEMPLATE_BASIC) {
            const customField = this.findCustomEffortField(fields);
            
            if (customField) {
                rawValue = customField.value;
                storyPoints = Number(rawValue || 0);
                refNameUsed = customField.fieldName;
            } else {
                const remainingWorkRaw = fields[FIELD_REMAINING_WORK];
                const completedWorkRaw = fields[FIELD_COMPLETED_WORK];
                const remainingWork = Number(remainingWorkRaw || 0);
                const completedWork = Number(completedWorkRaw || 0);
                const remainingHrs = remainingWork > 10000 ? remainingWork / 3600 : remainingWork;
                const completedHrs = completedWork > 10000 ? completedWork / 3600 : completedWork;
                storyPoints = remainingHrs + completedHrs;
                refNameUsed = `${FIELD_REMAINING_WORK}+${FIELD_COMPLETED_WORK}`;
            }
        }
         else {
            let foundField = null;
            
            if (fields[FIELD_STORY_POINTS] !== undefined && fields[FIELD_STORY_POINTS] !== null) {
                foundField = { fieldName: FIELD_STORY_POINTS, value: fields[FIELD_STORY_POINTS] };
            }
            else if (fields[FIELD_EFFORT] !== undefined && fields[FIELD_EFFORT] !== null) {
                foundField = { fieldName: FIELD_EFFORT, value: fields[FIELD_EFFORT] };
            }
            else {
                const customField = this.findCustomEffortField(fields);
                if (customField) {
                    foundField = customField;
                }
            }
            
            if (foundField) {
                rawValue = foundField.value;
                storyPoints = Number(rawValue || 0);
                refNameUsed = foundField.fieldName;
            } 
        }

        const finalStoryPoints = Number.isFinite(storyPoints) ? storyPoints : 0;
        return {
            storyPoints: finalStoryPoints,
            pointsSourceType: getPointsSourceType(refNameUsed),
            pointsSourceRefName: refNameUsed,
        };
    }
    // Extract custom fields from Azure DevOps work item fields
    // Include Microsoft.* fields as custom (for parity with Jira); still skip System.*
    // Azure custom fields often look like "Custom.MyField" or "WEF_xxx_MyField".
    buildCustomFieldsFromAzure(fields) {
        const customFields = {};
        const customFieldsByName = {};
        if (!fields || typeof fields !== 'object') {
            return { customFields, customFieldsByName };
        }
        // Skip only System.* so we also capture Microsoft.* fields like Effort, StoryPoints, etc.
        const SYS_PREFIXES = ['System.'];
        for (const [refName, value] of Object.entries(fields)) {
            const isSystem = SYS_PREFIXES.some((p) => refName.startsWith(p));
            if (isSystem) {
                continue;
            }
            customFields[refName] = value;
            const nameFromRef = refName.startsWith('Custom.') ? refName.substring('Custom.'.length) : refName.startsWith('WEF_') ? refName.replace(/^WEF_[^_]+_/, '') : refName.split('.').pop();
            customFieldsByName[nameFromRef] = value;
        }
        return { customFields, customFieldsByName };
    }
    async syncAzureBorads(companyId, tenantConnection, type = 'light', projectId = null) {
        try {
            console.log('Starting Azure Boards sync for companyId:', companyId);
            const Connection = ConnectionModel(tenantConnection);
            const cred = await Connection.findOne({ companyId, name: { $in: [PROVIDER_NAME_AZURE_BOARDS, PROVIDER_NAME_AZUREBOARDS, PROVIDER_NAME_AZURE_BOARD] } });

            if (!cred) {
                return { warning: 'Azure Boards connection not found for this company. Sync skipped.' };
            }

            const decryptedPAT = cryptoHandler(cred.password, 'decrypt');
            const organization = this.extractOrganization(cred.host);
            const headers = this.createAzureHeaders(decryptedPAT, cred.username);
            const apiVersion = '7.0';

            const response = {
                fetchCustomFields: null,
                syncAzureProjectData: null,
                boardIssues: null,
                fetchStoryPoints: null,
                syncPlannedAndReleaseData: null,
                churnDataMap: null,
                cycleTimeData: null,
                addUser: null,
            };

            // 1) Fetch all projects in the organization with auth fallback (username vs 'pat')
            let projects = [];
            try {
                const projectsResp = await this.retryWithDelay(() =>
                    axios.get(`https://dev.azure.com/${organization}/_apis/projects`, {
                        headers,
                        params: { 'api-version': apiVersion },
                    })
                );
                projects = projectsResp.data?.value || [];
            } catch (err) {
                try {
                    const fallbackHeaders = this.createAzureHeaders(decryptedPAT, 'pat');
                    const projectsResp = await axios.get(`https://dev.azure.com/${organization}/_apis/projects`, {
                        headers: fallbackHeaders,
                        params: { 'api-version': apiVersion },
                    });
                    projects = projectsResp.data?.value || [];
                } catch (e2) {
                    console.error('Azure projects fetch failed:', e2?.response?.status || e2?.message);
                    projects = [];
                }
            }

            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);

            // If a specific projectId is provided, restrict sync to that Azure project only (match by name or hashed key)
            if (projectId) {
                const projectObjectId = Types.ObjectId.isValid(projectId) ? new Types.ObjectId(projectId) : null;
                try {
                    const selected = projectObjectId ? await Project.findOne({ companyId, _id: projectObjectId }).lean() : null;
                    if (selected) {
                        const targetKeyId = Number(selected.projectKeyId);
                        const before = projects.length;
                        projects = (projects || []).filter((p) => {
                            const pid = this.toNumericId(p.id);
                            return pid === targetKeyId || String(p.name).trim() === String(selected.name).trim();
                        });
                        // eslint-disable-next-line no-console
                        console.log('[AzureBoards][sync] Project filter applied', {
                            requestedProjectId: String(projectId),
                            requestedName: selected.name,
                            before,
                            after: projects.length,
                        });
                    } else {
                        // eslint-disable-next-line no-console
                        console.log('[AzureBoards][sync] Provided projectId not found in DB; proceeding with all projects', {
                            requestedProjectId: String(projectId),
                        });
                    }
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.log('[AzureBoards][sync] Failed to filter projects by projectId; proceeding with all', e.message);
                }
            }

            // Orchestration similar to Jira
            try {
                await this.getCustomFields(companyId, organization, headers, tenantConnection);
                response.fetchCustomFields = { status: 'success' };
            } catch (e) {
                response.fetchCustomFields = { status: 'error', message: e.message };
            }

            // 2) For each project → fetch teams → boards, then upsert into Project and Board collections
            for (const azProject of projects) {
                const projectKeyId = this.toNumericId(azProject.id);

                let templateName = null;
                if (azProject.capabilities?.processTemplate?.templateName) {
                    templateName = azProject.capabilities.processTemplate.templateName;
                } else {
                    try {
                        const projectDetailResp = await this.retryWithDelay(() =>
                            axios.get(`https://dev.azure.com/${organization}/_apis/projects/${azProject.id}`, {
                                headers,
                                params: { 
                                    'api-version': apiVersion,
                                    'includeCapabilities': true 
                                },
                            })
                        );
                        templateName = projectDetailResp.data?.capabilities?.processTemplate?.templateName || null;
                    } catch (e) {
                        try {
                            const fallbackHeaders = this.createAzureHeaders(decryptedPAT, 'pat');
                            const projectDetailResp = await axios.get(`https://dev.azure.com/${organization}/_apis/projects/${azProject.id}`, {
                                headers: fallbackHeaders,
                                params: { 
                                    'api-version': apiVersion,
                                    'includeCapabilities': true 
                                },
                            });
                            templateName = projectDetailResp.data?.capabilities?.processTemplate?.templateName || null;
                        } catch (e2) {
                            console.error('[AzureBoards][sync] Failed to fetch project capabilities (both attempts)', {
                                projectName: azProject.name,
                                projectId: azProject.id,
                                firstAttempt: {
                                    status: e?.response?.status,
                                    statusText: e?.response?.statusText,
                                    message: e?.message,
                                    data: e?.response?.data,
                                },
                                secondAttempt: {
                                    status: e2?.response?.status,
                                    statusText: e2?.response?.statusText,
                                    message: e2?.message,
                                    data: e2?.response?.data,
                                },
                                url: `https://dev.azure.com/${organization}/_apis/projects/${azProject.id}?includeCapabilities=true&api-version=${apiVersion}`,
                            });
                        }
                    }
                }

                // Teams under project
                let teams = [];
                try {
                    const teamsResp = await this.retryWithDelay(() =>
                        axios.get(`https://dev.azure.com/${organization}/_apis/projects/${azProject.id}/teams`, {
                            headers,
                            params: { 'api-version': apiVersion },
                        })
                    );
                    teams = teamsResp.data?.value || [];
                    console.log('[AzureBoards][sync] Teams fetched', { projectName: azProject.name, count: teams.length });
                } catch (te) {
                    try {
                        const fallbackHeaders = this.createAzureHeaders(decryptedPAT, 'pat');
                        const teamsResp = await axios.get(`https://dev.azure.com/${organization}/_apis/projects/${azProject.id}/teams`, {
                            headers: fallbackHeaders,
                            params: { 'api-version': apiVersion },
                        });
                        teams = teamsResp.data?.value || [];
                    } catch (te2) {
                        console.log('Azure teams fetch failed for project:', azProject.name, te2?.response?.status || te2?.message);
                        teams = [];
                    }
                }

                const boardsData = [];

                if (!teams.length) {
                    console.log('[AzureBoards][sync] No teams returned for project', { projectName: azProject.name });
                }

                for (const team of teams) {
                    // Boards for team
                    let teamBoards = [];
                    try {
                        const boardsResp = await this.retryWithDelay(() =>
                            axios.get(`https://dev.azure.com/${organization}/${encodeURIComponent(azProject.name)}/${encodeURIComponent(team.name)}/_apis/work/boards`, {
                                headers,
                                params: { 'api-version': apiVersion },
                            })
                        );
                        teamBoards = boardsResp.data?.value || [];
                        console.log('[AzureBoards][sync] Boards fetched', { projectName: azProject.name, teamName: team.name, count: teamBoards.length });
                    } catch (be) {
                        try {
                            const fallbackHeaders = this.createAzureHeaders(decryptedPAT, 'pat');
                            const boardsResp = await axios.get(`https://dev.azure.com/${organization}/${encodeURIComponent(azProject.name)}/${encodeURIComponent(team.name)}/_apis/work/boards`, {
                                headers: fallbackHeaders,
                                params: { 'api-version': apiVersion },
                            });
                            teamBoards = boardsResp.data?.value || [];
                            console.log('[AzureBoards][sync] Boards fetched (fallback)', { projectName: azProject.name, teamName: team.name, count: teamBoards.length });
                        } catch (be2) {
                            console.log('Azure boards fetch failed for team:', team?.name, be2?.response?.status || be2?.message);
                            teamBoards = [];
                        }
                    }

                    // Select a single board per team (prefer "Stories" or first)
                    const selectedBoard =
                        teamBoards.find((b) => String(b.name || '').toLowerCase() === 'stories') || teamBoards.find((b) => /story|backlog/i.test(String(b.name || ''))) || teamBoards[0];
                    if (!selectedBoard) {
                        continue;
                    }

                    const boardIdNumeric = this.toNumericId(selectedBoard.id);

                    // Load columns for selected board
                    let workflowStatuses = [];
                    try {
                        const colsResp = await this.retryWithDelay(() =>
                            axios.get(`https://dev.azure.com/${organization}/${encodeURIComponent(azProject.name)}/${encodeURIComponent(team.name)}/_apis/work/boards/${selectedBoard.id}/columns`, {
                                headers,
                                params: { 'api-version': apiVersion },
                            })
                        );
                        const columns = colsResp.data?.value || [];
                        workflowStatuses = columns.map((col, index) => ({
                            order: index + 1,
                            name: col.name,
                            statuses: col.stateMappings ? Object.keys(col.stateMappings) : [col.name],
                        }));
                    } catch (e) {
                        console.log('[AzureBoards][sync] Columns fetch failed', {
                            projectName: azProject.name,
                            teamName: team.name,
                            boardName: selectedBoard.name,
                            status: e?.response?.status,
                            message: e?.message,
                        });
                        workflowStatuses = [];
                    }

                    // Store a single "board" per team using the team name
                    boardsData.push({
                        boardId: boardIdNumeric,
                        boardName: team.name,
                        boardType: 'azure-board',
                        boardSelf: null,
                        isPrivate: false,
                        workflowStatuses,
                        boardLocation: {
                            projectId: projectKeyId,
                            projectName: azProject.name,
                            projectKey: azProject.name,
                            projectTypeKey: 'azure-project',
                            avatarURI: null,
                            displayName: team.name,
                            name: team.name,
                        },
                    });
                }

                // Ensure there is at least one board entry so downstream sprint/issue sync has a board reference
                if (!boardsData.length) {
                    const fallbackBoardId = this.toNumericId(`${projectKeyId}:default`);
                    boardsData.push({
                        boardId: fallbackBoardId,
                        boardName: `${azProject.name} (default)`,
                        boardType: 'azure-board',
                        boardSelf: null,
                        isPrivate: false,
                        workflowStatuses: [],
                        boardLocation: {
                            projectId: projectKeyId,
                            projectName: azProject.name,
                            projectKey: azProject.name,
                            projectTypeKey: 'azure-project',
                            avatarURI: null,
                            displayName: azProject.name,
                            name: azProject.name,
                        },
                    });
                    console.log('[AzureBoards][sync] Fallback board injected', { projectName: azProject.name, boardId: fallbackBoardId });
                }

                console.log('[AzureBoards][sync] Total boards prepared for project', { projectName: azProject.name, boards: boardsData.length });

                // Fetch project start date (oldest work item created date)
                const firstIssueCreatedAt = await getProjectStartDateFromAzure(organization, headers, azProject.name);

                // Upsert Project with first board as primary for backward compatibility
                const primaryBoard = boardsData[0];
                await Project.updateOne(
                    { projectKeyId, companyId },
                    {
                        $set: {
                            companyId,
                            projectKeyId,
                            name: azProject.name,
                            key: azProject.name,
                            projectTypeKey: 'azure-project',
                            self: cred.host,
                            boardId: primaryBoard ? primaryBoard.boardId : 0 - Number(projectKeyId),
                            boardType: 'azure-board',
                            workflowStatuses: primaryBoard ? primaryBoard.workflowStatuses || [] : [],
                            boards: boardsData,
                            firstIssueCreatedAt,
                            templateName: templateName || null,
                        },
                    },
                    { upsert: true }
                );

                // Ensure Board documents exist and are linked to this project
                const projectDoc = await Project.findOne({ companyId, projectKeyId });
                if (projectDoc) {
                    for (const b of boardsData) {
                        await Board.updateOne(
                            {
                                companyId,
                                projectId: projectDoc._id,
                                projectKeyId,
                                boardId: b.boardId,
                            },
                            {
                                $set: {
                                    companyId,
                                    projectId: projectDoc._id,
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

                // Sync iterations (sprints) for this project across teams (with fallback)
                try {
                    console.log('[AzureBoards][sync] Syncing iterations', { projectName: azProject.name, boardsCount: boardsData.length });
                    await this.addIterationsForProject(organization, headers, apiVersion, tenantConnection, companyId, projectDoc?._id, azProject.id, projectKeyId, boardsData, azProject.name, type);
                    response.syncAzureProjectData = { status: 'success' };
                } catch (e) {
                    response.syncAzureProjectData = { status: 'partial', message: e.message };
                }

                // Sync iteration issues and metrics (fallback-friendly)
                try {
                    if (projectDoc) {
                        console.log('[AzureBoards][sync] Syncing iteration issues', { projectName: azProject.name });
                        await this.syncIterationIssuesForProject(organization, headers, apiVersion, tenantConnection, companyId, projectDoc._id, projectKeyId, boardsData, azProject.name, type);
                    }
                } catch (e) {
                    console.error('syncIterationIssuesForProject failed', azProject.name, e.message);
                }
            }

            // Board issues (Kanban/backlog) per project
            try {
                await this.boardIssues(organization, headers, tenantConnection, companyId, type, projectId);
                response.boardIssues = { status: 'success' };
            } catch (e) {
                response.boardIssues = { status: 'error', message: e.message };
            }

            // Story points aggregation
            try {
                await this.fetchStoryPoints(companyId, tenantConnection, projectId, type);
                response.fetchStoryPoints = { status: 'success' };
            } catch (e) {
                response.fetchStoryPoints = { status: 'error', message: e.message };
            }

            // Burndown/Burnup (Azure iterations)
            try {
                await this.calculateAndStoreAzureBurndownAndBurnup(companyId, tenantConnection, projectId, type);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.log('[AzureBoards][burndown] Calculation skipped/failed', e?.message);
            }

            // Velocity / planned vs release (iteration)
            try {
                await this.syncPlannedAndReleaseData(tenantConnection, companyId, projectId, type);
                response.syncPlannedAndReleaseData = { status: 'success' };
            } catch (e) {
                response.syncPlannedAndReleaseData = { status: 'error', message: e.message };
            }

            // Churn
            try {
                await this.churnDataMap(companyId, tenantConnection, type, projectId);
                response.churnDataMap = { status: 'success' };
            } catch (e) {
                response.churnDataMap = { status: 'error', message: e.message };
            }

            // Cycle time
            try {
                await this.cycleTimeData(companyId, tenantConnection, type, projectId);
                response.cycleTimeData = { status: 'success' };
            } catch (e) {
                response.cycleTimeData = { status: 'error', message: e.message };
            }

            // Users
            try {
                await this.addUser(organization, headers, companyId, tenantConnection, projectId);
                response.addUser = { status: 'success' };
            } catch (e) {
                response.addUser = { status: 'error', message: e.message };
            }

            return { ...response, status: 'success', projectsProcessed: projects.length };
        } catch (error) {
            console.error('Error syncing Azure Boards data..', error.message);
            throw error;
        }
    }

    // Helpers
    extractOrganization(host) {
        const match = String(host || '').match(/dev\.azure\.com\/([^/]+)/i);
        return match ? match[1] : String(host || '').replace(/^https?:\/\//i, '');
    }

    createAzureHeaders(pat, username) {
        // Azure DevOps PAT requires Basic auth. Some orgs enforce real username.
        const user = (username && String(username).trim()) || 'pat';
        const token = Buffer.from(`${user}:${pat}`).toString('base64');
        return {
            Authorization: `Basic ${token}`,
            'Content-Type': 'application/json',
        };
    }

    async retryWithDelay(fn, retries = 2, delay = 1000) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt < retries) {
                    // eslint-disable-next-line no-console
                    console.log(`Retrying... Attempt ${attempt + 1}`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }
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

    // Fetch work item updates (history) from Azure DevOps API
    async fetchWorkItemUpdates(organization, headers, workItemId) {
        try {
            const url = `https://dev.azure.com/${organization}/_apis/wit/workitems/${workItemId}/updates`;
            const resp = await this.retryWithDelay(() =>
                axios.get(url, {
                    headers,
                    params: { 'api-version': '7.0' },
                })
            );
            return resp.data?.value || [];
        } catch (e) {
            // Silently return empty array on failure to not block sync
            return [];
        }
    }

    // Extract status change log from Azure work item updates
    extractStatusChangeLog(updates) {
        const statusChangeLog = [];
        if (!Array.isArray(updates)) {
            return statusChangeLog;
        }
        for (const update of updates) {
            const stateField = update?.fields?.['System.State'];
            if (stateField && stateField.oldValue !== undefined && stateField.newValue !== undefined) {
                statusChangeLog.push({
                    changedAt: update.revisedDate ? new Date(update.revisedDate) : new Date(update.fields?.['System.ChangedDate']?.newValue || Date.now()),
                    from: stateField.oldValue || '',
                    to: stateField.newValue || '',
                });
            }
        }
        return statusChangeLog;
    }

    toAzureHours(value) {
        const n = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(n) || n <= 0) {
            return 0;
        }
        return n > 10000 ? n / 3600 : n;
    }

    extractWorklogFromCompletedWorkUpdates(updates) {
        const byDate = new Map(); // YYYY-MM-DD -> hrs delta
        if (!Array.isArray(updates) || updates.length === 0) {
            return [];
        }

        for (const update of updates) {
            const cwField = update?.fields?.[FIELD_COMPLETED_WORK];
            if (!cwField) {
                continue;
            }
            const oldHrs = this.toAzureHours(cwField.oldValue);
            const newHrs = this.toAzureHours(cwField.newValue);
            const delta = newHrs - oldHrs;
            if (!Number.isFinite(delta) || delta <= 0) {
                continue;
            }

            const revised = update?.revisedDate ? new Date(update.revisedDate) : new Date(update?.fields?.['System.ChangedDate']?.newValue || Date.now());
            const dateStr = revised.toISOString().split('T')[0];
            byDate.set(dateStr, (byDate.get(dateStr) || 0) + delta);
        }

        return Array.from(byDate.entries())
            .sort(([a], [b]) => new Date(a) - new Date(b))
            .map(([dateStr, hrs]) => ({
                started: new Date(`${dateStr}T00:00:00.000Z`),
                created: new Date(`${dateStr}T00:00:00.000Z`),
                updated: new Date(`${dateStr}T00:00:00.000Z`),
                timeSpentHrs: parseFloat(Number(hrs || 0).toFixed(2)),
            }));
    }

    normalizeStatusName(statusName) {
        return String(statusName || '')
            .trim()
            .toLowerCase()
            .replace(/[\s_-]+/g, ' ');
    }

    buildCanonicalStatusMap(workflowStatuses) {
        const map = new Map();
        const statuses = Array.isArray(workflowStatuses)
            ? workflowStatuses.flatMap((w) => (Array.isArray(w?.statuses) ? w.statuses : []))
            : [];
        for (const s of statuses) {
            const norm = this.normalizeStatusName(s);
            if (norm && !map.has(norm)) {
                map.set(norm, String(s));
            }
        }
        return map;
    }

    // Calculate work timeline using workflow statuses and status change log
    getAzureWorkTimeline(workflowStatuses, statusChangeLog) {
        if (!workflowStatuses?.length || !statusChangeLog?.length) {
            return { workStartedAt: null, workCompletedAt: null };
        }
        // Use the shared getWorkTimeline utility
        return getWorkTimeline(workflowStatuses, statusChangeLog);
    }

    // ========== New methods mirroring Jira sync ==========

    async getCustomFields(companyId, organization, headers, tenantConnection) {
        // Azure Boards fields are organization/project scoped; fetch from first available project if needed.
        try {
            const resp = await this.retryWithDelay(() =>
                axios.get(`https://dev.azure.com/${organization}/_apis/wit/fields`, {
                    headers,
                    params: { 'api-version': '7.0' },
                })
            );
            const value = Array.isArray(resp.data?.value) ? resp.data.value : [];
            const customFields = value.map((f) => ({
                key: f.referenceName || f.name || '',
                name: f.name || f.referenceName || '',
            }));

            // Store like Jira does: Meta DB -> Company.customFields
            try {
                const metaConnection = connectionManager.connectToMetaDB();
                const MetaCompany = CompanyModel(metaConnection);
                const metaCompany = await MetaCompany.findOneAndUpdate({ _id: companyId }, { $set: { customFields } }, { new: true, upsert: false });
                if (metaCompany?.companyName && tenantConnection) {
                    const TenantCompany = CompanyModel(tenantConnection);
                    await TenantCompany.updateOne({ companyName: metaCompany.companyName }, { $set: { customFields } });
                }
            } catch (dbErr) {
                // eslint-disable-next-line no-console
                console.log('[AzureBoards][getCustomFields] Failed to persist to meta company', dbErr.message);
            }
            return customFields;
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log('getCustomFields failed', e.message);
            return [];
        }
    }

    async addIterationsForProject(organization, headers, apiVersion, connection, companyId, projectId, azureProjectId, projectKeyId, boardsData, projectName, type) {
        const Sprint = SprintModel(connection);
        const Board = BoardModel(connection);
        let insertedAny = false;
        // Build a map: numeric boardId -> Board ObjectId for this project
        try {
            const numericBoardIds = Array.isArray(boardsData) ? boardsData.map((b) => b.boardId) : [];
            const boardDocs = await Board.find({ companyId, projectId, projectKeyId, boardId: { $in: numericBoardIds } }, { _id: 1, boardId: 1 }).lean();
            this.azureBoardIdToObjectId = new Map((boardDocs || []).map((d) => [d.boardId, d._id]));
        } catch (e) {
            this.azureBoardIdToObjectId = new Map();
        }
        // Prefer team-scoped iterations when available
        for (const b of boardsData) {
            if (!b?.boardLocation?.projectName || !b?.boardLocation?.name) {
                console.log('[AzureBoards][iterations] Skipping board without location', { boardId: b?.boardId });
                continue;
            }
            try {
                const iterationsResp = await this.retryWithDelay(() =>
                    axios.get(
                        `https://dev.azure.com/${organization}/${encodeURIComponent(b.boardLocation.projectName)}/${encodeURIComponent(b.boardLocation.name)}/_apis/work/teamsettings/iterations`,
                        {
                            headers,
                            params: { 'api-version': apiVersion },
                        }
                    )
                );
                let iterations = iterationsResp.data?.value || [];
                // Light vs Hard selection
                if (type === 'light') {
                    const current = iterations.filter((x) => (x.attributes?.timeFrame || '').toLowerCase() === 'current');
                    const past = iterations
                        .filter((x) => (x.attributes?.timeFrame || '').toLowerCase() === 'past')
                        .sort((a, b) => new Date(b.attributes?.finishDate || 0) - new Date(a.attributes?.finishDate || 0));
                    iterations = [...current, ...past.slice(0, 1)];
                }
                const bulkOps = iterations.map((it) => {
                    const sprintNumericId = this.toNumericId(it.id);
                    const startDate = it.attributes?.startDate ? new Date(it.attributes.startDate) : null;
                    const finishDate = it.attributes?.finishDate ? new Date(it.attributes.finishDate) : null;
                    const boardObjectId = this.azureBoardIdToObjectId.get(b.boardId) || null;
                    return {
                        updateOne: {
                            filter: { companyId, projectId, projectKeyId, sprintId: sprintNumericId, boardReference: b.boardId },
                            update: {
                                $set: {
                                    companyId,
                                    projectId,
                                    projectKeyId,
                                    sprintId: sprintNumericId,
                                    azureIterationId: it.id,
                                    name: it.name,
                                    startDate,
                                    endDate: finishDate,
                                    state: it.attributes?.timeFrame || 'future',
                                    boardId: boardObjectId,
                                    boardReference: b.boardId,
                                },
                            },
                            upsert: true,
                        },
                    };
                });
                if (bulkOps.length) {
                    await Sprint.bulkWrite(bulkOps);
                    insertedAny = true;
                    console.log('[AzureBoards][iterations] Upserted', {
                        teamName: b.boardLocation?.name,
                        projectName: b.boardLocation?.projectName,
                        count: bulkOps.length,
                    });
                }
            } catch (e) {
                console.log('[AzureBoards][iterations] Team fetch failed', {
                    teamName: b.boardLocation?.name,
                    status: e?.response?.status,
                    message: e?.message,
                });
                // ignore per team
            }
        }
        // Fallback: classification nodes if nothing inserted (no teams/boards or no access)
        if (!insertedAny && projectName) {
            try {
                const iterations = await this.fetchIterationsViaClassificationNodes(organization, projectName, headers, apiVersion);
                let selected = iterations;
                if (type === 'light') {
                    const now = new Date();
                    const current = iterations.filter((x) => x.startDate && x.finishDate && x.startDate <= now && now <= x.finishDate);
                    const past = iterations.filter((x) => x.finishDate && x.finishDate < now).sort((a, b) => new Date(b.finishDate || 0) - new Date(a.finishDate || 0));
                    selected = [...current, ...past.slice(0, 1)];
                }
                const fallbackBoardId = 0 - Number(projectKeyId);
                const fallbackBoardDoc = await Board.findOne({ companyId, projectId, projectKeyId, boardId: fallbackBoardId }, { _id: 1 }).lean();
                const fallbackBoardObjectId = fallbackBoardDoc?._id || null;
                const ops = selected.map((it) => ({
                    updateOne: {
                        filter: { companyId, projectId, projectKeyId, sprintId: this.toNumericId(`${projectKeyId}:${it.iterationPath}`), boardReference: fallbackBoardId },
                        update: {
                            $set: {
                                companyId,
                                projectId,
                                projectKeyId,
                                sprintId: this.toNumericId(`${projectKeyId}:${it.iterationPath}`),
                                name: it.iterationPath,
                                startDate: it.startDate,
                                endDate: it.finishDate,
                                state:
                                    it.startDate && it.finishDate
                                        ? it.startDate <= new Date() && new Date() <= it.finishDate
                                            ? 'active'
                                            : it.finishDate < new Date()
                                              ? 'closed'
                                              : 'future'
                                        : 'future',
                                boardId: fallbackBoardObjectId,
                                boardReference: fallbackBoardId,
                            },
                        },
                        upsert: true,
                    },
                }));
                if (ops.length) {
                    await Sprint.bulkWrite(ops);
                    console.log('[AzureBoards][iterations] Fallback classification-nodes upserted', { projectName, count: ops.length });
                }
            } catch (e) {
                console.log('classification nodes fallback failed', e?.response?.status || e?.message);
            }
        }
    }

    async syncIterationIssuesForProject(organization, headers, apiVersion, connection, companyId, projectId, projectKeyId, boardsData, projectName) {
        const Sprint = SprintModel(connection);
        const SprintIssue = SprintIssueModel(connection);
        const Board = BoardModel(connection);
        const Project = ProjectModel(connection);

        const projectDoc = await Project.findOne({ _id: projectId, companyId }).lean();
        const templateName = projectDoc?.templateName || null;
        if (templateName) {
            console.log('[AzureBoards][issues] Using template for storyPoints calculation', {
                projectName,
                templateName,
            });
        }

        const sprints = await Sprint.find({ companyId, projectId });
        if (!sprints.length) {
            console.log('[AzureBoards][issues] No sprints found for project', { projectId: String(projectId) });
            return;
        }

        // Map numeric boardId → Board _id
        const boardMap = new Map();
        const boards = await Board.find({ companyId, projectId });
        for (const b of boards) {
            boardMap.set(b.boardId, b._id);
        }

        for (const sprint of sprints) {
            // Find the team info from boardsData via boardReference
            const bd = boardsData.find((x) => x.boardId === sprint.boardReference);
            const boardObjectId = bd ? boardMap.get(bd.boardId) || null : null;
            console.log('[AzureBoards][issues] Processing sprint', {
                sprintName: sprint.name,
                boardReference: sprint.boardReference,
                boardResolved: Boolean(boardObjectId),
            });

            try {
                // Prefer dedicated iteration work items API when we have the Azure iteration GUID
                let ids = [];
                const iterGuid = typeof sprint.azureIterationId === 'string' ? sprint.azureIterationId : null;
                const hasGuid = !!iterGuid && iterGuid.includes('-');
                if (bd?.boardLocation?.projectName && bd?.boardLocation?.name && hasGuid) {
                    const iterItemsUrl = `https://dev.azure.com/${organization}/${encodeURIComponent(bd.boardLocation.projectName)}/${encodeURIComponent(bd.boardLocation.name)}/_apis/work/teamsettings/iterations/${encodeURIComponent(iterGuid)}/workitems`;
                    const iterItemsResp = await this.retryWithDelay(() => axios.get(iterItemsUrl, { headers, params: { 'api-version': apiVersion } }));
                    const rels = Array.isArray(iterItemsResp.data?.workItemRelations) ? iterItemsResp.data.workItemRelations.map((r) => r?.target?.id).filter(Boolean) : [];
                    const direct = Array.isArray(iterItemsResp.data?.workItems) ? iterItemsResp.data.workItems.map((r) => r?.id).filter(Boolean) : [];
                    ids = rels.length ? rels : direct;
                    console.log('[AzureBoards][issues] Iteration workitems API', { sprint: sprint.name, ids: ids.length });
                }
                // Fallback to WIQL using full iteration path. Prefer "<Project>\<Team>\<Sprint Name>" then fallback to "<Project>\<Sprint Name>"
                if (!ids.length) {
                    const proj = bd?.boardLocation?.projectName || projectName || '';
                    const team = bd?.boardLocation?.name || '';
                    const teamPath = team ? `${proj}\\${team}\\${sprint.name}`.replace(/'/g, '\'\'') : null;
                    const projectPath = `${proj}\\${sprint.name}`.replace(/'/g, '\'\'');
                    let wiqlUrl;
                    if (bd?.boardLocation?.projectName && bd?.boardLocation?.name) {
                        wiqlUrl = `https://dev.azure.com/${organization}/${encodeURIComponent(bd.boardLocation.projectName)}/${encodeURIComponent(bd.boardLocation.name)}/_apis/wit/wiql`;
                    } else if (projectName) {
                        wiqlUrl = `https://dev.azure.com/${organization}/${encodeURIComponent(projectName)}/_apis/wit/wiql`;
                    } else {
                        console.log('[AzureBoards][issues] Skip sprint, no project/team context', { sprint: sprint.name });
                        continue;
                    }
                    // Try team-scoped iteration path first
                    if (teamPath) {
                        const wiqlTeam = { query: `SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] UNDER '${teamPath}' ORDER BY [System.ChangedDate] DESC` };
                        try {
                            const wiqlRespTeam = await this.retryWithDelay(() => axios.post(wiqlUrl, wiqlTeam, { headers, params: { 'api-version': apiVersion } }));
                            ids = (wiqlRespTeam.data?.workItems || []).map((r) => r.id);
                            console.log('[AzureBoards][issues] WIQL team-path ids', { sprint: sprint.name, iterPath: teamPath, ids: ids.length });
                        } catch (_) {
                            // ignore and fallback to project path
                        }
                    }
                    // Fallback to project path
                    if (!ids.length) {
                        const wiqlProj = { query: `SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] UNDER '${projectPath}' ORDER BY [System.ChangedDate] DESC` };
                        const wiqlRespProj = await this.retryWithDelay(() => axios.post(wiqlUrl, wiqlProj, { headers, params: { 'api-version': apiVersion } }));
                        ids = (wiqlRespProj.data?.workItems || []).map((r) => r.id);
                        console.log('[AzureBoards][issues] WIQL project-path ids', { sprint: sprint.name, iterPath: projectPath, ids: ids.length });
                    }
                }
                if (!ids.length) {
                    // Still update metrics to zero to avoid stale values
                    await SprintIssue.deleteMany({ companyId, projectId, sprintId: sprint._id });
                    await this.updateSprintMetrics(Sprint, SprintIssue, sprint._id, []);
                    console.log('[AzureBoards][issues] No work items for sprint', { sprint: sprint.name });
                    continue;
                }
                await SprintIssue.deleteMany({
                    companyId,
                    projectId,
                    sprintId: sprint._id,
                    issueId: { $nin: ids },
                });

                // Batch fetch details (chunk to 200 to be safe)
                const items = [];
                const chunkSize = 200;
                for (let i = 0; i < ids.length; i += chunkSize) {
                    const slice = ids.slice(i, i + chunkSize);
                    const batch = await this.retryWithDelay(() =>
                        axios.post(`https://dev.azure.com/${organization}/_apis/wit/workitemsbatch`, { ids: slice, $expand: 'fields' }, { headers, params: { 'api-version': '7.0' } })
                    );
                    items.push(...(batch.data?.value || []));
                }
                console.log('[AzureBoards][issues] Work items fetched', { sprint: sprint.name, count: items.length });

                // Get workflow statuses from board for work timeline calculation
                const workflowStatuses = bd?.workflowStatuses || [];
                const canonicalStatusByNorm = this.buildCanonicalStatusMap(workflowStatuses);

                // Build issue operations with status change log and work timeline
                const issueOps = [];
                for (const wi of items) {
                    const fields = wi.fields || {};
                    const { customFields, customFieldsByName } = this.buildCustomFieldsFromAzure(fields);
                    const { storyPoints, pointsSourceType, pointsSourceRefName } = this.calculateStoryPoints(fields, templateName,wi.id);
                    const originalEstimate = Number(fields[FIELD_ORIGINAL_ESTIMATE] || 0);
                    const originalEstimateHrs = originalEstimate > 10000 ? originalEstimate / 3600 : originalEstimate; // seconds or hours fallback
                    
                    const workItemType = this.normalizeWorkItemType(fields['System.WorkItemType']);

                    // Fetch work item updates to extract status change log
                    const updates = await this.fetchWorkItemUpdates(organization, headers, wi.id);
                    const statusChangeLog = this.extractStatusChangeLog(updates);
                    const { workStartedAt, workCompletedAt } = this.getAzureWorkTimeline(workflowStatuses, statusChangeLog);

                    const completedWorkHrs = this.toAzureHours(fields[FIELD_COMPLETED_WORK]);
                    const remainingWorkHrs = this.toAzureHours(fields[FIELD_REMAINING_WORK]);
                    const worklog = this.extractWorklogFromCompletedWorkUpdates(updates);
                    const timeSpentHrs = completedWorkHrs;
                    let originalEstimateHrsFinal = Number.isFinite(originalEstimateHrs) ? originalEstimateHrs : 0;
                    if (String(pointsSourceRefName || '') === `${FIELD_REMAINING_WORK}+${FIELD_COMPLETED_WORK}`) {
                        const totalEstimateHrs = remainingWorkHrs + completedWorkHrs;
                        if (Number.isFinite(totalEstimateHrs) && totalEstimateHrs > 0) {
                            originalEstimateHrsFinal = totalEstimateHrs;
                        }
                    }

                    const rawState = fields['System.State'] || '';
                    const canonicalState = canonicalStatusByNorm.get(this.normalizeStatusName(rawState)) || rawState;
                    
                    // Calculate isAccepted flag for Bug-type work items
                    const isAcceptedResult = calculateIsAccepted(
                        { name: workItemType },
                        { name: fields['System.State'] || '' },
                        [],
                        customFieldsByName,
                        []
                    );
                    const isAccepted = isAcceptedResult !== null ? isAcceptedResult.isAccepted : null;

                    issueOps.push({
                        updateOne: {
                            filter: { companyId, projectId, sprintId: sprint._id, issueId: wi.id },
                            update: {
                                $set: {
                                    companyId,
                                    projectId,
                                    sprintId: sprint._id,
                                    boardId: boardObjectId,
                                    issueId: wi.id,
                                    key: String(wi.id),
                                    summary: fields['System.Title'] || '',
                                    storyPoints,
                                    pointsSourceType,
                                    pointsSourceRefName,
                                    originalEstimateHrs: originalEstimateHrsFinal,
                                    timeSpentHrs,
                                    worklog,
                                    type: { name: workItemType },
                                    status: { name: canonicalState },
                                    assignee: fields['System.AssignedTo']?.displayName || null,
                                    issueCreatedAt: fields['System.CreatedDate'] ? new Date(fields['System.CreatedDate']) : null,
                                    issueUpdatedAt: fields['System.ChangedDate'] ? new Date(fields['System.ChangedDate']) : null,
                                    projectKeyId,
                                    customFields,
                                    customFieldsByName,
                                    statusChangeLog,
                                    workStartedAt,
                                    workCompletedAt,
                                    isAccepted,
                                },
                            },
                            upsert: true,
                        },
                    });
                }

                if (issueOps.length) {
                    await SprintIssue.bulkWrite(issueOps, { ordered: false });
                    console.log('[AzureBoards][issues] Upserted', { sprint: sprint.name, count: issueOps.length });
                }

                // Update sprint metrics (planned/completed/remaining for SP & hours)
                await this.updateSprintMetrics(Sprint, SprintIssue, sprint._id);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.log('syncIterationIssuesForProject failed', sprint.name, e.message);
            }
        }
    }

    async fetchIterationsViaClassificationNodes(organization, projectName, headers, apiVersion) {
        const url = `https://dev.azure.com/${organization}/${encodeURIComponent(projectName)}/_apis/wit/classificationnodes/iterations`;
        const resp = await this.retryWithDelay(() => axios.get(url, { headers, params: { 'api-version': apiVersion, $depth: 5 } }));
        const out = [];
        function walk(node, path) {
            const full = path ? `${path}\\${node.name}` : node.name;
            out.push({
                name: node.name,
                iterationPath: full,
                startDate: node.attributes?.startDate ? new Date(node.attributes.startDate) : null,
                finishDate: node.attributes?.finishDate ? new Date(node.attributes.finishDate) : null,
            });
            (node.children || []).forEach((child) => walk(child, full));
        }
        if (resp.data) {
            if (Array.isArray(resp.data.children) && resp.data.children.length) {
                resp.data.children.forEach((child) => walk(child, ''));
            } else if (resp.data.name) {
                walk(resp.data, '');
            }
        }
        return out;
    }
    async updateSprintMetrics(Sprint, SprintIssue, sprintObjectId, cachedIssues = null) {
        const issues = cachedIssues || (await SprintIssue.find({ sprintId: sprintObjectId }));
        let committedStoryPoints = 0;
        let committedHours = 0;
        let completedStoryPoints = 0;
        let completedHours = 0;

        for (const issue of issues) {
            const sp = Number(issue.storyPoints || 0);
            const hrs = Number(issue.originalEstimateHrs || 0);
            committedStoryPoints += sp;
            committedHours += hrs;
            const status = (issue.status?.name || '').toLowerCase();
            if (['done', 'closed', 'resolved', 'completed'].includes(status)) {
                completedStoryPoints += sp;
                completedHours += hrs;
            }
        }

        await Sprint.updateOne(
            { _id: sprintObjectId },
            {
                $set: {
                    'committedVsCompletedMetrics.committedStoryPoints': parseFloat(committedStoryPoints.toFixed(2)),
                    'committedVsCompletedMetrics.completedStoryPoints': parseFloat(completedStoryPoints.toFixed(2)),
                    'committedVsCompletedMetrics.remainingStoryPoints': parseFloat((committedStoryPoints - completedStoryPoints).toFixed(2)),
                    'committedVsCompletedMetrics.committedHours': parseFloat(committedHours.toFixed(2)),
                    'committedVsCompletedMetrics.completedHours': parseFloat(completedHours.toFixed(2)),
                    'committedVsCompletedMetrics.remainingHours': parseFloat((committedHours - completedHours).toFixed(2)),
                },
            }
        );
    }
    async boardIssues(organization, headers, tenantConnection, companyId, type, projectId) {
        // Minimal: query recent changed work items per project and upsert into BoardIssueModel
        const Project = ProjectModel(tenantConnection);
        const Sprint = SprintModel(tenantConnection);
        const BoardIssue = BoardIssueModel(tenantConnection);
        const Board = BoardModel(tenantConnection);
        const projects = await Project.find({
            companyId,
            projectTypeKey: 'azure-project',
            ...(projectId && Types.ObjectId.isValid(projectId) ? { _id: new Types.ObjectId(projectId) } : {}),
        });
        for (const proj of projects) {
            const boards = await Board.find({ companyId, projectId: proj._id });
            for (const b of boards) {
                const hasSprints = await Sprint.countDocuments({ companyId, projectId: proj._id, boardId: b._id });
                if (hasSprints > 0) {
                    continue;
                }
                try {
                    const projectName = b?.boardLocation?.projectName || proj.name;
                    const teamName = b?.boardLocation?.name || b.boardName || proj.name;
                    const wiql = {
                        query: `SELECT [System.Id], [System.WorkItemType], [System.Title], [System.State], [System.AssignedTo], [System.ChangedDate]
                                FROM WorkItems WHERE [System.TeamProject] = '${proj.name}' ORDER BY [System.ChangedDate] DESC`,
                    };
                    const wiqlUrl = `https://dev.azure.com/${organization}/${encodeURIComponent(projectName)}/${encodeURIComponent(teamName)}/_apis/wit/wiql`;
                    const wiqlResp = await this.retryWithDelay(() =>
                        axios.post(wiqlUrl, wiql, {
                            headers,
                            params: { 'api-version': '7.0' },
                        })
                    ); 
                    const ids = (wiqlResp.data?.workItems || []).map((r) => r.id);
                    if (!ids.length) {
                        continue;
                    }
                    const items = [];
                    const chunkSize = 200;
                    for (let i = 0; i < ids.length; i += chunkSize) {
                        const slice = ids.slice(i, i + chunkSize);
                        const batch = await this.retryWithDelay(() =>
                            axios.post(
                                `https://dev.azure.com/${organization}/_apis/wit/workitemsbatch`,
                                { ids: slice, $expand: 'fields' },
                                {
                                    headers,
                                    params: { 'api-version': '7.0' },
                                }
                            )
                        );
                        items.push(...(batch.data?.value || []));
                    }

                    // Get workflow statuses from board for work timeline calculation
                    const workflowStatuses = b?.boardLocation?.workflowStatuses || proj?.workflowStatuses || [];
                    const canonicalStatusByNorm = this.buildCanonicalStatusMap(workflowStatuses);

                    // Build board issue operations with status change log and work timeline
                    const ops = [];
                    for (const wi of items) {
                        const workItemType = this.normalizeWorkItemType(wi.fields?.['System.WorkItemType']);
                        const { customFields, customFieldsByName } = this.buildCustomFieldsFromAzure(wi.fields || {});

                        // Fetch work item updates to extract status change log
                        const updates = await this.fetchWorkItemUpdates(organization, headers, wi.id);
                        const statusChangeLog = this.extractStatusChangeLog(updates);
                        const { workStartedAt, workCompletedAt } = this.getAzureWorkTimeline(workflowStatuses, statusChangeLog);
                        
                        // Calculate isAccepted flag for Bug-type work items
                        const isAcceptedResult = calculateIsAccepted(
                            { name: workItemType },
                            { name: wi.fields?.['System.State'] || '' },
                            [],
                            customFieldsByName,
                            []
                        );
                        const isAccepted = isAcceptedResult !== null ? isAcceptedResult.isAccepted : null;
                        const rawState = wi.fields?.['System.State'] || '';
                        const canonicalState = canonicalStatusByNorm.get(this.normalizeStatusName(rawState)) || rawState;

                        ops.push({
                            updateOne: {
                                filter: { companyId, projectId: proj._id, boardId: b._id, issueId: wi.id },
                                update: {
                                    $set: {
                                        companyId,
                                        projectId: proj._id,
                                        boardId: b._id,
                                        issueId: wi.id,
                                        key: String(wi.id),
                                        summary: wi.fields?.['System.Title'] || '',
                                        type: { name: workItemType },
                                        status: { name: canonicalState },
                                        assignee: wi.fields?.['System.AssignedTo']?.displayName || null,
                                        issueCreatedAt: wi.fields?.['System.CreatedDate'] ? new Date(wi.fields['System.CreatedDate']) : null,
                                        issueUpdatedAt: wi.fields?.['System.ChangedDate'] ? new Date(wi.fields['System.ChangedDate']) : null,
                                        projectKeyId: proj.projectKeyId,
                                        customFields,
                                        customFieldsByName,
                                        statusChangeLog,
                                        workStartedAt,
                                        workCompletedAt,
                                        isAccepted,
                                    },
                                },
                                upsert: true,
                            },
                        });
                    }
                    if (ops.length) {
                        await BoardIssue.bulkWrite(ops);
                        console.log('[AzureBoards][boardIssues] Upserted board issues', {
                            project: proj.name,
                            board: b.boardName,
                            count: ops.length,
                        });
                    }
                } catch (e) {
                    console.log('[AzureBoards][boardIssues] skipped board due to error', {
                        project: proj.name,
                        board: b.boardName,
                        message: e?.message,
                        status: e?.response?.status,
                    });
                }
            }
        }
    }

    async fetchStoryPoints(companyId, tenantConnection, projectId, type) {
        try {
            const SprintIssue = SprintIssueModel(tenantConnection);
            const Sprint = SprintModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const today = new Date().toISOString().split('T')[0];

            const projectFilter = { companyId };
            if (projectId && Types.ObjectId.isValid(projectId)) {
                projectFilter._id = new Types.ObjectId(projectId);
            }
            const projects = await Project.find(projectFilter).lean();

            for (const proj of projects) {
                // active sprints (and optionally most recent closed) similar to Jira light mode
                const sprintFilter = { companyId, projectId: proj._id };
                const allSprints = await Sprint.find(sprintFilter).sort({ startDate: 1 }).lean();
                let sprints = [];
                if (type === 'light') {
                    const active = await Sprint.find({ ...sprintFilter, state: { $in: ['active', 'current'] } });
                    const latestClosed = await Sprint.find({ ...sprintFilter, state: { $in: ['closed', 'past'] } })
                        .sort({ endDate: -1 })
                        .limit(1);
                    sprints = [...active, ...latestClosed];
                } else {
                    sprints = await Sprint.find(sprintFilter);
                }

                for (const sprint of sprints) {
                    let previousAssigneeResults = [];
                    let sprintStartDate = null;
                    if (sprint.startDate && !isNaN(new Date(sprint.startDate))) {
                        sprintStartDate = new Date(sprint.startDate).toISOString().split('T')[0];
                    }
                    if (sprintStartDate === today && !sprint.assigneeCopiedForToday) {
                        const selectedIndex = allSprints.findIndex(
                            (s) => s._id?.toString() === sprint._id?.toString()
                        );
                        const previousSprint = selectedIndex > 0 ? allSprints[selectedIndex - 1] : null;
                        previousAssigneeResults = previousSprint?.assignees || [];
                    }

                    const issues = await SprintIssue.find({ companyId, projectId: proj._id, sprintId: sprint._id });
                    // Decide hours-mode if originalEstimate present and story points absent
                    const hasHours = issues.some((x) => Number(x.originalEstimateHrs || 0) > 0);
                    const hasSP = issues.some((x) => Number(x.storyPoints || 0) > 0);
                    const timeBasedRefRegex = /(originalestimate|remainingwork|completedwork)/i;
                    const hasTimeBasedPoints = issues.some((x) => timeBasedRefRegex.test(String(x.pointsSourceRefName || '')));
                    const useHours = (hasHours && !hasSP) || hasTimeBasedPoints;

                    let sprintPointsSourceType = null;
                    const pointsIssues = issues.filter((x) => Number(x.storyPoints || 0) > 0);
                    if (pointsIssues.length) {
                        let sumStoryPoints = 0;
                        let sumEffortPoints = 0;
                        for (const is of pointsIssues) {
                            const t = is.pointsSourceType === 'storyPoints' ? 'storyPoints' : is.pointsSourceType === 'effort' ? 'effort' : null;
                            const v = Number(is.storyPoints || 0);
                            if (!Number.isFinite(v) || v <= 0) {continue;}
                            if (t === 'storyPoints') {sumStoryPoints += v;}
                            if (t === 'effort') {sumEffortPoints += v;}
                        }
                        if (sumStoryPoints || sumEffortPoints) {
                            sprintPointsSourceType = sumStoryPoints >= sumEffortPoints ? 'storyPoints' : 'effort';
                        }
                    }
                    if (!sprintPointsSourceType) {
                        const t = String(proj?.templateName || '').toLowerCase().trim();
                        if (t === TEMPLATE_AGILE) {
                            sprintPointsSourceType = 'storyPoints';
                        } else if ([TEMPLATE_SCRUM, TEMPLATE_CMMI, TEMPLATE_BASIC].includes(t)) {
                            sprintPointsSourceType = 'effort';
                        }
                    }
                    if (!sprintPointsSourceType && typeof sprint?.pointsSourceType === 'string') {
                        sprintPointsSourceType = sprint.pointsSourceType;
                    }

                    const assigneesMap = new Map();
                    for (const is of issues) {
                        const key = is.assignee || 'UnAssigned';
                        const agg = assigneesMap.get(key) || {
                            assignee: key,
                            storyPoints: 0,
                            allocatedHours: 0,
                            availableHours: 0,
                            role: '',
                            billingRate: 0,
                            holiday: 0,
                            leaves: 0,
                            netAvailableCapacity: 0,
                        };
                        if (useHours) {
                            agg.allocatedHours += Number(is.originalEstimateHrs || 0);
                        } else if ((is.type?.name || '').toLowerCase() === 'story') {
                            /* empty */
                        } else if ((is.type?.name || '').toLowerCase().includes('story')) {
                            agg.storyPoints += Number(is.storyPoints || 0);
                            agg.allocatedHours += Number(is.storyPoints || 0);
                        }
                        assigneesMap.set(key, agg);
                    }

                    if (assigneesMap.size === 0 && previousAssigneeResults.length > 0) {
                        for (const prev of previousAssigneeResults) {
                            if (!prev?.assignee) {
                                continue;
                            }
                            assigneesMap.set(prev.assignee, {
                                assignee: prev.assignee,
                                storyPoints: prev.storyPoints || 0,
                                allocatedHours: prev.allocatedHours || 0,
                                availableHours: prev.availableHours || 0,
                                role: prev.role || '',
                                billingRate: prev.billingRate || 0,
                                holiday: prev.holiday || 0,
                                leaves: prev.leaves || 0,
                                netAvailableCapacity: prev.netAvailableCapacity || 0,
                                allocationType: prev.allocationType,
                            });
                        }
                    }

                    // Preserve previously entered capacity fields (availableHours, role, billingRate, etc.)
                    // by merging with existing sprint assignees, similar to Jira behavior.
                    const existingSprint = await Sprint.findById(sprint._id).lean();
                    const existingAssignees = existingSprint?.assignees || [];
                    const mergedAssignees = Array.from(assigneesMap.values()).map((a) => {
                        const prev =
                            existingAssignees.find((p) => p.assignee === a.assignee) ||
                            previousAssigneeResults.find((p) => p.assignee === a.assignee);
                        return {
                            ...a,
                            availableHours: prev?.availableHours ?? a.availableHours ?? 0,
                            role: prev?.role ?? a.role ?? '',
                            billingRate: prev?.billingRate ?? a.billingRate ?? 0,
                            allocationType: prev?.allocationType ?? a.allocationType,
                            netAvailableCapacity: prev?.netAvailableCapacity ?? a.netAvailableCapacity ?? 0,
                            holiday: prev?.holiday ?? a.holiday ?? 0,
                            leaves: prev?.leaves ?? a.leaves ?? 0,
                        };
                    });

                    await Sprint.updateOne({ _id: sprint._id }, { $set: { assignees: mergedAssignees, hours: useHours, pointsSourceType: sprintPointsSourceType } });
                    if (sprintStartDate === today && previousAssigneeResults.length > 0 && !sprint.assigneeCopiedForToday) {
                        try {
                            await Sprint.updateOne({ _id: sprint._id }, { $set: { assigneeCopiedForToday: true } });
                        } catch (error) {
                            console.error('Failed to update sprint assigneeCopiedForToday:', error);
                        }
                    }
                }
            }
            return true;
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log('fetchStoryPoints (Azure) failed', e.message);
            return false;
        }
    }

    async calculateAndStoreAzureBurndownAndBurnup(companyId, tenantConnection, projectId, type) {
        const Sprint = SprintModel(tenantConnection);
        const Board = BoardModel(tenantConnection);
        const Project = ProjectModel(tenantConnection);

        const projectFilter = {
            companyId,
            projectTypeKey: 'azure-project',
        };
        if (projectId && Types.ObjectId.isValid(projectId)) {
            projectFilter._id = new Types.ObjectId(projectId);
        }

        const projects = await Project.find(projectFilter, { _id: 1 }).lean();
        if (!projects.length) {
            return;
        }

        for (const proj of projects) {
            const boards = await Board.find({ companyId, projectId: proj._id }, { _id: 1 }).lean();
            for (const board of boards) {
                let sprints = [];
                if (type === 'light') {
                    const active = await Sprint.find({
                        companyId,
                        projectId: proj._id,
                        boardId: board._id,
                        state: { $in: ['active', 'current'] },
                    }).lean();
                    const latestClosed = await Sprint.find({
                        companyId,
                        projectId: proj._id,
                        boardId: board._id,
                        state: { $in: ['closed', 'past'] },
                    })
                        .sort({ endDate: -1 })
                        .limit(1)
                        .lean();
                    sprints = [...active, ...latestClosed];
                } else {
                    sprints = await Sprint.find({
                        companyId,
                        projectId: proj._id,
                        boardId: board._id,
                    }).lean();
                }

                const unique = new Map();
                for (const s of sprints) {
                    if (s?._id) {
                        unique.set(String(s._id), s);
                    }
                }

                for (const sprint of unique.values()) {
                    if (!sprint?.startDate || !sprint?.endDate) {
                        continue;
                    }
                    const estimationType = sprint.hours === true ? 'hours' : 'storyPoints';

                    await burndownCalculationService.calculateAndStoreBurndown(
                        String(companyId),
                        String(proj._id),
                        String(board._id),
                        String(sprint._id),
                        null,
                        null,
                        tenantConnection,
                        estimationType
                    );

                    await burnupCalculationService.calculateAndStoreBurnup(
                        String(companyId),
                        String(proj._id),
                        String(board._id),
                        String(sprint._id),
                        null,
                        null,
                        tenantConnection,
                        estimationType
                    );
                }
            }
        }
    }

    async syncPlannedAndReleaseData(tenantConnection, companyId, projectId, type) {
        try {
            const Sprint = SprintModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const projectFilter = { companyId };
            if (projectId && Types.ObjectId.isValid(projectId)) {
                projectFilter._id = new Types.ObjectId(projectId);
            }
            const projects = await Project.find(projectFilter).lean();

            for (const proj of projects) {
                const sprintFilter = { companyId, projectId: proj._id };
                let sprints = [];
                if (type === 'light') {
                    const active = await Sprint.find({ ...sprintFilter, state: { $in: ['active', 'current'] } });
                    const latestClosed = await Sprint.find({ ...sprintFilter, state: { $in: ['closed', 'past'] } })
                        .sort({ endDate: -1 })
                        .limit(1);
                    sprints = [...active, ...latestClosed];
                } else {
                    sprints = await Sprint.find(sprintFilter);
                }
                for (const sprint of sprints) {
                    await this.updateSprintMetrics(Sprint, SprintIssueModel(tenantConnection), sprint._id);
                }
            }
            return true;
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log('syncPlannedAndReleaseData (Azure) failed', e.message);
            return false;
        }
    }

    async churnDataMap(companyId, tenantConnection, type, projectId) {
        try {
            const Sprint = SprintModel(tenantConnection);
            const SprintIssue = SprintIssueModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const projectFilter = { companyId };
            if (projectId && Types.ObjectId.isValid(projectId)) {
                projectFilter._id = new Types.ObjectId(projectId);
            }
            const projects = await Project.find(projectFilter).lean();

            for (const proj of projects) {
                const sprints = await Sprint.find({ companyId, projectId: proj._id });
                for (const sprint of sprints) {
                    const issues = await SprintIssue.find({ companyId, projectId: proj._id, sprintId: sprint._id });
                    const plannedCutoff = sprint.startDate ? new Date(sprint.startDate) : null;
                    // const endCutoff = sprint.endDate ? new Date(sprint.endDate) : null;

                    let planned = 0,
                        added = 0;
                    const removed = 0;
                    // Aggregate by developer for per-dev churn
                    const developerToCounts = new Map(); // developer -> { developer, planned, added, removed }
                    for (const is of issues) {
                        const created = is.issueCreatedAt ? new Date(is.issueCreatedAt) : null;
                        const developer = is.assignee || 'Unassigned';
                        let bucket = null;
                        if (plannedCutoff && created && created <= plannedCutoff) {
                            planned++;
                            bucket = 'planned';
                        } else if (plannedCutoff && created && created > plannedCutoff) {
                            added++;
                            bucket = 'added';
                        }
                        if (bucket) {
                            const agg = developerToCounts.get(developer) || { developer, planned: 0, added: 0, removed: 0 };
                            agg[bucket] += 1;
                            developerToCounts.set(developer, agg);
                        }
                    }
                    const churnRate = planned > 0 ? ((added + removed) / planned) * 100 : 0;
                    const developerChurn = Array.from(developerToCounts.values()).map((d) => ({
                        developer: d.developer,
                        planned: d.planned,
                        added: d.added,
                        removed: d.removed,
                        churnRate: parseFloat((d.planned > 0 ? ((d.added + d.removed) / d.planned) * 100 : 0).toFixed(1)),
                    }));
                    await Sprint.updateOne(
                        { _id: sprint._id },
                        {
                            $set: {
                                storyChurn: [
                                    {
                                        issueType: 'Story',
                                        planned,
                                        added,
                                        removed,
                                        churnRate: parseFloat(churnRate.toFixed(1)),
                                        developerChurn,
                                    },
                                ],
                            },
                        }
                    );
                }
            }
            return true;
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log('churnDataMap (Azure) failed', e.message);
            return false;
        }
    }

    async cycleTimeData(companyId, tenantConnection, type, projectId) {
        try {
            const Sprint = SprintModel(tenantConnection);
            const SprintIssue = SprintIssueModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);

            const projectFilter = { companyId };
            if (projectId) {
                projectFilter._id = projectId;
            }
            const projects = await Project.find(projectFilter).lean();

            for (const proj of projects) {
                const sprints = await Sprint.find({ companyId, projectId: proj._id });
                for (const sprint of sprints) {
                    const issues = await SprintIssue.find({ companyId, projectId: proj._id, sprintId: sprint._id });
                    let totalDays = 0;
                    let completed = 0;
                    const byDev = new Map();

                    for (const is of issues) {
                        const status = (is.status?.name || '').toLowerCase();
                        const typeName = (is.type?.name || '').toLowerCase();
                        const isDone = ['done', 'closed', 'resolved', 'completed'].includes(status);
                        const isStory = typeName.includes('story');
                        if (isDone && isStory) {
                            const start = is.issueCreatedAt ? new Date(is.issueCreatedAt) : null;
                            const end = is.issueUpdatedAt ? new Date(is.issueUpdatedAt) : null;
                            if (start && end && end >= start) {
                                const days = (end - start) / (1000 * 60 * 60 * 24);
                                totalDays += days;
                                completed++;

                                const dev = is.assignee || 'Unassigned';
                                const agg = byDev.get(dev) || { developer: dev, total: 0, count: 0 };
                                agg.total += days;
                                agg.count += 1;
                                byDev.set(dev, agg);
                            }
                        }
                    }
                    const cycleTime = completed > 0 ? parseFloat((totalDays / completed).toFixed(2)) : 0;
                    const cycleTimeByDeveloper = Array.from(byDev.values()).map((x) => ({
                        developer: x.developer,
                        averageCycleTime: parseFloat((x.total / x.count).toFixed(2)),
                        totalIssues: x.count,
                    }));

                    await Sprint.updateOne(
                        { _id: sprint._id },
                        {
                            $set: {
                                cycleTime: {
                                    totalCycleTime: cycleTime,
                                    totalTimeSpent: totalDays,
                                    numberOfIssues: completed,
                                    cycleTimeByDeveloper,
                                },
                            },
                        }
                    );
                }
            }
            return true;
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log('cycleTimeData (Azure) failed', e.message);
            return false;
        }
    }

    async addUser(organization, headers, companyId, connection, projectId) {
        // Fetch team members per project/team and store on Board/Project similar to Jira addUser/addUserByBoard
        const Project = ProjectModel(connection);
        const Board = BoardModel(connection);
        const projects = await Project.find({
            companyId,
            ...(projectId && Types.ObjectId.isValid(projectId) ? { _id: new Types.ObjectId(projectId) } : {}),
        });
        for (const proj of projects) {
            try {
                const boards = await Board.find({ companyId, projectId: proj._id });
                for (const b of boards) {
                    try {
                        const projectName = b?.boardLocation?.projectName || proj.name;
                        const teamName = b?.boardLocation?.name || b.boardName || proj.name;
                        const url = `https://dev.azure.com/${organization}/${encodeURIComponent(projectName)}/${encodeURIComponent(teamName)}/_apis/team/members`;
                        const membersResp = await this.retryWithDelay(() =>
                            axios.get(url, {
                                headers,
                                params: { 'api-version': '7.0' },
                            })
                        ); 
                        const members = (membersResp.data?.value || []).map((m) => ({
                            accountId: m.identity?.id,
                            displayName: m.identity?.displayName,
                            emailAddress: m.identity?.uniqueName,
                            active: true,
                        }));
                        await Board.updateOne({ _id: b._id }, { $set: { assignees: members } });
                    } catch (e) {
                        // ignore per board
                    }
                }
            } catch (e) {
                // ignore per project
            }
        }
    }
}

export default new SyncAzureBoardsService();
