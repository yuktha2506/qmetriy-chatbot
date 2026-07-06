import SprintIssuesReadiness from './sprintIssuesReadiness';
import BurndownService from './burndown';
import BurnDownChartService from '../../../project-management/jira/services/burndownChartService';
import TestRunService from './testRuns';

class ReleaseReadinessService {
    async getReleaseReadiness(companyId, projectId, keyId, idType, connection, boardId = null) {
        try {            
            const [sprintIssuesReadinessResult, issuesResult, burndownResult, burndownHrsResult, testRunResult] = await Promise.allSettled([
                SprintIssuesReadiness.getSprintIssuesReadiness(companyId, projectId, keyId, idType, connection, boardId),
                SprintIssuesReadiness.getIssues(companyId, projectId, keyId, idType, connection, boardId),
                BurndownService.getBurndown(companyId, projectId, keyId, idType, connection, boardId),
                BurnDownChartService.getBurnDownHrs(companyId, projectId, keyId, idType, connection, boardId),
                TestRunService.getTestRuns(companyId, projectId, keyId, idType, connection),

            ]);

            const sprintIssuesReadiness = sprintIssuesReadinessResult.status === 'fulfilled' ? sprintIssuesReadinessResult.value : { sprintIssuesReadiness: { averageReadiness: 0 } };
            const burndown = burndownResult.status === 'fulfilled' ? burndownResult.value : `Error: ${burndownResult.reason}`;
            const burndownHrs = burndownHrsResult.status === 'fulfilled' ? burndownHrsResult.value : `Error: ${burndownHrsResult.reason}`;
            const issues = issuesResult.status === 'fulfilled' ? issuesResult.value : `Error: ${issuesResult.reason}`;
            const testRuns = testRunResult.status === 'fulfilled'? testRunResult.value:`Error: ${issuesResult.reason}`;
            return {
                sprintIssuesReadiness,
                issues,
                burndown,
                burndownHrs,
                manualTestResult: {
                    passed: testRuns.manualTestResult?.passed||0,
                    failed: testRuns.manualTestResult?.failed||0,
                    blocked: testRuns.manualTestResult?.blocked||0,
                    retest: testRuns.manualTestResult?.retest||0,
                    untested: testRuns.manualTestResult?.untested||0,
                    percentage: testRuns.manualTestResult?.percentage||0,
                    name: testRuns.manualTestResult?.name || 'NA',
                },
                automationTestResult: {
                    passed:testRuns.automationTestResult?.passed||0,
                    failed: testRuns.automationTestResult?.failed||0,
                    blocked:testRuns.automationTestResult?.blocked||0,
                    retest: testRuns.automationTestResult?.retest||0,
                    untested:testRuns.automationTestResult?.untested||0,
                    percentage: testRuns.automationTestResult?.percentage || 0,
                    name: testRuns.automationTestResult?.name || 'NA',
                }, 
            };
          
        } catch (error) {
            console.error(`Error calculating release readiness for  ${idType}:`, error);
            throw new Error(`Failed to calculate release readiness for ${idType}: ${error.message}`);
        }
    }
    async getReleaseReadinessTrend(selectedIssues, count) {
        try {
            if (!selectedIssues || selectedIssues.length === 0) {
                console.error('No issues provided for readiness trend calculation');
                return;
            }
            const trends = [];
            const today = new Date();
            const readinessData = selectedIssues.map((item) => ({
                date: new Date(item.createdAt).toISOString().split('T')[0],
                readinessScore: item?.releaseReadinessObject?.releaseReadiness || 0,
            }));

            for (let i = 0; i < count; i++) {
                const currentDate = new Date();
                currentDate.setDate(today.getDate() - i);
                const formattedDate = currentDate.toISOString().split('T')[0];

                const existingData = readinessData.find((entry) => entry.date === formattedDate);
                trends.push({
                    date: formattedDate,
                    readinessScore: existingData ? existingData.readinessScore : 0,
                });
            }
            return trends;
        } catch (error) {
            console.error('Error Finding Release Readiness trends', error);
        }
    }
}

export default new ReleaseReadinessService();
