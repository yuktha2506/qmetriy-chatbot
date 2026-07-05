import { Types } from 'mongoose';
import {
    SprintModel, JiraReleaseModel, SprintIssueModel,
    BoardIssueModel, ProjectModel, BoardModel, BacklogIssueModel
} from '../../project-management/jira/model.js';
import { ConnectionModel } from '../../connection/model.js';
import { CXOModel } from '../../cxo/model.js';
import { CompanyModel } from '../../company/model.js';
import { PullRequestModel, DoraMetricsModel } from '../../source-code-management/github/model.js';
import { TestRailMilestoneModel } from '../../test-management/testrail/model.js';
import { XrayExecutionModel } from '../../test-management/xray/model.js';
import { getStartAndEndDate } from '../../../utils/commonFunctions.js';
import connectionManager from '../../../config/connectionManager.js';
import {
    PROVIDER_NAME_JIRA,
    PROVIDER_NAME_AZURE_BOARDS,
    PROVIDER_NAME_GITLAB_ISSUES,
    PROVIDER_NAME_GITHUB,
    PROVIDER_NAME_GITLAB,
    PROVIDER_NAME_ADO,
    PROVIDER_NAME_BITBUCKET,
} from '../../../utils/constants/providerConstants.js';
import { STATUS_ACTIVE, STATUS_CLOSED } from '../../../utils/constants/statusConstants.js';

class DashboardContextBuilder {
    constructor(tenantConnection, { companyId, projectId, boardId, sprintId, releaseId, developer }) {
        this.conn = tenantConnection;
        this.companyId = companyId;
        this.projectId = projectId;
        this.boardId = boardId;
        this.sprintId = sprintId;
        this.releaseId = releaseId;
        this.developer = developer;

        // Models — created once
        this.Sprint = SprintModel(tenantConnection);
        this.JiraRelease = JiraReleaseModel(tenantConnection);
        this.SprintIssue = SprintIssueModel(tenantConnection);
        this.KanbanIssue = BoardIssueModel(tenantConnection);
        this.Project = ProjectModel(tenantConnection);
        this.Board = BoardModel(tenantConnection);
        this.Connection = ConnectionModel(tenantConnection);
        this.Cxo = CXOModel(tenantConnection);
        this.Company = CompanyModel(tenantConnection);
        this.connectionManager = connectionManager;
        this._metaConnection = null;
        this._MetaCompany = null;
        this.BacklogIssue = BacklogIssueModel(tenantConnection);
        this.PullRequest = PullRequestModel(tenantConnection);
        this.TestRailMilestone = TestRailMilestoneModel(tenantConnection);
        this.XrayExecution = XrayExecutionModel(tenantConnection);
        this.DoraMetrics = DoraMetricsModel(tenantConnection);

        // Lazy caches — undefined means "not fetched yet"
        this._allIssues = undefined;
        this._bugIssues = undefined;
        this._sonarQubeData = undefined;
        this._sonarQubeFetched = false;
        this._companyDetails = undefined;
        this._companyDetailsFetched = false;
        this._backlogIssuesMap = undefined;
        this._gitConnections = undefined;
        this._allPullRequests = undefined;
        this._lastSixSprints = undefined;
        this._lastSixReleases = undefined;
        this._allBoardSprints = undefined;
        this._testRailMilestones = undefined;
        this._xrayExecutions = undefined;
        this._roleRatesAndStoryPoints = undefined;
        this._roleRatesFetched = false;
        this._boardList = undefined;
    }

    get metaConnection() {
        if (!this._metaConnection && this.connectionManager?.connectToMetaDB) {
            this._metaConnection = this.connectionManager.connectToMetaDB();
        }
        return this._metaConnection || null;
    }

    get MetaCompany() {
        if (!this._MetaCompany && this.metaConnection) {
            this._MetaCompany = CompanyModel(this.metaConnection);
        }
        return this._MetaCompany || null;
    }

    /**
     * Lightweight build — ONLY common lookups (board, project, connection, sprint/release).
     * NO heavy aggregations, NO CXO queries, NO company detail queries run here.
     */
    async build() {
        const ctx = {
            companyId: this.companyId,
            projectId: this.projectId,
            boardId: this.boardId,
            sprintId: this.sprintId,
            releaseId: this.releaseId,
            developer: this.developer,
            conn: this.conn,
        };

        // ── Step 1: Board + Project + Connection in parallel (3 lightweight queries) ──
        const [board, project, connection] = await Promise.all([
            this.Board.findOne({
                _id: new Types.ObjectId(this.boardId),
                companyId: new Types.ObjectId(this.companyId),
                projectId: new Types.ObjectId(this.projectId),
            }, { boardType: 1, assignees: 1 }).lean(),
            this.Project.findOne({
                _id: new Types.ObjectId(this.projectId),
                companyId: this.companyId,
            }, { name: 1, projectTypeKey: 1, boardType: 1, workflowStatuses: 1, repos: 1, lastSynced: 1, syncStatus: 1, assignees: 1 }).lean(),
            this.Connection.findOne({
                companyId: this.companyId,
                name: { $in: [PROVIDER_NAME_JIRA, PROVIDER_NAME_AZURE_BOARDS, PROVIDER_NAME_GITLAB_ISSUES] },
            }, { name: 1, host: 1 }).lean(),
        ]);

        if (!board) {throw { status: 404, message: 'Board not found.' };}
        ctx.board = board;
        ctx.project = project;
        ctx.connection = connection;

        // ── Step 2: Sprint or Release lookup (1 query) ──
        ctx.selectedType = null;
        ctx.identifierType = null;
        ctx.startOfDay = null;
        ctx.endOfDay = null;
        ctx.kanbanBoard = null;
        ctx.activeSprint = false;

        ctx.effectiveBoardId = connection?.name === PROVIDER_NAME_GITLAB_ISSUES ? null : this.boardId;

        if (this.sprintId) {
            ctx.selectedType = await this.Sprint.findOne({
                _id: new Types.ObjectId(this.sprintId),
                projectId: this.projectId,
                companyId: this.companyId,
                boardId: new Types.ObjectId(this.boardId),
            }).lean();
            if (!ctx.selectedType) {throw { status: 404, message: 'Sprint not found.' };}
            ctx.identifierType = 'sprintId';

            if (ctx.selectedType.state?.toLowerCase() === STATUS_ACTIVE) {
                ctx.activeSprint = true;
                const dates = await getStartAndEndDate(this.companyId, this.projectId, this.conn);
                ctx.startOfDay = dates.startOfDay;
                ctx.endOfDay = dates.endOfDay;
            }
        } else if (this.releaseId) {
            ctx.selectedType = await this.JiraRelease.findOne({
                _id: new Types.ObjectId(this.releaseId),
                projectId: this.projectId,
                companyId: this.companyId,
                boardId: new Types.ObjectId(this.boardId),
            }).lean();
            if (!ctx.selectedType) {throw { status: 404, message: 'Release not found.' };}
            ctx.identifierType = 'releaseId';

            // Kanban detection
            if (board.boardType === 'kanban' || board.boardType === 'simple') {
                ctx.kanbanBoard = project;
            } else if (board.boardType === 'scrum') {
                const sprintCount = await this.Sprint.countDocuments({
                    companyId: this.companyId,
                    projectId: this.projectId,
                });
                if (sprintCount === 0) {
                    ctx.kanbanBoard = project;
                }
            }
        }

        // ── Step 3: Determine IssueModel (synchronous) ──
        ctx.IssueModel = ctx.kanbanBoard ? this.KanbanIssue : this.SprintIssue;

        // ── Step 4: Build date details (synchronous, free) ──
        if (ctx.selectedType) {
            const startDate = ctx.selectedType.startDate;
            const endDate = ctx.selectedType.endDate || ctx.selectedType.releaseDate;
            ctx.dateDetails = {
                startDate: startDate ? startDate.toISOString().split('T')[0] : null,
                endDate: endDate ? endDate.toISOString().split('T')[0] : null,
            };
        } else {
            ctx.dateDetails = { startDate: null, endDate: null };
        }

        this.ctx = ctx;
        return ctx;
    }

    /**
     * Central matchQuery map — all per-API query conditions defined in ONE place.
     * Call after build().
     */
    getMatchQueryMap() {
        const ctx = this.ctx;
        const base = {
            projectId: new Types.ObjectId(this.projectId),
            companyId: new Types.ObjectId(this.companyId),
            boardId: new Types.ObjectId(this.boardId),
        };

        if (this.sprintId) {
            base.sprintId = new Types.ObjectId(this.sprintId);
            if (ctx.startOfDay) {
                base.createdAt = { $gte: ctx.startOfDay, $lt: ctx.endOfDay };
            }
        } else if (this.releaseId && ctx.selectedType) {
            base.fixVersion = { $regex: ctx.selectedType.releaseName, $options: 'i' };
        }

        return {
            base: { ...base },
            bug: { ...base, 'type.name': 'Bug' },
            costOfFixingProd: { ...base, 'type.name': 'Bug', label: { $regex: /^prod/i } },
        };
    }

    /**
     * Lazy: Deduplicated all-issues aggregation.
     * Only runs on first call, cached for subsequent calls.
     */
    async getDeduplicatedIssues() {
        if (this._allIssues !== undefined) {
            return this._allIssues;
        }

        const matchQueries = this.getMatchQueryMap();
        const pipeline = [
            { $match: matchQueries.base },
            { $sort: { createdAt: -1 } },
            { $group: { _id: '$issueId', latestTicket: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$latestTicket' } },
            { $project: {
                issueId: 1, key: 1, summary: 1, status: 1, type: 1,
                assignee: 1, developer: 1, priority: 1, storyPoints: 1,
                fixVersion: 1, label: 1, epic: 1, duedate: 1,
                originalEstimateHrs: 1, timeSpentHrs: 1, sprintId: 1,
                createdAt: 1, issueCreatedAt: 1, blockedBy: 1,
                cycleTimeSpent: 1, backflowRate: 1,
                customFields: 1, customFieldsByName: 1,
            } },
        ];
        this._allIssues = await this.ctx.IssueModel.aggregate(pipeline, { allowDiskUse: true });
        return this._allIssues;
    }

    /**
     * Lazy: Deduplicated bug-issues aggregation.
     * Only runs on first call, cached for subsequent calls.
     */
    async getDeduplicatedBugIssues() {
        if (this._bugIssues !== undefined) {
            return this._bugIssues;
        }

        const matchQueries = this.getMatchQueryMap();
        const pipeline = [
            { $match: matchQueries.bug },
            { $sort: { createdAt: -1 } },
            { $group: { _id: '$issueId', latestTicket: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$latestTicket' } },
            { $project: {
                issueId: 1, key: 1, summary: 1, status: 1, type: 1,
                assignee: 1, developer: 1, priority: 1, storyPoints: 1,
                fixVersion: 1, label: 1, epic: 1, duedate: 1,
                originalEstimateHrs: 1, timeSpentHrs: 1, sprintId: 1,
                createdAt: 1, issueCreatedAt: 1,
                customFields: 1, customFieldsByName: 1,
            } },
        ];
        this._bugIssues = await this.ctx.IssueModel.aggregate(pipeline, { allowDiskUse: true });
        return this._bugIssues;
    }

    /**
     * Lazy: SonarQube/CXO data.
     * Only runs on first call, cached for subsequent calls.
     */
    async getSonarQubeData() {
        if (this._sonarQubeFetched) {
            return this._sonarQubeData;
        }
        this._sonarQubeFetched = true;

        const ctx = this.ctx;
        if (!ctx.identifierType) {
            this._sonarQubeData = null;
            return null;
        }

        const cxoMatch = {
            companyId: new Types.ObjectId(this.companyId),
            projectId: new Types.ObjectId(this.projectId),
        };
        if (ctx.identifierType === 'sprintId') {
            cxoMatch.sprintId = new Types.ObjectId(this.sprintId);
        } else {
            cxoMatch.releaseVersion = { $regex: ctx.selectedType.releaseName, $options: 'i' };
        }

        const result = await this.Cxo.aggregate([
            { $match: cxoMatch },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: ctx.identifierType === 'sprintId' ? '$sprintId' : '$releaseVersion',
                    latestData: { $first: '$$ROOT' },
                },
            },
        ], { allowDiskUse: true });

        this._sonarQubeData = result.length > 0
            ? result[0].latestData.engineeringScoreObject?.developerScoreObject?.combinedScanData?.ncloc || null
            : null;
        return this._sonarQubeData;
    }

    /**
     * Lazy: Backlog issues for a release, with optional extra filters.
     * Keyed by stringified extraFilter for per-variant caching.
     */
    async getBacklogIssues(extraFilter = {}) {
        const cacheKey = JSON.stringify(extraFilter);
        if (!this._backlogIssuesMap) { this._backlogIssuesMap = new Map(); }
        if (this._backlogIssuesMap.has(cacheKey)) { return this._backlogIssuesMap.get(cacheKey); }

        if (!this.releaseId || !this.ctx.selectedType?.releaseName) {
            this._backlogIssuesMap.set(cacheKey, []);
            return [];
        }

        const filter = {
            projectId: new Types.ObjectId(this.projectId),
            companyId: new Types.ObjectId(this.companyId),
            boardId: new Types.ObjectId(this.boardId),
            fixVersion: this.ctx.selectedType.releaseName,
            ...extraFilter,
        };
        const result = await this.BacklogIssue.aggregate([
            { $match: filter },
            { $sort: { issueCreatedAt: -1 } },
            { $group: { _id: '$issueId', doc: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$doc' } },
            { $project: {
                issueId: 1, key: 1, summary: 1, status: 1, type: 1,
                assignee: 1, developer: 1, priority: 1, storyPoints: 1,
                fixVersion: 1, label: 1, epic: 1, duedate: 1,
                originalEstimateHrs: 1, timeSpentHrs: 1,
                createdAt: 1, issueCreatedAt: 1,
                customFields: 1, customFieldsByName: 1,
            } },
        ], { allowDiskUse: true });
        this._backlogIssuesMap.set(cacheKey, result);
        return result;
    }

    /**
     * Lazy: Git provider connections (GitHub, GitLab, Azure DevOps, Bitbucket).
     */
    async getGitConnections() {
        if (this._gitConnections !== undefined) { return this._gitConnections; }

        const [gitHubCred, gitLabCred, gitAzureCred, bitbucketCred] = await Promise.all([
            this.Connection.findOne({ companyId: this.companyId, name: PROVIDER_NAME_GITHUB }, { name: 1, host: 1 }).lean(),
            this.Connection.findOne({ companyId: this.companyId, name: PROVIDER_NAME_GITLAB }, { name: 1, host: 1 }).lean(),
            this.Connection.findOne({ companyId: this.companyId, name: PROVIDER_NAME_ADO }, { name: 1, host: 1 }).lean(),
            this.Connection.findOne({ companyId: this.companyId, name: PROVIDER_NAME_BITBUCKET }, { name: 1, host: 1 }).lean(),
        ]);

        const gitProvider = gitHubCred ? 'github' : gitLabCred ? 'gitlab' : gitAzureCred ? 'azure' : bitbucketCred ? 'bitbucket' : null;

        this._gitConnections = { gitHubCred, gitLabCred, gitAzureCred, bitbucketCred, gitProvider };
        return this._gitConnections;
    }

    /**
     * Lazy: All pull requests for this project + company.
     */
    async getAllPullRequests() {
        if (this._allPullRequests !== undefined) { return this._allPullRequests; }

        const prQuery = {
            projectId: this.projectId,
            companyId: this.companyId,
        };
        if (this.boardId) {
            prQuery.boardId = new Types.ObjectId(this.boardId);
        }

        this._allPullRequests = await this.PullRequest.find(prQuery, {
            title: 1, prNumber: 1, prCreatedAt: 1, prClosedAt: 1, prMergedAt: 1,
            prCreatedBy: 1, prMergedBy: 1, status: 1, merged: 1, repo: 1,
            branchName: 1, reviews: 1, filesChanged: 1, linesAdded: 1, linesDeleted: 1,
            mergeable: 1, sprintId: 1, fixVersion: 1, boardId: 1,
            hasSensitiveChanges: 1, sensitiveFiles: 1, missingTests: 1,
        }).lean();
        return this._allPullRequests;
    }

    /**
     * Lazy: Last 6 sprints up to and including the selected sprint.
     */
    async getLastSixSprints() {
        if (this._lastSixSprints !== undefined) { return this._lastSixSprints; }

        if (!this.sprintId || !this.ctx.selectedType) {
            this._lastSixSprints = [];
            return [];
        }

        const sprints = await this.Sprint.find({
            projectId: new Types.ObjectId(this.projectId),
            companyId: new Types.ObjectId(this.companyId),
            boardId: new Types.ObjectId(this.boardId),
            startDate: { $lte: this.ctx.selectedType.startDate },
            state: { $in: [STATUS_ACTIVE, STATUS_CLOSED, 'current', 'past'] },
        }, {
            name: 1, sprintId: 1, startDate: 1, endDate: 1, state: 1,
            storyChurn: 1, velocity: 1, hours: 1, releases: 1,
        }).sort({ startDate: -1 }).limit(6).lean();

        sprints.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        this._lastSixSprints = sprints;
        return this._lastSixSprints;
    }

    /**
     * Lazy: Last 6 releases up to and including the selected release.
     */
    async getLastSixReleases() {
        if (this._lastSixReleases !== undefined) { return this._lastSixReleases; }

        if (!this.releaseId || !this.ctx.selectedType) {
            this._lastSixReleases = [];
            return [];
        }

        const releases = await this.JiraRelease.find({
            projectId: new Types.ObjectId(this.projectId),
            companyId: new Types.ObjectId(this.companyId),
            boardId: new Types.ObjectId(this.boardId),
            startDate: { $lte: this.ctx.selectedType.startDate },
        }, {
            releaseName: 1, releaseDate: 1, startDate: 1, releaseChurn: 1,
            velocity: 1, hours: 1, status: 1,
        }).sort({ startDate: -1 }).limit(6).lean();

        releases.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        this._lastSixReleases = releases;
        return this._lastSixReleases;
    }

    /**
     * Lazy: All sprints for this board (used for sprint outcome lookups in jiraTable).
     */
    async getAllBoardSprints() {
        if (this._allBoardSprints !== undefined) { return this._allBoardSprints; }

        this._allBoardSprints = await this.Sprint.aggregate([
            { $match: {
                companyId: new Types.ObjectId(this.companyId),
                projectId: new Types.ObjectId(this.projectId),
                boardId: new Types.ObjectId(this.boardId),
            } },
            { $project: { _id: { $toString: '$_id' }, name: 1, state: 1, startDate: 1 } },
        ]);
        return this._allBoardSprints;
    }

    /**
     * Lazy: TestRail milestones with batch sub-milestone fetching (resolves N+1).
     */
    async getTestRailMilestones() {
        if (this._testRailMilestones !== undefined) { return this._testRailMilestones; }

        const buildBaseFilter = (additionalFilter = {}) => ({
            companyId: new Types.ObjectId(this.companyId),
            jiraProjectId: new Types.ObjectId(this.projectId),
            boardId: new Types.ObjectId(this.boardId),
            ...additionalFilter,
        });

        let milestones = [];

        if (this.sprintId) {
            milestones = await this.TestRailMilestone.aggregate([
                { $match: buildBaseFilter({ sprintId: new Types.ObjectId(this.sprintId) }) },
                { $sort: { createdAt: -1 } },
                { $group: { _id: '$milestoneId', latestMilestone: { $first: '$$ROOT' } } },
                { $replaceRoot: { newRoot: '$latestMilestone' } },
            ], { allowDiskUse: true });
        } else if (this.releaseId) {
            const filter = buildBaseFilter({ releaseId: new Types.ObjectId(this.releaseId) });
            filter.$or = [{ parentId: null }, { parentId: { $exists: false } }];

            milestones = await this.TestRailMilestone.aggregate([
                { $match: filter },
                { $sort: { createdAt: -1 } },
                { $group: { _id: '$milestoneId', latestMilestone: { $first: '$$ROOT' } } },
                { $replaceRoot: { newRoot: '$latestMilestone' } },
            ], { allowDiskUse: true });
        }

        if (milestones.length > 0) {
            const parentIds = milestones
                .filter(m => !m.parentId)
                .map(m => m.milestoneId)
                .filter(Boolean);

            if (parentIds.length > 0) {
                const subMilestones = await this.TestRailMilestone.aggregate([
                    { $match: buildBaseFilter({ parentId: { $in: parentIds } }) },
                    { $sort: { createdAt: -1 } },
                    { $group: { _id: '$milestoneId', latestMilestone: { $first: '$$ROOT' } } },
                    { $replaceRoot: { newRoot: '$latestMilestone' } },
                ], { allowDiskUse: true });

                const existingIds = new Set(milestones.map(m => m.milestoneId));
                subMilestones.forEach(sub => {
                    if (sub.milestoneId && !existingIds.has(sub.milestoneId)) {
                        milestones.push(sub);
                        existingIds.add(sub.milestoneId);
                    }
                });
            }
        }

        this._testRailMilestones = milestones;
        return this._testRailMilestones;
    }

    /**
     * Lazy: Xray executions for this sprint or release.
     */
    async getXrayExecutions() {
        if (this._xrayExecutions !== undefined) { return this._xrayExecutions; }

        const filter = {
            companyId: new Types.ObjectId(this.companyId),
            jiraProjectId: new Types.ObjectId(this.projectId),
            boardId: new Types.ObjectId(this.boardId),
        };

        if (this.sprintId) {
            filter.sprintId = new Types.ObjectId(this.sprintId);
        } else if (this.releaseId) {
            filter.releaseId = new Types.ObjectId(this.releaseId);
        } else {
            this._xrayExecutions = [];
            return [];
        }

        this._xrayExecutions = await this.XrayExecution.aggregate([
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $group: { _id: '$testExecKey', latestExecution: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$latestExecution' } },
        ], { allowDiskUse: true });

        const hasExecutionData = this._xrayExecutions.some(
            (exec) => !exec.sourceType || exec.sourceType === 'execution',
        );
        if (hasExecutionData) {
            this._xrayExecutions = this._xrayExecutions.filter(
                (exec) => !exec.sourceType || exec.sourceType === 'execution',
            );
        }

        return this._xrayExecutions;
    }

    /**
     * Lazy: Role rates and story points config from company.
     * Requires meta DB lookup, cached for the request lifecycle.
     */
    async getRoleRatesAndStoryPoints() {
        if (this._roleRatesFetched) { return this._roleRatesAndStoryPoints; }
        this._roleRatesFetched = true;

        try {
            const metaConnection = connectionManager.connectToMetaDB();
            const MetaCompany = CompanyModel(metaConnection);
            const metaCompany = await MetaCompany.findOne(
                { _id: new Types.ObjectId(this.companyId) },
                { companyName: 1 }
            );
            if (!metaCompany) {
                this._roleRatesAndStoryPoints = { roleRates: [], storyPoints: [] };
                return this._roleRatesAndStoryPoints;
            }

            let companyData = await this.Company.findOne(
                { companyName: metaCompany.companyName },
                { roleRates: 1, storyPoints: 1 }
            ).lean();
            if (!companyData) {
                companyData = await this.Company.findOne(
                    { isActive: true },
                    { roleRates: 1, storyPoints: 1 }
                ).lean();
            }

            this._roleRatesAndStoryPoints = {
                roleRates: companyData?.roleRates || [],
                storyPoints: companyData?.storyPoints || [],
            };
        } catch (e) {
            this._roleRatesAndStoryPoints = { roleRates: [], storyPoints: [] };
        }

        return this._roleRatesAndStoryPoints;
    }

    /**
     * Lazy: All boards for this project, ordered with the project's preferred board first.
     */
    async getBoardList() {
        if (this._boardList !== undefined) { return this._boardList; }

        const companyObjId = new Types.ObjectId(this.companyId);
        const projectObjId = new Types.ObjectId(this.projectId);

        const [allBoards, project] = await Promise.all([
            this.Board.find(
                { companyId: companyObjId, projectId: projectObjId },
                { name: 1, boardId: 1, boardType: 1 }
            ).lean(),
            this.Project.findOne(
                { companyId: companyObjId, _id: projectObjId },
                { boardId: 1 }
            ).lean(),
        ]);

        if (!project || !project.boardId) {
            this._boardList = allBoards;
            return this._boardList;
        }

        const matching = [];
        const remaining = [];
        allBoards.forEach(board => {
            if (board.boardId === project.boardId) {
                matching.push(board);
            } else {
                remaining.push(board);
            }
        });

        this._boardList = [...matching, ...remaining];
        return this._boardList;
    }

    /**
     * Lazy: Company details for cost of fixing.
     * Only runs on first call, cached for subsequent calls.
     */
    async getCompanyDetails() {
        if (this._companyDetailsFetched) {
            return this._companyDetails;
        }
        this._companyDetailsFetched = true;

        try {
            const metaConnection = connectionManager.connectToMetaDB();
            const MetaCompany = CompanyModel(metaConnection);
            const metaCompanyData = await MetaCompany.findOne(
                { _id: new Types.ObjectId(this.companyId) },
                { _id: 0, companyName: 1 }
            );
            if (metaCompanyData) {
                this._companyDetails = (await this.Company.findOne(
                    { companyName: metaCompanyData.companyName },
                    { _id: 0, storyPoints: 1 }
                )) || {};
            } else {
                this._companyDetails = {};
            }
        } catch (e) {
            this._companyDetails = {};
        }

        return this._companyDetails;
    }
}

export default DashboardContextBuilder;
