import { ConnectionModel } from '../../connection/model.js';
import { TestProjectModel, TestRailMilestoneModel } from './model.js';
import { ProjectModel, SprintModel, JiraReleaseModel, BoardModel, SprintIssueModel } from '../../project-management/jira/model.js';
import axios from 'axios';
import { cryptoHandler } from '../../../utils/commonFunctions.js';
import { Types } from 'mongoose';
import { TestRunModel } from './model.js';
import { testerRoles } from '../../../utils/constants.js';
import { STATUS_ACTIVE, RELEASE_STATUS_UNRELEASED } from '../../../utils/constants/statusConstants.js';

class TestRailService {
    async syncTestRail(companyId, tenantConnection, projectId, syncType = 'hard') {
        try {
            const Connection = ConnectionModel(tenantConnection);
            const Board = BoardModel(tenantConnection);
            const projectObjectId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;

            const testCred = await Connection.findOne({ companyId, name: 'Testrail' });
            if (!testCred) {
                console.error('Testrail connection not found for this company.');
                return;
            }

            const decryptedPassword = cryptoHandler(testCred.password, 'decrypt');
            const testrailConfig = {
                host: testCred.host,
                username: testCred.username,
                password: decryptedPassword,
            };

            await this.syncTestRailProjects(testrailConfig, companyId, tenantConnection, projectId);
            await this.syncTestRailMilestones(testrailConfig, companyId, tenantConnection, projectId, syncType);
            const projectBoards = await Board.find({ companyId, projectId: projectObjectId }).lean();

            if (projectBoards.length === 0) {
                console.warn(`No boards found for project ${projectId} in company ${companyId}`);
                return;
            }

            const allSprintResults = [];
            const allReleaseResults = [];

            for (const board of projectBoards) {
                try {
                    const { sprintResults, releaseResults } = await this.getRunsDataForBoard(companyId, tenantConnection, projectId, board);
                    allSprintResults.push(...sprintResults);
                    allReleaseResults.push(...releaseResults);
                } catch (boardError) {
                    console.error(`Error processing TestRail data for board ${board.boardId}:`, boardError.message, boardError.stack);
                }
            }

            await this.saveRunsData(companyId, allSprintResults, allReleaseResults, tenantConnection, projectId);
        } catch (error) {
            console.error('[TestRail Sync] Fatal error in syncTestRail:', error.message, error.stack);
            throw error;
        }
    }

    // Helper method to process test runs
    processRuns(runs) {
        return runs.map((run) => {
            const total = run.passed_count + run.failed_count + run.untested_count + run.blocked_count + run.retest_count;
            const passedPct = total > 0 ? Math.round((run.passed_count / total) * 100) : 0;
            return {
                ...run,
                manual_percentage: passedPct,
                created_on: run.created_on || null,
                updated_on: run.updated_on || null,
            };
        });
    }

    // Helper method to normalize sprint names
    normalizeSprintName(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s]/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Helper method to extract sprint numbers
    extractSprintNumber(str) {
        const match = str.match(/sprint\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : null;
    }

    // Private helper methods for sprint name normalization
    _normalizeSprintName(str) {
        if (!str) {
            return '';
        }
        return str
            .replace(/[/]+/g, '\\')
            .replace(/\\+/g, '\\')
            .replace(/(\d+)\s*y(\d{2})/i, '$1\\y$2')
            .toLowerCase()
            .replace(/\b[sr]?(print|rint|pint|int)\b/gi, '')
            .replace(/[|–-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    _dynamicPrefixSimplify(str) {
        if (!str) {
            return '';
        }
        return str.replace(/^([a-zA-Z]+)\b/, (full, prefix) =>
            prefix
                .replace(/\d+$/, '')
                .replace(/[a-z]{1,3}$/, '')
                .slice(0, 4)
        );
    }

    _extractNumbers(str) {
        return (str.match(/\d+/g) || []).map((n) => parseInt(n));
    }

    // Helper method to check if sprint names match using comprehensive regex approach
    isSprintNameMatch(dbSprintName, testRailRunName) {
        if (!dbSprintName || !testRailRunName) {
            return false;
        }

        const dbSprintTrimmed = dbSprintName.trim();
        const testRailTrimmed = testRailRunName.trim();

        if (dbSprintTrimmed === testRailTrimmed || testRailTrimmed.includes(dbSprintTrimmed) || dbSprintTrimmed.includes(testRailTrimmed)) {
            return true;
        }

        const formattedTestrailName = testRailRunName.replace(/([-|])(?=[A-Za-z])/g, '$1 ');

        const sprintMatch = formattedTestrailName.match(/(?:sprint|pi)\s*.+$/i);

        if (sprintMatch) {
            const projectPrefix = formattedTestrailName.split(/\s+/)[0].trim();

            const cleaned = sprintMatch[0]
                .replace(/\d{1,2}\s*[A-Z]{3}\s*\d{2,4}\s*to\s*\d{1,2}\s*[A-Z]{3}\s*\d{2,4}/gi, '') // remove date ranges
                .replace(/\|.*$/, '')
                .trim();

            const extractedSprintName = `${projectPrefix} ${cleaned}`.trim();

            const normalizedExtracted = this._dynamicPrefixSimplify(this._normalizeSprintName(extractedSprintName));
            const normalizedCollection = this._dynamicPrefixSimplify(this._normalizeSprintName(dbSprintName));

            const numsExtracted = this._extractNumbers(normalizedExtracted);
            const numsCollection = this._extractNumbers(normalizedCollection);

            const strictNumberMatch = numsExtracted.length > 0 && numsCollection.length > 0 && numsExtracted.every((n) => numsCollection.includes(n));

            if (!strictNumberMatch) {
                return false;
            }

            return normalizedExtracted === normalizedCollection || normalizedExtracted.includes(normalizedCollection) || normalizedCollection.includes(normalizedExtracted);
        } else {
            const sprintDb = this.extractSprintNumber(dbSprintName);
            const sprintRun = this.extractSprintNumber(testRailRunName);

            if (sprintDb !== null && sprintRun !== null) {
                return sprintDb === sprintRun;
            }

            const cleanDb = this.normalizeSprintName(dbSprintName);
            const cleanRun = this.normalizeSprintName(testRailRunName);
            const dbTokens = cleanDb.split(' ');
            const runTokens = cleanRun.split(' ');

            return dbTokens.every((token) => runTokens.includes(token));
        }
    }

    // Helper method to normalize base version
    normalizeBaseVersion(releaseName) {
        if (!releaseName) {
            return null;
        }
        const patterns = [/(\d+\.\d+\.\d+)/, /(\d+\.\d+)/, /(\d+)/, /(v\d+\.\d+\.\d+)/i, /(v\d+\.\d+)/i, /(v\d+)/i];

        for (const pattern of patterns) {
            const match = releaseName.match(pattern);
            if (match) {
                return match[1];
            }
        }
        return null;
    }

    // Helper method to check if release names match
    isReleaseMatch(testRailRunName, releaseName) {
        const runBase = this.normalizeBaseVersion(testRailRunName);
        const releaseBase = this.normalizeBaseVersion(releaseName);
        if (runBase && releaseBase && runBase === releaseBase) {
            return true;
        }
        if (testRailRunName.toLowerCase().includes(releaseName.toLowerCase())) {
            return true;
        }

        if (releaseName.toLowerCase().includes(testRailRunName.toLowerCase())) {
            return true;
        }

        const similarity = this.calculateSimilarity(testRailRunName.toLowerCase(), releaseName.toLowerCase());
        if (similarity > 0.6) {
            return true;
        }
        return false;
    }

    // Calculate string similarity using Levenshtein distance
    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) {
            return 0;
        }
        if (str1 === str2) {
            return 1;
        }

        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) {
            return 1;
        }

        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    // Calculate Levenshtein distance between two strings
    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    // Helper method to convert boardId to proper format for database queries
    async getBoardIdFilter(board, companyId, projectId, tenantConnection) {
        if (typeof board.boardId === 'number') {
            const Board = BoardModel(tenantConnection);
            const boardDoc = await Board.findOne({ boardId: board.boardId, companyId, projectId }).lean();
            if (boardDoc) {
                return boardDoc._id;
            } else {
                console.warn(`Board with numeric ID ${board.boardId} not found`);
                return null;
            }
        } else {
            return board.boardId;
        }
    }

    async getRunsDataForBoard(companyId, tenantConnection, projectId, board) {
        const Connection = ConnectionModel(tenantConnection);
        const TestProject = TestProjectModel(tenantConnection);
        const JiraRelease = JiraReleaseModel(tenantConnection);
        const Sprint = SprintModel(tenantConnection);
        const projectObjectId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
        const companyObjectId = typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId;

        const cred = await Connection.findOne({ companyId, name: 'Testrail' });
        if (!cred) {
            console.error(`[Get Runs Data] No TestRail connection found for companyId: ${companyId}`);
            throw new Error('No TestRail connection found');
        }
        const decryptedPassword = cryptoHandler(cred.password, 'decrypt');
        const testrailConfig = {
            host: cred.host,
            username: cred.username,
            password: decryptedPassword,
        };

        const testrailProjects = await TestProject.find({
            companyId: companyObjectId,
            jiraProjectId: projectObjectId,
        });

        const testProjectIds = testrailProjects.map((tp) => tp.projectId);
        const boardIdFilter = await this.getBoardIdFilter(board, companyId, projectId, tenantConnection);
        if (!boardIdFilter) {
            return { sprintResults: [], releaseResults: [] };
        }

        // Get sprints for this specific board
        const sprints = await Sprint.find({
            companyId: companyObjectId,
            projectId: projectObjectId,
            state: STATUS_ACTIVE,
            boardId: boardIdFilter,
        });
        const allSprintIds = sprints.map((s) => s._id.toString());
        // Get releases for this specific board
        const releases = await JiraRelease.find({
            companyId: companyObjectId,
            projectId: projectObjectId,
            status: RELEASE_STATUS_UNRELEASED,
            boardId: boardIdFilter,
        });

        const allReleaseIds = releases.map((r) => r._id.toString());
        const allTestRuns = [];
        for (const trId of testProjectIds) {
            const runs = await this.fetchRuns(testrailConfig, trId);
            allTestRuns.push(...runs);
        }

        const sprintResults = await this.processSprintRunsForBoard(allTestRuns, allSprintIds, companyId, tenantConnection, projectId, board);
        const releaseResults = await this.processReleaseRunsForBoard(allTestRuns, allReleaseIds, releases, Connection, projectId, board);
        return { sprintResults, releaseResults };
    }

    async saveRunsData(companyId, sprintResults, releaseResults, tenantConnection, projectId) {
        const Runs = TestRunModel(tenantConnection);
        const companyObjectId = typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId;
        const projectObjectId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
        const toMap = (runsInput) => {
            if (!runsInput) {
                return {};
            }
            let runsArray;

            if (Array.isArray(runsInput)) {
                runsArray = runsInput;
            } else if (typeof runsInput === 'object') {
                runsArray = Object.values(runsInput);
            } else {
                return {};
            }

            const filteredRuns = runsArray.filter((run) => run && run.id && run.project_id && run.manual_percentage !== undefined && run.url);

            const mappedRuns = Object.fromEntries(
                filteredRuns.map((run) => [
                    String(run.id),
                    {
                        id: run.id,
                        name: run.name || '',
                        description: run.description || '',
                        is_completed: run.is_completed ?? false,
                        completed_on: run.completed_on ? new Date(run.completed_on) : null,
                        passed_count: run.passed_count ?? 0,
                        untested_count: run.untested_count ?? 0,
                        blocked_count: run.blocked_count ?? 0,
                        retest_count: run.retest_count ?? 0,
                        failed_count: run.failed_count ?? 0,
                        project_id: run.project_id,
                        manual_percentage: String(run.manual_percentage),
                        url: run.url,
                        created_on: new Date(run.created_on * 1000),
                        updated_on: new Date(run.updated_on * 1000),
                    },
                ])
            );
            return mappedRuns;
        };

        const buildOps = async (results, isSprint = true) => {
            const ops = [];

            for (const result of results) {
                if (result.jiraProjectId && result.jiraProjectId.toString() !== projectObjectId.toString()) {
                    continue;
                }
                const baseFilter = {
                    companyId: companyObjectId,
                    jiraProjectId: result.jiraProjectId,
                };

                if (result.boardId) {
                    baseFilter.boardId = result.boardId;
                }

                if (isSprint) {
                    baseFilter.sprintId = result.sprintId;
                    baseFilter.releaseId = { $exists: false };
                } else {
                    baseFilter.releaseId = result.releaseId;
                    baseFilter.sprintId = { $exists: false };
                }

                const doc = {
                    companyId: companyObjectId,
                    jiraProjectId: result.jiraProjectId,
                    testProjectId: result.testProjectId,
                    manualRuns: toMap(result.manualRuns),
                    automationRuns: toMap(result.automationRuns),
                };
                if (result.boardId) {
                    doc.boardId = result.boardId;
                }
                if (result.boardName) {
                    doc.boardName = result.boardName;
                }

                if (isSprint) {
                    doc.sprintId = result.sprintId;
                    doc.sprintName = result.sprintName;
                } else {
                    doc.releaseId = result.releaseId;
                    doc.releaseName = result.releaseName;
                }

                const operation = {
                    updateOne: {
                        filter: baseFilter,
                        update: { $set: doc },
                        upsert: true,
                    },
                };
                ops.push(operation);
            }

            return ops;
        };

        const sprintOps = await buildOps(sprintResults, true);
        const releaseOps = await buildOps(releaseResults, false);
        const allOps = [...sprintOps, ...releaseOps];

        if (allOps.length > 0) {
            try {
                await Runs.bulkWrite(allOps);
            } catch (err) {
                console.error('[Save Runs Data] Error saving runs:', err);
                throw err;
            }
        }
    }

    async fetchProjects(testrailConfig) {
        try {
            const response = await axios.get(`${testrailConfig.host}/index.php?/api/v2/get_projects`, {
                auth: {
                    username: testrailConfig.username,
                    password: testrailConfig.password,
                },
            });
            return response.data;
        } catch (error) {
            throw new Error(`Error fetching projects: ${error.message}`);
        }
    }

    async fetchUsers(testrailConfig) {
        try {
            if (!testrailConfig?.host || !testrailConfig?.username || !testrailConfig?.password) {
                throw new Error('Invalid TestRail configuration.');
            }

            const url = `${testrailConfig.host}/index.php?/api/v2/get_users`;

            const response = await axios.get(url, {
                auth: {
                    username: testrailConfig.username,
                    password: testrailConfig.password,
                },
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.status !== 200) {
                console.error(`Unexpected status code: ${response.status}`);
                return [];
            }

            if (response.data && Array.isArray(response.data.users)) {
                return response.data.users;
            } else {
                console.error('Expected `users` array in response, got:', response.data);
                return [];
            }
        } catch (error) {
            if (error.response) {
                console.error(`TestRail API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            } else {
                console.error(`Error fetching users: ${error.message}`);
            }
            return [];
        }
    }

    async syncTestRailProjects(testrailConfig, companyId, tenantConnection, projectId) {
        try {
            const JiraProject = ProjectModel(tenantConnection);
            const TestRailProject = TestProjectModel(tenantConnection);
            const projectObjectId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
            const companyObjectId = typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId;

            const jiraProject = await JiraProject.findOne({ companyId: companyObjectId, _id: projectObjectId });
            if (!jiraProject) {
                throw new Error(`Jira project not found for ID: ${projectId}`);
            }

            const testRailProjectsResponse = await this.fetchProjects(testrailConfig);
            const allUsers = await this.fetchUsers(testrailConfig);

            const testRailProjects = testRailProjectsResponse.projects || [];
            // Normalize Jira project names for matching
            const normalizeName = (name) => name.toLowerCase().replace(/\s+/g, '');
            const normalizedJiraName = normalizeName(jiraProject.name || '');
            const normalizedJiraKey = normalizeName(jiraProject.key || '');

            // Match TestRail projects to Jira projects
            const matchingProjects = testRailProjects
                .map((testRailProject) => {
                    const normalizedTestRailName = normalizeName(testRailProject.name);
                    const isMatch =
                        normalizedTestRailName === normalizedJiraName ||
                        normalizedTestRailName.includes(normalizedJiraName) ||
                        normalizedJiraName.includes(normalizedTestRailName) ||
                        normalizedTestRailName === normalizedJiraKey;

                    if (!isMatch) {
                        return null;
                    }

                    return {
                        projectId: testRailProject.id,
                        name: jiraProject.name,
                        url: testRailProject.url,
                        companyId: companyObjectId,
                        jiraProjectId: projectObjectId,
                        users: testRailProject.users || [],
                        groups: testRailProject.groups || [],
                    };
                })
                .filter(Boolean);

            // Delete old TestRail projects not in the matched list
            await TestRailProject.deleteMany({
                companyId: companyObjectId,
                jiraProjectId: projectObjectId,
                projectId: { $nin: matchingProjects.map((p) => p.projectId) },
            });

            const bulkOperations = [];

            for (const project of matchingProjects) {
                const projectUserIds = new Set(project.users.map((u) => u.user_id));
                const projectGroupIds = new Set(project.groups.map((g) => g.id));
                const associatedUsers = allUsers
                    .filter(
                        (user) =>
                            (projectUserIds.has(user.id) || user.group_ids?.some((gid) => projectGroupIds.has(gid))) &&
                            testerRoles.map((r) => r.toLowerCase()).includes(user.role?.trim().toLowerCase())
                    )
                    .map((user) => ({
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        is_active: user.is_active,
                        role: user.role,
                        role_id: user.role_id,
                        groupIds: user.group_ids,
                        projectId: project.projectId,
                    }));

                bulkOperations.push({
                    updateOne: {
                        filter: {
                            projectId: project.projectId,
                            companyId: companyObjectId,
                            jiraProjectId: projectObjectId,
                        },
                        update: {
                            $set: {
                                projectId: project.projectId,
                                name: project.name,
                                url: project.url,
                                companyId: companyObjectId,
                                jiraProjectId: projectObjectId,
                                users: associatedUsers,
                            },
                        },
                        upsert: true,
                    },
                });
            }

            if (bulkOperations.length > 0) {
                await TestRailProject.bulkWrite(bulkOperations);
            } else {
                console.warn('[TestRail Sync] No matching TestRail projects found to save');
            }

            return matchingProjects;
        } catch (error) {
            throw new Error(`Error syncing TestRail projects: ${error.message}`);
        }
    }

    async fetchRuns(testrailConfig, projectId) {
        try {
            if (!testrailConfig || !testrailConfig.host || !testrailConfig.username || !testrailConfig.password) {
                console.error('Invalid TestRail configuration.');
            }
            if (!projectId) {
                console.error('Project ID is required to fetch runs.');
            }
            const response = await axios.get(`${testrailConfig.host}/index.php?/api/v2/get_runs/${projectId}`, {
                auth: {
                    username: testrailConfig.username,
                    password: testrailConfig.password,
                },
            });
            const runs = Array.isArray(response.data) ? response.data : response.data.runs || [];
            return runs;
        } catch (error) {
            console.error(`Error fetching runs: ${error.message}`);
        }
    }

    async fetchRunsForMilestone(testrailConfig, projectId, milestoneId) {
        try {
            if (!testrailConfig || !testrailConfig.host || !testrailConfig.username || !testrailConfig.password) {
                console.error('Invalid TestRail configuration.');
                return [];
            }
            if (!projectId || !milestoneId) {
                console.error('Project ID and Milestone ID are required to fetch runs.');
                return [];
            }
            const response = await axios.get(`${testrailConfig.host}/index.php?/api/v2/get_runs/${projectId}&milestone_id=${milestoneId}`, {
                auth: {
                    username: testrailConfig.username,
                    password: testrailConfig.password,
                },
            });
            const runs = response.data.runs || [];
            return runs;
        } catch (error) {
            console.error(`Error fetching runs for milestone ${milestoneId}: ${error.message}`);
            return [];
        }
    }

    async processSprintRunsForBoard(allTestRuns, allSprintIds, companyId, tenantConnection, projectId, board) {
        const connection = ConnectionModel(tenantConnection);
        const TestProject = TestProjectModel(connection);
        const Sprint = SprintModel(connection);
        const projectObjectId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
        const companyObjectId = typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId;
        const boardIdFilter = await this.getBoardIdFilter(board, companyId, projectId, tenantConnection);
        if (!boardIdFilter) {
            return [];
        }

        const sprints = await Sprint.find({
            _id: { $in: allSprintIds.map((id) => new Types.ObjectId(id)) },
            companyId: companyObjectId,
            projectId: projectObjectId,
            boardId: boardIdFilter,
        });

        const testProjects = await TestProject.find({
            jiraProjectId: projectObjectId,
            companyId: companyObjectId,
        });

        const results = [];

        for (const sprint of sprints) {
            const projectTestProjects = testProjects.filter((tp) => tp.jiraProjectId.toString() === sprint.projectId.toString());

            for (const testrailProject of projectTestProjects) {
                const relevantRuns = allTestRuns.filter((run) => run.project_id === testrailProject.projectId && this.isSprintNameMatch(sprint.name, run.name));
                const manualRuns = relevantRuns.filter((run) => {
                    const nameLower = (run.name || '').toLowerCase();
                    const isAutomation = nameLower.includes('automation') || nameLower.includes('auto') || nameLower.includes('atm') || nameLower.includes('atmn');
                    return nameLower.includes('man') && !isAutomation;
                });
                const automationRuns = relevantRuns.filter((run) => {
                    const nameLower = (run.name || '').toLowerCase();
                    return nameLower.includes('automation') || nameLower.includes('auto') || nameLower.includes('atm') || nameLower.includes('atmn');
                });

                const processedManual = this.processRuns(manualRuns);
                const processedAutomation = this.processRuns(automationRuns);
                const result = {
                    sprintId: sprint._id,
                    sprintName: sprint.name,
                    jiraProjectId: testrailProject.jiraProjectId,
                    testProjectId: testrailProject.projectId,
                    name: testrailProject.name,
                    completedOn: testrailProject.completedOn,
                    created_on: testrailProject.created_on,
                    updated_on: testrailProject.updated_on,
                    url: testrailProject.url,
                    boardId: board.boardId,
                    boardName: board.boardName,
                    manualRuns: Object.fromEntries(processedManual.map((run) => [run.id, run])),
                    automationRuns: Object.fromEntries(processedAutomation.map((run) => [run.id, run])),
                };
                results.push(result);
            }
        }
        return results;
    }

    async processReleaseRunsForBoard(allTestRuns, allReleaseIds, releaseNames, connection, projectId, board) {
        const TestProject = TestProjectModel(connection);

        const results = [];

        for (const releaseId of allReleaseIds) {
            const release = releaseNames.find((rel) => rel._id.equals(new Types.ObjectId(releaseId)));

            if (!release) {
                console.warn(`No release found for ID: ${releaseId}`);
                continue;
            }

            const projectObjectId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
            const releaseCompanyId = typeof release.companyId === 'string' ? new Types.ObjectId(release.companyId) : release.companyId;

            const testrailProject = await TestProject.findOne({
                jiraProjectId: projectObjectId,
                companyId: releaseCompanyId,
            });

            if (!testrailProject) {
                console.warn(`No TestRail project found for Jira project ID: ${release.projectId}`);
                continue;
            }

            const relevantRuns = allTestRuns.filter((run) => {
                const runBase = this.normalizeBaseVersion(run.name);
                const releaseBase = this.normalizeBaseVersion(release.releaseName);
                const runMatchesVersion = runBase === releaseBase;
                const runMatchesProject = String(run.project_id) === String(testrailProject.projectId);
                const runContainsReleaseName = run.name.toLowerCase().includes(release.releaseName.toLowerCase());
                return runMatchesVersion && runMatchesProject && runContainsReleaseName;
            });
            const manualRuns = relevantRuns.filter((run) => {
                const nameLower = (run.name || '').toLowerCase();
                const isAutomation = nameLower.includes('automation') || nameLower.includes('auto') || nameLower.includes('atm') || nameLower.includes('atmn');
                return nameLower.includes('man') && !isAutomation;
            });
            const automationRuns = relevantRuns.filter((run) => {
                const nameLower = (run.name || '').toLowerCase();
                return nameLower.includes('automation') || nameLower.includes('auto') || nameLower.includes('atm') || nameLower.includes('atmn');
            });
            const processedManual = this.processRuns(manualRuns);
            const processedAutomation = this.processRuns(automationRuns);
            const result = {
                releaseId,
                releaseName: release.releaseName,
                jiraProjectId: testrailProject.jiraProjectId,
                testProjectId: testrailProject.projectId,
                name: testrailProject.name,
                completedOn: testrailProject.completedOn,
                created_on: testrailProject.created_on,
                updated_on: testrailProject.updated_on,
                url: testrailProject.url,
                boardId: board.boardId,
                boardName: board.boardName,
                manualRuns: Object.fromEntries(processedManual.map((run) => [run.id, run])),
                automationRuns: Object.fromEntries(processedAutomation.map((run) => [run.id, run])),
            };
            results.push(result);
        }
        return results;
    }

    async fetchMilestones(testrailConfig, projectId) {
        try {
            if (!testrailConfig || !testrailConfig.host || !testrailConfig.username || !testrailConfig.password) {
                console.error('Invalid TestRail configuration.');
                return [];
            }
            if (!projectId) {
                console.error('Project ID is required to fetch milestones.');
                return [];
            }
            const response = await axios.get(`${testrailConfig.host}/index.php?/api/v2/get_milestones/${projectId}`, {
                auth: {
                    username: testrailConfig.username,
                    password: testrailConfig.password,
                },
            });
            const milestones = Array.isArray(response.data) ? response.data : response.data.milestones || [];
            return milestones;
        } catch (error) {
            console.error(`Error fetching milestones: ${error.message}`);
            return [];
        }
    }

    flattenMilestones(milestones, allMilestones = []) {
        for (const milestone of milestones) {
            allMilestones.push(milestone);
            if (milestone.milestones && Array.isArray(milestone.milestones) && milestone.milestones.length > 0) {
                this.flattenMilestones(milestone.milestones, allMilestones);
            }
        }
        return allMilestones;
    }

    extractSprintPartFromMilestone(milestoneName) {
        if (!milestoneName) {
            return null;
        }
        const formattedMilestoneName = milestoneName.replace(/([-|])(?=[A-Za-z])/g, '$1 ');
        const sprintMatch = formattedMilestoneName.match(/(?:sprint|pi)\s*.+$/i);

        if (sprintMatch) {
            const projectPrefix = formattedMilestoneName.split(/\s+/)[0].trim();
            const cleaned = sprintMatch[0]
                .replace(/\d{1,2}\s*[A-Z]{3}\s*\d{2,4}\s*to\s*\d{1,2}\s*[A-Z]{3}\s*\d{2,4}/gi, '') // remove date ranges
                .replace(/\|.*$/, '')
                .trim();
            const extractedSprintName = `${projectPrefix} ${cleaned}`.trim();
            return extractedSprintName;
        }

        // Fallback: Try to find simple sprint number pattern
        const sprintNumberMatch = milestoneName.match(/sprint\s*\d+/i);
        if (sprintNumberMatch) {
            return sprintNumberMatch[0].trim();
        }

        return null;
    }

    extractReleasePartFromMilestone(milestoneName) {
        if (!milestoneName) {
            return null;
        }

        if (milestoneName.includes('|')) {
            const parts = milestoneName.split('|');
            return parts[0].trim();
        }

        if (milestoneName.includes(' - ')) {
            const parts = milestoneName.split(' - ');
            return parts[0].trim();
        }

        return milestoneName.trim();
    }

    isMilestoneForSprint(milestoneName) {
        if (!milestoneName) {
            return false;
        }

        // Check for SPRINT keyword anywhere
        if (milestoneName.includes('SPRINT') || milestoneName.includes('Sprint') || milestoneName.includes('sprint')) {
            return true;
        }

        if (milestoneName.includes('|')) {
            const parts = milestoneName.split('|');
            if (parts.length > 1) {
                const afterSeparator = parts[1].trim();
                if (afterSeparator.match(/PI\s*\d+/i)) {
                    return true;
                }
                if (afterSeparator.match(/sprint\s*\d+/i)) {
                    return true;
                }
            }
        }

        if (milestoneName.includes(' - ')) {
            const parts = milestoneName.split(' - ');
            if (parts.length > 1) {
                const afterSeparator = parts[1].trim();
                if (afterSeparator.match(/PI\s*\d+/i) || afterSeparator.match(/SPRINT.*PI\s*\d+/i)) {
                    return true;
                }
                if (afterSeparator.match(/sprint\s*\d+/i)) {
                    return true;
                }
            }
        }

        if (milestoneName.match(/PI\s*\d+[\\/]?[^\s]*\s*W\d+[-W]\d+/i)) {
            return true;
        }

        if (milestoneName.match(/sprint\s*\d+/i)) {
            return true;
        }

        return false;
    }

    normalizePIPattern(pattern) {
        if (!pattern) {
            return '';
        }
        return pattern.replace(/\\+/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    // Helper method to match milestone sprint part with sprint name
    isMilestoneSprintMatch(milestoneSprintPart, sprintName) {
        if (!milestoneSprintPart || !sprintName) {
            return false;
        }

        // First, try simple sprint number matching (e.g., "Sprint 30", "Sprint 2")
        const milestoneSprintNumber = this.extractSprintNumber(milestoneSprintPart);
        const sprintSprintNumber = this.extractSprintNumber(sprintName);

        if (milestoneSprintNumber !== null && sprintSprintNumber !== null) {
            // Both have sprint numbers, match if they're equal
            if (milestoneSprintNumber === sprintSprintNumber) {
                return true;
            }
        }

        const normalizedMilestone = milestoneSprintPart.replace(/\\+/g, '\\');
        const normalizedSprint = sprintName.replace(/\\+/g, '\\');

        const piRegex = /PI\s*(\d+)/i;
        const milestonePI = normalizedMilestone.match(piRegex);
        const sprintPI = normalizedSprint.match(piRegex);

        if (milestonePI && sprintPI) {
            if (milestonePI[1] !== sprintPI[1]) {
                return false;
            }
        } else if (milestonePI || sprintPI) {
            return false;
        }

        // Extract Week Numbers - handle various formats: W11-W12, W11W12, W 11 - W 12
        const weekRegex = /[Ww]\s*(\d+)[-W\s](\d+)/i;
        const milestoneWeeks = normalizedMilestone.match(weekRegex);
        const sprintWeeks = normalizedSprint.match(weekRegex);

        // Both must have week numbers for PI pattern matching
        if (!milestoneWeeks || !sprintWeeks) {
            if (milestonePI && sprintPI && milestonePI[1] === sprintPI[1]) {
                const milestoneClean = normalizedMilestone.replace(/\s+/g, ' ').trim().toLowerCase();
                const sprintClean = normalizedSprint.replace(/\s+/g, ' ').trim().toLowerCase();
                if (sprintClean === milestoneClean) {
                    return true;
                }
                // Word boundary check to allow version numbers in milestone names
                const escapedSprint = sprintClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedSprint}\\b`, 'i');
                if (regex.test(milestoneClean)) {
                    return true;
                }
            }
            return false;
        }

        const milestoneWeek1 = parseInt(milestoneWeeks[1]);
        const milestoneWeek2 = parseInt(milestoneWeeks[2]);
        const sprintWeek1 = parseInt(sprintWeeks[1]);
        const sprintWeek2 = parseInt(sprintWeeks[2]);

        if (milestoneWeek1 === sprintWeek1 && milestoneWeek2 === sprintWeek2) {
            return true;
        }

        if (milestonePI && sprintPI && milestonePI[1] === sprintPI[1]) {
            const milestoneNormalized = this._dynamicPrefixSimplify(this._normalizeSprintName(milestoneSprintPart));
            const sprintNormalized = this._dynamicPrefixSimplify(this._normalizeSprintName(sprintName));

            if (milestoneNormalized === sprintNormalized) {
                return true;
            }

            // Word boundary check to allow version numbers in milestone names
            const escapedSprint = sprintNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedSprint}\\b`, 'i');
            if (regex.test(milestoneNormalized)) {
                return true;
            }

            const numsMilestone = this._extractNumbers(milestoneNormalized);
            const numsSprint = this._extractNumbers(sprintNormalized);
            const strictNumberMatch = numsMilestone.length > 0 && numsSprint.length > 0 && numsMilestone.every((n) => numsSprint.includes(n));

            if (strictNumberMatch) {
                return true;
            }

            if (milestoneWeeks && sprintWeeks) {
                const milestonePIWeek = `${milestonePI[1]} ${milestoneWeek1}-${milestoneWeek2}`;
                const sprintPIWeek = `${sprintPI[1]} ${sprintWeek1}-${sprintWeek2}`;
                if (milestonePIWeek === sprintPIWeek) {
                    return true;
                }
            }
        }

        const milestoneNormalized = this._dynamicPrefixSimplify(this._normalizeSprintName(milestoneSprintPart));
        const sprintNormalized = this._dynamicPrefixSimplify(this._normalizeSprintName(sprintName));

        if (milestoneNormalized === sprintNormalized) {
            return true;
        }

        // Word boundary check to allow version numbers in milestone names
        const escapedSprint = sprintNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedSprint}\\b`, 'i');
        if (regex.test(milestoneNormalized)) {
            return true;
        }

        if (milestoneNormalized === sprintNormalized) {
            if (milestonePI && sprintPI && milestonePI[1] === sprintPI[1]) {
                const numsMilestone = this._extractNumbers(milestoneNormalized);
                const numsSprint = this._extractNumbers(sprintNormalized);
                const strictNumberMatch = numsMilestone.length > 0 && numsSprint.length > 0 && numsMilestone.every((n) => numsSprint.includes(n));

                if (strictNumberMatch) {
                    if (milestoneWeeks && sprintWeeks) {
                        if (milestoneWeek1 === sprintWeek1 && milestoneWeek2 === sprintWeek2) {
                            return true;
                        }
                    } else {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    // Helper method to match milestone release part with release name (same logic as test runs)
    isMilestoneReleaseMatch(milestoneReleasePart, releaseName) {
        if (!milestoneReleasePart || !releaseName) {
            return false;
        }

        const milestoneNormalized = milestoneReleasePart.trim().toLowerCase();
        const releaseNormalized = releaseName.trim().toLowerCase();

        if (milestoneNormalized === releaseNormalized) {
            return true;
        }

        const milestoneVersion = this.normalizeBaseVersion(milestoneReleasePart);
        const releaseVersion = this.normalizeBaseVersion(releaseName);

        if (milestoneVersion && releaseVersion && milestoneVersion === releaseVersion) {
            // Versions match. Now check if the remaining names are reasonably similar.
            const milestoneBase = milestoneNormalized.replace(milestoneVersion, '').trim();
            const releaseBaseName = releaseNormalized.replace(releaseVersion, '').trim();

            if (!milestoneBase || !releaseBaseName || milestoneBase.includes(releaseBaseName) || releaseBaseName.includes(milestoneBase)) {
                return true;
            }
        }

        if (releaseNormalized.includes(milestoneNormalized)) {
            return true;
        }

        const similarity = this.calculateSimilarity(milestoneNormalized, releaseNormalized);
        if (similarity > 0.6) {
            return true;
        }

        return false;
    }

    // Helper method to extract ticket numbers from refs string
    extractTicketNumbers(refs) {
        if (!refs) {
            return [];
        }
        const ticketPattern = /([A-Z]+-\d+)/gi;
        const matches = refs.match(ticketPattern);
        return matches ? [...new Set(matches)] : [];
    }

    async syncTestRailMilestones(testrailConfig, companyId, tenantConnection, projectId, syncType = 'hard') {
        try {
            const TestRailMilestone = TestRailMilestoneModel(tenantConnection);
            const TestProject = TestProjectModel(tenantConnection);
            const Sprint = SprintModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const SprintIssue = SprintIssueModel(tenantConnection);
            const Board = BoardModel(tenantConnection);

            const projectObjectId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
            const companyObjectId = typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId;
            const allSprints = await Sprint.find({
                companyId: companyObjectId,
                projectId: projectObjectId,
            }).lean();

            const allReleases = await JiraRelease.find({
                companyId: companyObjectId,
                projectId: projectObjectId,
            }).lean();

            // For light sync, get active sprints and unreleased releases
            let activeSprintIds = null;
            let unreleasedReleaseIds = null;

            if (syncType === 'light') {
                activeSprintIds = new Set(allSprints.filter((s) => s.state === STATUS_ACTIVE).map((s) => s._id.toString()));
                const unreleasedReleases = allReleases.filter((r) => r.status === RELEASE_STATUS_UNRELEASED);
                unreleasedReleaseIds = new Set(unreleasedReleases.map((r) => r._id.toString()));
            }

            const testrailProjects = await TestProject.find({
                companyId: companyObjectId,
                jiraProjectId: projectObjectId,
            });

            const bulkOperations = [];

            for (const trProject of testrailProjects) {
                const milestones = await this.fetchMilestones(testrailConfig, trProject.projectId);
                const allMilestones = this.flattenMilestones(milestones);
                const milestoneMappings = new Map();
                for (const milestone of allMilestones) {
                    let sprintId = null;
                    let releaseId = null;

                    const hasSprintPattern = this.isMilestoneForSprint(milestone.name);

                    if (hasSprintPattern) {
                        releaseId = null;
                        const sprintPart = this.extractSprintPartFromMilestone(milestone.name);
                        if (sprintPart) {
                            let matchedSprint = null;

                            for (const sprint of allSprints) {
                                if (this.isMilestoneSprintMatch(sprintPart, sprint.name)) {
                                    matchedSprint = sprint;
                                    break;
                                }
                            }

                            if (matchedSprint) {
                                sprintId = matchedSprint._id;
                            }
                        } else {
                            sprintId = null;
                            releaseId = null;
                        }
                    } else {
                        sprintId = null;
                        const releasePart = this.extractReleasePartFromMilestone(milestone.name);
                        if (releasePart) {
                            let matchedRelease = null;
                            for (const release of allReleases) {
                                const normalizedMilestone = releasePart.trim().toLowerCase();
                                const normalizedRelease = release.releaseName.trim().toLowerCase();
                                if (normalizedMilestone === normalizedRelease) {
                                    matchedRelease = release;
                                    break;
                                }
                            }

                            if (matchedRelease) {
                                releaseId = matchedRelease._id;
                            } else {
                                releaseId = null;
                                sprintId = null;
                            }
                        } else {
                            releaseId = null;
                            sprintId = null;
                        }
                    }

                    milestoneMappings.set(milestone.id, { sprintId, releaseId, hasSprintPattern });
                }

                // Child milestones often contain sprint-named runs under a release parent.
                // In that case, preserve sprint mapping but also inherit the parent's releaseId
                // so release-wise standup queries can include the same runs.
                for (const milestone of allMilestones) {
                    if (!milestone.parent_id) {
                        continue;
                    }
                    const current = milestoneMappings.get(milestone.id);
                    if (!current || current.releaseId) {
                        continue;
                    }
                    let parentId = milestone.parent_id;
                    let depth = 0;
                    const maxDepth = 10;
                    while (parentId && depth < maxDepth) {
                        const parentMapping = milestoneMappings.get(parentId);
                        if (parentMapping?.releaseId) {
                            current.releaseId = parentMapping.releaseId;
                            milestoneMappings.set(milestone.id, current);
                            break;
                        }
                        const parentMilestone = allMilestones.find((m) => m.id === parentId);
                        parentId = parentMilestone?.parent_id || null;
                        depth++;
                    }
                }

                const shouldSyncMilestone = (milestoneId) => {
                    if (syncType === 'hard') {
                        return true;
                    }

                    const mapping = milestoneMappings.get(milestoneId);
                    if (!mapping) {
                        return false;
                    }

                    if (mapping.sprintId) {
                        const sprintIdStr = mapping.sprintId.toString();
                        const isActive = activeSprintIds.has(sprintIdStr);
                        return isActive;
                    }

                    if (mapping.releaseId) {
                        const releaseIdStr = mapping.releaseId.toString();
                        const isUnreleased = unreleasedReleaseIds.has(releaseIdStr);
                        return isUnreleased;
                    }

                    return false;
                };

                const milestonesToSync = new Set();

                if (syncType === 'hard') {
                    allMilestones.forEach((m) => milestonesToSync.add(m.id));
                } else {
                    for (const milestone of allMilestones) {
                        if (shouldSyncMilestone(milestone.id)) {
                            milestonesToSync.add(milestone.id);
                        }
                    }

                    for (const milestone of allMilestones) {
                        if (milestone.parent_id) {
                            if (milestonesToSync.has(milestone.parent_id)) {
                                milestonesToSync.add(milestone.id);
                            }
                        }
                    }
                }

                if (syncType === 'light') {
                    if (milestonesToSync.size === 0) {
                        console.warn('[TestRail Sync] No milestones found to sync in light sync mode. Check if there are active sprints or unreleased releases.');
                    }
                }

                for (const milestone of allMilestones) {
                    if (!milestonesToSync.has(milestone.id)) {
                        continue;
                    }

                    const mapping = milestoneMappings.get(milestone.id);
                    let sprintId = mapping ? mapping.sprintId : null;
                    let releaseId = mapping ? mapping.releaseId : null;
                    const hasSprintPattern = mapping ? mapping.hasSprintPattern : false;

                    if (milestone.parent_id && !sprintId && !releaseId) {
                        let currentParentId = milestone.parent_id;
                        const maxDepth = 10;
                        let depth = 0;

                        while (currentParentId && !sprintId && !releaseId && depth < maxDepth) {
                            const parentMapping = milestoneMappings.get(currentParentId);
                            if (parentMapping) {
                                if (hasSprintPattern) {
                                    sprintId = parentMapping.sprintId || sprintId;
                                    releaseId = null;
                                } else {
                                    releaseId = parentMapping.releaseId || releaseId;
                                    sprintId = null;
                                }
                            }

                            if (!sprintId && !releaseId) {
                                const parentMilestone = allMilestones.find((m) => m.id === currentParentId);
                                if (parentMilestone && parentMilestone.parent_id) {
                                    currentParentId = parentMilestone.parent_id;
                                } else {
                                    break;
                                }
                            }
                            depth++;
                        }
                    } else if (milestone.parent_id) {
                        if (!hasSprintPattern && sprintId) {
                            sprintId = null;
                        }
                    }

                    let thresholdDate = null;
                    if (sprintId) {
                        const sprint = allSprints.find((s) => s._id.toString() === sprintId.toString());
                        if (sprint && sprint.startDate) {
                            thresholdDate = new Date(sprint.startDate).getTime();
                        }
                    } else if (releaseId) {
                        const release = allReleases.find((r) => r._id.toString() === releaseId.toString());
                        if (release && release.startDate) {
                            thresholdDate = new Date(release.startDate).getTime();
                        }
                    }

                    if (!thresholdDate) {
                        if (milestone.start_on) {
                            thresholdDate = milestone.start_on * 1000;
                        } else {
                            const now = Date.now();
                            thresholdDate = now - 30 * 24 * 60 * 60 * 1000;
                        }
                    }

                    const runs = await this.fetchRunsForMilestone(testrailConfig, trProject.projectId, milestone.id);

                    const manualRunsData = [];
                    const automationRunsData = [];
                    const allTicketNumbers = new Set();
                    for (const run of runs) {
                        const testCaseMetrics = {
                            references: 0,
                            casesWithReferences: 0,
                            casesWithoutReferences: 0,
                            automatedCasesCount: 0,
                            testsToBeAutomatedCount: 0,
                            newlyAddedCasesCount: 0,
                        };

                        if (run.id) {
                            const tests = await this.fetchTestsForRun(testrailConfig, run.id);

                            const uniqueReferences = new Set();

                            for (const test of tests) {
                                const refs = test.refs;

                                if (refs) {
                                    testCaseMetrics.casesWithReferences++;

                                    // Extract ticket numbers from refs and track unique ticket numbers
                                    const ticketNumbers = this.extractTicketNumbers(refs);
                                    ticketNumbers.forEach((ticket) => {
                                        allTicketNumbers.add(ticket);
                                        uniqueReferences.add(ticket);
                                    });
                                } else {
                                    testCaseMetrics.casesWithoutReferences++;
                                }

                                // Count automation - use custom_automation_type from test object
                                const automationType = test.custom_automation_type;
                                if (automationType === 2) {
                                    testCaseMetrics.automatedCasesCount++;
                                } else if (automationType === 1) {
                                    testCaseMetrics.testsToBeAutomatedCount++;
                                }

                                // Count newly added - based on sprint/release start date
                                const createdOn = test.created_on;
                                if (createdOn && thresholdDate) {
                                    const testCreatedTime = typeof createdOn === 'number' ? createdOn * 1000 : new Date(createdOn).getTime();
                                    if (testCreatedTime >= thresholdDate) {
                                        testCaseMetrics.newlyAddedCasesCount++;
                                    }
                                }
                            }

                            testCaseMetrics.references = uniqueReferences.size;
                        }

                        const runData = {
                            id: run.id,
                            suite_id: run.suite_id,
                            name: run.name,
                            description: run.description,
                            milestone_id: run.milestone_id,
                            assignedto_id: run.assignedto_id,
                            include_all: run.include_all,
                            is_completed: run.is_completed,
                            completed_on: run.completed_on ? new Date(run.completed_on * 1000) : null,
                            config: run.config,
                            config_ids: run.config_ids || [],
                            passed_count: run.passed_count,
                            blocked_count: run.blocked_count,
                            untested_count: run.untested_count,
                            retest_count: run.retest_count,
                            failed_count: run.failed_count,
                            project_id: run.project_id,
                            plan_id: run.plan_id,
                            created_on: run.created_on ? new Date(run.created_on * 1000) : null,
                            updated_on: run.updated_on ? new Date(run.updated_on * 1000) : null,
                            refs: run.refs,
                            created_by: run.created_by,
                            start_on: run.start_on ? new Date(run.start_on * 1000) : null,
                            due_on: run.due_on ? new Date(run.due_on * 1000) : null,
                            url: run.url,
                        };

                        // Persist per-run reference coverage so QA insights can sum cases w/ + w/o refs (not only when unique ref count > 0).
                        if (run.id) {
                            runData.testCaseMetrics = testCaseMetrics;
                        }

                        const nameLower = (run.name || '').toLowerCase();
                        const isAutomation = nameLower.includes('automation') || nameLower.includes('auto') || nameLower.includes('atm') || nameLower.includes('atmn');
                        const isManual = nameLower.includes('manual') || nameLower.includes('man');

                        // Calculate percentage same as runs processing (passed / total * 100)
                        const totalCount = (run.passed_count || 0) + (run.failed_count || 0) + (run.untested_count || 0) + (run.blocked_count || 0) + (run.retest_count || 0);
                        const passedPct = totalCount > 0 ? Math.round(((run.passed_count || 0) / totalCount) * 100) : 0;
                        runData.pass_percentage = passedPct;
                        if (isAutomation) {
                            runData.automation_percentage = passedPct;
                        } else {
                            runData.manual_percentage = passedPct;
                        }
                        if (isAutomation) {
                            automationRunsData.push(runData);
                        } else if (isManual) {
                            manualRunsData.push(runData);
                        } else {
                            manualRunsData.push(runData);
                        }
                    }

                    // Try to find boardId from test case ticket references
                    const boardIds = new Set();
                    if (allTicketNumbers.size > 0) {
                        const ticketArray = Array.from(allTicketNumbers);
                        const sprintIssues = await SprintIssue.find({
                            companyId: companyObjectId,
                            projectId: projectObjectId,
                            key: { $in: ticketArray },
                        }).lean();

                        for (const issue of sprintIssues) {
                            if (issue.boardId) {
                                boardIds.add(issue.boardId.toString());
                            }
                        }
                    }
                    const isMainMilestone = !milestone.parent_id || releaseId !== null || sprintId !== null;

                    // If no boardId found from test cases
                    if (boardIds.size === 0) {
                        if (syncType === 'light') {
                            if (isMainMilestone && (releaseId !== null || sprintId !== null)) {
                                boardIds.add(null);
                            } else {
                                const projectBoards = await Board.find({
                                    companyId: companyObjectId,
                                    projectId: projectObjectId,
                                }).lean();

                                if (projectBoards.length > 0) {
                                    for (const board of projectBoards) {
                                        boardIds.add(board._id.toString());
                                    }
                                } else {
                                    boardIds.add(null);
                                }
                            }
                        } else {
                            const projectBoards = await Board.find({
                                companyId: companyObjectId,
                                projectId: projectObjectId,
                            }).lean();

                            if (projectBoards.length > 0) {
                                for (const board of projectBoards) {
                                    boardIds.add(board._id.toString());
                                }
                            } else {
                                boardIds.add(null);
                            }
                        }
                    }

                    const boardIdArray = Array.from(boardIds);
                    if (boardIdArray.length === 0) {
                        boardIdArray.push(null);
                    }

                    let startOfToday = null;
                    let endOfToday = null;
                    if (syncType === 'light') {
                        startOfToday = new Date();
                        startOfToday.setHours(0, 0, 0, 0);
                        endOfToday = new Date(startOfToday);
                        endOfToday.setDate(endOfToday.getDate() + 1);
                    }

                    for (const boardIdStr of boardIdArray) {
                        const boardIdObjectId = boardIdStr ? new Types.ObjectId(boardIdStr) : null;

                        // Re-match sprint/release for this specific boardId
                        let finalSprintId = null;
                        // Preserve already-resolved release mapping (including inherited parent release)
                        // so sprint-pattern child milestones can still be fetched in release view.
                        let finalReleaseId = releaseId;

                        const currentHasSprintPattern = this.isMilestoneForSprint(milestone.name);

                        if (currentHasSprintPattern) {
                            const sprintsForBoard = boardIdObjectId ? allSprints.filter((s) => s.boardId && s.boardId.toString() === boardIdStr) : allSprints.filter((s) => !s.boardId);

                            const formattedTestrailName = milestone.name.replace(/([-|])(?=[A-Za-z])/g, '$1 ');

                            const sprintMatch = formattedTestrailName.match(/(?:sprint|pi)\s*.+$/i);

                            if (sprintMatch) {
                                const projectPrefix = formattedTestrailName.split(/\s+/)[0].trim();

                                const cleaned = sprintMatch[0]
                                    .replace(/\d{1,2}\s*[A-Z]{3}\s*\d{2,4}\s*to\s*\d{1,2}\s*[A-Z]{3}\s*\d{2,4}/gi, '') // remove date ranges
                                    .replace(/\|.*$/, '')
                                    .trim();

                                const extractedSprintName = `${projectPrefix} ${cleaned}`.trim();

                                const normalize = (str) => {
                                    if (!str) {
                                        return '';
                                    }
                                    return str
                                        .replace(/[/]+/g, '\\')
                                        .replace(/\\+/g, '\\')
                                        .replace(/(\d+)\s*y(\d{2})/i, '$1\\y$2')
                                        .toLowerCase()
                                        .replace(/\b[sr]?(print|rint|pint|int)\b/gi, '')
                                        .replace(/[|–-]/g, ' ')
                                        .replace(/\s+/g, ' ')
                                        .trim();
                                };

                                const dynamicPrefixSimplify = (str) => {
                                    if (!str) {
                                        return '';
                                    }
                                    return str.replace(/^([a-zA-Z]+)\b/, (full, prefix) =>
                                        prefix
                                            .replace(/\d+$/, '')
                                            .replace(/[a-z]{1,3}$/, '')
                                            .slice(0, 4)
                                    );
                                };

                                const normalizedExtracted = dynamicPrefixSimplify(normalize(extractedSprintName));

                                for (const sprint of sprintsForBoard) {
                                    if (!sprint.name) {
                                        continue;
                                    }

                                    const sprintNameTrimmed = sprint.name.trim();
                                    const milestoneNameTrimmed = milestone.name.trim();

                                    if (sprintNameTrimmed === milestoneNameTrimmed) {
                                        finalSprintId = sprint._id;
                                        break;
                                    }

                                    // Word boundary check to allow version numbers in milestone names
                                    const escapedSprint = sprintNameTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                    const regex = new RegExp(`\\b${escapedSprint}\\b`, 'i');
                                    if (regex.test(milestoneNameTrimmed)) {
                                        finalSprintId = sprint._id;
                                        break;
                                    }

                                    const normalizedCollection = dynamicPrefixSimplify(normalize(sprint.name));

                                    // --- STRICT NUMBER MATCHING ---
                                    const numsExtracted = this._extractNumbers(normalizedExtracted);
                                    const numsCollection = this._extractNumbers(normalizedCollection);

                                    const strictNumberMatch = numsExtracted.length > 0 && numsCollection.length > 0 && numsExtracted.every((n) => numsCollection.includes(n));

                                    if (!strictNumberMatch) {
                                        continue;
                                    }

                                    // FINAL: prefix + text match
                                    const isMatch =
                                        normalizedExtracted === normalizedCollection || normalizedExtracted.includes(normalizedCollection) || normalizedCollection.includes(normalizedExtracted);

                                    if (isMatch) {
                                        finalSprintId = sprint._id;
                                        break;
                                    }
                                }
                            } else {
                                console.warn(`[TestRail Sync] No sprint or PI pattern found in TestRail name: "${milestone.name}"`);
                            }

                            if (!finalSprintId) {
                                const sprintNames = sprintsForBoard.map((s) => s.name).join(', ');
                                console.warn(`  - Available sprints (${sprintsForBoard.length}): ${sprintNames || 'none'}`);
                            }
                        } else {
                            const releasePart = this.extractReleasePartFromMilestone(milestone.name);
                            if (releasePart) {
                                const releasesForBoard = boardIdObjectId ? allReleases.filter((r) => r.boardId && r.boardId.toString() === boardIdStr) : allReleases.filter((r) => !r.boardId);

                                for (const release of releasesForBoard) {
                                    const normalizedMilestone = releasePart.trim().toLowerCase();
                                    const normalizedRelease = release.releaseName.trim().toLowerCase();
                                    if (normalizedMilestone === normalizedRelease) {
                                        finalReleaseId = release._id;
                                        break;
                                    }
                                }
                            }
                        }

                        const filter = {
                            milestoneId: milestone.id,
                            companyId: companyObjectId,
                            jiraProjectId: projectObjectId,
                            testrailProjectId: trProject.projectId,
                        };

                        // Add boardId to filter only if it exists (for uniqueness per board)
                        if (boardIdObjectId) {
                            filter.boardId = boardIdObjectId;
                        } else {
                            filter.$or = [{ boardId: null }, { boardId: { $exists: false } }];
                        }

                        if (syncType === 'light' && startOfToday && endOfToday) {
                            filter.createdAt = { $gte: startOfToday, $lt: endOfToday };
                        }

                        const updateSet = {
                            milestoneId: milestone.id,
                            companyId: companyObjectId,
                            jiraProjectId: projectObjectId,
                            testrailProjectId: trProject.projectId,
                            name: milestone.name,
                            description: milestone.description || '',
                            startOn: milestone.start_on ? new Date(milestone.start_on * 1000) : null,
                            startedOn: milestone.started_on ? new Date(milestone.started_on * 1000) : null,
                            isCompleted: milestone.is_completed || false,
                            completedOn: milestone.completed_on ? new Date(milestone.completed_on * 1000) : null,
                            dueOn: milestone.due_on ? new Date(milestone.due_on * 1000) : null,
                            parentId: milestone.parent_id,
                            startIsOn: milestone.start_is_on ? new Date(milestone.start_is_on * 1000) : null,
                            url: milestone.url,
                            manualRuns: manualRunsData,
                            automationRuns: automationRunsData,
                            boardId: boardIdObjectId,
                            totalReferences: allTicketNumbers.size,
                        };

                        if (finalSprintId) {
                            if (finalSprintId instanceof Types.ObjectId) {
                                updateSet.sprintId = finalSprintId;
                            } else if (typeof finalSprintId === 'string' || finalSprintId.toString) {
                                try {
                                    updateSet.sprintId = new Types.ObjectId(finalSprintId);
                                } catch (e) {
                                    console.warn(`[TestRail Sync] Invalid sprintId format: ${finalSprintId}`);
                                }
                            }
                        }
                        if (finalReleaseId) {
                            if (finalReleaseId instanceof Types.ObjectId) {
                                updateSet.releaseId = finalReleaseId;
                            } else if (typeof finalReleaseId === 'string' || finalReleaseId.toString) {
                                try {
                                    updateSet.releaseId = new Types.ObjectId(finalReleaseId);
                                } catch (e) {
                                    console.warn(`[TestRail Sync] Invalid releaseId format: ${finalReleaseId}`);
                                }
                            }
                        }

                        const updateOperation = {
                            $set: updateSet,
                            $unset: {
                                runs: '',
                            },
                        };

                        if (!finalSprintId && finalReleaseId) {
                            updateOperation.$unset.sprintId = '';
                        }
                        if (!finalReleaseId && finalSprintId) {
                            updateOperation.$unset.releaseId = '';
                        }
                        if (!finalSprintId && !finalReleaseId) {
                            updateOperation.$unset.sprintId = '';
                            updateOperation.$unset.releaseId = '';
                        }

                        bulkOperations.push({
                            updateOne: {
                                filter: filter,
                                update: updateOperation,
                                upsert: true,
                            },
                        });
                    }
                }
            }

            if (bulkOperations.length > 0) {
                const result = await TestRailMilestone.bulkWrite(bulkOperations, { ordered: false });

                if (result.upsertedCount === 0 && bulkOperations.length > 0) {
                    console.warn(`[TestRail Sync] WARNING: No new documents inserted! All ${bulkOperations.length} operations were updates.`);
                }
            }
            return { success: true, milestoneCount: bulkOperations.length };
        } catch (error) {
            console.error(`Error syncing TestRail milestones: ${error.message}`);
        }
    }

    async fetchTestCases(testrailConfig, projectId, suiteId) {
        try {
            if (!testrailConfig || !testrailConfig.host || !testrailConfig.username || !testrailConfig.password) {
                console.error('Invalid TestRail configuration.');
                return [];
            }
            if (!projectId || !suiteId) {
                console.error('Project ID and Suite ID are required to fetch test cases.');
                return [];
            }

            const url = `${testrailConfig.host}/index.php?/api/v2/get_cases/${projectId}&suite_id=${suiteId}`;

            const allTestCases = [];
            let offset = 0;
            let hasMore = true;
            let requestCount = 0;

            while (hasMore) {
                requestCount++;
                const requestUrl = `${url}&limit=250&offset=${offset}`;
                const response = await axios.get(requestUrl, {
                    auth: {
                        username: testrailConfig.username,
                        password: testrailConfig.password,
                    },
                });

                const data = response.data;
                let cases = [];

                if (Array.isArray(data)) {
                    cases = data;
                    hasMore = false;
                } else if (data && typeof data === 'object') {
                    if (Array.isArray(data.cases)) {
                        cases = data.cases;
                    } else {
                        const dataKeys = Object.keys(data);
                        const arrayKeys = dataKeys.filter((key) => {
                            const value = data[key];
                            return Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && key !== '_links';
                        });

                        if (arrayKeys.length > 0) {
                            cases = data[arrayKeys[0]];
                        } else {
                            console.warn(`[TestRail] Could not find cases array in response for projectId: 
                                ${projectId}, suiteId: ${suiteId}, offset: ${offset}. Response keys: ${dataKeys.join(', ')}`);
                        }
                    }

                    const hasNextLink = data._links && data._links.next !== null && data._links.next !== undefined;
                    hasMore = hasNextLink;

                    if (hasMore) {
                        offset += cases.length > 0 ? cases.length : 250;
                    }
                }

                // Filter and add cases to collection - only include cases that match the requested suite_id
                if (cases.length > 0) {
                    const filteredCases = cases.filter((testCase) => {
                        return testCase.suite_id === suiteId;
                    });

                    if (filteredCases.length !== cases.length) {
                        const filteredOut = cases.length - filteredCases.length;
                        console.warn(`[TestRail] Request #${requestCount}:
                     Filtered out ${filteredOut} cases that don't belong to suite_id ${suiteId}. Fetched: ${filteredCases.length}, Total so far: ${allTestCases.length + filteredCases.length}`);
                    }

                    allTestCases.push(...filteredCases);
                }
            }

            return allTestCases;
        } catch (error) {
            if (error.response) {
                console.error('API Error Data:', error.response.data);
            }
            return [];
        }
    }

    async fetchTestsForRun(testrailConfig, runId) {
        try {
            if (!testrailConfig || !testrailConfig.host || !testrailConfig.username || !testrailConfig.password) {
                console.error('Invalid TestRail configuration.');
                return [];
            }
            if (!runId) {
                console.error('Run ID is required to fetch tests.');
                return [];
            }

            const url = `${testrailConfig.host}/index.php?/api/v2/get_tests/${runId}`;

            const allTests = [];
            let offset = 0;
            let hasMore = true;
            let requestCount = 0;

            while (hasMore) {
                requestCount++;
                const requestUrl = `${url}&limit=250&offset=${offset}`;
                const response = await axios.get(requestUrl, {
                    auth: {
                        username: testrailConfig.username,
                        password: testrailConfig.password,
                    },
                });

                const data = response.data;
                let tests = [];
                if (Array.isArray(data)) {
                    tests = data;
                    hasMore = false;
                } else if (data && typeof data === 'object') {
                    if (Array.isArray(data.tests)) {
                        tests = data.tests;
                    } else {
                        const dataKeys = Object.keys(data);
                        const arrayKeys = dataKeys.filter((key) => {
                            const value = data[key];
                            return Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && key !== '_links';
                        });

                        if (arrayKeys.length > 0) {
                            tests = data[arrayKeys[0]];
                        } else {
                            console.warn(`[TestRail] Could not find tests array in response for runId: ${runId}, offset: ${offset}. Response keys: ${dataKeys.join(', ')}`);
                        }
                    }

                    const hasNextLink = data._links && data._links.next !== null && data._links.next !== undefined;
                    hasMore = hasNextLink;

                    if (hasMore) {
                        offset += tests.length > 0 ? tests.length : 250;
                    }
                }

                if (tests.length > 0) {
                    allTests.push(...tests);
                } else {
                    console.log(`[TestRail] Request #${requestCount} completed: No tests found in this page`);
                }
            }

            return allTests;
        } catch (error) {
            if (error.response) {
                console.error('API Error Data:', error.response.data);
            }
            return [];
        }
    }
}

export default new TestRailService();
