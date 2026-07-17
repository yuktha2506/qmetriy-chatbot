class BugRateService {
    async calculateBugRate(workStartedIssues, workCompletedIssues, projectStoryIssues) {
        let bugsCreated = 0;
        let closedStories = 0;
        const storyKeys = new Set(projectStoryIssues.map((s) => s.key));
        workStartedIssues.forEach((issue) => {
            if (issue.type?.name?.toLowerCase() !== 'bug') {
                return;
            }
            const blockedByKeys = Array.isArray(issue.blockedBy) ? issue.blockedBy : [];
            const relatesToKeys = Array.isArray(issue.relatesTo) ? issue.relatesTo : [];
            const linkedKeys = [...blockedByKeys, ...relatesToKeys].filter(Boolean);

            const isLinkedToStory = linkedKeys.some((key) => storyKeys.has(key));
            if (isLinkedToStory) {
                bugsCreated++;
            }
        });

        workCompletedIssues.forEach((issue) => {
            if (issue.type?.name?.toLowerCase() !== 'story') {
                return;
            }
            const statusName = issue.status?.name?.toLowerCase();
            if (statusName === 'closed' || statusName === 'done' || statusName === 'close') {
                closedStories++;
            }
        });

        const bugRateValue = closedStories > 0 ? Number((bugsCreated / closedStories).toFixed(2)) : 0;

        return {
            bugsCreated,
            closedStories,
            bugRateValue,
        };
    }
}

export default new BugRateService();
