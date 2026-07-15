import { Types } from 'mongoose';
export default async function leadTimeLogic({ ctx, builder, params, shared }) {
    const { companyId, projectId, boardId, sprintId, releaseId, repo } = params;
    const { allPullRequests } = shared;

    const boardObjId = boardId ? new Types.ObjectId(boardId) : null;

    const sprint = sprintId ? shared.allSprints.find((s) => s._id.equals(sprintId)) : null;
    const release = releaseId ? shared.allReleases.find((r) => r._id.equals(releaseId)) : null;

    const matchesBoard = (pr) => !boardObjId || (pr.boardId && new Types.ObjectId(pr.boardId).equals(boardObjId));
    const matchesSprint = (pr, sid) => {
        const prSprintIds = Array.isArray(pr.sprintId) ? pr.sprintId.map((s) => s?.toString?.() ?? String(s)) : [String(pr.sprintId)];
        return prSprintIds.includes(String(sid));
    };
    const matchesRelease = (pr, releaseName) => pr.fixVersion === releaseName;

    const filteredPRs = allPullRequests.filter((pr) => {
        if (!matchesBoard(pr)) {return false;}
        if (sprintId && !matchesSprint(pr, sprintId)) {return false;}
        if (releaseId && !matchesRelease(pr, ctx.selectedType?.releaseName)) {return false;}
        return true;
    });

    const calculateTime = (start, end) => (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);

    const developerStats = {};
    let totalLeadTimeSum = 0;

    for (const pr of filteredPRs) {
        if (!pr.commits || pr.commits.length === 0) {continue;}

        const firstCommitTime = new Date(pr.commits[0].date).getTime();
        let releaseDate;

        if (sprintId && sprint?.releases) {
            const matchingRelease = sprint.releases.find((r) => r.name === pr.fixVersion);
            releaseDate = matchingRelease?.releaseDate;
        } else if (releaseId && release) {
            releaseDate = release.releaseDate;
        }

        if (!releaseDate) {continue;}
        const releaseTime = new Date(releaseDate).getTime();
        if (releaseTime <= firstCommitTime) {continue;}

        const leadTime = calculateTime(pr.commits[0].date, releaseDate);

        const developer = pr.prCreatedBy || 'Unknown';
        if (!developerStats[developer]) {
            developerStats[developer] = { totalPRs: 0, totalLTC: 0, minLTC: leadTime, maxLTC: leadTime };
        }
        developerStats[developer].totalPRs += 1;
        developerStats[developer].totalLTC += leadTime;
        developerStats[developer].minLTC = Math.min(developerStats[developer].minLTC, leadTime);
        developerStats[developer].maxLTC = Math.max(developerStats[developer].maxLTC, leadTime);

        totalLeadTimeSum += leadTime;
    }

    const devStatsArray = Object.entries(developerStats).map(([developer, stats]) => ({
        developer,
        totalPRs: stats.totalPRs,
        avgLTC: Number((stats.totalLTC / stats.totalPRs).toFixed(2)),
        minLTC: Number(stats.minLTC.toFixed(2)),
        maxLTC: Number(stats.maxLTC.toFixed(2)),
    }));

    const totalPRs = filteredPRs.length;
    const averageLeadTime = totalPRs > 0 ? totalLeadTimeSum / totalPRs : 0;
    const validAverageLeadTime = isNaN(averageLeadTime) || !isFinite(averageLeadTime) ? 0 : averageLeadTime;

    const filter = {
        companyId: new Types.ObjectId(companyId),
        projectId: new Types.ObjectId(projectId),
        sprintId: sprintId || null,
        releaseId: releaseId || null,
        repoName: repo,
    };
    await builder.DoraMetrics.updateOne(
        filter,
        { $set: { 'metrics.leadTime': validAverageLeadTime } },
        { upsert: true }
    );

    return [
        { result: devStatsArray },
        { total: Math.max(0, Math.round(validAverageLeadTime || 0)) },
    ];
}
