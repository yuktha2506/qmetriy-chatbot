import { getSprintDates, getReleaseDates } from '../../common/scmHelper.js';
class ClosedMergeRequestService {
    async getOpenMergeRequestsCount(mergeRequests, startDate, endDate) {
        try {
            const openPRsInRange = mergeRequests.filter((mr) => {
                const mrCreatedAt = new Date(mr.prCreatedAt);
                return mrCreatedAt >= new Date(startDate) && mrCreatedAt <= new Date(endDate);
            });
            return openPRsInRange.length;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
    async openMergeRequestsByCategory(mergeRequests, sprints, releases, identifierType) {
        try {
            const isSprint = identifierType === 'sprintId';
            const items = isSprint ? sprints : releases;

            const result = items.map((item) => ({
                name: isSprint ? item.name : item.releaseName,
                count: 0,
            }));

            mergeRequests.forEach((mr) => {
                if (mr.status === 'opened') {
                    const mrCreatedAt = new Date(mr.prCreatedAt);
                    items.forEach((item, index) => {
                        let startDate, endDate;
                        if (isSprint) {
                            ({ startDate, endDate } = getSprintDates(sprints, item._id));
                        } else {
                            ({ startDate, endDate } = getReleaseDates(releases, item._id));
                        }
                        if (mrCreatedAt >= startDate && mrCreatedAt <= endDate) {
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

    async getOpenMergeRequestsByDev(mergeRequests, startDate, endDate) {
        try {
            const closedByDev = mergeRequests
                .filter((mr) => {
                    const mrCreatedAt = new Date(mr.prCreatedAt);
                    return mr.status === 'opened' && mrCreatedAt >= startDate && mrCreatedAt <= endDate;
                })
                .reduce((acc, mr) => {
                    const name = mr.prCreatedBy;
                    if (!acc[name]) {
                        acc[name] = 0;
                    }
                    acc[name]++;
                    return acc;
                }, {});

            const result = Object.entries(closedByDev).map(([name, count]) => ({
                name,
                count,
            }));

            return result;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
    async getOpenReviewedAndUnreviewedPrs(pullRequests, endDate) {
        try {
            let reviewedPRs = 0;
            let unreviewedPRs = 0;
            const end = new Date(endDate);
            pullRequests.forEach(({ status, reviews, prCreatedAt }) => {
                if (status === 'opened' && new Date(prCreatedAt) < end) {
                    if (reviews && reviews.length > 0) {
                        reviewedPRs++;
                    } else {
                        unreviewedPRs++;
                    }
                }
            });
    
            return {
                OpenPrs: {
                    'UnreviewedPRs': unreviewedPRs,
                    'ReviewedPRs': reviewedPRs,
                }
            };
        } catch (error) {
            console.error('Error in getOpenReviewedAndUnreviewedPrs:', error);
            throw error;
        }
    } 
}

export default new ClosedMergeRequestService();
