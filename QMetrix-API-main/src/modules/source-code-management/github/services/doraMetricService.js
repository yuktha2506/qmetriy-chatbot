
import 'dotenv/config';
import axios from 'axios';
import { branch, displayTitle } from '../../../../utils/constants/custumFieldConstants.js';

class DoraMetricService {
    async getDeploymentFrequency(githubConfig, repoName, startDate, endDate, project) {
        try {
            const { host, password } = githubConfig;
            const auth = { auth: { host, password } };

            const orgName = githubConfig.host;
            const fullRepoName = `${orgName}/${repoName}`;

            const formattedRepos = project.repos.map((r) => r.replace('https://github.com/', '').split('/')[1]);

            if (!formattedRepos.includes(repoName)) {
                throw new Error(`Repository ${repoName} is not part of the project`);
            }

            const selectedBranch = branch.includes('main') ? 'main' : 'master';
            const apiUrl = `https://api.github.com/repos/${fullRepoName}/actions/runs?branch=${selectedBranch}&per_page=100&page=1`;

            const response = await axios.get(apiUrl, auth);
            const runs = response.data.workflow_runs || [];
            let successCount = 0;
            const daysTracked = new Set();
            const startDateStr = new Date(startDate).toISOString().split('T')[0];
            const endDateStr = new Date(endDate).toISOString().split('T')[0];

            runs.forEach((run) => {
                if (run.status === 'completed' && run.conclusion === 'success' && displayTitle.some((keyword) => run.display_title.toLowerCase().includes(keyword))) {
                    const runDateStr = new Date(run.created_at).toISOString().split('T')[0];

                    if (runDateStr >= startDateStr && runDateStr <= endDateStr) {
                        daysTracked.add(runDateStr);
                        successCount++;
                    }
                }
            });

            const totalDays = Math.max((new Date(endDateStr) - new Date(startDateStr)) / (1000 * 60 * 60 * 24), 1);
            const avgDeploymentsPerDay = (successCount / totalDays).toFixed(2);

            return {
                successCount,
                totalDays,
                avgDeploymentsPerDay,
            };
        } catch (error) {
            throw new Error(`GitHub Sync Error: ${error.message}`);
        }
    }

    async getChangeFailureRate(githubConfig, repoName, startDate, endDate, project) {
        try {
            const { host, password } = githubConfig;
            const auth = { auth: { host, password } };

            const orgName = githubConfig.host;
            const fullRepoName = `${orgName}/${repoName}`;

            const formattedRepos = project.repos.map((r) => r.replace('https://github.com/', '').split('/')[1]);
            if (!formattedRepos.includes(repoName)) {
                throw new Error(`Repository ${repoName} is not part of the project`);
            }
            const selectedBranch = branch.includes('main') ? 'main' : 'master';
            const apiUrl = `https://api.github.com/repos/${fullRepoName}/actions/runs?branch=${selectedBranch}&per_page=100&page=1`;
            const response = await axios.get(apiUrl, auth);
            const runs = response.data.workflow_runs || [];

            let successCount = 0,
                failureCount = 0;

            const startDateStr = new Date(startDate).toISOString().split('T')[0];
            const endDateStr = new Date(endDate).toISOString().split('T')[0];

            runs.forEach((run) => {
                const runDateStr = new Date(run.created_at).toISOString().split('T')[0];
                if (runDateStr >= startDateStr && runDateStr <= endDateStr) {
                    if (run.conclusion === 'success' && displayTitle.some((keyword) => run.display_title.toLowerCase().includes(keyword))) {
                        successCount++;
                    }
                    if (run.conclusion === 'failure' && displayTitle.some((keyword) => run.display_title.toLowerCase().includes(keyword))) {
                        failureCount++;
                    }
                }
            });

            const totalDeployments = successCount + failureCount;
            const changeFailureRate = totalDeployments > 0 ? (failureCount / totalDeployments * 100).toFixed(2) + '%' : '0.00%';

            return {
                successCount,
                failureCount,
                totalDeployments,
                changeFailureRate,
            };
        } catch (error) {
            throw new Error(`GitHub Sync Error: ${error.message}`);
        }
    }

    async calculateMTTR(githubConfig, repoName, startDate, endDate, project) {
        try {
            const { host, password } = githubConfig;
            const auth = { auth: { host, password } };

            const orgName = githubConfig.host;
            const fullRepoName = `${orgName}/${repoName}`;
            const formattedRepos = project.repos.map((r) => r.replace('https://github.com/', '').split('/')[1]);

            if (!formattedRepos.includes(repoName)) {
                throw new Error(`Repository ${repoName} is not part of the project`);
            }

            const selectedBranch = branch.includes('main') ? 'main' : 'master';

            const failedRunsUrl = `https://api.github.com/repos/${fullRepoName}/actions/runs?status=failure&branch=${selectedBranch}&per_page=100&page=1`;
            const successRunsUrl = `https://api.github.com/repos/${fullRepoName}/actions/runs?status=success&branch=${selectedBranch}&per_page=100&page=1`;

            const failedRunsResponse = await axios.get(failedRunsUrl, auth);
            const successRunsResponse = await axios.get(successRunsUrl, auth);

            let failedRuns = failedRunsResponse.data.workflow_runs || [];
            let successRuns = successRunsResponse.data.workflow_runs || [];
            failedRuns = failedRuns.filter((run) => {
                const runDate = new Date(run.created_at);
                return (
                    run.display_title &&
                    displayTitle.some((keyword) => run.display_title.toLowerCase().includes(keyword)) &&
                    runDate >= new Date(startDate) && 
                    runDate <= new Date(endDate)
                );
            });
            
            successRuns = successRuns.filter((run) => {
                const runDate = new Date(run.created_at);
                return (
                    run.display_title &&
                    displayTitle.some((keyword) => run.display_title.toLowerCase().includes(keyword)) &&
                    runDate >= new Date(startDate) && 
                    runDate <= new Date(endDate)
                );
            });            

            // failedRuns = failedRuns.filter((run) => run.display_title && displayTitle.some((keyword) => run.display_title.toLowerCase().includes(keyword)));
            // successRuns = successRuns.filter((run) => run.display_title && displayTitle.some((keyword) => run.display_title.toLowerCase().includes(keyword)));

            let totalRecoveryTime = 0;
            let failureCount = 0;

            failedRuns.forEach((failure) => {
                const failureTime = new Date(failure.created_at);
                const nextSuccess = successRuns.map((success) => new Date(success.created_at)).sort((a, b) => a - b).find((successTime) => successTime - failureTime >= 0);
                if (nextSuccess) {
                    totalRecoveryTime += (nextSuccess - failureTime) / (1000 * 60 * 60);
                    failureCount++;
                }
            });

            const mttr = failureCount > 0 ? (totalRecoveryTime / failureCount).toFixed(2) : '0.00';

            return {
                totalFailures: failureCount,
                totalRecoveryTime: totalRecoveryTime.toFixed(2),
                mttr,
            };
        } catch (error) {
            throw new Error(`GitHub Sync Error: ${error.message}`);
        }
    }
}

export default new DoraMetricService();
