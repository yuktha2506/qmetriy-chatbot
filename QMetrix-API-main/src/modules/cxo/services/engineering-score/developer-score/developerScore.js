import { timeToFixScore } from '../../../../../utils/scoreMapping';
import TimeToFixService from '../developer-score/timeToFixService';
import CycleTimeService from '../developer-score/cycleTimeService';
import defectsDensityService from './defectsDensityService';

class DeveloperScoreService {
    async getDeveloperScore(companyId, projectId, keyId, idType, connection, boardId = null) {
        try {
            const [timeToFixResult, cycleTimeResult, defectDensityResult] = await Promise.allSettled([
                TimeToFixService.getTimeToFix(companyId, projectId, keyId, idType, connection, boardId),
                CycleTimeService.getCycleTime(companyId, projectId, keyId, idType, connection, boardId),
                defectsDensityService.defectDensity(companyId, projectId, keyId, idType, connection, boardId),
            ]);

            const timeToFix = timeToFixResult.status === 'fulfilled' ? timeToFixResult.value : `Error: ${timeToFixResult.reason}`;
            const cycleTime = cycleTimeResult.status === 'fulfilled' ? cycleTimeResult.value : `Error: ${cycleTimeResult.reason}`;
            const defectDensity = defectDensityResult.status === 'fulfilled' ? defectDensityResult.value : `Error: ${defectDensityResult.reason}`;
            const developerscore = this.calculateDeveloperScore(timeToFix?.averageTTF);

            return { timeToFix, developerscore, cycleTime, defectDensity };
        } catch (error) {
            console.error(`Error calculating developer score for ${idType}:`, error);
            throw new Error(`Failed to calculate developer score for ${idType}: ${error.message}`);
        }
    }
    calculateDeveloperScore(timeToFix) {
        const value = parseFloat(timeToFix);
        return timeToFixScore(value);
    }
}

export default new DeveloperScoreService();
