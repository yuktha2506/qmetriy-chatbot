import { calculateEngineeringScore } from '../../../../utils/scoreMapping';
import DeveloperScoreService from './developer-score/developerScore';
import TestScoreService from './test-score/testScore';

class EngineeringScoreService {
    async getEngineeringScore(companyId, projectId, keyId, idType, connection, boardId = null) {
        try {
            const [developerScoreResult, testScoreResult] = await Promise.allSettled([
                DeveloperScoreService.getDeveloperScore(companyId, projectId, keyId, idType, connection, boardId),
                TestScoreService.getTestScore(companyId, projectId, keyId, idType, connection, boardId),
            ]);

            const developerScore = developerScoreResult.status === 'fulfilled' ? developerScoreResult.value : `Error: ${developerScoreResult.reason}`;
            const testScore = testScoreResult.status === 'fulfilled' ? testScoreResult.value : `Error: ${testScoreResult.reason}`;

            const developerScoreResponse = developerScore?.developerscore;
            const testScoreResponse = testScore?.testscore;
            const engineeringScore = calculateEngineeringScore(developerScoreResponse, testScoreResponse);
            return { developerScore, testScore, engineeringScore };
        } catch (error) {
            console.error(`Error calculating engineering score for  ${idType}:`, error);
            throw new Error(`Failed to calculate engineering score for ${idType}: ${error.message}`);
        }
    }

    async getEngineeringScoreTrend(selectedIssues, count) {
        try {
            if (!selectedIssues || selectedIssues.length === 0) {
                console.error('No issues provided for engineering trend calculation');
                return;
            }
            const trends = [];
            const today = new Date();
            const engineeringData = selectedIssues.map((item) => ({
                date: new Date(item.createdAt).toISOString().split('T')[0],
                engineeringScore: item.engineeringScoreObject.engineeringScore || 0,
            }));

            for (let i = 0; i < count; i++) {
                const currentDate = new Date();
                currentDate.setDate(today.getDate() - i);
                const formattedDate = currentDate.toISOString().split('T')[0];

                const existingData = engineeringData.find((entry) => entry.date === formattedDate);
                trends.push({
                    date: formattedDate,
                    engineeringScore: existingData ? existingData.engineeringScore : 0,
                });
            }
            return trends;
        } catch (error) {
            console.error('Error Finding Engineering Score trends', error);
        }
    }
}

export default new EngineeringScoreService();
