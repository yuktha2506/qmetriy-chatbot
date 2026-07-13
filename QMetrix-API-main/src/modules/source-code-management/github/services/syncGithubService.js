import 'dotenv/config';
import axios from 'axios';
import { PullRequestModel } from '../model.js';
import { ProjectModel, SprintIssueModel, BoardIssueModel, SprintModel, JiraReleaseModel, BoardModel } from '../../../project-management/jira/model.js';
import { ConnectionModel } from '../../../connection/model.js';
import doraMetricController from '../controllers/doraMetricController.js';
import { cryptoHandler } from '../../../../utils/commonFunctions.js';
import { convertISTStringToUTCISOString } from '../../../../utils/commonFunctions.js';
import { PROVIDER_NAME_GITHUB, PROVIDER_NAME_JIRA } from '../../../../utils/constants/providerConstants.js';
import { STATUS_ACTIVE, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';
import { extractLeadingJiraIssueKeyFromPrTitle } from '../../utils/extractJiraIssueKeyFromPrTitle.js';

const _rawLightLookback = process.env.GITHUB_LIGHT_SYNC_PR_LOOKBACK_DAYS;
const _parsedLightLookback = _rawLightLookback === undefined || _rawLightLookback === '' ? 30 : Number.parseInt(String(_rawLightLookback), 10);
const GITHUB_LIGHT_SYNC_PR_LOOKBACK_DAYS = Number.isFinite(_parsedLightLookback)
    ? Math.min(90, Math.max(14, _parsedLightLookback))
    : 30;

class SyncGithubService {
    async syncGithub(companyId, tenantConnection, type, projectId) {
        const Connection = ConnectionModel(tenantConnection);
        const gitCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITHUB });
        const jiraCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_JIRA });

        if (!jiraCred) {
            return { error: 'Jira connection not found for this company.' };
        }

        const decryptedPassword = cryptoHandler(jiraCred.password, 'decrypt');
        const jiraConfig = { host: jiraCred.host, username: jiraCred.username, password: decryptedPassword,name: jiraCred.name };

        if (!gitCred) {
            console.error('GitHub connection not found for this company.');
            return { warning: 'GitHub connection not found for this company. Sync skipped.' };
        }

        const decryptedGitPassword = cryptoHandler(gitCred.password, 'decrypt');
        const githubConfig = { host: gitCred.host, username: gitCred.username, password: decryptedGitPassword };

        try {
            await this.syncGitHub(githubConfig, companyId, tenantConnection, jiraConfig, type, projectId);
        } catch (error) {
            console.error('Error during GitHub sync:', error.message);
            throw error;
        }

        try {
            await doraMetricController.calculateDoraMetrics(companyId, tenantConnection, projectId, type);
        } catch (error) {
            console.error('Error during DoraMetrics sync:', error.message);
            throw error;
        }
    }

    async overridePRsToActiveSprintOnFirstDay(cred, companyId, tenantConnection, activeSprintMap, projectId) {
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
            const boardId = matchingIssue?.boardId;
            const newSprintId = activeSprintMap[projectId];

            if (!newSprintId) {
                continue;
            }

            const currentSprintIds = Array.isArray(pr.sprintId) ? pr.sprintId.map((id) => id.toString()) : [pr.sprintId?.toString()];

            if (currentSprintIds.includes(newSprintId.toString())) {
                continue;
            }

            // Fetch latest PR details from GitHub (same as new PR sync)
            let latestPRData = null;
            let latestReviews = [];
            let latestCommits = [];
            let latestPRFiles = [];
            let sensitiveChanges = { hasSensitiveChanges: false, sensitiveFiles: [] };
            let testCoverage = { hasMissingTests: false, codeFilesChanged: 0, testFilesChanged: 0 };
            
            try {
                latestPRData = await this.getPRByNumber(cred, pr.repo, pr.prNumber);
                latestReviews = await this.getPRReviews(cred, pr.repo, pr.prNumber);
                latestCommits = await this.getPRCommits(cred, pr.repo, pr.prNumber);
                latestPRFiles = await this.getPRFiles(cred, pr.repo, pr.prNumber);
                sensitiveChanges = await this.identifySensitiveModuleChanges(latestPRFiles);
                testCoverage = await this.checkTestCoverage(latestPRFiles);
            } catch (error) {
                console.error(`Error fetching latest PR details for PR #${pr.prNumber} in repo ${pr.repo}:`, error.message);
            }

            const updateData = {
                sprintId: newSprintId,
                boardId: boardId,
            };

            if (latestPRData) {
                updateData.title = latestPRData.title;
                updateData.status = latestPRData.state;
                updateData.prCreatedAt = latestPRData.created_at;
                updateData.prClosedAt = latestPRData.closed_at;
                updateData.prMergedAt = latestPRData.merged_at;
                updateData.prCreatedBy = latestPRData.user?.login;
                updateData.prMergedBy = latestPRData.merged_by ? latestPRData.merged_by.login : null;
                updateData.filesChanged = latestPRData.changed_files;
                updateData.linesAdded = latestPRData.additions;
                updateData.linesDeleted = latestPRData.deletions;
                updateData.reviewComments = latestPRData.review_comments;
                updateData.mergeable = latestPRData.mergeable;
                updateData.merged = latestPRData.merged;
                updateData.branchName = latestPRData.head?.ref;
                
                if (latestReviews && latestReviews.length > 0) {
                    updateData.reviews = latestReviews.map((review) => ({
                        reviewerId: review.user?.id?.toString(),
                        reviewerUsername: review.user?.login,
                        reviewState: review.state,
                        reviewDate: review.submitted_at,
                        reviewComment: review.body,
                        reviewId: review.id?.toString(),
                        isLatest: review.isLatest || false,
                    }));
                }
                
                if (latestCommits && latestCommits.length > 0) {
                    updateData.commits = latestCommits.map((commit) => ({
                        commitId: commit.sha,
                        message: commit.commit?.message,
                        committerName: commit.commit?.committer?.name,
                        committerEmail: commit.commit?.committer?.email,
                        date: commit.commit?.author?.date,
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
                title: latestPRData?.title || pr.title,
                matchedKey,
                newSprintId,
                boardId,
            });
        }

        if (bulkOps.length > 0) {
            await PullRequest.bulkWrite(bulkOps);
        } else {
            console.warn('No PRs needed sprint override today.');
        }
    }

    async overridePRsToUnreleasedOnFirstDay(cred, companyId, tenantConnection, unreleasedFixVersionMap, projectId) {
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

            let latestPRData = null;
            let latestReviews = [];
            let latestCommits = [];
            let latestPRFiles = [];
            let sensitiveChanges = { hasSensitiveChanges: false, sensitiveFiles: [] };
            let testCoverage = { hasMissingTests: false, codeFilesChanged: 0, testFilesChanged: 0 };
            
            try {
                latestPRData = await this.getPRByNumber(cred, pr.repo, pr.prNumber);
                latestReviews = await this.getPRReviews(cred, pr.repo, pr.prNumber);
                latestCommits = await this.getPRCommits(cred, pr.repo, pr.prNumber);
                latestPRFiles = await this.getPRFiles(cred, pr.repo, pr.prNumber);
                sensitiveChanges = await this.identifySensitiveModuleChanges(latestPRFiles);
                testCoverage = await this.checkTestCoverage(latestPRFiles);
            } catch (error) {
                console.error(`Error fetching latest PR details for PR #${pr.prNumber} in repo ${pr.repo}:`, error.message);
            }

            const updateData = {
                fixVersion: newFixVersion,
                boardId: boardId,
            };

            if (latestPRData) {
                updateData.title = latestPRData.title;
                updateData.status = latestPRData.state;
                updateData.prCreatedAt = latestPRData.created_at;
                updateData.prClosedAt = latestPRData.closed_at;
                updateData.prMergedAt = latestPRData.merged_at;
                updateData.prCreatedBy = latestPRData.user?.login;
                updateData.prMergedBy = latestPRData.merged_by ? latestPRData.merged_by.login : null;
                updateData.filesChanged = latestPRData.changed_files;
                updateData.linesAdded = latestPRData.additions;
                updateData.linesDeleted = latestPRData.deletions;
                updateData.reviewComments = latestPRData.review_comments;
                updateData.mergeable = latestPRData.mergeable;
                updateData.merged = latestPRData.merged;
                updateData.branchName = latestPRData.head?.ref;
                
                if (latestReviews && latestReviews.length > 0) {
                    updateData.reviews = latestReviews.map((review) => ({
                        reviewerId: review.user?.id?.toString(),
                        reviewerUsername: review.user?.login,
                        reviewState: review.state,
                        reviewDate: review.submitted_at,
                        reviewComment: review.body,
                        reviewId: review.id?.toString(),
                        isLatest: review.isLatest || false,
                    }));
                }
                
                if (latestCommits && latestCommits.length > 0) {
                    updateData.commits = latestCommits.map((commit) => ({
                        commitId: commit.sha,
                        message: commit.commit?.message,
                        committerName: commit.commit?.committer?.name,
                        committerEmail: commit.commit?.committer?.email,
                        date: commit.commit?.author?.date,
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
                title: latestPRData?.title || pr.title,
                matchedKey,
                newFixVersion,
                boardId,
            });
        }

        if (bulkOps.length > 0) {
            await PullRequest.bulkWrite(bulkOps);
        } else {
            console.warn('No PRs needed unreleased override today.');
        }
    }

    async syncGitHub(cred, companyId, tenantConnection, jiraConfig, type, projectId) {
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
                const boardResult = await this.syncGitHubForBoard(
                    cred, 
                    companyId, 
                    tenantConnection, 
                    jiraConfig, 
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
            console.error('Error Syncing GitHub Data...', error.message);
            throw error;
        }
    }

    async syncGitHubForBoard(cred, companyId, tenantConnection, jiraConfig, type, projectId, board, PullRequest, Sprint, JiraRelease, SprintIssue, KanbanIssue, Project) {
        try {
            const boardTypeLower = (board.boardType || '').toLowerCase();
            const isKanban = boardTypeLower === 'kanban';
            const isSimple = boardTypeLower === 'simple';
            const IssueModel = isKanban ? KanbanIssue : SprintIssue;

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

                    const kanbanIssues = await IssueModel.find({ companyId, projectId, boardId: board._id,fixVersion: { $in: fixVersionNames } }).lean();

                    issueIds = kanbanIssues.map((i) => i.issueId);
                } else if (isSimple) {
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
                            { releaseDate: { $gte: threeDaysAgo } },
                        ],
                    }, { releaseName: 1 }).lean();

                    const fixVersionNames = unreleasedFixVersions.map((fv) => fv.releaseName);

                    const activeSprints = await Sprint.find({ companyId, projectId, state: STATUS_ACTIVE }, { _id: 1 }).lean();
                    const activeSprintIds = activeSprints.map((s) => s._id);

                    const [sprintIssuesLight, kanbanIssuesLight] = await Promise.all([
                        SprintIssue.find({
                            companyId,
                            projectId,
                            boardId: board._id,
                            sprintId: { $in: activeSprintIds },
                        }).lean(),
                        KanbanIssue.find({
                            companyId,
                            projectId,
                            boardId: board._id,
                            fixVersion: { $in: fixVersionNames },
                        }).lean(),
                    ]);
                    issueIds = [
                        ...sprintIssuesLight.map((i) => i.issueId),
                        ...kanbanIssuesLight.map((i) => i.issueId),
                    ];
                } else {
                    const activeSprints = await Sprint.find({ companyId, projectId, state: STATUS_ACTIVE }, { _id: 1 }).lean();
                    const activeSprintIds = activeSprints.map((s) => s._id);

                    const sprintIssues = await IssueModel.find({ companyId, projectId, boardId: board._id,sprintId: { $in: activeSprintIds } }).lean();

                    issueIds = sprintIssues.map((i) => i.issueId);
                }
            } else if (isSimple) {
                const [sprintIssuesFull, kanbanIssuesFull] = await Promise.all([
                    SprintIssue.find({ companyId, projectId, boardId: board._id }).lean(),
                    KanbanIssue.find({ companyId, projectId, boardId: board._id }).lean(),
                ]);
                issueIds = [
                    ...sprintIssuesFull.map((i) => i.issueId),
                    ...kanbanIssuesFull.map((i) => i.issueId),
                ];
            } else {
                const issues = await IssueModel.find({ companyId, projectId, boardId: board._id }).lean();                
                issueIds = issues.map((i) => i.issueId);                
            }

            const uniqueIssueIds = [...new Set(issueIds)];
            if (uniqueIssueIds.length === 0) {
                console.warn('[GitHubSync] no issue IDs — skipping board', board.boardName);
                return [];
            }

            const syncResult = await this.syncGithubRepos(uniqueIssueIds, jiraConfig, tenantConnection);            
            const repoUrls = [...new Set(syncResult.successfulResults.filter((result) => result.url).map((result) => result.url))];

            if (repoUrls.length === 0) {
                console.warn(`[GitHubSync] No repository URLs from Jira dev-status for board ${board.boardName}`);
                return [];
            }

            const repos = repoUrls
                .map((url) => {
                    const match = url.match(/github\.com\/[^/]+\/([^/]+)/);
                    return {
                        name: match ? match[1] : null,
                        url: url,
                    };
                })
                .filter((repo) => repo.name);

            let lastSyncedDate;
            let projectLastSyncedUtc = null;

            if (type === 'light') {
                const project = await Project.findOne({ _id: projectId, companyId });
                const { lastSynced } = project;
                projectLastSyncedUtc = await convertISTStringToUTCISOString(lastSynced);
                const lookbackMs = Date.now() - GITHUB_LIGHT_SYNC_PR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
                const fromProjectMs = new Date(projectLastSyncedUtc).getTime();
                lastSyncedDate = new Date(Math.min(fromProjectMs, lookbackMs)).toISOString();
            } else {
                const now = new Date();
                lastSyncedDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 15)).toISOString();
            }
            const allPRs = await Promise.all(repos.map((repo) => this.getAllPRs(cred, repo.name, lastSyncedDate)));
            const prDetails = allPRs.flatMap((prList) =>
                prList.map((prData) => ({
                    number: prData.number,
                    repo: prData.base.repo.name,
                    title: prData.title,
                }))
            );

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
                await this.overridePRsToActiveSprintOnFirstDay(cred, companyId, tenantConnection, activeSprintMap, projectId);
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
                await this.overridePRsToUnreleasedOnFirstDay(cred, companyId, tenantConnection, unreleasedFixVersionMap, projectId);
            }

            const detailedPRs = await Promise.all(
                prDetails.map(async ({ number, repo, title }) => {
                    const prData = await this.getPRByNumber(cred, repo, number);
                    const reviews = await this.getPRReviews(cred, repo, number);
                    const commits = await this.getPRCommits(cred, repo, number);
                    const prFiles = await this.getPRFiles(cred, repo, number);
                    const sensitiveChanges = await this.identifySensitiveModuleChanges(prFiles);
                    const testCoverage = await this.checkTestCoverage(prFiles);

                    const issueKey = extractLeadingJiraIssueKeyFromPrTitle(title || '');
                    const issueKeyMatch = issueKey ? issueKey.match(/^[A-Za-z]+/) : null;
                    const extractedProjectKey = issueKeyMatch ? issueKeyMatch[0] : 'No match';

                    const boardProjects = await Project.find({ companyId, key: extractedProjectKey });
                    const scrumBoard = boardProjects.find((b) => b?.boardType?.toLowerCase?.() === 'scrum');

                    let projectId = null;
                    let sprintId = null;
                    let fixVersion = null;
                    let boardId = null;

                    const syncBoardTypeLower = (board.boardType || '').toLowerCase();
                    let Board = [];
                    if (issueKey) {
                        if (syncBoardTypeLower === 'simple') {
                            const [sprintHits, kanbanHits] = await Promise.all([
                                SprintIssue.find({ key: issueKey, companyId, boardId: board._id }).sort({ createdAt: -1 }).limit(1),
                                KanbanIssue.find({ key: issueKey, companyId, boardId: board._id }).sort({ createdAt: -1 }).limit(1),
                            ]);
                            const sprintDoc = sprintHits[0];
                            const kanbanDoc = kanbanHits[0];
                            if (sprintDoc && kanbanDoc) {
                                const sprintAt = new Date(sprintDoc.createdAt || 0);
                                const kanbanAt = new Date(kanbanDoc.createdAt || 0);
                                Board = sprintAt >= kanbanAt ? [sprintDoc] : [kanbanDoc];
                            } else if (sprintDoc) {
                                Board = [sprintDoc];
                            } else if (kanbanDoc) {
                                Board = [kanbanDoc];
                            }
                        } else {
                            const issueModelForLookup =
                                scrumBoard && scrumBoard.boardType === 'scrum' ? SprintIssue : KanbanIssue;
                            Board = await issueModelForLookup
                                .find({ key: issueKey, companyId, boardId: board._id })
                                .sort({ createdAt: -1 });
                        }
                    }

                    if (Board.length > 0) {
                        projectId = Board[0].projectId;
                        boardId = Board[0].boardId;
                        const originalSprintId = Board[0].sprintId;
                        fixVersion = Board[0].fixVersion;

                        if (projectId && activeSprintMap[projectId]) {
                            const activeSprintId = activeSprintMap[projectId];
                            if (originalSprintId?.toString() !== activeSprintId?.toString()) {
                                sprintId = activeSprintId;
                            } else {
                                sprintId = originalSprintId;
                            }
                        } else {
                            sprintId = originalSprintId;
                        }
                    }

                    return {
                        ...prData,
                        reviews,
                        commits,
                        sensitiveChanges,
                        testCoverage,
                        projectId,
                        boardId,
                        fixVersion,
                        sprintId,
                    };
                })
            );

            const bulkOps = detailedPRs.map((prData) => ({
                updateOne: {
                    filter: { prId: prData.id },
                    update: {
                        $set: {
                            companyId,
                            projectId: prData.projectId,
                            boardId: prData.boardId,
                            sprintId: prData.sprintId,
                            fixVersion: prData.fixVersion,
                            repo: prData.base.repo.name,
                            title: prData.title,
                            status: prData.state,
                            prCreatedAt: prData.created_at,
                            prClosedAt: prData.closed_at,
                            prMergedAt: prData.merged_at,
                            prCreatedBy: prData.user.login,
                            prMergedBy: prData.merged_by ? prData.merged_by.login : null,
                            filesChanged: prData.changed_files,
                            linesAdded: prData.additions,
                            linesDeleted: prData.deletions,
                            reviewComments: prData.review_comments,
                            mergeable: prData.mergeable,
                            merged: prData.merged,
                            prNumber: prData.number,
                            hasSensitiveChanges: prData.sensitiveChanges.hasSensitiveChanges,
                            sensitiveFiles: prData.sensitiveChanges.sensitiveFiles,
                            missingTests: {
                                hasMissingTests: prData.testCoverage.hasMissingTests,
                                codeFilesChanged: prData.testCoverage.codeFilesChanged,
                                testFilesChanged: prData.testCoverage.testFilesChanged,
                            },
                            branchName: prData.head.ref,
                            reviews: prData.reviews.map((review) => ({
                                reviewerId: review.user.id,
                                reviewerUsername: review.user.login,
                                reviewState: review.state,
                                reviewDate: review.submitted_at,
                                reviewComment: review.body,
                                reviewId: review.id,
                                isLatest: review.isLatest || false,
                            })),
                            commits: prData.commits.map((commit) => ({
                                commitId: commit.sha,
                                message: commit.commit.message,
                                committerName: commit.commit.committer.name,
                                committerEmail: commit.commit.committer.email,
                                date: commit.commit.author.date,
                            })),
                        },
                    },
                    upsert: true,
                },
            }));

            if (bulkOps.length > 0) {
                await PullRequest.bulkWrite(bulkOps);
            } else {
                console.warn('[GitHubSync] no bulkWrite ops (no PRs to persist)', { board: board.boardName });
            }

            return syncResult.successfulResults;
        } catch (error) {
            console.error(`Error Syncing GitHub Data for board ${board.boardName}...`, error.message);
            throw error;
        }
    }

    async syncGithubRepos(uniqueIssueIds, cred, tenantConnection) {
        try {
            const promises = uniqueIssueIds.map((issueId) =>
                axios
                    .get(`${cred.host}/rest/dev-status/1.0/issue/detail?issueId=${issueId}&applicationType=GitHub&dataType=repository`, {
                        auth: {
                            username: cred.username,
                            password: cred.password,
                        },
                    })
                    .then((response) => ({
                        issueId,
                        url: response.data?.detail[0]?.repositories[0]?.url,
                    }))
            );

            const results = await Promise.allSettled(promises);
            const successfulResults = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);

            const SprintIssue = SprintIssueModel(tenantConnection);
            const KanbanIssue = BoardIssueModel(tenantConnection);
            const bulkOperations = await Promise.all(
                successfulResults.map(async (obj) => {
                    const { issueId, url } = obj;
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
            console.error('Error Syncing GitHub Repository Data...', error.message);
            throw error;
        }
    }
    async getPRReviews(cred, repo, prNumber) {
        try {
            const response = await axios.get(`https://api.github.com/repos/${cred.host}/${repo}/pulls/${prNumber}/reviews`, {
                headers: {
                    Authorization: `Bearer ${cred.password}`,
                },
            });
            return response.data;
        } catch (error) {
            console.error(`Error fetching PR Reviews for PR #${prNumber} in repo ${repo}`, error.message);
            throw error;
        }
    }
    async getPRCommits(cred, repo, prNumber) {
        try {
            const commits = [];
            let page = 1;
            const perPage = 100;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const response = await axios.get(`https://api.github.com/repos/${cred.host}/${repo}/pulls/${prNumber}/commits`, {
                    headers: {
                        Authorization: `Bearer ${cred.password}`,
                    },
                    params: {
                        per_page: perPage,
                        page: page,
                    },
                });
                commits.push(...response.data);

                if (response.data.length < perPage) {
                    break;
                }
                page++;
            }

            return commits;
        } catch (error) {
            console.error(`Error fetching commits for PR #${prNumber} in repo ${repo}`, error.message);
            throw error;
        }
    }
    async getPRByNumber(cred, repo, prNumber) {
        try {
            const response = await axios.get(`https://api.github.com/repos/${cred.host}/${repo}/pulls/${prNumber}`, {
                headers: {
                    Authorization: `Bearer ${cred.password}`,
                },
            });
            return response.data;
        } catch (error) {
            console.error(`Error fetching PR by number for PR #${prNumber} in repo ${repo}`, error.message);
            throw error;
        }
    }
    async getAllPRs(cred, repo, lastSyncedDate) {
        try {
            const prList = [];
            let page = 1;
            const perPage = 100;

            // eslint-disable-next-line no-constant-condition
            while (true) {
                const response = await axios.get(`https://api.github.com/repos/${cred.host}/${repo}/pulls`, {
                    headers: {
                        Authorization: `Bearer ${cred.password}`,
                    },
                    params: {
                        state: 'all',
                        per_page: perPage,
                        page: page,
                    },
                });
                
                const filteredPRs = response.data.filter((pr) => {
                    const updatedAt = new Date(pr.updated_at).toISOString();
                    const currentDate = new Date().toISOString();
                    const isValid = updatedAt >= lastSyncedDate && updatedAt <= currentDate;
                    return isValid;
                });
                prList.push(...filteredPRs);
                if (response.data.length < perPage) {
                    break;
                }
                page++;
            }
            return prList;
        } catch (error) {
            console.error('Error fetching PRs...', error.message);
            throw error;
        }
    }
    async getPRFiles(cred, repo, prNumber) {
        try {
            const response = await axios.get(`https://api.github.com/repos/${cred.host}/${repo}/pulls/${prNumber}/files`, {
                headers: {
                    Authorization: `Bearer ${cred.password}`,
                },
            });
            return response.data;
        } catch (error) {
            console.error(`Error fetching files for PR #${prNumber} in repo ${repo}`, error.message);
            throw error;
        }
    }

    async identifySensitiveModuleChanges(files) {
        try {
            const sensitivePatterns = [
                /^(auth|authentication|login|security|permissions|access-control|role|github)/i,
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
                const filePath = file.filename;
                return sensitivePatterns.some((pattern) => pattern.test(filePath));
            });

            return {
                hasSensitiveChanges: sensitiveFiles.length > 0,
                sensitiveFiles: sensitiveFiles.map((file) => ({
                    filename: file.filename,
                    status: file.status,
                    additions: file.additions,
                    deletions: file.deletions,
                    changes: file.changes,
                })),
            };
        } catch (error) {
            console.error('Error identifying sensitive module changes', error.message);
            return {
                hasSensitiveChanges: false,
                sensitiveFiles: [],
                error: error.message,
            };
        }
    }

    async checkTestCoverage(files) {
        try {
            if (files.length === 0) {
                return {
                    hasMissingTests: false,
                    codeFilesChanged: 0,
                    testFilesChanged: 0,
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
                /\.github\//i,
                /\.gitignore$/i,
                /README/i,
                /CHANGELOG/i,
                /LICENSE/i,
                /\/docs\//i,
            ];

            const codeFiles = [];
            const testFiles = [];

            for (const file of files) {
                const filename = file.filename;
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
            console.error('Error checking test coverage', error.message);
            return {
                hasMissingTests: false,
                codeFilesChanged: 0,
                testFilesChanged: 0,
                error: error.message,
            };
        }
    }
}

export default new SyncGithubService();
