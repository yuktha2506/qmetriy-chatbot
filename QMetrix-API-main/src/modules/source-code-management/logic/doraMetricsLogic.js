import { Types } from 'mongoose';
export default async function doraMetricsLogic({ builder, params, shared }) {
    const { companyId, projectId, boardId, sprintId, releaseId, repo } = params;
    const { allSprints, allReleases } = shared;

    const projectObjId = new Types.ObjectId(projectId);
    const companyObjId = new Types.ObjectId(companyId);
    const boardObjId = new Types.ObjectId(boardId);

    const matchQuery = {
        projectId: projectObjId,
        companyId: companyObjId,
        boardId: boardObjId,
    };

    if (repo) {
        matchQuery.repoName = repo;
    }

    let identifierType;
    let pastIdentifiers = [];
    const idToNameMap = new Map();

    if (sprintId) {
        matchQuery.sprintId = new Types.ObjectId(sprintId);
        identifierType = 'sprintId';
        const sortedSprints = [...allSprints].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        const selectedIndex = sortedSprints.findIndex((s) => s._id.equals(sprintId));
        if (selectedIndex !== -1) {
            pastIdentifiers = sortedSprints.slice(Math.max(0, selectedIndex - 5), selectedIndex + 1).map((s) => s._id);
        }
        pastIdentifiers.forEach((id) => {
            const sprint = allSprints.find((s) => s._id.equals(id));
            if (sprint) {idToNameMap.set(id.toString(), sprint.name);}
        });
    } else if (releaseId) {
        matchQuery.releaseId = new Types.ObjectId(releaseId);
        identifierType = 'releaseId';
        const sortedReleases = [...allReleases].sort((a, b) => new Date(a.releaseDate || a.startDate) - new Date(b.releaseDate || b.startDate));
        const selectedIndex = sortedReleases.findIndex((r) => r._id.equals(releaseId));
        if (selectedIndex !== -1) {
            pastIdentifiers = sortedReleases.slice(Math.max(0, selectedIndex - 5), selectedIndex + 1).map((r) => r._id);
        }
        pastIdentifiers.forEach((id) => {
            const release = allReleases.find((r) => r._id.equals(id));
            if (release) {idToNameMap.set(id.toString(), release.releaseName);}
        });
    }

    const metricsData = await builder.DoraMetrics.aggregate([{ $match: matchQuery }], { allowDiskUse: true });

    const fetchTrend = async (metricField, trendName) => {
        if (!identifierType || pastIdentifiers.length === 0) {return [];}

        const trendQuery = {
            projectId: projectObjId,
            companyId: companyObjId,
            boardId: boardObjId,
            [identifierType]: { $in: pastIdentifiers },
        };
        if (repo) {trendQuery.repoName = repo;}

        const pipeline = [
            { $match: trendQuery },
            { $sort: { createdAt: -1 } },
            {
                $project: {
                    _id: 0,
                    identifierId: `$${identifierType}`,
                    [trendName]: `$metrics.${metricField}`,
                },
            },
        ];

        const results = await builder.DoraMetrics.aggregate(pipeline, { allowDiskUse: true });

        const byName = new Map();
        for (const doc of results) {
            const idStr = doc.identifierId?.toString?.();
            const name = idStr ? idToNameMap.get(idStr) : null;
            if (name !== null && name !== undefined && !byName.has(name)) {
                byName.set(name, { name, [trendName]: doc[trendName] });
            }
        }
        return Array.from(byName.values());
    };

    const [dFTrend, cFTrend, mttrTrend] = await Promise.all([
        fetchTrend('deploymentFrequency.avgDeploymentsPerDay', 'avgDeploymentsPerDay'),
        fetchTrend('changeFailureRate.changeFailureRate', 'changeFailureRate'),
        fetchTrend('mttr.mttr', 'mttr'),
    ]);

    return {
        metricsData,
        dFTrend,
        cFTrend,
        mttrTrend,
    };
}
