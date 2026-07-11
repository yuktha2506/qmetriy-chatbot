import 'dotenv/config';
import axios from 'axios';
import { ConnectionModel } from '../../../connection/model.js';
import { PullRequestModel } from '../../github/model.js';
import { ProjectModel, SprintIssueModel, BoardIssueModel, SprintModel, JiraReleaseModel, BoardModel } from '../../../project-management/jira/model.js';
import { cryptoHandler } from '../../../../utils/commonFunctions.js';
import { convertISTStringToUTCISOString } from '../../../../utils/commonFunctions.js';
import { PROVIDER_NAME_BITBUCKET, PROVIDER_NAME_JIRA } from '../../../../utils/constants/providerConstants.js';
import { STATUS_ACTIVE, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';

class SyncBitbucketService {
    async syncBitbucket(companyId, tenantConnection, type, projectId) {
        const Connection = ConnectionModel(tenantConnection);
        const bitbucketCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_BITBUCKET });
        const jiraCred = await Connection.findOne({ companyId, name: PROVIDER_NAME_JIRA });

        if (!jiraCred) {
            return { error: 'Jira connection not found for this company.' };
        }

        const decryptedPassword = cryptoHandler(jiraCred.password, 'decrypt');
        const jiraConfig = { host: jiraCred.host, username: jiraCred.username, password: decryptedPassword, name: jiraCred.name };

        if (!bitbucketCred) {
            console.error('Bitbucket connection not found for this company.');
            return { warning: 'Bitbucket connection not found for this company. Sync skipped.' };
        }

        const decryptedBitbucketPassword = cryptoHandler(bitbucketCred.password, 'decrypt');
        const bitbucketConfig = { username: bitbucketCred.username, password: decryptedBitbucketPassword };

        try {
            await this.syncBitbucketData(bitbucketConfig, companyId, tenantConnection, jiraConfig, type, projectId);
        } catch (error) {
            console.error('Error during Bitbucket sync:', error.message);
            throw error;
        }
    }

    async syncBitbucketData(cred, companyId, tenantConnection, jiraConfig, type, projectId) {
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
                const boardResult = await this.syncBitbucketForBoard(
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
            console.error('Error Syncing Bitbucket Data...', error.message);
            throw error;
        }
    }

    async syncBitbucketForBoard(cred, companyId, tenantConnection, jiraConfig, type, projectId, board, PullRequest, Sprint, JiraRelease, SprintIssue, KanbanIssue, Project) {
        try {

            // Match syncJiraService: KanbanIssue when kanban, or scrum/simple with no sprints on this board (release-style / team-managed).
            const boardTypeLower = (board.boardType || '').toLowerCase();
            const sprintCount = await Sprint.countDocuments({
                companyId,
                projectId,
                boardId: board._id,
            });
            const useKanbanIssues =
                boardTypeLower === 'kanban' ||
                ((boardTypeLower === 'scrum' || boardTypeLower === 'simple') && sprintCount === 0);
            const IssueModel = useKanbanIssues ? KanbanIssue : SprintIssue;

            let issueIds = [];

            if (type === 'light') {
                if (useKanbanIssues) {
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
                    const boardIssues = await IssueModel.find({ companyId, projectId, boardId: board._id, fixVersion: { $in: fixVersionNames } }).lean();
                    issueIds = boardIssues.map((i) => i.issueId);
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
                console.warn(`[Bitbucket] No issues found for board ${board.boardName}`);
                return [];
            }

            const syncResult = await this.syncBitbucketRepos(uniqueIssueIds, jiraConfig, tenantConnection);
            const repoUrls = [...new Set(syncResult.successfulResults.filter((result) => result.url).map((result) => result.url))];

            if (repoUrls.length === 0) {
                console.warn(`No repository URLs found from Jira dev-status for board ${board.boardName}`);
                return [];
            }

            const repos = repoUrls
                .map((url) => {
                    // eslint-disable-next-line no-useless-escape
                    const match = url.match(/bitbucket\.org\/([^\/]+)\/([^\/\?#]+)/);
                    if (match) {
                        return {
                            workspace: match[1],
                            repoSlug: match[2].replace(/\.git$/, ''),
                            url: url,
                        };
                    }
                    return null;
                })
                .filter((repo) => repo);

            if (repos.length === 0) {
                console.warn(`No valid Bitbucket repositories parsed for board ${board.boardName}`);
                return [];
            }

            let lastSyncedDate;
            if (type === 'light') {
                const project = await Project.findOne({ _id: projectId, companyId });
                const { lastSynced } = project;
                lastSyncedDate = await convertISTStringToUTCISOString(lastSynced);
            } else {
                const now = new Date();
                lastSyncedDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 15)).toISOString();
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

            const allPRs = await Promise.all(repos.map((repo) => this.getAllPRs(cred, repo.workspace, repo.repoSlug, lastSyncedDate)));

            const prDetails = allPRs.flatMap((prList, index) =>
                prList.map((prData) => ({
                    number: prData.id,
                    workspace: repos[index].workspace,
                    repo: repos[index].repoSlug,
                    title: prData.title,
                }))
            );

            if (prDetails.length === 0) {
                console.warn(`No PRs found for board ${board.boardName}`);
                return [];
            }

            const detailedPRs = await Promise.all(
                prDetails.map(async ({ number, workspace, repo, title }) => {
                    const prData = await this.getPRByNumber(cred, workspace, repo, number);
                    const commits = await this.getPRCommits(cred, workspace, repo, number);
                    const diffStats = await this.getPRDiffStat(cred, workspace, repo, number);
                    const activities = await this.getPRActivities(cred, workspace, repo, number);

                    const { reviews, reviewComments } = this.extractReviewsFromActivities(activities);

                    const prFiles = this.convertDiffStatToFiles(diffStats);
                    const sensitiveChanges = await this.identifySensitiveModuleChanges(prFiles);
                    const missingTests = await this.checkTestCoverage(prFiles);

                    const baseMatch = title.match(/(?:^|\[)([A-Za-z]+-\d+)/i);
                    const issueKey = baseMatch ? baseMatch[1].toUpperCase() : null;
                    const issueKeyMatch = issueKey ? issueKey.match(/^[A-Za-z]+/) : null;
                    const extractedProjectKey = issueKeyMatch ? issueKeyMatch[0] : 'No match';

                    const boardProjects = await Project.find({ companyId, key: extractedProjectKey });
                    const scrumBoard = boardProjects.find((b) => b?.boardType?.toLowerCase?.() === 'scrum');
                    const lookupIssueModel = scrumBoard && scrumBoard.boardType === 'scrum' ? SprintIssue : KanbanIssue;

                    let jiraProjectId = null;
                    let sprintId = null;
                    let fixVersion = null;
                    let boardId = null;

                    const relatedIssues = await lookupIssueModel.find({ key: issueKey, companyId }).sort({ createdAt: -1 });

                    if (relatedIssues.length > 0) {
                        jiraProjectId = relatedIssues[0].projectId;
                        boardId = relatedIssues[0].boardId;
                        sprintId = relatedIssues[0].sprintId;
                        fixVersion = relatedIssues[0].fixVersion;
                    }

                    return {
                        ...prData,
                        commits,
                        diffStats,
                        activities,
                        reviews,
                        reviewComments,
                        sensitiveChanges,
                        missingTests,
                        workspace,
                        repoSlug: repo,
                        projectId: jiraProjectId,
                        boardId,
                        fixVersion,
                        sprintId,
                    };
                })
            );

            const bulkOps = detailedPRs.map((prData) => ({
                updateOne: {
                    filter: { prId: `bitbucket:${prData.workspace}/${prData.repoSlug}#${prData.id}` },
                    update: {
                        $set: {
                            companyId,
                            projectId: prData.projectId,
                            boardId: prData.boardId,
                            sprintId: prData.sprintId,
                            fixVersion: prData.fixVersion,
                            repo: prData.repoSlug,
                            title: prData.title,
                            status: prData.state === 'MERGED' ? 'merged' : prData.state === 'DECLINED' ? 'closed' : 'open',
                            prCreatedAt: prData.created_on,
                            prClosedAt: prData.state === 'OPEN' ? null : prData.updated_on,
                            prMergedAt: prData.state === 'MERGED' ? prData.updated_on : null,
                            prCreatedBy: prData.author?.display_name || prData.author?.username || 'Unknown',
                            prMergedBy: prData.closed_by?.display_name || '',
                            filesChanged: prData.diffStats?.length || 0,
                            linesAdded: prData.diffStats?.reduce((sum, f) => sum + (f.lines_added || 0), 0) || 0,
                            linesDeleted: prData.diffStats?.reduce((sum, f) => sum + (f.lines_removed || 0), 0) || 0,
                            reviewComments: prData.reviewComments || 0,
                            mergeable: prData.state === 'OPEN' ? 'true' : 'false',
                            merged: prData.state === 'MERGED' ? 'true' : 'false',
                            prNumber: prData.id,
                            branchName: prData.source?.branch?.name || '',
                            reviews: Array.isArray(prData.reviews) ? prData.reviews : [],
                            commits: (prData.commits || []).map((commit) => ({
                                commitId: commit.hash || '',
                                message: commit.message || '',
                                committerName: commit.author?.user?.display_name || commit.author?.raw || '',
                                committerEmail: (commit.author?.raw || '').match(/<([^>]+)>/)?.[1] || '',
                                date: commit.date || new Date(),
                            })),
                            projectKey: prData.title?.match(/([A-Z]+-\d+)/)?.[1]?.split('-')[0] || 'UNKNOWN',
                            hasSensitiveChanges: prData.sensitiveChanges?.hasSensitiveChanges || false,
                            sensitiveFiles: prData.sensitiveChanges?.sensitiveFiles || [],
                            missingTests: prData.missingTests || { hasMissingTests: false, codeFilesChanged: 0, testFilesChanged: 0 },
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
            console.error(`Error Syncing Bitbucket Data for board ${board.boardName}...`, error.message);
            throw error;
        }
    }

    async syncBitbucketRepos(uniqueIssueIds, cred, tenantConnection) {
        try {
            const promises = uniqueIssueIds.map(async (issueId) => {
                try {
                    const response = await axios.get(`${cred.host}/rest/dev-status/1.0/issue/detail?issueId=${issueId}&applicationType=bitbucket&dataType=repository`, {
                        auth: {
                            username: cred.username,
                            password: cred.password,
                        },
                    });

                    const detail = response.data?.detail?.[0];
                    const urls = [];

                    if (detail?.repositories) {
                        detail.repositories.forEach((repo) => {
                            if (repo.name) {
                                const repoUrl = `https://bitbucket.org/${repo.name}`;
                                if (!repoUrl.includes('{}') && !repoUrl.includes('{') && !repoUrl.includes('}')) {
                                    urls.push(repoUrl);
                                } else {
                                    const cleanUrl = `https://bitbucket.org/${repo.name}`;
                                    urls.push(cleanUrl);
                                }
                            } else if (repo.url && !repo.url.includes('{}')) {
                                urls.push(repo.url);
                            }
                        });
                    }

                    return { issueId, urls };
                } catch (error) {
                    return { issueId, urls: [] };
                }
            });

            const results = await Promise.all(promises);
            const allRepoUrls = new Set();

            results.forEach((result) => {
                result.urls.forEach((url) => allRepoUrls.add(url));
            });

            const SprintIssue = SprintIssueModel(tenantConnection);
            const KanbanIssue = BoardIssueModel(tenantConnection);

            const bulkOperations = await Promise.all(
                results.map(async (result) => {
                    const { issueId, urls } = result;

                    if (urls.length === 0) {
                        return null;
                    }

                    const sprintIssue = await SprintIssue.findOne({ issueId });
                    const kanbanIssue = !sprintIssue ? await KanbanIssue.findOne({ issueId }) : null;
                    const issue = sprintIssue || kanbanIssue;

                    if (issue) {
                        return {
                            updateOne: {
                                filter: { _id: issue.projectId, projectKeyId: issue.projectKeyId },
                                update: { $addToSet: { repos: { $each: urls } } },
                            },
                        };
                    }
                    return null;
                })
            );

            const validOperations = bulkOperations.filter(Boolean);

            if (validOperations.length > 0) {
                const Project = ProjectModel(tenantConnection);

                const projectIds = [...new Set(validOperations.map((op) => op.updateOne.filter._id))];
                for (const projectId of projectIds) {
                    const project = await Project.findById(projectId);
                    if (project && project.repos) {
                        const cleanRepos = project.repos.filter((url) => !url.includes('{}') && !url.includes('{') && !url.includes('}'));
                        if (cleanRepos.length !== project.repos.length) {
                            await Project.updateOne({ _id: projectId }, { $set: { repos: cleanRepos } });
                        }
                    }
                }

                await Project.bulkWrite(validOperations);
            } else {
                console.warn('[Bitbucket] No projects updated with repository URLs');
            }

            const successfulResults = Array.from(allRepoUrls).map((url) => ({ url }));
            return { successfulResults };
        } catch (error) {
            console.error('Error Syncing Bitbucket Repository Data...', error.message);
            throw error;
        }
    }

    async getAllPRs(cred, workspace, repoSlug, lastSyncedDate) {
        try {
            const auth = Buffer.from(`${cred.username}:${cred.password}`).toString('base64');
            const headers = {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
            };

            const prList = [];
            let pageUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests?state=OPEN&state=MERGED&state=DECLINED&pagelen=50`;

            while (pageUrl) {
                const { data } = await axios.get(pageUrl, { headers });
                const filteredPRs = (data.values || []).filter((pr) => {
                    const updatedAt = new Date(pr.updated_on).toISOString();
                    const currentDate = new Date().toISOString();
                    return updatedAt >= lastSyncedDate && updatedAt <= currentDate;
                });
                prList.push(...filteredPRs);
                pageUrl = data.next || null;
            }

            return prList;
        } catch (error) {
            console.error(`Error fetching PRs from ${workspace}/${repoSlug}...`, error.message);
            return [];
        }
    }

    async getPRByNumber(cred, workspace, repo, prNumber) {
        try {
            const auth = Buffer.from(`${cred.username}:${cred.password}`).toString('base64');
            const headers = {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
            };
            const { data } = await axios.get(
                `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests/${prNumber}?fields=*,participants,reviewers`,
                { headers }
            );
            return data;
        } catch (error) {
            console.error(`Error fetching PR #${prNumber} from ${workspace}/${repo}`, error.message);
            throw error;
        }
    }

    async getPRCommits(cred, workspace, repo, prNumber) {
        try {
            const auth = Buffer.from(`${cred.username}:${cred.password}`).toString('base64');
            const headers = {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
            };
            const commits = [];
            let pageUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests/${prNumber}/commits?pagelen=50`;

            while (pageUrl) {
                const { data } = await axios.get(pageUrl, { headers });
                commits.push(...(data.values || []));
                pageUrl = data.next || null;
            }

            return commits;
        } catch (error) {
            console.error(`Error fetching commits for PR #${prNumber}`, error.message);
            return [];
        }
    }

    async getPRDiffStat(cred, workspace, repo, prNumber) {
        try {
            const auth = Buffer.from(`${cred.username}:${cred.password}`).toString('base64');
            const headers = {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
            };
            const stats = [];
            let pageUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests/${prNumber}/diffstat?pagelen=50`;

            while (pageUrl) {
                const { data } = await axios.get(pageUrl, { headers });
                stats.push(...(data.values || []));
                pageUrl = data.next || null;
            }

            return stats;
        } catch (error) {
            console.error(`Error fetching diffstat for PR #${prNumber}`, error.message);
            return [];
        }
    }
    convertDiffStatToFiles(diffStats) {
        if (!Array.isArray(diffStats)) {
            return [];
        }
        return diffStats.map((f) => ({
            filename: f.new?.path || f.old?.path || f?.path || 'unknown',
            status: f.status || 'modified',
            additions: f.lines_added || 0,
            deletions: f.lines_removed || 0,
            changes: (f.lines_added || 0) + (f.lines_removed || 0),
        }));
    }

    async identifySensitiveModuleChanges(files) {
        try {
            const sensitivePatterns = [
                /^(auth|authentication|login|security|permissions|access-control|role|bitbucket)/i,
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
            console.error('Error identifying sensitive module changes (Bitbucket)', error.message);
            return {
                hasSensitiveChanges: false,
                sensitiveFiles: [],
                error: error.message,
            };
        }
    }

    async checkTestCoverage(files) {
        try {
            if (!files || files.length === 0) {
                return { hasMissingTests: false, codeFilesChanged: 0, testFilesChanged: 0 };
            }

            const testFilePatterns = [/\/tests?\//i, /\/__tests__\//i, /\.test\.[jt]sx?$/i, /\.spec\.[jt]sx?$/i, /Test\.java$/i, /Tests?\.java$/i, /_test\.[jt]sx?$/i];
            const codeFilePatterns = [/\.[jt]sx?$/i, /\.java$/i, /\.py$/i, /\.rb$/i, /\.php$/i, /\.go$/i, /\.cs$/i, /\.cpp$/i, /\.cc$/i, /\.c$/i];
            const ignorePatterns = [/\.md$/i, /\.txt$/i, /\.json$/i, /\.lock$/i, /\.yml$/i, /\.yaml$/i, /\.svg$/i, /\.png$/i, /\.jpe?g$/i, /\.gif$/i, /\.ico$/i];

            const isTestFile = (name) => testFilePatterns.some((p) => p.test(name));
            const isCodeFile = (name) => codeFilePatterns.some((p) => p.test(name));
            const isIgnored = (name) => ignorePatterns.some((p) => p.test(name));

            let codeFilesChanged = 0;
            let testFilesChanged = 0;
            for (const f of files) {
                const name = f.filename || '';
                if (isIgnored(name)) {
                    continue;
                }
                if (isTestFile(name)) {
                    testFilesChanged += 1;
                } else if (isCodeFile(name)) {
                    codeFilesChanged += 1;
                }
            }

            return {
                hasMissingTests: codeFilesChanged > 0 && testFilesChanged === 0,
                codeFilesChanged,
                testFilesChanged,
            };
        } catch (error) {
            console.error('Error checking test coverage (Bitbucket)', error.message);
            return { hasMissingTests: false, codeFilesChanged: 0, testFilesChanged: 0 };
        }
    }

    async getPRActivities(cred, workspace, repo, prNumber) {
        try {
            const auth = Buffer.from(`${cred.username}:${cred.password}`).toString('base64');
            const headers = {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
            };
            const activities = [];
            let pageUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests/${prNumber}/activity?pagelen=50`;

            while (pageUrl) {
                const { data } = await axios.get(pageUrl, { headers });
                activities.push(...(data.values || []));
                pageUrl = data.next || null;
            }

            return activities;
        } catch (error) {
            console.error(`Error fetching activities for PR #${prNumber}`, error.message);
            return [];
        }
    }

    extractReviewsFromActivities(activities) {
        try {
            if (!Array.isArray(activities) || activities.length === 0) {
                return { reviews: [], reviewComments: 0 };
            }

            const reviews = [];
            let reviewComments = 0;

            for (const item of activities) {
                if (item?.approval) {
                    const user = item.approval.user || item.user || item.actor || {};
                    reviews.push({
                        reviewerId: user.uuid || user.account_id || user.nickname || user.account_id || '',
                        reviewerUsername: user.display_name || user.username || user.nickname || '',
                        reviewState: 'APPROVED',
                        reviewDate: item.approval.date || item.date || new Date(),
                        reviewComment: '',
                        reviewId: item.approval?.id ? String(item.approval.id) : undefined,
                        isLatest: true,
                    });
                }

                if (item?.comment && item.comment.content) {
                    const user = item.comment.user || item.actor || item.user || {};
                    reviewComments += 1;
                    reviews.push({
                        reviewerId: user.uuid || user.account_id || user.nickname || '',
                        reviewerUsername: user.display_name || user.username || user.nickname || '',
                        reviewState: 'COMMENTED',
                        reviewDate: item.comment.created_on || item.date || new Date(),
                        reviewComment: item.comment.content?.raw || item.comment.content?.html || '',
                        reviewId: item.comment?.id ? String(item.comment.id) : undefined,
                        isLatest: false,
                    });
                }
            }

            return { reviews, reviewComments };
        } catch (err) {
            console.warn('[Bitbucket] extractReviewsFromActivities failed:', err.message);
            return { reviews: [], reviewComments: 0 };
        }
    }
}

export default new SyncBitbucketService();
