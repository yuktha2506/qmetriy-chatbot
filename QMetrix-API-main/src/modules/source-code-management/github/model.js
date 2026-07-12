import { Schema, ObjectId } from 'mongoose';

const CommitSchema = new Schema(
    {
        commitId: { type: String, required: true },
        message: { type: String, required: true },
        committerName: { type: String, required: true },
        committerEmail: { type: String, required: true },
        date: { type: Date, required: true },
    },
    { _id: false }
);

const ReviewSchema = new Schema(
    {
        reviewerId: { type: String },
        reviewerUsername: { type: String },
        reviewState: {
            type: String,
            enum: ['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED'],
            required: true,
        },
        reviewDate: { type: Date },
        reviewComment: { type: String },
        reviewId: { type: String },
        isLatest: { type: Boolean },
    },
    { _id: false }
);

const SensitiveFileSchema = new Schema(
    {
        filename: { type: String, required: true },
        status: { type: String },
        additions: { type: Number, default: 0 },
        deletions: { type: Number, default: 0 },
        changes: { type: Number, default: 0 },
    },
    { _id: false }
);

const pullRequestSchema = new Schema(
    {
        companyId: { type: ObjectId, required: true },
        projectId: { type: ObjectId },
        boardId: { type: ObjectId },
        fixVersion: { type: String },
        repo: { type: String, required: true },
        sprintId: [{ type: ObjectId }],
        title: { type: String, required: true },
        projectKey: { type: String, required: true },
        status: { type: String, required: true },
        prId: { type: String, required: true, unique: true },
        prCreatedAt: { type: Date, default: Date.now },
        prClosedAt: { type: Date },
        prMergedAt: { type: Date },
        prCreatedBy: { type: String, required: true },
        prMergedBy: { type: String },
        filesChanged: { type: Number, default: 0 },
        linesAdded: { type: Number, default: 0 },
        linesDeleted: { type: Number, default: 0 },
        reviewComments: { type: Number, default: 0 },
        mergeable: { type: String },
        merged: { type: String },
        prNumber: { type: Number },
        branchName: { type: String },
        reviews: { type: [ReviewSchema] },
        commits: { type: [CommitSchema] },
        hasSensitiveChanges: { type: Boolean, default: false },
        sensitiveFiles: { type: [SensitiveFileSchema], default: [] },
        missingTests: {
            hasMissingTests: { type: Boolean, default: false },
            codeFilesChanged: { type: Number, default: 0 },
            testFilesChanged: { type: Number, default: 0 },
        },
    },
    {
        versionKey: false,
        timestamps: true,
    }
);

// Pull request reads filtered by tenant/project/board/sprint/repo and time
pullRequestSchema.index(
    { companyId: 1, projectId: 1, boardId: 1, sprintId: 1, repo: 1, prCreatedAt: -1 },
    { name: 'pr_company_project_board_sprint_repo_createdAt' }
);
// Fetch latest PR per branch/project
pullRequestSchema.index({ companyId: 1, projectId: 1, boardId: 1, branchName: 1, prCreatedAt: -1 }, { name: 'pr_company_project_board_branch_createdAt' });

export const PullRequestModel = (connection) => connection.model('PullRequest', pullRequestSchema);

const doraMetricsSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        companyId: { type: ObjectId, required: true },
        projectId: { type: ObjectId, required: true },
        boardId: { type: ObjectId },
        sprintId: { type: ObjectId },
        releaseId: { type: ObjectId },
        repoName: { type: String, required: true },
        metricName: { type: String, required: true },
        metrics: {
            deploymentFrequency: {
                successCount: { type: Number },
                totalDays: { type: Number },
                daysTracked: { type: Number },
                avgDeploymentsPerDay: { type: Number },
            },
            changeFailureRate: {
                successCount: { type: Number },
                failureCount: { type: Number },
                totalDeployments: { type: Number },
                changeFailureRate: { type: String },
                daysTracked: { type: Number },
            },
            mttr: {
                totalFailures: { type: Number },
                totalRecoveryTime: { type: Number },
                mttr: { type: Number },
            },
            leadTime: { type: Number, default: 0 },
        },
    },

    { versionKey: false, timestamps: true }
);

// DORA metrics grouped by tenant/project/board/sprint/release/repo and metric
doraMetricsSchema.index(
    { companyId: 1, projectId: 1, boardId: 1, sprintId: 1, releaseId: 1, repoName: 1, metricName: 1 },
    { name: 'dora_company_project_board_sprint_release_repo_metric' }
);

export const DoraMetricsModel = (connection) => connection.model('DoraMetrics', doraMetricsSchema);
