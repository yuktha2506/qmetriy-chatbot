import { ConnectionModel } from '../../../connection/model.js';
import { PROVIDER_NAME_GITHUB } from '../../../../utils/constants/providerConstants.js';

class MergedPRService {
    async getMergedPRsWithoutReviews(pullRequests, startDate, endDate, tenantConnection, companyId) {
        const Connection = ConnectionModel(tenantConnection);
        const cred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITHUB });
        const { host } = cred || {};

        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            let totalMerged = 0;
            let mergedWithReview = 0;
            let mergedWithoutReview = 0;
            let unreviewedLastWeek = 0;

            pullRequests.forEach(({ prMergedAt, reviews }) => {
                if (prMergedAt) {
                    const mergedAt = new Date(prMergedAt);

                    if (mergedAt >= start && mergedAt <= end) {
                        totalMerged++;

                        if (!reviews.length) {
                            mergedWithoutReview++;

                            if (mergedAt >= oneWeekAgo) {
                                unreviewedLastWeek++;
                            }
                        } else {
                            mergedWithReview++;
                        }
                    }
                }
            });

            const lastWeekPercentage = mergedWithoutReview > 0 ? ((unreviewedLastWeek / mergedWithoutReview) * 100).toFixed(1) : '0';

            return {
                host: host || null,
                totalMergedPRs: totalMerged,
                mergedWithReviewPrs: mergedWithReview,
                mergedWithoutReview,
                unreviewedLastWeek,
                lastWeekUnreviewedPercentage: `${lastWeekPercentage}`,
            };
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async getPercentageMergedPRsNoReviews(pullRequests, startDate, endDate, tenantConnection, companyId) {
        try {
            const result = await this.getMergedPRsWithoutReviews(pullRequests, startDate, endDate, tenantConnection, companyId);

            const totalMergedPRs = result.totalMergedPRs;
            const mergedWithoutReview = result.mergedWithoutReview;

            const percentage = totalMergedPRs > 0 ? ((mergedWithoutReview / totalMergedPRs) * 100).toFixed(1) : '0';

            return percentage;
        } catch (error) {
            console.error('Error in getPercentageMergedPRsNoReviews:', error);
        }
    }

    async getAvgTimeMergedPRsNoReviews(pullRequests, startDate, endDate) {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);

            const mergedPRsWithoutReview = pullRequests.filter((pr) => {
                if (pr.prMergedAt && pr.prCreatedAt) {
                    const mergedAt = new Date(pr.prMergedAt);
                    return mergedAt >= start && mergedAt <= end && (!pr.reviews || pr.reviews.length === 0);
                }
                return false;
            });

            const totalMerged = mergedPRsWithoutReview.length;
            if (totalMerged === 0) {
                return '0 hrs 00m';
            }

            const totalTime = mergedPRsWithoutReview.reduce((acc, { prCreatedAt, prMergedAt }) => {
                const createdAt = new Date(prCreatedAt);
                const mergedAt = new Date(prMergedAt);
                return acc + (mergedAt - createdAt);
            }, 0);

            const avgTimes = totalTime / totalMerged;
            const avgTimeHrs = Math.floor(avgTimes / (1000 * 60 * 60));
            const avgTimeMin = Math.floor((avgTimes % (1000 * 60 * 60)) / (1000 * 60));
            return avgTimeHrs > 0 ? `${avgTimeHrs} hrs ${avgTimeMin}m` : `${avgTimeMin}m`;
        } catch (error) {
            console.error('Error in getAvgTimeMergedPRsNoReviews:', error);
            throw error;
        }
    }

    async getAverageMergeTime(pullRequests, startDate, endDate) {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const mergedPRs = pullRequests.filter(
                (pr) => pr.merged === 'true' && pr.prCreatedAt && pr.prMergedAt && new Date(pr.prMergedAt) >= start && new Date(pr.prMergedAt) <= end && pr.reviews && pr.reviews.length > 0
            );

            if (mergedPRs.length === 0) {
                return { AverageTimeToMerge: '0 hrs 00m' };
            }
            const totalTimeMs = mergedPRs.reduce((total, { prCreatedAt, prMergedAt }) => {
                return total + (new Date(prMergedAt) - new Date(prCreatedAt));
            }, 0);
            const avgTimeMs = totalTimeMs / mergedPRs.length;
            const avgTimeHrs = Math.floor(avgTimeMs / (1000 * 60 * 60));
            const avgTimeMin = Math.floor((avgTimeMs % (1000 * 60 * 60)) / (1000 * 60));

            return { AverageTimeToMerge: avgTimeHrs > 0 ? `${avgTimeHrs} hrs ${avgTimeMin}m` : `${avgTimeMin}m` };
        } catch (error) {
            console.error('Error in getAverageMergeTime:', error);
            throw error;
        }
    }
    async getHighRiskPRs(pullRequests, startDate, endDate) {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);

            const mergedPRs = pullRequests.filter((pr) => {
                return pr.prMergedAt && new Date(pr.prMergedAt) >= start && new Date(pr.prMergedAt) <= end;
            });

            const highRiskPRs = mergedPRs.map((pr) => {
                const risks = [];
                const riskDetails = {};

                const totalLinesChanged = (pr.linesAdded || 0) + (pr.linesDeleted || 0);
                if (totalLinesChanged > 200) {
                    risks.push('large_size');
                    riskDetails.linesChanged = totalLinesChanged;
                }
                if ((pr.filesChanged || 0) > 20) {
                    risks.push('many_files');
                    riskDetails.filesChanged = pr.filesChanged;
                }
                if (!pr.reviews || pr.reviews.length === 0) {
                    risks.push('no_reviews');
                }
                if (pr.prCreatedBy === pr.prMergedBy) {
                    risks.push('self_merged');
                }
                if (pr.missingTests.hasMissingTests === true) {
                    risks.push('missing_tests');
                }
                if (pr.hasSensitiveChanges === true || (pr.sensitiveFiles && pr.sensitiveFiles.length > 0)) {
                    risks.push('sensitive_changes');
                    if (pr.sensitiveFiles && pr.sensitiveFiles.length > 0) {
                        riskDetails.sensitiveFiles = pr.sensitiveFiles;
                    }
                }
                const riskScore = risks.length;

                return {
                    prNumber: pr.prNumber,
                    title: pr.title,
                    repo: pr.repo,
                    mergedAt: pr.prMergedAt,
                    author: pr.prCreatedBy,
                    mergedBy: pr.prMergedBy,
                    risks,
                    riskDetails,
                    riskScore,
                    linesAdded: pr.linesAdded,
                    linesDeleted: pr.linesDeleted,
                    filesChanged: pr.filesChanged,
                };
            });

            highRiskPRs.sort((a, b) => b.riskScore - a.riskScore);
            const totalMergedPRs = mergedPRs.length;
            const highRiskCount = highRiskPRs.filter((pr) => pr.riskScore > 0).length;
            const highRiskPercentage = totalMergedPRs > 0 ? ((highRiskCount / totalMergedPRs) * 100).toFixed(1) : '0';

            const riskFactorCounts = {
                large_size: 0,
                many_files: 0,
                no_reviews: 0,
                self_merged: 0,
                missing_tests: 0,
                sensitive_changes: 0,
            };

            const riskFactorPRs = {
                large_size: [],
                many_files: [],
                no_reviews: [],
                self_merged: [],
                missing_tests: [],
                sensitive_changes: [],
            };

            highRiskPRs.forEach((pr) => {
                pr.risks.forEach((risk) => {
                    if (riskFactorCounts[risk] !== undefined) {
                        riskFactorCounts[risk]++;
                        const currentDate = new Date();
                        const currentDateIST = new Date(currentDate.getTime() + 5.5 * 60 * 60 * 1000);
                        const mergedAt = new Date(pr.mergedAt);
                        const mergedAtIST = new Date(mergedAt.getTime() + 5.5 * 60 * 60 * 1000);
                        const dateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        const daysAgo = Math.floor((dateOnly(currentDateIST) - dateOnly(mergedAtIST)) / (1000 * 60 * 60 * 24));

                        const prInfo = {
                            prNumber: pr.prNumber,
                            title: pr.title,
                            daysAgo,
                            repo: pr.repo,
                        };
                        if (risk === 'sensitive_changes' && pr.riskDetails.sensitiveFiles) {
                            prInfo.sensitiveFiles = pr.riskDetails.sensitiveFiles;
                        }

                        riskFactorPRs[risk].push(prInfo);
                    }
                });
            });

            const mergedPRDetails = mergedPRs.map((pr) => {
                const currentDate = new Date();
                const currentDateIST = new Date(currentDate.getTime() + 5.5 * 60 * 60 * 1000);
                const mergedAt = new Date(pr.prMergedAt);
                const mergedAtIST = new Date(mergedAt.getTime() + 5.5 * 60 * 60 * 1000);
                const dateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
                const daysAgo = Math.floor((dateOnly(currentDateIST) - dateOnly(mergedAtIST)) / (1000 * 60 * 60 * 24));

                return {
                    prNumber: pr.prNumber,
                    title: pr.title,
                    daysAgo,
                    repo: pr.repo,
                };
            });

            return {
                totalMergedPRs,
                highRiskCount,
                highRiskPercentage,
                riskFactorCounts,
                riskFactorPRs,
                mergedPRDetails,
            };
        } catch (error) {
            console.error('Error in getHighRiskPRs:', error);
            throw error;
        }
    }
}

export default new MergedPRService();
