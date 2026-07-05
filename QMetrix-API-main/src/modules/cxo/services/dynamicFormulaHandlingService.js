import { CXOModel } from '../model.js';
import { ProjectModel } from '../../project-management/jira/model.js';

class DFHService {
    distributeMetricContribution(inputMetrics) {
        const totalPercentage = 100;
        let assignedTotal = 0;
        Object.values(inputMetrics).forEach((value) => {
            assignedTotal += value;
        });

        if (assignedTotal === totalPercentage) {
            return inputMetrics;
        }

        const remainingPercentage = totalPercentage - assignedTotal;
        const zeroMetrics = Object.keys(inputMetrics).filter((key) => inputMetrics[key] === 0);
        const numZeroMetrics = zeroMetrics.length;
        if (numZeroMetrics > 0) {
            const equalShare = (remainingPercentage / numZeroMetrics).toFixed(2);

            zeroMetrics.forEach((key) => {
                inputMetrics[key] = parseFloat(equalShare);
            });
        }
        return inputMetrics;
    }

    toCamelCase = (str) => {
        return str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (match, char) => char.toUpperCase());
    };

    async updateWeightage(projectId, tenantConnection, uiMetricsArray, title) {
        try {
            const Project = ProjectModel(tenantConnection);
            const uiMetrics = uiMetricsArray.reduce((acc, metric) => {
                const camelCaseKey = this.toCamelCase(metric.name);
                acc[camelCaseKey] = metric.value;
                return acc;
            }, {});

            const titleMapping = {
                developerScore: 'metricContribution.engineeringScore.developerScore',
                testScore: 'metricContribution.engineeringScore.testScore',
                operationScore: 'metricContribution.engineeringScore.operationScore',
                releaseReadiness: 'metricContribution.releaseReadiness',
                engineeringScore: 'metricContribution.engineeringScore.engineeringScoreLevelOne',
            };

            if (!titleMapping[title]) {
                throw new Error('Invalid title provided for metric update.');
            }
            const updatedMetrics = this.distributeMetricContribution(uiMetrics);
            const updatedProject = await Project.findByIdAndUpdate(projectId, { $set: { [titleMapping[title]]: updatedMetrics } }, { new: true });
            return updatedProject;
        } catch (error) {
            console.error('Error updating weightage:', error);
            throw new Error(`Failed to update weightage: ${error.message}`);
        }
    }

    async getCXOData() {
        try {
            return await CXOModel.find();
        } catch (error) {
            console.error('Error creating/updating CXO:', error);
            throw new Error(`Failed to create/update CXO: ${error.message}`);
        }
    }
}

export default new DFHService();
