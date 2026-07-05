export default async function cxoTrendsLogic({ builder, params, shared }) {
    try {
        const { companyId, projectId, sprintId, releaseId, pageValue } = params;
        const count = Number(pageValue) || 7;

        let selectedIssues = [];

        if (sprintId) {
            selectedIssues = await builder.Cxo.find({ sprintId, companyId, projectId });
        } else if (releaseId) {
            const releaseData = shared.releaseData;
            selectedIssues = await builder.Cxo.find({
                companyId,
                projectId,
                releaseVersion: releaseData?.releaseName,
            });
        } else {
            return [];
        }

        const [releaseReadinessTrendResult, engineeringScoreTrendResult] = await Promise.allSettled([
            computeReleaseReadinessTrend(selectedIssues, count),
            computeEngineeringScoreTrend(selectedIssues, count),
        ]);

        const result = [];
        result.push({
            releaseReadinessTrend: releaseReadinessTrendResult.status === 'fulfilled' ? releaseReadinessTrendResult.value : null,
        });
        result.push({
            engineeringScoreTrend: engineeringScoreTrendResult.status === 'fulfilled' ? engineeringScoreTrendResult.value : null,
        });

        if (releaseReadinessTrendResult.status === 'rejected') {
            console.error('Error fetching release readiness trend:', releaseReadinessTrendResult.reason);
        }
        if (engineeringScoreTrendResult.status === 'rejected') {
            console.error('Error fetching engineering score trend:', engineeringScoreTrendResult.reason);
        }

        return result;
    } catch (error) {
        console.error('Error in cxoTrendsLogic:', error);
        return [];
    }
}

async function computeReleaseReadinessTrend(selectedIssues, count) {
    if (!selectedIssues || selectedIssues.length === 0) {
        console.error('No issues provided for readiness trend calculation');
        return;
    }
    const trends = [];
    const today = new Date();
    const readinessData = selectedIssues.map((item) => ({
        date: new Date(item.createdAt).toISOString().split('T')[0],
        readinessScore: item?.releaseReadinessObject?.releaseReadiness || 0,
    }));

    for (let i = 0; i < count; i++) {
        const currentDate = new Date();
        currentDate.setDate(today.getDate() - i);
        const formattedDate = currentDate.toISOString().split('T')[0];

        const existingData = readinessData.find((entry) => entry.date === formattedDate);
        trends.push({
            date: formattedDate,
            readinessScore: existingData ? existingData.readinessScore : 0,
        });
    }
    return trends;
}

async function computeEngineeringScoreTrend(selectedIssues, count) {
    if (!selectedIssues || selectedIssues.length === 0) {
        console.error('No issues provided for engineering trend calculation');
        return;
    }
    const trends = [];
    const today = new Date();
    const engineeringData = selectedIssues.map((item) => ({
        date: new Date(item.createdAt).toISOString().split('T')[0],
        engineeringScore: item.engineeringScoreObject.engineeringScore || 0,
    }));

    for (let i = 0; i < count; i++) {
        const currentDate = new Date();
        currentDate.setDate(today.getDate() - i);
        const formattedDate = currentDate.toISOString().split('T')[0];

        const existingData = engineeringData.find((entry) => entry.date === formattedDate);
        trends.push({
            date: formattedDate,
            engineeringScore: existingData ? existingData.engineeringScore : 0,
        });
    }
    return trends;
}
