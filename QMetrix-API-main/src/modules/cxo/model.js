import { Schema, ObjectId } from 'mongoose';

const cxoSchema = new Schema(
    {
        _id: { type: ObjectId, auto: true },
        projectId: { type: ObjectId, required: true },
        companyId: { type: ObjectId, required: true },
        boardId: { type: ObjectId },
        sprintId: { type: ObjectId },
        releaseVersion: { type: String },
        projectKeyId: { type: Number, required: true },
        engineeringScoreObject: {
            engineeringScore: { type: Number },
            developerScoreObject: {
                developerScore: { type: Number },
                releaseCycleTime: { type: Number, default: 0 },
                changeFailureRate: { type: Number, default: 0 },
                reworkRatio: { type: Number, default: 0 },
                codeCoverage: { type: Number, default: 0 },
                automationDone: { type: Number, default: 0 },
                staticCodeAnalysis: { type: Number, default: 0 },
                defectDensity: {
                    totalBugs: { type: Number, default: 0 },
                    ncloc: { type: Number, default: 0 },
                    density: { type: Number, default: 0 },
                },
                timeToFix: {
                    averageTimeToFix: { type: Number },
                    totalResolvedBugs: { type: Number },
                    totalTimeSpent: { type: Number },
                },
                sonarQubeScanReport: [
                    {
                        repo: { type: String },
                        staticCodeAnalysisScore: { type: Number, default: 0 },
                        duplicated_files: { type: Number, default: 0 },
                        ncloc: { type: Number, default: 0 },
                        vulnerabilities: { type: Number, default: 0 },
                        security_hotspots: { type: Number, default: 0 },
                        duplicated_blocks: { type: Number, default: 0 },
                        duplicated_lines: { type: Number, default: 0 },
                        code_smells: { type: Number, default: 0 },
                        _id: false,
                    },
                ],
                combinedScanData: {
                    staticCodeAnalysisScore: { type: Number, default: 0 },
                    duplicated_files: { type: Number, default: 0 },
                    ncloc: { type: Number, default: 0 },
                    vulnerabilities: { type: Number, default: 0 },
                    security_hotspots: { type: Number, default: 0 },
                    duplicated_blocks: { type: Number, default: 0 },
                    duplicated_lines: { type: Number, default: 0 },
                    code_smells: { type: Number, default: 0 },
                    _id: false,
                },
                cycleTime: {
                    totalCycleTime: { type: Number },
                    totalTimeSpent: { type: Number },
                    numberOfIssues: { type: Number },
                },
            },
            testScoreObject: {
                testScore: { type: Number },
                testingQuality: {
                    totalBugs: { type: Number },
                    lowPriorityBugs: { type: Number },
                    testingquality: { type: Number },
                },

                defectEscapeRatio: { type: Number },
                testCoverage: { type: Number, default: 0 },
                testAutomation: { type: Number, default: 0 },
                testCycleTime: { type: Number, default: 0 },
                traceability: { type: Number, default: 0 },
                testingProductivity: {
                    executedTestCases: { type: Number, default: 0 },
                    teamSize: { type: Number, default: 0 },
                    productivityPercentage: { type: Number, default: 0 },
                    passed: { type: Number, default: 0 },
                    failed: { type: Number, default: 0 },
                    blocked: { type: Number, default: 0 },
                    untested: { type: Number, default: 0 },
                    retest: { type: Number, default: 0 },
                },
                automationTestingProductivity: {
                    executedTestCases: { type: Number, default: 0 },
                    teamSize: { type: Number, default: 0 },
                    productivityPercentage: { type: Number, default: 0 },
                    passed: { type: Number, default: 0 },
                    failed: { type: Number, default: 0 },
                    blocked: { type: Number, default: 0 },
                    untested: { type: Number, default: 0 },
                    retest: { type: Number, default: 0 },
                },
                dlaObject: {
                    totalBugs: { type: Number, default: 0 },
                    prodBugs: { type: Number, default: 0 },
                    uatBugs: { type: Number, default: 0 },
                    escapedBugs: { type: Number, default: 0 },
                    dla: { type: Number, default: 0 },
                },
            },
            operationScoreObject: {
                operationScore: { type: Number },
                deploymentFrequencyScore: { type: Number, default: 0 },
                changeFailureRateScore: { type: Number, default: 0 },
                meanTimeToRecoveryScore: { type: Number, default: 0 },
                leadTimeForChangesScore: { type: Number, default: 0 },
            },
        },
        releaseReadinessObject: {
            stories: { type: Number, default: 0 },
            bugs: { type: Number, default: 0 },
            tasks: { type: Number, default: 0 },
            epics: { type: Number, default: 0 },
            releaseReadiness: { type: Number, default: 0 },
            testCoverage: { type: Number, default: 0 },
            burndown: {
                burndownPercentage: { type: Number },
                originalEstimate: { type: Number },
                totalSpent: { type: Number },
                originalEstimateHrs: { type: Number },
                timeSpentHrs: { type: Number },
                burndownHrsPercentage: { type: Number },
                completedHours: { type: Number, default: 0 },
                completedStoryPoints: { type: Number, default: 0 },
            },
            manualTestResult: {
                name: { type: String, default: null },
                passed: { type: Number, default: 0 },
                failed: { type: Number, default: 0 },
                blocked: { type: Number, default: 0 },
                retest: { type: Number, default: 0 },
                untested: { type: Number, default: 0 },
                percentage: { type: String, default: '0%' },
            },
            automationTestResult: {
                name: { type: String, default: null },
                passed: { type: Number, default: 0 },
                failed: { type: Number, default: 0 },
                blocked: { type: Number, default: 0 },
                retest: { type: Number, default: 0 },
                untested: { type: Number, default: 0 },
                percentage: { type: String, default: '0%' },
            },
            staticCodeAnalysis: { type: Number },
        },
        velocityObject: {
            velocity: { type: Number },
        },
    },
    { versionKey: false, timestamps: true }
);

// CXO reads typically scoped by tenant/project/board/sprint/release
cxoSchema.index({ companyId: 1, projectId: 1, boardId: 1, sprintId: 1, releaseVersion: 1 }, { name: 'cxo_company_project_board_sprint_release' });

export const CXOModel = (connection) => connection.model('CXO', cxoSchema);
