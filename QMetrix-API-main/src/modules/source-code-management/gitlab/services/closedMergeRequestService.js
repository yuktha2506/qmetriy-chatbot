/* eslint-disable no-constant-condition */
import { getSprintDates, getReleaseDates } from '../../common/scmHelper.js';
class ClosedMergeRequestService {
    async getClosedMergeRequestsCount(mergeRequests, startDate, endDate) {
        try {
            const closedPRsInRange = mergeRequests.filter((pr) => {
                const prMergedAt = new Date(pr.prMergedAt);
                return prMergedAt >= new Date(startDate) && prMergedAt <= new Date(endDate);
            });
            return closedPRsInRange.length;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
    async closedMergeRequestsByCategory(mergeRequests, sprints, releases, identifierType) {
        try {
            const isSprint = identifierType === 'sprintId';
            const items = isSprint ? sprints : releases;

            const result = items.map((item) => ({
                name: isSprint ? item.name : item.releaseName,
                count: 0,
            }));
            mergeRequests.forEach((mr) => {
                if (mr.status === 'merged') {
                    const mergedAtDate = new Date(mr.prMergedAt);
                    items.forEach((item, index) => {
                        let startDate, endDate;
                        if (isSprint) {
                            ({ startDate, endDate } = getSprintDates(sprints, item._id));
                        } else {
                            ({ startDate, endDate } = getReleaseDates(releases, item._id));
                        }
                        if (mergedAtDate >= startDate && mergedAtDate <= endDate) {
                            if ((isSprint && item._id === mr.sprintId) || (!isSprint && item.releaseName === mr.fixVersion)) {
                                result[index].count++;
                            }
                        }
                    });
                }
            });

            return result;
        } catch (error) {
            console.error('Error fetching closed pull requests:', error);
            throw error;
        }
    }
    async getClosedMergeRequestsByDev(mergeRequests, startDate, endDate) {
        try {
            const closedByDev = mergeRequests
                .filter((mr) => {
                    const mergedDate = new Date(mr.prMergedAt);
                    return mr.status === 'merged' && mergedDate >= startDate && mergedDate <= endDate;
                })
                .reduce((acc, mr) => {
                    const dev = mr.prCreatedBy;
                    if (!acc[dev]) {
                        acc[dev] = 0;
                    }
                    acc[dev]++;
                    return acc;
                }, {});

            const result = Object.entries(closedByDev).map(([dev, count]) => ({
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

export default new ClosedMergeRequestService();
