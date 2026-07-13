class OpenPRService {
    async getOpenPullRequestsBySprintOrRelease(pullRequests, endDate) {
        try {
            const openPRs = pullRequests.filter((pr) => {
    
                const prCreatedAt = new Date(pr.prCreatedAt);
                const isWithinDateRange = prCreatedAt < new Date(endDate);
    
                return isWithinDateRange;
            });
    
            return openPRs.length;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
    
    async getOpenPullRequestsPerSprintOrRelease(pullRequests, sprints, releases, identifierType, selectedSprintOrRelease) {
        try {
            const isSprint = identifierType === 'sprintId'; 
            let items = [];
        
            if (isSprint) {
                const sortedSprints = [...sprints].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                const selectedSprint = sortedSprints.find((sprint) => sprint._id.equals(selectedSprintOrRelease));
                if (!selectedSprint) {
                    throw new Error('Selected sprint not found');
                }
                const selectedSprintIndex = sortedSprints.findIndex((sprint) => sprint._id.equals(selectedSprintOrRelease));
            
                items = sortedSprints.slice(Math.max(0, selectedSprintIndex - 5), selectedSprintIndex + 1);
            } else {
                const sortedReleases = [...releases].sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
                const selectedRelease = sortedReleases.find((release) => release._id.equals(selectedSprintOrRelease));
                if (!selectedRelease) {
                    throw new Error('Selected release not found');
                }
                const selectedReleaseIndex = sortedReleases.findIndex((release) => release._id.equals(selectedSprintOrRelease));
                items = sortedReleases.slice(Math.max(0, selectedReleaseIndex - 5), selectedReleaseIndex + 1);
            }
            const result = {};
            items.forEach((item) => {
                const itemName = isSprint ? item.name : item.releaseName;
                result[itemName] = 0;
            });
    
            pullRequests.forEach((pullRequest) => {
                
                if (isSprint) {
                    items.forEach((sprint) => {
                        if (String(sprint._id) === String(pullRequest.sprintId) || 
                            String(pullRequest.sprintId).includes(String(sprint._id))) {
                            result[sprint.name]++;
                        }
                    });
                } else {
                    items.forEach((release) => {
                        if (release.releaseName === pullRequest.fixVersion) {
                            result[release.releaseName]++;
                        }
                    });
                }
            });
    
            return result;
        } catch (error) {
            console.error('Error fetching open pull requests:', error);
            throw error;
        }
    }

    async getOpenPullRequestsSprintTrend(pullRequests, sprints, releaseData, identifierType) {
        try {
            const result = {};
            const currentDate = new Date();
            const isSprint = identifierType === 'sprintId';

            const items = isSprint ? sprints : releaseData;

            pullRequests.forEach((pullRequest) => {
                const createdAtDate = new Date(pullRequest.createdAt);

                for (const item of items) {
                    const itemName = isSprint ? item.name : item.releaseName;
                    const startDate = new Date(item.startDate);
                    const endDate = new Date(isSprint ? item.endDate : item.releaseDate);

                    if (!result[itemName]) {
                        result[itemName] = 0;
                    }

                    if (createdAtDate <= endDate && createdAtDate >= startDate) {
                        if (currentDate <= endDate || createdAtDate <= endDate) {
                            if (!isSprint && item.releaseName === pullRequest.fixVersion) {
                                result[itemName]++;
                            } else if (isSprint && (String(item._id) === String(pullRequest.sprintId) || String(pullRequest.sprintId).includes(String(item._id)))) {
                                result[itemName]++;
                            }
                        }
                    }
                }
            });

            return result;
        } catch (error) {
            console.error('Error fetching open pull requests:', error);
            throw error;
        }
    }

    async getOpenPullRequestsByDev(pullRequests, startDate, endDate) {
        try {
            const end = new Date(endDate);
            const closedByDev = pullRequests
                .filter((pr) => {
                    return pr.prCreatedAt < new Date(end);
                })
                .reduce((acc, pr) => {
                    const dev = pr.prCreatedBy;
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

    async getInProgressPullRequests(pullRequests, startDate, endDate) {
        try {
            const inProgressPRsInRange = pullRequests.filter((pr) => {
                const prCreatedAt = new Date(pr.prCreatedAt);
                return prCreatedAt >= new Date(startDate) && prCreatedAt <= new Date(endDate);
            });
            return inProgressPRsInRange.length;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async getPRsLackOfApproval(pullRequests, startDate, endDate) {
        try {
            let failedPrs = 0;
            const start = new Date(startDate);
            const end = new Date(endDate);
            for (const pr of pullRequests) {
                if (!pr.prMergedAt && pr.prCreatedAt >= start && pr.prCreatedAt <= end) {
                    for (const review of pr.reviews) {
                        if (review.reviewState === 'CHANGES_REQUESTED') {
                            failedPrs += 1;
                        }
                    }
                }
            }
            return failedPrs;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async getPullRequestsWithMergeConflicts(pullRequests, startDate, endDate) {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);

            let count = 0;
            const filteredPullRequests = pullRequests.filter((pr) => {
                const prDate = new Date(pr.prCreatedAt);
                return prDate >= start && prDate <= end;
            });
            const results = await Promise.allSettled(
                filteredPullRequests.map(async (pr) => {
                    try {
                        if (pr.mergeable === false) {
                            return { number: pr.prId, status: 'dirty' };
                        }
                    } catch (error) {
                        console.error(`Error processing PR #${pr.prId}:`, error.message);
                        return { number: pr.prId, status: 'failed' };
                    }
                    return { number: pr.prId, status: 'clean' };
                })
            );
            results.forEach((result) => {
                if (result.status === 'fulfilled' && result.value.status === 'dirty') {
                    count++;
                }
            });

            return count;
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
                if (status === 'open' && new Date(prCreatedAt) < end) {
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

export default new OpenPRService();
