import { Types } from 'mongoose';
import { getSprintDates, getReleaseDates } from '../common/scmHelper.js';
import {
    RELEASE_STATUS_RELEASED,
    RELEASE_STATUS_UNRELEASED,
    STATUS_ACTIVE,
    STATUS_CLOSED,
} from '../../../utils/constants/statusConstants.js';

export default async function standupOpenPRsLogic({ ctx, builder, params }) {
    const { companyId, projectId, boardId, sprintId, releaseId, developer } = params;

    const [allPullRequests, lastSixSprints, lastSixReleases] = await Promise.all([
        builder.getAllPullRequests(),
        builder.getLastSixSprints(),
        builder.getLastSixReleases(),
    ]);

    const boardObjId = new Types.ObjectId(boardId);

    let identifierType, endDate;

    if (sprintId) {
        identifierType = 'sprintId';
    } else if (releaseId) {
        if (!ctx.selectedType?.releaseName) {return null;}
        identifierType = 'releaseId';
    } else {
        return null;
    }

    const filteredPRs = allPullRequests.filter(pr => {
        if (pr.status !== 'open') {return false;}
        if (pr.boardId && !new Types.ObjectId(pr.boardId).equals(boardObjId)) {return false;}
        if (sprintId) {
            const prSprintIds = Array.isArray(pr.sprintId) ? pr.sprintId.map(String) : [String(pr.sprintId)];
            if (!prSprintIds.includes(String(sprintId))) {return false;}
        } else if (releaseId) {
            if (pr.fixVersion !== ctx.selectedType.releaseName) {return false;}
        }
        if (developer) {
            if (pr.prCreatedBy !== developer) {return false;}
        }
        return true;
    });

    const sprints = lastSixSprints.length > 0 ? lastSixSprints :
        await builder.Sprint.find({
            companyId, projectId,
            state: { $in: [STATUS_ACTIVE, STATUS_CLOSED] },
            boardId: boardObjId,
        }).lean();

    const releases = lastSixReleases.length > 0 ? lastSixReleases :
        await builder.JiraRelease.find({
            companyId, projectId,
            status: { $in: [RELEASE_STATUS_RELEASED, RELEASE_STATUS_UNRELEASED] },
            boardId: boardObjId,
        }).lean();

    if (identifierType === 'sprintId') {
        ({ endDate } = getSprintDates(sprints, sprintId));
    } else {
        ({ endDate } = getReleaseDates(releases, releaseId));
    }

    const end = new Date(endDate);

    const openPullRequestsCount = filteredPRs.filter(pr => new Date(pr.prCreatedAt) < end).length;

    const totalOpenPullRequestsByDev = filteredPRs
        .filter(pr => new Date(pr.prCreatedAt) < end)
        .reduce((acc, pr) => {
            const dev = pr.prCreatedBy;
            if (!acc[dev]) {acc[dev] = 0;}
            acc[dev]++;
            return acc;
        }, {});

    const totalOpenByDevArray = Object.entries(totalOpenPullRequestsByDev)
        .map(([dev, count]) => ({ dev, count }));

    let reviewedPRs = 0;
    let unreviewedPRs = 0;
    filteredPRs.forEach(({ status, reviews, prCreatedAt }) => {
        if (status === 'open' && new Date(prCreatedAt) < end) {
            if (reviews && reviews.length > 0) {
                reviewedPRs++;
            } else {
                unreviewedPRs++;
            }
        }
    });

    const items = identifierType === 'sprintId' ? sprints : releases;
    const isSprint = identifierType === 'sprintId';
    const selectedId = sprintId || releaseId;

    const perSprintOrRelease = {};
    if (isSprint) {
        const sortedItems = [...items].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        const selectedIdx = sortedItems.findIndex(s => s._id.toString() === String(selectedId));
        if (selectedIdx !== -1) {
            const sliced = sortedItems.slice(Math.max(0, selectedIdx - 5), selectedIdx + 1);
            sliced.forEach(item => { perSprintOrRelease[item.name] = 0; });
            filteredPRs.forEach(pr => {
                sliced.forEach(sprint => {
                    const prSprintIds = Array.isArray(pr.sprintId) ? pr.sprintId.map(String) : [String(pr.sprintId)];
                    if (prSprintIds.includes(String(sprint._id))) {
                        perSprintOrRelease[sprint.name]++;
                    }
                });
            });
        }
    } else {
        const sortedItems = [...items].sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
        const selectedIdx = sortedItems.findIndex(r => r._id.toString() === String(selectedId));
        if (selectedIdx !== -1) {
            const sliced = sortedItems.slice(Math.max(0, selectedIdx - 5), selectedIdx + 1);
            sliced.forEach(item => { perSprintOrRelease[item.releaseName] = 0; });
            filteredPRs.forEach(pr => {
                sliced.forEach(release => {
                    if (release.releaseName === pr.fixVersion) {
                        perSprintOrRelease[release.releaseName]++;
                    }
                });
            });
        }
    }

    return {
        openPullRequestsCount,
        openPullRequests: Object.entries(perSprintOrRelease).map(([name, count]) => ({
            name, count: parseFloat(count),
        })),
        totalOpenPullRequestsByDev: totalOpenByDevArray,
        getOpenReviewedAndUnreviewedPrs: {
            OpenPrs: {
                UnreviewedPRs: unreviewedPRs,
                ReviewedPRs: reviewedPRs,
            },
        },
    };
}
