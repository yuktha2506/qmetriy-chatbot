import { TestProjectModel, TestRunModel } from '../../../../test-management/testrail/model.js';
import { XrayProjectModel, XrayExecutionModel } from '../../../../test-management/xray/model.js';
import { ProjectModel } from '../../../../project-management/jira/model.js';
import mongoose from 'mongoose';

class TestProductivityService {
    async getTestProductivity(companyId, projectId, keyId, idType, connection ) {
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

            // Try TestRail first
            const testProject = await TestProject.findOne({ jiraProjectId: new mongoose.Types.ObjectId(projectId) })
                .select('users')
                .lean();

            // If no TestRail, try Xray
            let testSource = 'testrail';
            let users = testProject?.users;
            
            if (!testProject) {
                // eslint-disable-next-line no-console
                
                // XrayProject now stores jiraProjectId as MongoDB Project ObjectId
                const xrayProject = await XrayProject.findOne({ 
                    jiraProjectId: new mongoose.Types.ObjectId(projectId)
                })
                    .select('users')
                    .lean();
                
                if (xrayProject) {
                    testSource = 'xray';
                    users = xrayProject?.users;
                } else {
                    console.warn('[TestProductivity] No Xray project found');
                }
            }

            const teamSize = Array.isArray(users) ? users?.length : 0;

            const matchQuery = {
                companyId: new mongoose.Types.ObjectId(companyId),
                jiraProjectId: new mongoose.Types.ObjectId(projectId),
            };

            // Intentionally do not filter TestRail runs by boardId here: Release Readiness
            // (`testRuns.js`) uses the same company + project + sprint/release scope only.
            // Board-scoped boardId on runs often mismatches or is unset, which zeroed productivity
            // while manual/automation test results still showed data.

            if (idType === 'sprint') {
                matchQuery.sprintId = new mongoose.Types.ObjectId(keyId);
            } else if (idType === 'release') {
                matchQuery.releaseName = keyId;
            }

            const safe = (v) => {
                if (typeof v === 'number') {
                    return v;
                }
                if (typeof v === 'string' && !isNaN(Number(v))) {
                    return Number(v);
                }
                return 0;
            };

            const emptyStatus = () => ({
                passed: 0,
                failed: 0,
                blocked: 0,
                untested: 0,
                retest: 0,
            });

            const statusFromRun = (run) => {
                if (!run) {
                    return emptyStatus();
                }
                return {
                    passed: safe(run.passed_count ?? run.passedCount ?? run.passed ?? 0),
                    failed: safe(run.failed_count ?? run.failedCount ?? run.failed ?? 0),
                    blocked: safe(run.blocked_count ?? run.blockedCount ?? run.blocked ?? 0),
                    untested: safe(run.untested_count ?? run.untestedCount ?? run.untested ?? 0),
                    retest: safe(run.retest_count ?? run.retestCount ?? run.retest ?? 0),
                };
            };

            const addStatus = (a, b) => ({
                passed: a.passed + b.passed,
                failed: a.failed + b.failed,
                blocked: a.blocked + b.blocked,
                untested: a.untested + b.untested,
                retest: a.retest + b.retest,
            });

            /** Sum passed/failed/blocked/untested/retest across runs (array or id→run map). */
            const aggregateStatusFromRuns = (runs) => {
                if (!runs) {
                    return emptyStatus();
                }
                if (Array.isArray(runs)) {
                    return runs.reduce((acc, run) => addStatus(acc, statusFromRun(run)), emptyStatus());
                }
                if (typeof runs === 'object') {
                    return Object.values(runs).reduce((acc, run) => addStatus(acc, statusFromRun(run)), emptyStatus());
                }
                return emptyStatus();
            };

            const sumCounts = (run) => {
                if (!run) {
                    return 0;
                }
                const s = statusFromRun(run);
                return s.passed + s.failed;
            };

            const productivityBlock = (executed, team, status) => ({
                executedTestCases: executed,
                teamSize: team,
                productivityPercentage: team ? Math.round(executed / team) : 0,
                passed: status.passed,
                failed: status.failed,
                blocked: status.blocked,
                untested: status.untested,
                retest: status.retest,
            });

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

            // Choose the correct model based on test source
            const TestModel = testSource === 'testrail' ? TestRun : XrayExecution;

            if (idType === 'sprint') {
                const testRun = await TestModel.findOne(matchQuery).sort({ updatedAt: -1 }).lean();

                if (!testRun) {
                    const z = emptyStatus();
                    return {
                        manualProductivity: productivityBlock(0, teamSize, z),
                        automationProductivity: productivityBlock(0, teamSize, z),
                    };
                }

                // Handle both Array (Xray) and Object/Map (TestRail) formats
                let manualExecuted;
                let automationExecuted;
                let manualStatus;
                let automationStatus;

                if (Array.isArray(testRun.manualRuns)) {
                    manualExecuted = testRun.manualRuns.reduce((sum, run) => sum + sumCounts(run), 0);
                    automationExecuted = (testRun.automationRuns || []).reduce((sum, run) => sum + sumCounts(run), 0);
                    manualStatus = aggregateStatusFromRuns(testRun.manualRuns);
                    automationStatus = aggregateStatusFromRuns(testRun.automationRuns || []);
                } else {
                    const latestManualRun = getLatestRunFromObject(testRun.manualRuns);
                    const latestAutomationRun = getLatestRunFromObject(testRun.automationRuns);
                    manualExecuted = latestManualRun ? sumCounts(latestManualRun) : 0;
                    automationExecuted = latestAutomationRun ? sumCounts(latestAutomationRun) : 0;
                    manualStatus = latestManualRun ? statusFromRun(latestManualRun) : emptyStatus();
                    automationStatus = latestAutomationRun ? statusFromRun(latestAutomationRun) : emptyStatus();
                }

                return {
                    manualProductivity: productivityBlock(manualExecuted, teamSize, manualStatus),
                    automationProductivity: productivityBlock(automationExecuted, teamSize, automationStatus),
                };
            }

            if (idType === 'release') {
                // const allTestRuns = await TestRun.find(matchQuery).lean();
                // OPTIMIZED: Using cursor-based iteration for large result sets
                const allTestRuns = [];
                const cursor = TestModel.find(matchQuery)
                    .select('manualRuns automationRuns releaseName')
                    .lean()
                    .cursor();
                for await (const doc of cursor) {
                    allTestRuns.push(doc);
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

                const sumAllRuns = (runs) => {
                    if (!runs) {
                        return 0;
                    }
                    if (Array.isArray(runs)) {
                        return runs.reduce((sum, run) => sum + sumCounts(run), 0);
                    }
                    if (typeof runs === 'object') {
                        return Object.values(runs).reduce((sum, run) => sum + sumCounts(run), 0);
                    }
                    return 0;
                };
                const manualExecutedFinal = sumAllRuns(combinedManualRuns);
                const automationExecutedFinal = sumAllRuns(combinedAutomationRuns);
                const manualStatusFinal = aggregateStatusFromRuns(combinedManualRuns);
                const automationStatusFinal = aggregateStatusFromRuns(combinedAutomationRuns);

                return {
                    manualProductivity: productivityBlock(manualExecutedFinal, teamSize, manualStatusFinal),
                    automationProductivity: productivityBlock(automationExecutedFinal, teamSize, automationStatusFinal),
                };
            }
            throw new Error('Unsupported idType');
        } catch (error) {
            console.error(`Error calculating test productivity for ${idType}:`, error);
            throw new Error(`Failed to calculate test productivity for ${idType}: ${error.message}`);
        }
    }
}

export default new TestProductivityService();
