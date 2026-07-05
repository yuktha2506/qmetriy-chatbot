import { ProjectModel, BoardModel } from '../project-management/jira/model';
import axios from 'axios';
import { ConnectionModel } from './model';
import { cryptoHandler, getProjectStartDateFromJira } from '../../utils/commonFunctions';
import {
    PROVIDER_JIRA,
    PROVIDER_GITHUB,
    PROVIDER_GITLAB,
    PROVIDER_TRELLO,
    PROVIDER_TESTRAIL,
    PROVIDER_XRAY,
    PROVIDER_ADO,
    PROVIDER_AZURE_BOARDS,
    PROVIDER_AZURE_BOARD,
    PROVIDER_BITBUCKET,
    PROVIDER_GITLAB_ISSUES,
    GITLAB_API_BASE_URL,
} from '../../utils/constants/providerConstants';

class ConnectionController {
    async jiraAuthCheck({ host, username, password }) {
        try {
            const url = `${host}/rest/api/2/myself`;
            const response = await axios.get(url, { auth: { username, password } });
            return { valid: true, status: response.status };
        } catch (err) {
            if (err.response) {
                return { valid: false, status: err.response.status, message: err.response.data?.message };
            }
            return { valid: false, status: 500, message: err.message };
        }
    }
    async githubAuthCheck({ token }) {
        try {
            const response = await axios.get('https://api.github.com/user', {
                headers: { Authorization: `Bearer ${token}` },
            });
            return { valid: true, status: response.status };
        } catch (err) {
            if (err.response) {
                return { valid: false, status: err.response.status, message: err.response.data?.message };
            }
            return { valid: false, status: 500, message: err.message };
        }
    }
    async gitlabAuthCheck({ token }) {
        try {
            const url = `${GITLAB_API_BASE_URL}/user`;
            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return { valid: true, status: response.status };
        } catch (err) {
            if (err.response) {
                return { valid: false, status: err.response.status, message: err.response.data?.message };
            }
            return { valid: false, status: 500, message: err.message };
        }
    }

    async trelloAuthCheck({ apiKey, apiToken }) {
        try {
            const url = `https://api.trello.com/1/members/me?key=${apiKey}&token=${apiToken}`;
            const response = await axios.get(url);
            return { valid: true, status: response.status };
        } catch (err) {
            if (err.response) {
                return { valid: false, status: err.response.status, message: err.response.data?.message };
            }
            return { valid: false, status: 500, message: err.message };
        }
    }

    async testrailAuthCheck({ host, username, password }) {
        try {
            const url = `${host}/index.php?/api/v2/get_projects`;
            const response = await axios.get(url, { auth: { username, password } });
            return { valid: true, status: response.status };
        } catch (err) {
            if (err.response) {
                return { valid: false, status: err.response.status, message: err.response.data?.message };
            }
            return { valid: false, status: 500, message: err.message };
        }
    }

    async xrayCloudAuthCheck({ host, clientId, clientSecret }) {
        try {
            const base = host && host.trim() ? host.replace(/\/+$/, '') : 'https://xray.cloud.getxray.app';
            const url = `${base}/api/v2/authenticate`;
            const response = await axios.post(url, { client_id: clientId, client_secret: clientSecret }, { headers: { 'Content-Type': 'application/json' } });
            if (response && response.data) {
                return { valid: true, status: response.status };
            }
            return { valid: false, status: 400, message: 'No token returned from Xray' };
        } catch (err) {
            if (err.response) {
                return { valid: false, status: err.response.status, message: err.response.data || err.response.data?.message };
            }
            return { valid: false, status: 500, message: err.message };
        }
    }

    async azureDevOpsAuthCheck({ host, username, password }) {
        try {
            // Accept either full host (https://dev.azure.com/{org}) or just org slug
            const isFull = typeof host === 'string' && host.includes('dev.azure.com');
            const base = isFull ? host.replace(/\/+$/, '') : `https://dev.azure.com/${host}`;
            const url = `${base}/_apis/projects?api-version=7.0`;
            const headers = {
                Authorization: `Basic ${Buffer.from(`${(username && String(username).trim()) || 'pat'}:${password}`).toString('base64')}`,
                'Content-Type': 'application/json',
            };
            const response = await axios.get(url, { headers });
            return { valid: true, status: response.status };
        } catch (err) {
            if (err.response) {
                return { valid: false, status: err.response.status, message: err.response.data?.message };
            }
            return { valid: false, status: 500, message: err.message };
        }
    }

    async azureBoardsAuthCheck({ host, username, password }) {
        try {
            // Accept either full host (https://dev.azure.com/{org}) or just org slug
            const isFull = typeof host === 'string' && host.includes('dev.azure.com');
            const base = isFull ? host.replace(/\/+$/, '') : `https://dev.azure.com/${host}`;
            const url = `${base}/_apis/projects?api-version=7.0`;
            const headers = {
                Authorization: `Basic ${Buffer.from(`${(username && String(username).trim()) || 'pat'}:${password}`).toString('base64')}`,
                'Content-Type': 'application/json',
            };
            const response = await axios.get(url, { headers });
            return { valid: true, status: response.status };
        } catch (err) {
            if (err.response) {
                return { valid: false, status: err.response.status, message: err.response.data?.message };
            }
            return { valid: false, status: 500, message: err.message };
        }
    }

    async bitbucketAuthCheck({ username, password }) {
        try {
            const auth = { username: (username || '').trim(), password };
            const res = await axios.get('https://api.bitbucket.org/2.0/user', { auth });
            return { valid: true, status: res.status };
        } catch (err) {
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                try {
                    const auth = { username: (username || '').trim(), password };
                    const wr = await axios.get('https://api.bitbucket.org/2.0/workspaces?pagelen=1', { auth });
                    return { valid: true, status: wr.status };
                } catch (e2) {
                    if (e2.response) {
                        return { valid: false, status: e2.response.status, message: e2.response.data?.error?.message || e2.response.data?.message };
                    }
                    return { valid: false, status: 500, message: e2.message };
                }
            }
            if (err.response) {
                return { valid: false, status: err.response.status, message: err.response.data?.error?.message || err.response.data?.message };
            }
            return { valid: false, status: 500, message: err.message };
        }
    }

    addConnection = async (req, res) => {
        try {
            const { host, password, name, username, sourceType } = req.body;
            const tenantConnection = req.tenantConnection;
            const companyId = req.companyId;
            const Connection = ConnectionModel(tenantConnection);
            const provider = String(name || '')
                .toLowerCase()
                .replace(/\s+/g, '');

            if (provider === PROVIDER_JIRA) {
                const { valid, status, message } = await this.jiraAuthCheck({ host, username, password });
                if (!valid) {
                    return res.status(status).json({ error: message || 'Jira validation failed' });
                }
            } else if (provider === PROVIDER_GITHUB) {
                const { valid, status, message } = await this.githubAuthCheck({ token: password });
                if (!valid) {
                    return res.status(status).json({ error: message || 'GitHub validation failed' });
                }
            } else if (provider === PROVIDER_GITLAB) {
                const { valid, status, message } = await this.gitlabAuthCheck({ token: password });
                if (!valid) {
                    return res.status(status).json({ error: message || 'GitLab validation failed' });
                }
            } else if (provider === PROVIDER_TRELLO) {
                const { apiKey, apiToken } = req.body;
                const { valid, status, message } = await this.trelloAuthCheck({ apiKey, apiToken });
                if (!valid) {
                    return res.status(status).json({ error: message || 'Trello validation failed' });
                }
            } else if (provider === PROVIDER_TESTRAIL) {
                const { valid, status, message } = await this.testrailAuthCheck({ host, username, password });
                if (!valid) {
                    return res.status(status).json({ error: message || 'TestRail validation failed' });
                }
            } else if (provider === PROVIDER_XRAY) {
                const { valid, status, message } = await this.xrayCloudAuthCheck({ host, clientId: username, clientSecret: password });
                if (!valid) {
                    return res.status(status).json({ error: message || 'Xray validation failed' });
                }
            } else if (provider === PROVIDER_ADO) {
                const { valid, status, message } = await this.azureDevOpsAuthCheck({ host, username, password });
                if (!valid) {
                    return res.status(status).json({ error: message || 'Azure DevOps validation failed' });
                }
            } else if (provider === PROVIDER_AZURE_BOARDS || provider === PROVIDER_AZURE_BOARD) {
                const { valid, status, message } = await this.azureBoardsAuthCheck({ host, username, password });
                if (!valid) {
                    return res.status(status).json({ error: message || 'Azure Boards validation failed' });
                }
            } else if (provider === PROVIDER_BITBUCKET) {
                const { valid, status, message } = await this.bitbucketAuthCheck({ username, password });
                if (!valid) {
                    return res.status(status).json({ error: message || 'Bitbucket validation failed' });
                }
            }

            // Check for existing connection by companyId, name, host, and username (not sourceType)
            const existingConnection = await Connection.findOne({ 
                companyId, 
                name, 
                host, 
                username 
            });

            if (existingConnection) {
                const decryptedPassword = cryptoHandler(existingConnection.password, 'decrypt');

                if (password === decryptedPassword) {
                    const connectionData = existingConnection.toObject();
                    delete connectionData.password;

                    let needsSave = false;
                    // Update sourceType if provided and different
                    if (sourceType && sourceType !== existingConnection.sourceType) {
                        existingConnection.sourceType = sourceType;
                        connectionData.sourceType = sourceType;
                        needsSave = true;
                    }
                    // Update username if provided and different
                    if (req.body.username && req.body.username !== existingConnection.username) {
                        existingConnection.username = req.body.username;
                        connectionData.username = req.body.username;
                        needsSave = true;
                    }
                    if (needsSave) {
                        await existingConnection.save();
                    }

                    if (provider === PROVIDER_JIRA) {
                        try {
                            const decryptedConnection = {
                                ...existingConnection.toObject(),
                                password: decryptedPassword,
                            };
                            connectionData.syncJiraProjectData = await this.addProjects(companyId, decryptedConnection, tenantConnection);
                            connectionData.syncJiraBoardData = await this.syncBoards(companyId, decryptedConnection, tenantConnection);
                        } catch (error) {
                            console.error('Error syncing existing connection projects:', error);
                            connectionData.syncJiraProjectData = {
                                statusOfResponse: 'error',
                                message: error.message,
                            };
                        }
                    } else if (provider === PROVIDER_AZURE_BOARDS || provider === PROVIDER_AZURE_BOARD) {
                        try {
                            const dec = { host, password, username: existingConnection.username || username };
                            connectionData.syncAzureProjectData = await this.addAzureProjects(companyId, dec, tenantConnection);
                            connectionData.syncAzureBoardData = await this.azureSyncBoards(companyId, dec, tenantConnection);
                        } catch (error) {
                            console.error('Error syncing existing Azure Boards projects:', error);
                            connectionData.syncAzureProjectData = {
                                statusOfResponse: 'error',
                                message: error.message,
                            };
                        }
                    } else if (provider === PROVIDER_GITLAB_ISSUES) {
                        try {
                            const dec = { host, password, username: existingConnection.username || username };
                            connectionData.syncGitLabProjectData = await this.addGitLabProjects(companyId, dec, tenantConnection);
                            connectionData.syncGitLabBoardData = await this.gitlabSyncBoards(companyId, dec, tenantConnection);
                        } catch (error) {
                            console.error('Error syncing existing GitLab Issues projects:', error);
                            connectionData.syncGitLabProjectData = {
                                statusOfResponse: 'error',
                                message: error.message,
                            };
                        }
                    }
                    return res.status(200).json(connectionData);
                } else {
                    try {
                        const encryptedNewPassword = cryptoHandler(password, 'encrypt');
                        const updatedConnection = await Connection.findOneAndUpdate(
                            { companyId, name, host, username },
                            {
                                password: encryptedNewPassword,
                                username: username,
                                companyId: companyId,
                                sourceType: sourceType,
                            },
                            { new: true }
                        );

                        const responseData = updatedConnection.toObject();
                        delete responseData.password;

                        if (provider === PROVIDER_JIRA) {
                            try {
                                const decryptedConnection = {
                                    ...updatedConnection.toObject(),
                                    password: password,
                                };
                                responseData.syncJiraProjectData = await this.addProjects(companyId, decryptedConnection, tenantConnection);
                                responseData.syncJiraBoardData = await this.syncBoards(companyId, decryptedConnection, tenantConnection);
                            } catch (error) {
                                console.error('Error syncing updated connection projects:', error);
                                responseData.syncJiraProjectData = {
                                    statusOfResponse: 'error',
                                    message: error.message,
                                };
                            }
                        } else if (provider === PROVIDER_AZURE_BOARDS || provider === PROVIDER_AZURE_BOARD) {
                            try {
                                const dec = { host, password, username };
                                responseData.syncAzureProjectData = await this.addAzureProjects(companyId, dec, tenantConnection);
                                responseData.syncAzureBoardData = await this.azureSyncBoards(companyId, dec, tenantConnection);
                            } catch (error) {
                                console.error('Error syncing updated Azure Boards projects:', error);
                                responseData.syncAzureProjectData = {
                                    statusOfResponse: 'error',
                                    message: error.message,
                                };
                            }
                        } else if (provider === PROVIDER_GITLAB_ISSUES) {
                            try {
                                const dec = { host, password, username };
                                responseData.syncGitLabProjectData = await this.addGitLabProjects(companyId, dec, tenantConnection);
                                responseData.syncGitLabBoardData = await this.gitlabSyncBoards(companyId, dec, tenantConnection);
                            } catch (error) {
                                console.error('Error syncing updated GitLab Issues projects:', error);
                                responseData.syncGitLabProjectData = {
                                    statusOfResponse: 'error',
                                    message: error.message,
                                };
                            }
                        }
                        return res.status(200).json(responseData);
                    } catch (updateError) {
                        console.error('Error updating existing connection:', updateError);
                        return res.status(500).json({ error: 'Failed to update connection: ' + updateError.message });
                    }
                }
            }

            req.body.password = cryptoHandler(password, 'encrypt');
            req.body.companyId = companyId;
            const newConnection = new Connection(req.body);
            const savedConnection = await newConnection.save();
            const responseData = savedConnection.toObject();
            delete responseData.password;

            if (provider === PROVIDER_JIRA) {
                try {
                    const decryptedConnection = {
                        ...savedConnection.toObject(),
                        password: cryptoHandler(savedConnection.password, 'decrypt'),
                    };
                    responseData.syncJiraProjectData = await this.addProjects(companyId, decryptedConnection, tenantConnection);
                    responseData.syncJiraBoardData = await this.syncBoards(companyId, decryptedConnection, tenantConnection);
                } catch (error) {
                    console.error(' Error syncing new connection projects:', error);
                    responseData.syncJiraProjectData = {
                        statusOfResponse: 'error',
                        message: error.message,
                    };
                }
            } else if (provider === PROVIDER_AZURE_BOARDS || provider === PROVIDER_AZURE_BOARD) {
                try {
                    const decPwd = cryptoHandler(savedConnection.password, 'decrypt');
                    const dec = { host, password: decPwd, username };
                    responseData.syncAzureProjectData = await this.addAzureProjects(companyId, dec, tenantConnection);
                    responseData.syncAzureBoardData = await this.azureSyncBoards(companyId, dec, tenantConnection);
                } catch (error) {
                    console.error(' Error syncing new Azure Boards projects:', error);
                    responseData.syncAzureProjectData = {
                        statusOfResponse: 'error',
                        message: error.message,
                    };
                }
            } else if (provider === PROVIDER_GITLAB_ISSUES) {
                try {
                    const decPwd = cryptoHandler(savedConnection.password, 'decrypt');
                    const dec = { host, password: decPwd, username };
                    responseData.syncGitLabProjectData = await this.addGitLabProjects(companyId, dec, tenantConnection);
                    responseData.syncGitLabBoardData = await this.gitlabSyncBoards(companyId, dec, tenantConnection);
                } catch (error) {
                    console.error(' Error syncing new GitLab Issues projects:', error);
                    responseData.syncGitLabProjectData = {
                        statusOfResponse: 'error',
                        message: error.message,
                    };
                }
            }
            res.status(201).json(responseData);
        } catch (error) {
            console.error('Fatal error in addConnection:', error);
            res.status(500).json({ error: error.message });
        }
    };

    boardProjects = async (jiraConfig) => {
        try {
            let startAt = 0;
            const boards = [];
            let isLastPage = false;

            while (!isLastPage) {
                const response = await this.retryWithDelay(() =>
                    axios.get(`${jiraConfig.host}/rest/agile/1.0/board`, {
                        auth: {
                            username: jiraConfig.username,
                            password: jiraConfig.password,
                        },
                        params: { startAt, maxResults: 50 },
                    })
                );
                const fetchedBoards = response.data.values;
                boards.push(...fetchedBoards);
                isLastPage = response.data.isLast;
                startAt += 50;
            }
            return boards;
        } catch (error) {
            console.error('Error in boardProjects:', error);
            return {
                success: false,
                message: 'Failed to synchronize boards',
                error: error.message,
            };
        }
    };

    addProjects = async (companyId, jiraConfig, connection) => {
        const Project = ProjectModel(connection);
        try {
            const projects = [];

            const boards = await this.boardProjects(jiraConfig);
            // Using the previous paginated while-loop caused an infinite loop.
            const response = await this.retryWithDelay(() =>
                axios.get(`${jiraConfig.host}/rest/api/2/project`, {
                    auth: {
                        username: jiraConfig.username,
                        password: jiraConfig.password,
                    },
                })
            );
            if (Array.isArray(response.data)) { 
                projects.push(...response.data);
            }

            const bulkOperations = (
                await Promise.all(
                    projects.map(async (project) => {
                        const matchedBoards = boards.filter((board) => {
                            return String(board?.location?.projectId) === String(project?.id);
                        });

                        if (matchedBoards.length > 0) {
                            // Process all boards for this project
                            const boardsData = await Promise.all(
                                matchedBoards.map(async (board) => {
                                    const boardId = board.id;
                                    const boardConfig = await this.retryWithDelay(() =>
                                        axios.get(`${jiraConfig.host}/rest/agile/1.0/board/${boardId}/configuration`, {
                                            auth: {
                                                username: jiraConfig.username,
                                                password: jiraConfig.password,
                                            },
                                        })
                                    );
                                    const columns = boardConfig.data.columnConfig.columns;
                                    const columnData = await Promise.all(
                                        columns.map(async (col, index) => {
                                            const statusNames = await Promise.all(
                                                col.statuses.map(async (status) => {
                                                    try {
                                                        const statusResponse = await this.retryWithDelay(() =>
                                                            axios.get(status.self, {
                                                                auth: {
                                                                    username: jiraConfig.username,
                                                                    password: jiraConfig.password,
                                                                },
                                                            })
                                                        );
                                                        return statusResponse.data.name;
                                                    } catch (error) {
                                                        console.error('[STATUS DEBUG] Error config:', {
                                                            url: error.config?.url,
                                                            method: error.config?.method,
                                                            auth: error.config?.auth ? 'present' : 'missing',
                                                        });
                                                        const fallbackName = status.name || status.id || 'Unknown Status';
                                                        return fallbackName;
                                                    }
                                                })
                                            );
                                            return {
                                                order: index + 1,
                                                name: col.name,
                                                statuses: statusNames,
                                            };
                                        })
                                    );

                                    return {
                                        boardId: board.id,
                                        boardName: board.name,
                                        boardType: board.type,
                                        boardSelf: board.self,
                                        isPrivate: board.isPrivate || false,
                                        workflowStatuses: columnData,
                                        boardLocation: {
                                            projectId: board.location?.projectId,
                                            projectName: board.location?.projectName,
                                            projectKey: board.location?.projectKey,
                                            projectTypeKey: board.location?.projectTypeKey,
                                            avatarURI: board.location?.avatarURI,
                                            displayName: board.location?.displayName,
                                            name: board.location?.name,
                                        },
                                    };
                                })
                            );

                            // Use the first board for backward compatibility
                            const primaryBoard = matchedBoards[0];
                            const primaryBoardData = boardsData[0];

                            let startDate = null;
                            try {
                                startDate = await this.retryWithDelay(() => getProjectStartDateFromJira(jiraConfig, project.key));
                            } catch (err) {
                                console.warn('Error with Project startDate', err);
                                
                            }

                            return {
                                updateOne: {
                                    filter: { projectKeyId: project.id },
                                    update: {
                                        $set: {
                                            companyId,
                                            projectKeyId: project.id,
                                            name: project.name,
                                            key: project.key,
                                            projectTypeKey: project.projectTypeKey,
                                            self: project.self,
                                            boardId: primaryBoard.id,
                                            boardType: primaryBoard.type,
                                            workflowStatuses: primaryBoardData ? primaryBoardData.workflowStatuses : [],
                                            boards: boardsData,
                                            firstIssueCreatedAt: startDate,
                                        },
                                    },
                                    upsert: true,
                                },
                            };
                        }

                        return null;
                    })
                )
            ).filter(Boolean);

            if (bulkOperations.length > 0) {
                await Project.bulkWrite(bulkOperations);
            }

            return Project.find({ companyId });
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    gitlabGet = (url, gitlabConfig, params = {}) => {
        // Use Bearer Token authentication as per GitLab API
        const config = {
            headers: {
                Authorization: `Bearer ${gitlabConfig.password}`, // Token used as Bearer token
            },
            params,
        };

        return axios.get(url, config);
    };

    addGitLabProjects = async (companyId, gitlabConfig, connection) => {
        const Project = ProjectModel(connection);
        try {
            // Use GitLab.com API base URL
            const apiBase = GITLAB_API_BASE_URL;
            // Step 1: Fetch all groups (paginated)
            const allGroups = [];
            let groupPage = 1;
            let hasMoreGroups = true;
            while (hasMoreGroups) {
                try {
                    const groupsResp = await this.retryWithDelay(() =>
                        this.gitlabGet(`${GITLAB_API_BASE_URL}/groups`, gitlabConfig, {
                            per_page: 100,
                            page: groupPage,
                        })
                    );
                    const groups = groupsResp.data || [];
                    allGroups.push(...groups);
                    hasMoreGroups = groups.length === 100;
                    groupPage++;
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error('[GitLab] addGitLabProjects: Error fetching groups page', {
                        page: groupPage,
                        apiBase,
                        url: `${apiBase}/groups`,
                        error: error.message,
                        status: error.response?.status,
                        statusText: error.response?.statusText,
                        responseData: error.response?.data,
                    });
                    hasMoreGroups = false;
                }
            }

            // Step 2: Fetch projects for each group
            const allProjects = [];
            for (const group of allGroups) {
                let projectPage = 1;
                let hasMoreProjects = true;

                while (hasMoreProjects) {
                    try {
                        const projResp = await this.retryWithDelay(() =>
                            this.gitlabGet(`${GITLAB_API_BASE_URL}/groups/${group.id}/projects`, gitlabConfig, {
                                per_page: 100,
                                page: projectPage,
                            })
                        );
                        const projects = projResp.data || [];
                        allProjects.push(...projects);
                        hasMoreProjects = projects.length === 100; // If we got 100, there might be more
                        projectPage++;
                    } catch (error) {
                        // eslint-disable-next-line no-console
                        console.error('[GitLab] addGitLabProjects: Error fetching projects for group', {
                            groupId: group.id,
                            groupName: group.name,
                            page: projectPage,
                            apiBase,
                            url: `${apiBase}/groups/${group.id}/projects`,
                            error: error.message,
                            status: error.response?.status,
                            statusText: error.response?.statusText,
                            responseData: error.response?.data,
                        });
                        hasMoreProjects = false;
                    }
                }
            }

            // Step 3: Store all projects in database with boards
            const bulkOperations = (
                await Promise.all(
                    allProjects.map(async (gitlabProject) => {
                        const projectKeyId = this.toNumericId(gitlabProject.id);
                        const projectPath = encodeURIComponent(gitlabProject.path_with_namespace || gitlabProject.name || gitlabProject.id);
                        try {
                            // Fetch boards for this project from GitLab API
                            // Try using project ID first (more reliable), fallback to path
                            let boardsResp;
                            let gitlabBoards = [];
                            
                            try {
                                // Try with project ID first
                                boardsResp = await this.retryWithDelay(() =>
                                    this.gitlabGet(`${apiBase}/projects/${gitlabProject.id}/boards`, gitlabConfig)
                                );
                                gitlabBoards = boardsResp.data || [];
                            } catch (idError) {
                                // If 403 or other error with ID, try with path
                                if (idError.response?.status === 403 || idError.response?.status === 404) {
                                    try {
                                        boardsResp = await this.retryWithDelay(() =>
                                            this.gitlabGet(`${apiBase}/projects/${projectPath}/boards`, gitlabConfig)
                                        );
                                        gitlabBoards = boardsResp.data || [];
                                    } catch (pathError) {
                                        // If still 403, boards might not be accessible or feature disabled
                                        if (pathError.response?.status === 403) {
                                            // eslint-disable-next-line no-console
                                            console.warn('[GitLab] addGitLabProjects: Boards not accessible (403) - may require permissions or feature disabled', {
                                                project: gitlabProject.name,
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
                            
                            if (gitlabBoards.length > 0) {
                                // Process all boards for this project
                                const boardsData = await Promise.all(
                                    gitlabBoards.map(async (gitlabBoard) => {
                                        const boardId = this.toNumericId(gitlabBoard.id);
                                        const boardName = gitlabBoard.name || 'Default Board';

                                        // Fetch board lists (columns) to get workflow statuses
                                        let workflowStatuses = [];
                                        try {
                                            // Try with project ID first, fallback to path
                                            let listsResp;
                                            try {
                                                listsResp = await this.retryWithDelay(() =>
                                                    this.gitlabGet(`${apiBase}/projects/${gitlabProject.id}/boards/${gitlabBoard.id}/lists`, gitlabConfig)
                                                );
                                            } catch (idError) {
                                                if (idError.response?.status === 403 || idError.response?.status === 404) {
                                                    try {
                                                        listsResp = await this.retryWithDelay(() =>
                                                            this.gitlabGet(`${apiBase}/projects/${projectPath}/boards/${gitlabBoard.id}/lists`, gitlabConfig)
                                                        );
                                                    } catch (pathError) {
                                                        // If still 403, lists might not be accessible
                                                        if (pathError.response?.status === 403) {
                                                            throw pathError;
                                                        } else {
                                                            throw pathError;
                                                        }
                                                    }
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

                                        return {
                                            boardId: boardId,
                                            boardName: boardName,
                                            boardType: 'gitlab-board',
                                            boardSelf: gitlabBoard.id ? `${apiBase}/projects/${gitlabProject.id}/boards/${gitlabBoard.id}` : null,
                                            isPrivate: false,
                                            workflowStatuses: workflowStatuses,
                                            boardLocation: {
                                                projectId: projectKeyId,
                                                projectName: gitlabProject.name,
                                                projectKey: gitlabProject.path_with_namespace || gitlabProject.name,
                                                projectTypeKey: 'gitlab-project',
                                                avatarURI: gitlabProject.avatar_url || null,
                                                displayName: boardName,
                                                name: boardName,
                                            },
                                        };
                                    })
                                );

                                // Use the first board for backward compatibility
                                const primaryBoard = gitlabBoards[0];
                                const primaryBoardData = boardsData[0];
                                const primaryBoardId = this.toNumericId(primaryBoard.id);

                                return {
                                    updateOne: {
                                        filter: { projectKeyId, companyId },
                                        update: {
                                            $set: {
                                                companyId,
                                                projectKeyId,
                                                name: gitlabProject.name,
                                                key: gitlabProject.path_with_namespace || gitlabProject.name,
                                                projectTypeKey: 'gitlab-project',
                                                self: gitlabProject.web_url || gitlabProject.http_url_to_repo || 'https://gitlab.com',
                                                boardId: primaryBoardId,
                                                boardType: 'gitlab-board',
                                                workflowStatuses: primaryBoardData ? primaryBoardData.workflowStatuses : [],
                                                boards: boardsData,
                                            },
                                        },
                                        upsert: true,
                                    },
                                };
                            } else {
                                // No boards found, use fallback
                                const fallbackBoardId = 0 - Number(projectKeyId);
                                return {
                                    updateOne: {
                                        filter: { projectKeyId, companyId },
                                        update: {
                                            $set: {
                                                companyId,
                                                projectKeyId,
                                                name: gitlabProject.name,
                                                key: gitlabProject.path_with_namespace || gitlabProject.name,
                                                projectTypeKey: 'gitlab-project',
                                                self: gitlabProject.web_url || gitlabProject.http_url_to_repo || 'https://gitlab.com',
                                                boardId: fallbackBoardId,
                                                boardType: 'gitlab-board',
                                                workflowStatuses: [],
                                                boards: [],
                                            },
                                        },
                                        upsert: true,
                                    },
                                };
                            }
                        } catch (error) {
                            // eslint-disable-next-line no-console
                            console.error('[GitLab] addGitLabProjects: Error processing project', {
                                project: gitlabProject.name,
                                projectKeyId,
                                projectPath,
                                error: error.message,
                                status: error.response?.status,
                            });
                            // Return fallback operation on error - still save the project
                            const fallbackBoardId = 0 - Number(projectKeyId);
                            return {
                                updateOne: {
                                    filter: { projectKeyId, companyId },
                                    update: {
                                        $set: {
                                            companyId,
                                            projectKeyId,
                                            name: gitlabProject.name,
                                            key: gitlabProject.path_with_namespace || gitlabProject.name,
                                            projectTypeKey: 'gitlab-project',
                                            // eslint-disable-next-line no-undef
                                            self: gitlabProject.web_url || gitlabProject.http_url_to_repo,
                                            boardId: fallbackBoardId,
                                            boardType: 'gitlab-board',
                                            workflowStatuses: [],
                                            boards: [],
                                        },
                                    },
                                    upsert: true,
                                },
                            };
                        }
                    })
                )
            ).filter(Boolean);

            if (bulkOperations.length > 0) {
                await Project.bulkWrite(bulkOperations);
            }

            const final = await Project.find({ companyId });
            return final;
        } catch (error) {
            console.error('Error in addGitLabProjects:', error);
            throw error;
        }
    };

    addAzureProjects = async (companyId, azureConfig, connection) => {
        const Project = ProjectModel(connection);
        const Board = BoardModel(connection);
        try {
            // Normalize base host
            const isFullHost = typeof azureConfig.host === 'string' && azureConfig.host.includes('dev.azure.com');
            const base = isFullHost ? azureConfig.host.replace(/\/+$/, '') : `https://dev.azure.com/${azureConfig.host}`;
            const apiVersion = '7.0';
            const headers = {
                Authorization: `Basic ${Buffer.from(`${(azureConfig.username || '').trim() || 'pat'}:${azureConfig.password}`).toString('base64')}`,
                'Content-Type': 'application/json',
            };

            // Fetch all projects
            const projResp = await this.retryWithDelay(() => axios.get(`${base}/_apis/projects`, { headers, params: { 'api-version': apiVersion } }));
            const projects = projResp.data?.value || [];

            for (const azProject of projects) {
                const projectKeyId = this.toNumericId(azProject.id);

                let templateName = null;
                if (azProject.capabilities?.processTemplate?.templateName) {
                    templateName = azProject.capabilities.processTemplate.templateName;
                } else {
                    try {
                        const projectDetailResp = await this.retryWithDelay(() =>
                            axios.get(`${base}/_apis/projects/${azProject.id}`, {
                                headers,
                                params: { 
                                    'api-version': apiVersion,
                                    'includeCapabilities': true 
                                },
                            })
                        );
                        templateName = projectDetailResp.data?.capabilities?.processTemplate?.templateName || null;
                    } catch (e) {
                        console.error('[AzureBoards] addAzureProjects: Failed to fetch project capabilities', {
                            projectName: azProject.name,
                            status: e?.response?.status,
                            message: e?.message,
                        });
                    }
                }

                // Fetch teams for project (tolerate 401 by proceeding without teams)
                let teams = [];
                try {
                    const teamsResp = await this.retryWithDelay(() => axios.get(`${base}/_apis/projects/${azProject.id}/teams`, { headers, params: { 'api-version': apiVersion } }));
                    teams = teamsResp.data?.value || [];
                } catch (e) {
                    teams = [];
                }

                const boardsData = [];
                for (const team of teams) {
                    // Fetch boards for team (no name-based fallback; use first board only)
                    let teamBoards = [];
                    try {
                        const boardsResp = await this.retryWithDelay(() =>
                            axios.get(`${base}/${encodeURIComponent(azProject.name)}/${encodeURIComponent(team.name)}/_apis/work/boards`, { headers, params: { 'api-version': apiVersion } })
                        );
                        teamBoards = boardsResp.data?.value || [];
                    } catch (be) {
                        teamBoards = [];
                    }

                    const selectedBoard = teamBoards[0];
                    if (!selectedBoard) {
                        continue;
                    }

                    const boardIdNumeric = this.toNumericId(selectedBoard.id);
                    let workflowStatuses = [];
                    try {
                        const colsResp = await this.retryWithDelay(() =>
                            axios.get(`${base}/${encodeURIComponent(azProject.name)}/${encodeURIComponent(team.name)}/_apis/work/boards/${selectedBoard.id}/columns`, {
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
                        workflowStatuses = [];
                    }

                    boardsData.push({
                        boardId: boardIdNumeric,
                        // Show the team name as board name (aligns with how Jira boards map to teams)
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

                // Do not inject a fallback board entry into boardsData; keep only actual boards

                // Upsert project
                const primaryBoard = boardsData[0];
                const setData = {
                    companyId,
                    projectKeyId,
                    name: azProject.name,
                    key: azProject.name,
                    projectTypeKey: 'azure-project',
                    self: base,
                    boardType: 'azure-board',
                    workflowStatuses: primaryBoard ? primaryBoard.workflowStatuses || [] : [],
                    boards: boardsData,
                    templateName: templateName || null,
                };
                const updateDoc = { $set: setData };
                const fallbackBoardId = primaryBoard && typeof primaryBoard.boardId === 'number' ? primaryBoard.boardId : 0 - Number(projectKeyId); // ensure uniqueness even when no teams/boards
                updateDoc.$set.boardId = fallbackBoardId;
                await Project.updateOne({ projectKeyId, companyId }, updateDoc, { upsert: true });

                // Ensure board documents
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
            }

            const final = await Project.find({ companyId });
            return final;
        } catch (error) {
            console.error('Error in addAzureProjects:', error);
            throw error;
        }
    };

    azureSyncBoards = async (companyId, azureConfig, connection) => {
        const Board = BoardModel(connection);
        const Project = ProjectModel(connection);
        try {
            const isFullHost = typeof azureConfig.host === 'string' && azureConfig.host.includes('dev.azure.com');
            const base = isFullHost ? azureConfig.host.replace(/\/+$/, '') : `https://dev.azure.com/${azureConfig.host}`;
            const apiVersion = '7.0';
            const headers = {
                Authorization: `Basic ${Buffer.from(`${(azureConfig.username || '').trim() || 'pat'}:${azureConfig.password}`).toString('base64')}`,
                'Content-Type': 'application/json',
            };

            const projResp = await this.retryWithDelay(() => axios.get(`${base}/_apis/projects`, { headers, params: { 'api-version': apiVersion } }));
            const projects = projResp.data?.value || [];

            for (const azProject of projects) {
                const projectKeyId = this.toNumericId(azProject.id);
                const projectDoc = await Project.findOne({ companyId, projectKeyId });

                const teamsResp = await this.retryWithDelay(() => axios.get(`${base}/_apis/projects/${azProject.id}/teams`, { headers, params: { 'api-version': apiVersion } }));
                const teams = teamsResp.data?.value || [];

                for (const team of teams) {
                    const boardsResp = await this.retryWithDelay(() =>
                        axios.get(`${base}/${encodeURIComponent(azProject.name)}/${encodeURIComponent(team.name)}/_apis/work/boards`, {
                            headers,
                            params: { 'api-version': apiVersion },
                        })
                    );
                    const teamBoards = boardsResp.data?.value || [];

                    // Select the first board only (no name-based fallback)
                    const selectedBoard = teamBoards[0];
                    if (!selectedBoard) {
                        continue;
                    }

                    const op = {
                        updateOne: {
                            filter: {
                                companyId,
                                projectId: projectDoc?._id || null,
                                projectKeyId,
                                boardId: this.toNumericId(selectedBoard.id),
                            },
                            update: {
                                $set: {
                                    companyId,
                                    projectId: projectDoc?._id || null,
                                    projectKeyId,
                                    boardId: this.toNumericId(selectedBoard.id),
                                    // Use team name as the board name, to match Jira concept
                                    boardName: team.name,
                                    boardType: 'azure-board',
                                    boardSelf: null,
                                    isPrivate: false,
                                    boardLocation: {
                                        projectId: projectKeyId,
                                        projectName: azProject.name,
                                        projectKey: azProject.name,
                                        projectTypeKey: 'azure-project',
                                        avatarURI: null,
                                        displayName: team.name,
                                        name: team.name,
                                    },
                                },
                            },
                            upsert: true,
                        },
                    };

                    await Board.bulkWrite([op]);
                }
            }

            return await Board.find({ companyId });
        } catch (error) {
            console.error('Error in azureSyncBoards:', error);
            throw error;
        }
    };

    gitlabSyncBoards = async (companyId, gitlabConfig, connection) => {
        const Board = BoardModel(connection);
        const Project = ProjectModel(connection);
        try {
            // Use GitLab.com API base URL
            const apiBase = GITLAB_API_BASE_URL;
            // Get all GitLab projects from database
            const projects = await Project.find({ companyId, projectTypeKey: 'gitlab-project' });
            for (const projectDoc of projects) {
                const projectKeyId = projectDoc.projectKeyId;
                const projectPath = encodeURIComponent(projectDoc.key || projectDoc.name);
                try {                    
                    const boardsResp = await this.retryWithDelay(() =>
                        this.gitlabGet(`${apiBase}/projects/${projectPath}/boards`, gitlabConfig)
                    );
                    const gitlabBoards = boardsResp.data || [];

                    // Process each board
                    for (const gitlabBoard of gitlabBoards) {
                        const boardId = this.toNumericId(gitlabBoard.id);
                        const boardName = gitlabBoard.name || 'Default Board';

                        const op = {
                            updateOne: {
                                filter: {
                                    companyId,
                                    projectId: projectDoc._id,
                                    projectKeyId,
                                    boardId,
                                },
                                update: {
                                    $set: {
                                        companyId,
                                        projectId: projectDoc._id,
                                        projectKeyId,
                                        boardId,
                                        boardName,
                                        boardType: 'gitlab-board',
                                        boardSelf: gitlabBoard.id ? `${apiBase}/projects/${projectPath}/boards/${gitlabBoard.id}` : null,
                                        isPrivate: false,
                                        boardLocation: {
                                            projectId: projectKeyId,
                                            projectName: projectDoc.name,
                                            projectKey: projectDoc.key,
                                            projectTypeKey: 'gitlab-project',
                                            avatarURI: null,
                                            displayName: boardName,
                                            name: boardName,
                                        },
                                    },
                                },
                                upsert: true,
                            },
                        };

                        await Board.bulkWrite([op]);
                    }
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error('[GitLab] gitlabSyncBoards: Error processing project', {
                        project: projectDoc.name,
                        projectKeyId,
                        projectPath,
                        error: error.message,
                        status: error.response?.status,
                    });
                    // Continue with next project
                    continue;
                }
            }

            const final = await Board.find({ companyId });
            return final;
        } catch (error) {
            console.error('Error in gitlabSyncBoards:', error);
            throw error;
        }
    };

    syncBoards = async (companyId, jiraConfig, connection) => {
        const Board = BoardModel(connection);
        const Project = ProjectModel(connection);
        try {
            const boards = await this.boardProjects(jiraConfig);
            if (!Array.isArray(boards)) {
                throw new Error('boardProjects did not return an array');
            }

            const bulkOperations = await Promise.all(
                boards.map(async (board) => {
                    try {
                        let projectId = null;

                        // Look up project by projectKeyId if it exists
                        if (board.location?.projectId) {
                            const project = await Project.findOne({
                                companyId: companyId,
                                projectKeyId: board.location.projectId,
                            });
                            projectId = project ? project._id : null;
                        }

                        return {
                            updateOne: {
                                filter: {
                                    companyId: companyId,
                                    boardId: board.id,
                                },
                                update: {
                                    $set: {
                                        companyId: companyId,
                                        projectId: projectId,
                                        projectKeyId: board.location?.projectId || null,
                                        boardId: board.id,
                                        boardName: board.name,
                                        boardType: board.type,
                                        boardSelf: board.self,
                                        isPrivate: board.isPrivate || false,
                                        boardLocation: {
                                            projectId: board.location?.projectId,
                                            projectName: board.location?.projectName,
                                            projectKey: board.location?.projectKey,
                                            projectTypeKey: board.location?.projectTypeKey,
                                            avatarURI: board.location?.avatarURI,
                                            displayName: board.location?.displayName,
                                            name: board.location?.name,
                                        },
                                    },
                                },
                                upsert: true,
                            },
                        };
                    } catch (error) {
                        console.error(`Error processing board ${board.id}:`, error.message);
                        return null;
                    }
                })
            );

            const validOperations = bulkOperations.filter(Boolean);
            if (validOperations.length > 0) {
                await Board.bulkWrite(validOperations);
            }

            const currentBoardIds = boards.map((b) => Number(b.id));
            await Board.deleteMany({ companyId, boardId: { $nin: currentBoardIds } });

            return Board.find({ companyId });
        } catch (error) {
            console.error('Error in syncBoards:', error);
            throw error;
        }
    };

    toNumericId(value) {
        if (typeof value === 'number') {
            return value;
        }
        const str = String(value || '');
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    retryWithDelay = async (fn, maxRetries = 3, delay = 1000) => {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === maxRetries - 1) {
                    throw error;
                }
                await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
            }
        }
    };
}

const connectionController = new ConnectionController();
export default connectionController;
