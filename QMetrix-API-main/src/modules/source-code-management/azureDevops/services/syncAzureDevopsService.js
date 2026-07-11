/* eslint-disable max-len, no-console */
import 'dotenv/config';
import axios from 'axios';
import { PullRequestModel } from '../../github/model.js';
import { ProjectModel, SprintIssueModel, BoardIssueModel, SprintModel, JiraReleaseModel, BoardModel } from '../../../project-management/jira/model.js';
import { ConnectionModel } from '../../../connection/model.js';
import { cryptoHandler } from '../../../../utils/commonFunctions.js';
import { convertISTStringToUTCISOString } from '../../../../utils/commonFunctions.js';
import { PROVIDER_NAME_ADO, PROVIDER_NAME_JIRA, PROVIDER_NAME_AZURE_BOARDS } from '../../../../utils/constants/providerConstants.js';
import { STATUS_ACTIVE, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';

const logTag = 'AzureSCMSync';

class SyncAzureDevOpsService {
    async syncAzureDevOps(companyId, tenantConnection, type, projectId) {
        const Connection = ConnectionModel(tenantConnection);
        const azureCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_ADO });
        const azureBoardsCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_AZURE_BOARDS });
        const jiraCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_JIRA });

        if (!jiraCred && !azureBoardsCred) {
            console.warn(`[${logTag}]`, 'No Jira/AzureBoards connection found; skipping SCM sync', { companyId, projectId });
            return { error: 'Jira or Azure Boards connection not found for this company.' };
        }

        const decryptedPassword = jiraCred ? cryptoHandler(jiraCred.password, 'decrypt') : null;
        const jiraConfig = jiraCred ? { host: jiraCred.host, username: jiraCred.username, password: decryptedPassword, name: jiraCred.name } : null;

        if (!azureCred) {
            console.error('Azure DevOps connection not found for this company.');
            return { warning: 'Azure DevOps connection not found for this company. Sync skipped.' };
        }

        const decryptedAzurePassword = cryptoHandler(azureCred.password, 'decrypt');
        const azureConfig = {
            organization: this.normalizeAzureOrganization(azureCred.host),
            username: azureCred.username,
            password: decryptedAzurePassword,
        };

        const azureBoardsConfig = azureBoardsCred
            ? {
                organization: this.normalizeAzureOrganization(azureBoardsCred.host),
                username: azureBoardsCred.username,
                password: cryptoHandler(azureBoardsCred.password, 'decrypt'),
            }
            : null;

        try {
            await this.syncAzureDevOpsDetails(azureConfig, companyId, tenantConnection, jiraConfig, azureBoardsConfig, type, projectId);
        } catch (error) {
            console.error('Error during Azure DevOps sync:', error.message);
            throw error;
        }
    }

    async overridePRsToActiveSprintOnFirstDay(companyId, tenantConnection, activeSprintMap, projectId) {
        const SprintIssue = SprintIssueModel(tenantConnection);
        const PullRequest = PullRequestModel(tenantConnection);

        const activeProjectIds = Object.keys(activeSprintMap);
        if (activeProjectIds.length === 0) {
            return;
        }

        const activeSprintIds = Object.values(activeSprintMap);
        const sprintIssues = await SprintIssue.find({
            companyId,
            projectId: { $in: activeProjectIds },
            sprintId: { $in: activeSprintIds },
        });

        const issueKeys = sprintIssues.map((issue) => issue.key?.toUpperCase()).filter(Boolean);
        if (issueKeys.length === 0) {
            return;
        }

        const allPRs = await PullRequest.find({ companyId, projectId });

        const bulkOps = [];
        const updatedPRLogs = [];

        for (const pr of allPRs) {
            const title = pr.title || '';
            const extractIssueKeyFromTitle = (title, validKeys) => {
                const match = title.match(/\[([A-Z]+-\d+)\]/i);
                if (!match) {
                    return null;
                }

                const extractedKey = match[1].toUpperCase();
                return validKeys.includes(extractedKey) ? extractedKey : null;
            };
            const matchedKey = extractIssueKeyFromTitle(title, issueKeys);

            if (!matchedKey) {
                continue;
            }

            const matchingIssue = sprintIssues.find((iss) => iss.key?.toUpperCase() === matchedKey);
            const projectId = matchingIssue?.projectId?.toString();
            const newSprintId = activeSprintMap[projectId];

            if (!newSprintId) {
                continue;
            }

            const currentSprintIds = Array.isArray(pr.sprintId) ? pr.sprintId.map((id) => id.toString()) : [pr.sprintId?.toString()];

            if (currentSprintIds.includes(newSprintId.toString())) {
                continue;
            }

            bulkOps.push({
                updateOne: {
                    filter: { _id: pr._id },
                    update: { $set: { sprintId: [newSprintId] } },
                },
            });

            updatedPRLogs.push({
                prNumber: pr.prNumber,
                title: pr.title,
                matchedKey,
                newSprintId,
            });
        }

        if (bulkOps.length > 0) {
            await PullRequest.bulkWrite(bulkOps);
        } else {
            console.warn('No PRs needed sprint override today.');
        }
    }

    createAzureAuthHeaders(pat) {
        const auth = Buffer.from(`:${pat}`).toString('base64');
        return {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
        };
    }

    normalizeAzureOrganization(host) {
        if (!host) {
            return host;
        }
        const cleaned = host.replace(/^https?:\/\//i, '').replace(/^dev\.azure\.com\//i, '');
        const parts = cleaned.split('/').filter(Boolean);
        return parts[0] || cleaned;
    }

    async syncAzureDevOpsDetails(cred, companyId, tenantConnection, jiraConfig, azureBoardsConfig, type, projectId) {
        try {
            const PullRequest = PullRequestModel(tenantConnection);
            const Sprint = SprintModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const SprintIssue = SprintIssueModel(tenantConnection);
            const KanbanIssue = BoardIssueModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);
            const projectBoards = await Board.find({ companyId, projectId }).lean();
            
            if (projectBoards.length === 0) {
                console.warn(`No boards found for project ${projectId} in company ${companyId}`);
                return { successfulResults: [] };
            }
            const allResults = [];
            for (const board of projectBoards) {                
                const boardResult = await this.syncAzureDevOpsForBoard(
                    cred,
                    companyId,
                    tenantConnection,
                    jiraConfig,
                    azureBoardsConfig,
                    type,
                    projectId,
                    board,
                    PullRequest,
                    Sprint,
                    JiraRelease,
                    SprintIssue,
                    KanbanIssue,
                    Project
                );
                
                allResults.push(boardResult);
            }

            const flattened = allResults.flat();
            return { successfulResults: flattened };
        } catch (error) {
            console.error('Error Syncing Azure DevOps Data...', error.message);
            throw error;
        }
    }

    async syncAzureDevOpsForBoard(cred, companyId, tenantConnection, jiraConfig, azureBoardsConfig, type, projectId, board, PullRequest, Sprint, JiraRelease, SprintIssue, KanbanIssue, Project) {
        try {
            let IssueModel = SprintIssue;
            const boardTypeLower = board.boardType?.toLowerCase();
            const isKanban = boardTypeLower === 'kanban';
            const isAzureBoard = boardTypeLower?.includes('azure');
            
            if (isAzureBoard) {
                IssueModel = KanbanIssue;
            } else {
                IssueModel = isKanban ? KanbanIssue : SprintIssue;
            }

            let issueIds = [];

            // For Azure Boards: query work items directly from BoardIssueModel
            if (isAzureBoard) { 
                if (type === 'light') {
                    // For light sync, get work items from active iterations
                    const activeSprints = await Sprint.find({ companyId, projectId, state: STATUS_ACTIVE }).lean();
                    if (activeSprints.length > 0) {
                        const activeSprintIds = activeSprints.map((s) => s._id);
                        const activeSprintNames = activeSprints.map((s) => s.sprintName).filter(Boolean);
                        
                        // Query by both sprintId (if populated) and iterationPath (as fallback)
                        const activeWorkItems = await IssueModel.find({ 
                            companyId, 
                            projectId, 
                            boardId: board._id,
                            $or: [
                                { sprintId: { $in: activeSprintIds } },
                                ...(activeSprintNames.length > 0 ? [{ iterationPath: { $regex: new RegExp(activeSprintNames.join('|'), 'i') } }] : [])
                            ]
                        }).lean();
                        issueIds = activeWorkItems.map((i) => i.issueId);
                    } else {
                        // No active sprints, get recent work items (last 7 days)
                        const sevenDaysAgo = new Date();
                        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                        const recentWorkItems = await IssueModel.find({ 
                            companyId, 
                            projectId, 
                            boardId: board._id,
                            updatedAt: { $gte: sevenDaysAgo }
                        }).lean();
                        issueIds = recentWorkItems.map((i) => i.issueId);
                    }
                } else {
                    // For hard sync, get all work items for this board
                    const allWorkItems = await IssueModel.find({ companyId, projectId, boardId: board._id }).lean();
                    issueIds = allWorkItems.map((i) => i.issueId);
                }
            } else {
                // Existing Jira logic (unchanged)
                if (type === 'light') {
                    if (isKanban) {
                        const today = new Date();
                        const threeDaysAgo = new Date(today);
                        threeDaysAgo.setDate(today.getDate() - 3);

                        const unreleasedFixVersions = await JiraRelease.find(
                            {
                                companyId,
                                projectId,
                                status: RELEASE_STATUS_UNRELEASED,
                                startDate: { $exists: true, $ne: null },
                                $or: [{ releaseDate: { $exists: false } }, { releaseDate: null }, { releaseDate: { $gte: threeDaysAgo } }],
                            },
                            { releaseName: 1 }
                        ).lean();

                        const fixVersionNames = unreleasedFixVersions.map((fv) => fv.releaseName);
                        const kanbanIssues = await IssueModel.find({ companyId, projectId, boardId: board._id, fixVersion: { $in: fixVersionNames } }).lean();
                        issueIds = kanbanIssues.map((i) => i.issueId);
                    } else {
                        const activeSprints = await Sprint.find({ companyId, projectId, state: STATUS_ACTIVE }, { _id: 1 }).lean();
                        const activeSprintIds = activeSprints.map((s) => s._id);
                        const sprintIssues = await IssueModel.find({ companyId, projectId, boardId: board._id, sprintId: { $in: activeSprintIds } }).lean();
                        issueIds = sprintIssues.map((i) => i.issueId);
                    }
                } else {
                    const issues = await IssueModel.find({ companyId, projectId, boardId: board._id }).lean();
                    issueIds = issues.map((i) => i.issueId);
                }
            }

            const uniqueIssueIds = [...new Set(issueIds)];

            const allRepositoryUrls = new Set();
            
            // SOURCE 1: Jira dev-status API (only for Jira boards with issues)
            if (uniqueIssueIds.length > 0 && jiraConfig && !isAzureBoard) {
                const repositoryData = await this.syncAzureDevOpsRepos(uniqueIssueIds, jiraConfig, tenantConnection);
                const repoUrls = repositoryData.successfulResults.filter((result) => result.url).map((result) => result.url);
                repoUrls.forEach(url => allRepositoryUrls.add(url));
            }
            
            // SOURCE 2: Project.repos field (pre-configured repos)
            const project = await ProjectModel(tenantConnection).findOne({ companyId, _id: projectId });
            const linkedRepositories = project?.repos || [];
            linkedRepositories.forEach(url => allRepositoryUrls.add(url));
            
            // SOURCE 3: Direct Azure DevOps API Discovery (NEW!)
            // Get Azure project name from project metadata
            // Note: Project schema uses 'name' field, not 'projectName'
            const azureProjectName = project?.azureProjectName || project?.name || project?.key;
            
            if (allRepositoryUrls.size === 0 && azureProjectName) {
                try {
                    const discoveredRepos = await this.discoverAzureDevOpsRepositories(cred, azureProjectName);
                    discoveredRepos.forEach(repo => {
                        if (repo.webUrl) {
                            allRepositoryUrls.add(repo.webUrl);
                        }
                    });
                    
                    // Save discovered repos to project for future syncs
                    if (discoveredRepos.length > 0) {
                        const webUrls = discoveredRepos.map(r => r.webUrl).filter(Boolean);
                        await ProjectModel(tenantConnection).updateOne(
                            { _id: projectId, companyId },
                            { $addToSet: { repos: { $each: webUrls } } }
                        );
                    }
                } catch (error) {
                    console.error(`[${logTag}]`, 'Failed to discover repos from Azure', { boardId: board._id, error: error.message });
                }
            }
            
            const repoSources = Array.from(allRepositoryUrls);

            // If still no repos found, skip this board
            if (repoSources.length === 0) {
                console.warn(`[${logTag}]`, 'No repositories found for board after all discovery methods; skipping SCM sync', { 
                    boardId: board._id, 
                    boardName: board.boardName,
                    azureProjectName,
                    hasProject: !!project,
                    hasLinkedRepos: linkedRepositories.length
                });
                return [];
            }

            const azureRepositories = [];
            for (const repoUrl of repoSources) {
                try {
                    const parsedRepo = this.parseAzureRepositoryUrl(repoUrl, cred.organization);
                    if (parsedRepo) {
                        azureRepositories.push(parsedRepo);
                    } else {
                        console.warn(`[${logTag}]`, 'Failed to parse repository URL', { repoUrl });
                    }
                } catch (error) {
                    console.error(`[${logTag}]`, 'Error parsing repository URL', { repoUrl, error: error.message });
                }
            }
            
            // Resolve any repository details that need API lookup
            const resolvedRepositories = await this.resolveRepositoryDetails(cred, azureRepositories);
            
            if (resolvedRepositories.length === 0) {
                console.warn(`[${logTag}]`, 'No valid Azure DevOps repositories after parsing and resolution', { 
                    boardId: board._id, 
                    boardName: board.boardName,
                    originalUrlCount: repoSources.length,
                    sampleUrls: repoSources.slice(0, 3)
                });
                return [];
            }

            let lastSyncedDate;

            if (type === 'light') {
                if (project?.lastSynced) {
                    lastSyncedDate = await convertISTStringToUTCISOString(project.lastSynced);
                } else {
                    // Fallback: last 7 days if no lastSynced
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    lastSyncedDate = sevenDaysAgo.toISOString();
                    console.warn(`[${logTag}]`, 'no lastSynced in project, using 7 days ago', { boardId: board._id, lastSyncedDate });
                }
            } else {
                // Hard sync: last 120 days (increased from 60)
                const now = new Date();
                lastSyncedDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 150)).toISOString();
            }

            const allPRs = await Promise.all(
                resolvedRepositories.map(async (repo) => {
                    try {
                        const prs = await this.getAllAzureDevOpsPRs(cred, repo.projectName, repo.repositoryName, lastSyncedDate);
                        return { repository: repo, prs };
                    } catch (error) {
                        console.error(`[${logTag}]`, 'Error fetching PRs for repository', { 
                            repository: repo.repositoryName, 
                            project: repo.projectName, 
                            error: error.message,
                            stack: error.stack
                        });
                        return { repository: repo, prs: [] };
                    }
                })
            );

            const prDetails = allPRs.flatMap(({ repository, prs }) =>
                prs.map((prData) => ({
                    pullRequestId: prData.pullRequestId,
                    repositoryName: repository.repositoryName,
                    projectName: repository.projectName,
                    title: prData.title,
                }))
            );

            if (prDetails.length === 0) {
                console.warn(`[${logTag}]`, 'No PR candidates for board after filtering', { 
                    boardId: board._id, 
                    boardName: board.boardName,
                    repoCount: resolvedRepositories.length,
                    lastSyncedDate,
                    type
                });
            }
            const today = new Date().toISOString().split('T')[0];
            const activeSprints = await Sprint.find({ companyId, state: STATUS_ACTIVE });
            const activeSprintMap = {};
            activeSprints.forEach((sprint) => {
                const sprintStartDate = new Date(sprint.startDate).toISOString().split('T')[0];
                if (sprintStartDate === today) {
                    activeSprintMap[sprint.projectId.toString()] = sprint._id;
                }
            });

            if (Object.keys(activeSprintMap).length > 0) {
                await this.overridePRsToActiveSprintOnFirstDay(companyId, tenantConnection, activeSprintMap, projectId);
            }

            const detailedPRs = await Promise.all(
                prDetails.map(async ({ pullRequestId, repositoryName, projectName, title }) => {
                    try {
                        const prData = await this.getAzureDevOpsPRById(cred, projectName, repositoryName, pullRequestId);
                        const commits = await this.getAzureDevOpsPRCommits(cred, projectName, repositoryName, pullRequestId);
                        const workItems = await this.getAzureDevOpsPRWorkItems(cred, projectName, repositoryName, pullRequestId);
                        const reviewers = await this.getAzureDevOpsPRReviewers(cred, projectName, repositoryName, pullRequestId);
                        const threads = await this.getAzureDevOpsPRThreads(cred, projectName, repositoryName, pullRequestId);
                        const diffStats = await this.getAzureDevOpsPRDiffStats(cred, projectName, repositoryName, pullRequestId);
                        const iterations = await this.getAzureDevOpsPRIterations(cred, projectName, repositoryName, pullRequestId);
                        const latestIteration = iterations.length > 0 ? iterations[iterations.length - 1] : null;
                        let fileChanges = [];

                        if (latestIteration) {
                            fileChanges = await this.getAzureDevOpsPRChanges(cred, projectName, repositoryName, pullRequestId, latestIteration.id);
                        }
                        const sensitiveChanges = await this.identifySensitiveModuleChanges(fileChanges);
                        const testCoverage = await this.checkTestCoverage(fileChanges);
                        const reviews = this.processAzureDevOpsReviews(reviewers, threads);

                        let targetProjectId = null;
                        let targetBoardId = null;
                        let targetSprintId = null;
                        let fixVersion = null;
                        let workItemProjectName = null;
                        let workItemAreaPath = null;
                        let workItemIterationPath = null;
                        const repositoryUrl = `https://dev.azure.com/${cred.organization}/${encodeURIComponent(projectName)}/_git/${encodeURIComponent(repositoryName)}`;

                        if (Array.isArray(prData.workItemRefs) && prData.workItemRefs.length > 0) {
                            const workItemIds = prData.workItemRefs.map((w) => w.id).filter(Boolean);
                            const workItemCred = azureBoardsConfig || cred;
                            
                            const resolvedWorkItems = await this.getAzureDevOpsWorkItems(workItemCred, projectName, workItemIds);
                            
                            if (resolvedWorkItems.length > 0) {
                                // Use FIRST work item as primary (can be customized)
                                const primaryWorkItem = resolvedWorkItems[0];
                                const primaryWorkItemId = workItemIds[0];
                                
                                // Check if work item exists in DB with sprintId (more reliable than iteration path lookup)
                                const existingWorkItem = await IssueModel.findOne({ 
                                    companyId, 
                                    issueId: primaryWorkItemId 
                                }).lean();
                                
                                if (existingWorkItem?.sprintId) {
                                    // Use existing sprintId from work item document
                                    targetSprintId = Array.isArray(existingWorkItem.sprintId) 
                                        ? existingWorkItem.sprintId[0] 
                                        : existingWorkItem.sprintId;
                                    
                                    targetProjectId = existingWorkItem.projectId;
                                    targetBoardId = existingWorkItem.boardId;
                                    
                                    console.info(`[${logTag}]`, 'Using sprintId from work item in DB', { 
                                        pullRequestId, 
                                        workItemId: primaryWorkItemId,
                                        sprintId: targetSprintId
                                    });
                                } else {
                                    // Fallback: Extract from Azure work item fields if not in DB
                                    // Extract work item's project (NOT the repository project!)
                                    workItemProjectName = primaryWorkItem.fields?.['System.TeamProject'];
                                    workItemAreaPath = primaryWorkItem.fields?.['System.AreaPath'];
                                    workItemIterationPath = primaryWorkItem.fields?.['System.IterationPath'];
                                    
                                    // Map to work item's project in database
                                    if (workItemProjectName) {
                                        const matchedProject = await Project.findOne({ 
                                            companyId, 
                                            $or: [
                                                { projectName: workItemProjectName },
                                                { key: workItemProjectName },
                                                { azureProjectName: workItemProjectName }
                                            ]
                                        }).lean();
                                        
                                        if (matchedProject) {
                                            targetProjectId = matchedProject._id;
                                            
                                            // Add repository to work item's project (cross-project linking)
                                            await this.addRepositoryToProject(
                                                tenantConnection,
                                                companyId,
                                                targetProjectId,
                                                repositoryUrl
                                            );
                                            
                                            // Map team name from AreaPath to board
                                            if (workItemAreaPath) {
                                                const pathParts = workItemAreaPath.split('\\');
                                                const teamName = pathParts.length > 1 ? pathParts[1] : null;
                                                
                                                if (teamName) {
                                                    const matchedBoard = await BoardModel(tenantConnection).findOne({ 
                                                        companyId, 
                                                        projectId: targetProjectId,
                                                        $or: [
                                                            { boardName: teamName },
                                                            { boardName: { $regex: new RegExp(teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }
                                                        ]
                                                    }).lean();
                                                    
                                                    if (matchedBoard) {
                                                        targetBoardId = matchedBoard._id;
                                                    }
                                                }
                                            }
                                            
                                            // Map iteration path to sprint
                                            if (workItemIterationPath) {
                                                const iterationName = workItemIterationPath.split('\\').pop();
                                                const matchingSprint = await Sprint.findOne({ 
                                                    companyId, 
                                                    projectId: targetProjectId,
                                                    $or: [
                                                        { sprintName: iterationName },
                                                        { name: iterationName },
                                                        { sprintName: workItemIterationPath },
                                                        { name: workItemIterationPath },
                                                        { sprintName: { $regex: new RegExp(iterationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
                                                        { name: { $regex: new RegExp(iterationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }
                                                    ]
                                                });
                                                
                                                if (matchingSprint) {
                                                    targetSprintId = matchingSprint._id;
                                                }
                                            }
                                        } else {
                                            console.warn(`[${logTag}]`, 'Work item project not found in DB - will try fallback', { 
                                                pullRequestId, 
                                                workItemProjectName,
                                                repositoryProject: projectName
                                            });
                                        }
                                    }
                                }
                            }
                        }

                        if (isAzureBoard && (!targetSprintId || !targetBoardId)) {
                            // Azure Boards work item id in PR title, e.g. "[12345]" (digits only). Other formats are not matched here.
                            const titleMatch = title?.match(/\[(\d+)\]/);
                            const workItemIdFromTitle = titleMatch ? parseInt(titleMatch[1], 10) : null;
                            if (workItemIdFromTitle) {
                                const sprintIssueMatch = await SprintIssueModel(tenantConnection).findOne({
                                    companyId,
                                    issueId: workItemIdFromTitle
                                }).lean();
                                const boardIssueMatch = sprintIssueMatch || await BoardIssueModel(tenantConnection).findOne({
                                    companyId,
                                    issueId: workItemIdFromTitle
                                }).lean();
                                if (boardIssueMatch) {
                                    if (!targetSprintId && boardIssueMatch.sprintId) {
                                        targetSprintId = Array.isArray(boardIssueMatch.sprintId)
                                            ? boardIssueMatch.sprintId[0]
                                            : boardIssueMatch.sprintId;
                                    }
                                    if (!targetProjectId && boardIssueMatch.projectId) {
                                        targetProjectId = boardIssueMatch.projectId;
                                    }
                                    if (!targetBoardId && boardIssueMatch.boardId) {
                                        targetBoardId = boardIssueMatch.boardId;
                                    }
                                    if (!fixVersion && boardIssueMatch.fixVersion) {
                                        fixVersion = boardIssueMatch.fixVersion;
                                    }
                                }
                            }
                        }
                        
                        if (!targetProjectId && !isAzureBoard) {
                            const baseMatch = title.match(/\b([A-Z]+-\d+)\b/i);
                            const issueKey = baseMatch ? baseMatch[1].toUpperCase() : null;
                            
                            if (issueKey) {
                                const issueKeyMatch = issueKey.match(/^[A-Za-z]+/);
                                const extractedProjectKey = issueKeyMatch ? issueKeyMatch[0] : null;
                                
                                if (extractedProjectKey) {
                                    const jiraProject = await Project.findOne({ 
                                        companyId, 
                                        key: extractedProjectKey 
                                    }).lean();
                                    
                                    if (jiraProject) {
                                        targetProjectId = jiraProject._id;
                                        
                                        // Find issue to get board and sprint
                                        const scrumBoard = await Project.findOne({ 
                                            companyId, 
                                            key: extractedProjectKey, 
                                            boardType: 'scrum' 
                                        });
                                        
                                        const IssueModelToUse = scrumBoard ? SprintIssue : KanbanIssue;
                                        const issue = await IssueModelToUse.findOne({ 
                                            key: issueKey, 
                                            companyId 
                                        }).sort({ createdAt: -1 });
                                        
                                        if (issue) {
                                            targetBoardId = issue.boardId;
                                            targetSprintId = issue.sprintId;
                                            fixVersion = issue.fixVersion;
                                        }
                                    }
                                }
                            }
                        }
                        
                        if (!targetProjectId) {
                            const repoProject = await Project.findOne({ 
                                companyId, 
                                $or: [
                                    { projectName: projectName },
                                    { key: projectName },
                                    { azureProjectName: projectName }
                                ]
                            }).lean();
                            
                            if (repoProject) {
                                targetProjectId = repoProject._id;
                                targetBoardId = board._id; // Use current board
                            } else {
                                console.error(`[${logTag}]`, 'CRITICAL: No project mapping found for PR', { 
                                    pullRequestId, 
                                    repositoryProject: projectName, 
                                    workItemProject: workItemProjectName 
                                });
                            }
                        }
                        
                        if (targetProjectId && activeSprintMap[targetProjectId.toString()]) {
                            const activeSprintId = activeSprintMap[targetProjectId.toString()];
                            if (targetSprintId?.toString() !== activeSprintId?.toString()) {
                                targetSprintId = activeSprintId;
                            }
                        }

                        if (targetProjectId && !targetBoardId) {
                            if (board?._id && board?.projectId?.toString() === targetProjectId.toString()) {
                                targetBoardId = board._id;
                            } else {
                                // Do not reuse board._id when it belongs to another project; resolve a board under targetProjectId only.
                                const fallbackBoard = await BoardModel(tenantConnection).findOne(
                                    { companyId, projectId: targetProjectId },
                                    { _id: 1 }
                                ).lean();
                                targetBoardId = fallbackBoard?._id ?? null;
                            }
                        }

                        // Warn if no mapping found
                        if (!targetProjectId) {
                            console.error(`[${logTag}]`, 'No project mapping found - PR will have null projectId', {
                                pullRequestId,
                                title,
                                repositoryProject: projectName,
                                workItemProject: workItemProjectName
                            });
                        } 

                        return {
                            ...prData,
                            commits,
                            workItems,
                            reviews,
                            fileChanges,
                            diffStats,
                            repositoryName,
                            repositoryProject: projectName,  // Where PR was created
                            azureProjectName: workItemProjectName || projectName,
                            azureProjectId: workItemProjectName,
                            projectId: targetProjectId,
                            boardId: targetBoardId,
                            sprintId: targetSprintId,
                            fixVersion,
                            iterationPath: workItemIterationPath,
                            sensitiveChanges,
                            testCoverage,
                        };
                    } catch (error) {
                        console.error(`Error processing PR ${pullRequestId} from repository ${repositoryName}:`, error.message);
                        return null;
                    }
                })
            );

            const validDetailedPRs = detailedPRs.filter((pr) => pr !== null);
            const bulkOps = validDetailedPRs.map((prData) => this.mapAzureDevOpsPRToBulkOp(prData, companyId));

            if (bulkOps.length > 0) {
                await PullRequest.bulkWrite(bulkOps);
            }

            return [];
        } catch (error) {
            console.error(`[${logTag}]`, 'Error Syncing Azure DevOps Data for board', { 
                boardName: board.boardName, 
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async syncAzureDevOpsRepos(uniqueIssueIds, jiraConfig, tenantConnection) {
        try {
            const promises = uniqueIssueIds.map((issueId) =>
                axios
                    .get(`${jiraConfig.host}/rest/dev-status/1.0/issue/detail?issueId=${issueId}&applicationType=AzureDevOps&dataType=repository`, {
                        auth: {
                            username: jiraConfig.username,
                            password: jiraConfig.password,
                        },
                    })
                    .then((response) => {
                        let repoUrl = null;
                        let repoId = null;
                        const detail = response.data?.detail?.[0];

                        if (detail) {
                            if (detail.repositories && detail.repositories.length > 0) {
                                repoUrl = detail.repositories[0]?.url || null;
                                repoId = detail.repositories[0]?.id || null;
                            } else if (detail.branches && detail.branches.length > 0) {
                                repoUrl = detail.branches[0].repository?.url || null;
                                repoId = detail.branches[0].repository?.id || null;
                            } else if (detail.pullRequests && detail.pullRequests.length > 0) {
                                repoUrl = detail.pullRequests[0].repositoryUrl || null;
                                repoId = detail.pullRequests[0].repositoryId || null;
                            }
                        }

                        return { issueId, url: repoUrl, id: repoId };
                    })
                    .catch((error) => {
                        console.error(`Error fetching data for issueId ${issueId}:`, error.message);
                        return { issueId, url: null, id: null };
                    })
            );

            const results = await Promise.allSettled(promises);
            const successfulResults = results
                .filter((result) => result.status === 'fulfilled')
                .map((result) => result.value)
                .filter((repo, index, self) => index === self.findIndex((r) => r.url === repo.url));

            const SprintIssue = SprintIssueModel(tenantConnection);
            const KanbanIssue = BoardIssueModel(tenantConnection);
            const bulkOperations = await Promise.all(
                successfulResults.map(async (obj) => {
                    const { issueId, url } = obj;
                    if (!url) {
                        return null;
                    }

                    const sprintIssue = await SprintIssue.findOne({ issueId });
                    const kanbanIssue = !sprintIssue ? await KanbanIssue.findOne({ issueId }) : null;
                    const issue = sprintIssue || kanbanIssue;

                    if (issue) {
                        return {
                            updateOne: {
                                filter: { _id: issue.projectId, projectKeyId: issue.projectKeyId },
                                update: { $addToSet: { repos: url } },
                            },
                        };
                    }
                    return null;
                })
            );

            const validOperations = bulkOperations.filter(Boolean);
            if (validOperations.length > 0) {
                const Project = ProjectModel(tenantConnection);
                await Project.bulkWrite(validOperations);
            }

            return { successfulResults };
        } catch (error) {
            console.error('Error Syncing Azure DevOps Repository Data...', error.message);
            throw error;
        }
    }

    async getAllAzureDevOpsPRs(cred, projectName, repositoryName, lastSyncedDate) {
        try {
            const headers = this.createAzureAuthHeaders(cred.password);
            const encodedProjectName = encodeURIComponent(projectName);
            const encodedRepositoryName = encodeURIComponent(repositoryName);
            const response = await axios.get(
                `https://dev.azure.com/${cred.organization}/${encodedProjectName}/_apis/git/repositories/${encodedRepositoryName}/pullrequests?api-version=7.1&$top=100&$skip=0&searchCriteria.status=all`,
                { headers }
            );

            const prs = response.data.value || [];

            const filteredPRs = prs.filter((pr) => {
                const lastMergeCommitDate = new Date(pr.lastMergeCommit?.committer?.date || pr.creationDate).toISOString();
                const currentDate = new Date().toISOString();
                return lastMergeCommitDate >= lastSyncedDate && lastMergeCommitDate <= currentDate;
            });

            return filteredPRs;
        } catch (error) {
            console.error(`[${logTag}]`, 'Error fetching Azure DevOps PRs', {
                projectName,
                repositoryName,
                errorMessage: error.message,
                errorCode: error.code,
                statusCode: error.response?.status,
                statusText: error.response?.statusText,
                errorData: error.response?.data,
                organization: cred.organization,
                username: cred.username,
                hasPassword: !!cred.password
            });
            throw error;
        }
    }

    async getAzureDevOpsPRById(cred, projectName, repositoryName, pullRequestId) {
        try {
            const headers = this.createAzureAuthHeaders(cred.password);
            const encodedProjectName = encodeURIComponent(projectName);
            const encodedRepositoryName = encodeURIComponent(repositoryName);
            const response = await axios.get(
                `https://dev.azure.com/${cred.organization}/${encodedProjectName}/_apis/git/repositories/${encodedRepositoryName}/pullrequests/${pullRequestId}?api-version=7.1&includeWorkItemRefs=true`,
                {
                    headers,
                }
            );
            return response.data;
        } catch (error) {
            console.error(`Error fetching Azure DevOps PR ${pullRequestId}:`, error.message);
            throw error;
        }
    }

    async getAzureDevOpsPRCommits(cred, projectName, repositoryName, pullRequestId) {
        try {
            const headers = this.createAzureAuthHeaders(cred.password);
            const encodedProjectName = encodeURIComponent(projectName);
            const encodedRepositoryName = encodeURIComponent(repositoryName);
            const response = await axios.get(
                `https://dev.azure.com/${cred.organization}/${encodedProjectName}/_apis/git/repositories/${encodedRepositoryName}/pullrequests/${pullRequestId}/commits?api-version=7.0`,
                {
                    headers,
                }
            );

            const commits = response.data.value || [];
            return commits;
        } catch (error) {
            console.error(`Error fetching Azure DevOps PR commits for PR ${pullRequestId}:`, error.message);
            throw error;
        }
    }

    async getAzureDevOpsPRWorkItems(cred, projectName, repositoryName, pullRequestId) {
        try {
            const headers = this.createAzureAuthHeaders(cred.password);
            const encodedProjectName = encodeURIComponent(projectName);
            const encodedRepositoryName = encodeURIComponent(repositoryName);
            const response = await axios.get(
                `https://dev.azure.com/${cred.organization}/${encodedProjectName}/_apis/git/repositories/${encodedRepositoryName}/pullrequests/${pullRequestId}/workitems?api-version=7.0`,
                {
                    headers,
                }
            );

            const workItems = response.data.value || [];
            return workItems;
        } catch (error) {
            console.error(`Error fetching Azure DevOps PR work items for PR ${pullRequestId}:`, error.message);
            throw error;
        }
    }

    async getAzureDevOpsPRReviewers(cred, projectName, repositoryName, pullRequestId) {
        try {
            const headers = this.createAzureAuthHeaders(cred.password);
            const encodedProjectName = encodeURIComponent(projectName);
            const encodedRepositoryName = encodeURIComponent(repositoryName);
            const response = await axios.get(
                `https://dev.azure.com/${cred.organization}/${encodedProjectName}/_apis/git/repositories/${encodedRepositoryName}/pullrequests/${pullRequestId}/reviewers?api-version=7.0`,
                {
                    headers,
                }
            );

            const reviewers = response.data.value || [];
            return reviewers;
        } catch (error) {
            console.error(`Error fetching Azure DevOps PR reviewers for PR ${pullRequestId}:`, error.message);
            throw error;
        }
    }

    async getAzureDevOpsPRThreads(cred, projectName, repositoryName, pullRequestId) {
        try {
            const headers = this.createAzureAuthHeaders(cred.password);
            const encodedProjectName = encodeURIComponent(projectName);
            const encodedRepositoryName = encodeURIComponent(repositoryName);
            const response = await axios.get(
                `https://dev.azure.com/${cred.organization}/${encodedProjectName}/_apis/git/repositories/${encodedRepositoryName}/pullrequests/${pullRequestId}/threads?api-version=7.0`,
                {
                    headers,
                }
            );

            const threads = response.data.value || [];
            return threads;
        } catch (error) {
            console.error(`Error fetching Azure DevOps PR threads for PR ${pullRequestId}:`, error.message);
            throw error;
        }
    }

    async getAzureDevOpsPRIterations(cred, projectName, repositoryName, pullRequestId) {
        try {
            const headers = this.createAzureAuthHeaders(cred.password);
            const encodedProjectName = encodeURIComponent(projectName);
            const encodedRepositoryName = encodeURIComponent(repositoryName);
            const response = await axios.get(
                `https://dev.azure.com/${cred.organization}/${encodedProjectName}/_apis/git/repositories/${encodedRepositoryName}/pullrequests/${pullRequestId}/iterations?api-version=7.0`,
                {
                    headers,
                }
            );

            const iterations = response.data.value || [];
            return iterations;
        } catch (error) {
            console.error(`Error fetching Azure DevOps PR iterations for PR ${pullRequestId}:`, error.message);
            throw error;
        }
    }

    async getAzureDevOpsPRChanges(cred, projectName, repositoryName, pullRequestId, iterationId) {
        try {
            const headers = this.createAzureAuthHeaders(cred.password);
            const encodedProjectName = encodeURIComponent(projectName);
            const encodedRepositoryName = encodeURIComponent(repositoryName);
            const response = await axios.get(
                `https://dev.azure.com/${cred.organization}/${encodedProjectName}/_apis/git/repositories/${encodedRepositoryName}/pullrequests/${pullRequestId}/iterations/${iterationId}/changes?api-version=7.0`,
                { headers }
            );

            const changes = response.data.changeEntries || [];
            return changes;
        } catch (error) {
            console.error(`Error fetching Azure DevOps PR changes for PR ${pullRequestId}:`, error.message);
            throw error;
        }
    }

    async getAzureDevOpsPRDiffStats(cred, projectName, repositoryName, pullRequestId) {
        try {
            const iterations = await this.getAzureDevOpsPRIterations(cred, projectName, repositoryName, pullRequestId);
            if (iterations.length === 0) {
                return { linesAdded: 0, linesDeleted: 0, filesChanged: 0 };
            }

            const latestIteration = iterations[iterations.length - 1];

            const headers = this.createAzureAuthHeaders(cred.password);
            const encodedProjectName = encodeURIComponent(projectName);
            const encodedRepositoryName = encodeURIComponent(repositoryName);
            const response = await axios.get(
                `https://dev.azure.com/${cred.organization}/${encodedProjectName}/_apis/git/repositories/${encodedRepositoryName}/pullrequests/${pullRequestId}/iterations/${latestIteration.id}/changes?api-version=7.0`,
                { headers }
            );

            const changes = response.data.changeEntries || [];
            let linesAdded = 0;
            let linesDeleted = 0;
            const filesChanged = changes.length;

            changes.forEach((change) => {
                if (change.item && change.item.isFolder === false) {
                    linesAdded += change.item.changeCounts?.add || 0;
                    linesDeleted += change.item.changeCounts?.delete || 0;
                }
            });

            return { linesAdded, linesDeleted, filesChanged };
        } catch (error) {
            console.error(`Error fetching Azure DevOps PR diff stats for PR ${pullRequestId}:`, error.message);
            throw error;
        }
    }

    /**
     * Discover all repositories in an Azure DevOps project
     * This is called when no repos are pre-configured
     */
    async discoverAzureDevOpsRepositories(cred, projectName) {
        try {
            const headers = this.createAzureAuthHeaders(cred.password);
            const encodedProjectName = encodeURIComponent(projectName);
            
            const response = await axios.get(
                `https://dev.azure.com/${cred.organization}/${encodedProjectName}/_apis/git/repositories?api-version=7.1`,
                { headers }
            );
            
            const repositories = response.data.value || [];
            
            return repositories;
        } catch (error) {
            console.error(`[${logTag}]`, 'Error discovering Azure DevOps repositories', { 
                projectName, 
                error: error.message,
                status: error.response?.status,
                stack: error.stack
            });
            return [];
        }
    }

    /**
     * Parse Azure repository URL - handles both web URLs and API URLs
     * Returns { organization, projectName, repositoryName, repositoryId, url }
     */
    parseAzureRepositoryUrl(repoUrl, defaultOrganization) {
        try {
            // Handle repository object (from API discovery)
            if (typeof repoUrl === 'object' && repoUrl.webUrl) {
                return {
                    url: repoUrl.webUrl,
                    organization: defaultOrganization,
                    projectName: repoUrl.project?.name || '',
                    repositoryName: repoUrl.name,
                    repositoryId: repoUrl.id
                };
            }
            
            // Normalize URL string
            const urlString = typeof repoUrl === 'string' ? repoUrl : String(repoUrl);
            
            // Pattern 1: Web URL format
            // https://dev.azure.com/Zeltri/Zeltri%20Backend/_git/backend
            const webUrlMatch = urlString.match(/https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)/);
            
            if (webUrlMatch) {
                const [, organization, projectNameRaw, repositoryNameRaw] = webUrlMatch;
                return {
                    url: urlString,
                    organization: organization,
                    projectName: decodeURIComponent(projectNameRaw),
                    repositoryName: decodeURIComponent(repositoryNameRaw),
                    repositoryId: null
                };
            }
            
            // Pattern 2: API URL format
            // https://dev.azure.com/Zeltri/a5df1f61-de07-4ac6-bdbf-3a39b9f20803/_apis/git/repositories/9215e50f-bf58-45de-8f07-690f6d54390d
            const apiUrlMatch = urlString.match(/https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_apis\/git\/repositories\/([^/?]+)/);
            
            if (apiUrlMatch) {
                const [, organization, , repositoryId] = apiUrlMatch;
                
                // For API URLs, we need to fetch the repository details to get the actual names
                // Return a placeholder that will be resolved later
                return {
                    url: urlString,
                    organization: organization,
                    projectName: null, // Will be resolved
                    repositoryName: null, // Will be resolved
                    repositoryId: repositoryId,
                    needsResolution: true
                };
            }
            
            // Pattern 3: SSH URL format (git@ssh.dev.azure.com:v3/Zeltri/Zeltri Backend/backend)
            const sshUrlMatch = urlString.match(/git@ssh\.dev\.azure\.com:v3\/([^/]+)\/([^/]+)\/(.+)/);
            
            if (sshUrlMatch) {
                const [, organization, projectNameRaw, repositoryNameRaw] = sshUrlMatch;
                return {
                    url: urlString,
                    organization: organization,
                    projectName: decodeURIComponent(projectNameRaw),
                    repositoryName: decodeURIComponent(repositoryNameRaw),
                    repositoryId: null
                };
            }
            
            console.warn(`[${logTag}]`, 'Unknown repository URL format', { repoUrl: urlString });
            return null;
            
        } catch (error) {
            console.error(`[${logTag}]`, 'Error parsing repository URL', { repoUrl, error: error.message, stack: error.stack });
            return null;
        }
    }

    /**
     * Resolve repository names for API URLs that only have IDs
     */
    async resolveRepositoryDetails(cred, parsedRepos) {
        const resolved = [];
        
        for (const repo of parsedRepos) {
            if (!repo.needsResolution) {
                resolved.push(repo);
                continue;
            }
            
            try {
                const headers = this.createAzureAuthHeaders(cred.password);
                const response = await axios.get(
                    `https://dev.azure.com/${repo.organization}/_apis/git/repositories/${repo.repositoryId}?api-version=7.1`,
                    { headers }
                );
                
                const repoData = response.data;
                
                resolved.push({
                    url: repoData.webUrl, // Use webUrl for consistency
                    organization: repo.organization,
                    projectName: repoData.project.name,
                    repositoryName: repoData.name,
                    repositoryId: repo.repositoryId
                });
                
            } catch (error) {
                console.error(`[${logTag}]`, 'Failed to resolve repository details', { 
                    repositoryId: repo.repositoryId, 
                    error: error.message,
                    stack: error.stack
                });
                // Skip this repo
            }
        }
        
        return resolved;
    }

    async getAzureDevOpsWorkItems(cred, repositoryProjectName, workItemIds) {
        if (!workItemIds || workItemIds.length === 0) {
            return [];
        }
        try {
            const headers = this.createAzureAuthHeaders(cred.password);
            
            // Use batch API to fetch work items from ANY project in the organization
            // This supports cross-project work item queries
            const response = await axios.post(
                `https://dev.azure.com/${cred.organization}/_apis/wit/workitemsbatch?api-version=7.1`,
                {
                    ids: workItemIds,
                    fields: [
                        'System.Id',
                        'System.Title',
                        'System.State',
                        'System.TeamProject',
                        'System.AreaPath',
                        'System.IterationPath',
                        'System.WorkItemType',
                        'System.AssignedTo'
                    ]
                },
                { headers }
            );
            
            const items = response.data.value || [];
            
            return items;
        } catch (error) {
            console.error(`[${logTag}]`, 'Error fetching Azure DevOps work items', {
                repositoryProject: repositoryProjectName,
                error: error.message,
                stack: error.stack
            });
            return [];
        }
    }

    /**
     * Adds a repository URL to a project's repos array
     * This handles cross-project repository linking
     */
    async addRepositoryToProject(tenantConnection, companyId, projectId, repositoryUrl) {
        try {
            const Project = ProjectModel(tenantConnection);
            const existingProject = await Project.findOne({
                _id: projectId,
                companyId,
                repos: repositoryUrl
            });
            
            if (existingProject) {
                return;
            }
            await Project.updateOne(
                { _id: projectId, companyId },
                { 
                    $addToSet: { 
                        repos: repositoryUrl 
                    }
                }
            );
        } catch (error) {
            console.error(`[${logTag}]`, 'Error adding repository to project', {
                projectId,
                repositoryUrl,
                error: error.message
            });
            // Don't throw - this is non-critical
        }
    }

    processAzureDevOpsReviews(reviewers, threads) {
        const reviewersMap = new Map();

        // Process reviewer votes (formal reviews)
        reviewers.forEach((reviewer) => {
            if (reviewer.vote !== 0) {
                const key = reviewer.uniqueName || reviewer.displayName;
                if (!reviewersMap.has(key)) {
                    reviewersMap.set(key, {
                        reviewerUsername: reviewer.displayName || reviewer.uniqueName,
                        reviewDate: reviewer.votedForDate || new Date().toISOString(),
                        reviewState: this.mapAzureDevOpsVoteToReviewState(reviewer.vote),
                        reviewComment: reviewer.voteText || '',
                    });
                }
            }
        });

        // Process thread comments (avoid duplicates with formal reviews)
        threads.forEach((thread) => {
            if (thread.comments && thread.comments.length > 0) {
                thread.comments.forEach((comment) => {
                    if (comment.author && comment.author.displayName) {
                        const key = comment.author.uniqueName || comment.author.displayName;
                        // Only add if not already counted as formal reviewer
                        if (!reviewersMap.has(key)) {
                            reviewersMap.set(key, {
                                reviewerUsername: comment.author.displayName,
                                reviewDate: comment.publishedDate || comment.createdDate,
                                reviewState: 'commented',
                                reviewComment: comment.content || '',
                            });
                        }
                    }
                });
            }
        });

        return Array.from(reviewersMap.values());
    }

    mapAzureDevOpsVoteToReviewState(vote) {
        switch (vote) {
        case 10:
            return 'approved';
        case 5:
            return 'approved_with_suggestions';
        case 0:
            return 'commented';
        case -5:
            return 'changes_requested';
        case -10:
            return 'rejected';
        default:
            return 'commented';
        }
    }

    mapAzureDevOpsPRToBulkOp(prData, companyId) {
        const statusMapping = {
            active: 'open',
            abandoned: 'closed',
            completed: 'merged',
            notSet: 'draft',
        };

        // Ensure sprintId is always an array
        let sprintId = [];
        if (Array.isArray(prData.sprintId)) {
            sprintId = prData.sprintId;
        } else if (prData.sprintId) {
            sprintId = [prData.sprintId];
        }

        // Prepare update object
        const updateFields = {
            companyId,
            projectId: prData.projectId,
            sprintId: sprintId,
            fixVersion: prData.fixVersion,
            
            repo: `${prData.repositoryName}`,
            
            // Track both repository and work item projects for reference
            repositoryProject: prData.repositoryProject,
            azureProjectName: prData.azureProjectName,
            // Flag for cross-project PRs
            isCrossProject: prData.repositoryProject !== prData.azureProjectName && !!prData.azureProjectId,
            
            title: prData.title,
            status: statusMapping[prData.status] || prData.status,
            prCreatedAt: prData.creationDate,
            prClosedAt: prData.closedDate,
            prMergedAt: prData.mergeStatus === 'succeeded' ? prData.closedDate : null,
            prCreatedBy: prData.createdBy?.displayName || prData.createdBy?.uniqueName,
            prMergedBy: prData.completedBy?.displayName || prData.completedBy?.uniqueName,
            filesChanged: prData.diffStats?.filesChanged || 0,
            linesAdded: prData.diffStats?.linesAdded || 0,
            linesDeleted: prData.diffStats?.linesDeleted || 0,
            reviewComments: prData.reviews?.length || 0,
            mergeable: prData.mergeStatus === 'conflicts' ? 'false' : 'true',
            merged: (prData.status === 'completed' && prData.mergeStatus === 'succeeded') ? 'true' : 'false',
            
            prNumber: prData.pullRequestId,
            branchName: prData.sourceRefName?.replace('refs/heads/', ''),
            reviews: prData.reviews || [],
            commits: prData.commits
                ? prData.commits.map((commit) => ({
                    commitId: commit.commitId,
                    message: commit.comment,
                    committerName: commit.committer?.name || commit.author?.name,
                    committerEmail: commit.committer?.email || commit.author?.email,
                    date: commit.committer?.date || commit.author?.date,
                }))
                : [],
            hasSensitiveChanges: prData.sensitiveChanges?.hasSensitiveChanges || false,
            sensitiveFiles: prData.sensitiveChanges?.sensitiveFiles || [],
            missingTests: {
                hasMissingTests: prData.testCoverage?.hasMissingTests || false,
                codeFilesChanged: prData.testCoverage?.codeFilesChanged || 0,
                testFilesChanged: prData.testCoverage?.testFilesChanged || 0,
            },
        };

        if (prData.boardId) {
            updateFields.boardId = prData.boardId;
        }
        if (prData.azureProjectId) {
            updateFields.azureProjectId = prData.azureProjectId;
            updateFields.iterationPath = prData.iterationPath;
        }

        return {
            updateOne: {
                filter: {
                    prId: `${prData.pullRequestId}`,
                },
                update: {
                    $set: updateFields,
                    $setOnInsert: {
                        createdAt: new Date(),
                    },
                    $currentDate: {
                        updatedAt: true,
                    },
                },
                upsert: true,
            },
        };
    }

    async identifySensitiveModuleChanges(files) {
        const sensitivePatterns = [
            /\.env/i,
            /config/i,
            /secret/i,
            /password/i,
            /key/i,
            /token/i,
            /credential/i,
            /\.pem$/i,
            /\.key$/i,
            /\.p12$/i,
            /\.pfx$/i,
            /\.jks$/i,
            /\.keystore$/i,
            /\.truststore$/i,
            /\.crt$/i,
            /\.cer$/i,
            /\.der$/i,
            /\.p7b$/i,
            /\.p7c$/i,
            /\.p7m$/i,
            /\.p7s$/i,
        ];

        const sensitiveFiles = files
            .filter((file) => {
                const filePath = file.item?.path || file.filename || file.path;
                return sensitivePatterns.some((pattern) => pattern.test(filePath));
            })
            .map((file) => ({
                filename: file.item?.path || file.filename || file.path,
                status: file.changeType,
                additions: file.item?.changeCounts?.add || 0,
                deletions: file.item?.changeCounts?.delete || 0,
                changes: (file.item?.changeCounts?.add || 0) + (file.item?.changeCounts?.delete || 0),
            }));

        return {
            hasSensitiveChanges: sensitiveFiles.length > 0,
            sensitiveFiles,
        };
    }

    async checkTestCoverage(files) {
        const testPatterns = [/\.test\./i, /\.spec\./i, /test\//i, /tests\//i, /__tests__\//i, /\.test$/i, /\.spec$/i];

        const codeFiles = files.filter((file) => {
            const filename = file.item?.path || file.filename || file.path;
            return !testPatterns.some((pattern) => pattern.test(filename)) && (filename.endsWith('.js') || filename.endsWith('.ts') || filename.endsWith('.jsx') || filename.endsWith('.tsx'));
        });

        const testFiles = files.filter((file) => {
            const filename = file.item?.path || file.filename || file.path;
            return testPatterns.some((pattern) => pattern.test(filename));
        });

        return {
            hasMissingTests: codeFiles.length > 0 && testFiles.length === 0,
            codeFilesChanged: codeFiles.length,
            testFilesChanged: testFiles.length,
        };
    }
}

export default new SyncAzureDevOpsService();
