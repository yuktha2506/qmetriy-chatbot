import { Schema, ObjectId } from 'mongoose';
const committedVsCompletedMetricsSchema = new Schema(
    {
        initialStoryPoints: { type: Number },
        initialOriginalEstimateHrs: { type: Number },
        spilloverStoryPoints: { type: Number, default: 0 },
        committedStoryPoints: { type: Number },
        storyPointsAddedInBeginning: { type: Number },
        storyPointsAddedAfterStart: { type: Number },
        removedStoryPoints: { type: Number },
        completedStoryPoints: { type: Number },
        remainingStoryPoints: { type: Number },
        initialHours: { type: Number },
        spilloverHours: { type: Number, default: 0 },
        committedHours: { type: Number },
        hoursAddedInBeginning: { type: Number },
        hoursAddedAfterStart: { type: Number },
        removedHours: { type: Number },
        completedHours: { type: Number },
        remainingHours: { type: Number },
    },
    { _id: false }
);
const accuracyMetricsSchema = new Schema(
    {
        planningAccuracy: { type: Schema.Types.Mixed, default: null },
        accuracyScore: { type: Schema.Types.Mixed, default: null },
        capacityAccuracy: { type: Schema.Types.Mixed, default: null },
        accuracySprints: { type: [Schema.Types.Mixed], default: [] },
        insufficientSprints: { type: Boolean, default: false },
    },
    { _id: false }
);
const riskAndAlertsSchema = new Schema(
    {
        openIssueCount: { type: Number },
        openIssues: { type: [String], default: [] },
        criticalCount: { type: Number },
        criticalIssues: { type: [String], default: [] },
        blockerDetected: { type: Number },
        blockerIssues: { type: [String], default: [] },
        scopeUpdate: { type: Number },
    },
    { _id: false }
);
const projectSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        companyId: { type: ObjectId },
        projectKeyId: { type: Number },
        name: { type: String, required: true },
        repos: { type: [String] },
        boardType: { type: String },
        boardId: { type: Number, unique: true },
        firstIssueCreatedAt: { type: Date, default: null },
        sonarQubeScanReport: [
            {
                repo: { type: String },
                staticCodeAnalysisScore: { type: Number },
                duplicated_files: { type: Number },
                ncloc: { type: Number },
                vulnerabilities: { type: Number },
                security_hotspots: { type: Number },
                duplicated_blocks: { type: Number },
                duplicated_lines: { type: Number },
                code_smells: { type: Number },
                _id: false,
            },
        ],
        combinedScanData: {
            staticCodeAnalysisScore: { type: Number },
            duplicated_files: { type: Number },
            ncloc: { type: Number },
            vulnerabilities: { type: Number },
            security_hotspots: { type: Number },
            duplicated_blocks: { type: Number },
            duplicated_lines: { type: Number },
            code_smells: { type: Number },
            _id: false,
        },
        metricContribution: {
            engineeringScore: {
                engineeringScoreLevelOne: {
                    developerScore: { type: Number, default: 0 },
                    testScore: { type: Number, default: 0 },
                    operationScore: { type: Number, default: 0 },
                },
                developerScore: {
                    cycleTime: { type: Number, default: 0 },
                    defectDensity: { type: Number, default: 0 },
                    timeToFixBug: { type: Number, default: 0 },
                    codeCoverage: { type: Number, default: 0 },
                    staticCodeAnalysis: { type: Number, default: 0 },
                },
                testScore: {
                    testCoverage: { type: Number, default: 0 },
                    testAutomation: { type: Number, default: 0 },
                    testCycleTime: { type: Number, default: 0 },
                    traceability: { type: Number, default: 0 },
                    testingQuality: { type: Number, default: 0 },
                    testingProductivity: { type: Number, default: 0 },
                    automationTestingProductivity: { type: Number, default: 0 },
                    dla: { type: Number, default: 0 },
                },
                operationScore: {
                    deploymentFrequency: { type: Number, default: 0 },
                    meanTimeToRecovery: { type: Number, default: 0 },
                    leadTimeForChanges: { type: Number, default: 0 },
                    changeFailureRate: { type: Number, default: 0 },
                },
            },
            releaseReadiness: {
                testCoverage: { type: Number, default: 0 },
                burndown: { type: Number, default: 0 },
                automationTestResult: { type: Number, default: 0 },
                manualTestResult: { type: Number, default: 0 },
            },
            releaseVelocity: {},
        },
        key: { type: String },
        projectTypeKey: { type: String },
        self: { type: String },
        status: { type: Boolean, default: true },
        createdBy: { type: String },
        ProjectManagement: { type: String },
        workflowStatuses: [
            {
                order: { type: Number, required: true },
                name: { type: String, required: true },
                statuses: { type: [String], required: true },
                _id: false,
            },
        ],
        isSelected: { type: Boolean, default: false },
        lastSynced: { type: String },
        syncStatus: { type: Boolean, default: true },
        hardSyncStatus: {
            projectManagement: { type: Boolean, default: false },
            sourceCodeManagement: { type: Boolean, default: false },
            testManagement: { type: Boolean, default: false },
            cxo: { type: Boolean, default: false },
            techQuality: { type: Boolean, default: false },
        },
        backlogHardSyncCompleted: { type: Boolean, default: false },

        estimation: {
            type: {
                type: String,
                default: null,
                required: false,
            },
            _id: false,
        },
        templateName: { type: String, default: null },
        hideStatus: { type: Boolean, default: false },
        assignees: [
            {
                accountId: { type: String, required: true },
                displayName: { type: String },
                emailAddress: { type: String },
                active: { type: Boolean },
            },
        ],
        /** Active assignable users for the Jira project; synced from REST assignable/search ({ displayName, active } only). */
        projectUsers: [
            {
                displayName: { type: String },
                active: { type: Boolean },
                _id: false,
            },
        ],
        boards: [
            {
                _id: { type: ObjectId, auto: true },
                boardId: { type: Number, required: true },
                boardName: { type: String, required: true },
                boardType: { type: String, required: true },
                boardSelf: { type: String },
                isPrivate: { type: Boolean, default: false },
                boardLocation: {
                    projectId: { type: Number },
                    projectName: { type: String },
                    projectKey: { type: String },
                    projectTypeKey: { type: String },
                    avatarURI: { type: String },
                    displayName: { type: String },
                    name: { type: String },
                },
            },
        ],
    },
    { versionKey: false, timestamps: true, strict: false }
);

// Project lookups commonly filter by company and project key/board
projectSchema.index({ companyId: 1, projectKeyId: 1 }, { name: 'project_company_projectKeyId' });
projectSchema.index({ companyId: 1, boardId: 1 }, { name: 'project_company_boardId' });

export const ProjectModel = (connection) => connection.model('Project', projectSchema);
const developerChurnSchema = new Schema(
    {
        developer: { type: String, required: true, trim: true, default: 'UnAssigned' },
        planned: { type: Number, required: true, min: 0, default: 0 },
        added: { type: Number, required: true, min: 0, default: 0 },
        removed: { type: Number, required: true, min: 0, default: 0 },
        churnRate: { type: Number, required: true, min: 0, default: 0 },
    },
    { _id: true } // Ensure each developerChurn entry has an _id
);

const storyChurnSchema = new Schema(
    {
        issueType: { type: String, required: true, trim: true },
        planned: { type: Number, required: true, min: 0, default: 0 },
        added: { type: Number, required: true, min: 0, default: 0 },
        removed: { type: Number, required: true, min: 0, default: 0 },
        churnRate: { type: Number, required: true, min: 0, default: 0 },
        developerChurn: { type: [developerChurnSchema], default: [] },
    },
    { _id: true } // Ensure each storyChurn entry has an _id
);

const burndownVelocitySchema = new Schema({
    spVelocity: {
        targetVelocity: { type: Number, default: 0 },
        averageVelocity: { type: Number, default: 0 },
        _id: false,
    },

    hrsVelocity: {
        targetVelocity: { type: Number, default: 0 },
        averageVelocity: { type: Number, default: 0 },
        _id: false,
    },
    _id: false,
});

const sprintSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        projectId: { type: ObjectId },
        companyId: { type: ObjectId },
        projectKeyId: { type: Number },
        sprintId: { type: Number },
        name: { type: String },
        originBoardId: { type: Number },
        boardReference: { type: Number },
        boardId: { type: ObjectId },
        totalStoryPoints: { type: Number },
        committedVsCompletedMetrics: committedVsCompletedMetricsSchema,
        idealBurnupByDev: [
            {
                assignee: { type: String, required: true },
                initialStoryPoints: { type: Number },
                initialOriginalEstimateHrs: { type: Number },
            },
        ],
        state: { type: String },
        startDate: { type: Date },
        endDate: { type: Date },
        completeDate: { type: Date },
        totalDays: { type: Number },
        releases: {
            type: [
                {
                    name: { type: String },
                    releaseDate: { type: Date },
                },
            ],
            default: [],
        },
        completedStoryPointsByRelease: {
            type: [
                {
                    releaseName: { type: String },
                    completedPoints: { type: Number, default: 0 },
                    completedHours: { type: Number, default: 0 },
                    issueTypeBreakdown: {
                        type: [
                            {
                                issueType: { type: String },
                                completedTicketCount: { type: Number, default: 0 },
                                completedPoints: { type: Number, default: 0 },
                                completedHours: { type: Number, default: 0 },
                                _id: false,
                            },
                        ],
                        default: [],
                    },
                    _id: false,
                },
            ],
            default: [],
        },
        velocity: {
            planned: { type: Number, default: 0 },
            completed: { type: Number, default: 0 },
            completedLate: { type: Number, default: 0 },
            incomplete: { type: Number, default: 0 },

            hoursPlanned: { type: Number, default: 0 },
            hoursCompleted: { type: Number, default: 0 },
            hoursCompletedLate: { type: Number, default: 0 },
            hoursIncomplete: { type: Number, default: 0 },
        },
        burndownVelocity: burndownVelocitySchema,
        storyChurn: { type: [storyChurnSchema], default: [] },
        assignees: [
            {
                assignee: { type: String, required: true },
                availableHours: { type: Number },
                allocationType: { type: String },
                allocatedHours: { type: Number },
                role: { type: String },
                billingRate: { type: Number },
                holiday: { type: Number },
                leaves: { type: Number },
                netAvailableCapacity: { type: Number },
                addedManually: { type: String, enum: ['yes', 'no'], default: 'no' },
                sprintOrReleaseUser: { type: String, enum: ['yes', 'no'], default: 'no' },
                presentInPlan: { type: String, enum: ['yes', 'no'], default: 'yes' },
            },
        ],
        hours: { type: Boolean, default: false },
        pointsSourceType: { type: String, default: null },
        assigneeCopiedForToday: { type: Boolean, default: false },
        cycleTime: {
            totalCycleTime: { type: Number, default: 0 },
            totalTimeSpent: { type: Number, default: 0 },
            numberOfIssues: { type: Number, default: 0 },
            cycleTimeByDeveloper: [
                {
                    developer: { type: String, default: null },
                    averageCycleTime: { type: Number, default: 0 },
                    totalIssues: { type: Number, default: 0 },
                    _id: false,
                },
            ],
        },
        burndownData: {
            dailyData: [
                {
                    date: { type: String },
                    totalOriginalEstimate: { type: Number, default: 0 },
                    totalEffortSpent: { type: Number, default: 0 },
                    idealLine: { type: Number, default: 0 },
                    actualLine: { type: Number, default: 0 },
                    developerData: [
                        {
                            developer: { type: String },
                            originalEstimate: { type: Number, default: 0 },
                            effortSpent: { type: Number, default: 0 },
                            _id: false,
                        },
                    ],
                    _id: false,
                },
            ],
            totalOriginalEstimate: { type: Number, default: 0 },
            totalEffortSpent: { type: Number, default: 0 },
            lastCalculatedAt: { type: Date },
        },
        burnupData: {
            dailyData: [
                {
                    date: { type: String },
                    storyPointsAddedNewTickets: { type: Number, default: 0 },
                    hoursAddedNewTickets: { type: Number, default: 0 },
                    estimationIncreasedSP: { type: Number, default: 0 },
                    estimationIncreasedHrs: { type: Number, default: 0 },
                    estimationDecreasedSP: { type: Number, default: 0 },
                    estimationDecreasedHrs: { type: Number, default: 0 },
                    storyPointsRemovedFromSprint: { type: Number, default: 0 },
                    hoursRemovedFromSprint: { type: Number, default: 0 },
                    storyPointsReaddedToSprint: { type: Number, default: 0 },
                    hoursReaddedToSprint: { type: Number, default: 0 },
                    storyPointsDone: { type: Number, default: 0 },
                    hoursDone: { type: Number, default: 0 },
                    storyPointsReopened: { type: Number, default: 0 },
                    hoursReopened: { type: Number, default: 0 },
                    storyPointsDoneFromInitialScope: { type: Number, default: 0 },
                    hoursDoneFromInitialScope: { type: Number, default: 0 },
                    storyPointsDoneFromAddedScope: { type: Number, default: 0 },
                    hoursDoneFromAddedScope: { type: Number, default: 0 },
                    completedWorkCumulativeSP: { type: Number, default: 0 },
                    completedWorkCumulativeHrs: { type: Number, default: 0 },
                    idealLineSP: { type: Number, default: 0 },
                    idealLineHrs: { type: Number, default: 0 },
                    developerData: [
                        {
                            developer: { type: String },
                            storyPointsAddedNewTickets: { type: Number, default: 0 },
                            hoursAddedNewTickets: { type: Number, default: 0 },
                            estimationIncreasedSP: { type: Number, default: 0 },
                            estimationIncreasedHrs: { type: Number, default: 0 },
                            estimationDecreasedSP: { type: Number, default: 0 },
                            estimationDecreasedHrs: { type: Number, default: 0 },
                            storyPointsRemovedFromSprint: { type: Number, default: 0 },
                            hoursRemovedFromSprint: { type: Number, default: 0 },
                            storyPointsReaddedToSprint: { type: Number, default: 0 },
                            hoursReaddedToSprint: { type: Number, default: 0 },
                            storyPointsDone: { type: Number, default: 0 },
                            hoursDone: { type: Number, default: 0 },
                            storyPointsReopened: { type: Number, default: 0 },
                            hoursReopened: { type: Number, default: 0 },
                            completedWorkCumulativeSP: { type: Number, default: 0 },
                            completedWorkCumulativeHrs: { type: Number, default: 0 },
                            idealLineSP: { type: Number, default: 0 },
                            idealLineHrs: { type: Number, default: 0 },
                            _id: false,
                        },
                    ],
                    _id: false,
                },
            ],
            lastCalculatedAt: { type: Date },
        },
    },
    { versionKey: false, timestamps: true }
);

// Sprint queries filter by company/project/board and state or startDate
sprintSchema.index({ companyId: 1, projectId: 1, boardId: 1, state: 1 }, { name: 'sprint_company_project_board_state' });
sprintSchema.index({ companyId: 1, projectId: 1, boardId: 1, startDate: 1 }, { name: 'sprint_company_project_board_startDate' });

export const SprintModel = (connection) => connection.model('Sprint', sprintSchema);

const sprintIssueSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        projectId: { type: ObjectId },
        companyId: { type: ObjectId },
        sprintId: [{ type: Object }],
        boardId: { type: ObjectId },
        issueId: { type: Number },
        key: { type: String },
        summary: { type: String },
        originalEstimateHrs: { type: Number },
        developer: { type: [String], default: [] },
        timeSpentHrs: { type: Number },
        storyPoints: { type: Number },
        pointsSourceType: { type: String, default: null },
        pointsSourceRefName: { type: String, default: null },
        type: {
            id: String,
            name: String,
            description: String,
        },
        sprint: { type: Schema.Types.Mixed },
        status: { type: Schema.Types.Mixed },
        issueCreatedAt: { type: Date },
        issueUpdatedAt: { type: Date },
        workStartedAt: { type: Date },
        workCompletedAt: { type: Date },
        assignee: { type: String },
        projectKeyId: { type: Number },
        priority: { type: String },
        fixVersion: { type: String },
        affectedVersion: { type: [String], default: null },
        label: { type: [String] },
        blockedBy: { type: [String], default: null },
        relatesTo: { type: [String], default: null },
        duedate: { type: Date },
        cycleTimeSpent: { type: String },
        backflowRate: { type: Number },
        sprintChangeLog: [
            {
                author: { type: String },
                timestamp: { type: Date },
                action: { type: String },
                fromSprintId: { type: String },
                toSprintId: { type: String },
                fromSprintString: { type: String },
                toSprintString: { type: String },
            },
        ],
        releaseChangeLog: [
            {
                author: { type: String },
                timestamp: { type: Date },
                action: { type: String },
                fromReleaseId: { type: String },
                toReleaseId: { type: String },
                fromReleaseString: { type: String },
                toReleaseString: { type: String },
            },
        ],
        statusChangeLog: [
            {
                changedAt: { type: Date },
                from: { type: String },
                to: { type: String },
            },
        ],
        epic: {
            key: { type: String },
            name: { type: String },
            summary: { type: String },
        },
        worklog: [
            {
                timeSpentHrs: { type: Number },
                created: { type: Date },
                updated: { type: Date },
                started: { type: Date },
            },
        ],
        customFields: { type: Object, default: {} },
        customFieldsByName: { type: Object, default: {} },
        repoCreated: { type: Boolean, default: false },
        severity: { type: String, default: null },
        estimationChangelog: [
            {
                changedAt: { type: Date },
                estimationType: { type: String, enum: ['storyPoint', 'originalEstimate'] },
                fromValue: { type: Number },
                toValue: { type: Number },
            },
        ],
        isAccepted: { type: Boolean, default: null },
    },
    { versionKey: false, timestamps: true }
);

// Sprint issue reads filter on tenant scope and sprint, and sort by updatedAt/issueUpdatedAt
sprintIssueSchema.index({ companyId: 1, projectId: 1, boardId: 1, sprintId: 1, updatedAt: -1 }, { name: 'sprintIssue_company_project_board_sprint_updatedAt' });
sprintIssueSchema.index({ companyId: 1, projectId: 1, boardId: 1, sprintId: 1, issueUpdatedAt: -1 }, { name: 'sprintIssue_company_project_board_sprint_issueUpdatedAt' });
// Latest-per-issue aggregation groups after sorting by createdAt
sprintIssueSchema.index({ companyId: 1, projectId: 1, boardId: 1, sprintId: 1, issueId: 1, createdAt: -1 }, { name: 'sprintIssue_latest_per_issue' });

export const SprintIssueModel = (connection) => connection.model('SprintIssue', sprintIssueSchema);

const backlogIssueSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        projectId: { type: ObjectId },
        companyId: { type: ObjectId },
        sprintId: [{ type: Object }],
        boardId: { type: ObjectId },
        issueId: { type: Number },
        key: { type: String },
        summary: { type: String },
        originalEstimateHrs: { type: Number },
        developer: { type: [String], default: [] },
        timeSpentHrs: { type: Number },
        storyPoints: { type: Number },
        type: {
            id: String,
            name: String,
            description: String,
        },
        sprint: { type: Schema.Types.Mixed },
        status: { type: Schema.Types.Mixed },
        issueCreatedAt: { type: Date },
        issueUpdatedAt: { type: Date },
        assignee: { type: String },
        projectKeyId: { type: Number },
        priority: { type: String },
        fixVersion: { type: String },
        affectedVersion: { type: [String], default: null },
        label: { type: [String] },
        blockedBy: { type: [String], default: null },
        relatesTo: { type: [String], default: null },
        duedate: { type: Date },
        cycleTimeSpent: { type: String },
        backflowRate: { type: Number },
        sprintChangeLog: [
            {
                author: { type: String },
                timestamp: { type: Date },
                action: { type: String },
                fromSprintId: { type: String },
                toSprintId: { type: String },
                fromSprintString: { type: String },
                toSprintString: { type: String },
            },
        ],
        releaseChangeLog: [
            {
                author: { type: String },
                timestamp: { type: Date },
                action: { type: String },
                fromReleaseId: { type: String },
                toReleaseId: { type: String },
                fromReleaseString: { type: String },
                toReleaseString: { type: String },
            },
        ],
        statusChangeLog: [
            {
                changedAt: { type: Date },
                from: { type: String },
                to: { type: String },
            },
        ],
        epic: {
            key: { type: String },
            name: { type: String },
            summary: { type: String },
        },
        worklog: [
            {
                timeSpentHrs: { type: Number },
                created: { type: Date },
                updated: { type: Date },
                started: { type: Date },
            },
        ],
        customFields: { type: Object, default: {} },
        customFieldsByName: { type: Object, default: {} },
        severity: { type: String, default: null },
        estimationChangelog: [
            {
                changedAt: { type: Date },
                estimationType: { type: String, enum: ['storyPoint', 'originalEstimate'] },
                fromValue: { type: Number },
                toValue: { type: Number },
            },
        ],
        repoCreated: { type: Boolean, default: false },
    },
    { versionKey: false, timestamps: true }
);

export const BacklogIssueModel = (connection) => connection.model('BacklogIssue', backlogIssueSchema);

const jiraReleaseSchema = new Schema(
    {
        companyId: { type: ObjectId, required: true },
        projectId: { type: ObjectId, required: true },
        boardId: { type: ObjectId, required: true },
        releaseName: { type: String, required: true },
        startDate: { type: Date, required: true },
        releaseDate: { type: Date, required: true },
        status: { type: String, required: true },
        totalDays: { type: Number },
        isFallbackUsed: { type: Boolean, default: false },
        committedVsCompletedMetrics: committedVsCompletedMetricsSchema,
        idealBurnupByDev: [
            {
                assignee: { type: String, required: true },
                initialStoryPoints: { type: Number },
                initialOriginalEstimateHrs: { type: Number },
            },
        ],
        velocity: {
            planned: { type: Number, default: 0 },
            completed: { type: Number, default: 0 },
            completedLate: { type: Number, default: 0 },
            incomplete: { type: Number, default: 0 },
            hoursPlanned: { type: Number, default: 0 },
            hoursCompleted: { type: Number, default: 0 },
            hoursCompletedLate: { type: Number, default: 0 },
            hoursIncomplete: { type: Number, default: 0 },
        },
        burndownVelocity: burndownVelocitySchema,
        assignees: [
            {
                assignee: { type: String, required: true },
                availableHours: { type: Number },
                allocationType: { type: String },
                allocatedHours: { type: Number },
                role: { type: String },
                billingRate: { type: Number },
                holiday: { type: Number },
                leaves: { type: Number },
                netAvailableCapacity: { type: Number },
                addedManually: { type: String, enum: ['yes', 'no'], default: 'no' },
                sprintOrReleaseUser: { type: String, enum: ['yes', 'no'], default: 'no' },
                presentInPlan: { type: String, enum: ['yes', 'no'], default: 'yes' },
            },
        ],
        hours: { type: Boolean, default: false },
        cycleTime: {
            totalCycleTime: { type: Number, default: 0 },
            totalTimeSpent: { type: Number, default: 0 },
            numberOfIssues: { type: Number, default: 0 },
            cycleTimeByDeveloper: [
                {
                    developer: { type: String, default: null },
                    averageCycleTime: { type: Number, default: 0 },
                    totalIssues: { type: Number, default: 0 },
                    _id: false,
                },
            ],
        },
        assigneeCopiedForToday: { type: Boolean, default: false },
        overdue: { type: Boolean, default: false },
        releaseChurn: { type: [storyChurnSchema], default: [] },
        releaseBurndownData: {
            originalEstimateAtStart: { type: Number, default: 0 },
            completed: { type: Number, default: 0 },
            sprintBreakdown: [
                {
                    sprintId: { type: ObjectId },
                    sprintName: { type: String },
                    sprintStartDate: { type: Date },
                    sprintEndDate: { type: Date },
                    state: { type: String },
                    atStartOfSprint: { type: Number, default: 0 },
                    addedToVersion: { type: Number, default: 0 },
                    removedFromVersion: { type: Number, default: 0 },
                    completed: { type: Number, default: 0 },
                    remaining: { type: Number, default: 0 },
                    _id: false,
                },
            ],
            workForecast: {
                averageVelocity: { type: Number, default: 0 },
                remainingWork: { type: Number, default: 0 },
                sprintsRemaining: { type: Number, default: 0 },
                _id: false,
            },
            actualSprintLength: { type: Number },
            forecastedDate: { type: Date },
            lastCalculatedAt: { type: Date },
        },
        burndownData: {
            dailyData: [
                {
                    date: { type: String },
                    totalOriginalEstimate: { type: Number, default: 0 },
                    totalEffortSpent: { type: Number, default: 0 },
                    idealLine: { type: Number, default: 0 },
                    actualLine: { type: Number, default: 0 },
                    developerData: [
                        {
                            developer: { type: String },
                            originalEstimate: { type: Number, default: 0 },
                            effortSpent: { type: Number, default: 0 },
                            _id: false,
                        },
                    ],
                    _id: false,
                },
            ],
            totalOriginalEstimate: { type: Number, default: 0 },
            totalEffortSpent: { type: Number, default: 0 },
            lastCalculatedAt: { type: Date },
        },
        releaseBurnup: {
            sprintBreakdown: [{ type: Schema.Types.Mixed, _id: false }],
            lastCalculatedAt: { type: Date },
        },
        accuracyMetrics: accuracyMetricsSchema,
        riskAndAlerts: riskAndAlertsSchema,
        investmentProfile: {
            totalCompletedStoryPoints: { type: Number, default: 0 },
            totalCompletedHours: { type: Number, default: 0 },
            totalCompletedCost: { type: Number, default: 0 },
            totalCommittedTicketCost: { type: Number, default: 0 },
            issueTypeBreakdown: {
                type: [
                    {
                        issueType: { type: String },
                        committedTicketCount: { type: Number, default: 0 },
                        completedTicketCount: { type: Number, default: 0 },
                        completionPercentage: { type: Number, default: 0 },
                        completedPoints: { type: Number, default: 0 },
                        completedHours: { type: Number, default: 0 },
                        totalCompletedCost: { type: Number, default: 0 },
                        totalCommittedTicketCost: { type: Number, default: 0 },
                        assigneeBreakdown: {
                            type: [
                                {
                                    assignee: { type: String },
                                    committedTicketCount: { type: Number, default: 0 },
                                    completedTicketCount: { type: Number, default: 0 },
                                    completedPoints: { type: Number, default: 0 },
                                    billingRate: { type: Number, default: 0 },
                                    totalCompletedCost: { type: Number, default: 0 },
                                    totalCommittedTicketCost: { type: Number, default: 0 },
                                    _id: false,
                                },
                            ],
                            default: [],
                        },
                        _id: false,
                    },
                ],
                default: [],
            },
            sprintBreakdown: {
                type: [
                    {
                        sprintId: { type: ObjectId },
                        sprintName: { type: String },
                        state: { type: String },
                        totalCompletedStoryPoints: { type: Number, default: 0 },
                        totalCompletedHours: { type: Number, default: 0 },
                        startDate: { type: Date },
                        endDate: { type: Date },
                        issueTypeBreakdown: {
                            type: [
                                {
                                    issueType: { type: String },
                                    completedTicketCount: { type: Number, default: 0 },
                                    completedPoints: { type: Number, default: 0 },
                                    completedHours: { type: Number, default: 0 },
                                    _id: false,
                                },
                            ],
                            default: [],
                        },
                        _id: false,
                    },
                ],
                default: [],
            },
        },
        investmentProfileTicketCounts: {
            plannedTickets: { type: Number, default: 0 },
            unplannedTickets: { type: Number, default: 0 },
            completedTickets: { type: Number, default: 0 },
            spilloverTickets: { type: Number, default: 0 },
            assignees: { type: [String], default: [] },
            _id: false,
        },
    },
    { versionKey: false, timestamps: true }
);

// Release lookups by tenant + board ordered by date
jiraReleaseSchema.index({ companyId: 1, projectId: 1, boardId: 1, releaseDate: -1 }, { name: 'release_company_project_board_releaseDate' });

export const JiraReleaseModel = (connection) => connection.model('JiraRelease', jiraReleaseSchema);

const boardIssueSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        projectId: { type: ObjectId },
        companyId: { type: ObjectId },
        boardId: { type: ObjectId, required: true },
        issueId: { type: Number },
        key: { type: String },
        summary: { type: String },
        storyPoints: { type: Number },
        pointsSourceType: { type: String, default: null },
        pointsSourceRefName: { type: String, default: null },
        timeSpentHrs: { type: Number },
        originalEstimateHrs: { type: Number },
        developer: { type: [String], default: [] },
        type: {
            id: String,
            name: String,
            description: String,
        },
        status: { type: Schema.Types.Mixed },
        issueCreatedAt: { type: Date },
        issueUpdatedAt: { type: Date },
        workStartedAt: { type: Date },
        workCompletedAt: { type: Date },
        assignee: { type: String },
        projectKeyId: { type: Number },
        priority: { type: String },
        fixVersion: { type: String },
        label: { type: [String] },
        duedate: { type: Date },
        blockedBy: { type: [String], default: null },
        relatesTo: { type: [String], default: null },
        cycleTimeSpent: { type: String },
        backflowRate: { type: Number },
        statusChangeLog: [
            {
                changedAt: { type: Date },
                from: { type: String },
                to: { type: String },
            },
        ],
        releaseChangeLog: [
            {
                author: { type: String },
                timestamp: { type: Date },
                action: { type: String },
                fromReleaseId: { type: String },
                toReleaseId: { type: String },
                fromReleaseString: { type: String },
                toReleaseString: { type: String },
            },
        ],
        sprintChangeLog: [
            {
                author: { type: String },
                timestamp: { type: Date },
                action: { type: String },
                fromSprintId: { type: String },
                toSprintId: { type: String },
                fromSprintString: { type: String },
                toSprintString: { type: String },
            },
        ],
        epic: {
            key: { type: String },
            name: { type: String },
            summary: { type: String },
        },
        parentKey: { type: String, default: null },
        customFields: { type: Object, default: {} },
        customFieldsByName: { type: Object, default: {} },
        repoCreated: { type: Boolean, default: false },
        isAccepted: { type: Boolean, default: null },
    },
    { versionKey: false, timestamps: true }
);

// Kanban issue reads filter by tenant/board and sort by updatedAt/issueUpdatedAt
boardIssueSchema.index({ companyId: 1, projectId: 1, boardId: 1, updatedAt: -1 }, { name: 'boardIssue_company_project_board_updatedAt' });
boardIssueSchema.index({ companyId: 1, projectId: 1, boardId: 1, issueUpdatedAt: -1 }, { name: 'boardIssue_company_project_board_issueUpdatedAt' });
// Latest-per-issue aggregation
boardIssueSchema.index({ companyId: 1, projectId: 1, boardId: 1, issueId: 1, createdAt: -1 }, { name: 'boardIssue_latest_per_issue' });

export const BoardIssueModel = (connection) => connection.model('KanbanIssue', boardIssueSchema);

const boardSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        companyId: { type: ObjectId, required: true },
        projectId: { type: ObjectId, required: true },
        projectKeyId: { type: Number, required: true },

        boardId: { type: Number, required: true },
        boardName: { type: String, required: true },
        boardType: { type: String, required: true },
        boardSelf: { type: String },
        isPrivate: { type: Boolean, default: false },

        boardLocation: {
            projectId: { type: Number },
            projectName: { type: String },
            projectKey: { type: String },
            projectTypeKey: { type: String },
            avatarURI: { type: String },
            displayName: { type: String },
            name: { type: String },
        },

        assignees: [
            {
                accountId: { type: String },
                displayName: { type: String },
                emailAddress: { type: String },
                active: { type: Boolean },
            },
        ],
    },
    { versionKey: false, timestamps: true }
);

// Ensure fast board lookup and uniqueness within tenant/project
boardSchema.index({ companyId: 1, projectId: 1, boardId: 1 }, { name: 'board_company_project_boardId', unique: true });

export const BoardModel = (connection) => connection.model('Board', boardSchema);

const removedSprintIssueSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        projectId: { type: ObjectId },
        companyId: { type: ObjectId },
        sprintId: { type: ObjectId },
        boardId: { type: ObjectId },
        issueId: { type: Number },
        key: { type: String },
        summary: { type: String },
        originalEstimateHrs: { type: Number },
        developer: { type: [String], default: [] },
        timeSpentHrs: { type: Number },
        storyPoints: { type: Number },
        type: {
            id: String,
            name: String,
            description: String,
        },
        sprint: { type: Schema.Types.Mixed },
        status: { type: Schema.Types.Mixed },
        issueCreatedAt: { type: Date },
        issueUpdatedAt: { type: Date },
        assignee: { type: String },
        projectKeyId: { type: Number },
        priority: { type: String },
        fixVersion: { type: String },
        affectedVersion: { type: [String], default: null },
        label: { type: [String] },
        blockedBy: { type: [String], default: null },
        relatesTo: { type: [String], default: null },
        duedate: { type: Date },
        sprintChangeLog: [
            {
                author: { type: String },
                timestamp: { type: Date },
                action: { type: String },
                fromSprintId: { type: String },
                toSprintId: { type: String },
                fromSprintString: { type: String },
                toSprintString: { type: String },
            },
        ],
        releaseChangeLog: [
            {
                author: { type: String },
                timestamp: { type: Date },
                action: { type: String },
                fromReleaseId: { type: String },
                toReleaseId: { type: String },
                fromReleaseString: { type: String },
                toReleaseString: { type: String },
            },
        ],
        statusChangeLog: [
            {
                changedAt: { type: Date },
                from: { type: String },
                to: { type: String },
            },
        ],
        epic: {
            key: { type: String },
            name: { type: String },
            summary: { type: String },
        },
        worklog: [
            {
                timeSpentHrs: { type: Number },
                created: { type: Date },
                updated: { type: Date },
                started: { type: Date },
            },
        ],
        customFields: { type: Object, default: {} },
        customFieldsByName: { type: Object, default: {} },
        removedAt: { type: Date, default: Date.now },
        removedFromSprintId: { type: ObjectId },
        originalCreatedAt: { type: Date },
        originalUpdatedAt: { type: Date },
        estimationChangelog: [
            {
                changedAt: { type: Date },
                estimationType: { type: String, enum: ['storyPoint', 'originalEstimate'] },
                fromValue: { type: Number },
                toValue: { type: Number },
            },
        ],
    },
    { versionKey: false, timestamps: true }
);

export const RemovedSprintIssueModel = (connection) => connection.model('RemovedSprintIssue', removedSprintIssueSchema);
