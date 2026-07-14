/* eslint-disable no-constant-condition */
import { ConnectionModel } from '../../../connection/model';
import { PROVIDER_NAME_GITLAB } from '../../../../utils/constants/providerConstants.js';

class MergedMRService {
    async getMergedMRsWithoutReviews(mergeRequests, startDate, endDate, companyId, tenantConnection) {
        const Connection = ConnectionModel(tenantConnection);
        const cred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITLAB });
        const { username } = cred || {};

        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            let totalMerged = 0;
            let mergedWithReview = 0;
            let mergedWithoutReview = 0;
            let unreviewedLastWeek = 0;

            mergeRequests.forEach(({ prMergedAt, reviews }) => {
                if (prMergedAt) {
                    const mergedAt = new Date(prMergedAt);

                    if (mergedAt >= start && mergedAt <= end) {
                        totalMerged++;

                        const userReviews = reviews.filter((review) => review.reviewState === 'manual');

                        if (!userReviews.length) {
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
                host: username || null,
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

    async getPercentageMergedPRsNoReviews(mergeRequests, startDate, endDate, companyId, tenantConnection) {
        try {
            const result = await this.getMergedMRsWithoutReviews(mergeRequests, startDate, endDate, companyId, tenantConnection);

            const totalMergedPRs = result.totalMergedPRs;
            const mergedWithoutReview = result.mergedWithoutReview;

            const percentage = totalMergedPRs > 0 ? ((mergedWithoutReview / totalMergedPRs) * 100).toFixed(1) : '0';

            return percentage;
        } catch (error) {
            console.error('Error in getPercentageMergedPRsNoReviews:', error);
            throw error;
        }
    }

    async getAvgTimeMergedPRsNoReviews(mergeRequests, startDate, endDate) {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);

            const mergedMRsWithoutReview = mergeRequests.filter((mr) => {
                if (mr.prMergedAt && mr.prCreatedAt) {
                    const mergedAt = new Date(mr.prMergedAt);

                    if (mergedAt >= start && mergedAt <= end) {
                        const userReviews = mr.reviews ? mr.reviews.filter((review) => review.reviewState === 'manual') : [];
                        return userReviews.length === 0;
                    }
                }
                return false;
            });

            const totalMerged = mergedMRsWithoutReview.length;
            if (totalMerged === 0) {
                return '0 hrs 00m';
            }

            const totalTime = mergedMRsWithoutReview.reduce((acc, { prCreatedAt, prMergedAt }) => {
                const createdAt = new Date(prCreatedAt);
                const mergedAt = new Date(prMergedAt);
                return acc + (mergedAt - createdAt);
            }, 0);

            const avgTimeMs = totalTime / totalMerged;
            const avgTimeHrs = Math.floor(avgTimeMs / (1000 * 60 * 60));
            const avgTimeMin = Math.floor((avgTimeMs % (1000 * 60 * 60)) / (1000 * 60));

            return avgTimeHrs > 0 ? `${avgTimeHrs} hrs ${avgTimeMin}m` : `${avgTimeMin}m`;
        } catch (error) {
            console.error('Error in getAvgTimeMergedPRsNoReviews:', error);
            throw error;
        }
    }

    async getAverageMergeTimeWithReview(mergeRequests, startDate, endDate) {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const mergedMRs = mergeRequests.filter(
                (mr) =>
                    mr.merged === 'merged' &&
                    mr.prCreatedAt &&
                    mr.prMergedAt &&
                    new Date(mr.prMergedAt) >= start &&
                    new Date(mr.prMergedAt) <= end &&
                    mr.reviews &&
                    mr.reviews.filter((review) => review.reviewState === 'manual').length > 0
            );

            if (mergedMRs.length === 0) {
                return { AverageTimeToMerge: '0 hrs 00m' };
            }
            const totalTimeMs = mergedMRs.reduce((total, { prCreatedAt, prMergedAt }) => {
                return total + (new Date(prMergedAt) - new Date(prCreatedAt));
            }, 0);
            const avgTimeMs = totalTimeMs / mergedMRs.length;
            const avgTimeHrs = Math.floor(avgTimeMs / (1000 * 60 * 60));
            const avgTimeMin = Math.floor((avgTimeMs % (1000 * 60 * 60)) / (1000 * 60));

            return { AverageTimeToMerge: avgTimeHrs > 0 ? `${avgTimeHrs} hrs ${avgTimeMin}m` : `${avgTimeMin}m` };
        } catch (error) {
            console.error('Error in getAverageMergeTime:', error);
            throw error;
        }
    }

    async getHighRiskMRs(mergeRequests, startDate, endDate) {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);

            const mergedMRs = mergeRequests.filter((mr) => {
                return mr.prMergedAt && new Date(mr.prMergedAt) >= start && new Date(mr.prMergedAt) <= end;
            });

            const highRiskMRs = mergedMRs.map((mr) => {
                const risks = [];
                const riskDetails = {};

                const totalLinesChanged = (mr.linesAdded || 0) + (mr.linesDeleted || 0);
                if (totalLinesChanged > 200) {
                    risks.push('large_size');
                    riskDetails.linesChanged = totalLinesChanged;
                }
                if ((mr.filesChanged || 0) > 20) {
                    risks.push('many_files');
                    riskDetails.filesChanged = mr.filesChanged;
                }
                const userReviews = mr.reviews ? mr.reviews.filter((review) => review.reviewState === 'manual') : [];
                if (!userReviews.length) {
                    risks.push('no_reviews');
                }
                if (mr.prCreatedBy === mr.prMergedBy) {
                    risks.push('self_merged');
                }
                if (mr.hasMissingTests === true) {
                    risks.push('missing_tests');
                }
                const hasSensitiveFiles = mr.sensitiveFiles && Array.isArray(mr.sensitiveFiles) && mr.sensitiveFiles.length > 0;
                if (mr.hasSensitiveChanges === true || hasSensitiveFiles) {
                    risks.push('sensitive_changes');
                    if (hasSensitiveFiles) {
                        riskDetails.sensitiveFiles = mr.sensitiveFiles;
                    }
                }

                const riskScore = risks.length;

                return {
                    prNumber: mr.prId,
                    title: mr.title,
                    repo: mr.repo,
                    mergedAt: mr.prMergedAt,
                    author: mr.prCreatedBy,
                    mergedBy: mr.prMergedBy,
                    risks,
                    riskDetails,
                    riskScore,
                    linesAdded: mr.linesAdded,
                    linesDeleted: mr.linesDeleted,
                    filesChanged: mr.filesChanged,
                    webUrl: mr.webUrl,
                };
            });

            highRiskMRs.sort((a, b) => b.riskScore - a.riskScore);
            const totalMergedMRs = mergedMRs.length;
            const highRiskCount = highRiskMRs.filter((mr) => mr.riskScore > 0).length;
            const highRiskPercentage = totalMergedMRs > 0 ? ((highRiskCount / totalMergedMRs) * 100).toFixed(1) : '0';

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

            highRiskMRs.forEach((mr) => {
                mr.risks.forEach((risk) => {
                    if (riskFactorCounts[risk] !== undefined) {
                        riskFactorCounts[risk]++;

                        const currentDate = new Date();
                        const currentDateIST = new Date(currentDate.getTime() + 5.5 * 60 * 60 * 1000);
                        const mergedAt = new Date(mr.mergedAt);
                        const mergedAtIST = new Date(mergedAt.getTime() + 5.5 * 60 * 60 * 1000);
                        const dateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        const daysAgo = Math.floor((dateOnly(currentDateIST) - dateOnly(mergedAtIST)) / (1000 * 60 * 60 * 24));

                        const mrInfo = {
                            prNumber: mr.prNumber,
                            title: mr.title,
                            daysAgo,
                            repo: mr.repo,
                        };

                        if (risk === 'sensitive_changes' && mr.riskDetails.sensitiveFiles) {
                            mrInfo.sensitiveFiles = mr.riskDetails.sensitiveFiles;
                        }

                        riskFactorPRs[risk].push(mrInfo);
                    }
                });
            });

            const mergedPRDetails = mergedMRs.map((mr) => {
                const currentDate = new Date();
                const currentDateIST = new Date(currentDate.getTime() + 5.5 * 60 * 60 * 1000);
                const mergedAt = new Date(mr.prMergedAt);
                const mergedAtIST = new Date(mergedAt.getTime() + 5.5 * 60 * 60 * 1000);
                const dateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
                const daysAgo = Math.floor((dateOnly(currentDateIST) - dateOnly(mergedAtIST)) / (1000 * 60 * 60 * 24));

                return {
                    prNumber: mr.prId,
                    title: mr.title,
                    daysAgo,
                    repo: mr.repo,
                };
            });

            return {
                totalMergedMRs,
                highRiskCount,
                highRiskPercentage,
                riskFactorCounts,
                riskFactorPRs,
                mergedPRDetails,
            };
        } catch (error) {
            console.error('Error in getHighRiskMRs:', error);
            throw error;
        }
    }
}

export default new MergedMRService();
