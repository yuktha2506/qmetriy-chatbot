import { Types } from 'mongoose';
import { getSprintDates, getReleaseDates } from '../common/scmHelper.js';

export default async function approvalRateLogic({ ctx, params, shared }) {
    const { boardId, sprintId, releaseId } = params;
    const { allPullRequests, gitConnections, allSprints, allReleases } = shared;

    const isGitLab = gitConnections?.gitProvider === 'gitlab';
    const mergedFlag = isGitLab ? 'merged' : 'true';
    const dateField = isGitLab ? 'prMergedAt' : 'prClosedAt';

    const boardObjId = boardId ? new Types.ObjectId(boardId) : null;

    let identifierType, startDate, endDate;

    if (sprintId) {
        identifierType = 'sprintId';
    } else if (releaseId) {
        if (!ctx.selectedType?.releaseName) {return null;}
        identifierType = 'releaseId';
    } else {
        return null;
    }

    const sprintObjId = sprintId ? new Types.ObjectId(sprintId) : null;
    const releaseObjId = releaseId ? new Types.ObjectId(releaseId) : null;

    if (identifierType === 'sprintId') {
        ({ startDate, endDate } = getSprintDates(allSprints, sprintObjId));
    } else {
        ({ startDate, endDate } = getReleaseDates(allReleases, releaseObjId));
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const matchesBoard = (pr) => !boardObjId || !pr.boardId || new Types.ObjectId(pr.boardId).equals(boardObjId);
    const matchesSprint = (pr, sid) => {
        const prSprintIds = Array.isArray(pr.sprintId) ? pr.sprintId.map((s) => s?.toString?.() ?? String(s)) : [String(pr.sprintId)];
        return prSprintIds.includes(String(sid));
    };
    const matchesRelease = (pr, releaseName) => pr.fixVersion === releaseName;

    const filteredPRs = allPullRequests.filter((pr) => {
        if (!matchesBoard(pr)) {return false;}
        if (sprintId && !matchesSprint(pr, sprintId)) {return false;}
        if (releaseId && !matchesRelease(pr, ctx.selectedType.releaseName)) {return false;}
        return true;
    });

    const totalSubmitted = filteredPRs.length;
    const totalMerged = filteredPRs.filter((pr) => {
        if (pr.merged !== mergedFlag) {return false;}
        const d = pr[dateField];
        if (!d) {return false;}
        const date = new Date(d);
        return isGitLab ? (date >= start && date <= end) : (date >= start && date < end);
    }).length;

    const approvalRate = totalSubmitted > 0 ? Math.round((totalMerged / totalSubmitted) * 100) : 0;

    const approvalRateByDev = {};
    for (const pr of filteredPRs) {
        const name = pr.prCreatedBy || 'Unknown';
        if (!approvalRateByDev[name]) {
            approvalRateByDev[name] = { totalSubmitted: 0, totalMerged: 0 };
        }
        approvalRateByDev[name].totalSubmitted++;
        if (pr.merged === mergedFlag) {
            const d = pr[dateField];
            if (d) {
                const date = new Date(d);
                const inRange = isGitLab ? (date >= start && date <= end) : (date >= start && date < end);
                if (inRange) {
                    approvalRateByDev[name].totalMerged++;
                }
            }
        }
    }
    const approvalRateByDevArray = Object.entries(approvalRateByDev).map(([name, { totalSubmitted: ts, totalMerged: tm }]) => ({
        name,
        approvalRate: ts > 0 ? Math.round((tm / ts) * 100) : 0,
    }));

    const result = {
        approvalRate,
        approvalRateByDev: approvalRateByDevArray,
    };

    const isSprint = identifierType === 'sprintId';
    const items = isSprint ? allSprints : allReleases;
    const sortedItems = isSprint
        ? [...items].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
        : [...items].sort((a, b) => new Date(a.releaseDate || a.startDate) - new Date(b.releaseDate || b.startDate));

    const selectedIdx = sortedItems.findIndex((s) =>
        isSprint ? s._id.toString() === String(sprintId) : s._id.toString() === String(releaseId)
    );
    const lastSix = selectedIdx >= 0
        ? sortedItems.slice(Math.max(0, selectedIdx - 5), selectedIdx + 1)
        : sortedItems.slice(-6);

    if (sprintId) {
        result.approvalRatePerSprint = lastSix.map((sprint) => {
            const sprintPRs = allPullRequests.filter((pr) => matchesBoard(pr) && matchesSprint(pr, sprint._id));
            const { startDate: pStart, endDate: pEnd } = getSprintDates(allSprints, sprint._id);
            const pStartDate = new Date(pStart);
            const pEndDate = new Date(pEnd);
            const ts = sprintPRs.length;
            const tm = sprintPRs.filter((pr) => {
                if (pr.merged !== mergedFlag) {return false;}
                const d = pr[dateField];
                if (!d) {return false;}
                const date = new Date(d);
                return isGitLab ? (date >= pStartDate && date <= pEndDate) : (date >= pStartDate && date < pEndDate);
            }).length;
            return {
                sprint: sprint.name,
                approvalRate: ts > 0 ? Math.round((tm / ts) * 100) : 0,
            };
        });
    }

    if (releaseId) {
        result.approvalRatePerRelease = lastSix.map((release) => {
            const releasePRs = allPullRequests.filter((pr) => matchesBoard(pr) && matchesRelease(pr, release.releaseName));
            const { startDate: pStart, endDate: pEnd } = getReleaseDates(allReleases, release._id);
            const pStartDate = new Date(pStart);
            const pEndDate = new Date(pEnd);
            const ts = releasePRs.length;
            const tm = releasePRs.filter((pr) => {
                if (pr.merged !== mergedFlag) {return false;}
                const d = pr[dateField];
                if (!d) {return false;}
                const date = new Date(d);
                return isGitLab ? (date >= pStartDate && date <= pEndDate) : (date >= pStartDate && date < pEndDate);
            }).length;
            return {
                release: release.releaseName,
                approvalRate: ts > 0 ? Math.round((tm / ts) * 100) : 0,
            };
        });
    }

    return result;
}
