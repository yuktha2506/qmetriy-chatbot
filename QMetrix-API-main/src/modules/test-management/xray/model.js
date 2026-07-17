import { Schema, ObjectId } from 'mongoose';

const xrayUserSchema = new Schema(
    {
        accountId: { type: String },
        email: { type: String },
        displayName: { type: String },
        active: { type: Boolean },
        accountType: { type: String },
    },
    { _id: false }
);

const xrayProjectSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        companyId: { type: ObjectId, required: true },
        jiraProjectId: { type: ObjectId },
        projectKey: { type: String, required: true },
        name: { type: String },
        url: { type: String },
        users: [xrayUserSchema],
    },
    { versionKey: false, timestamps: true }
);

xrayProjectSchema.index({ companyId: 1, projectKey: 1 }, { name: 'xray_project_company_projectKey', unique: true });

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

const xrayRunSchema = new Schema(
    {
        id: { type: String },
        key: { type: String },
        name: { type: String },
        description: { type: String },
        status: { type: String },
        type: { type: String },
        is_completed: { type: Boolean },
        completed_on: { type: Date },
        passed_count: { type: Number },
        blocked_count: { type: Number },
        untested_count: { type: Number },
        retest_count: { type: Number },
        failed_count: { type: Number },
        project_id: { type: String },
        manual_percentage: { type: Number },
        pass_percentage: { type: Number },
        url: { type: String },
        created_on: { type: Date },
        updated_on: { type: Date },
        storyKey: { type: String },
        sprintId: { type: String },
        sprintName: { type: String },
        releaseName: { type: String },
        testCaseMetrics: testCaseMetricsSchema,
    },
    { _id: false }
);

const xrayExecutionSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        companyId: { type: ObjectId, required: true },
        jiraProjectId: { type: ObjectId },
        projectKey: { type: String, required: true },
        testExecKey: { type: String, required: true },
        sourceType: { type: String, default: 'execution' },
        summary: { type: String },
        status: { type: String },
        startedAt: { type: Date },
        finishedAt: { type: Date },
        boardId: [{ type: ObjectId }],
        sprintId: [{ type: ObjectId }],
        sprintName: { type: String },
        releaseId: { type: ObjectId },
        releaseName: { type: String },
        testsCount: { type: Number, default: 0 },
        testsPassed: { type: Number, default: 0 },
        testsFailed: { type: Number, default: 0 },
        testsBlocked: { type: Number, default: 0 },
        testsOther: { type: Number, default: 0 },
        manualTests: { type: Number, default: 0 },
        automationTests: { type: Number, default: 0 },
        manualRuns: [xrayRunSchema],
        automationRuns: [xrayRunSchema],
        totalReferences: { type: Number, default: 0 },
        testCaseMetrics: testCaseMetricsSchema,
    },
    { versionKey: false, timestamps: true }
);

xrayExecutionSchema.index({ companyId: 1, projectKey: 1, testExecKey: 1 }, { name: 'xray_exec_company_project_key', unique: true });
xrayExecutionSchema.index({ companyId: 1, projectKey: 1, sprintId: 1 }, { name: 'xray_exec_company_project_sprint' });
xrayExecutionSchema.index({ companyId: 1, projectKey: 1, boardId: 1 }, { name: 'xray_exec_company_project_board' });
xrayExecutionSchema.index({ companyId: 1, projectKey: 1, releaseId: 1 }, { name: 'xray_exec_company_project_release' });

export const XrayProjectModel = (connection) => connection.model('XrayProject', xrayProjectSchema);
export const XrayExecutionModel = (connection) => connection.model('XrayExecution', xrayExecutionSchema);
