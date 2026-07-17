export default async function qaInsightsTestsLogic({ builder }) {
    let testMilestones = await builder.getTestRailMilestones();

    if (!testMilestones || testMilestones.length === 0) {
        testMilestones = await builder.getXrayExecutions();
    }

    if (!testMilestones || testMilestones.length === 0) {
        return {
            manualMetrics: { new: 0, executed: 0, passPercent: 0, totalTestCases: 0 },
            automationMetrics: { new: 0, executed: 0, passPercent: 0, totalTestCases: 0 },
            coverage: { automatedCases: 0, regression: 0 },
        };
    }

    const allManualRuns = [];
    const allAutomationRuns = [];

    testMilestones.forEach(milestone => {
        if (Array.isArray(milestone.manualRuns)) {allManualRuns.push(...milestone.manualRuns);}
        if (Array.isArray(milestone.automationRuns)) {allAutomationRuns.push(...milestone.automationRuns);}
    });

    const calculateTestMetrics = (runs, type) => {
        if (!runs || runs.length === 0) {return { new: 0, executed: 0, passPercent: 0, totalTestCases: 0 };}

        let newCount = 0;
        runs.forEach(run => {
            if (run.testCaseMetrics?.newlyAddedCasesCount) {newCount += run.testCaseMetrics.newlyAddedCasesCount;}
        });

        let totalTestCases = 0;
        runs.forEach((run) => {
            const m = run.testCaseMetrics;
            if (m) {
                totalTestCases += (Number(m.casesWithReferences) || 0) + (Number(m.casesWithoutReferences) || 0);
            }
        });

        let executed = 0;
        let passed = 0;
        let totalPassPercentage = 0;
        let runsWithPercentage = 0;

        runs.forEach(run => {
            executed += (run.passed_count || 0) + (run.failed_count || 0) + (run.retest_count || 0) + (run.blocked_count || 0);
            passed += run.passed_count || 0;

            if (type === 'manual' && run.manual_percentage !== null && run.manual_percentage !== undefined) {
                totalPassPercentage += run.manual_percentage;
                runsWithPercentage++;
            } else if (type === 'automation' && run.automation_percentage !== null && run.automation_percentage !== undefined) {
                totalPassPercentage += run.automation_percentage;
                runsWithPercentage++;
            } else if (run.pass_percentage !== null && run.pass_percentage !== undefined) {
                totalPassPercentage += run.pass_percentage;
                runsWithPercentage++;
            }
        });

        let passPercent = 0;
        if (runsWithPercentage > 0) {
            passPercent = Math.round(totalPassPercentage / runsWithPercentage);
        } else if (executed > 0) {
            passPercent = Math.round((passed / executed) * 100);
        }

        return { new: newCount, executed, passPercent, totalTestCases };
    };

    let automatedCases = 0;
    let regressionCases = 0;

    testMilestones.forEach(milestone => {
        const processRuns = (runs) => {
            if (!Array.isArray(runs)) {return;}
            runs.forEach(run => {
                if (run.testCaseMetrics?.automatedCasesCount) {automatedCases += run.testCaseMetrics.automatedCasesCount;}
                if ((run.name || '').toLowerCase().includes('regression')) {
                    regressionCases += (run.passed_count || 0) + (run.failed_count || 0) +
                        (run.untested_count || 0) + (run.blocked_count || 0) + (run.retest_count || 0);
                }
            });
        };
        processRuns(milestone.manualRuns);
        processRuns(milestone.automationRuns);
    });

    return {
        manualMetrics: calculateTestMetrics(allManualRuns, 'manual'),
        automationMetrics: calculateTestMetrics(allAutomationRuns, 'automation'),
        coverage: { automatedCases, regression: regressionCases },
    };
}
