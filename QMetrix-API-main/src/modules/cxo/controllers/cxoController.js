import { JiraReleaseModel } from '../../project-management/jira/model.js';
import { CXOModel } from '../model.js';
import mongoose from 'mongoose';
import CxoService from '../services/cxoService.js';
import ReleaseReadinessService from '../services/release-readiness/releaseReadiness.js';
import EngineeringScoreService from '../services/engineering-score/engineeringScore.js';
import DFHService from '../services/dynamicFormulaHandlingService.js';
import { redis } from '../../../server.js';
import cache from '../../../utils/cache.js';

class CXOController {
    async getCXO(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const { companyId, projectId, boardId } = req.params;
            const sprintId = req.query.sprintId;
            const releaseId = req.query.releaseId;
            const response = await CxoService.getCXO(companyId, projectId, boardId, sprintId, releaseId, tenantConnection);

            if (response) {
                return res.status(201).json(response);
            } else {
                console.error('No data found for the given parameters.');
            }
        } catch (error) {
            console.error('Error Fetching CXO data:', error);
            return res.status(500).json({
                message: 'Failed to create CXO entry',
                error: error.message,
            });
        }
    }

    async getCXOtrends(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const CXO = CXOModel(tenantConnection);
            const result = [];
            const { companyId, projectId, count } = req.params;
            const sprintId = req.query.sprintId;
            const releaseId = req.query.releaseId;

            const cacheKey = cache.generateKey('cxoTrends', {
                projectId,
                companyId,
                sprintId,
                releaseId,
            });
            let cached = null;
            try {
                cached = await redis.get(cacheKey);
            } catch (err) {
                console.warn('Redis not available, skipping cache get:', err.message);
            }
            if (cached) {
                const data = JSON.parse(cached);
                return res.status(200).json(data);
            }

            let selectedIssues = [];

            if (sprintId) {
                selectedIssues = await CXO.find({ sprintId, companyId, projectId });
            } else if (releaseId) {
                const releaseData = await JiraRelease.findOne({
                    companyId,
                    projectId,
                    _id: releaseId,
                });
                selectedIssues = await CXO.find({
                    companyId,
                    projectId,
                    releaseVersion: releaseData.releaseName,
                });
            } else {
                return res.status(400).json({ error: 'Either sprintId or release must be provided.' });
            }

            const [releaseReadinessTrendResult, engineeringScoreTrendResult] = await Promise.allSettled([
                ReleaseReadinessService.getReleaseReadinessTrend(selectedIssues, count),
                EngineeringScoreService.getEngineeringScoreTrend(selectedIssues, count),
            ]);

            result.push({
                releaseReadinessTrend: releaseReadinessTrendResult.status === 'fulfilled' ? releaseReadinessTrendResult.value : null,
            });
            result.push({
                engineeringScoreTrend: engineeringScoreTrendResult.status === 'fulfilled' ? engineeringScoreTrendResult.value : null,
            });

            if (releaseReadinessTrendResult.status === 'rejected') {
                console.error('Error fetching release rediness trend:', releaseReadinessTrendResult.reason);
            }
            if (engineeringScoreTrendResult.status === 'rejected') {
                console.error('Error fetching engineering score trend:', engineeringScoreTrendResult.reason);
            }

            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            return res.status(200).json(result);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    async editWeightage(req, res) {
        try {
            const { values: uiMetricsArray, repo, sprintId, releaseId } = req.body;
            const tenantConnection = req.tenantConnection;
            const { companyId, projectId, boardId, title } = req.params;
            await DFHService.updateWeightage(projectId, tenantConnection, uiMetricsArray, title);

            if (sprintId !== null) {
                await CxoService.updateCXOScores(companyId, projectId, sprintId, null, repo, boardId, tenantConnection);
            }
            if (releaseId !== null) {
                await CxoService.updateCXOScores(companyId, projectId, null, releaseId, repo, boardId, tenantConnection);
            }

            res.status(200).json({ message: 'Weightage updated successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Internal Server Error', error: error.message });
        }
    }
    async updateCXOScores(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const { companyId, projectId } = req.params;
            const sprintId = req.query.sprintId;
            const releaseId = req.query.releaseId;

            await CxoService.updateCXOScores(companyId, projectId, sprintId, releaseId, tenantConnection);
            res.status(200).json({ message: 'Scores updated successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Internal Server Error', error: error.message });
        }
    }

    async getTrendsData(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const { companyId, projectId, reqCount } = req.params;
            const { sprintId, releaseId } = req.query;

            const matchQuery = {
                projectId: new mongoose.Types.ObjectId(projectId),
                companyId: new mongoose.Types.ObjectId(companyId),
            };

            if (sprintId) {
                matchQuery.sprintId = new mongoose.Types.ObjectId(sprintId);
            } else if (releaseId) {
                const releaseData = await JiraRelease.findOne({ companyId, projectId, _id: releaseId });

                if (!releaseData) {
                    return res.status(404).json({ error: 'Release not found.' });
                }
                matchQuery.fixVersion = releaseData.releaseName;
            } else {
                return res.status(400).json({ error: 'Either sprintId or releaseId must be provided.' });
            }

            const response = await CxoService.getTrendData(matchQuery, reqCount, tenantConnection);

            return res.status(200).json(response);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: error.message });
        }
    }
}
export default new CXOController();
