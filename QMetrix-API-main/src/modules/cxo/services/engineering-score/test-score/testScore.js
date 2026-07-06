import { derScore, testingQualityScore, testingProductivityScore, automationTestingProductivityScore } from '../../../../../utils/scoreMapping';
import TestingQualityService from './testingQuality';
import DefectLeakageAnalysis from './defectLeakageAnalysis';
import testingProductivity from './testingProductivity';

class TestScoreService {
    async getTestScore(companyId, projectId, keyId, idType, connection, boardId = null) {
        try {
            const [testingQualityResult, defectLeakageAnalysisResult, productivityResult] = await Promise.allSettled([
                TestingQualityService.getTestinQuality(companyId, projectId, keyId, idType, connection, boardId),
                DefectLeakageAnalysis.getDla(companyId, projectId, keyId, idType, connection, boardId),
                testingProductivity.getTestProductivity(companyId, projectId, keyId, idType, connection, boardId),
            ]);

            const testingQuality = testingQualityResult.status === 'fulfilled' ? testingQualityResult.value : `Error: ${testingQualityResult.reason}`;
            const defectLeakageAnalysis = defectLeakageAnalysisResult.status === 'fulfilled' ? defectLeakageAnalysisResult.value : `Error: ${defectLeakageAnalysisResult.reason}`;
            const productivity = productivityResult.status === 'fulfilled' ? productivityResult.value : null;
            const testingProductivityOut = {
                executedTestCases: productivity?.manualProductivity?.executedTestCases || 0,
                teamSize: productivity?.manualProductivity?.teamSize || 0,
                productivityPercentage: productivity?.manualProductivity?.productivityPercentage || 0,
                passed: productivity?.manualProductivity?.passed || 0,
                failed: productivity?.manualProductivity?.failed || 0,
                blocked: productivity?.manualProductivity?.blocked || 0,
                untested: productivity?.manualProductivity?.untested || 0,
                retest: productivity?.manualProductivity?.retest || 0,
            };
            const automationTestingProductivityOut = {
                executedTestCases: productivity?.automationProductivity?.executedTestCases || 0,
                teamSize: productivity?.automationProductivity?.teamSize || 0,
                productivityPercentage: productivity?.automationProductivity?.productivityPercentage || 0,
                passed: productivity?.automationProductivity?.passed || 0,
                failed: productivity?.automationProductivity?.failed || 0,
                blocked: productivity?.automationProductivity?.blocked || 0,
                untested: productivity?.automationProductivity?.untested || 0,
                retest: productivity?.automationProductivity?.retest || 0,
            };
            const testscore = this.calculateTestScore(
                defectLeakageAnalysis?.dla,
                testingQuality?.testingquality,
                testingProductivityOut,
                automationTestingProductivityOut,
            );
            testingQuality.testingquality = testingQualityScore(testingQuality?.testingquality);
            return {
                testingQuality,
                defectLeakageAnalysis,
                testscore,
                testingProductivity: testingProductivityOut,
                automationTestingProductivity: automationTestingProductivityOut,
            };
        } catch (error) {
            console.error(`Error calculating test score for  ${idType}:`, error);
            throw new Error(`Failed to calculate test score for  ${idType}: ${error.message}`);
        }
    }
    calculateTestScore(prodBugCount, testingQuality, testingProductivity, automationTestingProductivity) {
        const qualityScore = testingQualityScore(testingQuality);
        const productivityScore = testingProductivity?.productivityPercentage || 0;
        const automationScore = automationTestingProductivity?.productivityPercentage || 0;

        return (derScore(prodBugCount) + qualityScore) / 2 + testingProductivityScore(productivityScore) + automationTestingProductivityScore(automationScore);
    }
}

export default new TestScoreService();
