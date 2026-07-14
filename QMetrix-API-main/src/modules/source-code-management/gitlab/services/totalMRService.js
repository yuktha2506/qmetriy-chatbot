/* eslint-disable no-unused-vars */
/* eslint-disable indent */
import { getSprintDates, getReleaseDates } from '../../common/scmHelper.js';
class TotalMRService {
    async getTotalMergeRequests(pullRequests, startDate, endDate) {
        try {
            const totalPullRequests = pullRequests.filter((pr) => {
                if (pr.status === 'opened') {
                    const prCreatedAt = new Date(pr.prCreatedAt);
                    return prCreatedAt <= endDate;
                } else if (pr.status === 'merged') {
                    const prClosedAt = new Date(pr.prMergedAt);
                    return prClosedAt >= startDate && prClosedAt <= endDate;
                }
                return false;
            });
            return totalPullRequests.length;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
    async getTotalMergeRequestsPerSprintOrRelease(pullRequests, sprints, releaseData, identifierType) {
        try {
            const isSprint = identifierType === 'sprintId';
            const items = isSprint ? sprints : releaseData;
            const result = items.map((item) => ({
                name: isSprint ? item.name : item.releaseName,
                count: 0,
            }));
            pullRequests.forEach((mr) => {
                let mrDate;
                if (mr.status === 'opened') {
                    mrDate = new Date(mr.prCreatedAt);
                } else if (mr.status === 'merged') {
                    mrDate = new Date(mr.prMergedAt);
                } else {
                    return;
                }
                items.forEach((item, index) => {
                    let startDate, endDate;
                    if (isSprint) {
                        ({ startDate, endDate } = getSprintDates(sprints, item._id));
                    } else {
                        ({ startDate, endDate } = getReleaseDates(releaseData, item._id));
                    }
                    if (mrDate >= startDate && mrDate <= endDate) {
                        if ((isSprint && item._id === mr.sprintId) || (!isSprint && item.releaseName === mr.fixVersion)) {
                            result[index].count++;
                        }
                    }
                });
            });

            return result;
        } catch (error) {
            console.error('Error fetching closed pull requests:', error);
            throw error;
        }
    }
    async getTotalMergeRequestsByDev(pullRequests, startDate, endDate) {
        try {
            const openByDev = pullRequests
                .filter((pr) => {
                    if (pr.status === 'opened') {
                        const prCreatedAt = new Date(pr.prCreatedAt);
                        return prCreatedAt >= startDate && prCreatedAt <= endDate;
                    } else if (pr.status === 'merged') {
                        const prClosedAt = new Date(pr.prMergedAt);
                        return prClosedAt >= startDate && prClosedAt <= endDate;
                    }
                    return false;
                })
                .reduce((acc, mr) => {
                    const dev = mr.prCreatedBy;
                    if (!acc[dev]) {
                        acc[dev] = 0;
                    }
                    acc[dev]++;
                    return acc;
                }, {});

            const result = Object.entries(openByDev).map(([dev, count]) => ({
                dev,
                count,
            }));
            return result;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}

export default new TotalMRService();
