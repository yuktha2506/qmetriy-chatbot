import { getSprintDates, getReleaseDates } from '../../common/scmHelper.js';

class TotalPRService {
    async getTotalPullRequestsPerSprintOrRelease(pullRequests, sprints, releases, identifierType, selectedSprintOrRelease) {
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
 
            const result = items.map((item) => ({ 
                name: isSprint ? item.name : item.releaseName, 
                count: 0, 
            })); 
    
            // Helper function to check if a PR is within a time range
            function isPRInTimeRange(pr, startDate, endDate) {
                if (pr.status === 'open') {
                    const prCreatedAt = new Date(pr.prCreatedAt);
                    return prCreatedAt <= endDate;
                } else if (pr.status === 'closed') {
                    const prClosedAt = new Date(pr.prClosedAt);
                    return prClosedAt >= startDate && prClosedAt <= endDate;
                }
                return false;
            }
    
            pullRequests.forEach((pullRequest) => {
                items.forEach((item, index) => {
                    let startDate, endDate;
    
                    if (isSprint) {
                        const { startDate: s, endDate: e } = getSprintDates(sprints, item._id);
                        startDate = s;
                        endDate = e;
                    } else {
                        const { startDate: s, endDate: e } = getReleaseDates(releases, item._id);
                        startDate = s;
                        endDate = e;
                    }
    
                    if (startDate && endDate && isPRInTimeRange(pullRequest, startDate, endDate)) {
                        result[index].count++;
                    }
                });
            });    
    
            return result;
        } catch (error) {
            console.error('Error fetching pull requests per sprint/release:', error);
            throw error;
        }
    }    
    async getTotalPullRequests(pullRequests, startDate, endDate) {
        try {
            const totalPullRequests = pullRequests.filter((pr) => {
                if (pr.status === 'open') {
                    const prCreatedAt = new Date(pr.prCreatedAt);
                    return prCreatedAt <= endDate;
                } else if (pr.status === 'closed') {
                    const prClosedAt = new Date(pr.prClosedAt);
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
    async getTotalPullRequestsSprintOrReleaseTrend(pullRequests, sprints, releaseData, identifierType) {
        try {
            const result = {};
            const currentDate = new Date();
            const isSprint = identifierType === 'sprintId';

            const items = isSprint ? sprints : releaseData;

            pullRequests.forEach((pullRequest) => {
                const createdAtDate = new Date(pullRequest.prCreatedAt);

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
    async getTotalPullRequestsByDev(pullRequests, startDate, endDate) {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
    
            // Helper to check if a PR falls within the time range
            function isPRInTimeRange(pr, start, end) {
                if (pr.status === 'open') {
                    const prCreatedAt = new Date(pr.prCreatedAt);
                    return prCreatedAt <= end;
                } else if (pr.status === 'closed') {
                    const prClosedAt = new Date(pr.prClosedAt);
                    return prClosedAt >= start && prClosedAt <= end;
                }
                return false;
            }
    
            const byDev = pullRequests
                .filter((pr) => isPRInTimeRange(pr, start, end))
                .reduce((acc, pr) => {
                    const dev = pr.prCreatedBy;
                    if (!acc[dev]) {
                        acc[dev] = 0;
                    }
                    acc[dev]++;
                    return acc;
                }, {});
    
            const result = Object.entries(byDev).map(([dev, count]) => ({
                dev,
                count,
            }));
    
            return result;
        } catch (error) {
            console.error('Error calculating PRs by developer:', error);
            throw error;
        }
    }    
}

export default new TotalPRService();
