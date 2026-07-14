/* eslint-disable no-constant-condition */
/* eslint-disable no-const-assign */
import 'dotenv/config';
import axios from 'axios';
import { PullRequestModel } from '../../github/model.js';
import { ProjectModel, BoardModel } from '../../../project-management/jira/model.js';
import { SprintIssueModel, BoardIssueModel, SprintModel, JiraReleaseModel } from '../../../project-management/jira/model.js';
import { ConnectionModel } from '../../../connection/model.js';
import { cryptoHandler, convertISTStringToUTCISOString } from '../../../../utils/commonFunctions.js';
import { Types } from 'mongoose';
import {
    GITLAB_API_BASE_URL,
    PROVIDER_NAME_GITLAB,
    PROVIDER_NAME_JIRA,
    PROVIDER_NAME_GITLAB_ISSUES,
} from '../../../../utils/constants/providerConstants.js';
import { STATUS_ACTIVE, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';

class SyncGitLabService {
    async overrideMRsToActiveSprintOnFirstDay(cred, companyId, tenantConnection, activeSprintMap, projectId) {
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
            const issueProjectId = matchingIssue?.projectId?.toString();
            const boardId = matchingIssue?.boardId;
            const newSprintId = activeSprintMap[issueProjectId];

            if (!newSprintId) {
                continue;
            }

            const currentSprintIds = Array.isArray(pr.sprintId) ? pr.sprintId.map((id) => id.toString()) : [pr.sprintId?.toString()];

            if (currentSprintIds.includes(newSprintId.toString())) {
                continue;
            }

            const gitlabProjectId = pr.repo;
            let latestMRData = null;
            let latestReviews = [];
            let latestCommits = [];
            let sensitiveChanges = { hasSensitiveChanges: false, sensitiveFiles: [] };
            let testCoverage = { hasMissingTests: false, codeFilesChanged: 0, testFilesChanged: 0 };

            try {
                latestMRData = await this.getMRByNumber(gitlabProjectId, pr.prNumber, cred);
                latestReviews = await this.getMRReviews(gitlabProjectId, pr.prNumber, cred);
                latestCommits = await this.getMRCommits(gitlabProjectId, pr.prNumber, cred);
                sensitiveChanges = await this.identifySensitiveModuleChanges(gitlabProjectId, pr.prNumber, cred);
                testCoverage = await this.checkTestCoverage(gitlabProjectId, pr.prNumber, cred);
            } catch (error) {
                console.error(`Error fetching latest MR details for MR #${pr.prNumber} in project ${gitlabProjectId}:`, error.message);
            }

            const updateData = {
                sprintId: newSprintId,
                boardId: boardId,
            };

            if (latestMRData) {
                updateData.title = latestMRData.title;
                updateData.status = latestMRData.state;
                updateData.prCreatedAt = latestMRData.created_at;
                updateData.prClosedAt = latestMRData.closed_at;
                updateData.prMergedAt = latestMRData.merged_at;
                updateData.prCreatedBy = latestMRData.author?.name;
                updateData.prMergedBy = latestMRData.merged_by ? latestMRData.merged_by.username : null;
                updateData.filesChanged = latestMRData.changes_count ?? 0;
                updateData.linesAdded = latestMRData.totalAdditions ?? 0;
                updateData.linesDeleted = latestMRData.totalDeletions ?? 0;
                updateData.reviewComments = latestReviews?.length ?? 0;
                updateData.mergeable = latestMRData.merge_status;
                updateData.merged = latestMRData.state;
                updateData.branchName = latestMRData.source_branch ?? '';
                
                if (latestReviews && latestReviews.length > 0) {
                    updateData.reviews = latestReviews.flatMap((review) =>
                        review.notes?.map((note) => ({
                            reviewerId: note.author?.id?.toString(),
                            reviewerUsername: note.author?.username,
                            reviewState: note.system ? 'system' : 'manual',
                            reviewDate: note.created_at,
                            reviewComment: note.body,
                            reviewId: review.id?.toString(),
                            isLatest: false,
                        })) || []
                    );
                }
                
                if (latestCommits && Array.isArray(latestCommits) && latestCommits.length > 0) {
                    updateData.commits = latestCommits.map((commit) => ({
                        commitId: commit?.id ?? '',
                        message: commit?.message ?? '',
                        committerName: commit?.committer_name ?? '',
                        committerEmail: commit?.committer_email ?? '',
                        date: commit?.committed_date ?? '',
                    }));
                }
                
                updateData.hasSensitiveChanges = sensitiveChanges.hasSensitiveChanges || false;
                updateData.sensitiveFiles = sensitiveChanges.sensitiveFiles || [];
                
                updateData.missingTests = {
                    hasMissingTests: testCoverage.hasMissingTests || false,
                    codeFilesChanged: testCoverage.codeFilesChanged || 0,
                    testFilesChanged: testCoverage.testFilesChanged || 0,
                };
            }

            bulkOps.push({
                updateOne: {
                    filter: { _id: pr._id },
                    update: { $set: updateData },
                },
            });

            updatedPRLogs.push({
                prNumber: pr.prNumber,
                title: latestMRData?.title || pr.title,
                matchedKey,
                newSprintId,
                boardId,
            });
        }

        if (bulkOps.length > 0) {
            await PullRequest.bulkWrite(bulkOps);
        } else {
            console.warn('No MRs needed sprint override today.');
        }
    }

    async overrideMRsToUnreleasedOnFirstDay(cred, companyId, tenantConnection, unreleasedFixVersionMap, projectId) {
        const BoardIssue = BoardIssueModel(tenantConnection);
        const SprintIssue = SprintIssueModel(tenantConnection);
        const Board = BoardModel(tenantConnection);
        const PullRequest = PullRequestModel(tenantConnection);

        const activeProjectIds = Object.keys(unreleasedFixVersionMap);
        if (activeProjectIds.length === 0) {
            return;
        }

        const boards = await Board.find({ companyId, projectId: { $in: activeProjectIds } }).lean();
        const boardTypeMap = {};
        boards.forEach((board) => {
            boardTypeMap[board._id.toString()] = board.boardType?.toLowerCase() === 'kanban';
        });

        const allFixVersions = Object.values(unreleasedFixVersionMap).flat();
        
        const [kanbanIssues, sprintIssues] = await Promise.all([
            BoardIssue.find({
                companyId,
                projectId: { $in: activeProjectIds },
                fixVersion: { $in: allFixVersions },
            }).lean(),
            SprintIssue.find({
                companyId,
                projectId: { $in: activeProjectIds },
                fixVersion: { $in: allFixVersions },
            }).lean(),
        ]);

        const allIssues = [];
        kanbanIssues.forEach((issue) => {
            const boardIdStr = issue.boardId?.toString();
            if (boardTypeMap[boardIdStr] === true) {
                allIssues.push(issue);
            }
        });
        sprintIssues.forEach((issue) => {
            const boardIdStr = issue.boardId?.toString();
            if (boardTypeMap[boardIdStr] === false) {
                allIssues.push(issue);
            }
        });

        const issueKeys = allIssues.map((issue) => issue.key?.toUpperCase()).filter(Boolean);
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

            const matchingIssue = allIssues.find((iss) => iss.key?.toUpperCase() === matchedKey);
            const projectIdForIssue = matchingIssue?.projectId?.toString();
            const boardId = matchingIssue?.boardId;
            const newFixVersion = matchingIssue?.fixVersion;
            const projectFixVersions = unreleasedFixVersionMap[projectIdForIssue];

            if (!newFixVersion || !projectFixVersions || !projectFixVersions.includes(newFixVersion)) {
                continue;
            }

            const currentFixVersion = pr.fixVersion;

            if (currentFixVersion === newFixVersion) {
                continue;
            }

            const gitlabProjectId = pr.repo;
            let latestMRData = null;
            let latestReviews = [];
            let latestCommits = [];
            let sensitiveChanges = { hasSensitiveChanges: false, sensitiveFiles: [] };
            let testCoverage = { hasMissingTests: false, codeFilesChanged: 0, testFilesChanged: 0 };

            try {
                latestMRData = await this.getMRByNumber(gitlabProjectId, pr.prNumber, cred);
                latestReviews = await this.getMRReviews(gitlabProjectId, pr.prNumber, cred);
                latestCommits = await this.getMRCommits(gitlabProjectId, pr.prNumber, cred);
                sensitiveChanges = await this.identifySensitiveModuleChanges(gitlabProjectId, pr.prNumber, cred);
                testCoverage = await this.checkTestCoverage(gitlabProjectId, pr.prNumber, cred);
            } catch (error) {
                console.error(`Error fetching latest MR details for MR #${pr.prNumber} in project ${gitlabProjectId}:`, error.message);
            }

            const updateData = {
                fixVersion: newFixVersion,
                boardId: boardId,
            };

            if (latestMRData) {
                updateData.title = latestMRData.title;
                updateData.status = latestMRData.state;
                updateData.prCreatedAt = latestMRData.created_at;
                updateData.prClosedAt = latestMRData.closed_at;
                updateData.prMergedAt = latestMRData.merged_at;
                updateData.prCreatedBy = latestMRData.author?.name;
                updateData.prMergedBy = latestMRData.merged_by ? latestMRData.merged_by.username : null;
                updateData.filesChanged = latestMRData.changes_count ?? 0;
                updateData.linesAdded = latestMRData.totalAdditions ?? 0;
                updateData.linesDeleted = latestMRData.totalDeletions ?? 0;
                updateData.reviewComments = latestReviews?.length ?? 0;
                updateData.mergeable = latestMRData.merge_status;
                updateData.merged = latestMRData.state;
                updateData.branchName = latestMRData.source_branch ?? '';
                
                if (latestReviews && latestReviews.length > 0) {
                    updateData.reviews = latestReviews.flatMap((review) =>
                        review.notes?.map((note) => ({
                            reviewerId: note.author?.id?.toString(),
                            reviewerUsername: note.author?.username,
                            reviewState: note.system ? 'system' : 'manual',
                            reviewDate: note.created_at,
                            reviewComment: note.body,
                            reviewId: review.id?.toString(),
                            isLatest: false,
                        })) || []
                    );
                }
                
                if (latestCommits && Array.isArray(latestCommits) && latestCommits.length > 0) {
                    updateData.commits = latestCommits.map((commit) => ({
                        commitId: commit?.id ?? '',
                        message: commit?.message ?? '',
                        committerName: commit?.committer_name ?? '',
                        committerEmail: commit?.committer_email ?? '',
                        date: commit?.committed_date ?? '',
                    }));
                }
                
                updateData.hasSensitiveChanges = sensitiveChanges.hasSensitiveChanges || false;
                updateData.sensitiveFiles = sensitiveChanges.sensitiveFiles || [];
                
                updateData.missingTests = {
                    hasMissingTests: testCoverage.hasMissingTests || false,
                    codeFilesChanged: testCoverage.codeFilesChanged || 0,
                    testFilesChanged: testCoverage.testFilesChanged || 0,
                };
            }

            bulkOps.push({
                updateOne: {
                    filter: { _id: pr._id },
                    update: { $set: updateData },
                },
            });

            updatedPRLogs.push({
                prNumber: pr.prNumber,
                title: latestMRData?.title || pr.title,
                matchedKey,
                newFixVersion,
                boardId,
            });
        }

        if (bulkOps.length > 0) {
            await PullRequest.bulkWrite(bulkOps);
        } else {
            console.warn('No MRs needed unreleased override today.');
        }
    }

    async syncGitLab(companyId, tenantConnection, type, projectId) {
        const Connection = ConnectionModel(tenantConnection);

        const gitCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITLAB });
        const jiraCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_JIRA });
        const gitLabIssuesCred = await Connection.findOne({ companyId, name: { $in: [PROVIDER_NAME_GITLAB_ISSUES] } });

        if (!gitCred) {
            console.error('GitLab connection not found for this company.');
            return { warning: 'GitLab connection not found for this company. Sync skipped.' };
        }

        const decryptedGitPassword = cryptoHandler(gitCred.password, 'decrypt');
        const gitlabConfig = { host: gitCred.host, username: gitCred.username, password: decryptedGitPassword };

        // Determine which approach to use based on available credentials
        let jiraConfig = null;
        if (jiraCred) {
            const decryptedPassword = cryptoHandler(jiraCred.password, 'decrypt');
            jiraConfig = { host: jiraCred.host, username: jiraCred.username, password: decryptedPassword, name: jiraCred.name };
        }

        try {
            await this.syncGitLabData(gitlabConfig, companyId, tenantConnection, jiraConfig, gitLabIssuesCred, type, projectId);
            return {
                success: true,
                message: 'GitLab sync completed successfully.',
            };
        } catch (error) {
            console.error('Error during GitLab sync:', error.message);
            return {
                error: 'GitLab sync failed.',
                details: error.message,
            };
        }
    }

    async syncGitLabData(cred, companyId, tenantConnection, jiraConfig, gitLabIssuesCred, type, projectId) {
        try {
            const PullRequest = PullRequestModel(tenantConnection);
            const Sprint = SprintModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const SprintIssue = SprintIssueModel(tenantConnection);
            const KanbanIssue = BoardIssueModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);

            // Fetch all boards for this project
            const projectBoards = await Board.find({ companyId, projectId }).lean();            
            if (projectBoards.length === 0) {
                console.warn(`No boards found for project ${projectId} in company ${companyId}`);
                return { successfulResults: [] };
            }

            // Process each board separately
            const allResults = [];
            for (const board of projectBoards) {                
                const boardResult = await this.syncGitLabForBoard(
                    cred, 
                    companyId, 
                    tenantConnection, 
                    jiraConfig, 
                    gitLabIssuesCred,
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

            return { successfulResults: allResults.flat() };
        } catch (error) {
            console.error('Error Syncing GitLab Data...', error.message);
            throw error;
        }
    }

    async syncGitLabForBoard(cred, companyId, tenantConnection, jiraConfig, gitLabIssuesCred, type, projectId, board, PullRequest, Sprint, JiraRelease, SprintIssue, KanbanIssue, Project) {
        try {
            let IssueModel = SprintIssue;
            const isKanban = board.boardType?.toLowerCase() === 'kanban' || board.boardType?.toLowerCase() === 'gitlab-board';
            IssueModel = isKanban ? KanbanIssue : SprintIssue;

            let issueIds = [];

            if (type === 'light') {
                if (isKanban) {
                    const today = new Date(); 
                    const threeDaysAgo = new Date(today); 
                    threeDaysAgo.setDate(today.getDate() - 3); 

                    const unreleasedFixVersions = await JiraRelease.find({ 
                        companyId, 
                        projectId, 
                        status: RELEASE_STATUS_UNRELEASED,
                        startDate: { $exists: true, $ne: null }, 
                        $or: [
                            { releaseDate: { $exists: false } }, 
                            { releaseDate: null }, 
                            { releaseDate: { $gte: threeDaysAgo } }
                        ], 
                    }, { releaseName: 1 }).lean(); 

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

            const uniqueIssueIds = [...new Set(issueIds)];
            if (uniqueIssueIds.length === 0) {
                return [];
            }

            // Use different approach based on available credentials
            let syncResult;
            if (jiraConfig) {
                // Old approach: Use Jira dev-status REST API
                syncResult = await this.syncGitLabRepos(uniqueIssueIds, jiraConfig, tenantConnection, IssueModel);
            } else if (gitLabIssuesCred) {
                // New approach: Use GitLab Issues connection
                syncResult = await this.syncGitLabReposForGitLabIssues(uniqueIssueIds, gitLabIssuesCred, tenantConnection, IssueModel, companyId, projectId);
            } else {
                console.warn('[GitLab] No Jira or GitLab Issues credentials found. Cannot sync repositories.');
                return uniqueIssueIds.map(issueId => ({ issueId, url: null, id: null }));
            }

            const validRepos = syncResult.successfulResults.filter((r) => r.url && r.id);

            if (validRepos.length === 0) {
                console.warn(`No repository URLs found from syncGitLabRepos for board ${board.boardName}`);
                return [];
            }

            const repos = validRepos.reduce((acc, current) => {
                const existingRepo = acc.find((repo) => repo.id === current.id);
                if (!existingRepo) {
                    acc.push({
                        id: current.id,
                        url: current.url,
                    });
                }
                return acc;
            }, []);

            const allMRs = await Promise.allSettled(repos.map((repo) => this.getAllMergeRequests(cred, repo.id, type, companyId, projectId, tenantConnection)));

            const repoMap = {};
            allMRs.forEach((mrResult, index) => {
                if (mrResult.status === 'fulfilled' && Array.isArray(mrResult.value)) {
                    mrResult.value.forEach((mrData) => {
                        if (mrData?.project_id) {
                            repoMap[mrData.project_id] = repos[index]?.url || 'Unknown URL';
                        }
                    });
                }
            });

            const mrDetails = allMRs.reduce((acc, mr) => {
                if (mr.status === 'fulfilled') {
                    acc.push(
                        ...mr.value.map((mrData) => ({
                            project_id: mrData?.project_id,
                            merge_request_id: mrData?.iid,
                            title: mrData?.title,
                        }))
                    );
                }
                return acc;
            }, []);

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
                await this.overrideMRsToActiveSprintOnFirstDay(cred, companyId, tenantConnection, activeSprintMap, projectId);
            }

            const todayDate = new Date(); 
            const threeDaysAgo = new Date(todayDate); 
            threeDaysAgo.setDate(todayDate.getDate() - 3);

            const unreleasedReleases = await JiraRelease.find({ 
                companyId, 
                projectId, 
                status: RELEASE_STATUS_UNRELEASED,
                startDate: { $exists: true, $ne: null }, 
                $or: [
                    { releaseDate: { $exists: false } }, 
                    { releaseDate: null }, 
                    { releaseDate: { $gte: threeDaysAgo } }
                ], 
            }, { releaseName: 1, projectId: 1, startDate: 1 }).lean();

            const unreleasedFixVersionMap = {};
            unreleasedReleases.forEach((release) => {
                const releaseStartDate = new Date(release.startDate).toISOString().split('T')[0];
                if (releaseStartDate === today) {
                    const projectIdStr = release.projectId.toString();
                    if (!unreleasedFixVersionMap[projectIdStr]) {
                        unreleasedFixVersionMap[projectIdStr] = [];
                    }
                    unreleasedFixVersionMap[projectIdStr].push(release.releaseName);
                }
            });

            if (Object.keys(unreleasedFixVersionMap).length > 0) {
                await this.overrideMRsToUnreleasedOnFirstDay(cred, companyId, tenantConnection, unreleasedFixVersionMap, projectId);
            }

            const detailedMRs = await Promise.allSettled(
                mrDetails.map(async ({ project_id, merge_request_id, title }) => {
                    const mrData = await this.getMRByNumber(project_id, merge_request_id, cred);
                    const reviews = await this.getMRReviews(project_id, merge_request_id, cred);
                    const commits = await this.getMRCommits(project_id, merge_request_id, cred);
                    const sensitiveChanges = await this.identifySensitiveModuleChanges(project_id, merge_request_id, cred);
                    const testCoverage = await this.checkTestCoverage(project_id, merge_request_id, cred);
                    const sourceBranch = mrData?.source_branch;
                    let jiraProjectId = null;
                    let sprintId = null;
                    let fixVersion = null;
                    let boardId = null;

                    // Check if we're using GitLab Issues (no Jira config but GitLab Issues cred exists)
                    const isGitLabProject = !jiraConfig && gitLabIssuesCred;

                    if (isGitLabProject) {
                        // For GitLab Issues: Extract issue number from title (e.g., "#123", "123", "issue #123")
                        const gitlabIssueMatch = title.match(/#?(\d+)/);
                        const gitlabIssueId = gitlabIssueMatch ? gitlabIssueMatch[1] : null;
                        
                        if (gitlabIssueId) {
                            // Look up by issueId for GitLab issues
                            const gitlabIssues = await IssueModel.find({ 
                                issueId: gitlabIssueId, 
                                companyId, 
                                boardId: board._id 
                            }).sort({ createdAt: -1 });
                            
                            if (gitlabIssues.length > 0) {
                                jiraProjectId = gitlabIssues[0].projectId;
                                boardId = gitlabIssues[0].boardId;
                                // sprintId can be an array or single value
                                sprintId = Array.isArray(gitlabIssues[0].sprintId) 
                                    ? gitlabIssues[0].sprintId[0] 
                                    : gitlabIssues[0].sprintId;
                                fixVersion = gitlabIssues[0].fixVersion;
                            }
                        }
                        
                        // Fallback: Use the projectId parameter or board's projectId
                        if (!jiraProjectId) {
                            jiraProjectId = projectId || board.projectId;
                            boardId = board._id;
                        }
                    } else {
                        // Original Jira logic
                        const baseMatch = title.match(/(?:^|\[)([A-Za-z]+-\d+)/i);
                        const issueKey = baseMatch ? baseMatch[1].toUpperCase() : null;
                        const issueKeyMatch = issueKey ? issueKey.match(/^[A-Za-z]+/) : null;
                        const extractedProjectKey = issueKeyMatch ? issueKeyMatch[0] : 'No match';
                        const boardProjects = await Project.find({ companyId, key: extractedProjectKey });
                        const kanbanBoard = boardProjects.find((board) => board?.boardType?.toLowerCase?.() === 'kanban');
                        IssueModel = kanbanBoard && kanbanBoard.boardType === 'kanban' ? KanbanIssue : SprintIssue;
                        
                        const Board = await IssueModel.find({ key: issueKey, companyId, boardId: board._id }).sort({ createdAt: -1 });

                        if (Board.length > 0) {
                            jiraProjectId = Board[0].projectId;
                            boardId = Board[0].boardId;
                            sprintId = Board[0].sprintId;
                            fixVersion = Board[0].fixVersion;
                        }
                    }
                    return {
                        ...mrData,
                        reviews,
                        commits,
                        sensitiveChanges,
                        testCoverage,
                        linesAdded: commits.linesAdded,
                        linesDeleted: commits.linesDeleted,
                        projectId: jiraProjectId,
                        boardId: boardId,
                        sprintId,
                        fixVersion,
                        sourceBranch,
                        repo: (repoMap[project_id] && repoMap[project_id].split('/').pop()) || 'Unknown Repo',
                    };
                })
            );

            const mrDataArray = detailedMRs.filter((mr) => mr.status === 'fulfilled').map((mr) => mr.value);

            const bulkOps = mrDataArray.map((mrData) => ({
                updateOne: {
                    filter: { prId: mrData?.id },
                    update: {
                        $set: {
                            companyId,
                            projectId: mrData?.projectId,
                            boardId: mrData?.boardId,
                            sprintId: mrData?.sprintId,
                            fixVersion: mrData?.fixVersion,
                            repo: mrData?.repo,
                            title: mrData?.title,
                            status: mrData?.state,
                            prCreatedAt: mrData?.created_at,
                            prClosedAt: mrData?.closed_at,
                            prMergedAt: mrData?.merged_at,
                            prCreatedBy: mrData?.author.name,
                            prMergedBy: mrData.merged_by ? mrData.merged_by.username : null,
                            filesChanged: mrData?.changes_count ?? 0,
                            linesAdded: mrData?.totalAdditions ?? 0,
                            linesDeleted: mrData?.totalDeletions ?? 0,
                            reviewComments: mrData?.reviews?.length ?? 0,
                            mergeable: mrData?.merge_status,
                            merged: mrData?.state,
                            prNumber: mrData?.iid,
                            hasSensitiveChanges: mrData.sensitiveChanges.hasSensitiveChanges,
                            sensitiveFiles: mrData.sensitiveChanges.sensitiveFiles,
                            branchName: mrData?.sourceBranch ?? '',
                            missingTests: {
                                hasMissingTests: mrData.testCoverage.hasMissingTests,
                                codeFilesChanged: mrData.testCoverage.codeFilesChanged,
                                testFilesChanged: mrData.testCoverage.testFilesChanged,
                            },
                            reviews: mrData?.reviews?.flatMap((review) =>
                                review.notes.map((note) => ({
                                    reviewerId: note.author.id,
                                    reviewerUsername: note.author.username,
                                    reviewState: note.system ? 'system' : 'manual',
                                    reviewDate: note.created_at,
                                    reviewComment: note.body,
                                    reviewId: review.id,
                                    isLatest: false,
                                }))
                            ),
                            commits:
                                mrData?.commits?.map((commit) => ({
                                    commitId: commit?.id ?? '',
                                    message: commit?.message ?? '',
                                    committerName: commit?.committer_name ?? '',
                                    committerEmail: commit?.committer_email ?? '',
                                    date: commit?.committed_date ?? '',
                                })) ?? [],
                        },
                    },
                    upsert: true,
                },
            }));

            if (bulkOps.length > 0) {
                await PullRequest.bulkWrite(bulkOps);
            }

            return syncResult.successfulResults;
        } catch (error) {
            console.error(`Error Syncing GitLab Data for board ${board.boardName}...`, error.message);
            throw error;
        }
    }

    async syncGitLabRepos(uniqueIssueIds, jiraConfig, tenantConnection, IssueModel) {
        try {
            const validIssueIds = uniqueIssueIds.filter((issueId) => issueId !== undefined && issueId !== null);
            // const promises = validIssueIds.map((issueId) =>
            //     axios
            //         .get(`${jiraConfig.host}/rest/dev-status/1.0/issue/detail?issueId=${issueId}&applicationType=GitLab&dataType=branch`, {
            //             auth: {
            //                 username: jiraConfig.username,
            //                 password: jiraConfig.password,
            //             },
            //         })
            //         .then((response) => {
            //             let repoUrl = null;
            //             let repoId = null;
            //             const detail = response.data?.detail?.[0];

            //             if (detail) {
            //                 if (detail.branches && detail.branches.length > 0) {
            //                     repoUrl = detail.branches[0].repository?.url || null;
            //                     repoId = detail.branches[0].repository?.id || null;
            //                 }
            if (validIssueIds.length === 0) {
                return { successfulResults: [] };
            }

            // Fetch issues with their repoCreated flag
            const issues = await IssueModel.find({ issueId: { $in: validIssueIds } })
                .select('issueId repoCreated projectId projectKeyId')
                .lean();

            // Create a map for quick lookup
            const issueMap = new Map();
            issues.forEach(issue => {
                issueMap.set(issue.issueId, issue);
            });

            // Filter out issues that already have repoCreated = true
            const issuesNeedingSync = validIssueIds.filter((issueId) => {
                const issue = issueMap.get(issueId);
                return !issue || !issue.repoCreated;
            });
            // if (!repoUrl && detail.pullRequests && detail.pullRequests.length > 0) {
            //     repoUrl = detail.pullRequests[0].repositoryUrl || null;
            //     repoId = detail.pullRequests[0].repositoryId || null;
            const skippedCount = validIssueIds.length - issuesNeedingSync.length;

            // Important log: Show how many issues are being skipped
            if (skippedCount > 0) {
                console.info(`[GitLab] Skipping ${skippedCount} issues with repoCreated=true (avoiding Jira API calls)`);
            }

            if (issuesNeedingSync.length === 0) {
                console.info(`[GitLab] All ${validIssueIds.length} issues already have repoCreated flag set, skipping all Jira API calls`);
                return { successfulResults: [] };
            }

            console.info(`[GitLab] Processing ${issuesNeedingSync.length} issues via Jira API (${skippedCount} skipped)`);

            // Process requests in batches with rate limiting
            const BATCH_SIZE = 10; // Process 10 requests at a time
            const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches
            const successfulResults = [];
            const issuesToUpdate = [];
            let reposFound = 0;
            let apiErrors = 0;

            for (let i = 0; i < issuesNeedingSync.length; i += BATCH_SIZE) {
                const batch = issuesNeedingSync.slice(i, i + BATCH_SIZE);

                const batchPromises = batch.map((issueId) =>
                    axios
                        .get(`${jiraConfig.host}/rest/dev-status/1.0/issue/detail?issueId=${issueId}&applicationType=GitLab&dataType=branch`, {
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
                                if (detail.branches && detail.branches.length > 0) {
                                    repoUrl = detail.branches[0].repository?.url || null;
                                    repoId = detail.branches[0].repository?.id || null;
                                }

                                if (!repoUrl && detail.pullRequests && detail.pullRequests.length > 0) {
                                    repoUrl = detail.pullRequests[0].repositoryUrl || null;
                                    repoId = detail.pullRequests[0].repositoryId || null;
                                }
                            }
                            return { issueId, url: repoUrl, id: repoId };
                        })
                        .catch((error) => {
                            console.error(`[GitLab] Error fetching data for issueId ${issueId}:`, error.response?.status || 'N/A', error.message);
                            return { issueId, url: null, id: null };
                        })
                );

                const batchResults = await Promise.allSettled(batchPromises);

                batchResults.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        const resultValue = result.value;
                        successfulResults.push(resultValue);

                        // If repo was successfully found, mark issue for update
                        if (resultValue.url) {
                            issuesToUpdate.push(resultValue.issueId);
                            reposFound++;
                        }
                        //             return { issueId, url: repoUrl, id: repoId };
                        //         })
                        //         .catch((error) => {
                        //             console.error(`Error fetching data for issueId ${issueId}:`, error.message);
                        //             return { issueId, url: null };
                        //         })
                        // );
                    } else {
                        apiErrors++;
                        console.error(`[GitLab] Promise rejected for issueId ${batch[index]}:`, result.reason?.message || 'Unknown error');
                        successfulResults.push({ issueId: batch[index], url: null, id: null });
                    }
                });

                // const results = await Promise.allSettled(promises);
                if (i + BATCH_SIZE < issuesNeedingSync.length) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
                }
            }

            // Important log: Show how many repos were found and flags updated
            if (issuesToUpdate.length > 0) {
                const updateResult = await IssueModel.updateMany(
                    { issueId: { $in: issuesToUpdate } },
                    { $set: { repoCreated: true } }
                );
                console.info(`[GitLab] Updated ${updateResult.modifiedCount} issues with repoCreated=true (${reposFound} repos found)`);
            }

            // const successfulResults = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
            const Project = ProjectModel(tenantConnection);
            const bulkOperations = await Promise.all(
                successfulResults.map(async (obj) => {
                    const { issueId, url } = obj;
                    if (!url) {
                        return null;
                    }
                    // const sprintIssue = await IssueModel.findOne({ issueId });
                    // if (sprintIssue) {
                    const issue = issueMap.get(issueId);
                    if (issue && issue.projectId && issue.projectKeyId) {
                        return {
                            updateOne: {
                                // filter: { _id: sprintIssue.projectId, projectKeyId: sprintIssue.projectKeyId },
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
                // const Project = ProjectModel(tenantConnection);
                await Project.bulkWrite(validOperations);
            }
            // Important log: Final summary
            console.info(`[GitLab] syncGitLabRepos complete: ${skippedCount} skipped, ${issuesNeedingSync.length} processed, ${reposFound} repos found, ${apiErrors} errors`);
            return { successfulResults };
        } catch (error) {
            console.error('[GitLab] Error in syncGitLabRepos:', error.message);
            throw error;
        }
    }

    async syncGitLabReposForGitLabIssues(uniqueIssueIds, gitLabIssuesCred, tenantConnection, IssueModel, companyId, projectId) {
        try {
            const Project = ProjectModel(tenantConnection);
            const validIssueIds = uniqueIssueIds.filter((issueId) => issueId !== undefined && issueId !== null);
            
            if (validIssueIds.length === 0) {
                return { successfulResults: [] };
            }

            // Prepare GitLab config from credentials
            const decryptedToken = cryptoHandler(gitLabIssuesCred.password, 'decrypt');
            const gitlabConfig = {
                password: decryptedToken,
                username: gitLabIssuesCred.username || '',
            };
            const apiBase = GITLAB_API_BASE_URL;
            
            // Get all issues with their project information
            const issues = await IssueModel.find({
                companyId: typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId,
                issueId: { $in: validIssueIds },
                ...(projectId ? { projectId: typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId } : {}),
            })
                .select('issueId projectId projectKeyId customFields')
                .lean();

            // Get unique project IDs
            const projectIds = [...new Set(issues.map(issue => issue.projectId?.toString()).filter(Boolean))];
            
            // Fetch all projects to get repository information
            const projects = await Project.find({
                _id: { $in: projectIds.map(id => new Types.ObjectId(id)) },
                projectTypeKey: 'gitlab-project',
            })
                .select('_id projectKeyId repos key name self')
                .lean();

            // Create a map of projectId -> project info
            const projectMap = new Map();
            projects.forEach(project => {
                projectMap.set(project._id.toString(), project);
            });

            // Create a map to cache GitLab API project data (projectKeyId -> project data)
            const gitlabProjectCache = new Map();

            // Build syncResult for each issue
            const successfulResults = await Promise.all(issues.map(async (issue) => {
                const project = issue.projectId ? projectMap.get(issue.projectId.toString()) : null;
                
                let repoUrl = null;
                let repoId = null;

                if (project) {
                    // Use projectKeyId as the GitLab project ID
                    repoId = project.projectKeyId ? String(project.projectKeyId) : null;

                    // Try to get repository URL from project repos array first
                    if (project.repos && Array.isArray(project.repos) && project.repos.length > 0) {
                        repoUrl = project.repos[0];
                    }

                    // If no repo URL, fetch from GitLab API using projectKeyId
                    if (!repoUrl && repoId) {
                        try {
                            // Check cache first
                            if (!gitlabProjectCache.has(repoId)) {
                                // Fetch project details from GitLab API
                                const projectIdForApi = repoId;
                                const projectPath = encodeURIComponent(project.key || project.name || '');
                                
                                let projectResp;
                                try {
                                    projectResp = await axios.get(`${apiBase}/projects/${projectIdForApi}`, {
                                        headers: {
                                            Authorization: `Bearer ${gitlabConfig.password}`,
                                        },
                                    });
                                } catch (idError) {
                                    // If 403 or 404 with ID, try with path
                                    if ((idError.response?.status === 403 || idError.response?.status === 404) && projectPath) {
                                        projectResp = await axios.get(`${apiBase}/projects/${projectPath}`, {
                                            headers: {
                                                Authorization: `Bearer ${gitlabConfig.password}`,
                                            },
                                        });
                                    } else {
                                        throw idError;
                                    }
                                }
                                
                                const gitlabProject = projectResp.data;
                                gitlabProjectCache.set(repoId, gitlabProject);
                            }
                            
                            const gitlabProject = gitlabProjectCache.get(repoId);
                            // Get repository URL from GitLab API response
                            repoUrl = gitlabProject?.web_url || gitlabProject?.http_url_to_repo || gitlabProject?.ssh_url_to_repo || null;
                            
                            // If we got a URL from API, update the project repos array
                            if (repoUrl) {
                                await Project.updateOne(
                                    { _id: project._id },
                                    { $addToSet: { repos: repoUrl } }
                                );
                            }
                        } catch (apiError) {
                            console.warn(`[GitLab] Error fetching project ${repoId} from GitLab API:`, apiError.message);
                            // Fall back to constructing URL from project info
                        }
                    }

                    // If still no repo URL, try to construct from project info
                    if (!repoUrl && project.self) {
                        // Extract URL from self (GitLab project API URL)
                        const selfMatch = project.self.match(/https?:\/\/[^\\/]+\/(.+)/);
                        if (selfMatch) {
                            repoUrl = `https://gitlab.com/${selfMatch[1]}`;
                        }
                    }

                    // If still no URL, try to construct from key or name
                    if (!repoUrl && (project.key || project.name)) {
                        const projectPath = project.key || project.name;
                        repoUrl = `https://gitlab.com/${projectPath}`;
                    }
                }

                // Also check customFields for web_url (issue web URL, but might contain project info)
                if (!repoUrl && issue.customFields?.web_url) {
                    const webUrl = issue.customFields.web_url;
                    // Extract project path from issue web URL (e.g., https://gitlab.com/group/project/-/issues/123)
                    const urlMatch = webUrl.match(/https?:\/\/[^\\/]+\/([^\\/]+\/[^\\/]+)/);
                    if (urlMatch) {
                        repoUrl = `https://gitlab.com/${urlMatch[1]}`;
                    }
                }

                return {
                    issueId: issue.issueId,
                    url: repoUrl,
                    id: repoId,
                };
            }));

            return { successfulResults };
        } catch (error) {
            console.error('[GitLab] Error in syncGitLabReposForGitLabIssues:', error);
            const validIssueIds = uniqueIssueIds.filter((issueId) => issueId !== undefined && issueId !== null);
            return {
                successfulResults: validIssueIds.map(issueId => ({ issueId, url: null, id: null })),
            };
        }
    }

    async getMRReviews(project_id, merge_request_id, cred) {
        try {
            const response = await axios.get(`${GITLAB_API_BASE_URL}/projects/${project_id}/merge_requests/${merge_request_id}/discussions`, {
                headers: { 'Private-Token': cred.password },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching PR reviews:', error);
            throw error;
        }
    }
    async getMRCommits(project_id, merge_request_id, cred) {
        try {
            const response = await axios.get(`${GITLAB_API_BASE_URL}/projects/${project_id}/merge_requests/${merge_request_id}/commits`, {
                headers: { 'Private-Token': cred.password },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching MR commits:', error);
            throw error;
        }
    }
    async getMRByNumber(projectId, mrNumber, cred) {
        try {
            const mrResponse = await axios.get(`${GITLAB_API_BASE_URL}/projects/${encodeURIComponent(projectId)}/merge_requests/${mrNumber}`, {
                headers: { 'Private-Token': cred.password },
            });
            const commitSha = mrResponse.data.sha;
            if (!commitSha) {
                throw new Error('Commit SHA not found in the MR response');
            }
            const diffResponse = await axios.get(`${GITLAB_API_BASE_URL}/projects/${encodeURIComponent(projectId)}/repository/commits/${commitSha}/diff`, {
                headers: { 'Private-Token': cred.password },
            });
            let totalAdditions = 0;
            let totalDeletions = 0;

            diffResponse.data.forEach((file) => {
                if (file.diff) {
                    const additions = (file.diff.match(/\n\+/g) || []).length;
                    const deletions = (file.diff.match(/\n-/g) || []).length;
                    totalAdditions += additions;
                    totalDeletions += deletions;
                }
            });
            mrResponse.data.totalAdditions = totalAdditions;
            mrResponse.data.totalDeletions = totalDeletions;
            return mrResponse.data;
        } catch (error) {
            console.error('Error fetching merge request details:', error.response ? error.response.data : error.message);
            throw error;
        }
    }

    async getAllMergeRequests(cred, projectId, type, companyId, selectedProjectId, tenantConnection) {
        const mergeRequests = [];
        let page = 1;
        const perPage = 100;
        const maxRetries = 5;
        let attempt = 0;
        let lastSyncedDate;

        do {
            const params = {
                per_page: perPage,
                page: page,
            };

            if (type === 'light') {
                const Project = ProjectModel(tenantConnection);
                const project = await Project.findOne({ _id: selectedProjectId, companyId });
                const { lastSynced } = project;
                const lastSyncedDate = convertISTStringToUTCISOString(lastSynced);
                const updatedBefore = new Date().toISOString();
                params.updated_after = lastSyncedDate;
                params.updated_before = updatedBefore;
            } else {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 15);
                thirtyDaysAgo.setHours(0, 0, 0, 0);
                lastSyncedDate = new Date(thirtyDaysAgo).toISOString();
                params.updated_after = lastSyncedDate;
                const updatedBefore = new Date().toISOString();
                params.updated_before = updatedBefore;
            }

            while (attempt < maxRetries) {
                try {
                    const response = await axios.get(`${GITLAB_API_BASE_URL}/projects/${encodeURIComponent(projectId)}/merge_requests`, {
                        headers: { 'Private-Token': cred.password },
                        params,
                    });

                    mergeRequests.push(...response.data);

                    if (response.data.length < perPage) {
                        return mergeRequests;
                    }

                    page++;
                    attempt = 0;
                    break;
                } catch (error) {
                    if (error.response) {
                        console.error(`GitLab API error (status ${error.response.status}):`, JSON.stringify(error.response.data, null, 2));
                        const resetAt = error.response.headers['ratelimit-reset'];
                        if (resetAt) {
                            const waitTime = resetAt * 1000 - Date.now();
                            console.warn(`Rate limited. Retrying after ${waitTime / 1000} seconds...`);
                            await new Promise((resolve) => setTimeout(resolve, Math.max(waitTime, 0)));
                        } else {
                            const delay = Math.min(1000 * 2 ** attempt, 30000);
                            console.warn(`Request failed (Attempt ${attempt + 1}). Retrying in ${delay / 1000} seconds...`);
                            await new Promise((resolve) => setTimeout(resolve, delay));
                        }
                    } else {
                        console.error('Error fetching merge requests:', error.message);
                    }

                    attempt++;
                    if (attempt >= maxRetries) {
                        throw new Error('Max retries reached. Unable to fetch merge requests.');
                    }
                }
            }
        } while (true);
    }
    async identifySensitiveModuleChanges(projectId, mergeRequestId, cred) {
        try {
            const files = await this.getMRFiles(projectId, mergeRequestId, cred);
            const sensitivePatterns = [
                /^(auth|authentication|login|security|permissions|access-control|role|gitlab)/i,
                /^(payment|billing|checkout|finance|transaction)/i,
                /^(config\/security|infrastructure|deployment|system)/i,
                /^(user-data|pii|personal-info|gdpr)/i,
                /^(encryption|crypto|certificate)/i,
                /\.(cert|key|pem|env|secret)$/i,
                /^(config\/database|config\/connectionManager)/i,
                /^(\.env|\.config|config\.(js|ts|jsx|tsx)|settings\.(js|ts|jsx|tsx))$/i,
                /^(app|server|main|index)\.(js|ts|jsx|tsx)$/i,
                /^(middleware\/auth|middleware\/security)/i,
                /^(api\/auth|api\/payment|api\/admin|controllers\/admin)/i,
            ];

            const sensitiveFiles = files.filter((file) => {
                const filePath = file.new_path || file.path;
                return sensitivePatterns.some((pattern) => pattern.test(filePath));
            });

            return {
                hasSensitiveChanges: sensitiveFiles.length > 0,
                sensitiveFiles: sensitiveFiles.map((file) => ({
                    filename: file.new_path || file.path,
                    status: this.mapFileStatus(file),
                    additions: file.additions || 0,
                    deletions: file.deletions || 0,
                    changes: (file.additions || 0) + (file.deletions || 0),
                })),
                totalSensitiveFiles: sensitiveFiles.length,
            };
        } catch (error) {
            console.error(`Error identifying sensitive module changes for MR #${mergeRequestId} in project ${projectId}`, error.message);
            return {
                hasSensitiveChanges: false,
                sensitiveFiles: [],
                totalSensitiveFiles: 0,
                error: error.message,
            };
        }
    }

    mapFileStatus(file) {
        if (file.new_file) {
            return 'added';
        }
        if (file.deleted_file) {
            return 'removed';
        }
        if (file.renamed_file) {
            return 'renamed';
        }
        return 'modified';
    }

    async getMRFiles(projectId, mergeRequestId, cred) {
        try {
            const response = await axios.get(`${GITLAB_API_BASE_URL}/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestId}/changes`, {
                headers: { 'Private-Token': cred.password },
            });
            return response.data.changes || [];
        } catch (error) {
            console.error(`Error fetching files for MR #${mergeRequestId} in project ${projectId}`, error.message);
            return [];
        }
    }

    async checkTestCoverage(projectId, mergeRequestId, cred) {
        try {
            const files = await this.getMRFiles(projectId, mergeRequestId, cred);
            if (!files || files.length === 0) {
                return {
                    hasMissingTests: false,
                    codeFilesChanged: 0,
                    testFilesChanged: 0,
                    codeFiles: [],
                    testFiles: [],
                };
            }

            const testFilePatterns = [
                /\/tests?\//i,
                /\/__tests__\//i,
                /\.test\.[jt]sx?$/i,
                /\.spec\.[jt]sx?$/i,
                /Test\.java$/i,
                /Tests?\.java$/i,
                /_test\.[jt]sx?$/i,
                /test_.*\.[jt]sx?$/i,
                /.*tests?_.*\.[jt]sx?$/i,
                /.*specs?_.*\.[jt]sx?$/i,
                /\/jest\//i,
                /\/cypress\//i,
                /\/mocha\//i,
                /\/fixtures\//i,
                /\/mocks\//i,
                /\/stubs\//i,
            ];

            const codeFilePatterns = [
                /\.[jt]sx?$/i,
                /\.java$/i,
                /\.py$/i,
                /\.rb$/i,
                /\.php$/i,
                /\.go$/i,
                /\.cs$/i,
                /\.cpp$/i,
                /\.cc$/i,
                /\.c$/i,
                /\.h$/i,
                /\.swift$/i,
                /\.kt$/i,
                /\.rs$/i,
                /\.scala$/i,
            ];

            const ignorePatterns = [
                /\.md$/i,
                /\.txt$/i,
                /\.json$/i,
                /\.lock$/i,
                /\.yml$/i,
                /\.yaml$/i,
                /\.toml$/i,
                /\.ini$/i,
                /\.config$/i,
                /\.svg$/i,
                /\.png$/i,
                /\.jpe?g$/i,
                /\.gif$/i,
                /\.ico$/i,
                /\.min\.[jt]s$/i,
                /package\.json$/i,
                /package-lock\.json$/i,
                /yarn\.lock$/i,
                /\.gitlab\//i,
                /\.gitignore$/i,
                /README/i,
                /CHANGELOG/i,
                /LICENSE/i,
                /\/docs\//i,
            ];

            const codeFiles = [];
            const testFiles = [];

            for (const file of files) {
                const filename = file.new_path || file.path;
                if (ignorePatterns.some((pattern) => pattern.test(filename))) {
                    continue;
                }
                if (testFilePatterns.some((pattern) => pattern.test(filename))) {
                    testFiles.push(filename);
                    continue;
                }
                if (codeFilePatterns.some((pattern) => pattern.test(filename))) {
                    codeFiles.push(filename);
                }
            }
            const codeFilesChanged = codeFiles.length;
            const testFilesChanged = testFiles.length;
            const hasMissingTests = codeFilesChanged > 0 && testFilesChanged === 0;

            return {
                hasMissingTests,
                codeFilesChanged,
                testFilesChanged,
            };
        } catch (error) {
            console.error(`Error checking test coverage for MR #${mergeRequestId} in project ${projectId}`, error.message);
            return {
                hasMissingTests: false,
                codeFilesChanged: 0,
                testFilesChanged: 0,
                error: error.message,
            };
        }
    }
}

export default new SyncGitLabService();
