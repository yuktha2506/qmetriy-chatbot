import { JiraReleaseModel, SprintModel } from '../../../project-management/jira/model';
import { PullRequestModel } from '../model';
import { DoraMetricsModel } from '../../../source-code-management/github/model';
import { Types } from 'mongoose';
import { redis } from '../../../../server';
import cache from '../../../../utils/cache';

class LeadTimeService {
    async getLeadTime(requestParams) {
        try {
            const { companyId, projectId, boardId, sprintId, releaseId, repo, tenantConnection } = requestParams;

            const cacheKey = cache.generateKey('leadTime', {
                projectId,
                companyId,
                boardId,
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
                return JSON.parse(cached);
            }
            const Sprint = SprintModel(tenantConnection);
            const JiraRelease = JiraReleaseModel(tenantConnection);
            const PullRequest = PullRequestModel(tenantConnection);
            const matchQuery = { companyId, projectId, repo };
            if (boardId) {
                matchQuery.boardId = new Types.ObjectId(boardId);
            }
    
            if (sprintId) {
                matchQuery.sprintId = sprintId;
            } else if (releaseId) {
                const releaseDataQuery = { companyId, projectId, _id: releaseId };
                if (boardId) {
                    releaseDataQuery.boardId = new Types.ObjectId(boardId);
                }
                const releaseData = await JiraRelease.findOne(releaseDataQuery);
                if (!releaseData) {
                    throw new Error('Release data not found');
                }
                matchQuery.fixVersion = releaseData.releaseName;
            }
    
            const pullRequests = await PullRequest.find(matchQuery);
            const totalPRs = pullRequests.length;
            const sprintQuery = sprintId ? { _id: sprintId, projectId, companyId } : null;
            if (sprintQuery && boardId) {
                sprintQuery.boardId = new Types.ObjectId(boardId);
            }
            const sprint = sprintId ? await Sprint.findOne(sprintQuery) : null;
            const releaseQuery = releaseId ? { _id: releaseId, companyId, projectId } : null;
            if (releaseQuery && boardId) {
                releaseQuery.boardId = new Types.ObjectId(boardId);
            }
            const release = releaseId ? await JiraRelease.findOne(releaseQuery) : null;
    
            const calculateTime = (start, end) => (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);
    
            const developerStats = {};
            pullRequests.forEach((pr) => {
                if (pr.commits && pr.commits.length > 0) {
                    const developer = pr.prCreatedBy;
                    const firstCommitTime = new Date(pr.commits[0].date).getTime();
                    let releaseTime;
    
                    if (sprintId) {
                        const matchingRelease = sprint?.releases.find((r) => r.name === pr.fixVersion);
                        releaseTime = matchingRelease ? new Date(matchingRelease.releaseDate).getTime() : 0;
                    } else if (releaseId) {
                        releaseTime = new Date(release.releaseDate).getTime();
                    }
    
                    if (releaseTime && releaseTime > firstCommitTime) {
                        const leadTime = calculateTime(firstCommitTime, releaseTime);
    
                        if (!developerStats[developer]) {
                            developerStats[developer] = {
                                totalPRs: 0,
                                totalLTC: 0,
                                minLTC: leadTime,
                                maxLTC: leadTime,
                            };
                        }
                        developerStats[developer].totalPRs += 1;
                        developerStats[developer].totalLTC += leadTime;
                        developerStats[developer].minLTC = Math.min(developerStats[developer].minLTC, leadTime);
                        developerStats[developer].maxLTC = Math.max(developerStats[developer].maxLTC, leadTime);
                    }
                }
            });

            const totalLeadTimeStats = pullRequests.reduce((total, pr) => {
                if (pr.commits && pr.commits.length > 0) {
                    const firstCommitTime = new Date(pr.commits[0].date).getTime();
                    let releaseTime;

                    if (sprintId) {
                        const matchingRelease = sprint?.releases.find((r) => r.name === pr.fixVersion);
                        releaseTime = matchingRelease ? new Date(matchingRelease.releaseDate).getTime() : 0;
                    } else if (releaseId) {
                        releaseTime = new Date(release.releaseDate).getTime();
                    }

                    if (releaseTime && releaseTime > firstCommitTime) {
                        total += releaseTime ? calculateTime(firstCommitTime, releaseTime) : 0;
                    }
                }
                return total;
            }, 0);
            
            const averageLeadTime = totalPRs > 0 ? totalLeadTimeStats / totalPRs : 0;
            const validAverageLeadTime = isNaN(averageLeadTime) || !isFinite(averageLeadTime) ? 0 : averageLeadTime;
            
            // Update DORA metrics with average lead time
            const DoraMetric = DoraMetricsModel(tenantConnection);
            await DoraMetric.updateOne(
                { 
                    companyId, 
                    projectId, 
                    sprintId: sprintId || null, 
                    releaseId: releaseId || null, 
                    repoName: repo,
                },
                { 
                    $set: { 
                        'metrics.leadTime': validAverageLeadTime
                    } 
                },
                { upsert: true }
            );
    
            const result = Object.keys(developerStats).map((dev) => ({
                developer: dev,
                totalPRs: developerStats[dev].totalPRs,
                avgLTC: parseFloat((developerStats[dev].totalLTC / developerStats[dev].totalPRs).toFixed(2)) || 0,
                minLTC: parseFloat(developerStats[dev].minLTC.toFixed(2)),
                maxLTC: parseFloat(developerStats[dev].maxLTC.toFixed(2)),
            }));
            const res = [{ result: result }, { total: Math.max(0, Math.round(validAverageLeadTime || 0)) }];

            try {
                await redis.set(cacheKey, JSON.stringify(res), 'EX', 28800);
            } catch (err) {
                console.warn('Redis not available, skipping cache set:', err.message);
            }
            return res;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}

export default new LeadTimeService();
