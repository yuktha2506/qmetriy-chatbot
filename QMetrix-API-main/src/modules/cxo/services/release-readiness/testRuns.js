import mongoose from 'mongoose';
import { ProjectModel } from '../../../project-management/jira/model.js';
import { TestProjectModel, TestRunModel } from '../../../test-management/testrail/model.js';
import { XrayProjectModel, XrayExecutionModel } from '../../../test-management/xray/model.js';

class TestRunsService {
    async getTestRuns(companyId, projectId, keyId, idType, connection) {
        try {
            const TestRun = TestRunModel(connection);
            const TestProject = TestProjectModel(connection);
            const XrayExecution = XrayExecutionModel(connection);
            const XrayProject = XrayProjectModel(connection);
            const Project = ProjectModel(connection);

            const project = await Project.findOne({ _id: new mongoose.Types.ObjectId(projectId) })
                .select('name boardType')
                .lean();

            const isKanban = project?.boardType === 'kanban';
            if (isKanban) {
                idType = 'release';
            }

            if (idType !== 'sprint' && idType !== 'release') {
                throw new Error('Invalid idType: Must be "sprint" or "release"');
            }

            // Try TestRail first
            const testProject = await TestProject.findOne({ jiraProjectId: new mongoose.Types.ObjectId(projectId) })
                .select('users')
                .lean();

            // If no TestRail, try Xray
            let testSource = 'testrail';
            
            if (!testProject) {
                // XrayProject now stores jiraProjectId as MongoDB Project ObjectId
                const xrayProject = await XrayProject.findOne({ 
                    jiraProjectId: new mongoose.Types.ObjectId(projectId)
                })
                    .select('users')
                    .lean();
                
                if (!xrayProject) {
                    console.warn('[TestRuns] No Xray project found');
                    return {
                        manualTestResult: null,
                        automationTestResult: null,
                    };
                }
                
                testSource = 'xray';
            }

            const matchQuery = {
                companyId: new mongoose.Types.ObjectId(companyId),
                jiraProjectId: new mongoose.Types.ObjectId(projectId),
            };

            if (idType === 'sprint') {
                matchQuery.sprintId = new mongoose.Types.ObjectId(keyId);
            } else if (idType === 'release') {
                matchQuery.releaseName = keyId;
            }

            const getLatestRunFromObject = (runObject) => {
                if (!runObject || typeof runObject !== 'object') {
                    return null;
                }
                const runs = Object.values(runObject);
                if (!runs.length) {
                    return null;
                }
                return runs.reduce((latest, current) => {
                    const t1 = new Date(latest.updated_on || latest.created_on || 0);
                    const t2 = new Date(current.updated_on || current.created_on || 0);
                    return t2 > t1 ? current : latest;
                });
            };

            const sumCounts = (runs) => {
                return Object.values(runs).reduce(
                    (acc, run) => {
                        acc.passed += run.passed_count || 0;
                        acc.failed += run.failed_count || 0;
                        acc.untested += run.untested_count || 0;
                        acc.blocked += run.blocked_count || 0;
                        acc.retest += run.retest_count || 0;
                        return acc;
                    },
                    { passed: 0, failed: 0, untested: 0, blocked: 0, retest: 0 }
                );
            };

            const calculatePercentage = (summary) => {
                const total = summary.passed + summary.failed + summary.untested + summary.blocked + summary.retest;
                return total > 0 ? Math.round((summary.passed / total) * 100) : 0;
            };

            const formatRun = (run) => {
                const passed = run?.passed_count || 0;
                const failed = run?.failed_count || 0;
                const blocked = run?.blocked_count || 0;
                const retest = run?.retest_count || 0;
                const untested = run?.untested_count || 0;
                const executed = passed + failed; // Number of test cases actually executed
                
                return {
                    passed,
                    failed,
                    blocked,
                    retest,
                    untested,
                    executed,
                    percentage: run?.manual_percentage || run?.pass_percentage || 0,
                };
            };

            if (idType === 'sprint') {
                // Choose the correct model based on test source
                const TestModel = testSource === 'testrail' ? TestRun : XrayExecution;
                const testRun = await TestModel.findOne(matchQuery).sort({ updatedAt: -1 }).lean();
                
                if (!testRun) {
                    return {
                        manualTestResult: null,
                        automationTestResult: null,
                    };
                }

                // Handle both Array (Xray) and Object/Map (TestRail) formats
                const latestManualRun = Array.isArray(testRun.manualRuns) 
                    ? testRun.manualRuns[0]  // For Xray arrays, take first (most recent)
                    : getLatestRunFromObject(testRun.manualRuns);  // For TestRail objects
                    
                const latestAutomationRun = Array.isArray(testRun.automationRuns)
                    ? testRun.automationRuns[0]  // For Xray arrays, take first (most recent)
                    : getLatestRunFromObject(testRun.automationRuns);  // For TestRail objects

                // For Xray (array), aggregate all runs; for TestRail, use single run
                if (Array.isArray(testRun.manualRuns) && testRun.manualRuns.length > 0) {
                    // Xray: Aggregate all manual runs
                    const manualSummary = testRun.manualRuns.reduce(
                        (acc, run) => ({
                            passed: acc.passed + (run.passed_count || 0),
                            failed: acc.failed + (run.failed_count || 0),
                            untested: acc.untested + (run.untested_count || 0),
                            blocked: acc.blocked + (run.blocked_count || 0),
                            retest: acc.retest + (run.retest_count || 0),
                        }),
                        { passed: 0, failed: 0, untested: 0, blocked: 0, retest: 0 }
                    );
                    const manualTotal = manualSummary.passed + manualSummary.failed + manualSummary.untested + manualSummary.blocked + manualSummary.retest;
                    const manualExecuted = manualSummary.passed + manualSummary.failed; // Number of test cases actually executed
                    const manualPercentage = manualTotal > 0 ? Math.round((manualSummary.passed / manualTotal) * 100) : 0;
                    
                    const automationSummary = (testRun.automationRuns || []).reduce(
                        (acc, run) => ({
                            passed: acc.passed + (run.passed_count || 0),
                            failed: acc.failed + (run.failed_count || 0),
                            untested: acc.untested + (run.untested_count || 0),
                            blocked: acc.blocked + (run.blocked_count || 0),
                            retest: acc.retest + (run.retest_count || 0),
                        }),
                        { passed: 0, failed: 0, untested: 0, blocked: 0, retest: 0 }
                    );
                    const automationTotal = automationSummary.passed + automationSummary.failed + automationSummary.untested + automationSummary.blocked + automationSummary.retest;
                    const automationExecuted = automationSummary.passed + automationSummary.failed; // Number of test cases actually executed
                    const automationPercentage = automationTotal > 0 ? Math.round((automationSummary.passed / automationTotal) * 100) : 0;
                    
                    return {
                        manualTestResult: {
                            ...manualSummary,
                            executed: manualExecuted,
                            percentage: manualPercentage,
                            manualPercentage: manualPercentage,
                            name: testRun.sprintName || testRun.summary || 'NA',
                        },
                        automationTestResult: {
                            ...automationSummary,
                            executed: automationExecuted,
                            percentage: automationPercentage,
                            automationPercentage: automationPercentage,
                            name: testRun.sprintName || testRun.summary || 'NA',
                        },
                    };
                }
                
                // TestRail: Use single latest run
                return {
                    manualTestResult: {
                        ...formatRun(latestManualRun),
                        manualPercentage: latestManualRun?.manual_percentage || latestManualRun?.pass_percentage || 0,
                        name: latestManualRun?.name || 'NA',
                    },
                    automationTestResult: {
                        ...formatRun(latestAutomationRun),
                        automationPercentage: latestAutomationRun?.manual_percentage || latestAutomationRun?.pass_percentage || 0,
                        name: latestAutomationRun?.name || 'NA',
                    },
                };
            }

            if (idType === 'release') {
                // Choose the correct model based on test source
                const TestModel = testSource === 'testrail' ? TestRun : XrayExecution;
                
                const allTestRuns = await TestModel.find({
                    ...matchQuery,
                    releaseName: keyId, 
                }).lean();

                if (!allTestRuns.length) {
                    return {
                        manualTestResult: null,
                        automationTestResult: null,
                    };
                }

                // Handle both Array (Xray) and Object/Map (TestRail) formats
                let combinedManualRuns, combinedAutomationRuns;
                
                if (testSource === 'xray') {
                    // Xray: Flatten arrays
                    combinedManualRuns = allTestRuns
                        .map((r) => r.manualRuns)
                        .filter(Boolean)
                        .flat();
                    
                    combinedAutomationRuns = allTestRuns
                        .map((r) => r.automationRuns)
                        .filter(Boolean)
                        .flat();
                } else {
                    // TestRail: Merge objects
                    combinedManualRuns = allTestRuns
                        .map((r) => r.manualRuns)
                        .filter(Boolean)
                        .reduce((acc, runs) => ({ ...acc, ...runs }), {});

                    combinedAutomationRuns = allTestRuns
                        .map((r) => r.automationRuns)
                        .filter(Boolean)
                        .reduce((acc, runs) => ({ ...acc, ...runs }), {});
                }

                // Calculate summaries (works for both array and object)
                const manualSummary = Array.isArray(combinedManualRuns)
                    ? combinedManualRuns.reduce(
                        (acc, run) => ({
                            passed: acc.passed + (run.passed_count || 0),
                            failed: acc.failed + (run.failed_count || 0),
                            untested: acc.untested + (run.untested_count || 0),
                            blocked: acc.blocked + (run.blocked_count || 0),
                            retest: acc.retest + (run.retest_count || 0),
                        }),
                        { passed: 0, failed: 0, untested: 0, blocked: 0, retest: 0 }
                    )
                    : sumCounts(combinedManualRuns);
                    
                const automationSummary = Array.isArray(combinedAutomationRuns)
                    ? combinedAutomationRuns.reduce(
                        (acc, run) => ({
                            passed: acc.passed + (run.passed_count || 0),
                            failed: acc.failed + (run.failed_count || 0),
                            untested: acc.untested + (run.untested_count || 0),
                            blocked: acc.blocked + (run.blocked_count || 0),
                            retest: acc.retest + (run.retest_count || 0),
                        }),
                        { passed: 0, failed: 0, untested: 0, blocked: 0, retest: 0 }
                    )
                    : sumCounts(combinedAutomationRuns);

                const manualExecuted = manualSummary.passed + manualSummary.failed; // Number of test cases actually executed
                const automationExecuted = automationSummary.passed + automationSummary.failed; // Number of test cases actually executed
                const manualPercentage = calculatePercentage(manualSummary);
                const automationPercentage = calculatePercentage(automationSummary);
                
                const extractBaseName = (runObj) => {
                    if (Array.isArray(runObj) && runObj.length > 0) {
                        const sampleName = runObj[0]?.name || '';
                        const index = sampleName.indexOf(' - ');
                        return index !== -1 ? sampleName.substring(0, index).trim() : sampleName;
                    }
                    const sampleName = Object.values(runObj)[0]?.name || '';
                    const index = sampleName.indexOf(' - ');
                    return index !== -1 ? sampleName.substring(0, index).trim() : sampleName;
                };
                const releaseName = extractBaseName(combinedManualRuns) || extractBaseName(combinedAutomationRuns) || keyId;
                
                return {
                    manualTestResult: {
                        ...manualSummary,
                        executed: manualExecuted,
                        percentage: manualPercentage,
                        name: releaseName,
                    },
                    automationTestResult: {
                        ...automationSummary,
                        executed: automationExecuted,
                        percentage: automationPercentage,
                        name: releaseName,
                    },
                };
            }

            return {
                manualTestResult: null,
                automationTestResult: null,
            };
        } catch (error) {
            console.error(`Error calculating test productivity for ${idType}:`, error);
            throw new Error(`Failed to get test runs for ${idType}: ${error.message}`);
        }
    }
}

export default new TestRunsService();
