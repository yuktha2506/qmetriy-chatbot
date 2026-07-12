import { ConnectionModel } from '../../../connection/model.js';
import doraMetricService from '../services/doraMetricService.js';
import { ProjectModel, SprintModel, JiraReleaseModel, BoardModel } from '../../../project-management/jira/model.js';
import { DoraMetricsModel } from '../model.js';
import { Types } from 'mongoose';
import { cryptoHandler } from '../../../../utils/commonFunctions.js';
import { redis } from '../../../../server.js';
import cache from '../../../../utils/cache.js';
import { PROVIDER_NAME_GITHUB } from '../../../../utils/constants/providerConstants.js';
import { STATUS_ACTIVE, RELEASE_STATUS_UNRELEASED } from '../../../../utils/constants/statusConstants.js';

class DoraMetricController {
    constructor() {
        this.addDoraMetrics = this.addDoraMetrics.bind(this);
        this.calculateDoraMetrics = this.calculateDoraMetrics.bind(this);
    }

    async calculateDoraMetrics(companyId, tenantConnection, projectId, type) {
        try {
            const DoraMetrics = DoraMetricsModel(tenantConnection);
            const Connection = ConnectionModel(tenantConnection);
            const Project = ProjectModel(tenantConnection);
            const Sprint = SprintModel(tenantConnection);
            const Release = JiraReleaseModel(tenantConnection);

            const cred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITHUB });

            if (!cred) {
                console.error('GitHub credentials not found');
            }

            const decryptedPassword = cryptoHandler(cred.password, 'decrypt');
            const name = cred.name;
            const githubConfig = { host: cred.host, username: cred.username, password: decryptedPassword, name };

            const project = await Project.findOne({ companyId, _id: projectId, repos: { $exists: true, $ne: [] } }, { repos: 1 }).lean();

            if (!project || !project.repos || project.repos.length === 0) {
                console.warn('No repositories found for this project.');
                return { warning: 'No repositories found for DORA metrics calculation' };
            }

            const allMetrics = [];

            const { repos } = project;

            for (const repoUrl of repos) {
                const repoName = repoUrl.replace('https://github.com/', '').split('/')[1];
                let isUpdatable = false;
                const sprintIds = [];
                const releaseIds = [];

                let sprints, releases;

                if (type === 'light') {
                    [sprints, releases] = await Promise.all([
                        Sprint.find({ projectId, companyId, state: STATUS_ACTIVE })
                            .select('_id companyId projectId boardId state startDate endDate')
                            .lean(),
                        Release.find({ projectId, companyId, status: RELEASE_STATUS_UNRELEASED })
                            .select('_id companyId projectId releaseName status startDate releaseDate')
                            .lean(),
                    ]);
                } else {
                    [sprints, releases] = await Promise.all([
                        Sprint.find({ projectId, companyId })
                            .select('_id companyId projectId boardId state startDate endDate')
                            .lean(),
                        Release.find({ projectId, companyId })
                            .select('_id companyId projectId releaseName status startDate releaseDate')
                            .lean(),
                    ]);
                }

                for (const sprint of sprints) {
                    const startDate = new Date(sprint.startDate);
                    let endDate = new Date(sprint.endDate);

                    if (sprint.state === STATUS_ACTIVE) {
                        endDate = new Date();
                        isUpdatable = true;
                    }

                    sprintIds.push({ id: sprint._id, boardId: sprint.boardId, startDate, endDate, isUpdatable });
                }

                for (const release of releases) {
                    const startDate = new Date(release.startDate);
                    let endDate = new Date(release.releaseDate);

                    if (release.state === 'unreleased') {
                        endDate = new Date();
                        isUpdatable = true;
                    }

                    releaseIds.push({ id: release._id, startDate, endDate, isUpdatable });
                }

                for (const sprint of sprintIds) {
                    if (!sprint.boardId) {
                        console.warn(`Skipping DORA metrics for sprint ${sprint.id}: missing boardId`);
                        continue;
                    }
                    if (!sprint.id) {
                        console.warn('Skipping DORA metrics: missing sprint id');
                        continue;
                    }
                    const [deploymentFrequency, changeFailureRate, mttr] = await Promise.allSettled([
                        doraMetricService.getDeploymentFrequency(githubConfig, repoName, sprint.startDate, sprint.endDate, project),
                        doraMetricService.getChangeFailureRate(githubConfig, repoName, sprint.startDate, sprint.endDate, project),
                        doraMetricService.calculateMTTR(githubConfig, repoName, sprint.startDate, sprint.endDate, project),
                    ]);

                    const boardObjId = new Types.ObjectId(sprint.boardId);
                    const response = {
                        companyId,
                        projectId,
                        boardId: boardObjId,
                        sprintId: sprint.id,
                        repoName,
                        metricName: name,
                        metrics: {
                            deploymentFrequency: deploymentFrequency.status === 'fulfilled' ? deploymentFrequency.value : null,
                            changeFailureRate: changeFailureRate.status === 'fulfilled' ? changeFailureRate.value : null,
                            mttr: mttr.status === 'fulfilled' ? mttr.value : null,
                        },
                        updatedAt: new Date(),
                    };
                    const matchBase = {
                        companyId: response.companyId,
                        projectId: response.projectId,
                        repoName: response.repoName,
                        metricName: response.metricName,
                        sprintId: response.sprintId,
                    };
                    let existingRecord = await DoraMetrics.findOne({
                        ...matchBase,
                        boardId: boardObjId,
                    });
                    if (!existingRecord) {
                        existingRecord = await DoraMetrics.findOne({
                            ...matchBase,
                            $or: [{ boardId: { $exists: false } }, { boardId: null }],
                        });
                    }

                    if (existingRecord) {
                        await DoraMetrics.updateOne(
                            { _id: existingRecord._id },
                            { $set: isUpdatable ? response : { updatedAt: new Date() } },
                        );
                    } else {
                        await DoraMetrics.create(response);
                    }
                    allMetrics.push(response);
                }
            }

            return allMetrics;
        } catch (error) {
            console.error('Error calculating DORA metrics:', error.message);
            throw error;
        }
    }

    async addDoraMetrics(req, res) {
        try {
            const { companyId, projectId } = req.params;
            const { type } = req.query;
            const tenantConnection = req.tenantConnection;

            const metrics = await this.calculateDoraMetrics(companyId, tenantConnection, projectId, type);
            res.status(200).json(metrics);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getDoraMetrics(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const DoraMetrics = DoraMetricsModel(tenantConnection);
            const Sprint = SprintModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const Board = BoardModel(tenantConnection);

            const { companyId, projectId, boardId } = req.params;
            const { sprintId, releaseId, repoName } = req.query;

            // Validate board exists
            const board = await Board.findOne(
                {
                    _id: new Types.ObjectId(boardId),
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                },
                { boardType: 1 }
            );

            if (!board) {
                return res.status(404).json({ error: 'Board not found.' });
            }

            const cacheKey = cache.generateKey('Dorametrics', {
                projectId,
                companyId,
                sprintId,
                releaseId,
                repoName,
                boardId,
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

            const matchQuery = {
                projectId: new Types.ObjectId(projectId),
                companyId: new Types.ObjectId(companyId),
                boardId: new Types.ObjectId(boardId),
            };

            if (repoName) {
                matchQuery.repoName = repoName;
            }

            let identifierType,
                pastIdentifiers = [];

            if (sprintId) {
                matchQuery.sprintId = new Types.ObjectId(sprintId);
                identifierType = 'sprintId';
                const allSprints = await Sprint.find({
                    companyId,
                    projectId,
                    boardId: new Types.ObjectId(boardId),
                    state: { $ne: 'future' },
                })
                    .sort({ startDate: 1 })
                    .lean();
                const selectedIndex = allSprints.findIndex((s) => s._id.equals(sprintId));
                if (selectedIndex !== -1) {
                    pastIdentifiers = allSprints.slice(Math.max(0, selectedIndex - 5), selectedIndex + 1).map((s) => s._id);
                }
            } else if (releaseId) {
                matchQuery.releaseId = new Types.ObjectId(releaseId);
                identifierType = 'releaseId';
                const allReleases = await JiraRelease.find({ companyId, projectId, boardId: new Types.ObjectId(boardId) })
                    .sort({ startDate: 1 })
                    .lean();
                const selectedIndex = allReleases.findIndex((r) => r._id.equals(releaseId));
                if (selectedIndex !== -1) {
                    pastIdentifiers = allReleases.slice(Math.max(0, selectedIndex - 5), selectedIndex + 1).map((r) => r._id);
                }
            }
            const metricsData = await DoraMetrics.aggregate([{ $match: matchQuery }], { allowDiskUse: true });
            const fetchTrend = async (metricField, trendName) => {
                const trendQuery = {
                    projectId: matchQuery.projectId,
                    companyId: matchQuery.companyId,
                    boardId: matchQuery.boardId,
                    [identifierType]: { $in: pastIdentifiers },
                };

                if (repoName) {
                    trendQuery.repoName = repoName;
                }

                const trendPipeline = [{ $match: trendQuery }, { $sort: { createdAt: -1 } }];

                if (identifierType === 'sprintId') {
                    trendPipeline.push(
                        {
                            $lookup: {
                                from: 'sprints',
                                localField: 'sprintId',
                                foreignField: '_id',
                                as: 'sprintData',
                            },
                        },
                        { $unwind: '$sprintData' },
                        { $sort: { 'sprintData.startDate': 1 } },
                        {
                            $project: {
                                _id: 0,
                                name: '$sprintData.name',
                                [trendName]: `$metrics.${metricField}`,
                            },
                        }
                    );
                } else if (identifierType === 'releaseId') {
                    trendPipeline.push(
                        {
                            $lookup: {
                                from: 'jirareleases',
                                localField: 'releaseId',
                                foreignField: '_id',
                                as: 'releaseData',
                            },
                        },
                        { $unwind: '$releaseData' },
                        { $sort: { 'releaseData.startDate': 1 } },
                        {
                            $project: {
                                _id: 0,
                                name: '$releaseData.releaseName',
                                [trendName]: `$metrics.${metricField}`,
                            },
                        }
                    );
                }

                return DoraMetrics.aggregate(trendPipeline, { allowDiskUse: true });
            };

            const [dfTrend, cfTrend, mttrTrend] = await Promise.all([
                fetchTrend('deploymentFrequency.avgDeploymentsPerDay', 'avgDeploymentsPerDay'),
                fetchTrend('changeFailureRate.changeFailureRate', 'changeFailureRate'),
                fetchTrend('mttr.mttr', 'mttr'),
            ]);

            const uniqueDfTrend = [...new Map(dfTrend.map((item) => [item.name, item])).values()];
            const uniqueCfTrend = [...new Map(cfTrend.map((item) => [item.name, item])).values()];
            const uniqueMttrTrend = [...new Map(mttrTrend.map((item) => [item.name, item])).values()];

            const result = {
                metricsData,
                dFTrend: uniqueDfTrend,
                cFTrend: uniqueCfTrend,
                mttrTrend: uniqueMttrTrend,
            };
            try {
                await redis.set(cacheKey, JSON.stringify(result), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            res.status(200).json(result);
        } catch (error) {
            console.error('Error fetching DORA metrics:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

export default new DoraMetricController();
