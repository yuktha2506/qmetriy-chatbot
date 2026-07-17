import { Schema, ObjectId } from 'mongoose';

const testRailSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        companyId: { type: ObjectId },
        jiraProjectId: { type: ObjectId },
        projectId: { type: Number },
        name: { type: String },
        completedOn: { type: Date },
        url: { type: String },
        users: [
            {
                projectId: { type: Number },
                groupIds: [Number],
                email: { type: String },
                is_active: { type: Boolean },
                role: { type: String },
                role_id: { type: Number },
            },
        ],
    },
    { versionKey: false, timestamps: true }
);

// Testrail projects fetched per tenant/Jira project
testRailSchema.index({ companyId: 1, jiraProjectId: 1, projectId: 1 }, { name: 'testrail_project_company_jira_project' });
export const TestProjectModel = (connection) => connection.model('Testrailproject', testRailSchema);

const testRunSchema = new Schema(
    {
        id: { type: Number },
        name: { type: String },
        description: { type: String },
        is_completed: { type: Boolean },
        completed_on: { type: Date },
        passed_count: { type: Number },
        untested_count: { type: Number },
        blocked_count: { type: Number },
        retest_count: { type: Number },
        failed_count: { type: Number },
        project_id: { type: Number, required: true },
        manual_percentage: { type: Number, required: true },
        url: { type: String, required: true },
        created_on: { type: Date },
        updated_on: { type: Date },
    },
    { _id: false }
);

const testRailDataSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        companyId: { type: ObjectId, required: true },
        jiraProjectId: { type: ObjectId },
        testProjectId: { type: Number },
        sprintId: { type: ObjectId, ref: 'Sprint', default: null },
        sprintName: { type: String },
        releaseId: { type: ObjectId, ref: 'Release', default: null },
        releaseName: { type: String },
        boardId: { type: Number },
        boardName: { type: String },
        name: { type: String },
        url: { type: String },
        manualRuns: {
            type: Map,
            of: testRunSchema,
            default: {},
        },
        automationRuns: {
            type: Map,
            of: testRunSchema,
            default: {},
        },
        completedOn: { type: Date },
    },
    { versionKey: false, timestamps: true }
);

// Test run data filtered by tenant/project/sprint/release/board
testRailDataSchema.index(
    { companyId: 1, jiraProjectId: 1, boardId: 1, sprintId: 1, releaseId: 1, testProjectId: 1 },
    { name: 'testrail_runs_company_project_board_sprint_release' }
);

export const TestRunModel = (connection) => connection.model('TestrailRuns', testRailDataSchema);

const testCaseMetricsSchema = new Schema(
    {
        references: { type: Number, default: 0 },
        casesWithReferences: { type: Number, default: 0 },
        casesWithoutReferences: { type: Number, default: 0 },
        automatedCasesCount: { type: Number, default: 0 },
        testsToBeAutomatedCount: { type: Number, default: 0 },
        newlyAddedCasesCount: { type: Number, default: 0 },
    },
    { _id: false }
);

const testRunDetailSchema = new Schema(
    {
        id: { type: Number },
        suite_id: { type: Number },
        name: { type: String },
        milestone_id: { type: Number },
        assignedto_id: { type: Number },
        include_all: { type: Boolean },
        is_completed: { type: Boolean },
        completed_on: { type: Date },
        passed_count: { type: Number },
        blocked_count: { type: Number },
        untested_count: { type: Number },
        retest_count: { type: Number },
        failed_count: { type: Number },
        project_id: { type: Number },
        created_on: { type: Date },
        updated_on: { type: Date },
        refs: { type: String },
        created_by: { type: Number },
        start_on: { type: Date },
        due_on: { type: Date },
        pass_percentage: { type: Number, default: 0 },
        manual_percentage: { type: Number, default: 0 },
        automation_percentage: { type: Number, default: 0 },
        testCaseMetrics: testCaseMetricsSchema,
    },
    { _id: false }
);

const testRailMilestoneSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        companyId: { type: ObjectId, required: true },
        jiraProjectId: { type: ObjectId, required: true },
        sprintId: { type: ObjectId, ref: 'Sprint', default: null },
        releaseId: { type: ObjectId, ref: 'Release', default: null },
        boardId: { type: ObjectId, ref: 'Board', default: null },
        testrailProjectId: { type: Number, required: true },
        milestoneId: { type: Number, required: true },
        name: { type: String },
        startOn: { type: Date },
        startedOn: { type: Date },
        isCompleted: { type: Boolean },
        completedOn: { type: Date },
        dueOn: { type: Date },
        parentId: { type: Number },
        startIsOn: { type: Date },
        manualRuns: [testRunDetailSchema],
        automationRuns: [testRunDetailSchema],
        totalReferences: { type: Number, default: 0 },
    },
    { versionKey: false, timestamps: true }
);

// Milestone lookups by tenant/Jira project/board/sprint/release
testRailMilestoneSchema.index(
    { companyId: 1, jiraProjectId: 1, boardId: 1, sprintId: 1, releaseId: 1, testrailProjectId: 1, milestoneId: 1 },
    { name: 'testrail_milestone_company_project_board_sprint_release' }
);

export const TestRailMilestoneModel = (connection) => connection.model('TestrailMilestone', testRailMilestoneSchema);
