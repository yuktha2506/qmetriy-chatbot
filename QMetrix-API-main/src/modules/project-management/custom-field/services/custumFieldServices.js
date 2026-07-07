import { SprintIssueModel, BoardIssueModel, ProjectModel } from '../../jira/model';
import connectionManager from '../../../../config/connectionManager';
import { CompanyModel } from '../../../company/model';
import { storyPoints, originalEstimates } from '../../../../utils/constants/custumFieldConstants';
import { mongoose } from 'mongoose';
import axios from 'axios';
import syncJiraService from '../../jira/services/syncJiraService';

class custumFiledService {
    async addNewFeature(jiraConfig, companyId, projectId, connection) {
        const SprintIssue = SprintIssueModel(connection);
        const KanbanIssue = BoardIssueModel(connection);
        const Project = ProjectModel(connection);

        try {
            const companyObjectId = new mongoose.Types.ObjectId(companyId);
            const projectObjectId = new mongoose.Types.ObjectId(projectId);

            const board = await Project.findOne({ companyId: companyObjectId, _id: projectObjectId });

            if (!board) {
                console.log(`No board found for projectId ${projectId}`);
            }

            const metaConnection = connectionManager.connectToMetaDB();
            const MetaCompany = CompanyModel(metaConnection);
            const company = await MetaCompany.findOne({ _id: companyId });

            const { boardId, boardType } = board;
            const IssueModel = boardType === 'kanban' ? KanbanIssue : SprintIssue;

            const storyPointField = company.customFields.find((field) => storyPoints.some((point) => field.name.toLowerCase().includes(point)));
            const storyPointsKey = storyPointField ? storyPointField.key : null;

            const originalEstimateField = company.customFields.find((field) => originalEstimates.some((estimate) => field.name.toLowerCase().includes(estimate)));
            const originalEstimateKey = originalEstimateField ? originalEstimateField.key : null;

            let startAt = 0;
            const issues = [];
            let isLastPage = false;

            while (!isLastPage) {
                const response = await syncJiraService.retryWithDelay(() =>
                    axios.get(`${jiraConfig.host}/rest/agile/1.0/board/${boardId}/issue`, {
                        auth: {
                            username: jiraConfig.username,
                            password: jiraConfig.password,
                        },
                        params: {
                            fields: [storyPointsKey, originalEstimateKey, 'duedate'].filter(Boolean).join(','),
                            startAt,
                            maxResults: 50,
                        },
                    })
                );

                const fetchedIssues = response.data.issues;
                if (fetchedIssues.length === 0) {
                    break;
                }

                issues.push(...fetchedIssues);
                startAt += 50;
                isLastPage = response.data.isLast;
            }

            const bulkOperations = issues.map((issue) => {
                const points = storyPointsKey && issue.fields[storyPointsKey] ? Number(issue.fields[storyPointsKey]) : 0;
                let originalEstimateHrs = 0;

                if (originalEstimateKey && issue.fields?.[originalEstimateKey]) {
                    const originalEstimate = issue.fields[originalEstimateKey];
                    if (typeof originalEstimate === 'string') {
                        originalEstimateHrs = parseFloat(originalEstimate.replace('h', '').trim());
                    } else if (issue.fields?.timetracking?.originalEstimate) {
                        originalEstimateHrs = parseFloat(issue.fields.timetracking.originalEstimate.replace('h', '').trim());
                    }
                }

                return {
                    updateOne: {
                        filter: { key: issue.key },
                        update: {
                            $set: {
                                storyPoints: points || 0,
                                originalEstimateHrs: originalEstimateHrs,
                                duedate: issue.fields.duedate,
                            },
                        },
                    },
                };
            });

            if (bulkOperations.length > 0) {
                await IssueModel.bulkWrite(bulkOperations);
            }

            return { success: true, updatedCount: bulkOperations.length };
        } catch (error) {
            console.error('Error in sprintIssues:', error);
            return {
                success: false,
                message: 'Failed to update issues',
                error: error.message,
            };
        }
    }
}

export default new custumFiledService();
