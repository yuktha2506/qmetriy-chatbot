export default async function qaReferenceLogic({ builder }) {
    let milestones = await builder.getTestRailMilestones();

    if (!milestones || milestones.length === 0) {
        milestones = await builder.getXrayExecutions();
    }

    if (!milestones || milestones.length === 0) {
        return null;
    }

    let totalReferences = 0;
    let casesWithReferences = 0;
    let casesWithoutReferences = 0;
    let automatedCasesCount = 0;
    let testsToBeAutomatedCount = 0;
    const uniqueRefs = new Set();

    for (const milestone of milestones) {
        const hasExecutionMetrics = !!milestone.testCaseMetrics;
        if (hasExecutionMetrics) {
            totalReferences += milestone.testCaseMetrics.references || 0;
            casesWithReferences += milestone.testCaseMetrics.casesWithReferences || 0;
            casesWithoutReferences += milestone.testCaseMetrics.casesWithoutReferences || 0;
            automatedCasesCount += milestone.testCaseMetrics.automatedCasesCount || 0;
            testsToBeAutomatedCount += milestone.testCaseMetrics.testsToBeAutomatedCount || 0;
        } else if (milestone.totalReferences) {
            totalReferences += milestone.totalReferences;
        }

        const processRuns = (runs) => {
            if (!Array.isArray(runs)) {return;}
            for (const run of runs) {
                if (run.testCaseMetrics && !hasExecutionMetrics) {
                    totalReferences += run.testCaseMetrics.references || 0;
                    casesWithReferences += run.testCaseMetrics.casesWithReferences || 0;
                    casesWithoutReferences += run.testCaseMetrics.casesWithoutReferences || 0;
                    automatedCasesCount += run.testCaseMetrics.automatedCasesCount || 0;
                    testsToBeAutomatedCount += run.testCaseMetrics.testsToBeAutomatedCount || 0;
                }

                const refs = run.refs || run.storyKey;
                if (refs) {
                    refs.split(',').map(r => r.trim()).filter(Boolean).forEach(r => uniqueRefs.add(r));
                }
            }
        };

        processRuns(milestone.manualRuns);
        processRuns(milestone.automationRuns);
    }

    if (totalReferences === 0 && uniqueRefs.size > 0) {
        totalReferences = uniqueRefs.size;
    }

    const totalTestCases = casesWithReferences + casesWithoutReferences;
    const coveredPercentage = totalTestCases > 0 ? Math.round((casesWithReferences / totalTestCases) * 100) : 0;

    return {
        referenceCoverage: {
            covered: coveredPercentage,
            notCovered: 100 - coveredPercentage,
        },
        referenceAndTestCases: {
            references: totalReferences,
            casesWithReferences,
            casesWithoutReferences,
            testToBeAutomated: testsToBeAutomatedCount,
            automated: automatedCasesCount,
        },
    };
}
