import { getSprintDates, getReleaseDates } from '../../common/scmHelper.js';

class ClosedPRService {
    async getClosedPullRequestsPerSprintOrRelease(pullRequests, sprints, releases, identifierType, selectedSprintOrRelease, repo) { 
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
         
            function isPRInTimeRange(pr, startDate, endDate) { 
                const start = new Date(startDate);
                const end = new Date(endDate);
                if (pr.status === 'closed') { 
                    const closedDate = new Date(pr.prClosedAt);
                    return closedDate >= start && closedDate <= end;
                }
                return false; 
            } 
         
            pullRequests.forEach((pullRequest) => { 
                if (repo && pullRequest.repo !== repo) {
                    return;
                }
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
            console.error('Error fetching closed pull requests:', error); 
            throw error; 
        }
    }
    async getClosedPullRequestsBySprintOrRelease(pullRequests, startDate, endDate) {
        try {
            const closedPRsInRange = pullRequests.filter((pr) => {
    
                const prClosedAt = new Date(pr.prClosedAt);
                return prClosedAt >= new Date(startDate) && prClosedAt <= new Date(endDate);
            });
            return closedPRsInRange.length;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
    async getClosedPullRequestsByDev(pullRequests, startDate, endDate) {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const closedByDev = pullRequests
                .filter((pr) => {
                    const closedDate = new Date(pr.prClosedAt);
                    return closedDate >= start && closedDate <= end;
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
}

export default new ClosedPRService();
