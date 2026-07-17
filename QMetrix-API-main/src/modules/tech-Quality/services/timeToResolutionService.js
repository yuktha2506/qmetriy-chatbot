const SEVERITIES = ['critical', 'high', 'medium', 'low'];

const PRIORITY_TO_SEVERITY = {
    highest: 'critical',
    critical: 'critical',
    'sev-1': 'critical',
    high: 'high',
    'sev-2': 'high',
    medium: 'medium',
    'sev-3': 'medium',
    low: 'low',
    lowest: 'low',
    'sev-4': 'low',
};

function mapPriorityToSeverity(priority) {
    if (!priority || typeof priority !== 'string') {return 'medium';}
    const normalized = priority.toLowerCase().trim();
    return PRIORITY_TO_SEVERITY[normalized] ?? 'medium';
}

function getDefaultTimeToResolution() {
    return {
        overall: { resolvedBugs: 0, avgResolutionDays: 0, totalResolutionDays: 0 },
        bySeverity: {
            critical: { resolvedBugs: 0, avgResolutionDays: 0, totalResolutionDays: 0 },
            high: { resolvedBugs: 0, avgResolutionDays: 0, totalResolutionDays: 0 },
            medium: { resolvedBugs: 0, avgResolutionDays: 0, totalResolutionDays: 0 },
            low: { resolvedBugs: 0, avgResolutionDays: 0, totalResolutionDays: 0 },
        },
    };
}

class TimeToResolutionService {
    calculateTimeToResolution(workCompletedIssues) {
        const resolvedBugs = workCompletedIssues.filter(
            (issue) =>
                issue.type?.name?.toLowerCase() === 'bug' &&
                issue.workStartedAt &&
                issue.workCompletedAt
        );

        if (resolvedBugs.length === 0) {
            return getDefaultTimeToResolution();
        }

        const overallCount = resolvedBugs.length;
        const bySeverityData = {
            critical: { sum: 0, count: 0 },
            high: { sum: 0, count: 0 },
            medium: { sum: 0, count: 0 },
            low: { sum: 0, count: 0 },
        };

        let totalResolutionDays = 0;

        resolvedBugs.forEach((issue) => {
            const resolutionMs = new Date(issue.workCompletedAt) - new Date(issue.workStartedAt);
            const resolutionDays = resolutionMs / (24 * 60 * 60 * 1000);

            totalResolutionDays += resolutionDays;

            const severity = mapPriorityToSeverity(issue.priority);
            if (bySeverityData[severity]) {
                bySeverityData[severity].sum += resolutionDays;
                bySeverityData[severity].count += 1;
            }
        });

        const overallAvg = overallCount > 0 ? totalResolutionDays / overallCount : 0;

        const bySeverity = {};
        SEVERITIES.forEach((sev) => {
            const { sum, count } = bySeverityData[sev];
            bySeverity[sev] = {
                resolvedBugs: count,
                avgResolutionDays: count > 0 ? sum / count : 0,
                totalResolutionDays: Math.round(sum * 100) / 100,
            };
        });

        return {
            overall: {
                resolvedBugs: overallCount,
                avgResolutionDays: Math.round(overallAvg * 100) / 100,
                totalResolutionDays: Math.round(totalResolutionDays * 100) / 100,
            },
            bySeverity: Object.fromEntries(
                Object.entries(bySeverity).map(([k, v]) => [
                    k,
                    { ...v, avgResolutionDays: Math.round(v.avgResolutionDays * 100) / 100 },
                ])
            ),
        };
    }
}

export default new TimeToResolutionService();
